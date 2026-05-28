import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { formatVideoTime } from '../utils';
import type { VideoPlayerActions, VideoPlayerState } from '../hooks/useVideoPlayer';
import type { ChannelContentChapter } from '@/screens/broadcast/channels/api/channels.types';

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export type VideoControlsProps = {
  state: VideoPlayerState;
  actions: VideoPlayerActions;
  onFullScreenPress?: () => void;
  onSeekComplete?: (value: number) => void;
  chapters?: ChannelContentChapter[];
};

export default function VideoControls({ state, actions, onFullScreenPress, onSeekComplete, chapters }: VideoControlsProps) {
  const { palette } = useKISTheme();
  const duration = Math.max(state.duration, 0.01);
  const normalizedProgress = Math.min(Math.max(state.progress, 0), duration);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [ccSize, setCcSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [ccBg, setCcBg] = useState<'none' | 'semi' | 'full'>('semi');

  const ccFontSize = ccSize === 'small' ? 12 : ccSize === 'large' ? 19 : 15;
  const ccBgColor = ccBg === 'none' ? 'transparent' : ccBg === 'semi' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.92)';

  const currentChapter = useMemo(() => {
    if (!chapters?.length || duration <= 0) return null;
    const sorted = [...chapters].sort((a, b) => a.start_seconds - b.start_seconds);
    let found = sorted[0];
    for (const ch of sorted) {
      if (normalizedProgress >= ch.start_seconds) found = ch;
      else break;
    }
    return found ?? null;
  }, [chapters, normalizedProgress, duration]);

  const cycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(state.speed);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    actions.setSpeed(next);
  };

  const speedLabel = state.speed === 1 ? '1×' : `${state.speed}×`;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.topRow}>
        <Text style={[styles.timeText, { color: palette.ivory ?? '#fff' }]}>
          {formatVideoTime(normalizedProgress)} / {formatVideoTime(duration)}
        </Text>
        <View style={styles.topActions}>
          {state.availableQualities.length > 0 && (
            <Pressable onPress={() => setQualityOpen(true)} style={styles.iconHitArea}>
              <KISIcon name="settings" size={16} color={palette.ivory ?? '#fff'} />
            </Pressable>
          )}
          {state.availableCaptions.length > 0 && (
            <Pressable
              onPress={() => {
                if (state.availableCaptions.length > 1) {
                  setCaptionsOpen(true);
                } else {
                  actions.setCaptionsEnabled(!state.captionsEnabled);
                }
              }}
              style={[styles.iconHitArea, state.captionsEnabled && styles.activeButton]}
            >
              <KISIcon name="list" size={16} color={state.captionsEnabled ? (palette.primaryStrong ?? '#f59e0b') : (palette.ivory ?? '#fff')} />
            </Pressable>
          )}
          {onFullScreenPress ? (
            <Pressable onPress={onFullScreenPress} style={styles.iconHitArea}>
              <KISIcon name="fullscreen" size={18} color={palette.ivory ?? '#fff'} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {currentChapter ? (
        <Text style={styles.chapterLabel} numberOfLines={1}>{currentChapter.title}</Text>
      ) : null}

      <View style={styles.sliderWrap}>
        <Slider
          value={normalizedProgress}
          maximumValue={duration}
          minimumValue={0}
          style={styles.slider}
          thumbTintColor={palette.primaryStrong}
          minimumTrackTintColor={palette.primaryStrong}
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          onValueChange={(value) => actions.seekTo(value)}
          onSlidingComplete={(value) => onSeekComplete?.(value)}
        />
        {chapters && duration > 0 && chapters.map(ch => (
          <View
            key={ch.id}
            pointerEvents="none"
            style={[
              styles.chapterMarker,
              { left: `${Math.min(100, (ch.start_seconds / duration) * 100)}%` as any },
            ]}
          />
        ))}
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <Pressable onPress={actions.togglePlay} style={styles.iconHitArea}>
            <KISIcon name={state.playing ? 'pause' : 'play'} size={24} color={palette.ivory ?? '#fff'} />
          </Pressable>
          <Pressable onPress={() => actions.setMuted(!state.muted)} style={styles.iconHitArea}>
            <KISIcon name={state.muted ? 'mute' : 'volume'} size={20} color={palette.ivory ?? '#fff'} />
          </Pressable>
          {state.isBuffering ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Buffering…</Text>
          ) : null}
        </View>
        <Pressable onPress={cycleSpeed} style={[styles.speedButton, { borderColor: 'rgba(255,255,255,0.5)' }]}>
          <Text style={[styles.speedLabel, { color: palette.ivory ?? '#fff' }]}>{speedLabel}</Text>
        </Pressable>
      </View>

      {/* Quality picker modal */}
      <Modal visible={qualityOpen} transparent animationType="fade" onRequestClose={() => setQualityOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setQualityOpen(false)}>
          <View style={[styles.pickerBox, { backgroundColor: palette.card ?? palette.surface }]}>
            <Text style={[styles.pickerTitle, { color: palette.text }]}>Video quality</Text>
            {['Auto', ...state.availableQualities].map((q) => (
              <Pressable
                key={q}
                onPress={() => { actions.setSelectedQuality(q === 'Auto' ? null : q); setQualityOpen(false); }}
                style={[styles.pickerItem, (state.selectedQuality === q || (q === 'Auto' && !state.selectedQuality)) && { backgroundColor: palette.primaryStrong + '22' }]}
              >
                <Text style={[styles.pickerItemText, { color: palette.text }]}>{q}</Text>
                {(state.selectedQuality === q || (q === 'Auto' && !state.selectedQuality)) && (
                  <KISIcon name="check" size={16} color={palette.primaryStrong} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Captions picker modal */}
      <Modal visible={captionsOpen} transparent animationType="fade" onRequestClose={() => setCaptionsOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCaptionsOpen(false)}>
          <View style={[styles.pickerBox, { backgroundColor: palette.card ?? palette.surface }]}>
            <Text style={[styles.pickerTitle, { color: palette.text }]}>Subtitles / CC</Text>
            <Pressable
              onPress={() => { actions.setCaptionsEnabled(false); setCaptionsOpen(false); }}
              style={[styles.pickerItem, !state.captionsEnabled && { backgroundColor: palette.primaryStrong + '22' }]}
            >
              <Text style={[styles.pickerItemText, { color: palette.text }]}>Off</Text>
              {!state.captionsEnabled && <KISIcon name="check" size={16} color={palette.primaryStrong} />}
            </Pressable>
            {state.availableCaptions.map((c) => (
              <Pressable
                key={c}
                onPress={() => { actions.setCaptionsEnabled(true); setCaptionsOpen(false); }}
                style={[styles.pickerItem, state.captionsEnabled && { backgroundColor: palette.primaryStrong + '22' }]}
              >
                <Text style={[styles.pickerItemText, { color: palette.text }]}>{c}</Text>
                {state.captionsEnabled && <KISIcon name="check" size={16} color={palette.primaryStrong} />}
              </Pressable>
            ))}

            {/* CC Style section */}
            <View style={[styles.pickerItem, { flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: palette.border ?? 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.pickerTitle, { color: palette.text, paddingHorizontal: 0, paddingVertical: 4, fontSize: 12 }]}>Caption size</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['small', 'medium', 'large'] as const).map(s => (
                  <Pressable
                    key={s}
                    onPress={() => setCcSize(s)}
                    style={[styles.ccPill, { borderColor: ccSize === s ? palette.primaryStrong : palette.border ?? '#555', backgroundColor: ccSize === s ? palette.primaryStrong + '22' : 'transparent' }]}
                  >
                    <Text style={{ color: ccSize === s ? palette.primaryStrong : palette.text, fontWeight: '700', fontSize: 11, textTransform: 'capitalize' }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.pickerTitle, { color: palette.text, paddingHorizontal: 0, paddingVertical: 4, fontSize: 12 }]}>Caption background</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['none', 'semi', 'full'] as const).map(b => (
                  <Pressable
                    key={b}
                    onPress={() => setCcBg(b)}
                    style={[styles.ccPill, { borderColor: ccBg === b ? palette.primaryStrong : palette.border ?? '#555', backgroundColor: ccBg === b ? palette.primaryStrong + '22' : 'transparent' }]}
                  >
                    <Text style={{ color: ccBg === b ? palette.primaryStrong : palette.text, fontWeight: '700', fontSize: 11, textTransform: 'capitalize' }}>{b}</Text>
                  </Pressable>
                ))}
              </View>
              {/* Preview */}
              <View style={{ alignSelf: 'stretch', backgroundColor: ccBgColor, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: ccFontSize, fontWeight: '700' }}>Caption preview text</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chapterLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  sliderWrap: {
    position: 'relative',
  },
  slider: {
    width: '100%',
    height: 24,
  },
  chapterMarker: {
    position: 'absolute',
    top: 10,
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginLeft: -1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHitArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  activeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  speedButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  speedLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBox: {
    width: 260,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ccPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
