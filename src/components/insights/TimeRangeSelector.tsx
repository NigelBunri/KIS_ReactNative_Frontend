import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { TimeRange } from '@/api/insights/types';

const OPTIONS: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All' },
];

type Props = {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
};

export default function TimeRangeSelector({ value, onChange }: Props) {
  const theme = useKISTheme();
  const { palette } = theme;
  return (
    <View style={styles.wrap}>
      {OPTIONS.map((option) => {
        const isActive = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.7}
            onPress={() => onChange(option.key)}
            style={[
              styles.button,
              {
                backgroundColor: isActive ? palette.primarySoft : palette.surface,
                borderColor: isActive ? palette.primary : palette.border,
              },
            ]}
          >
            <Text style={{ color: isActive ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  button: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
});
