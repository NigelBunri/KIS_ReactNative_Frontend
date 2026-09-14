// src/services/translation/translationLanguages.ts
//
// Static display-name lookup for the language codes on-device translation
// can plausibly support (union of Android ML Kit Translate's ~59 languages
// and Apple's Translation framework's supported set). This list is ONLY for
// UI labels (e.g. "Download French" instead of "Download fr") - actual
// availability on a given device is always confirmed live via
// TranslationService.getModelStatus()/isSupported(), never assumed from
// this list. Codes are plain ISO 639-1, matching the app's existing
// LanguageCode type (see src/languages/index.tsx) so a message's detected
// language and the app's UI language can be compared directly.

export type TranslationLanguage = {
  code: string;
  label: string;
};

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'af', label: 'Afrikaans' },
  { code: 'sq', label: 'Albanian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'be', label: 'Belarusian' },
  { code: 'bn', label: 'Bengali' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hr', label: 'Croatian' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'eo', label: 'Esperanto' },
  { code: 'et', label: 'Estonian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'gl', label: 'Galician' },
  { code: 'ka', label: 'Georgian' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ht', label: 'Haitian Creole' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'is', label: 'Icelandic' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ga', label: 'Irish' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ko', label: 'Korean' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ms', label: 'Malay' },
  { code: 'mt', label: 'Maltese' },
  { code: 'mr', label: 'Marathi' },
  { code: 'no', label: 'Norwegian' },
  { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'es', label: 'Spanish' },
  { code: 'sw', label: 'Swahili' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'cy', label: 'Welsh' },
];

const LANGUAGE_LABEL_BY_CODE: Record<string, string> = TRANSLATION_LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.code] = lang.label;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Best-effort display label for an ISO 639-1 code. Falls back to the
 * upper-cased code itself (e.g. "XX") for anything not in the static list
 * above, rather than throwing - a device can report a language code this
 * list doesn't happen to name without that being an error condition.
 */
export function getLanguageLabel(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return LANGUAGE_LABEL_BY_CODE[normalized] ?? normalized.toUpperCase();
}

/**
 * Normalizes a BCP-47-ish tag (e.g. "en-US", "zh-Hans", "PT_br") down to the
 * bare ISO 639-1 primary subtag ("en", "zh", "pt") the native translation
 * modules and this app's own LanguageCode type both key on.
 */
export function normalizeLanguageCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).trim().toLowerCase().split(/[-_]/)[0];
}
