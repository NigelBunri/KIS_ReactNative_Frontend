import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type ImagePlaceholderProps = {
  size?: number;
  radius?: number;
  style?: ViewStyle;
};

export default function ImagePlaceholder({
  size = 44,
  radius = 22,
  style,
}: ImagePlaceholderProps) {
  const { palette } = useKISTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: palette.avatarBg,
          borderColor: palette.divider,
        },
        style,
      ]}
    >
      <KISIcon name="image" size={Math.max(14, size * 0.38)} color={palette.subtext} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
