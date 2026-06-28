import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { OnLoadData, OnProgressData } from 'react-native-video';

export type VideoPlayerState = {
  playing: boolean;
  loading: boolean;
  duration: number;
  progress: number;
  buffered: number;
  isBuffering: boolean;
  error: string | null;
  muted: boolean;
  speed: number;
  availableQualities: string[];
  selectedQuality: string | null;
  captionsEnabled: boolean;
  availableCaptions: string[];
};

type UseVideoPlayerConfig = {
  autoPlay?: boolean;
  loop?: boolean;
  initialMuted?: boolean;
};

export type VideoPlayerActions = {
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  seekForward10: () => void;
  seekBackward10: () => void;
  setMuted: (value: boolean) => void;
  setSpeed: (value: number) => void;
  setSelectedQuality: (quality: string | null) => void;
  setCaptionsEnabled: (enabled: boolean) => void;
};

export type VideoPlayerHandlers = {
  onLoad: (data: OnLoadData) => void;
  onProgress: (data: OnProgressData) => void;
  onBuffer: ({ isBuffering }: { isBuffering: boolean }) => void;
  onError: (error: any) => void;
  onEnd: () => void;
};

export const useVideoPlayer = (config: UseVideoPlayerConfig = {}) => {
  const { autoPlay = false, loop = false, initialMuted = false } = config;
  const videoRef = useRef<any>(null);
  const initialState = useMemo<VideoPlayerState>(() => ({
    playing: autoPlay,
    loading: true,
    duration: 0,
    progress: 0,
    buffered: 0,
    isBuffering: false,
    error: null,
    muted: initialMuted,
    speed: 1,
    availableQualities: [],
    selectedQuality: null,
    captionsEnabled: false,
    availableCaptions: [],
  }), [autoPlay, initialMuted]);
  const [state, setState] = useState<VideoPlayerState>(initialState);
  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const setPlaying = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, playing: value }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => {
      console.log('[KISVideo] togglePlay →', prev.playing ? 'paused' : 'playing');
      return { ...prev, playing: !prev.playing };
    });
  }, []);

  const play = useCallback(() => {
    console.log('[KISVideo] play');
    setPlaying(true);
  }, [setPlaying]);

  const pause = useCallback(() => {
    console.log('[KISVideo] pause');
    setPlaying(false);
  }, [setPlaying]);

  const progressRef = useRef(0);
  const durationRef = useRef(0);

  const seekTo = useCallback(
    (seconds: number) => {
      console.log('[KISVideo] seekTo', seconds.toFixed(2), 's');
      videoRef.current?.seek(seconds);
      progressRef.current = seconds;
      setState((prev) => ({ ...prev, progress: seconds }));
    },
    [],
  );

  const seekForward10 = useCallback(() => {
    const target = Math.min(progressRef.current + 10, durationRef.current);
    console.log('[KISVideo] seekForward10 →', target.toFixed(2), 's');
    seekTo(target);
  }, [seekTo]);

  const seekBackward10 = useCallback(() => {
    const target = Math.max(progressRef.current - 10, 0);
    console.log('[KISVideo] seekBackward10 →', target.toFixed(2), 's');
    seekTo(target);
  }, [seekTo]);

  const setMuted = useCallback((value: boolean) => {
    console.log('[KISVideo] setMuted', value);
    setState((prev) => ({ ...prev, muted: value }));
  }, []);

  const setSpeed = useCallback((value: number) => {
    setState((prev) => ({ ...prev, speed: value }));
  }, []);

  const setSelectedQuality = useCallback((quality: string | null) => {
    setState((prev) => ({ ...prev, selectedQuality: quality }));
  }, []);

  const setCaptionsEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, captionsEnabled: enabled }));
  }, []);

  const onLoad = useCallback((data: OnLoadData) => {
    console.debug('[KISVideo] onLoad', {
      duration: data.duration,
      naturalSize: data.naturalSize,
    });
    const videoTracks: string[] = Array.isArray((data as any).videoTracks)
      ? (data as any).videoTracks.map((t: any) => t.bitrate ? `${Math.round(t.bitrate / 1000)}kbps` : t.title || String(t.height || '')).filter(Boolean)
      : [];
    const textTracks: string[] = Array.isArray((data as any).textTracks)
      ? (data as any).textTracks.map((t: any) => t.title || t.language || '').filter(Boolean)
      : [];
    durationRef.current = data.duration ?? 0;
    setState((prev) => ({
      ...prev,
      duration: data.duration ?? prev.duration,
      loading: false,
      error: null,
      availableQualities: videoTracks,
      availableCaptions: textTracks,
    }));
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    console.debug('[KISVideo] onProgress', {
      currentTime: data.currentTime,
      playableDuration: data.playableDuration,
    });
    progressRef.current = data.currentTime;
    setState((prev) => ({
      ...prev,
      progress: data.currentTime,
      buffered: data.playableDuration,
    }));
  }, []);

  const onBuffer = useCallback(({ isBuffering }: { isBuffering: boolean }) => {
    console.debug('[KISVideo] onBuffer', { isBuffering });
    setState((prev) => ({ ...prev, isBuffering }));
  }, []);

  const onError = useCallback((error: any) => {
    try {
      console.error('[KISVideo] onError', JSON.stringify(error));
    } catch {
      console.error('[KISVideo] onError', error);
    }
    const messagePayload =
      error?.error ?? error?.message ?? error ?? null;
    const errorMessage =
      typeof messagePayload === 'string'
        ? messagePayload
        : messagePayload && typeof messagePayload === 'object'
        ? messagePayload.localizedDescription ??
          messagePayload.localizedFailureReason ??
          messagePayload.localizedRecoverySuggestion ??
          messagePayload.message ??
          messagePayload.error ??
          JSON.stringify(messagePayload)
        : 'Playback error';
    setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  const onEnd = useCallback(() => {
    console.debug('[KISVideo] onEnd');
    if (loop) {
      seekTo(0);
      play();
      return;
    }
    setState((prev) => ({ ...prev, playing: false }));
  }, [loop, play, seekTo]);

  const reset = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  const handlers = useMemo<VideoPlayerHandlers>(() => ({ onLoad, onProgress, onBuffer, onError, onEnd }), [onBuffer, onEnd, onError, onLoad, onProgress]);

  const actions = useMemo<VideoPlayerActions>(() => ({ togglePlay, play, pause, seekTo, seekForward10, seekBackward10, setMuted, setSpeed, setSelectedQuality, setCaptionsEnabled }), [pause, play, seekTo, seekForward10, seekBackward10, setMuted, setSpeed, setSelectedQuality, setCaptionsEnabled, togglePlay]);

  return {
    reset,
    videoRef: videoRef as RefObject<any>,
    state,
    actions,
    handlers,
  };
};
