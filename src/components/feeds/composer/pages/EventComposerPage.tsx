// src/components/feeds/composer/pages/EventComposerPage.tsx
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export function EventComposerPage({
  eventTitle,
  setEventTitle,
  eventStartsAt,
  setEventStartsAt,
  eventLocation,
  setEventLocation,
}: {
  eventTitle: string;
  setEventTitle: (v: string) => void;
  eventStartsAt: string;
  setEventStartsAt: (v: string) => void;
  eventLocation: string;
  setEventLocation: (v: string) => void;
}) {
  const { palette } = useKISTheme();

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        placeholder="Event title"
        placeholderTextColor={palette.subtext}
        value={eventTitle}
        onChangeText={setEventTitle}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />
      <TextInput
        placeholder="Start date/time (YYYY-MM-DD HH:MM)"
        placeholderTextColor={palette.subtext}
        value={eventStartsAt}
        onChangeText={setEventStartsAt}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />
      <TextInput
        placeholder="Location (optional)"
        placeholderTextColor={palette.subtext}
        value={eventLocation}
        onChangeText={setEventLocation}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />
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
});
