// src/components/Bible/discipleship/DiscipleshipReadAloudSheet.tsx
//
// "Listen" mini player for a single Discipleship day's reading - same
// on-device TTS engine and transport UX as BibleReadAloudSheet.tsx, just
// trimmed down for a single short passage instead of a multi-hour,
// cross-chapter Bible read-through: no voice picker, no max-duration cap
// (both only earn their keep over a much longer, open-ended listen).
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { BibleReadAloudStatus, BibleReadAloudFinishReason } from '@/screens/tabs/bible/useBibleReadAloud';

const SPEED_PRESETS = [0.75, 1, 1.25, 1.5];

const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  status: BibleReadAloudStatus;
  finishReason: BibleReadAloudFinishReason;
  dayTitle: string;
  elapsedMs: number;
  ttsReady: boolean;
  errorMessage: string | null;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSetSpeed: (multiplier: number) => void;
};

export default function DiscipleshipReadAloudSheet({
  visible,
  onClose,
  status,
  finishReason,
  dayTitle,
  elapsedMs,
  ttsReady,
  errorMessage,
  speed,
  onPlay,
  onPause,
  onStop,
  onSetSpeed,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const solidBg = palette.bg || palette.surface || '#FFFFFF';

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isLoading = status === 'loading';
  const canPlay = ttsReady && !isPlaying && !isLoading;
  const canStop = status !== 'idle';

  const statusLabel = () => {
    if (!ttsReady) return errorMessage || 'Text-to-speech is unavailable on this device.';
    if (status === 'playing') return `Reading "${dayTitle}"`;
    if (status === 'paused') return 'Paused';
    if (status === 'finished') {
      return finishReason === 'completed' ? "You've reached the end of this reading." : 'Reading stopped.';
    }
    return 'Ready to read this passage aloud.';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: solidBg,
              borderColor: palette.divider,
              paddingHorizontal: compact ? 12 : 16,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>Listen</Text>
              <Text style={{ color: palette.subtext, marginTop: 3 }} numberOfLines={1}>
                {dayTitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.iconButton, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          <View style={[styles.playerCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '800' }}>{statusLabel()}</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', marginTop: 8 }}>
              {formatClock(elapsedMs)} elapsed
            </Text>

            <View style={styles.transportRow}>
              <Pressable
                onPress={onStop}
                disabled={!canStop}
                style={[
                  styles.transportBtn,
                  { backgroundColor: palette.surface, borderColor: palette.divider, opacity: canStop ? 1 : 0.4 },
                ]}
              >
                <KISIcon name="stop" size={20} color={palette.text} />
              </Pressable>
              <Pressable
                onPress={isPlaying ? onPause : onPlay}
                disabled={!canPlay && !isPlaying}
                style={[
                  styles.transportBtnPrimary,
                  { backgroundColor: palette.goldDeep, borderColor: palette.goldLight, opacity: canPlay || isPlaying ? 1 : 0.4 },
                ]}
              >
                <KISIcon name={isPlaying ? 'pause' : 'play'} size={26} color={palette.ivory} />
              </Pressable>
              <View style={styles.transportBtn} />
            </View>
            {isPaused ? (
              <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 4 }}>
                Paused — tap play to continue from here.
              </Text>
            ) : null}
          </View>

          <View style={styles.group}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Speed</Text>
            <View style={styles.chipRow}>
              {SPEED_PRESETS.map(preset => {
                const active = speed === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => onSetSpeed(preset)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? palette.primarySoft : palette.surface,
                        borderColor: active ? palette.primaryStrong : palette.divider,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800' }}>
                      {preset}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,120,0.4)',
    marginBottom: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 18, fontWeight: '900' },
  iconButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  playerCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14 },
  transportBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  transportBtnPrimary: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  group: {},
  sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
});
