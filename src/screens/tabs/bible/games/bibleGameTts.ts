// src/screens/tabs/bible/games/bibleGameTts.ts
//
// A small on-device text-to-speech helper shared by Listen & Tap and Audio
// Dictation — the only two of the 30 games that need spoken audio. Deliberately
// NOT a reuse of useBibleReadAloud.ts (that hook drives the Bible reader's
// whole chapter-by-chapter playback/navigation/voice-picker experience,
// which is much more machinery than "speak this one verse, tell me when
// it's done" needs here) but it DOES reuse that hook's exact defensive-require
// pattern for react-native-tts, since the reasoning is identical: the native
// module throws synchronously if it isn't linked yet, and that must degrade
// to "TTS unavailable" rather than crash the game.
//
// Speech happens entirely on-device — no network call, no audio file bundled
// or fetched — so this keeps both games within the feature's hard "100%
// offline" requirement exactly like every other game's bundled-kjv.json read.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNativeTts } from 'react-native-tts';

let Tts: ReactNativeTts | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Tts = require('react-native-tts').default;
} catch {
  Tts = null;
}

export type SpeakStatus = 'idle' | 'speaking' | 'finished';

/** Speak-one-utterance-at-a-time TTS control for a single game screen.
 * `ready` is false (and `speak` a no-op) on any device/build where the
 * native module isn't available — callers should fall back to a text-only
 * mode rather than block the game on audio that will never arrive. */
export function useBibleGameTts() {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SpeakStatus>('idle');
  const onDoneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!Tts) {
      setReady(false);
      return;
    }
    let mounted = true;
    // getInitStatus rejects on some Android builds if the OS has no TTS
    // engine installed at all - treated the same as "module not linked":
    // unavailable, not a crash.
    Tts.getInitStatus()
      .then(() => { if (mounted) setReady(true); })
      .catch(() => { if (mounted) setReady(false); });

    const finishSub = Tts.addListener('tts-finish', () => {
      if (!mounted) return;
      setStatus('finished');
      onDoneRef.current?.();
      onDoneRef.current = null;
    });
    const cancelSub = Tts.addListener('tts-cancel', () => {
      if (!mounted) return;
      setStatus('idle');
      onDoneRef.current = null;
    });

    return () => {
      mounted = false;
      finishSub?.remove?.();
      cancelSub?.remove?.();
      Tts?.stop();
    };
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!Tts || !text) {
      onDone?.();
      return;
    }
    onDoneRef.current = onDone ?? null;
    setStatus('speaking');
    Tts.stop();
    Tts.speak(text);
  }, []);

  const stop = useCallback(() => {
    onDoneRef.current = null;
    Tts?.stop();
    setStatus('idle');
  }, []);

  return { ready, status, speak, stop };
}
