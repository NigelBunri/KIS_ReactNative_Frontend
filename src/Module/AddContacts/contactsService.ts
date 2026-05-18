// src/screens/chat/contactsService.ts

import Contacts from 'react-native-contacts';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type KISDeviceContact = {
  id: string;
  name: string;
  phone: string; // normalized phone, e.g. +237676139884
};

export type KISContact = KISDeviceContact & {
  isRegistered: boolean;
  userId?: string;
};

const CONTACTS_CACHE_KEY = 'KIS_CONTACTS_CACHE_V1';
const CONTACTS_CACHE_META_KEY = 'KIS_CONTACTS_CACHE_META_V1';
const DEFAULT_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type CacheMeta = {
  savedAt: number;
};

type ContactLookupCacheEntry = {
  at: number;
  isRegistered: boolean;
  userId?: string;
};

const contactLookupCache = new Map<string, ContactLookupCacheEntry>();
const CONTACT_LOOKUP_TTL_MS = 5 * 60 * 1000;
const CONTACT_LOOKUP_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const CONTACT_LOOKUP_NOT_FOUND_COOLDOWN_MS = 5 * 60 * 1000;
const FORCED_REFRESH_MIN_INTERVAL_MS = 60 * 1000;
let contactLookupBlockedUntil = 0;
let lastBackendRefreshAt = 0;

/**
 * Normalize phone number for backend lookup.
 */
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

/**
 * Check current contacts permission WITHOUT requesting it.
 * Returns a normalised status across iOS and Android.
 */
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

/**
 * Request contacts permission. Returns whether it was granted.
 * On iOS, the system only shows the dialog once — subsequent calls
 * return the cached result, so callers should redirect to Settings
 * when status is 'denied'.
 */
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

/**
 * Ensure we have contact permissions on both platforms.
 */
async function ensureContactsPermission() {
  const status = await requestContactsPermission();
  if (status !== 'granted') {
    throw new Error('Contacts permission denied');
  }
}

/**
 * FULL REAL IMPLEMENTATION — loads contacts from the user's device.
 */
export async function getDeviceContactsFromDevice(): Promise<KISDeviceContact[]> {
  try {
    await ensureContactsPermission();
  } catch (err) {
    console.warn(`Contacts permission denied: ${String(err)}`);
    return [];
  }

  try {
    const rawContacts = await Contacts.getAll();
    const deviceContacts: KISDeviceContact[] = [];

    for (const c of rawContacts) {
      if (!c.phoneNumbers || c.phoneNumbers.length === 0) continue;

      // pick first phone number
      const rawPhone = c.phoneNumbers[0]?.number || '';
      const cleanedPhone = normalizePhoneForBackend(rawPhone);

      if (!cleanedPhone) continue;

      deviceContacts.push({
        id: c.recordID,
        name: c.displayName || c.givenName || 'Unnamed',
        phone: cleanedPhone,
      });
    }

    return deviceContacts;
  } catch (err) {
    console.warn(`Error loading device contacts: ${String(err)}`);
    return [];
  }
}

/**
 * CHECKS PHONE NUMBERS AGAINST BACKEND
 */
