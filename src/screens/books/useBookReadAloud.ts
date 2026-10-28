// src/screens/books/useBookReadAloud.ts
//
// Drives KIS Books' "Listen" feature using the device's own text-to-speech
// engine (react-native-tts) — no server audio involved, no book content
// sent to any external speech provider. Deliberately adapted from the
// Bible reader's proven useBibleReadAloud.ts (same library, same
// documented platform quirks) rather than written from scratch — see that
// file for the original platform-limitation findings this one inherits.
//
// Synchronization model, honestly stated: react-native-tts does not
// expose reliable word/character-range "speaking now" events across both
// platforms (useBibleReadAloud.ts found iOS's own 'tts-error' event name
// unsupported at the native binding level for this pod version; there is
// no cross-platform range-boundary event at all). Rather than fake
// precision with an estimated per-word timer, this speaks ONE SENTENCE AT
// A TIME and highlights the sentence currently queued to the engine,
// advancing only on the engine's own 'tts-finish' event. That is real,
// not estimated, synchronization — just sentence-grained rather than
// word-grained.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { ReactNativeTts, Voice as TtsVoice } from 'react-native-tts';
import { splitIntoSentences } from './sentenceSplit';
import {
  readBookReadAloudPreference,
  writeBookReadAloudPreference,
} from '@/services/bookReadAloudPreferenceStore';

export type BookReadAloudStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';

export type ReadAloudContentBlock = { id?: string; type: string; text?: string };

type SpeechUnit = { blockId: string; blockIndex: number; sentenceIndex: number; text: string };

let Tts: ReactNativeTts | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Tts = require('react-native-tts').default;
} catch {
  Tts = null;
}

const speedToRate = (multiplier: number) => Math.max(0.01, Math.min(0.99, 0.5 * multiplier));

function buildSpeechUnits(blocks: ReadAloudContentBlock[]): SpeechUnit[] {
  const units: SpeechUnit[] = [];
  blocks.forEach((block, blockIndex) => {
    const blockId = block.id || `block-${blockIndex}`;
    const sentences = splitIntoSentences(block.text || '');
    sentences.forEach((sentence, sentenceIndex) => {
      units.push({ blockId, blockIndex, sentenceIndex, text: sentence.text });
    });
  });
  return units;
}

type Params = {
  /** The currently-loaded chapter's content blocks — changes when BookReaderScreen advances chapters. */
  blocks: ReadAloudContentBlock[];
  /** Called when the current chapter's last sentence finishes — the hook does not own chapter navigation. */
  onChapterEnd: () => void;
  /** Called periodically while playing so the caller can persist reading/listening position. */
  onPositionChange?: (position: { blockId: string; blockIndex: number; percentComplete: number }) => void;
};

