import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getLocales } from 'react-native-localize';

import { LANGUAGE_REGISTRY, type LanguageEntry } from './registry';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

export type LanguageCode = string;

type TranslationDictionary = Record<string, string>;

type LanguageContextValue = {
  language: LanguageCode;
  // Monotonically-increasing counter. Increments on every language change.
  // Use this as a React `key` on a content wrapper to force all children to
  // remount (and therefore re-translate) when the user switches language.
  languageVersion: number;
  setLanguage: (language: LanguageCode) => Promise<void>;
  ready: boolean;
  languages: Array<{ code: string; label: string; nativeName: string; flagEmoji: string }>;
};

const STORAGE_KEY = 'kis_language';
const PROP_NAMES_TO_TRANSLATE = new Set([
  'title',
  'placeholder',
  'label',
  'errorText',
  'accessibilityLabel',
  'accessibilityHint',
  'headerTitle',
  'summary',
  'subtitle',
  'message',
  'description',
  'hint',
  'helperText',
  'emptyText',
  'noDataText',
  'buttonText',
  'sectionTitle',
  'footerLabel',
  'headerLabel',
  'confirmText',
  'cancelText',
]);

const resources: Record<string, TranslationDictionary> = {};
const LANGUAGE_OPTIONS: Array<{ code: string; label: string; nativeName: string; flagEmoji: string }> = [];
const VALID_CODES = new Set<string>();

for (const entry of LANGUAGE_REGISTRY) {
  resources[entry.code] = entry.translations;
  LANGUAGE_OPTIONS.push({ code: entry.code, label: entry.label, nativeName: entry.nativeName, flagEmoji: entry.flagEmoji });
  VALID_CODES.add(entry.code);
}

const listeners = new Set<() => void>();
let activeLanguage: LanguageCode = 'en';

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  languageVersion: 0,
  setLanguage: async () => undefined,
  ready: false,
  languages: LANGUAGE_OPTIONS,
});

// ── Translation result cache ─────────────────────────────────────────────────
// Caches translateString(value, undefined, lang) results per language.
// Cleared on every language change so stale translations never persist.
// Bounded to 5000 entries to prevent memory growth in large apps.
const TRANSLATE_CACHE_MAX = 5000;
const translateCacheByLang = new Map<LanguageCode, Map<string, string>>();

const getTranslateCache = (lang: LanguageCode): Map<string, string> => {
  let c = translateCacheByLang.get(lang);
  if (!c) { c = new Map(); translateCacheByLang.set(lang, c); }
  return c;
};

