/**
 * Language Registry — single source of truth for all supported languages.
 *
 * TO ADD A NEW LANGUAGE:
 *   1. Translate en.json → xx.json  (run `npm run i18n:generate` first to get a fresh en.json)
 *   2. Place xx.json in this folder (src/languages/)
 *   3. Add two lines below: an import and an entry in LANGUAGE_REGISTRY
 *   4. That's it — the app auto-detects the new language everywhere.
 */

import en from './en.json';
import es from './es.json';
// ── Add new language imports here ──────────────────────────────────────────
// import fr from './fr.json';

export type LanguageEntry = {
  code: string;
  label: string;
  nativeName: string;
  flagEmoji: string;
  translations: Record<string, string>;
};

export const LANGUAGE_REGISTRY: LanguageEntry[] = [
  { code: 'en', label: 'English',  nativeName: 'English', flagEmoji: '🇬🇧', translations: en as Record<string, string> },
  { code: 'es', label: 'Spanish',  nativeName: 'Español', flagEmoji: '🇪🇸', translations: es as Record<string, string> },
  // ── Add new language entries here ────────────────────────────────────────
  // { code: 'fr', label: 'French', nativeName: 'Français', flagEmoji: '🇫🇷', translations: fr as Record<string, string> },
];
