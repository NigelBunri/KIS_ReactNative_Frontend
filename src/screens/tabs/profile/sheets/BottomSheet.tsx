// src/screens/tabs/profile/sheets/BottomSheet.tsx
import React from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';

export default function BottomSheet({
  sheetY,
  children,
  onBackdropPress,
}: {
  sheetY: Animated.Value;
  children: React.ReactNode;
  onBackdropPress?: () => void;
}) {
  const { palette } = useKISTheme();

  return (
    <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetY }] }]}>
      <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={onBackdropPress} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { backgroundColor: palette.bg }]}>
        <View style={{ flex: 1 }}>{children}</View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
