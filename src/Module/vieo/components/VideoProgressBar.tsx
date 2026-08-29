// src/Module/vieo/components/VideoProgressBar.tsx
//
// The scrubber half of VideoControls.tsx, on its own - for full-screen
// reels/shorts-style viewers (ShortsScreen, BroadcastDetailScreen), which
// already have their own caption text and like/comment/share column
// occupying the bottom of the screen. VideoControls' full panel (time text,
// settings/captions/pip/fullscreen row, play/pause, mute, speed button) is
// built for an inline card player, not a full-bleed vertical video, and
// visually collides with that existing bottom chrome there. This is just
// the piece those screens actually asked for - drag-to-any-position,
// still-visible progress - positioned however the caller needs via `style`.
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';
import { useKISTheme } from '@/theme/useTheme';
import type { VideoPlayerActions, VideoPlayerState } from '../hooks/useVideoPlayer';

export type VideoProgressBarProps = {
  state: VideoPlayerState;
  actions: VideoPlayerActions;
  onSeekComplete?: (value: number) => void;
  style?: StyleProp<ViewStyle>;
};

export default function VideoProgressBar({ state, actions, onSeekComplete, style }: VideoProgressBarProps) {
  const { palette } = useKISTheme();
  const duration = Math.max(state.duration, 0.01);
  const normalizedProgress = Math.min(Math.max(state.progress, 0), duration);

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <Slider
        value={normalizedProgress}
        maximumValue={duration}
        minimumValue={0}
        style={styles.slider}
        thumbTintColor={palette.ivory}
        minimumTrackTintColor={palette.ivory}
        maximumTrackTintColor="rgba(255,255,255,0.35)"
        onValueChange={(value) => actions.seekTo(value)}
        onSlidingComplete={(value) => onSeekComplete?.(value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 24,
  },
});
