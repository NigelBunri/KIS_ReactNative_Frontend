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
import Video, { SelectedVideoTrackType, SelectedTrackType } from 'react-native-video';
import { useKISTheme } from '@/theme/useTheme';
import VideoControls from './components/VideoControls';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { normalizeVideoUrl } from './utils';
import type { ChannelContentChapter } from '@/screens/broadcast/channels/api/channels.types';

export type VideoPlayerProps = {
  sourceUrl: string;
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
};

export default function VideoPlayer({
  sourceUrl,
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
}: VideoPlayerProps) {
  const { palette } = useKISTheme();
  const safeUrl = useMemo(() => normalizeVideoUrl(sourceUrl), [sourceUrl]);
  const [showPoster, setShowPoster] = useState(true);

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

  useEffect(() => {
    if (state.error) {
      onError?.(state.error);
    }
  }, [onError, state.error]);

  const handleReady = () => {
    setShowPoster(false);
    onReady?.();
  };

  const handlePipPress = () => {
    try {
      (videoRef as any).current?.enterPictureInPicture?.();
    } catch {}
  };

  const handleRetry = () => {
    reset();
    setShowPoster(true);
    console.debug('[KISVideo] retrying playback');
    actions.play();
  };

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
    console.warn('[KISVideo] invalid URL', sourceUrl);
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
    <View style={[styles.container, containerStyle]}>
      <Video
        ref={videoRef}
        source={{ uri: safeUrl }}
        style={[styles.video, videoStyle]}
        poster={poster}
        posterResizeMode="cover"
        resizeMode="contain"
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
          console.error('[KISVideo] onError prop', err);
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
