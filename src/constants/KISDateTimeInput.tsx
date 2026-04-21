import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { getTypographyStyle } from '@/theme/foundations/typography';
import { FONT_FAMILIES, FONT_WEIGHTS } from '@/theme/foundations/fonts';
import { useKISTheme } from '@/theme/useTheme';

type Mode = 'date' | 'time' | 'datetime';
type SizePreset = 'sm' | 'md' | 'lg' | 'xl';

type LayoutOverrides = {
  wrapStyle?: ViewStyle;
  valueStyle?: TextStyle;
  bordered?: boolean;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  width?: number | string;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderRadius?: number;
  borderWidth?: number;
  size?: SizePreset;
};

type DynamicStyleProps = {
  focused: boolean;
  error?: boolean;
  disabled?: boolean;
  multiline?: boolean;
};

type StylePropType =
  | ViewStyle
  | ((state: DynamicStyleProps) => ViewStyle);

type Props = {
  label?: string;
  value?: string | null;
  onChange?: (isoValue: string) => void;
  placeholder?: string;
  errorText?: string;
  error?: boolean;
  disabled?: boolean;
  mode?: Mode;
  minimumDate?: Date;
  maximumDate?: Date;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: ViewStyle;
  layout?: LayoutOverrides;
  style?: StylePropType;
};

const SIZE_PRESETS: Record<
  SizePreset,
  { height: number; px: number; py: number }
> = {
  sm: { height: 44, px: 10, py: 10 },
  md: { height: 52, px: 12, py: 12 },
  lg: { height: 60, px: 14, py: 14 },
  xl: { height: 68, px: 16, py: 16 },
};

const toSafeDate = (value?: string | null) => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatValue = (value?: string | null, mode: Mode = 'datetime') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (mode === 'date') {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  if (mode === 'time') {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function KISDateTimeInput({
  label,
  value,
  onChange,
  placeholder,
  errorText,
  error,
  disabled,
  mode = 'datetime',
  minimumDate,
  maximumDate,
  containerStyle,
  layout,
}: Props) {
  const { palette, tokens } = useKISTheme();
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(toSafeDate(value));
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>(
    mode === 'time' ? 'time' : 'date',
  );

  const hasError = !!error || !!errorText;
  const preset = SIZE_PRESETS[layout?.size ?? 'md'];
  const borderColor = hasError ? palette.borderDanger : palette.inputBorder;

  const labelStyle = useMemo(
    () => getTypographyStyle('label', palette.subtext),
    [palette.subtext],
  );
  const errorStyle = useMemo(
    () => getTypographyStyle('helper', palette.danger),
    [palette.danger],
  );
  const valueTextStyle = useMemo(
    () => getTypographyStyle('input', value ? palette.text : palette.subtext),
    [palette.text, palette.subtext, value],
  );

  const wrapStyle: ViewStyle = {
    backgroundColor: palette.inputBg,
    borderColor: layout?.bordered === false ? 'transparent' : borderColor,
    borderWidth: layout?.bordered === false ? 0 : layout?.borderWidth ?? 2,
    borderRadius: layout?.borderRadius ?? tokens.radius?.lg ?? 16,
    minHeight: layout?.minHeight ?? layout?.height ?? tokens.controlHeights?.md ?? preset.height,
    maxHeight: layout?.maxHeight,
    width: layout?.width as any,
    paddingHorizontal: layout?.paddingHorizontal ?? preset.px,
    paddingVertical: layout?.paddingVertical ?? preset.py,
    justifyContent: 'center',
  };

  const displayValue =
    formatValue(value, mode) ||
    placeholder ||
    (mode === 'date'
      ? 'Select date'
      : mode === 'time'
      ? 'Select time'
      : 'Select date and time');

  const openPicker = () => {
    if (disabled) return;
    const next = toSafeDate(value);
    setTempDate(next);
    setAndroidStep(mode === 'time' ? 'time' : 'date');
    setOpen(true);
  };

  const closePicker = () => setOpen(false);

  const commitChange = (date: Date) => {
    onChange?.(date.toISOString());
  };

  const onNativeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      closePicker();
      return;
    }

    if (!selected) return;

    if (Platform.OS === 'android') {
      if (mode === 'datetime') {
        if (androidStep === 'date') {
          const merged = new Date(tempDate);
          merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          setTempDate(merged);
          setAndroidStep('time');
          return;
        }

        const merged = new Date(tempDate);
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        commitChange(merged);
        closePicker();
        return;
      }

      commitChange(selected);
      closePicker();
      return;
    }

    setTempDate(selected);
  };

  const confirmIOS = () => {
    commitChange(tempDate);
    closePicker();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[labelStyle, { marginBottom: 6 }]}>{label}</Text> : null}

      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={[wrapStyle, layout?.wrapStyle, disabled ? { opacity: 0.6 } : null]}
      >
        <Text style={[valueTextStyle, layout?.valueStyle]}>
          {displayValue}
        </Text>
      </Pressable>

      {!!errorText ? <Text style={[errorStyle, { marginTop: 6 }]}>{errorText}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={tempDate}
          mode={mode === 'datetime' ? androidStep : mode}
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onNativeChange}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="fade"
          visible={open}
          onRequestClose={closePicker}
        >
          <Pressable style={styles.backdrop} onPress={closePicker}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: palette.surface }]}
              onPress={() => {}}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={[styles.modalAction, { color: palette.subtext }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={[styles.modalAction, { color: palette.text }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={tempDate}
                mode={mode === 'datetime' ? 'datetime' : mode}
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onNativeChange}
                style={{ alignSelf: 'stretch' }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  modalAction: {
    fontFamily: FONT_FAMILIES.body,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: 16,
  },
});