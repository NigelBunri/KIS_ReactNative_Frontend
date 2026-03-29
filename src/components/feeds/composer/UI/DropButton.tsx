// src/components/feeds/composer/ui/DropButton.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

export function DropButton({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active: boolean;
}) {
  const { palette } = useKISTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: active ? palette.primary : palette.divider,
        backgroundColor: active ? 'rgba(0,0,0,0.06)' : palette.card,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 12 }}>{label} ▾</Text>
    </Pressable>
  );
}
