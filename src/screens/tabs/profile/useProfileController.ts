// src/screens/tabs/profile/useProfileController.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Asset, launchImageLibrary } from 'react-native-image-picker';

import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { CacheConfig } from '@/network/cacheKeys';
import { clearAuthTokens } from '@/security/authStorage';

import { DraftProfile, ItemType, PickedImage, PrefsDraft, ProfilePayload, SheetType } from './profile.types';
import { makeUUID, parseCsv } from './profile.utils';
import { profileLayout } from './profile.styles';
import { popularLanguages } from './profile.constants';
import { tierMetaFor } from './profile/tierMeta';
import type { FeedMediaType, FeedMediaOptions } from '../profile-screen/types';

const MICROS_PER_KISC = 100000;
const CENTS_PER_KISC = 10000;
const MICROS_PER_CENT = 10;
const PROFILE_CACHE_KEY = 'kis_profile_cache_v1';
const DEFAULT_PROFILE_LANGUAGE = 'English';
const POPULAR_PROFILE_LANGUAGE_MAP = new Map(
  popularLanguages.map((label) => [String(label).trim().toLowerCase(), String(label).trim()]),
);
const SHOWCASE_ITEM_TYPES = new Set<ItemType>([
  'portfolio',
  'case_study',
  'testimonial',
  'certification',
  'intro_video',
  'highlight',
]);
const KNOWN_DIAL_CODES = [
  '237',
  '1',
  '33',
  '44',
  '49',
  '234',
  '233',
  '254',
  '255',
  '256',
  '27',
  '91',
  '86',
].sort((a, b) => b.length - a.length);

const splitPhoneForDraft = (rawValue?: string | null) => {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { country_code: '', phone_number: '' };
  }

  if (!raw.startsWith('+')) {
    return { country_code: '', phone_number: raw };
  }

  const compact = raw.replace(/\s+/g, '');
  const digitsOnly = compact.replace(/[^\d]/g, '');
  if (digitsOnly.length > 1) {
    for (const dialCode of KNOWN_DIAL_CODES) {
      if (digitsOnly.startsWith(dialCode) && digitsOnly.length > dialCode.length) {
        return {
          country_code: `+${dialCode}`,
          phone_number: digitsOnly.slice(dialCode.length),
        };
      }
    }
  }

  const match = compact.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    return {
      country_code: match[1],
      phone_number: String(match[2] || '').trim(),
    };
  }

  return { country_code: '+', phone_number: compact.slice(1) };
};

const composePhoneForSave = (countryCodeValue: unknown, phoneNumberValue: unknown) => {
  const phoneNumberRaw = String(phoneNumberValue || '').trim();
  if (!phoneNumberRaw) return '';

  if (phoneNumberRaw.startsWith('+')) {
    return `+${phoneNumberRaw.replace(/[^\d]/g, '')}`;
  }

  const phoneDigits = phoneNumberRaw.replace(/[^\d]/g, '');
  if (!phoneDigits) return '';

  const countryCodeRaw = String(countryCodeValue || '').trim();
  if (!countryCodeRaw) return phoneDigits;

  const countryDigits = countryCodeRaw.replace(/[^\d]/g, '');
  if (!countryDigits) return phoneDigits;

  return `+${countryDigits}${phoneDigits}`;
};

const normalizeDialCode = (value: unknown) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
};

const normalizeLocalPhoneNumber = (value: unknown) => String(value || '').replace(/[^\d]/g, '');

const parseJsonLikeValue = (raw: string): unknown => {
  const text = String(raw || '').trim();
  if (!text) return null;
  const attempts = [
    text,
    text.replace(/'/g, '"'),
    text
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"'),
  ];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Keep trying fallbacks.
    }
  }
  return null;
};

const extractLanguageLabel = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const labels = Array.from(
      trimmed.matchAll(/label\s*[:=]\s*['"]?([^,'"\]}]+)['"]?/gi),
    )
      .map((match) => String(match?.[1] || '').trim())
      .filter(Boolean);
    if (labels.length) return labels[0];

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      const parsed = parseJsonLikeValue(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const next = extractLanguageLabel(item);
          if (next) return next;
        }
      } else if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        return extractLanguageLabel(
          record.label ?? record.name ?? record.language ?? record.language_name ?? record.value ?? '',
        );
      }
    }
    return trimmed;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return extractLanguageLabel(
      record.label ?? record.name ?? record.language ?? record.language_name ?? record.value ?? '',
    );
  }

  return '';
};

const normalizeLanguageList = (raw: unknown, ensureDefault = false) => {
  const queue = Array.isArray(raw) ? [...raw] : [raw];
  const out: string[] = [];
  const seen = new Set<string>();

  while (queue.length) {
    const value = queue.shift();
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      queue.unshift(...value);
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = parseJsonLikeValue(trimmed);
        if (Array.isArray(parsed)) {
          queue.unshift(...parsed);
          continue;
        }
      }
    }

    const label = extractLanguageLabel(value).trim();
    if (!label) continue;
    const canonical = POPULAR_PROFILE_LANGUAGE_MAP.get(label.toLowerCase());
    if (!canonical) continue;
    const dedupeKey = canonical.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(canonical);
  }

  if (ensureDefault && out.length === 0) {
    out.push(DEFAULT_PROFILE_LANGUAGE);
  }
  return out;
};

const splitPhoneFromUserPayload = (user: any) => {
  const fromRawPhone = splitPhoneForDraft(user?.phone);
  if (fromRawPhone.country_code && fromRawPhone.phone_number) {
    return fromRawPhone;
  }

  const countryCode = normalizeDialCode(user?.phone_country_code);
  const phoneNumber = normalizeLocalPhoneNumber(user?.phone_number);
  if (phoneNumber) {
    return { country_code: countryCode, phone_number: phoneNumber };
  }
  return fromRawPhone;
};

const normalizePhoneForCompare = (value?: string | null) => String(value || '').replace(/[^\d]/g, '');

type WalletRecipientVerificationState = {
  checking: boolean;
  verified: boolean;
  recipientId: string;
  recipientName: string;
  recipientPhoneDisplay: string;
  recipientPhoneDigits: string;
  error: string;
};

