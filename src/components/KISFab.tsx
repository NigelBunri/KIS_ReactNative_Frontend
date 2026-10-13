// src/components/KISFab.tsx
//
// The one floating-action-button look for the whole app. Extracted from
// MessagesScreen's "Add contact" FAB (the reference design named when this
// was standardized) - same gold gradient + sheen treatment KISButton's
// `primary` variant uses, just circular with an icon instead of text, so a
// FAB and a primary KISButton read as the same design language.
import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getAccentGradients } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  icon: string;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function KISFab({
  icon,
  onPress,
  size = 56,
  iconSize = 24,
  style,
  accessibilityLabel,
}: Props) {
  const { palette, tokens, accentId } = useKISTheme();
  // Always the "dark" gradient variant regardless of app tone - matches
  // KISButton's primary variant, whose white/ivory icon or text needs that
  // contrast either way.
  const goldGradient = [...getAccentGradients('dark', accentId).tabSelected];
  // Fallback so an icon-only FAB is never left completely unlabeled for
  // screen readers when a caller forgets to pass accessibilityLabel (true
  // of roughly two-thirds of this component's existing call sites) - derived
  // from the icon name itself, e.g. "add-circle" -> "add circle button".
  const fallbackLabel = String(icon || '').replace(/[-_]+/g, ' ').trim();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (fallbackLabel ? `${fallbackLabel} button` : 'Action button')}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.goldDeep,
          shadowColor: palette.goldDeep,
          shadowOpacity: 0.34,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 7,
          overflow: 'hidden',
        },
        style,
        pressed && { opacity: tokens.opacity.pressed },
      ]}
    >
      <LinearGradient
        colors={goldGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.sheen} />
      <KISIcon name={icon} size={iconSize} color={palette.ivory} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    left: 6,
    width: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-18deg' }],
  },
});
