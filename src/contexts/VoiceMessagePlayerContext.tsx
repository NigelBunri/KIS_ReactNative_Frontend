// src/contexts/VoiceMessagePlayerContext.tsx
//
// Keeps a voice note playing across navigation. Unlike a call (which already
// survives backgrounding via WebRTC's own audio session, independent of any
// specific screen), voice-note playback lived entirely as local state + a
// local <Video> element inside whichever MessageBubble started it (see
// MessageBubble.tsx) — so navigating away from that chat killed playback the
// instant that bubble unmounted, and nothing indicated it was ever playing
// once you left. This context is the single, App-level source of truth for
// "what's playing right now" and owns the one real <Video> element that
// survives regardless of which chat screen (if any) is currently mounted.
//
// Mirrors MiniPlayerContext.tsx's exact shape (KISTube's now-playing state —
// same "provider holds state above the navigator, a floating bar reflects
// it" pattern) but for voice notes instead of broadcast video.
//
// Deliberately NOT responsible for resolving a voice note's playback URL in
// the first place — that's MessageBubble's own, already-correct, already-
// tested resolution waterfall (local file -> freshly-resolved Nest url ->
// embedded url -> attachments[] fallback; see voiceAttachment.ts /
// voicePlaybackResolver.ts). MessageBubble hands this context an
// already-built, ready-to-play `source` (the exact {uri, headers?} shape it
// already constructs today) via play() once it knows how to reach the file.
// The one exception: a MID-PLAYBACK failure (the resolved url expired while
// playing, or a dropped connection) reuses the exact one-shot
// retry-via-resolver pattern MessageBubble's own onError already uses,
// ported here since MessageBubble may no longer be mounted by the time this
// fires — that's the entire point of this context existing.

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import Video, { type VideoRef } from 'react-native-video';
import {
  resolveFreshVoicePlaybackUrl,
  describeVoicePlaybackError,
} from '@/Module/ChatRoom/voicePlaybackResolver';

export type VoiceMessageSource = { uri: string; headers?: Record<string, string> };

export type VoiceMessagePlayInfo = {
  /** Stable identity — mirrors MessageBubble's own playbackOwnerRef (serverId ?? id). */
  messageId: string;
  conversationId: string;
  /** Shown on the floating badge and used to reopen the right chat via 'chat.open'. */
  conversationTitle: string;
  senderName?: string;
  source: VoiceMessageSource;
  /** Used only for the one-shot retry-via-resolver on a mid-playback error. */
  mediaAssetId?: string;
  /** Best-known duration before <Video> reports the real one via onLoad. */
  initialDurationMs?: number;
};

type SpeedOption = 0.5 | 1 | 1.5 | 2;
const SPEED_CYCLE: SpeedOption[] = [1, 1.5, 2, 0.5];

type VoiceMessagePlayerCtx = {
  messageId: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
  senderName: string | null;
  playing: boolean;
  buffering: boolean;
  positionMs: number;
  durationMs: number;
  speed: SpeedOption;
  error: string | null;
  /** True while the currently-announced message is THIS messageId — the
   *  usual way a MessageBubble checks "is it me that's playing." */
  isActive: (messageId: string) => boolean;
  /** Starts a new note (replacing whatever was playing — no queueing, per
   *  the same single-active-note behavior the old per-bubble
   *  DeviceEventEmitter coordination already had), or resumes if it's
   *  already the active message and merely paused. */
  play: (info: VoiceMessagePlayInfo) => void;
  togglePlay: () => void;
  cycleSpeed: () => void;
  /** Fully dismisses — stops playback and hides the badge. */
  stop: () => void;
};

const VoiceMessagePlayerContext = createContext<VoiceMessagePlayerCtx>({
  messageId: null,
  conversationId: null,
  conversationTitle: null,
  senderName: null,
  playing: false,
  buffering: false,
  positionMs: 0,
  durationMs: 0,
  speed: 1,
  error: null,
  isActive: () => false,
  play: () => {},
  togglePlay: () => {},
  cycleSpeed: () => {},
  stop: () => {},
});

