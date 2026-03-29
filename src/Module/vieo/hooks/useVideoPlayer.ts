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
  setMuted: (value: boolean) => void;
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
  }), [autoPlay, initialMuted]);
  const [state, setState] = useState<VideoPlayerState>(initialState);
  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const setPlaying = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, playing: value }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => ({ ...prev, playing: !prev.playing }));
  }, []);

  const play = useCallback(() => setPlaying(true), [setPlaying]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);

  const seekTo = useCallback(
    (seconds: number) => {
      videoRef.current?.seek(seconds);
      setState((prev) => ({ ...prev, progress: seconds }));
    },
    [],
  );

  const setMuted = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, muted: value }));
  }, []);

  const onLoad = useCallback((data: OnLoadData) => {
    console.debug('[KISVideo] onLoad', {
      duration: data.duration,
      naturalSize: data.naturalSize,
    });
    setState((prev) => ({
      ...prev,
      duration: data.duration ?? prev.duration,
      loading: false,
      error: null,
    }));
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    console.debug('[KISVideo] onProgress', {
      currentTime: data.currentTime,
      playableDuration: data.playableDuration,
    });
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
    console.error('[KISVideo] onError', error);
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

  const actions = useMemo<VideoPlayerActions>(() => ({ togglePlay, play, pause, seekTo, setMuted }), [pause, play, seekTo, setMuted, togglePlay]);

  return {
    reset,
    videoRef: videoRef as RefObject<any>,
    state,
    actions,
    handlers,
  };
};
