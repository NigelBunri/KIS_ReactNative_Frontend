import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { HealthThemeColors } from '@/theme/health';

type EmptyStateProps = {
  palette: HealthThemeColors;
  accentColor: string;
  icon: string;
  title?: string;
  message: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

/**
 * Shared icon + optional title + message + optional CTA empty state,
 * generalized for reuse across the health provider screens (empty queue,
 * no consultations, no tasks, etc.) instead of each screen inlining its
 * own.
 */
export default function EmptyState({ palette, accentColor, icon, title, message, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 36, gap: 10 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: accentColor + '1A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <KISIcon name={icon as any} size={24} color={accentColor} />
      </View>
      {title ? (
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
      ) : null}
      <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600', textAlign: 'center', maxWidth: 260 }}>
        {message}
      </Text>
      {ctaLabel && onCtaPress ? (
        <Pressable
          onPress={onCtaPress}
          style={{
            marginTop: 4,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: accentColor,
          }}
        >
          <Text style={{ color: palette.background, fontWeight: '800', fontSize: 12 }}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
