// src/screens/tabs/bible/useBibleReadAloud.ts
//
// Drives the Bible reader's "Read aloud" feature using the device's own
// text-to-speech engine (react-native-tts) — no server audio involved.
//
// Speaks one verse at a time (rather than queueing the whole chapter) so we
// always know exactly which verse is on-screen for highlighting, and can cut
// in cleanly on pause/stop. When a chapter's verses run out, it follows
// reader.navigation.next (which already crosses book boundaries — e.g. the
// last chapter of a book's "next" is chapter 1 of the following book) to
// keep going until either the configured max duration is reached or
// navigation.next comes back empty (end of Revelation — the whole Bible,
// read start to finish).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { ReactNativeTts, Voice as TtsVoice } from 'react-native-tts';
import type { BibleReaderPayload, BibleVerse } from './useBibleData';
import {
  readBibleReadAloudPreference,
  writeBibleReadAloudPreference,
} from '@/services/bibleReadAloudPreferenceStore';

export type BibleReadAloudStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';
export type BibleReadAloudFinishReason = 'completed' | 'time-limit' | null;

export type { TtsVoice as BibleReadAloudVoice };

// react-native-tts constructs its default-exported singleton the moment it's
// required (it wraps NativeEventEmitter around the native module right away),
// which throws synchronously if the native side isn't linked into the running
// app binary yet (e.g. a JS-only reload after this dependency was added,
// before a native rebuild). A `require` inside try/catch — rather than a
// static `import` — lets us catch that and degrade gracefully instead of
// crashing the whole Bible reader.
let Tts: ReactNativeTts | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Tts = require('react-native-tts').default;
} catch {
  Tts = null;
}

type Params = {
  reader: BibleReaderPayload | null;
  verses: BibleVerse[];
  translationCode?: string;
  /** Same shape as BibleReaderPanel's onLoad(translation, book, chapter) — used to fetch the next chapter. */
  onLoadChapter: (translation: string, book: string, chapter: number) => void;
};

const chapterKey = (reader: BibleReaderPayload | null) => {
  const book = reader?.book?.code;
  const chapter = reader?.chapter?.number;
  return book && chapter ? `${book}:${chapter}` : null;
};

// The library's rate is a 0.01–0.99 float where ~0.5 is "normal" speed on
// both platforms — map our human-facing "1x, 1.5x, ..." multiplier onto it.
const speedToRate = (multiplier: number) => Math.max(0.01, Math.min(0.99, 0.5 * multiplier));