export function VoiceMessagePlayerProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<VoiceMessagePlayInfo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<VideoRef | null>(null);
  // One retry per play() call, same budget/reset shape as MessageBubble's
  // own voiceRetriedRef — reset every time a new note starts.
  const retriedRef = useRef(false);
  const mountedRef = useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const stop = useCallback(() => {
    setInfo(null);
    setPlaying(false);
    setBuffering(false);
    setPositionMs(0);
    setDurationMs(0);
    setError(null);
  }, []);

  const play = useCallback((next: VoiceMessagePlayInfo) => {
    // Resuming the same note (the user paused, then pressed play again on
    // the same bubble/badge) keeps its position/duration/error as-is — only
    // a genuinely different note resets playback to the top.
    const isSameNote = info?.messageId === next.messageId;
    if (!isSameNote) {
      setInfo(next);
      setPositionMs(0);
      setDurationMs(next.initialDurationMs ?? 0);
      setError(null);
      retriedRef.current = false;
    }
    setPlaying(true);
  }, [info?.messageId]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((current) => {
      const idx = SPEED_CYCLE.indexOf(current);
      return SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
    });
  }, []);

  const isActive = useCallback(
    (messageId: string) => info?.messageId === messageId,
    [info?.messageId],
  );

  const handleError = useCallback(() => {
    const current = info;
    if (!current) return;
    if (!retriedRef.current && current.mediaAssetId) {
      retriedRef.current = true;
      setBuffering(true);
      resolveFreshVoicePlaybackUrl(current.messageId, { force: true })
        .then((resolved) => {
          if (!mountedRef.current) return;
          setInfo((prev) =>
            prev && prev.messageId === current.messageId
              ? { ...prev, source: { uri: resolved.url } }
              : prev,
          );
          setBuffering(false);
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setBuffering(false);
          setPlaying(false);
          setError(describeVoicePlaybackError(err));
        });
      return;
    }
    setPlaying(false);
    setError('Unable to play this voice message. Check your connection and try again.');
  }, [info]);

  const value = useMemo<VoiceMessagePlayerCtx>(() => ({
    messageId: info?.messageId ?? null,
    conversationId: info?.conversationId ?? null,
    conversationTitle: info?.conversationTitle ?? null,
    senderName: info?.senderName ?? null,
    playing,
    buffering,
    positionMs,
    durationMs,
    speed,
    error,
    isActive,
    play,
    togglePlay,
    cycleSpeed,
    stop,
  }), [info, playing, buffering, positionMs, durationMs, speed, error, isActive, play, togglePlay, cycleSpeed, stop]);

  return (
    <VoiceMessagePlayerContext.Provider value={value}>
      {children}
      {info?.source ? (
        <Video
          ref={videoRef}
          source={info.source}
          paused={!playing}
          rate={speed}
          volume={1}
          muted={false}
          controls={false}
          audioOutput="speaker"
          ignoreSilentSwitch="ignore"
          mixWithOthers="duck"
          // The entire point of this element: keep decoding/outputting audio
          // while the app is backgrounded or the user is on a different
          // screen — the opposite of MessageBubble's own hiddenVoicePlayer,
          // which only ever needed to survive while that bubble was mounted.
          playInBackground
          playWhenInactive
          progressUpdateInterval={100}
          onLoad={({ duration }) => {
            const ms = Math.max(0, Number(duration || 0) * 1000);
            if (ms > 0) setDurationMs(ms);
            setBuffering(false);
          }}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onProgress={({ currentTime }) => {
            setPositionMs(Math.max(0, Number(currentTime || 0) * 1000));
            setBuffering(false);
          }}
          onEnd={() => {
            setPlaying(false);
            setPositionMs(0);
            videoRef.current?.seek(0);
          }}
          onError={handleError}
          style={styles.hidden}
        />
      ) : null}
    </VoiceMessagePlayerContext.Provider>
  );
}

const styles = {
  // Zero-size and non-interactive — this element only exists for its audio
  // output, same convention as MessageBubble's own hiddenVoicePlayer style.
  hidden: { width: 0, height: 0 },
} as const;

export const useVoiceMessagePlayer = () => useContext(VoiceMessagePlayerContext);
