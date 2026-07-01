/**
 * Language Registry — single source of truth for all supported languages.
 *
 * English is the only language bundled into the app; its dictionary is
 * imported directly below. Every other language is metadata-only here — its
 * translation JSON lives on the backend (`apps/localization/locales/xx.json`)
 * and is downloaded to the device the first time a user selects it (see
 * `remoteLanguageCache.ts` / `ensureLanguageResources` in `index.tsx`).
 *
 * TO ADD A NEW LANGUAGE:
 *   1. Translate en.json → xx.json  (run `npm run i18n:generate` first to get a fresh en.json)
 *   2. Place xx.json at backend/kis/apps/localization/locales/xx.json and add
 *      its code to `KNOWN_LANGUAGE_CODES` in backend/kis/apps/localization/views.py
 *   3. Add one metadata-only entry below (no `translations` field)
 *   4. That's it — the app fetches and caches the file on first selection.
 */

import en from './en.json';

export type LanguageEntry = {
  code: string;
  label: string;
  nativeName: string;
  flagEmoji: string;
  // Only present for languages bundled directly into the app (English).
  // Omitted entries are fetched from the backend on first selection.
  translations?: Record<string, string>;
};

export const LANGUAGE_REGISTRY: LanguageEntry[] = [
  { code: 'en', label: 'English',  nativeName: 'English', flagEmoji: '🇬🇧', translations: en as Record<string, string> },
  { code: 'es', label: 'Spanish',  nativeName: 'Español', flagEmoji: '🇪🇸' },
  // ── Add new language entries here ────────────────────────────────────────
  // { code: 'fr', label: 'French', nativeName: 'Français', flagEmoji: '🇫🇷' },
];