export async function markRegisteredOnBackend(
  deviceContacts: KISDeviceContact[],
): Promise<KISContact[]> {
  const now = Date.now();
  if (now < contactLookupBlockedUntil) {
    return deviceContacts.map((contact) => {
      const cached = contactLookupCache.get(contact.phone);
      if (!cached || now - cached.at > CONTACT_LOOKUP_TTL_MS) {
        return { ...contact, isRegistered: false };
      }
      return {
        ...contact,
        isRegistered: cached.isRegistered,
        userId: cached.userId,
      };
    });
  }

  const results: KISContact[] = [];
  const BATCH = 8;
  const REQUEST_GAP_MS = 120;

  for (let i = 0; i < deviceContacts.length; i += BATCH) {
    const batch = deviceContacts.slice(i, i + BATCH);
    for (const contact of batch) {
      try {
        const cached = contactLookupCache.get(contact.phone);
        const cacheNow = Date.now();
        if (cached && cacheNow - cached.at <= CONTACT_LOOKUP_TTL_MS) {
          results.push({
            ...contact,
            isRegistered: cached.isRegistered,
            userId: cached.userId,
          });
          continue;
        }

        const url = `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(
          contact.phone,
        )}`;
        const res = await getRequest(url);

        if (!res.success) {
          console.warn(
            `Backend check failed for ${contact.phone} (status: ${res.status} message: ${res.message})`,
          );
          results.push({ ...contact, isRegistered: false });
          if (Number(res.status) === 404) {
            contactLookupBlockedUntil = Date.now() + CONTACT_LOOKUP_NOT_FOUND_COOLDOWN_MS;
            break;
          }
          if (Number(res.status) === 429) {
            contactLookupBlockedUntil = Date.now() + CONTACT_LOOKUP_RATE_LIMIT_COOLDOWN_MS;
            break;
          }
        } else {
          const payload = res?.data ?? {};
          const registered = !!payload?.registered;
          const rawUserId = payload?.userId ?? payload?.user_id ?? payload?.id ?? null;
          const userId = rawUserId != null ? String(rawUserId) : undefined;
          contactLookupCache.set(contact.phone, {
            at: Date.now(),
            isRegistered: registered,
            userId,
          });
          results.push({
            ...contact,
            isRegistered: registered,
            userId,
          });
        }
      } catch (e) {
        console.warn(
          `Backend check error for contact ${contact.phone}: ${String(e)}`,
        );
        results.push({ ...contact, isRegistered: false });
      }
      await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
    }
    if (Date.now() < contactLookupBlockedUntil) break;
  }

  if (results.length >= deviceContacts.length) return results;
  const remainingPhones = new Set(results.map((item) => item.phone));
  const rest = deviceContacts
    .filter((contact) => !remainingPhones.has(contact.phone))
    .map((contact) => {
      const cached = contactLookupCache.get(contact.phone);
      if (!cached || Date.now() - cached.at > CONTACT_LOOKUP_TTL_MS) {
        return { ...contact, isRegistered: false };
      }
      return {
        ...contact,
        isRegistered: cached.isRegistered,
        userId: cached.userId,
      };
    });
  return [...results, ...rest];
}

/**
 * GET DEVICE CONTACTS + MARK REGISTERED USERS
 */
export async function refreshFromDeviceAndBackend(): Promise<KISContact[]> {
  return refreshFromDeviceAndBackendWithOptions({});
}

export async function refreshFromDeviceAndBackendWithOptions(options: {
  force?: boolean;
  maxAgeMs?: number;
}): Promise<KISContact[]> {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
  const now = Date.now();

  if (!options.force || now - lastBackendRefreshAt < FORCED_REFRESH_MIN_INTERVAL_MS) {
    const cached = await getCachedContacts(maxAgeMs);
    if (cached) return cached;
  }

  const deviceContacts = await getDeviceContactsFromDevice();
  const marked = await markRegisteredOnBackend(deviceContacts);
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
  } catch {}
}

/**
 * Save manually created contacts back to the device.
 * Called from AddContactForm / AddContactsPage.
 */
export async function saveContactToDevice(payload: {
  name: string;
  phone: string;      // normalized phone, e.g. +237612345678
  countryCode: string; // dial code, e.g. +237 (not strictly needed here)
}): Promise<void> {
  await ensureContactsPermission();

  const newContact = {
    givenName: payload.name,
    familyName: '',
    phoneNumbers: [
      {
        label: 'mobile',
        number: payload.phone, // what will actually appear in device contacts
      },
    ],
    emailAddresses: [],
  } as any;

  try {
    // Use the Promise-based API (no callback)
    await Contacts.addContact(newContact);
    console.log(
      `Contact saved to device: ${payload.name} (${payload.phone})`,
    );
  } catch (err) {
    console.warn(`Error adding contact to device: ${String(err)}`);
    throw err;
  }
}
