// src/screens/broadcast/education/components/EducationFilterSheet.tsx
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type { FilterPayload } from '@/screens/broadcast/education/hooks/useEducationDiscovery';

type FilterOptions = {
  languages?: string[];
  levels?: string[];
  prices?: ('free' | 'paid')[];
  partners?: string[];
  topics?: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  filters: FilterPayload;
  available: FilterOptions | null;
  onUpdate: (key: keyof FilterPayload, value: string | undefined) => void;
  onReset: () => void;
};

const Chip = ({ label, active, onPress }: any) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      borderWidth: 1,
      borderColor: active ? '#FF8A33' : '#AAA',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: active ? 'rgba(255,138,51,0.12)' : 'transparent',
      opacity: pressed ? 0.8 : 1,
      marginRight: 8,
      marginBottom: 8,
    })}
  >
    <Text style={{ color: active ? '#FF8A33' : '#555', fontSize: 12 }}>{label}</Text>
  </Pressable>
);

export default function EducationFilterSheet({
  visible,
  onClose,
  filters,
  available,
  onUpdate,
  onReset,
}: Props) {
  const { palette } = useKISTheme();

  if (!visible) return null;

  const renderGroup = (label: string, key: keyof FilterPayload, options: string[] | undefined) => {
    if (!options || options.length === 0) return null;
    return (
      <View key={key} style={{ marginBottom: 16 }}>
        <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 6 }}>{label}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {options.map((option) => (
            <Chip
              key={option}
              label={option}
              active={filters[key] === option}
              onPress={() => onUpdate(key, filters[key] === option ? undefined : option)}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal transparent visible animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: '60%',
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
            Filter education
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderGroup('Type', 'type', ['course', 'lesson', 'workshop', 'program', 'credential', 'mentorship'])}
            {renderGroup('Price', 'price', ['free', 'paid'])}
            {renderGroup('Level', 'level', available?.levels)}
            {renderGroup('Language', 'language', available?.languages)}
            {renderGroup('Topic', 'topic', available?.topics)}
            {renderGroup('Creator', 'creator', available?.partners)}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <KISButton title="Reset" variant="outline" size="sm" onPress={onReset} />
            <KISButton title="Done" onPress={onClose} size="sm" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