export function useBibleReadAloud({ reader, verses, translationCode, onLoadChapter }: Params) {
  const [status, setStatus] = useState<BibleReadAloudStatus>('idle');
  const [finishReason, setFinishReason] = useState<BibleReadAloudFinishReason>(null);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [maxDurationMinutes, setMaxDurationMinutesState] = useState<number | null>(null);
  const [ttsReady, setTtsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // "Latest" refs — kept in sync every render (not via an effect, to avoid a
  // one-render lag) so the TTS event handlers and the async chapter-advance
  // flow always see current props/state instead of a stale closure.
  const statusRef = useRef(status);
  statusRef.current = status;
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const readerRef = useRef(reader);
  readerRef.current = reader;
  const translationCodeRef = useRef(translationCode);
  translationCodeRef.current = translationCode;
  const onLoadChapterRef = useRef(onLoadChapter);
  onLoadChapterRef.current = onLoadChapter;
  const maxDurationMinutesRef = useRef(maxDurationMinutes);
  maxDurationMinutesRef.current = maxDurationMinutes;

  const verseIndexRef = useRef(0);
  const awaitingChapterRef = useRef<{ book: string; chapter: number } | null>(null);
  const speakingChapterKeyRef = useRef<string | null>(null);
  const accumulatedMsRef = useRef(0);
  const playStartedAtRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // A fresh play() queues speech immediately, but the engine can take a
  // beat to actually start talking (voice/engine warm-up) — without this,
  // the elapsed clock (and the "Reading…" state) would visibly run ahead
  // of what the user actually hears. Set on a fresh play(), consumed by
  // the first real 'tts-start' event to start the clock in sync with audio.
  const pendingTickStartRef = useRef(false);

  const getElapsedMs = () =>
    accumulatedMsRef.current + (playStartedAtRef.current ? Date.now() - playStartedAtRef.current : 0);

  const stopTicking = () => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };
  const startTicking = () => {
    stopTicking();
    tickIntervalRef.current = setInterval(() => setElapsedMs(getElapsedMs()), 1000);
  };
  // Freezes the running clock (used whenever we actually stop speaking, as
  // opposed to just moving between chapters while still "playing").
  const freezeElapsed = () => {
    accumulatedMsRef.current = getElapsedMs();
    playStartedAtRef.current = null;
    setElapsedMs(accumulatedMsRef.current);
  };

  const finishReading = useCallback((reason: 'completed' | 'time-limit') => {
    Tts?.stop(false)?.catch(() => {});
    stopTicking();
    freezeElapsed();
    awaitingChapterRef.current = null;
    speakingChapterKeyRef.current = null;
    setCurrentVerseNumber(null);
    setFinishReason(reason);
    setStatus('finished');
  }, []);

  const handleChapterComplete = useCallback(() => {
    const limitMs = maxDurationMinutesRef.current ? maxDurationMinutesRef.current * 60_000 : null;
    if (limitMs !== null && getElapsedMs() >= limitMs) {
      finishReading('time-limit');
      return;
    }
    const next = readerRef.current?.navigation?.next;
    const nextBookCode = next?.book?.code;
    const nextChapterNumber = next?.number;
    const translation = translationCodeRef.current;
    if (next && nextBookCode && nextChapterNumber && translation) {
      awaitingChapterRef.current = { book: nextBookCode, chapter: Number(nextChapterNumber) };
      setStatus('loading');
      onLoadChapterRef.current(translation, nextBookCode, Number(nextChapterNumber));
    } else {
      // navigation.next is empty only at the very end of Revelation — the
      // whole Bible from the start point has now been read.
      finishReading('completed');
    }
  }, [finishReading]);

  const playFromIndex = useCallback((startIndex: number) => {
    const list = versesRef.current;
    let index = startIndex;
    while (index < list.length && !String(list[index]?.text || '').trim()) {
      index += 1;
    }
    verseIndexRef.current = index;
    if (index >= list.length) {
      handleChapterComplete();
      return;
    }
    const verse = list[index];
    setCurrentVerseNumber(Number(verse.number));
    if (!Tts) return;
    try {
      Tts.speak(String(verse.text));
    } catch {
      playFromIndex(index + 1);
    }
  }, [handleChapterComplete]);

  const handleUtteranceEnd = useCallback(() => {
    // Ignore finish/error events that arrive after we've paused or stopped
    // (e.g. a trailing event from the utterance in flight when stop() was
    // called) — only advance while we're actually meant to be playing.
    if (statusRef.current !== 'playing') return;
    // Safety net: if 'tts-start' never fired (missed event) but the verse
    // clearly finished speaking, start the clock late rather than never.
    if (pendingTickStartRef.current) {
      pendingTickStartRef.current = false;
      playStartedAtRef.current = Date.now();
      startTicking();
    }
    playFromIndex(verseIndexRef.current + 1);
  }, [playFromIndex]);

  const handleUtteranceStart = useCallback(() => {
    if (!pendingTickStartRef.current) return;
    pendingTickStartRef.current = false;
    // Guards a race where pause()/stop() landed before the engine actually
    // got around to firing 'tts-start' for the first verse.
    if (statusRef.current !== 'playing') return;
    playStartedAtRef.current = Date.now();
    startTicking();
  }, []);

  // Register the TTS engine's event listeners once. Both handlers' identity
  // is stable for the component's lifetime (their whole dependency chain
  // only ever touches refs and stable setState functions).
  //
  // Only 'tts-finish' and 'tts-start' are used — despite the package's own
  // .d.ts listing 'tts-error' as a valid event name, the native iOS binding
  // in this pod version rejects it at runtime ("not a supported event
  // type"), so registering for it crashes the app. If a verse ever fails to
  // synthesize we simply won't auto-advance past it — an acceptable
  // trade-off, since KJV verse text is always plain, speakable text.
  useEffect(() => {
    if (!Tts) return;
    Tts.addEventListener('tts-finish', handleUtteranceEnd);
    Tts.addEventListener('tts-start', handleUtteranceStart);
    return () => {
      Tts?.removeEventListener('tts-finish', handleUtteranceEnd);
      Tts?.removeEventListener('tts-start', handleUtteranceStart);
    };
  }, [handleUtteranceEnd, handleUtteranceStart]);

  // Continue reading once the chapter we auto-advanced to has actually
  // loaded (loadReader/onLoadChapter is async).
  useEffect(() => {
    const awaiting = awaitingChapterRef.current;
    if (!awaiting) return;
    const bookCode = reader?.book?.code;
    const chapterNumber = reader?.chapter?.number;
    if (bookCode === awaiting.book && Number(chapterNumber) === awaiting.chapter && verses.length > 0) {
      awaitingChapterRef.current = null;
      speakingChapterKeyRef.current = chapterKey(reader);
      verseIndexRef.current = 0;
      setStatus('playing');
      playFromIndex(0);
    }
  }, [reader, verses, playFromIndex]);

  // If the displayed chapter changes to something other than what we're
  // narrating — and we didn't just trigger that change ourselves via
  // handleChapterComplete (which always sets awaitingChapterRef first) —
  // the user navigated away manually. Stop rather than keep narrating a
  // passage that's no longer on screen.
  useEffect(() => {
    if (statusRef.current === 'idle' || statusRef.current === 'finished') return;
    if (awaitingChapterRef.current) return;
    const key = chapterKey(reader);
    if (speakingChapterKeyRef.current && key !== speakingChapterKeyRef.current) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader?.book?.code, reader?.chapter?.number]);

  const play = useCallback(async () => {
    if (!Tts) {
      setErrorMessage('Text-to-speech isn’t available in this build.');
      return;
    }
    if (statusRef.current === 'paused') {
      setStatus('playing');
      playStartedAtRef.current = Date.now();
      startTicking();
      if (Platform.OS === 'ios') {
        try {
          await Tts.resume();
        } catch {}
      } else {
        // react-native-tts's pause()/resume() are hard-coded no-ops on
        // Android (index.js: both just `return Promise.resolve(false)`
        // without touching the native module at all - only iOS actually
        // implements them). pause() below never really stopped the
        // engine there, so by the time "continue" is tapped the verse
        // that was speaking when paused has almost always already
        // finished on its own in the background, with nothing queued
        // after it - resume() then does nothing, which is exactly "the
        // timer is running but I'm not hearing anything". Re-speaking
        // the current verse is the only thing this platform can
        // actually do; there's no true resume-from-position available.
        playFromIndex(verseIndexRef.current);
      }
      return;
    }
    if (statusRef.current === 'playing' || statusRef.current === 'loading') return;
    if (!versesRef.current.length) return;
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    setFinishReason(null);
    speakingChapterKeyRef.current = chapterKey(readerRef.current);
    setStatus('playing');
    // The clock starts on the first real 'tts-start' event (see
    // handleUtteranceStart) so it doesn't visibly run ahead of the audio
    // while the engine warms up — with a short fallback in case that event
    // never arrives (handleUtteranceEnd, and the timeout below).
    pendingTickStartRef.current = true;
    playFromIndex(0);
    setTimeout(() => {
      if (!pendingTickStartRef.current || statusRef.current !== 'playing') return;
      pendingTickStartRef.current = false;
      playStartedAtRef.current = Date.now();
      startTicking();
    }, 2500);
  }, [playFromIndex]);

  const pause = useCallback(async () => {
    if (statusRef.current !== 'playing') return;
    freezeElapsed();
    stopTicking();
    setStatus('paused');
    try {
      if (Platform.OS === 'ios') {
        await Tts?.pause(false);
      } else {
        // See play()'s matching comment - Tts.pause() is a silent no-op
        // on Android, so the verse kept speaking out loud in the
        // background while the UI already showed "Paused". stop() is
        // what actually silences it here; playFromIndex on the way back
        // in re-speaks the current verse since there's no real
        // resume-from-position on this platform.
        await Tts?.stop();
      }
    } catch {}
  }, []);

  const stop = useCallback(() => {
    Tts?.stop(false)?.catch(() => {});
    stopTicking();
    pendingTickStartRef.current = false;
    awaitingChapterRef.current = null;
    speakingChapterKeyRef.current = null;
    verseIndexRef.current = 0;
    accumulatedMsRef.current = 0;
    playStartedAtRef.current = null;
    setElapsedMs(0);
    setCurrentVerseNumber(null);
    setFinishReason(null);
    setStatus('idle');
  }, []);

  const setSpeed = useCallback((multiplier: number) => {
    setSpeedState(multiplier);
    Tts?.setDefaultRate(speedToRate(multiplier))?.catch(() => {});
    writeBibleReadAloudPreference({ speed: multiplier }).catch(() => {});
  }, []);

  const setVoice = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId);
    Tts?.setDefaultVoice(voiceId)?.catch(() => {});
    writeBibleReadAloudPreference({ voiceId }).catch(() => {});
  }, []);

  const setMaxDurationMinutes = useCallback((minutes: number | null) => {
    setMaxDurationMinutesState(minutes);
    writeBibleReadAloudPreference({ maxDurationMinutes: minutes }).catch(() => {});
  }, []);

  // Boot the TTS engine, load available voices, and restore saved prefs.
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
        const usable = (list || []).filter(v => !v.notInstalled);
        setVoices(usable.length ? usable : list || []);
      } catch {
        // Not fatal — the engine's own default voice still works without a picker.
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }

      const pref = await readBibleReadAloudPreference();
      if (cancelled) return;
      setSpeedState(pref.speed ?? 1);
      setMaxDurationMinutesState(pref.maxDurationMinutes ?? null);
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

  // Stop narrating and tear down the ticker if the reader unmounts entirely.
  useEffect(() => {
    return () => {
      stopTicking();
      Tts?.stop(false)?.catch(() => {});
    };
  }, []);

  const remainingMs = maxDurationMinutes ? Math.max(0, maxDurationMinutes * 60_000 - elapsedMs) : null;

  return {
    status,
    isActive: status === 'playing' || status === 'paused' || status === 'loading',
    finishReason,
    currentVerseNumber,
    elapsedMs,
    remainingMs,
    ttsReady,
    errorMessage,
    voices,
    voicesLoading,
    selectedVoiceId,
    speed,
    maxDurationMinutes,
    play,
    pause,
    stop,
    setSpeed,
    setVoice,
    setMaxDurationMinutes,
  };
}

export default useBibleReadAloud;
