import React from 'react';
import { View, Text } from 'react-native';
import { HealthThemeColors, HEALTH_THEME_TYPOGRAPHY } from '@/theme/health';

type SectionHeaderProps = {
  palette: HealthThemeColors;
  title: string;
  trailing?: React.ReactNode;
};

/**
 * Title + optional trailing count/action, used to break long tabs (e.g.
 * CCC's Overview) into clearly labeled card groups instead of one
 * undifferentiated scroll.
 */
export default function SectionHeader({ palette, title, trailing }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: palette.text,
          fontSize: HEALTH_THEME_TYPOGRAPHY.h3.fontSize,
          fontWeight: HEALTH_THEME_TYPOGRAPHY.h3.fontWeight,
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}
