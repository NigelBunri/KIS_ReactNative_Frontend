// src/components/feeds/composer/pages/PollComposerPage.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export function PollComposerPage({
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
}: {
  pollQuestion: string;
  setPollQuestion: (v: string) => void;
  pollOptions: string[];
  setPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { palette } = useKISTheme();

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        placeholder="Poll question"
        placeholderTextColor={palette.subtext}
        value={pollQuestion}
        onChangeText={setPollQuestion}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />

      {pollOptions.map((opt, idx) => (
        <TextInput
          key={`poll-opt-${idx}`}
          placeholder={`Option ${idx + 1}`}
          placeholderTextColor={palette.subtext}
          value={opt}
          onChangeText={(v) => setPollOptions((p) => p.map((o, i) => (i === idx ? v : o)))}
          style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
        />
      ))}

      <Pressable onPress={() => setPollOptions((p) => [...p, ''])} style={[styles.secondaryButton, { borderColor: palette.divider }]}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Add option</Text>
      </Pressable>
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
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
