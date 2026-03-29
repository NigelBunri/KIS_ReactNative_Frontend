// src/components/KISTextInput.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ActivityIndicator,
  GestureResponderEvent,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { getTypographyStyle } from '@/theme/foundations/typography';
import { FONT_FAMILIES, FONT_WEIGHTS } from '@/theme/foundations/fonts';
import { useKISTheme } from '@/theme/useTheme';

type Adornment = React.ReactNode | ((color: string) => React.ReactNode);

type SizePreset = 'sm' | 'md' | 'lg' | 'xl';

type LayoutOverrides = {
  /** Outer wrap that contains border/bg */
  wrapStyle?: ViewStyle;
  /** Inner TextInput style */
  inputStyle?: TextStyle;

  /** Turn border on/off (default: true) */
  bordered?: boolean;

  /** Direct ergonomic knobs (applied to wrap/input). Any of these can be set per-call. */
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  width?: number | string;

  paddingHorizontal?: number;
  paddingVertical?: number;

  /** If you want different padding for the actual TextInput */
  inputPaddingVertical?: number;
  inputPaddingHorizontal?: number;

  borderRadius?: number;
  borderWidth?: number;

  /** Control overall density quickly */
  size?: SizePreset;

  /** Convenience when using multiline fields */
  multilineMinHeight?: number;
};

type Props = TextInputProps & {
  label?: string;
  errorText?: string;
  /** If you want to mark error state without showing a message */
  error?: boolean;
  left?: Adornment;
  right?: Adornment;
  loading?: boolean;
  /** Shows a small clear button when there's text and not secure */
  allowClear?: boolean;
  /** Called when user taps the clear button; if not provided we call onChangeText('') */
  onClear?: (e: GestureResponderEvent) => void;

  /** Container style around the whole component */
  containerStyle?: ViewStyle;

  /** Layout overrides you can pass when calling */
  layout?: LayoutOverrides;
};

const SIZE_PRESETS: Record<
  SizePreset,
  { height: number; px: number; py: number; inputPy: number }
> = {
  sm: { height: 44, px: 10, py: 0, inputPy: 10 },
  md: { height: 52, px: 12, py: 0, inputPy: 12 },
  lg: { height: 60, px: 14, py: 0, inputPy: 14 },
  xl: { height: 68, px: 16, py: 0, inputPy: 16 },
};

