import React from 'react';
import { View, ViewStyle, StyleProp, Platform } from 'react-native';
import { HealthThemeColors } from '@/theme/health';

type HealthCardProps = {
  palette: HealthThemeColors;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  accentColor?: string;
};

/**
 * Shared rounded, soft-shadow card container for the health provider
 * screens. Border stays a subtle secondary cue; the shadow (derived from
 * palette.shadow) is the primary boundary, matching the softer, less
 * bordered card language used elsewhere in the app's Practo-style health
 * screens (DoctorDirectoryScreen, InstitutionsListScreen).
 */
export default function HealthCard({ palette, children, style, padding = 16, accentColor }: HealthCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: 18,
          padding,
          borderWidth: 1,
          borderColor: accentColor ? accentColor + '33' : palette.divider,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: Platform.OS === 'ios' ? 1 : 0.3,
          shadowRadius: 12,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
