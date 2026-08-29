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
import VideoProgressBar from './components/VideoProgressBar';
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
  // When true, renders VideoProgressBar (just the drag-to-any-position
  // scrubber) instead of the full VideoControls panel - for full-bleed
  // reels/shorts-style viewers that already have their own caption text and
  // action-button column occupying the bottom of the screen, where
  // VideoControls' full panel (time text, settings/captions/pip/fullscreen
  // row, play/pause, mute, speed) visually collides with that existing
  // chrome rather than adding anything a vertical short-form video needs.
  // Has no effect when showControls is false.
  progressBarOnly?: boolean;
  // Positions the progress bar in progressBarOnly mode - callers place it
  // wherever it clears their own bottom UI (VideoControls' own bottom:12
  // default only makes sense for an inline card player).
  progressBarStyle?: StyleProp<ViewStyle>;
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
  // Fires on a double tap in the middle zone (the same zone that toggles
  // play/pause on a single tap - see handleMiddleTap) instead of anything
  // internal to this component. For a caller like ShortsScreen that wraps
  // this whole player in its own outer Pressable for a double-tap-to-like
  // gesture: that outer Pressable's onPress never fires once the tap zones
  // below became real Pressables of their own (nested Pressables give the
  // touch to the innermost one), so without a way to route a double tap
  // back out, restoring play/pause here would have silently broken that
  // gesture instead of just moving where it's wired from.
  onDoubleTapMiddle?: () => void;
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
  progressBarOnly = false,
  progressBarStyle,
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
  onDoubleTapMiddle,
  chapters,
  forceTextureView = false,
  externalPause = false,
}: VideoPlayerProps) {
  const { palette } = useKISTheme();
  // See containerAspectFallback's comment above `styles` - only fall back to
  // a fixed 16:9 aspect ratio when the caller's own containerStyle doesn't
  // already establish real sizing itself (explicit height, or absolute
  // positioning - which every full-screen/reels-style caller in this app
  // uses via StyleSheet.absoluteFillObject with no height of its own).
  const hasOwnSizing = useMemo(() => {
    const flat = StyleSheet.flatten(containerStyle) || {};
    return flat.height != null || flat.position === 'absolute';
  }, [containerStyle]);
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
  // Also mirrored into state (readyForDisplay, not just the ref below) so
  // the loading indicator can stay up for the FULL gap until a real frame
  // renders, not just until onLoad. Without this, a video with no poster
  // (poster is optional/frequently absent on user-generated shorts/reels
  // content) would drop the indicator the instant metadata resolved — the
  // exact moment state.loading flips false — and briefly show this
  // component's own #000 container background with nothing overlaid on it,
  // even on a completely healthy load that renders its first frame a beat
  // later. The ref stays too: the dev-only diagnostic timeout below still
  // needs to read the latest value without a stale-closure risk, which a
  // plain state variable captured in that effect's closure wouldn't give it.
  const [readyForDisplay, setReadyForDisplayState] = useState(false);
  const readyForDisplayRef = useRef(false);
  const setReadyForDisplay = (value: boolean) => {
    readyForDisplayRef.current = value;
    setReadyForDisplayState(value);
  };

  const leftSeekAnim = useRef(new Animated.Value(0)).current;
  const rightSeekAnim = useRef(new Animated.Value(0)).current;
  const lastLeftTap = useRef(0);
  const lastRightTap = useRef(0);
  // Pending play/pause toggle from a tap on the left/right zone that
  // hasn't (yet) turned out to be the first half of a double-tap seek -
  // see handleLeftTap/handleRightTap below. Cleared instead of fired if a
  // second tap arrives in time.
  const pendingToggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pendingToggleTimer.current) clearTimeout(pendingToggleTimer.current);
  }, []);

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

  // A tap on either edge zone might be the whole gesture (play/pause, same
  // as tapping the middle) or the first half of a double-tap (seek
  // ±10s) - there's no way to know which until the double-tap window
  // passes, so the play/pause toggle is scheduled rather than fired
  // immediately, and cancelled if a second tap arrives in time to make it
  // a seek instead. The middle zone has no double-tap gesture of its own,
  // so it skips this entirely and toggles immediately - no reason to make
  // the common "tap to pause" case feel laggy where there's no ambiguity
  // to resolve.
  const handleLeftTap = () => {
    const now = Date.now();
    if (now - lastLeftTap.current < 300) {
      if (pendingToggleTimer.current) {
        clearTimeout(pendingToggleTimer.current);
        pendingToggleTimer.current = null;
      }
      actions.seekBackward10();
      Vibration.vibrate(15);
      flashOverlay(leftSeekAnim);
    } else {
      pendingToggleTimer.current = setTimeout(() => {
        pendingToggleTimer.current = null;
        actions.togglePlay();
      }, 300);
    }
    lastLeftTap.current = now;
  };

  const handleRightTap = () => {
    const now = Date.now();
    if (now - lastRightTap.current < 300) {
      if (pendingToggleTimer.current) {
        clearTimeout(pendingToggleTimer.current);
        pendingToggleTimer.current = null;
      }
      actions.seekForward10();
      Vibration.vibrate(15);
      flashOverlay(rightSeekAnim);
    } else {
      pendingToggleTimer.current = setTimeout(() => {
        pendingToggleTimer.current = null;
        actions.togglePlay();
      }, 300);
    }
    lastRightTap.current = now;
  };

  const lastMiddleTap = useRef(0);
  const handleMiddleTap = () => {
    const now = Date.now();
    if (onDoubleTapMiddle && now - lastMiddleTap.current < 300) {
      lastMiddleTap.current = 0; // consumed - a third tap starts fresh, doesn't chain
      onDoubleTapMiddle();
      return;
    }
    lastMiddleTap.current = now;
    if (!onDoubleTapMiddle) {
      // No double-tap gesture registered for this zone, so there's nothing
      // to disambiguate - toggle immediately (see this function's usage
      // above for why left/right can't do the same).
      actions.togglePlay();
      return;
    }
    pendingToggleTimer.current = setTimeout(() => {
      pendingToggleTimer.current = null;
      actions.togglePlay();
    }, 300);
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
      style={[styles.container, !hasOwnSizing && styles.containerAspectFallback, containerStyle]}
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
        // Android only (react-native-video ignores this on iOS - AVPlayer
        // has no equivalent knob and doesn't need one here). ExoPlayer's own
        // default DefaultLoadControl waits for a much larger initial buffer
        // before starting playback than a short-form vertical feed needs -
        // fine for a long sit-and-watch video, but it's the difference
        // between "tap and it's already playing" and a multi-second wait
        // for every short/reel/broadcast clip in this app. 1s is enough to
        // absorb a brief network hiccup right at start without stalling
        // immediately; minBufferMs/maxBufferMs stay close to ExoPlayer's own
        // defaults so steady-state playback quality and seek buffering are
        // unaffected - only the initial start threshold drops.
        bufferConfig={{
          minBufferMs: 5000,
          maxBufferMs: 30000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 2000,
        }}
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
      {/* Stays up through the FULL gap until a real frame renders
          (readyForDisplay), not just until state.loading clears on onLoad -
          see readyForDisplay's declaration above for why that distinction
          matters whenever there's no poster to fall back on visually. */}
      {!readyForDisplay && !state.error ? (
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
      {/* Tap zones — sits below controls in z-order. Left/right: single tap
          toggles play/pause (delayed - see handleLeftTap/handleRightTap),
          double tap seeks ±10s. Middle: single tap toggles play/pause
          immediately, no double-tap gesture of its own. */}
      {!state.error && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', flex: 1 }}>
            <Pressable style={{ flex: 0.3, height: '100%' }} onPress={handleLeftTap} />
            <Pressable style={{ flex: 0.4, height: '100%' }} onPress={handleMiddleTap} />
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
        progressBarOnly ? (
          <VideoProgressBar
            state={state}
            actions={actions}
            onSeekComplete={actions.seekTo}
            style={progressBarStyle}
          />
        ) : (
          <VideoControls
            state={state}
            actions={actions}
            onSeekComplete={actions.seekTo}
            onFullScreenPress={allowFullScreen ? onFullScreenPress : undefined}
            chapters={chapters}
            enablePip={enablePip || pictureInPicture}
            onPipPress={handlePipPress}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  // Fallback height for simple embeds that only give this component a
  // width (e.g. `containerStyle={{ width: '100%', borderRadius: 18 }}`) and
  // expect a sensible 16:9 box in return. Applied conditionally - see
  // `hasOwnSizing` below - and MUST be a separate style object from
  // `container` above, not a merged-in property on it: a caller whose own
  // containerStyle already establishes real sizing (explicit height, or
  // `position: absolute` with all four edges pinned, e.g. every full-screen
  // reels/shorts-style video viewer in this app) still gets this same
  // `container` object merged in ahead of their own style in the array, and
  // Yoga's behavior when a node has BOTH aspectRatio AND fully-pinned
  // absolute edges is a documented cross-platform inconsistency - the
  // computed box can silently collapse or mis-size on Android. That's a
  // plausible, layout-only explanation for the "audio plays, no picture"
  // class of bug distinct from the SurfaceView-under-transform one
  // documented elsewhere in this file: the video is decoding and playing
  // completely normally, its container is just sized wrong (e.g. 0 height),
  // so there is nothing to see - the container's own #000 background is all
  // that's visible, reading exactly like "a dark box over it".
  containerAspectFallback: {
    aspectRatio: 16 / 9,
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
