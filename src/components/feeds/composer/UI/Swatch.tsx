// src/components/feeds/composer/ui/Swatch.tsx
import React from 'react';
import { Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export function Swatch({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useKISTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: color,
        borderWidth: 3,
        borderColor: selected ? palette.primary : 'transparent',
      }}
    />
  );
}
