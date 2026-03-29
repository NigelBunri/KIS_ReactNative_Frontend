import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Video from 'react-native-video';
import { useKISTheme } from '@/theme/useTheme';
import VideoControls from './components/VideoControls';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { normalizeVideoUrl } from './utils';

export type VideoPlayerProps = {
  sourceUrl: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  allowFullScreen?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  videoStyle?: StyleProp<any>;
  onFullScreenPress?: () => void;
  onReady?: () => void;
  onError?: (message: string | null) => void;
  onEnd?: () => void;
};

export default function VideoPlayer({
  sourceUrl,
  poster,
  autoPlay = false,
  loop = false,
  muted = false,
  showControls = true,
  allowFullScreen = false,
  containerStyle,
  videoStyle,
  onFullScreenPress,
  onReady,
  onError,
  onEnd,
}: VideoPlayerProps) {
  const { palette } = useKISTheme();
  const safeUrl = useMemo(() => normalizeVideoUrl(sourceUrl), [sourceUrl]);
  const [showPoster, setShowPoster] = useState(true);
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

  const handleRetry = () => {
    reset();
    setShowPoster(true);
    console.debug('[KISVideo] retrying playback');
    actions.play();
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
        repeat={loop}
        controls={false}
        onLoad={(data) => {
          console.debug('[KISVideo] onLoad firing', data.duration);
          handlers.onLoad(data);
          handleReady();
        }}
        onProgress={handlers.onProgress}
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
      {showControls && !state.error && (
        <VideoControls
          state={state}
          actions={actions}
          onSeekComplete={actions.seekTo}
          onFullScreenPress={allowFullScreen ? onFullScreenPress : undefined}
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
    borderColor: '#ccc',
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
});
