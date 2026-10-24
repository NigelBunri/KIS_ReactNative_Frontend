// src/components/feeds/composer/pages/PollComposerPage.tsx
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { PollSettings } from '../types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const OPTION_CHAR_LIMIT = 80;
const QUESTION_CHAR_LIMIT = 200;

const DURATION_OPTIONS: { value: PollSettings['duration']; label: string }[] = [
  { value: 'none', label: 'No limit' },
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '3d', label: '3 days' },
  { value: '1w', label: '1 week' },
];

export function PollComposerPage({
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  pollSettings,
  setPollSettings,
}: {
  pollQuestion: string;
  setPollQuestion: (v: string) => void;
  pollOptions: string[];
  setPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
  pollSettings: PollSettings;
  setPollSettings: React.Dispatch<React.SetStateAction<PollSettings>>;
}) {
  const { palette } = useKISTheme();

  const duplicateIndexes = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    pollOptions.forEach((opt, idx) => {
      const key = opt.trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) {
        dupes.add(idx);
        dupes.add(seen.get(key)!);
      } else {
        seen.set(key, idx);
      }
    });
    return dupes;
  }, [pollOptions]);

  const moveOption = (index: number, direction: -1 | 1) => {
    setPollOptions(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeOption = (index: number) => {
    setPollOptions(prev => (prev.length <= MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateSetting = <K extends keyof PollSettings>(key: K, value: PollSettings[K]) => {
    setPollSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <TextInput
          placeholder="Poll question"
          placeholderTextColor={palette.subtext}
          value={pollQuestion}
          onChangeText={v => setPollQuestion(v.slice(0, QUESTION_CHAR_LIMIT))}
          style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
        />
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {pollQuestion.length}/{QUESTION_CHAR_LIMIT}
        </Text>
      </View>

      {pollOptions.map((opt, idx) => (
        <View key={`poll-opt-${idx}`} style={{ gap: 2 }}>
          <View style={styles.optionRow}>
            <TextInput
              placeholder={`Option ${idx + 1}`}
              placeholderTextColor={palette.subtext}
              value={opt}
              onChangeText={v =>
                setPollOptions(p => p.map((o, i) => (i === idx ? v.slice(0, OPTION_CHAR_LIMIT) : o)))
              }
              style={[
                styles.input,
                styles.optionInput,
                {
                  color: palette.text,
                  borderColor: duplicateIndexes.has(idx) ? palette.danger : palette.divider,
                },
              ]}
            />
            <Pressable
              onPress={() => moveOption(idx, -1)}
              disabled={idx === 0}
              style={{ opacity: idx === 0 ? 0.3 : 1, padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Move option ${idx + 1} up`}
            >
              <KISIcon name="chevron-up" size={16} color={palette.text} />
            </Pressable>
            <Pressable
              onPress={() => moveOption(idx, 1)}
              disabled={idx === pollOptions.length - 1}
              style={{ opacity: idx === pollOptions.length - 1 ? 0.3 : 1, padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Move option ${idx + 1} down`}
            >
              <KISIcon name="chevron-down" size={16} color={palette.text} />
            </Pressable>
            <Pressable
              onPress={() => removeOption(idx)}
              disabled={pollOptions.length <= MIN_OPTIONS}
              style={{ opacity: pollOptions.length <= MIN_OPTIONS ? 0.3 : 1, padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove option ${idx + 1}`}
            >
              <KISIcon name="close" size={16} color={palette.danger} />
            </Pressable>
          </View>
          {duplicateIndexes.has(idx) ? (
            <Text style={[styles.dupeWarning, { color: palette.danger }]}>Duplicate option</Text>
          ) : null}
        </View>
      ))}

      <Pressable
        onPress={() => setPollOptions(p => (p.length >= MAX_OPTIONS ? p : [...p, '']))}
        disabled={pollOptions.length >= MAX_OPTIONS}
        accessibilityRole="button"
        accessibilityLabel="Add poll option"
        style={[styles.secondaryButton, { borderColor: palette.divider, opacity: pollOptions.length >= MAX_OPTIONS ? 0.5 : 1 }]}
      >
        <Text style={{ color: palette.text, fontWeight: '900' }}>
          {pollOptions.length >= MAX_OPTIONS ? `Max ${MAX_OPTIONS} options` : 'Add option'}
        </Text>
      </Pressable>

      <View style={[styles.settingsBlock, { borderColor: palette.divider }]}>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: palette.text }]}>Allow multiple selections</Text>
          <Switch
            value={pollSettings.allowMultiple}
            onValueChange={v => updateSetting('allowMultiple', v)}
            trackColor={{ false: palette.divider, true: palette.primaryStrong }}
            thumbColor={palette.onPrimary}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: palette.text }]}>Randomize option order</Text>
          <Switch
            value={pollSettings.randomizeOrder}
            onValueChange={v => updateSetting('randomizeOrder', v)}
            trackColor={{ false: palette.divider, true: palette.primaryStrong }}
            thumbColor={palette.onPrimary}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: palette.text }]}>Show results before voting</Text>
          <Switch
            value={pollSettings.showResultsBeforeVoting}
            onValueChange={v => updateSetting('showResultsBeforeVoting', v)}
            trackColor={{ false: palette.divider, true: palette.primaryStrong }}
            thumbColor={palette.onPrimary}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: palette.text }]}>Anonymous voting</Text>
          <Switch
            value={pollSettings.anonymous}
            onValueChange={v => updateSetting('anonymous', v)}
            trackColor={{ false: palette.divider, true: palette.primaryStrong }}
            thumbColor={palette.onPrimary}
          />
        </View>
        <Text style={[styles.settingLabel, { color: palette.subtext }]}>Poll closes after</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map(opt => {
            const active = pollSettings.duration === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => updateSetting('duration', opt.value)}
                style={[
                  styles.durationChip,
                  {
                    borderColor: active ? palette.primary : palette.divider,
                    backgroundColor: active ? palette.primarySoft : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '800', fontSize: 11 }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  counter: {
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionInput: { flex: 1 },
  dupeWarning: { fontSize: 11, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  settingsBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: { fontSize: 12, fontWeight: '800' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
