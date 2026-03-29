import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { BibleTranslation } from '@/screens/tabs/bible/useBibleData';

type Props = {
  translations: BibleTranslation[];
  selected?: string;
  onSelect: (code: string) => void;
};

export default function TranslationPicker({ translations, selected, onSelect }: Props) {
  const { palette } = useKISTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {translations.map((translation) => {
        const isSelected = translation.code === selected;
        return (
          <TouchableOpacity
            key={translation.id}
            onPress={() => onSelect(translation.code)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? palette.primarySoft : palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={{ color: isSelected ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
              {translation.code}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
  },
});
