// src/components/Bible/BibleReadAloudSheet.tsx
//
// The "Read aloud" mini player + settings sheet, opened from the header
// button next to Share/Reload in BibleReaderPanel. Play/Pause/Stop drive the
// device's own text-to-speech engine (via useBibleReadAloud); voice, speed,
// and max duration are configured here and persisted on-device.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import type { BibleReadAloudStatus, BibleReadAloudFinishReason, BibleReadAloudVoice } from '@/screens/tabs/bible/useBibleReadAloud';

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DURATION_PRESETS: Array<{ label: string; minutes: number | null }> = [
  { label: 'Off (whole Bible)', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  status: BibleReadAloudStatus;
  finishReason: BibleReadAloudFinishReason;
  currentVerseNumber: number | null;
  currentReference: string;
  elapsedMs: number;
  remainingMs: number | null;
  ttsReady: boolean;
  errorMessage: string | null;
  voices: BibleReadAloudVoice[];
  voicesLoading: boolean;
  selectedVoiceId: string | null;
  speed: number;
  maxDurationMinutes: number | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSetVoice: (voiceId: string) => void;
  onSetSpeed: (multiplier: number) => void;
  onSetMaxDurationMinutes: (minutes: number | null) => void;
};

export default function BibleReadAloudSheet({
  visible,
  onClose,
  status,
  finishReason,
  currentVerseNumber,
  currentReference,
  elapsedMs,
  remainingMs,
  ttsReady,
  errorMessage,
  voices,
  voicesLoading,
  selectedVoiceId,
  speed,
  maxDurationMinutes,
  onPlay,
  onPause,
  onStop,
  onSetVoice,
  onSetSpeed,
  onSetMaxDurationMinutes,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const solidBg = palette.bg || palette.surface || '#FFFFFF';
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  const voicesByLanguage = useMemo(() => {
    const map = new Map<string, BibleReadAloudVoice[]>();
    voices.forEach(voice => {
      const key = voice.language || 'Unknown';
      map.set(key, [...(map.get(key) ?? []), voice]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [voices]);

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

  const statusLabel = () => {
    if (!ttsReady) return errorMessage || 'Text-to-speech is unavailable on this device.';
    if (status === 'loading') return 'Loading the next chapter…';
    if (status === 'playing') return currentVerseNumber ? `Reading ${currentReference}:${currentVerseNumber}` : `Reading ${currentReference}`;
    if (status === 'paused') return currentVerseNumber ? `Paused at ${currentReference}:${currentVerseNumber}` : 'Paused';
    if (status === 'finished') {
      return finishReason === 'time-limit'
        ? "Time's up — reading stopped at your max duration."
        : "You've reached the end of the Bible. 🎉";
    }
    return 'Ready to read this passage aloud.';
  };

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isLoading = status === 'loading';
  const canPlay = ttsReady && !isPlaying && !isLoading;
  const canStop = status !== 'idle';

  const applyCustomMinutes = () => {
    const value = Number(customMinutesInput.replace(/[^\d]/g, ''));
    if (Number.isFinite(value) && value > 0) {
      onSetMaxDurationMinutes(value);
      setCustomMinutesInput('');
    }
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
              maxHeight: responsive.isLandscape && responsive.isTablet ? '88%' : '90%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]}>Read aloud</Text>
              <Text style={{ color: palette.subtext, marginTop: 3 }}>
                Let your device read Scripture to you — voice, speed, and a max reading time.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.iconButton, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* ── Player ─────────────────────────────────────────────────── */}
            <View style={[styles.playerCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontWeight: '800' }}>{statusLabel()}</Text>
              <View style={styles.timeRow}>
                <Text style={{ color: palette.subtext, fontWeight: '700' }}>{formatClock(elapsedMs)} elapsed</Text>
                {remainingMs !== null ? (
                  <Text style={{ color: palette.subtext, fontWeight: '700' }}>{formatClock(remainingMs)} left</Text>
                ) : (
                  <Text style={{ color: palette.subtext, fontWeight: '700' }}>No time limit</Text>
                )}
              </View>

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

            {/* ── Voice ──────────────────────────────────────────────────── */}
            <View style={styles.group}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Voice</Text>
              <Pressable
                onPress={() => setVoicePickerOpen(open => !open)}
                style={[styles.dropdownTrigger, { backgroundColor: palette.surface, borderColor: palette.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {selectedVoice?.name || selectedVoice?.id || 'Device default'}
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 2 }}>
                    {voicesLoading ? 'Loading voices…' : `${voices.length} voice${voices.length === 1 ? '' : 's'} installed`}
                  </Text>
                </View>
                <KISIcon name={voicePickerOpen ? 'chevron-down' : 'chevron-right'} size={18} color={palette.subtext} />
              </Pressable>
              {voicePickerOpen ? (
                <View style={[styles.dropdownMenu, { backgroundColor: solidBg, borderColor: palette.divider }]}>
                  {voicesByLanguage.length ? (
                    voicesByLanguage.map(([language, list]) => (
                      <View key={language}>
                        <Text style={[styles.groupLabel, { color: palette.subtext }]}>{language}</Text>
                        {list.map(voice => {
                          const active = voice.id === selectedVoiceId;
                          return (
                            <Pressable
                              key={voice.id}
                              onPress={() => {
                                onSetVoice(voice.id);
                                setVoicePickerOpen(false);
                              }}
                              style={[
                                styles.dropdownOption,
                                { backgroundColor: active ? palette.primarySoft : 'transparent' },
                              ]}
                            >
                              <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
                                {voice.name || voice.id}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: palette.subtext, padding: 10 }}>
                      No extra voices found — the device's default voice will be used.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>

            {/* ── Speed ──────────────────────────────────────────────────── */}
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

            {/* ── Max reading time ───────────────────────────────────────── */}
            <View style={styles.group}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Max reading time</Text>
              <Text style={{ color: palette.subtext, marginBottom: 8 }}>
                When the time's up, reading stops automatically. Leave it off to read straight through to the end of
                the Bible.
              </Text>
              <View style={styles.chipRow}>
                {DURATION_PRESETS.map(preset => {
                  const active = maxDurationMinutes === preset.minutes;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => onSetMaxDurationMinutes(preset.minutes)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? palette.primarySoft : palette.surface,
                          borderColor: active ? palette.primaryStrong : palette.divider,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800' }}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customRow}>
                <TextInput
                  value={customMinutesInput}
                  onChangeText={setCustomMinutesInput}
                  keyboardType="number-pad"
                  placeholder="Custom minutes"
                  placeholderTextColor={palette.subtext}
                  style={[styles.input, { borderColor: palette.divider, color: palette.text }]}
                />
                <KISButton title="Set" size="xs" onPress={applyCustomMinutes} />
              </View>
            </View>
          </ScrollView>
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
    paddingBottom: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,120,0.4)',
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 18, fontWeight: '900' },
  iconButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 14, paddingBottom: 24, gap: 18 },

  playerCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
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
  groupLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 10, paddingTop: 8 },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  dropdownMenu: { borderWidth: 1, borderRadius: 12, marginTop: 8, overflow: 'hidden', maxHeight: 260 },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },

  customRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
});