export function useBookReadAloud({ blocks, onChapterEnd, onPositionChange }: Params) {
  const [status, setStatus] = useState<BookReadAloudStatus>('idle');
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null);
  const [ttsReady, setTtsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const unitsRef = useRef<SpeechUnit[]>(buildSpeechUnits(blocks));
  const unitIndexRef = useRef(0);
  const onChapterEndRef = useRef(onChapterEnd);
  onChapterEndRef.current = onChapterEnd;
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const sleepTimerHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingAcrossChapterChangeRef = useRef(false);

  const reportPosition = useCallback(() => {
    const unit = unitsRef.current[unitIndexRef.current];
    if (!unit) return;
    const percentComplete = unitsRef.current.length
      ? Math.min(1, unitIndexRef.current / unitsRef.current.length)
      : 0;
    onPositionChangeRef.current?.({ blockId: unit.blockId, blockIndex: unit.blockIndex, percentComplete });
  }, []);

  const speakFromIndex = useCallback((startIndex: number) => {
    const units = unitsRef.current;
    if (startIndex >= units.length) {
      setCurrentBlockId(null);
      setCurrentSentenceIndex(null);
      wasPlayingAcrossChapterChangeRef.current = true;
      onChapterEndRef.current();
      return;
    }
    unitIndexRef.current = startIndex;
    const unit = units[startIndex];
    setCurrentBlockId(unit.blockId);
    setCurrentSentenceIndex(unit.sentenceIndex);
    reportPosition();
    if (!Tts) return;
    try {
      Tts.speak(unit.text);
    } catch {
      speakFromIndex(startIndex + 1);
    }
  }, [reportPosition]);

  // Rebuild speech units whenever the loaded chapter's blocks change
  // (chapter navigation). Only auto-continue speaking into the new
  // chapter if we were actively playing when it arrived — a chapter
  // change triggered by the user manually tapping "Next chapter" in the
  // table of contents while paused/idle should not suddenly start audio.
  useEffect(() => {
    unitsRef.current = buildSpeechUnits(blocks);
    unitIndexRef.current = 0;
    if (wasPlayingAcrossChapterChangeRef.current && unitsRef.current.length > 0) {
      wasPlayingAcrossChapterChangeRef.current = false;
      speakFromIndex(0);
    }
  }, [blocks, speakFromIndex]);

  const handleUtteranceEnd = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    speakFromIndex(unitIndexRef.current + 1);
  }, [speakFromIndex]);

  useEffect(() => {
    if (!Tts) return;
    // addListener (not addEventListener/removeEventListener) — see
    // useBibleReadAloud.ts's matching comment: this library's own
    // removeEventListener() calls a NativeEventEmitter method RN removed,
    // crashing on cleanup. 'tts-error' is deliberately not registered for
    // the same reason documented there (unsupported at the native level
    // on this pod version).
    const finishSub = Tts.addListener('tts-finish', handleUtteranceEnd);
    return () => finishSub.remove();
  }, [handleUtteranceEnd]);

  const clearSleepTimer = () => {
    if (sleepTimerHandleRef.current) {
      clearTimeout(sleepTimerHandleRef.current);
      sleepTimerHandleRef.current = null;
    }
  };

  const stop = useCallback(() => {
    Tts?.stop(false)?.catch(() => {});
    clearSleepTimer();
    wasPlayingAcrossChapterChangeRef.current = false;
    setCurrentBlockId(null);
    setCurrentSentenceIndex(null);
    setStatus('idle');
  }, []);

  const armSleepTimer = useCallback((minutes: number | null) => {
    clearSleepTimer();
    if (!minutes) return;
    sleepTimerHandleRef.current = setTimeout(() => {
      stop();
    }, minutes * 60_000);
  }, [stop]);

  const play = useCallback(() => {
    if (!Tts) {
      setErrorMessage('Text-to-speech isn’t available in this build.');
      return;
    }
    if (statusRef.current === 'paused') {
      setStatus('playing');
      if (Platform.OS === 'ios') {
        Tts.resume().catch(() => {
          // Same Android limitation as the Bible reader: pause()/resume()
          // are native no-ops there, so the paused sentence has usually
          // already finished in the background with nothing queued after
          // it. Re-speaking the current sentence is the only thing this
          // platform can actually do — there is no true resume-from-
          // position available on Android with this library.
          speakFromIndex(unitIndexRef.current);
        });
      } else {
        speakFromIndex(unitIndexRef.current);
      }
      armSleepTimer(sleepTimerMinutes);
      return;
    }
    if (statusRef.current === 'playing') return;
    if (!unitsRef.current.length) return;
    setStatus('playing');
    armSleepTimer(sleepTimerMinutes);
    speakFromIndex(0);
  }, [speakFromIndex, armSleepTimer, sleepTimerMinutes]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    setStatus('paused');
    clearSleepTimer();
    if (Platform.OS === 'ios') {
      Tts?.pause(false)?.catch(() => {});
    } else {
      Tts?.stop()?.catch(() => {});
    }
  }, []);

  const nextSentence = useCallback(() => {
    if (statusRef.current !== 'playing' && statusRef.current !== 'paused') return;
    Tts?.stop(false)?.catch(() => {});
    speakFromIndex(unitIndexRef.current + 1);
    setStatus('playing');
  }, [speakFromIndex]);

  const previousSentence = useCallback(() => {
    if (statusRef.current !== 'playing' && statusRef.current !== 'paused') return;
    Tts?.stop(false)?.catch(() => {});
    speakFromIndex(Math.max(0, unitIndexRef.current - 1));
    setStatus('playing');
  }, [speakFromIndex]);

  const setSpeed = useCallback((multiplier: number) => {
    setSpeedState(multiplier);
    Tts?.setDefaultRate(speedToRate(multiplier))?.catch(() => {});
    writeBookReadAloudPreference({ speed: multiplier }).catch(() => {});
  }, []);

  const setVoice = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId);
    Tts?.setDefaultVoice(voiceId)?.catch(() => {});
    writeBookReadAloudPreference({ voiceId }).catch(() => {});
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: number | null) => {
    setSleepTimerMinutesState(minutes);
    writeBookReadAloudPreference({ sleepTimerMinutes: minutes }).catch(() => {});
    if (statusRef.current === 'playing') armSleepTimer(minutes);
  }, [armSleepTimer]);

  useEffect(() => {
    if (!Tts) {
      setTtsReady(false);
      setVoicesLoading(false);
      setErrorMessage('Text-to-speech isn’t available in this build.');
      return;
    }
    const ttsClient = Tts;
    let cancelled = false;
    (async () => {
      try {
        await ttsClient.getInitStatus();
      } catch (err: any) {
        if (err?.code === 'no_engine') {
          try {
            await ttsClient.requestInstallEngine();
          } catch {}
        }
        if (!cancelled) {
          setTtsReady(false);
          setVoicesLoading(false);
          setErrorMessage('No text-to-speech voices are installed on this device.');
        }
        return;
      }
      if (cancelled) return;
      setTtsReady(true);
      try {
        const list = await ttsClient.voices();
        if (cancelled) return;
        const usable = (list || []).filter((v) => !v.notInstalled);
        setVoices(usable.length ? usable : list || []);
      } catch {
        // Not fatal — the engine's default voice still works without a picker.
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
      const pref = await readBookReadAloudPreference();
      if (cancelled) return;
      setSpeedState(pref.speed ?? 1);
      setSleepTimerMinutesState(pref.sleepTimerMinutes ?? null);
      setSelectedVoiceId(pref.voiceId ?? null);
      try {
        await ttsClient.setDefaultRate(speedToRate(pref.speed ?? 1));
        if (pref.voiceId) await ttsClient.setDefaultVoice(pref.voiceId);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearSleepTimer();
      Tts?.stop(false)?.catch(() => {});
    };
  }, []);

  return {
    status,
    isActive: status === 'playing' || status === 'paused',
    currentBlockId,
    currentSentenceIndex,
    ttsReady,
    errorMessage,
    voices,
    voicesLoading,
    selectedVoiceId,
    speed,
    sleepTimerMinutes,
    play,
    pause,
    stop,
    nextSentence,
    previousSentence,
    setSpeed,
    setVoice,
    setSleepTimerMinutes,
  };
}

export default useBookReadAloud;
