// src/components/KISButton.tsx
import React from 'react';
import {
  ActivityIndicator,
  Text,
  Pressable,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { createButtonStyles } from '@/theme/foundations/buttons';
import { getAccentGradients } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  title?: string;
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export default function KISButton({
  title,
  children,
  variant = 'primary',
  size = 'md',
  left,
  right,
  onPress,
  style,
  textStyle,
  disabled,
  loading = false,
  accessibilityLabel,
}: Props) {
  const { tone, palette, tokens, accentId } = useKISTheme();
  const bs = createButtonStyles(tone, palette, tokens);

  // Resolve variant styles
  const variantStyles = bs[variant] ?? bs.primary;
  const isDisabled = Boolean(disabled || loading);

  const containerStyles = [
    variantStyles.container,
    bs.sizes[size],
    style,
    isDisabled && { opacity: tokens.opacity.disabled },
  ];

  const titleStyles = [
    variantStyles.text,
    textStyle,
    isDisabled && { opacity: tokens.opacity.disabled },
  ];

  const spinnerColor =
    (variantStyles.text as TextStyle | undefined)?.color || palette.text;
  // Always the "dark" gradient variant regardless of the app's current
  // tone — the button's white text needs that contrast either way — so
  // tone is forced here rather than read from the theme.
  const metallicGoldGradient = [...getAccentGradients('dark', accentId).tabSelected];
  const shouldUseGoldGradient = variant === 'primary' && !isDisabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
      accessibilityRole="button"
      style={({ pressed }) => [
        containerStyles,
        pressed && { opacity: tokens.opacity.pressed },
      ]}
    >
      {shouldUseGoldGradient ? (
        // Wrapped in its own absolutely-positioned, pointerEvents="none"
        // container (matching AnimatedKISTabBar's identical gold-gradient
        // pattern in AppNavigator.tsx, which never showed this symptom) -
        // on Android, a bare LinearGradient sibling rendered before the
        // label Text could still end up painted on top of it rather than
        // behind, because that native view sits in the same flattened
        // layer as the Text instead of its own subtree. Giving the
        // gradient+sheen their own wrapper View forces Android to
        // composite them as a separate layer underneath the label, same
        // as iOS's layer-order-respecting default already did - this is
        // the CONFIRMED ROOT CAUSE of "selected tab turns solid gold,
        // label unreadable" on Android, every KISButton-based tab row
        // (Bible/Health/Broadcast/Partner tabs - see HealthTabBar's own
        // "one standard KISButton" doc) except the Messages section,
        // which uses react-navigation's material-top-tabs instead of
        // KISButton and so never hit this.
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={metallicGoldGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.goldSheen} />
        </View>
      ) : null}
      {left ? <View style={{ marginRight: 6 }}>{left}</View> : null}

      {title ? <Text style={titleStyles} numberOfLines={1}>{title}</Text> : children}

      {loading ? (
        <ActivityIndicator
          size="small"
          color={spinnerColor}
          style={{ marginLeft: title || children ? 6 : 0 }}
        />
      ) : null}

      {right ? <View style={{ marginLeft: 6 }}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  goldSheen: {
    position: 'absolute',
    top: 1,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,244,184,0.55)',
  },
});
