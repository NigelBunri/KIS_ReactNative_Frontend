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
} from 'react-native';
import { createButtonStyles } from '@/theme/foundations/buttons';
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
}: Props) {
  const { tone, palette, tokens } = useKISTheme();
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        containerStyles,
        pressed && { opacity: tokens.opacity.pressed },
      ]}
    >
      {left ? <View style={{ marginRight: 6 }}>{left}</View> : null}

      {title ? <Text style={titleStyles}>{title}</Text> : children}

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