const EMPTY_WALLET_RECIPIENT_VERIFICATION: WalletRecipientVerificationState = {
  checking: false,
  verified: false,
  recipientId: '',
  recipientName: '',
  recipientPhoneDisplay: '',
  recipientPhoneDigits: '',
  error: '',
};

const extractRequestErrorMessage = (result: any, fallback: string) => {
  const direct = String(result?.message || result?.data?.detail || '').trim();
  if (direct) return direct;
  const payload = result?.data;
  if (payload && typeof payload === 'object') {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value) && value.length > 0) {
        const first = String(value[0] || '').trim();
        if (first) return first;
      }
      const text = String(value || '').trim();
      if (text) return text;
    }
  }
  return fallback;
};

export const useProfileController = (opts: {
  setAuth: (v: boolean) => void;
  setPhone?: (v: any) => void;
  locationCallingCode?: string | null;
}) => {
  const { setAuth, setPhone, locationCallingCode } = opts;

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLedger, setWalletLedger] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any>({
    ledger: [],
    transactions: [],
    subscription: null,
    usage: null,
  });
  const [broadcastProfiles, setBroadcastProfiles] = useState<Record<string, any> | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetType | null>(null);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [partnerActionId, setPartnerActionId] = useState<string | null>(null);
  const [kisWallet, setKisWallet] = useState<{
    balance_micro: number;
    balance_kisc: string;
    balance_usd: string;
  }>({
    balance_micro: 0,
    balance_kisc: '0.000',
    balance_usd: '0.00',
  });
  const [lastWalletPaymentUrl, setLastWalletPaymentUrl] = useState('');

  const [draftProfile, setDraftProfile] = useState<DraftProfile>({
    display_name: '',
    country_code: '',
    phone_number: '',
    languages: [],
    headline: '',
    bio: '',
    industry: '',
    avatar_url: '',
    cover_url: '',
  });

  const [draftItem, setDraftItem] = useState<any>(null);
  const [draftPrivacy, setDraftPrivacy] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [addingGalleryMedia, setAddingGalleryMedia] = useState(false);
  const [deletingWalletEntryId, setDeletingWalletEntryId] = useState<string | null>(null);
  const [deletingBillingTransactionId, setDeletingBillingTransactionId] = useState<string | null>(null);

  const [prefsDraft, setPrefsDraft] = useState<PrefsDraft>({
    services: [],
    availability: {},
    skill_badges: [],
    languages: [],
    location: {},
    compensation: {},
    social_proof: {},
    ask_tags: [],
    highlights: [],
  });

  const [walletForm, setWalletForm] = useState({
    mode: 'add_kisc',
    provider: 'flutterwave',
    amount: '',
    recipient: '',
    reference: '',
  });
  const [walletRecipientVerification, setWalletRecipientVerification] = useState<WalletRecipientVerificationState>(
    EMPTY_WALLET_RECIPIENT_VERIFICATION,
  );

  const slideX = useRef(new Animated.Value(profileLayout.SCREEN_WIDTH)).current;
  const sheetY = useRef(new Animated.Value(profileLayout.SCREEN_HEIGHT)).current;
  const loadingRef = useRef(false);
  const lastFetchRef = useRef(0);
  const profileRateLimitedUntilRef = useRef(0);
  const profileNetworkFreshUntilRef = useRef(0);

  const applyProfilePayload = useCallback((payload: ProfilePayload) => {
    const phoneDraft = splitPhoneFromUserPayload(payload?.user);
    const locationDialCode = normalizeDialCode(locationCallingCode);
    const languages = normalizeLanguageList(payload?.preferences?.languages, true);
    setProfile(payload);

    setDraftProfile({
      display_name: payload?.user?.display_name || '',
      country_code: locationDialCode || phoneDraft.country_code,
      phone_number: phoneDraft.phone_number,
      languages,
      headline: payload?.profile?.headline || '',
      bio: payload?.profile?.bio || '',
      industry: payload?.profile?.industry || '',
      avatar_url: payload?.profile?.avatar_url || '',
      cover_url: payload?.profile?.cover_url || '',
      avatar_file: null,
      cover_file: null,
      avatar_preview: payload?.profile?.avatar_url || '',
      cover_preview: payload?.profile?.cover_url || '',
    });

    const prefs = payload?.preferences || {};
    setPrefsDraft({
      services: prefs.services || [],
      availability: prefs.availability || {},
      skill_badges: prefs.skill_badges || [],
      languages,
      location: prefs.location || {},
      compensation: prefs.compensation || {},
      social_proof: prefs.social_proof || {},
      ask_tags: prefs.ask_tags || [],
      highlights: prefs.highlights || [],
    });

    const rules = payload?.privacy || [];
    const mapped: Record<string, any> = {};
    rules.forEach((rule: any) => (mapped[rule.field_key] = rule));
    setDraftPrivacy(mapped);
  }, [locationCallingCode]);

  useEffect(() => {
    const locationDialCode = normalizeDialCode(locationCallingCode);
    if (!locationDialCode) return;
    setDraftProfile((prev) =>
      prev.country_code === locationDialCode ? prev : { ...prev, country_code: locationDialCode },
    );
  }, [locationCallingCode]);

  useEffect(() => {
    const mode = String(walletForm.mode || '').trim().toLowerCase();
    if (mode === 'transfer') return;
    if (
      walletRecipientVerification.verified ||
      walletRecipientVerification.error ||
      walletRecipientVerification.checking
    ) {
      setWalletRecipientVerification(EMPTY_WALLET_RECIPIENT_VERIFICATION);
    }
  }, [walletForm.mode, walletRecipientVerification]);

  const openSheet = (type: SheetType) => {
    setActiveSheet(type);
    if (type === 'wallet') {
      setWalletRecipientVerification(EMPTY_WALLET_RECIPIENT_VERIFICATION);
    }
    Animated.timing(sheetY, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    if (type === 'upgrade') loadBillingHistory();
  };

  const closeSheet = () => {
    Animated.timing(sheetY, { toValue: profileLayout.SCREEN_HEIGHT, duration: 240, useNativeDriver: true }).start(() => {
      setActiveSheet(null);
      setDraftItem(null);
      setWalletRecipientVerification(EMPTY_WALLET_RECIPIENT_VERIFICATION);
    });
  };

  const openCreatePartner = () => {
    setShowCreatePartner(true);
    Animated.timing(slideX, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeCreatePartner = () => {
    Animated.timing(slideX, { toValue: profileLayout.SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
      setShowCreatePartner(false);
    });
  };

  const loadKisWallet = useCallback(async (fallbackWalletBalanceCents?: number) => {
    const res = await getRequest(ROUTES.wallet.me, {
      errorMessage: 'Unable to load KIS wallet.',
    });
    if (res?.success) {
      const wallet = res?.data?.wallet || {};
      const balanceCents = Number(wallet?.balance_cents ?? 0);
      const micro = Number.isFinite(balanceCents) ? Math.max(0, Math.floor(balanceCents * MICROS_PER_CENT)) : 0;
      const safeMicro = Number.isFinite(micro) ? Math.max(0, Math.floor(micro)) : 0;
      const kisc = Number(wallet?.balance_kisc);
      const usd = Number(wallet?.balance_usd);
      setKisWallet({
        balance_micro: safeMicro,
        balance_kisc: Number.isFinite(kisc) ? kisc.toFixed(3) : (safeMicro / MICROS_PER_KISC).toFixed(3),
        balance_usd: Number.isFinite(usd) ? usd.toFixed(2) : ((safeMicro / MICROS_PER_KISC) * 100).toFixed(2),
      });
      return;
    }

    const cents = Number(fallbackWalletBalanceCents ?? profile?.account?.wallet_balance_cents ?? 0);
    const safeCents = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
    const fallbackMicro = safeCents * MICROS_PER_CENT;
    setKisWallet({
      balance_micro: fallbackMicro,
      balance_kisc: (fallbackMicro / MICROS_PER_KISC).toFixed(3),
      balance_usd: (safeCents / 100).toFixed(2),
    });
  }, [profile?.account?.wallet_balance_cents]);

  const loadWalletLedger = useCallback(async () => {
    const res = await getRequest(ROUTES.wallet.ledger, {
      errorMessage: 'Unable to load KIS transactions.',
    });
    if (res?.success) {
      const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
      const mapped = rows.map((row: any) => ({
        id: String(row?.id || ''),
        kind: String(row?.kind || row?.transaction_type || 'entry'),
        transaction_type: Number(row?.amount_cents || 0) < 0 ? 'debit' : 'credit',
        amount_micro: Number(row?.amount_cents || 0) * MICROS_PER_CENT,
        reference: String(row?.reference || ''),
        counterparty_name: String(row?.counterparty_name || row?.meta?.counterparty?.name || ''),
        counterparty_phone: String(row?.counterparty_phone || row?.meta?.counterparty?.phone || ''),
        counterparty_user_id: String(row?.counterparty_user_id || row?.meta?.counterparty?.user_id || ''),
        created_at: String(row?.created_at || new Date().toISOString()),
        metadata: row?.meta || row?.metadata || {},
        receipt_url: String(
          row?.receipt_url || row?.meta?.receipt_url || row?.metadata?.receipt_url || '',
        ),
        receipt_pdf_url: String(row?.receipt_pdf_url || ''),
      }));
      setWalletLedger(mapped);
      return;
    }
    setWalletLedger([]);
  }, []);

  const loadBillingHistory = useCallback(async () => {
    const res = await getRequest(ROUTES.wallet.billingHistory);
    if (res?.success) {
      setBillingHistory({
        ledger: res.data?.ledger || [],
        transactions: res.data?.transactions || [],
        subscription: res.data?.subscription || null,
        usage: res.data?.usage || null,
        invoice_url: res.data?.invoice_url,
        invoice_pdf_url: res.data?.invoice_pdf_url,
      });
    }
  }, []);

  const loadBroadcastProfiles = useCallback(async () => {
    const res = await getRequest(ROUTES.broadcasts.createProfile);
    if (res?.success) {
      setBroadcastProfiles(res.data?.profiles ?? {});
    }
  }, []);

  const uploadProfileAttachment = useCallback(
    async (asset: Asset, context?: string) => {
      if (!asset?.uri) throw new Error('No asset supplied.');
      const form = new FormData();
      form.append('attachment', {
        uri: asset.uri,
        name: asset.fileName || `attachment-${Date.now()}`,
        type: asset.type || 'application/octet-stream',
      } as any);
      if (context) form.append('context', context);
      const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
      if (!res?.success) throw new Error(res?.message || 'Upload failed.');
      return res.data?.attachment ?? null;
    },
    [],
  );

  type BroadcastAttachmentPayload = { uri: string; name: string; type: string };

  const appendBroadcastAttachments = useCallback((form: FormData, files?: BroadcastAttachmentPayload[]) => {
    (files ?? []).forEach((file) => {
      if (file?.uri) {
        form.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      }
    });
  }, []);

  const manageProfileSection = useCallback(
    async (profileType: 'health_profile' | 'market_profile' | 'education_profile', updates: Record<string, any>) => {
      const res = await postRequest(ROUTES.broadcasts.profileManage, {
        profile_type: profileType,
        updates,
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to update profile.');
      await loadBroadcastProfiles();
      return res.data?.profile ?? null;
    },
    [loadBroadcastProfiles],
  );

  const addBroadcastFeedEntry = useCallback(
    async (
      title: string,
      summary: string,
      mediaType: FeedMediaType,
      attachments?: BroadcastAttachmentPayload[],
      mediaOptions?: FeedMediaOptions[FeedMediaType],
    ) => {
      const form = new FormData();
      form.append('title', title);
      form.append('summary', summary);
      form.append('media_type', mediaType);
      appendBroadcastAttachments(form, attachments);
      form.append('media_options', JSON.stringify(mediaOptions ?? {}));
      const res = await postRequest(ROUTES.broadcasts.feedProfile, form);
      if (res?.success) {
        void loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to add broadcast item.');
    },
    [appendBroadcastAttachments, loadBroadcastProfiles],
  );

  const updateBroadcastFeedEntry = useCallback(
    async (
      id: string,
      title: string,
      summary: string,
      mediaType: FeedMediaType,
      attachments?: BroadcastAttachmentPayload[],
      retainAttachments?: any[],
      mediaOptions?: FeedMediaOptions[FeedMediaType],
    ) => {
      const form = new FormData();
      form.append('title', title);
      form.append('summary', summary);
      form.append('media_type', mediaType);
      appendBroadcastAttachments(form, attachments);
      if (retainAttachments?.length) {
        form.append('retain_attachments', JSON.stringify(retainAttachments));
      }
      form.append('media_options', JSON.stringify(mediaOptions ?? {}));
      const res = await patchRequest(ROUTES.broadcasts.feedEntry(id), form);
      if (res?.success) {
        void loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to update broadcast item.');
    },
    [appendBroadcastAttachments, loadBroadcastProfiles],
  );

  const deleteBroadcastFeedEntry = useCallback(
    async (id: string) => {
      const res = await deleteRequest(ROUTES.broadcasts.feedEntry(id));
      if (res?.success) {
        await loadBroadcastProfiles();
        return true;
      }
      throw new Error(res?.message || 'Unable to delete broadcast item.');
    },
    [loadBroadcastProfiles],
  );

  const removeBroadcastFeedAttachment = useCallback(
    async (entryId: string, key: string) => {
      const endpoint = `${ROUTES.broadcasts.feedEntryAttachment(entryId)}?key=${encodeURIComponent(key)}`;
      const res = await deleteRequest(endpoint, {
        errorMessage: 'Unable to remove attachment.',
      });
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to remove attachment.');
    },
    [loadBroadcastProfiles],
  );

  const broadcastFeedEntry = useCallback(
    async (id: string) => {
      const res = await postRequest(ROUTES.broadcasts.feedEntryBroadcast(id), {});
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to broadcast feed item.');
    },
    [loadBroadcastProfiles],
  );

  const loadProfile = useCallback(async (forceNetwork = false) => {
    const now = Date.now();
    if (!forceNetwork) {
      if (loadingRef.current) return;
      if (now < profileRateLimitedUntilRef.current) return;
      if (now - lastFetchRef.current < 1200) return;
    }

    loadingRef.current = true;
    lastFetchRef.current = now;

    if (!profile) setLoading(true);
    let hasCachedPayload = false;

    try {
      if (!forceNetwork) {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const cachedPayload = JSON.parse(cached) as ProfilePayload;
          applyProfilePayload(cachedPayload);
          loadKisWallet(cachedPayload?.account?.wallet_balance_cents);
          loadWalletLedger();
          loadBroadcastProfiles();
          hasCachedPayload = true;
          setLoading(false);
        }
      }

      console.log('loading check - profile request start');
      const startTime = Date.now();
      const res = await getRequest(ROUTES.profiles.me, {
        cacheKey: CacheConfig.userProfile.key,
        cacheType: CacheConfig.userProfile.type,
        forceNetwork,
      });

      console.log('loading check - profile request finished in', Date.now() - startTime, 'ms');

      if (res.success) {
        const payload = res.data as ProfilePayload;
        applyProfilePayload(payload);
        profileNetworkFreshUntilRef.current = Date.now() + 60 * 1000;
        loadKisWallet(payload?.account?.wallet_balance_cents);
        loadWalletLedger();
        void loadBroadcastProfiles();
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
      } else {
        if (Number(res?.status) === 429) {
          profileRateLimitedUntilRef.current = Date.now() + 15000;
          return;
        }
        if (!hasCachedPayload) {
          setProfile(null);
          Alert.alert('Profile', res.message || 'Could not load profile');
        }
      }
    } catch (e: any) {
      if (!hasCachedPayload) {
        setProfile(null);
        Alert.alert('Profile', e?.message ?? 'Could not load profile');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [applyProfilePayload, loadKisWallet, loadWalletLedger, profile, loadBroadcastProfiles]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const logout = async () => {
    try {
      const server = await postRequest(ROUTES.auth.logout, {}, { errorMessage: 'Server logout failed.' });
      if (!server?.success) {
        // Continue with local session cleanup even if server logout fails.
      }
      await clearAuthTokens();
      await AsyncStorage.multiRemove(['user_phone', PROFILE_CACHE_KEY]);
      setPhone?.(null);
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  const runPartnerAction = useCallback(
    async (partnerId: string, action: 'deactivate' | 'reactivate' | 'delete') => {
      const endpoint =
        action === 'deactivate'
          ? ROUTES.partners.deactivate(partnerId)
          : action === 'reactivate'
          ? ROUTES.partners.reactivate(partnerId)
          : ROUTES.partners.remove(partnerId);
      setPartnerActionId(partnerId);
      try {
        const response = await postRequest(endpoint, {});
        if (!response.success) {
          throw new Error(response.message || 'Unable to perform action');
        }
        await loadProfile();
      } catch (error: any) {
        Alert.alert('Partner', error?.message || 'Unable to complete the action.');
      } finally {
        setPartnerActionId(null);
      }
    },
    [loadProfile],
  );

  const openEditProfile = () => {
    const phoneDraft = splitPhoneFromUserPayload(profile?.user);
    const locationDialCode = normalizeDialCode(locationCallingCode);
    const languages = normalizeLanguageList(profile?.preferences?.languages, true);
    setDraftProfile((prev) => ({
      ...prev,
      display_name: profile?.user?.display_name || '',
      country_code: locationDialCode || phoneDraft.country_code,
      phone_number: phoneDraft.phone_number,
      languages,
      headline: profile?.profile?.headline || '',
      bio: profile?.profile?.bio || '',
      industry: profile?.profile?.industry || '',
      avatar_url: profile?.profile?.avatar_url || '',
      cover_url: profile?.profile?.cover_url || '',
      avatar_file: null,
      cover_file: null,
      avatar_preview: profile?.profile?.avatar_url || '',
      cover_preview: profile?.profile?.cover_url || '',
    }));
    openSheet('editProfile');
  };

  const pickImage = async (kind: 'avatar' | 'cover') => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    const name = asset.fileName || `${kind}_${Date.now()}.${(asset.type || 'image/jpeg').split('/')[1] || 'jpg'}`;
    const file: PickedImage = { uri: asset.uri, name, type: asset.type || 'image/jpeg' };

    setDraftProfile((prev) => ({ ...prev, [`${kind}_file`]: file, [`${kind}_preview`]: asset.uri } as any));
  };

  const pickShowcaseFile = async (type: ItemType) => {
    const isVideo = type === 'intro_video';
    const result = await launchImageLibrary({ mediaType: isVideo ? 'video' : 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return null;

    const asset = result.assets?.[0];
    if (!asset?.uri) return null;

    const name =
      asset.fileName ||
      `${type}_${Date.now()}.${(asset.type || (isVideo ? 'video/mp4' : 'image/jpeg')).split('/')[1] || 'bin'}`;

    return { uri: asset.uri, name, type: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg') } as PickedImage;
  };

  const addGalleryMedia = async () => {
    setAddingGalleryMedia(true);
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 1,
        selectionLimit: 12,
      });
      if (result.didCancel || !result.assets?.length) return;

      const assets = result.assets.filter((asset) => asset?.uri) as Asset[];
      if (!assets.length) return;

      let failed = 0;
      for (const asset of assets) {
        const mime = String(asset.type || '').toLowerCase();
        const name = asset.fileName || `gallery_${Date.now()}.${(asset.type || 'image/jpeg').split('/')[1] || 'bin'}`;
        const normalizedMime = asset.type || (mime.startsWith('video/') ? 'video/mp4' : 'image/jpeg');
        const showcaseType = mime.startsWith('video/') ? 'intro_video' : 'portfolio';
        const title = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Gallery item';

        const form = new FormData();
        form.append('type', showcaseType);
        form.append('title', title);
        form.append('summary', '');
        form.append('file', {
          uri: asset.uri!,
          name,
          type: normalizedMime,
        } as any);

        const created = await postRequest(ROUTES.profileShowcases.list, form);
        if (!created?.success) failed += 1;
      }

      if (failed > 0) {
        Alert.alert('Gallery', `${failed} file(s) could not be added. Please retry those files.`);
      }
    } catch (error: any) {
      Alert.alert('Gallery', error?.message || 'Unable to add gallery media.');
    } finally {
      setAddingGalleryMedia(false);
      loadProfile();
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const userId = profile.user?.id;
      const profileId = profile?.profile?.id;
      const previousPhoneParts = splitPhoneFromUserPayload(profile?.user);
      const previousPhoneNumber = normalizeLocalPhoneNumber(previousPhoneParts.phone_number);

      const userPayload: Record<string, any> = {
        display_name: draftProfile.display_name?.trim(),
      };
      const normalizedCountryCode =
        normalizeDialCode(draftProfile.country_code) ||
        normalizeDialCode(locationCallingCode) ||
        normalizeDialCode(previousPhoneParts.country_code);
      const normalizedPhoneNumber = normalizeLocalPhoneNumber(draftProfile.phone_number);
      const phoneNumberChanged = normalizedPhoneNumber !== previousPhoneNumber;
      const composedPhone = phoneNumberChanged
        ? composePhoneForSave(normalizedCountryCode, normalizedPhoneNumber)
        : '';
      if (phoneNumberChanged && normalizedPhoneNumber) {
        userPayload.phone_country_code = normalizedCountryCode || null;
        userPayload.phone_number = normalizedPhoneNumber;
        userPayload.phone = composedPhone;
      }
      const phoneChanged = phoneNumberChanged && !!normalizedPhoneNumber;

      if (userId) {
        const userUpdateRes = await patchRequest(ROUTES.user.detail(userId), userPayload, {
          errorMessage: 'Unable to update account details.',
        });
        if (!userUpdateRes?.success) {
          throw new Error(extractRequestErrorMessage(userUpdateRes, 'Unable to update account details.'));
        }
      }

      const languagesPayload = normalizeLanguageList(draftProfile.languages, true);
      const languageSyncRes = await postRequest(ROUTES.profileLanguages.sync, { languages: languagesPayload }, {
        errorMessage: 'Unable to save profile languages.',
      });
      if (!languageSyncRes?.success) {
        throw new Error(extractRequestErrorMessage(languageSyncRes, 'Unable to save profile languages.'));
      }

      if (profileId) {
        const form = new FormData();
        form.append('headline', draftProfile.headline?.trim() || '');
        form.append('bio', draftProfile.bio?.trim() || '');
        form.append('industry', draftProfile.industry?.trim() || '');

        if (draftProfile.avatar_file?.uri) {
          form.append('avatar_file', {
            uri: draftProfile.avatar_file.uri,
            name: draftProfile.avatar_file.name,
            type: draftProfile.avatar_file.type,
          } as any);
        }
        if (draftProfile.cover_file?.uri) {
          form.append('cover_file', {
            uri: draftProfile.cover_file.uri,
            name: draftProfile.cover_file.name,
            type: draftProfile.cover_file.type,
          } as any);
        }
        const profileUpdateRes = await patchRequest(ROUTES.profiles.update(profileId), form, {
          errorMessage: 'Unable to update profile details.',
        });
        if (!profileUpdateRes?.success) {
          throw new Error(extractRequestErrorMessage(profileUpdateRes, 'Unable to update profile details.'));
        }
      }

      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      await loadProfile(true);
      closeSheet();

      if (phoneChanged) {
        Alert.alert(
          'Phone number updated',
          'Please log in again with your new phone number.',
          [{ text: 'Continue', onPress: () => logout() }],
        );
        return;
      }

      Alert.alert('Profile', 'Your profile changes were saved.');
    } catch (error: any) {
      Alert.alert('Profile', error?.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    try {
      for (const [key, rule] of Object.entries(draftPrivacy)) {
        const payload = { field_key: key, visibility: rule?.visibility || 'public', allow_user_ids: rule?.allow_user_ids || [] };
        if (rule?.id) await patchRequest(ROUTES.profilePrivacy.detail(rule.id), payload);
        else await postRequest(ROUTES.profilePrivacy.list, payload);
      }
    } finally {
      setSaving(false);
      closeSheet();
      loadProfile();
    }
  };

  const openItemEditor = (type: ItemType, item?: any) => {
    const draft = item ? { ...item } : {};
    if (type === 'skill' && !draft.skill_id) draft.skill_id = makeUUID();
    setDraftItem({ type, data: draft });
    openSheet('editItem');
  };

  const saveItem = async () => {
    if (!draftItem) return;
    setSaving(true);

    try {
      const type = draftItem.type as ItemType;
      const data = draftItem.data ?? {};
      const baseMap: Record<ItemType, string | null> = {
        experience: ROUTES.profileItems.experiences,
        education: ROUTES.profileItems.educations,
        project: ROUTES.profileItems.projects,
        skill: ROUTES.profileItems.skills,
        article: ROUTES.profileArticles.list,
        portfolio: ROUTES.profileShowcases.list,
        case_study: ROUTES.profileShowcases.list,
        testimonial: ROUTES.profileShowcases.list,
        certification: ROUTES.profileShowcases.list,
        intro_video: ROUTES.profileShowcases.list,
        highlight: ROUTES.profileShowcases.list,

        service: null,
        availability: null,
        language: null,
        location: null,
        compensation: null,
        ask_tag: null,
        social_proof: null,
        skill_badge: null,
      };

      const payload = { ...data };

      if (type === 'skill' && !payload.skill_id) payload.skill_id = makeUUID();
      if (type === 'project') payload.technologies = parseCsv(payload.technologies);
      if (type === 'article') payload.tags = parseCsv(payload.tags);

      const isPreference =
        type === 'service' ||
        type === 'availability' ||
        type === 'language' ||
        type === 'location' ||
        type === 'compensation' ||
        type === 'ask_tag' ||
        type === 'social_proof' ||
        type === 'skill_badge';

      if (isPreference) {
        const nextPrefs: PrefsDraft = { ...prefsDraft };

        if (type === 'service') nextPrefs.services = [...nextPrefs.services, payload];
        if (type === 'ask_tag') nextPrefs.ask_tags = [...nextPrefs.ask_tags, payload.label].filter(Boolean);
        if (type === 'availability') nextPrefs.availability = payload;
        if (type === 'location') nextPrefs.location = payload;
        if (type === 'compensation') nextPrefs.compensation = payload;
        if (type === 'social_proof') nextPrefs.social_proof = payload;
        if (type === 'skill_badge') nextPrefs.skill_badges = [...nextPrefs.skill_badges, payload];

        if (type === 'language') {
          const normalizedLanguage = normalizeLanguageList(
            [payload?.name ?? payload?.label ?? payload?.value ?? payload],
            false,
          )[0];
          if (!normalizedLanguage) {
            throw new Error('Language is required.');
          }
          const languageId = String(payload?.id || '').trim();
          if (languageId) {
            await patchRequest(ROUTES.profileLanguages.detail(languageId), { name: normalizedLanguage });
          } else {
            await postRequest(ROUTES.profileLanguages.list, { name: normalizedLanguage });
          }
          setPrefsDraft({
            ...nextPrefs,
            languages: normalizeLanguageList([...(nextPrefs.languages || []), normalizedLanguage], true),
          });
        } else {
          setPrefsDraft(nextPrefs);

          const prefId = profile?.preferences?.id;
          if (prefId) await patchRequest(ROUTES.profilePreferences.detail(prefId), nextPrefs);
          else await postRequest(ROUTES.profilePreferences.list, nextPrefs);
        }
      } else {
        const baseUrl = baseMap[type];
        if (!baseUrl) return;

        if (SHOWCASE_ITEM_TYPES.has(type)) {
          payload.type = type;
          const rawTitle = String(payload?.title || payload?.name || '').trim();
          const fallbackFromFile = String(payload?.file?.name || '')
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .trim();
          payload.title = rawTitle || fallbackFromFile || `${String(type).replace(/_/g, ' ')} item`;
          payload.summary = String(payload?.summary || payload?.description || '').trim();
          delete payload.name;
          delete payload.description;
        }

        if (payload.file?.uri) {
          const form = new FormData();
          Object.keys(payload).forEach((k) => {
            if (k === 'file' || k === 'id') return;
            form.append(k, payload[k] ?? '');
          });
          form.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as any);
          if (payload.id) await patchRequest(`${baseUrl}${payload.id}/`, form);
          else await postRequest(baseUrl, form);
        } else {
          if (payload.id) await patchRequest(`${baseUrl}${payload.id}/`, payload);
          else await postRequest(baseUrl, payload);
        }
      }
    } finally {
      setSaving(false);
      closeSheet();
      loadProfile();
    }
  };

  const deleteItem = async (type: ItemType, itemId: string) => {
    if (type === 'language') {
      await deleteRequest(ROUTES.profileLanguages.detail(itemId));
      loadProfile();
      return;
    }
    const baseMap: Record<ItemType, string | null> = {
      experience: ROUTES.profileItems.experiences,
      education: ROUTES.profileItems.educations,
      project: ROUTES.profileItems.projects,
      skill: ROUTES.profileItems.skills,
      article: ROUTES.profileArticles.list,
      portfolio: ROUTES.profileShowcases.list,
      case_study: ROUTES.profileShowcases.list,
      testimonial: ROUTES.profileShowcases.list,
      certification: ROUTES.profileShowcases.list,
      intro_video: ROUTES.profileShowcases.list,
      highlight: ROUTES.profileShowcases.list,
      service: null,
      availability: null,
      language: null,
      location: null,
      compensation: null,
      ask_tag: null,
      social_proof: null,
      skill_badge: null,
    };
    const baseUrl = baseMap[type];
    if (!baseUrl) return;
    await deleteRequest(`${baseUrl}${itemId}/`);
    loadProfile();
  };

  const upgradeTier = async (tierId: string) => {
    const tiers = profile?.tiers || [];
    const tier = tiers.find((t: any) => String(t?.id) === String(tierId));
    const tierName = String(tier?.name || tier?.code || tier?.slug || '').toLowerCase();
    const isPartnerTier = tierName.includes('partner');
    const priceCents = Number(tier?.price_cents || 0);
    const walletBalanceCents = Math.max(
      0,
      Number(
        profile?.account?.credits_value_cents ??
          profile?.account?.wallet_balance_cents ??
          0,
      ) || 0,
    );
    const currentTier = profile?.tier || profile?.subscription?.tier;
    const currentRank = tierMetaFor(currentTier || {}).tierRank ?? 0;
    const targetRank = tierMetaFor(tier || {}).tierRank ?? 0;

    if (targetRank < currentRank) {
      await downgradeTier(tierId);
      return;
    }
    if (targetRank === currentRank) {
      Alert.alert('Upgrade', 'You already have this tier; no change necessary.');
      return;
    }
    if (priceCents > walletBalanceCents) {
      const requiredKisc = (priceCents / CENTS_PER_KISC).toFixed(3);
      const availableKisc = (walletBalanceCents / CENTS_PER_KISC).toFixed(3);
      Alert.alert(
        'Insufficient KIS Coins',
        `This upgrade needs ${requiredKisc} KISC, but your wallet has ${availableKisc} KISC.`,
      );
      return;
    }

    setSaving(true);
    const res = await postRequest(ROUTES.wallet.upgrade, {
      tier: tierId,
      payment_method: 'credits',
    });
    setSaving(false);

    if (!res?.success) {
      Alert.alert('Upgrade', res?.message || 'Could not upgrade');
      return;
    }

    closeSheet();
    loadProfile();
    if (isPartnerTier) openCreatePartner();
  };

  const cancelSubscription = async (immediate = false) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionCancel, { immediate });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Subscription', res?.message || 'Unable to cancel subscription.');
      return;
    }
    loadBillingHistory();
    loadProfile();
  };

  const resumeSubscription = async () => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionResume, {});
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Subscription', res?.message || 'Unable to resume subscription.');
      return;
    }
    loadBillingHistory();
    loadProfile();
  };

  const downgradeTier = async (tierId: string) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionDowngrade, { tier: tierId });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Downgrade', res?.message || 'Unable to schedule downgrade.');
      return;
    }
    loadBillingHistory();
  };

  const retryTransaction = async (txRef: string) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.transactionRetry, { tx_ref: txRef });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Payment', res?.message || 'Unable to retry payment.');
      return;
    }
    const paymentUrl = res?.data?.payment_url;
    if (paymentUrl) {
      Linking.openURL(paymentUrl);
    }
  };

  const deleteWalletLedgerEntry = useCallback(async (entryId: string) => {
    const id = String(entryId || '').trim();
    if (!id) return;
    setDeletingWalletEntryId(id);
    try {
      const res = await deleteRequest(ROUTES.wallet.ledgerEntry(id), {
        errorMessage: 'Unable to delete transaction history.',
      });
      if (!res?.success) {
        Alert.alert('Wallet', res?.message || 'Unable to delete transaction history.');
        return;
      }
      setWalletLedger((prev) => prev.filter((entry) => String(entry?.id || '') !== id));
    } finally {
      setDeletingWalletEntryId((prev) => (prev === id ? null : prev));
    }
  }, []);

  const deleteBillingTransaction = useCallback(async (transactionId: string) => {
    const id = String(transactionId || '').trim();
    if (!id) return;
    setDeletingBillingTransactionId(id);
    try {
      const res = await deleteRequest(ROUTES.wallet.transaction(id), {
        errorMessage: 'Unable to delete billing transaction.',
      });
      if (!res?.success) {
        Alert.alert('Billing', res?.message || 'Unable to delete billing transaction.');
        return;
      }
      await loadBillingHistory();
    } finally {
      setDeletingBillingTransactionId((prev) => (prev === id ? null : prev));
    }
  }, [loadBillingHistory]);

  const setWalletRecipient = useCallback((value: string) => {
    setWalletForm((prev) => ({ ...prev, recipient: value }));
    const nextDigits = normalizePhoneForCompare(value);
    setWalletRecipientVerification((prev) => {
      if (nextDigits && prev.recipientPhoneDigits === nextDigits) return prev;
      return EMPTY_WALLET_RECIPIENT_VERIFICATION;
    });
  }, []);

  const verifyWalletRecipient = useCallback(async () => {
    const recipientPhone = String(walletForm.recipient || '').trim();
    const recipientDigits = normalizePhoneForCompare(recipientPhone);
    if (!recipientDigits) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        error: 'Enter recipient phone number first.',
      });
      return;
    }

    setWalletRecipientVerification({
      ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
      checking: true,
      recipientPhoneDigits: recipientDigits,
    });

    const countryHint = String(profile?.user?.country || 'CM').trim().toUpperCase();
    const lookupUrl = `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(
      recipientPhone,
    )}&country=${encodeURIComponent(countryHint)}`;
    const lookupRes = await getRequest(lookupUrl, {
      errorMessage: 'Unable to verify recipient phone number.',
      forceNetwork: true,
    });

    if (!lookupRes?.success) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        recipientPhoneDigits: recipientDigits,
        error: lookupRes?.message || 'Unable to verify recipient phone number.',
      });
      return;
    }

    if (!lookupRes?.data?.registered) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        recipientPhoneDigits: recipientDigits,
        error: 'No KIS account found for this number.',
      });
      return;
    }

    const rawRecipientId =
      lookupRes?.data?.userId ?? lookupRes?.data?.user_id ?? lookupRes?.data?.id ?? null;
    const recipientId = rawRecipientId != null ? String(rawRecipientId) : '';
    if (!recipientId) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        recipientPhoneDigits: recipientDigits,
        error: 'Unable to resolve recipient account.',
      });
      return;
    }

    const senderId = String(profile?.user?.id || '');
    if (senderId && recipientId === senderId) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        recipientPhoneDigits: recipientDigits,
        error: 'You cannot transfer to your own account.',
      });
      return;
    }

    const userRes = await getRequest(ROUTES.user.detail(recipientId), {
      errorMessage: 'Unable to fetch recipient profile.',
      forceNetwork: true,
    });
    if (!userRes?.success) {
      setWalletRecipientVerification({
        ...EMPTY_WALLET_RECIPIENT_VERIFICATION,
        recipientPhoneDigits: recipientDigits,
        error: userRes?.message || 'Unable to fetch recipient profile.',
      });
      return;
    }

    const userData = userRes?.data || {};
    const recipientName = String(
      userData?.display_name || userData?.username || userData?.phone || '',
    ).trim();
    const recipientPhoneDisplay = String(
      userData?.phone ||
        `${String(userData?.phone_country_code || '').trim()}${String(userData?.phone_number || '').trim()}` ||
        recipientPhone,
    ).trim();

    setWalletRecipientVerification({
      checking: false,
      verified: true,
      recipientId,
      recipientName: recipientName || 'KIS user',
      recipientPhoneDisplay: recipientPhoneDisplay || recipientPhone,
      recipientPhoneDigits: recipientDigits,
      error: '',
    });
  }, [walletForm.recipient, profile?.user?.country, profile?.user?.id]);

  const submitWalletAction = async () => {
    const amountKisc = Number(walletForm.amount || 0);
    const amountCents = Number.isFinite(amountKisc) ? Math.round(amountKisc * CENTS_PER_KISC) : 0;
    const mode = String(walletForm.mode || '').trim().toLowerCase();

    setSaving(true);
    setLastWalletPaymentUrl('');
    let res: any = null;

    if (!amountCents || amountCents < 1) {
      setSaving(false);
      Alert.alert('Wallet', 'Enter a valid KIS Coin amount.');
      return;
    }

    if (mode === 'add_kisc' || mode === 'deposit') {
      res = await postRequest(
        ROUTES.wallet.deposit,
        {
          amount_cents: amountCents,
          provider: String(walletForm.provider || 'flutterwave').trim().toLowerCase(),
        },
        {
          errorMessage: 'Unable to top up KIS wallet.',
        },
      );
    } else if (mode === 'spend_kisc' || mode === 'cash_to_credits') {
      res = await postRequest(
        ROUTES.wallet.convert,
        {
          direction: 'cash_to_credits',
          amount_cents: amountCents,
        },
        {
          errorMessage: 'Unable to convert KIS wallet balance.',
        },
      );
    } else if (mode === 'transfer') {
      const recipientPhone = String(walletForm.recipient || '').trim();
      const recipientDigits = normalizePhoneForCompare(recipientPhone);
      if (!recipientPhone) {
        setSaving(false);
        Alert.alert('Wallet', 'Recipient phone number is required.');
        return;
      }
      if (
        !walletRecipientVerification.verified ||
        !walletRecipientVerification.recipientId ||
        walletRecipientVerification.recipientPhoneDigits !== recipientDigits
      ) {
        setSaving(false);
        Alert.alert('Wallet', 'Verify the recipient first before sending KIS Coins.');
        return;
      }

      const countryHint = String(profile?.user?.country || 'CM').trim().toUpperCase();
      res = await postRequest(
        ROUTES.wallet.transfer,
        {
          recipient_id: walletRecipientVerification.recipientId,
          recipient_phone: recipientPhone,
          country: countryHint,
          amount_cents: amountCents,
        },
        {
          errorMessage: 'Unable to transfer KIS wallet balance.',
        },
      );
    } else {
      setSaving(false);
      Alert.alert('Wallet', 'Unsupported wallet action.');
      return;
    }

    setSaving(false);

    if (!res?.success) {
      const msg = res?.message || 'Action failed';
      Alert.alert('Wallet', msg);
      return;
    }

    const paymentUrl = res?.data?.payment_url;
    if (paymentUrl) {
      setLastWalletPaymentUrl(String(paymentUrl));
      Linking.openURL(String(paymentUrl)).catch(() => undefined);
    }

    closeSheet();
    loadKisWallet();
    loadWalletLedger();
    loadProfile();
  };

  const sectionList = useMemo(() => {
    const s = profile?.sections;
    return [
      { key: 'experience', title: 'Experience', items: s?.experiences || [] },
      { key: 'education', title: 'Education', items: s?.educations || [] },
      { key: 'project', title: 'Projects', items: s?.projects || [] },
      { key: 'skill', title: 'Skills', items: s?.skills || [] },
      { key: 'portfolio', title: 'Portfolio Gallery', items: s?.showcases?.portfolio || [] },
      { key: 'case_study', title: 'Case Studies', items: s?.showcases?.case_study || [] },
      { key: 'testimonial', title: 'Testimonials', items: s?.showcases?.testimonial || [] },
      { key: 'certification', title: 'Certifications', items: s?.showcases?.certification || [] },
      { key: 'intro_video', title: 'Intro Video', items: s?.showcases?.intro_video || [] },
      { key: 'highlight', title: 'Highlights', items: s?.showcases?.highlight || [] },
    ];
  }, [profile]);

  return {
    // state
    profile,
    loading,
    walletLedger,
    kisWallet,
    billingHistory,
    activeSheet,
    showCreatePartner,
    draftProfile,
    draftItem,
    draftPrivacy,
    saving,
    addingGalleryMedia,
    deletingWalletEntryId,
    deletingBillingTransactionId,
    prefsDraft,
    walletForm,
    walletRecipientVerification,
    lastWalletPaymentUrl,
    partnerActionId,
    broadcastProfiles,

    // setters
    setDraftProfile,
    setDraftItem,
    setDraftPrivacy,
    setWalletForm,
    setWalletRecipient,

    // anim refs
    slideX,
    sheetY,

    // actions
    loadProfile,
    logout,
    openSheet,
    closeSheet,
    openEditProfile,
    pickImage,
    pickShowcaseFile,
    addGalleryMedia,
    saveProfile,
    savePrivacy,
    openItemEditor,
    saveItem,
    deleteItem,
    upgradeTier,
    cancelSubscription,
    resumeSubscription,
    downgradeTier,
    retryTransaction,
    deleteWalletLedgerEntry,
    deleteBillingTransaction,
    refreshBroadcastProfiles: loadBroadcastProfiles,
    submitWalletAction,
    verifyWalletRecipient,
    openCreatePartner,
    closeCreatePartner,
    deactivatePartnerProfile: (id: string) => runPartnerAction(id, 'deactivate'),
    reactivatePartnerProfile: (id: string) => runPartnerAction(id, 'reactivate'),
    deletePartnerProfile: (id: string) => runPartnerAction(id, 'delete'),
    uploadProfileAttachment,
    manageProfileSection,
    addBroadcastFeedEntry,
    updateBroadcastFeedEntry,
    deleteBroadcastFeedEntry,
    removeBroadcastFeedAttachment,
    broadcastFeedEntry,

    // derived
    sectionList,
  };
};
