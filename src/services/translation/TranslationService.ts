// src/services/translation/TranslationService.ts
//
// Platform-agnostic abstraction over on-device message translation.
//
// SECURITY: this module and everything it calls MUST stay 100% offline.
// It talks only to the native `KISTranslationModule` (Android: Google ML
// Kit's on-device Translate + Language ID; iOS: Apple's Translation
// framework + NaturalLanguage), which perform detection/translation
// entirely on-device using models downloaded once and cached locally by
// the OS. Nothing in this file (or translationCache.ts) may import
// `@/network/get`, `@/network/post`, `fetch`, or any other network
// primitive - a decrypted chat message's text must never leave the device
// for translation. Do not "helpfully" add a cloud fallback here; that was
// exactly the bug this module replaces (see MessageBubble.tsx's git
// history - the previous "Translate" feature POSTed decrypted plaintext to
// Django's /api/v1/translate/, which forwarded it to Google's cloud
// Translation API on every incoming message for any non-English user).
import { NativeModules, Platform } from 'react-native';
import { normalizeLanguageCode } from './translationLanguages';

// Model management is keyed by (source, target) PAIR, not a single language
// in isolation - this matches Apple's Translation framework exactly
// (LanguageAvailability.status(from:to:) is pair-based) and is implemented
// on Android by checking/downloading both languages' independent ML Kit
// models together under one call. A single shared contract this way means
// neither platform has to fake a shape the other doesn't really have.
type NativeTranslationModule = {
  isAvailable(): Promise<boolean>;
  identifyLanguage(text: string): Promise<{ languageCode: string; confidence: number } | null>;
  getModelStatus(sourceLanguageCode: string, targetLanguageCode: string): Promise<string>;
  downloadModel(sourceLanguageCode: string, targetLanguageCode: string): Promise<boolean>;
  deleteModel(sourceLanguageCode: string, targetLanguageCode: string): Promise<boolean>;
  getDownloadedModels(): Promise<string[]>;
  translate(text: string, sourceLanguageCode: string, targetLanguageCode: string): Promise<string>;
};

// Looked up fresh on every call rather than destructured once at module
// load - a module-load-time destructure would capture whatever
// NativeModules.KISTranslationModule happened to be at that exact moment
// (fine in the real app, since autolinking registers native modules before
// any JS runs, but it silently breaks every test that mocks
// NativeModules.KISTranslationModule after this file has already been
// imported once in the same process/module registry).
const getNativeModule = (): NativeTranslationModule | undefined =>
  (NativeModules as any).KISTranslationModule;

export type TranslationModelStatus =
  | 'downloaded'
  | 'not_downloaded'
  | 'unsupported'
  | 'unknown';

export type DetectedLanguage = {
  languageCode: string;
  confidence: number;
};

export type TranslationResult = {
  translatedText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
};

const readyModule = (): NativeTranslationModule | null =>
  Platform.OS === 'web' ? null : getNativeModule() ?? null;

/**
 * Whether on-device translation is available on this install at all - false
 * on an unsupported OS version (e.g. iOS below 18) or if the native module
 * failed to link for any reason. Callers should hide/disable the Translate
 * action entirely when this resolves false rather than letting a translate
 * attempt fail confusingly.
 */
