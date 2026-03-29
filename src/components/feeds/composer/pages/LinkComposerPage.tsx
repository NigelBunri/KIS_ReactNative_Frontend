// src/components/feeds/composer/pages/LinkComposerPage.tsx
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export function LinkComposerPage({
  link,
  setLink,
  caption,
  setCaption,
}: {
  link: string;
  setLink: (v: string) => void;
  caption: string;
  setCaption: (v: string) => void;
}) {
  const { palette } = useKISTheme();

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        placeholder="Paste a link"
        placeholderTextColor={palette.subtext}
        value={link}
        onChangeText={setLink}
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />
      <TextInput
        placeholder="Add a caption (optional)"
        placeholderTextColor={palette.subtext}
        value={caption}
        onChangeText={setCaption}
        multiline
        style={[styles.input, { color: palette.text, borderColor: palette.divider, minHeight: 96 }]}
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
