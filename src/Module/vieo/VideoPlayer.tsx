import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Video, { SelectedVideoTrackType, SelectedTrackType, ViewType } from 'react-native-video';
import { useKISTheme } from '@/theme/useTheme';
import VideoControls from './components/VideoControls';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { normalizeVideoUrl } from './utils';
import type { ChannelContentChapter } from '@/screens/broadcast/channels/api/channels.types';
import type { MediaHeaders } from '@/network';
import { redactUrlForLogging } from './urlRedaction';

export type VideoPlayerProps = {
  sourceUrl: string;
  sourceHeaders?: MediaHeaders;
  sourceType?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  allowFullScreen?: boolean;
  pictureInPicture?: boolean;
  enablePip?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  videoStyle?: StyleProp<any>;
  onFullScreenPress?: () => void;
  onReady?: () => void;
  onError?: (message: string | null) => void;
  onEnd?: () => void;
  onProgress?: (currentTime: number) => void;
  chapters?: ChannelContentChapter[];
  // Android renders <Video> through a SurfaceView by default, which has
  // its own separate rendering surface and reliably fails to composite
  // (audio plays, frame stays black) when an ancestor applies a transform.
  //
  // CONFIRMED INEFFECTIVE in the currently installed react-native-video
  // (6.18.0): its Android ExoPlayerView.kt#updateSurfaceView() is a literal
  // no-op —
  //   fun updateSurfaceView(viewType: Int) { // TODO: Implement... }
  // — so this prop reaches native code and does nothing there today. The
  // real fix for BroadcastDetailScreen's transform-under-SurfaceView bug is
  // NOT this prop; it's rendering the active full-screen page's position
  // with `top` instead of `transform` (see BroadcastDetailScreen.tsx's
  // swipeY/pageFrame comments). Kept (not removed) only because: it is
  // harmless (no-op, not broken) and correctly wired end-to-end, so it
  // would start working automatically for free if a future
  // react-native-video upgrade ever implements real surface-type
  // switching — do not treat setting this prop as a fix for a black/
  // invisible video on its own.
  forceTextureView?: boolean;
  // Forces playback off regardless of internal play/pause state — set this
  // from a caller-owned useIsFocused()/AppState check (see
  // BroadcastFeedVideoPreview.tsx/BroadcastDetailScreen.tsx) so a video
  // doesn't keep playing (audio bleeding through) after the screen loses
  // focus or the app backgrounds. Resumes automatically once cleared, but
  // only if playback was actually running at the moment it was forced off
  // — never resumes a video the user had already paused themselves.
  externalPause?: boolean;
};