async function isSupported(): Promise<boolean> {
  const native = readyModule();
  if (!native) return false;
  try {
    return await native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * On-device language detection for already-decrypted message text. Returns
 * null (never throws) if detection isn't possible - callers fall back to
 * asking the user or skipping the source-language label.
 */
async function detectLanguage(text: string): Promise<DetectedLanguage | null> {
  const trimmed = text.trim();
  const native = readyModule();
  if (!trimmed || !native) return null;
  try {
    const result = await native.identifyLanguage(trimmed);
    if (!result?.languageCode) return null;
    const code = normalizeLanguageCode(result.languageCode);
    if (!code || code === 'und') return null;
    return { languageCode: code, confidence: result.confidence ?? 0 };
  } catch {
    return null;
  }
}

/**
 * Status of the on-device model(s) needed to translate from `sourceLanguageCode`
 * to `targetLanguageCode`. 'unsupported' means this OS/device can never
 * translate that pair (distinct from 'not_downloaded', which just means the
 * user hasn't fetched the needed model(s) yet).
 */
async function getModelStatus(
  sourceLanguageCode: string,
  targetLanguageCode: string,
): Promise<TranslationModelStatus> {
  const source = normalizeLanguageCode(sourceLanguageCode);
  const target = normalizeLanguageCode(targetLanguageCode);
  const native = readyModule();
  if (!source || !target || !native) return 'unknown';
  try {
    const status = await native.getModelStatus(source, target);
    if (status === 'downloaded' || status === 'not_downloaded' || status === 'unsupported') {
      return status;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Triggers an on-device model download for a language pair. Resolves once
 * translation between the two is ready to use; rejects with a plain Error
 * on failure. No network call happens from this JS/RN layer either way -
 * the OS's own translation service fetches the model over whatever
 * connectivity policy it enforces (both platforms default to Wi-Fi-only).
 */
async function downloadModel(sourceLanguageCode: string, targetLanguageCode: string): Promise<void> {
  const source = normalizeLanguageCode(sourceLanguageCode);
  const target = normalizeLanguageCode(targetLanguageCode);
  if (!source || !target) throw new Error('Source and target languages are required to download a model.');
  const native = readyModule();
  if (!native) throw new Error('On-device translation is not available on this device.');
  const ok = await native.downloadModel(source, target);
  if (!ok) throw new Error('Failed to download the language model.');
}

/**
 * Frees on-device storage by removing a previously downloaded model, where
 * the platform allows it. Android (ML Kit) supports this directly. iOS does
 * NOT expose a programmatic delete for Apple's Translation framework -
 * downloaded languages are only removable by the user via
 * Settings > General > Translation Languages - so this is a documented
 * no-op there rather than a fake success.
 */
async function deleteModel(sourceLanguageCode: string, targetLanguageCode: string): Promise<void> {
  const source = normalizeLanguageCode(sourceLanguageCode);
  const target = normalizeLanguageCode(targetLanguageCode);
  const native = readyModule();
  if (!source || !target || !native) return;
  try {
    await native.deleteModel(source, target);
  } catch {
    // Best-effort - a failed delete just leaves the model taking up space.
  }
}

/**
 * Language codes with a model currently downloaded on this device.
 * Android (ML Kit) reports this accurately. iOS has no public API to
 * enumerate installed Translation languages, so it always resolves an
 * empty array - callers should treat this as "unknown", not "nothing
 * downloaded", on iOS specifically, and avoid building UI that depends on
 * it being accurate there (e.g. no "manage downloaded languages" screen).
 */
async function getDownloadedModels(): Promise<string[]> {
  const native = readyModule();
  if (!native) return [];
  try {
    const models = await native.getDownloadedModels();
    return Array.isArray(models) ? models.map(normalizeLanguageCode).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Translates already-decrypted text entirely on-device. If
 * `sourceLanguageCode` is omitted, it's detected first via detectLanguage().
 * Throws a plain Error (never a native exception object) when translation
 * can't proceed - callers are expected to catch this and show a normal
 * "couldn't translate" state rather than crash.
 */
async function translate(params: {
  text: string;
  targetLanguageCode: string;
  sourceLanguageCode?: string | null;
}): Promise<TranslationResult> {
  const text = params.text?.trim() ?? '';
  const targetLanguageCode = normalizeLanguageCode(params.targetLanguageCode);
  if (!text) throw new Error('There is no text to translate.');
  if (!targetLanguageCode) throw new Error('A target language is required.');
  const native = readyModule();
  if (!native) throw new Error('On-device translation is not available on this device.');

  let sourceLanguageCode = normalizeLanguageCode(params.sourceLanguageCode);
  if (!sourceLanguageCode) {
    const detected = await detectLanguage(text);
    if (!detected) throw new Error("Couldn't detect the message's language.");
    sourceLanguageCode = detected.languageCode;
  }

  if (sourceLanguageCode === targetLanguageCode) {
    return { translatedText: text, sourceLanguageCode, targetLanguageCode };
  }

  const translatedText = await native.translate(text, sourceLanguageCode, targetLanguageCode);
  if (typeof translatedText !== 'string' || !translatedText.trim()) {
    throw new Error('Translation returned no text.');
  }
  return { translatedText, sourceLanguageCode, targetLanguageCode };
}

export const TranslationService = {
  isSupported,
  detectLanguage,
  getModelStatus,
  downloadModel,
  deleteModel,
  getDownloadedModels,
  translate,
};

export default TranslationService;
