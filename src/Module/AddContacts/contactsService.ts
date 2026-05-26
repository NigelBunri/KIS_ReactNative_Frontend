// src/screens/chat/contactsService.ts

import Contacts from 'react-native-contacts';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

export type KISDeviceContact = {
  id: string;
  name: string;
  phone: string; // normalized phone, e.g. +237676139884
};

export type KISContact = KISDeviceContact & {
  isRegistered: boolean;
  userId?: string;
};

export const CONTACTS_CACHE_KEY = 'KIS_CONTACTS_CACHE_V1';
const CONTACTS_CACHE_META_KEY = 'KIS_CONTACTS_CACHE_META_V1';
const DEFAULT_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

// How many phones to send in a single bulk request
const BULK_CHUNK_SIZE = 500;
// How many chunk requests run concurrently
const BULK_CONCURRENCY = 4;

type CacheMeta = {
  savedAt: number;
};

type ContactLookupCacheEntry = {
  at: number;
  isRegistered: boolean;
  userId?: string;
};

const contactLookupCache = new Map<string, ContactLookupCacheEntry>();
const CONTACT_LOOKUP_TTL_MS = 10 * 60 * 1000;
const FORCED_REFRESH_MIN_INTERVAL_MS = 60 * 1000;
let lastBackendRefreshAt = 0;

const normalizePhoneForBackend = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (cleaned.startsWith('+')) return cleaned;
  return cleaned.replace(/\D/g, '');
};

export type ContactsPermissionStatus =
  | 'granted'
  | 'denied'
  | 'never_ask_again'
  | 'undetermined';

export async function getContactsPermissionStatus(): Promise<ContactsPermissionStatus> {
  if (Platform.OS === 'ios') {
    const perm = await Contacts.checkPermission();
    if (perm === 'authorized') return 'granted';
    if (perm === 'denied') return 'denied';
    return 'undetermined';
  }

  const hasRead = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  );
  if (hasRead) return 'granted';
  return 'undetermined';
}