export default function KISTextInput({
  label,
  errorText,
  error,
  left,
  right,
  secureTextEntry,
  loading,
  style,
  containerStyle,
  value,
  onChangeText,
  layout,
  allowClear,
  onClear,
  multiline,
  placeholderTextColor,
  ...rest
}: Props) {
  const { palette, tokens } = useKISTheme();
  const [secure, setSecure] = useState(!!secureTextEntry);

  const labelStyle = useMemo(
    () => getTypographyStyle('label', palette.subtext),
    [palette.subtext],
  );
  const helperStyle = useMemo(
    () => getTypographyStyle('helper', palette.subtext),
    [palette.subtext],
  );
  const errorStyle = useMemo(
    () => getTypographyStyle('helper', palette.danger),
    [palette.danger],
  );
  const inputTextStyle = useMemo(
    () => getTypographyStyle('input', palette.text),
    [palette.text],
  );

  const hasError = !!errorText || !!error;

  const borderColor = useMemo(() => {
    if (hasError) return palette.borderDanger;
    return palette.inputBorder;
  }, [hasError, palette]);

  const preset = useMemo(() => {
    const size = layout?.size ?? 'md';
    return SIZE_PRESETS[size];
  }, [layout?.size]);

  // Base control height from theme, fallback to preset
  const baseControlHeight = useMemo(() => {
    return tokens.controlHeights?.md ?? preset.height;
  }, [tokens.controlHeights?.md, preset.height]);

  const wrapHeight = useMemo(() => {
    // If multiline, don’t force fixed height unless user explicitly sets it.
    if (multiline) return layout?.height ?? undefined;
    return layout?.height ?? baseControlHeight;
  }, [layout?.height, multiline, baseControlHeight]);

  const wrapPaddingHorizontal = layout?.paddingHorizontal ?? preset.px;
  const wrapPaddingVertical = layout?.paddingVertical ?? preset.py;

  const isBordered = layout?.bordered !== false;

  const wrapRadius = layout?.borderRadius ?? tokens.radius?.lg ?? 16;
  const wrapBorderWidth = isBordered ? layout?.borderWidth ?? 2 : 0;

  // Multiline: if user didn't specify any minHeight, use the size preset height as minHeight.
  const computedMinHeight = useMemo(() => {
    if (!multiline) return layout?.minHeight;

    if (layout?.multilineMinHeight) return layout.multilineMinHeight;
    if (layout?.minHeight != null) return layout.minHeight;

    // default multiline minHeight follows the chosen size preset
    return baseControlHeight;
  }, [multiline, layout?.multilineMinHeight, layout?.minHeight, baseControlHeight]);

  const computedWrapStyle: ViewStyle = useMemo(
    () => ({
      backgroundColor: palette.inputBg,
      borderColor: isBordered ? borderColor : 'transparent',
      borderRadius: wrapRadius,
      borderWidth: wrapBorderWidth,

      // sizing
      height: wrapHeight,
      minHeight: computedMinHeight,
      maxHeight: layout?.maxHeight,
      width: layout?.width as any,

      // padding
      paddingHorizontal: wrapPaddingHorizontal,
      paddingVertical: wrapPaddingVertical,
    }),
    [
      palette.inputBg,
      isBordered,
      borderColor,
      wrapRadius,
      wrapBorderWidth,
      wrapHeight,
      computedMinHeight,
      layout?.maxHeight,
      layout?.width,
      wrapPaddingHorizontal,
      wrapPaddingVertical,
    ],
  );

  const showClear =
    !!allowClear &&
    !!value &&
    typeof value === 'string' &&
    value.length > 0 &&
    !secure &&
    !loading &&
    !right &&
    (rest.editable ?? true) !== false;

  const handleClear = useCallback((e: GestureResponderEvent) => {
    if (typeof onChangeText === 'function' && !(rest as any).readOnly) {
      onChangeText('');
    }
    if (typeof onClear === 'function') onClear(e);
  }, [onChangeText, onClear, rest]);

  const RightAdornment = useMemo(() => {
    if (loading) {
      return <ActivityIndicator size="small" style={styles.adornment} />;
    }

    if (secureTextEntry) {
      return (
        <TouchableOpacity
          onPress={() => setSecure((s) => !s)}
          style={styles.adornmentHitbox}
          accessibilityRole="button"
          accessibilityLabel={secure ? 'Show password' : 'Hide password'}
        >
          <Text
            style={{
              color: palette.text,
              fontWeight: FONT_WEIGHTS.semibold,
              fontFamily: FONT_FAMILIES.body,
            }}
          >
            {secure ? 'Show' : 'Hide'}
          </Text>
        </TouchableOpacity>
      );
    }

    if (showClear) {
      return (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.adornmentHitbox}
          accessibilityRole="button"
          accessibilityLabel="Clear text"
        >
          <Text
            style={{
              color: palette.subtext,
              fontWeight: FONT_WEIGHTS.semibold,
              fontFamily: FONT_FAMILIES.body,
            }}
          >
            Clear
          </Text>
        </TouchableOpacity>
      );
    }

    if (right) {
      return (
        <View style={styles.adornment}>
          {typeof right === 'function' ? right(palette.subtext) : right}
        </View>
      );
    }

    return null;
  }, [
    loading,
    secure,
    secureTextEntry,
    right,
    palette.subtext,
    palette.text,
    showClear,
    handleClear,
  ]);

  const resolvedPlaceholderTextColor = placeholderTextColor ?? palette.subtext;

  return (
    <View style={[{ marginBottom: 40,position: 'relative', height: 40 }, containerStyle]}>
      {label ? <Text style={[labelStyle, { marginBottom: 6 }]}>{label}</Text> : null}

      <View style={[styles.inputWrap, computedWrapStyle, layout?.wrapStyle, { minWidth: "90%", justifyContent: 'center',marginBottom: 20}]}>
        {left ? (
          <View style={[styles.adornment, { marginLeft: 2 }]}>
            {typeof left === 'function' ? left(palette.subtext) : left}
          </View>
        ) : null}

        <TextInput
          {...rest}
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          placeholderTextColor={resolvedPlaceholderTextColor}
          textAlignVertical={multiline ? 'top' : (rest as any).textAlignVertical}
          style={[
            styles.input,
            inputTextStyle,
            {
              paddingVertical: 0,
            },
            layout?.inputStyle,
            style,
          ]}
        />

        {RightAdornment}
      </View>

      {!!errorText ? <Text style={[errorStyle, { marginTop: 6 }]}>{errorText}</Text> : null}

      
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingBottom: 4,
  },
  adornment: {
    marginHorizontal: 6,
    justifyContent: 'center',
  },
  adornmentHitbox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