export default function VideoPlayer({
  sourceUrl,
  sourceHeaders,
  sourceType,
  poster,
  autoPlay = false,
  loop = false,
  muted = false,
  showControls = true,
  allowFullScreen = false,
  pictureInPicture = false,
  enablePip = false,
  containerStyle,
  videoStyle,
  onFullScreenPress,
  onReady,
  onError,
  onEnd,
  onProgress: onProgressProp,
  chapters,
  forceTextureView = false,
  externalPause = false,
}: VideoPlayerProps) {
  const { palette } = useKISTheme();
  const safeUrl = useMemo(() => normalizeVideoUrl(sourceUrl), [sourceUrl]);
  const videoSource = useMemo(() => {
    if (!safeUrl) return undefined;
    const headers =
      sourceHeaders && Object.keys(sourceHeaders).length > 0
        ? sourceHeaders
        : undefined;
    const type = sourceType?.trim() || undefined;
    return {
      uri: safeUrl,
      ...(headers ? { headers } : {}),
      ...(type ? { type } : {}),
    };
  }, [safeUrl, sourceHeaders, sourceType]);

  useEffect(() => {
    if (!videoSource) return;
    console.log(
      '[VideoPlayer] source built',
      JSON.stringify({
        uri: redactUrlForLogging((videoSource as any).uri),
        type: (videoSource as any).type ?? null,
        hasHeaders: Boolean((videoSource as any).headers),
        autoPlay,
        loop,
        muted,
        // Confirms which Android rendering surface this instance actually
        // requested — see the swipeY comment in BroadcastDetailScreen.tsx
        // for why this alone doesn't fix a transform-under-SurfaceView
        // failure in the installed react-native-video version.
        androidSurface: forceTextureView ? 'TEXTURE (requested)' : 'SURFACE (default)',
      }),
    );
  }, [videoSource, autoPlay, loop, muted, forceTextureView]);
  const [showPoster, setShowPoster] = useState(true);
  // Poster visibility (and this readiness flag) is driven by
  // onReadyForDisplay — a real "first frame rendered" signal from
  // react-native-video — not onLoad. onLoad only means metadata/duration
  // resolved, which can fire even when the video track never actually
  // renders a frame (audio-plays-picture-black class of bugs, e.g. an
  // ancestor transform breaking Android SurfaceView compositing). Hiding
  // the poster on onLoad would incorrectly reveal a blank/black surface
  // before there's really a frame to show. Mirrored into a ref (in
  // addition to state) so the dev-only diagnostic timeout below can read
  // its latest value without a stale closure.
  // A ref (not state) is enough here: nothing renders off this value
  // directly — setShowPoster(false) in handleReadyForDisplay already
  // triggers the re-render that matters — and the diagnostic timeout below
  // needs to read the latest value without a stale-closure risk.
  const readyForDisplayRef = useRef(false);
  const setReadyForDisplay = (value: boolean) => {
    readyForDisplayRef.current = value;
  };

  const leftSeekAnim = useRef(new Animated.Value(0)).current;
  const rightSeekAnim = useRef(new Animated.Value(0)).current;
  const lastLeftTap = useRef(0);
  const lastRightTap = useRef(0);

  const flashOverlay = (anim: Animated.Value) => {
    anim.setValue(1);
    Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }).start();
  };

  const {
    videoRef,
    state,
    actions,
    handlers,
    reset,
  } = useVideoPlayer({ autoPlay, loop, initialMuted: muted });

  useEffect(() => {
    if (muted !== undefined) {
      actions.setMuted(muted);
    }
  }, [muted, actions]);

  // externalPause going true forces a pause and remembers whether playback
  // was actually running; going back to false resumes ONLY in that case —
  // never overrides a pause the user chose themselves.
  const resumeAfterExternalPauseRef = useRef(false);
  useEffect(() => {
    if (externalPause) {
      resumeAfterExternalPauseRef.current = state.playing;
      if (state.playing) actions.pause();
    } else if (resumeAfterExternalPauseRef.current) {
      resumeAfterExternalPauseRef.current = false;
      actions.play();
    }
    // Only re-run when externalPause itself flips — state.playing/actions
    // intentionally excluded so this doesn't re-fire on every play/pause
    // toggle the user makes while externalPause is false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPause]);

  useEffect(() => {
    console.log('[VideoPlayer] playing →', state.playing);
  }, [state.playing]);

  useEffect(() => {
    if (state.isBuffering) {
      console.log('[VideoPlayer] buffering started');
    } else if (!state.loading) {
      console.log('[VideoPlayer] buffering ended');
    }
  }, [state.isBuffering, state.loading]);

  useEffect(() => {
    if (state.error) {
      console.warn('[VideoPlayer] error propagated to parent', state.error);
      onError?.(state.error);
    }
  }, [onError, state.error]);

  const handleReady = () => {
    onReady?.();
  };

  const handleReadyForDisplay = () => {
    setReadyForDisplay(true);
    setShowPoster(false);
    if (__DEV__) {
      console.log('[VideoPlayer] onReadyForDisplay — first frame rendered', { sourceUrl: redactUrlForLogging(safeUrl) });
    }
  };

  const handlePipPress = () => {
    try {
      (videoRef as any).current?.enterPictureInPicture?.();
    } catch {}
  };

  const handleRetry = () => {
    reset();
    setShowPoster(true);
    setReadyForDisplay(false);
    console.debug('[KISVideo] retrying playback');
    actions.play();
  };

  // Dev-only diagnostic: onLoad firing without onReadyForDisplay following
  // within a few seconds means metadata resolved but no video frame ever
  // rendered — exactly the "audio plays, picture stays black" symptom, as
  // distinct from a genuine load/network failure (which fires onError).
  useEffect(() => {
    if (!__DEV__ || state.loading) return;
    const timer = setTimeout(() => {
      if (!readyForDisplayRef.current) {
        console.warn(
          '[VideoPlayer] onLoad fired but onReadyForDisplay never did within 4s — ' +
            'metadata resolved but no video frame ever rendered (audio-only symptom). ' +
            'Check container dimensions (onLayout log above) and whether an ' +
            'ancestor applies a transform to this player.',
          { sourceUrl: redactUrlForLogging(safeUrl), forceTextureView },
        );
      }
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loading]);

  const handleLeftTap = () => {
    const now = Date.now();
    if (now - lastLeftTap.current < 300) {
      actions.seekBackward10();
      Vibration.vibrate(15);
      flashOverlay(leftSeekAnim);
    }
    lastLeftTap.current = now;
  };

  const handleRightTap = () => {
    const now = Date.now();
    if (now - lastRightTap.current < 300) {
      actions.seekForward10();
      Vibration.vibrate(15);
      flashOverlay(rightSeekAnim);
    }
    lastRightTap.current = now;
  };

  if (!safeUrl) {
    console.warn('[KISVideo] invalid URL', redactUrlForLogging(sourceUrl));
    return (
      <View style={[styles.unavailableWrap, containerStyle]}>
        <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 6 }}>Invalid video source</Text>
        <Text style={{ color: palette.subtext, textAlign: 'center' }}>Only http/https media can be played safely.</Text>
        <Pressable
          onPress={() => sourceUrl && Linking.openURL(sourceUrl)}
          style={[styles.retryButton, { borderColor: palette.primaryStrong }]}
        >
          <Text style={{ color: palette.primaryStrong }}>Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={
        __DEV__
          ? (e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width === 0 || height === 0) {
                console.warn(
                  '[VideoPlayer] container measured zero size — the video ' +
                    'cannot be visible regardless of playback state',
                  { width, height, sourceUrl: redactUrlForLogging(safeUrl) },
                );
              } else {
                console.log('[VideoPlayer] container layout', { width, height });
              }
            }
          : undefined
      }
    >
      <Video
        ref={videoRef}
        source={videoSource}
        style={[styles.video, videoStyle]}
        poster={poster}
        posterResizeMode="cover"
        resizeMode="contain"
        viewType={forceTextureView ? ViewType.TEXTURE : undefined}
        onReadyForDisplay={handleReadyForDisplay}
        paused={!state.playing}
        muted={state.muted}
        rate={state.speed}
        repeat={loop}
        controls={false}
        enterPictureInPictureOnLeave={pictureInPicture}
        selectedVideoTrack={
          state.selectedQuality
            ? { type: SelectedVideoTrackType.RESOLUTION, value: parseInt(state.selectedQuality, 10) || 0 }
            : { type: SelectedVideoTrackType.AUTO }
        }
        selectedTextTrack={
          state.captionsEnabled && state.availableCaptions.length > 0
            ? { type: SelectedTrackType.INDEX, value: 0 }
            : { type: SelectedTrackType.DISABLED }
        }
        onLoad={(data) => {
          console.debug('[KISVideo] onLoad firing', data.duration);
          handlers.onLoad(data);
          handleReady();
        }}
        onProgress={(data) => {
          handlers.onProgress(data);
          onProgressProp?.(data.currentTime);
        }}
        onBuffer={handlers.onBuffer}
        onError={(err) => {
          console.warn('[KISVideo] playback error', {
            sourceUrl: redactUrlForLogging(safeUrl),
            hasHeaders: Boolean(videoSource?.headers),
            sourceType: (videoSource as any)?.type ?? null,
            error: err,
          });
          handlers.onError(err);
        }}
        onEnd={() => {
          handlers.onEnd();
          onEnd?.();
        }}
        progressUpdateInterval={250}
      />
      {poster && showPoster && !state.error && (
        <Image source={{ uri: poster }} style={[styles.poster, videoStyle]} resizeMode="cover" />
      )}
      {state.loading && !state.error ? (
        <View style={styles.indicator} pointerEvents="none">
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : null}
      {state.error ? (
        <View style={[styles.errorOverlay, { backgroundColor: palette.surface }]}> 
          <Text style={[styles.errorTitle, { color: palette.danger }]}>Playback error</Text>
          <Text style={{ color: palette.subtext, marginBottom: 12 }}>{state.error}</Text>
          <Pressable
            onPress={handleRetry}
            style={[styles.retryButton, { borderColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.primaryStrong }}>Retry playback</Text>
          </Pressable>
        </View>
      ) : null}
      {/* Double-tap seek zones — sits below controls in z-order */}
      {!state.error && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', flex: 1 }}>
            <Pressable style={{ flex: 0.3, height: '100%' }} onPress={handleLeftTap} />
            <View style={{ flex: 0.4 }} pointerEvents="none" />
            <Pressable style={{ flex: 0.3, height: '100%' }} onPress={handleRightTap} />
          </View>
        </View>
      )}

      {/* -10s overlay */}
      <Animated.View pointerEvents="none" style={[styles.seekOverlay, { left: 16, opacity: leftSeekAnim }]}>
        <View style={styles.seekBubble}><Text style={[styles.seekLabel, { color: palette.ivory }]}>-10s</Text></View>
      </Animated.View>

      {/* +10s overlay */}
      <Animated.View pointerEvents="none" style={[styles.seekOverlay, { right: 16, opacity: rightSeekAnim }]}>
        <View style={styles.seekBubble}><Text style={[styles.seekLabel, { color: palette.ivory }]}>+10s</Text></View>
      </Animated.View>

      {showControls && !state.error && (
        <VideoControls
          state={state}
          actions={actions}
          onSeekComplete={actions.seekTo}
          onFullScreenPress={allowFullScreen ? onFullScreenPress : undefined}
          chapters={chapters}
          enablePip={enablePip || pictureInPicture}
          onPipPress={handlePipPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  unavailableWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  seekOverlay: {
    position: 'absolute',
    top: '30%',
    zIndex: 20,
    pointerEvents: 'none',
  },
  seekBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekLabel: {
    fontWeight: '900',
    fontSize: 13,
  },
});