export async function requestContactsPermission(): Promise<ContactsPermissionStatus> {
  if (Platform.OS === 'ios') {
    const req = await Contacts.requestPermission();
    if (req === 'authorized') return 'granted';
    return 'denied';
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
  ]);

  const readResult = result[PermissionsAndroid.PERMISSIONS.READ_CONTACTS];
  if (readResult === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (readResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
    return 'never_ask_again';
  return 'denied';
}

async function ensureContactsPermission() {
  const status = await requestContactsPermission();
  if (status !== 'granted') {
    throw new Error('Contacts permission denied');
  }
}

export async function getDeviceContactsFromDevice(): Promise<KISDeviceContact[]> {
  try {
    await ensureContactsPermission();
  } catch (err) {
    console.warn(`Contacts permission denied: ${String(err)}`);
    return [];
  }

  try {
    // getAllWithoutPhotos is significantly faster — skip photo binary data
    const rawContacts = await (
      typeof (Contacts as any).getAllWithoutPhotos === 'function'
        ? (Contacts as any).getAllWithoutPhotos()
        : Contacts.getAll()
    ) as Awaited<ReturnType<typeof Contacts.getAll>>;

    // Deduplicate by normalized phone number using a Set for O(1) lookups
    const seenPhones = new Set<string>();
    const deviceContacts: KISDeviceContact[] = [];

    for (const c of rawContacts) {
      if (!c.phoneNumbers || c.phoneNumbers.length === 0) continue;
      for (const phoneEntry of c.phoneNumbers) {
        const rawPhone = phoneEntry?.number || '';
        const cleanedPhone = normalizePhoneForBackend(rawPhone);
        if (!cleanedPhone || seenPhones.has(cleanedPhone)) continue;
        seenPhones.add(cleanedPhone);
        deviceContacts.push({
          id: `${c.recordID}-${cleanedPhone}`,
          name: c.displayName || c.givenName || 'Unnamed',
          phone: cleanedPhone,
        });
      }
    }

    return deviceContacts;
  } catch (err) {
    console.warn(`Error loading device contacts: ${String(err)}`);
    return [];
  }
}

// ─── Bulk response parser ─────────────────────────────────────────────────────

function parseBulkResponse(
  data: any,
  phones: string[],
): Map<string, { registered: boolean; userId?: string }> {
  const map = new Map<string, { registered: boolean; userId?: string }>();
  if (!data) return map;

  // Shape 1: { results: { "+237...": { registered, user_id } } }
  if (data.results && typeof data.results === 'object' && !Array.isArray(data.results)) {
    for (const [phone, entry] of Object.entries(data.results)) {
      const e = entry as any;
      map.set(phone, {
        registered: !!e?.registered,
        userId: e?.user_id != null ? String(e.user_id) : e?.userId != null ? String(e.userId) : undefined,
      });
    }
    return map;
  }

  // Shape 2: array of { phone, registered, user_id }
  if (Array.isArray(data)) {
    for (const entry of data) {
      const phone = entry?.phone;
      if (!phone) continue;
      map.set(phone, {
        registered: !!entry?.registered,
        userId: entry?.user_id != null ? String(entry.user_id) : entry?.userId != null ? String(entry.userId) : undefined,
      });
    }
    return map;
  }

  // Shape 3: { registered: [phones], users: { phone: userId } }
  if (Array.isArray(data.registered)) {
    const registeredSet = new Set(data.registered as string[]);
    const usersMap: Record<string, any> = data.users ?? data.user_ids ?? {};
    for (const phone of phones) {
      if (registeredSet.has(phone)) {
        map.set(phone, {
          registered: true,
          userId: usersMap[phone] != null ? String(usersMap[phone]) : undefined,
        });
      }
    }
    return map;
  }

  return map;
}

// ─── Bulk lookup (primary path) ───────────────────────────────────────────────

async function markRegisteredBulk(
  contacts: KISDeviceContact[],
): Promise<KISContact[]> {
  if (contacts.length === 0) return [];

  const now = Date.now();
  const results: KISContact[] = [];
  const toFetch: KISDeviceContact[] = [];

  for (const contact of contacts) {
    const cached = contactLookupCache.get(contact.phone);
    if (cached && now - cached.at <= CONTACT_LOOKUP_TTL_MS) {
      results.push({ ...contact, isRegistered: cached.isRegistered, userId: cached.userId });
    } else {
      toFetch.push(contact);
    }
  }

  if (toFetch.length === 0) return results;

  // Split into fixed-size chunks
  const chunks: KISDeviceContact[][] = [];
  for (let i = 0; i < toFetch.length; i += BULK_CHUNK_SIZE) {
    chunks.push(toFetch.slice(i, i + BULK_CHUNK_SIZE));
  }

  // Process each chunk as a POST bulk request
  const processChunk = async (chunk: KISDeviceContact[]): Promise<KISContact[]> => {
    const phones = chunk.map((c) => c.phone);
    try {
      const res = await postRequest(ROUTES.contacts.check, { phones });
      if (res.success) {
        const lookup = parseBulkResponse(res.data, phones);
        const now = Date.now();
        return chunk.map((contact) => {
          const entry = lookup.get(contact.phone);
          const isRegistered = entry?.registered ?? false;
          const userId = entry?.userId;
          contactLookupCache.set(contact.phone, { at: now, isRegistered, userId });
          return { ...contact, isRegistered, userId };
        });
      } else if (Number(res.status) === 405) {
        // Server does not support POST yet — sequential fallback
        return markRegisteredSequential(chunk);
      } else {
        return chunk.map((c) => ({ ...c, isRegistered: false }));
      }
    } catch {
      return chunk.map((c) => ({ ...c, isRegistered: false }));
    }
  };

  // Run up to BULK_CONCURRENCY chunks in parallel
  for (let i = 0; i < chunks.length; i += BULK_CONCURRENCY) {
    const batch = chunks.slice(i, i + BULK_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(processChunk));
    for (const arr of batchResults) results.push(...arr);
  }

  return results;
}

// ─── Sequential fallback (used when bulk POST is unavailable) ─────────────────

let sequentialBlockedUntil = 0;

async function markRegisteredSequential(
  contacts: KISDeviceContact[],
): Promise<KISContact[]> {
  const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
  const NOT_FOUND_COOLDOWN_MS = 5 * 60 * 1000;
  const BATCH = 8;
  const DELAY_MS = 80;

  const now = Date.now();
  if (now < sequentialBlockedUntil) {
    return contacts.map((c) => {
      const cached = contactLookupCache.get(c.phone);
      return cached
        ? { ...c, isRegistered: cached.isRegistered, userId: cached.userId }
        : { ...c, isRegistered: false };
    });
  }

  const results: KISContact[] = [];

  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH);
    for (const contact of batch) {
      const cached = contactLookupCache.get(contact.phone);
      if (cached && Date.now() - cached.at <= CONTACT_LOOKUP_TTL_MS) {
        results.push({ ...contact, isRegistered: cached.isRegistered, userId: cached.userId });
        continue;
      }
      try {
        const url = `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(contact.phone)}`;
        const res = await getRequest(url);
        if (!res.success) {
          results.push({ ...contact, isRegistered: false });
          if (Number(res.status) === 429) {
            sequentialBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            break;
          }
          if (Number(res.status) === 404) {
            sequentialBlockedUntil = Date.now() + NOT_FOUND_COOLDOWN_MS;
            break;
          }
        } else {
          const payload = res?.data ?? {};
          const registered = !!payload?.registered;
          const rawUserId = payload?.userId ?? payload?.user_id ?? payload?.id ?? null;
          const userId = rawUserId != null ? String(rawUserId) : undefined;
          contactLookupCache.set(contact.phone, { at: Date.now(), isRegistered: registered, userId });
          results.push({ ...contact, isRegistered: registered, userId });
        }
      } catch {
        results.push({ ...contact, isRegistered: false });
      }
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
    if (Date.now() < sequentialBlockedUntil) break;
  }

  // Any contacts we didn't reach
  if (results.length < contacts.length) {
    const processed = new Set(results.map((r) => r.phone));
    contacts
      .filter((c) => !processed.has(c.phone))
      .forEach((c) => results.push({ ...c, isRegistered: false }));
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function markRegisteredOnBackend(
  deviceContacts: KISDeviceContact[],
): Promise<KISContact[]> {
  return markRegisteredBulk(deviceContacts);
}

export async function refreshFromDeviceAndBackend(): Promise<KISContact[]> {
  return refreshFromDeviceAndBackendWithOptions({});
}

export async function refreshFromDeviceAndBackendWithOptions(options: {
  force?: boolean;
  maxAgeMs?: number;
}): Promise<KISContact[]> {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
  const now = Date.now();

  // Respect minimum refresh interval even when force=true
  if (options.force && now - lastBackendRefreshAt < FORCED_REFRESH_MIN_INTERVAL_MS) {
    const cached = await getCachedContacts(maxAgeMs * 6); // lenient age for forced-but-throttled
    if (cached) return cached;
  }

  if (!options.force) {
    const cached = await getCachedContacts(maxAgeMs);
    if (cached) return cached;
  }

  const deviceContacts = await getDeviceContactsFromDevice();
  const marked = await markRegisteredBulk(deviceContacts);
  await setCachedContacts(marked);
  lastBackendRefreshAt = Date.now();
  return marked;
}

async function getCachedContacts(maxAgeMs: number): Promise<KISContact[] | null> {
  try {
    const [rawContacts, rawMeta] = await Promise.all([
      AsyncStorage.getItem(CONTACTS_CACHE_KEY),
      AsyncStorage.getItem(CONTACTS_CACHE_META_KEY),
    ]);
    if (!rawContacts || !rawMeta) return null;
    const meta = JSON.parse(rawMeta) as CacheMeta;
    if (!meta?.savedAt) return null;
    if (Date.now() - meta.savedAt > maxAgeMs) return null;
    const parsed = JSON.parse(rawContacts);
    return Array.isArray(parsed) ? (parsed as KISContact[]) : null;
  } catch {
    return null;
  }
}

async function setCachedContacts(contacts: KISContact[]): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(contacts)),
      AsyncStorage.setItem(
        CONTACTS_CACHE_META_KEY,
        JSON.stringify({ savedAt: Date.now() }),
      ),
    ]);
  } catch (err: any) {
    console.warn('[contactsService] failed to cache contacts', err?.message);
  }
}

export async function saveContactToDevice(payload: {
  name: string;
  phone: string;
  countryCode: string;
}): Promise<void> {
  await ensureContactsPermission();

  const newContact = {
    givenName: payload.name,
    familyName: '',
    phoneNumbers: [{ label: 'mobile', number: payload.phone }],
    emailAddresses: [],
  } as any;

  try {
    await Contacts.addContact(newContact);
  } catch (err) {
    console.warn(`Error adding contact to device: ${String(err)}`);
    throw err;
  }
}
