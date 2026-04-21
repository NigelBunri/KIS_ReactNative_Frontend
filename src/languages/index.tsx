import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import RNLocalize from 'react-native-localize';

import en from './en.json';
import es from './es.json';

export type LanguageCode = 'en' | 'es';

type TranslationDictionary = Record<string, string>;
type TranslationResources = Record<LanguageCode, TranslationDictionary>;

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => Promise<void>;
  ready: boolean;
  languages: Array<{ code: LanguageCode; label: string }>;
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

const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const resources: TranslationResources = {
  en,
  es,
};

const listeners = new Set<() => void>();
let activeLanguage: LanguageCode = 'en';

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
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
  if (normalized.startsWith('es')) return 'es';
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
  const fallback = resources.en[value] ?? value;
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const fallback = RNLocalize.getLocales?.()?.[0]?.languageCode ?? 'en';
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
    notifyListeners();
    await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      ready,
      languages: LANGUAGE_OPTIONS,
    }),
    [language, ready],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
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
