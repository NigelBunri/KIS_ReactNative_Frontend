// src/Module/ChatRoom/hooks/useMessageTranslation.ts
//
// Per-message on-device translation state machine, used by
// InteractiveMessageRow's "Translate" action and MessageBubble's inline
// translated-text block. Deliberately manual/on-demand only - nothing here
// runs automatically when a message arrives; translate() only ever fires
// from an explicit user tap, per the feature's "don't waste battery/CPU
// translating everything by default" requirement.
//
// Reads `text` exactly as already handed to it - the caller passes the
// same already-decrypted display text MessageBubble already renders (see
// MessageBubble.tsx's `text` value, derived from the decrypted
// ChatMessage.text). This hook never has access to ciphertext and never
// calls anything network-related; see TranslationService.ts's header for
// the full on-device invariant.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TranslationService from '@/services/translation/TranslationService';
import { getCachedTranslation, setCachedTranslation } from '@/services/translation/translationCache';
import { getLanguageLabel, normalizeLanguageCode } from '@/services/translation/translationLanguages';

export type TranslationPhase =
  | 'idle'
  | 'checking'
  | 'needs_download'
  | 'downloading'
  | 'translating'
  | 'error';

export type UseMessageTranslationResult = {
  phase: TranslationPhase;
  /** Whether the translated block should currently render (vs. "Original"). */
  visible: boolean;
  translatedText: string | null;
  sourceLanguageCode: string | null;
  errorMessage: string | null;
  /** Human-readable label for the source->target pair still needing a
   *  model download, e.g. "French to English". Only set while
   *  phase === 'needs_download'. */
  neededModelLabel: string | null;
  /** Kick off translation: uses the cache if available, otherwise detects
   *  the source language and checks model availability before either
   *  translating immediately or moving to 'needs_download'. */
  translate: () => Promise<void>;
  /** Downloads the source->target model pair, then continues straight into
   *  translation once the download succeeds. */
  confirmDownload: () => Promise<void>;
  /** Flips between showing the translation and the original text without
   *  discarding the already-computed translation. */
  toggleOriginal: () => void;
  reset: () => void;
};

export function useMessageTranslation(params: {
  messageId: string;
  text: string;
  targetLanguageCode: string;
}): UseMessageTranslationResult {
  const { messageId, text, targetLanguageCode: rawTargetLanguageCode } = params;
  const targetLanguageCode = useMemo(
    () => normalizeLanguageCode(rawTargetLanguageCode),
    [rawTargetLanguageCode],
  );

  const [phase, setPhase] = useState<TranslationPhase>('idle');
  const [visible, setVisible] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLanguageCode, setSourceLanguageCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neededModelLabel, setNeededModelLabel] = useState<string | null>(null);
  const pendingPairRef = useRef<{ source: string; target: string } | null>(null);

  // Guards against a stale async response landing after the message/target
  // language changed (e.g. list recycling a row, or the user switching
  // their app language mid-flight).
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setPhase('idle');
    setVisible(false);
    setTranslatedText(null);
    setSourceLanguageCode(null);
    setErrorMessage(null);
    setNeededModelLabel(null);
    pendingPairRef.current = null;
  }, []);

  // A different message (row recycling) or a changed target language
  // invalidates whatever was previously computed.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, targetLanguageCode]);

  const runTranslate = useCallback(
    async (sourceOverride?: string) => {
      const requestId = ++requestIdRef.current;
      const trimmed = text?.trim() ?? '';
      if (!trimmed) return;
      if (!targetLanguageCode) {
        setPhase('error');
        setErrorMessage('No target language is set.');
        return;
      }

      setPhase('checking');
      setErrorMessage(null);

      try {
        const supported = await TranslationService.isSupported();
        if (requestIdRef.current !== requestId) return;
        if (!supported) {
          setPhase('error');
          setErrorMessage("Translation isn't available on this device.");
          return;
        }

        const cached = await getCachedTranslation(messageId, targetLanguageCode);
        if (requestIdRef.current !== requestId) return;
        if (cached) {
          setTranslatedText(cached.translatedText);
          setSourceLanguageCode(cached.sourceLanguageCode || null);
          setVisible(true);
          setPhase('idle');
          return;
        }

        let source = sourceOverride ? normalizeLanguageCode(sourceOverride) : null;
        if (!source) {
          const detected = await TranslationService.detectLanguage(trimmed);
          if (requestIdRef.current !== requestId) return;
          if (!detected) {
            setPhase('error');
            setErrorMessage("Couldn't detect this message's language.");
            return;
          }
          source = detected.languageCode;
        }

        if (source === targetLanguageCode) {
          setPhase('error');
          setErrorMessage('This message is already in your language.');
          return;
        }

        const modelStatus = await TranslationService.getModelStatus(source, targetLanguageCode);
        if (requestIdRef.current !== requestId) return;
        if (modelStatus === 'unsupported') {
          setPhase('error');
          setErrorMessage(`Translating from ${getLanguageLabel(source)} isn't supported on this device.`);
          return;
        }
        if (modelStatus !== 'downloaded') {
          setSourceLanguageCode(source);
          pendingPairRef.current = { source, target: targetLanguageCode };
          setNeededModelLabel(`${getLanguageLabel(source)} to ${getLanguageLabel(targetLanguageCode)}`);
          setPhase('needs_download');
          return;
        }

        setPhase('translating');
        const result = await TranslationService.translate({
          text: trimmed,
          sourceLanguageCode: source,
          targetLanguageCode,
        });
        if (requestIdRef.current !== requestId) return;

        setTranslatedText(result.translatedText);
        setSourceLanguageCode(result.sourceLanguageCode);
        setVisible(true);
        setPhase('idle');
        void setCachedTranslation(messageId, targetLanguageCode, {
          translatedText: result.translatedText,
          sourceLanguageCode: result.sourceLanguageCode,
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setPhase('error');
        setErrorMessage(error instanceof Error ? error.message : 'Translation failed.');
      }
    },
    [messageId, targetLanguageCode, text],
  );

  const translate = useCallback(async () => {
    if (visible && translatedText) return; // already showing a translation
    await runTranslate();
  }, [visible, translatedText, runTranslate]);

  const confirmDownload = useCallback(async () => {
    const pending = pendingPairRef.current;
    if (!pending) return;
    const requestId = requestIdRef.current;
    setPhase('downloading');
    setErrorMessage(null);
    try {
      await TranslationService.downloadModel(pending.source, pending.target);
      if (requestIdRef.current !== requestId) return;
      pendingPairRef.current = null;
      setNeededModelLabel(null);
      await runTranslate(pending.source);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setPhase('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download the language model.');
    }
  }, [runTranslate]);

  const toggleOriginal = useCallback(() => {
    if (!translatedText) return;
    setVisible((prev) => !prev);
  }, [translatedText]);

  return {
    phase,
    visible,
    translatedText,
    sourceLanguageCode,
    errorMessage,
    neededModelLabel,
    translate,
    confirmDownload,
    toggleOriginal,
    reset,
  };
}
