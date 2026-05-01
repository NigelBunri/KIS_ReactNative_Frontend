// src/screens/tabs/profile/sheets/BottomSheet.tsx
import React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import usePullDownToClose from '@/hooks/usePullDownToClose';
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
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: Boolean(onBackdropPress),
    onClose: onBackdropPress ?? (() => undefined),
  });

  return (
    <Animated.View
      style={[
        styles.sheetWrap,
        {
          transform: [{ translateY: Animated.add(sheetY, dragY) }],
          paddingHorizontal: 18,
        },
      ]}
    >
      <Pressable
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        onPress={onBackdropPress}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { backgroundColor: palette.bg }]}
      >
        <View
          {...panHandlers}
          style={{
            alignItems: 'center',
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              backgroundColor: palette.divider,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
