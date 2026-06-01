import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getLocales } from 'react-native-localize';

import { LANGUAGE_REGISTRY, type LanguageEntry } from './registry';

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

const hasLetters = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

const isProbablyTranslatable = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!hasLetters(trimmed)) return false;
  if (/^(https?:\/\/|\.\/|\.\.\/|@\/|#|[A-Za-z]:\\)/.test(trimmed)) return false;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+$/.test(trimmed)) return false;
  if (/^[A-Z0-9_]+$/.test(trimmed) && !trimmed.includes(' ')) return false;
  return true;
};

const notifyListeners = () => {
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
) => {
  if (!isProbablyTranslatable(value)) return value;
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
  let changed = false;
  const nextProps: Record<string, any> = { ...props };
  Object.keys(nextProps).forEach((key) => {
    if (!PROP_NAMES_TO_TRANSLATE.has(key)) return;
    if (typeof nextProps[key] !== 'string') return;
    const translated = translateString(nextProps[key]);
    if (translated !== nextProps[key]) {
      nextProps[key] = translated;
      changed = true;
    }
  });
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
        const nextLanguage = normalizeLanguageCode(stored || fallback);
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
    await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
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
