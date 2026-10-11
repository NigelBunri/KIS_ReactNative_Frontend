import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import KISButton from '@/constants/KISButton';
import type { BibleTranslation } from '@/screens/tabs/bible/useBibleData';

type Props = {
  translations: BibleTranslation[];
  selected?: string;
  onSelect: (code: string) => void;
};

export default function TranslationPicker({ translations, selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {translations.map((translation) => {
        const isSelected = translation.code === selected;
        return (
          <KISButton
            key={translation.id}
            onPress={() => onSelect(translation.code)}
            variant={isSelected ? 'primary' : 'outline'}
            size="sm"
            title={translation.code}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
});
