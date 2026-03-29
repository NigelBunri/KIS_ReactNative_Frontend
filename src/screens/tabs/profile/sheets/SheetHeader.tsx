// src/screens/tabs/profile/sheets/SheetHeader.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

export default function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { palette } = useKISTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text }}>{title}</Text>
      <Pressable onPress={onClose}>
        <KISIcon name="close" size={22} color={palette.subtext} />
      </Pressable>
    </View>
  );
}