// ── isProbablyTranslatable — cheap checks first ──────────────────────────────
// Order: fastest rejections first to skip regex on the majority of values.
const isProbablyTranslatable = (value: string): boolean => {
  const len = value.length;
  if (len < 2 || len > 400) return false;
  // Must contain at least one ASCII letter (cheap charCode check)
  let hasLetter = false;
  for (let i = 0; i < len; i++) {
    const c = value.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { hasLetter = true; break; }
  }
  if (!hasLetter) return false;
  // Reject obvious non-text patterns (URLs, paths, ALL_CAPS identifiers)
  const ch0 = value[0];
  if (ch0 === '/' || ch0 === '.' || ch0 === '@' || ch0 === '#') return false;
  if (value.startsWith('http')) return false;
  // ALL_CAPS_IDENTIFIER with no spaces → likely a constant, not UI text
  if (!/\s/.test(value) && value === value.toUpperCase() && /^[A-Z0-9_]+$/.test(value)) return false;
  // File-path-like (contains slash between word chars, no spaces)
  if (!/\s/.test(value) && /^[A-Za-z0-9_.-]+\//.test(value)) return false;
  return true;
};

const notifyListeners = () => {
  // Clear translation cache so the new language is used immediately.
  translateCacheByLang.clear();
  listeners.forEach((listener) => listener());
};

const normalizeLanguageCode = (value?: string | null): LanguageCode => {
  const normalized = String(value || '').trim().toLowerCase();
  const exact = Array.from(VALID_CODES).find((code) => normalized === code);
  if (exact) return exact;
  const prefix = Array.from(VALID_CODES).find((code) => normalized.startsWith(code));
  if (prefix) return prefix;
  return 'en';
};

const interpolate = (value: string, params?: Record<string, string | number>) => {
  if (!params) return value;
  return Object.entries(params).reduce((acc, [key, replacement]) => {
    const matcher = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    return acc.replace(matcher, String(replacement));
  }, value);
};

export const subscribeToLanguageChange = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getActiveLanguage = () => activeLanguage;

export const translateString = (
  value: string,
  params?: Record<string, string | number>,
  language: LanguageCode = activeLanguage,
): string => {
  if (!isProbablyTranslatable(value)) return value;
  // params-free path uses the per-language result cache.
  if (!params) {
    const cache = getTranslateCache(language);
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
    const fallback = resources.en?.[value] ?? value;
    const result = resources[language]?.[value] ?? fallback;
    if (cache.size < TRANSLATE_CACHE_MAX) cache.set(value, result);
    return result;
  }
  const fallback = resources.en?.[value] ?? value;
  const translated = resources[language]?.[value] ?? fallback;
  return interpolate(translated, params);
};

export const localizeNode = (value: any): any => {
  if (typeof value === 'string') return translateString(value);
  if (Array.isArray(value)) return value.map(localizeNode);
  return value;
};

export const localizeProps = <T extends Record<string, any> | null | undefined>(props: T): T => {
  if (!props || props.disableLocalization) return props;
  // Fast-path: if none of the props keys are in the translatable set, return as-is
  // without allocating a new object. This is the common case for most components.
  const keys = Object.keys(props);
  let hasTranslatableKey = false;
  for (let i = 0; i < keys.length; i++) {
    if (PROP_NAMES_TO_TRANSLATE.has(keys[i])) { hasTranslatableKey = true; break; }
  }
  if (!hasTranslatableKey) return props;
  let changed = false;
  const nextProps: Record<string, any> = { ...props };
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!PROP_NAMES_TO_TRANSLATE.has(key)) continue;
    if (typeof nextProps[key] !== 'string') continue;
    const translated = translateString(nextProps[key]);
    if (translated !== nextProps[key]) {
      nextProps[key] = translated;
      changed = true;
    }
  }
  return (changed ? nextProps : props) as T;
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(activeLanguage);
  const [languageVersion, setLanguageVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const fallback = getLocales?.()?.[0]?.languageCode ?? 'en';
        let nextLanguage = normalizeLanguageCode(stored || fallback);

        // Try to sync language preference from backend (cross-device support).
        // If the backend returns a language, it takes precedence over local cache.
        try {
          const { getRequest } = require('@/network/get');
          const ROUTES = require('@/network').default;
          const res = await getRequest(ROUTES.profilePreferences.me, { errorMessage: '' });
          const serverLang = res?.data?.language_preference ?? res?.language_preference;
          if (serverLang && typeof serverLang === 'string' && serverLang.trim()) {
            const normalized = normalizeLanguageCode(serverLang);
            if (normalized !== 'en' || !stored) {
              nextLanguage = normalized;
              await AsyncStorage.setItem(STORAGE_KEY, nextLanguage).catch(() => {});
            }
          }
        } catch { /* network unavailable or not authenticated yet — use local cache */ }

        activeLanguage = nextLanguage;
        if (mounted) setLanguageState(nextLanguage);
      } finally {
        if (mounted) setReady(true);
        notifyListeners();
      }
    };

    bootstrap().catch(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (nextLanguage: LanguageCode) => {
    activeLanguage = nextLanguage;
    setLanguageState(nextLanguage);
    setLanguageVersion((v) => v + 1);
    notifyListeners();
    await Promise.allSettled([
      AsyncStorage.setItem(STORAGE_KEY, nextLanguage),
      patchRequest(ROUTES.profilePreferences.me, { language_preference: nextLanguage }),
    ]);
  };

  const value = useMemo(
    () => ({
      language,
      languageVersion,
      setLanguage,
      ready,
      languages: LANGUAGE_OPTIONS,
    }),
    [language, languageVersion, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Wrap any content subtree with this to make it remount (and therefore
 * re-translate) when the user switches language. Prefer to place this at the
 * root of a screen or tab so the remount is scoped — rather than keying the
 * NavigationContainer which would also reset navigation state.
 *
 * Usage:
 *   <LanguageResetBoundary>
 *     <MyScreenContent />
 *   </LanguageResetBoundary>
 */
export function LanguageResetBoundary({ children, style }: { children: React.ReactNode; style?: any }) {
  const { languageVersion } = useLanguage();
  // The key on this View changes on every language switch, causing React to
  // unmount + remount all children. Fresh renders go through the patched
  // jsx-runtime and pick up the new language translations.
  return (
    <React.Fragment>
      {React.createElement(
        require('react-native').View,
        { key: languageVersion, style: style ?? { flex: 1 } },
        children,
      )}
    </React.Fragment>
  );
}

export const useLanguage = () => useContext(LanguageContext);
export const useTranslation = () => {
  const { language } = useLanguage();

  return useMemo(
    () => ({
      language,
      t: (value: string, params?: Record<string, string | number>) =>
        translateString(value, params, language),
    }),
    [language],
  );
};

export type { LanguageEntry };
