// src/services/translation/translationCache.ts
//
// Local-only cache of on-device translation results, keyed by
// (message id, target language). This never touches the network - it
// exists purely so re-opening a chat or re-toggling "Translated"/
// "Original" on the same message doesn't re-run on-device translation
// unnecessarily (CPU/battery), not as a sync mechanism. Nothing here is
// ever uploaded: see TranslationService.ts's header for the full
// no-network invariant this feature depends on.
//
// Uses EncryptedStorage (Keychain on iOS, EncryptedSharedPreferences on
// Android) for at-rest protection consistent with
// Storage/decryptedMessageStorage.ts, which this mirrors closely. Learned
// from that file's own bug history: a Keychain write has a real, lower-
// than-documented size ceiling on iOS, and a failed write must never be
// allowed to propagate as an exception into a caller that would mistake
// "couldn't cache" for "couldn't translate" - every write here is
// best-effort and swallows its own errors.
import EncryptedStorage from 'react-native-encrypted-storage';

const PREFIX = 'KIS_MESSAGE_TRANSLATION_V1';

// Skip caching anything implausibly large for a chat message - keeps this
// cache far under any platform's secure-storage ceiling regardless of how
// long a single message's text or its translation turns out to be. The
// translation itself still succeeds and displays; only the local cache
// write is skipped.
const MAX_CACHEABLE_LENGTH = 8_000;

const safeSegment = (value: string) => encodeURIComponent(value.trim());

const cacheKey = (messageId: string, targetLanguageCode: string) =>
  `${PREFIX}:${safeSegment(messageId)}:${safeSegment(targetLanguageCode)}`;

export type CachedTranslation = {
  translatedText: string;
  sourceLanguageCode: string;
};

export async function getCachedTranslation(
  messageId: string,
  targetLanguageCode: string,
): Promise<CachedTranslation | null> {
  if (!messageId || !targetLanguageCode) return null;
  try {
    const raw = await EncryptedStorage.getItem(cacheKey(messageId, targetLanguageCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.translatedText !== 'string') return null;
    return {
      translatedText: parsed.translatedText,
      sourceLanguageCode: typeof parsed.sourceLanguageCode === 'string' ? parsed.sourceLanguageCode : '',
    };
  } catch {
    return null;
  }
}

export async function setCachedTranslation(
  messageId: string,
  targetLanguageCode: string,
  value: CachedTranslation,
): Promise<void> {
  if (!messageId || !targetLanguageCode || !value?.translatedText) return;
  if (value.translatedText.length > MAX_CACHEABLE_LENGTH) return;
  try {
    await EncryptedStorage.setItem(cacheKey(messageId, targetLanguageCode), JSON.stringify(value));
  } catch {
    // Best-effort cache - the caller already has the translated text in
    // memory regardless of whether this persists. See file header.
  }
}

export async function clearCachedTranslation(messageId: string, targetLanguageCode: string): Promise<void> {
  if (!messageId || !targetLanguageCode) return;
  try {
    await EncryptedStorage.removeItem(cacheKey(messageId, targetLanguageCode));
  } catch {
    // Best-effort.
  }
}
