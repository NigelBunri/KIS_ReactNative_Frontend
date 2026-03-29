import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { formatVideoTime } from '../utils';
import type { VideoPlayerActions, VideoPlayerState } from '../hooks/useVideoPlayer';

export type VideoControlsProps = {
  state: VideoPlayerState;
  actions: VideoPlayerActions;
  onFullScreenPress?: () => void;
  onSeekComplete?: (value: number) => void;
};

export default function VideoControls({ state, actions, onFullScreenPress, onSeekComplete }: VideoControlsProps) {
  const { palette } = useKISTheme();
  const duration = Math.max(state.duration, 0.01);
  const normalizedProgress = Math.min(Math.max(state.progress, 0), duration);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.topRow}>
        <Text style={[styles.timeText, { color: palette.text }]}>
          {formatVideoTime(normalizedProgress)} / {formatVideoTime(duration)}
        </Text>
        {onFullScreenPress ? (
          <Pressable onPress={onFullScreenPress} style={styles.iconHitArea}>
            <KISIcon name="fullscreen" size={18} color={palette.text} />
          </Pressable>
        ) : null}
      </View>

      <Slider
        value={normalizedProgress}
        maximumValue={duration}
        minimumValue={0}
        style={styles.slider}
        thumbTintColor={palette.primaryStrong}
        minimumTrackTintColor={palette.primaryStrong}
        maximumTrackTintColor={palette.surface}
        onValueChange={(value) => actions.seekTo(value)}
        onSlidingComplete={(value) => onSeekComplete?.(value)}
      />

      <View style={styles.actionsRow}>
        <Pressable onPress={actions.togglePlay} style={styles.iconHitArea}>
          <KISIcon name={state.playing ? 'pause' : 'play'} size={24} color={palette.text} />
        </Pressable>
        <Pressable onPress={() => actions.setMuted(!state.muted)} style={styles.iconHitArea}>
          <KISIcon name={state.muted ? 'mute' : 'volume'} size={20} color={palette.text} />
          <Text style={[styles.muteLabel, { color: palette.subtext }]}>
            {state.muted ? 'Muted' : 'Live sound'}
          </Text>
        </Pressable>
        {state.isBuffering ? <Text style={{ color: palette.subtext }}>Buffering…</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    marginHorizontal: 12,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  iconHitArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  muteLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
});
