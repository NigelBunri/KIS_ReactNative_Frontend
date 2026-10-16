import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

const QUICK_OPTIONS = [
  { label: 'In 1 hour', offsetMs: 60 * 60 * 1000 },
  { label: 'Tomorrow 9 AM', offsetMs: null as null | number, isNextDay9: true },
  { label: 'Monday 9 AM', offsetMs: null as null | number, isNextMonday: true },
  { label: 'In 1 week', offsetMs: 7 * 24 * 60 * 60 * 1000 },
];

const getNextDay9AM = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

const getNextMonday9AM = () => {
  const d = new Date();
  const day = d.getDay();
  const daysToMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysToMonday);
  d.setHours(9, 0, 0, 0);
  return d;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSchedule: (scheduledAt: string) => void;
  palette: any;
};

export const ScheduleMessageSheet: React.FC<Props> = ({
  visible,
  onClose,
  onSchedule,
  palette,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useKISTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // AND-049: this sheet previously offered only 4 fixed presets (1 hour,
  // tomorrow/Monday 9 AM, 1 week) with no way to pick an arbitrary
  // minute-level time — exactly "there is no mins scheduling." A custom
  // date+time picker, using the same two-step native DateTimePicker
  // pattern EventsScreen.tsx's DateField already uses.
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const customWorking = useRef<Date>(new Date(Date.now() + 60 * 60 * 1000));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  const resolveDate = (opt: typeof QUICK_OPTIONS[0]) => {
    if (opt.isNextDay9) return getNextDay9AM();
    if (opt.isNextMonday) return getNextMonday9AM();
    if (opt.offsetMs !== null) return new Date(Date.now() + opt.offsetMs);
    return new Date(Date.now() + 60 * 60 * 1000);
  };

  const handleConfirm = (date: Date) => {
    onSchedule(date.toISOString());
    onClose();
  };

  const handleCustomDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowCustomDate(false);
    if (selected) {
      customWorking.current = selected;
      if (Platform.OS === 'android') setShowCustomTime(true);
    }
  };

  const handleCustomTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowCustomTime(false);
      if (selected) handleConfirm(selected);
      return;
    }
    if (selected) customWorking.current = selected;
  };

  const formatDate = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface ?? palette.bg,
            transform: [{ translateY }],
            paddingBottom: Math.max(insets.bottom, 40),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        <Text style={[styles.title, { color: palette.text }]}>Schedule Message</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Your message will be sent automatically at the chosen time.
        </Text>

        <View style={{ gap: 10 }}>
          {QUICK_OPTIONS.map((opt, idx) => {
            const date = resolveDate(opt);
            return (
              <Pressable
                key={idx}
                style={[styles.optRow, { backgroundColor: palette.card ?? palette.surfaceElevated }]}
                onPress={() => handleConfirm(date)}
              >
                <View style={[styles.optIcon, { backgroundColor: (palette.primary) + '22' }]}>
                  <KISIcon name="calendar" size={18} color={palette.primary} focused />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, { color: palette.text }]}>{opt.label}</Text>
                  <Text style={[styles.optSub, { color: palette.subtext }]}>{formatDate(date)}</Text>
                </View>
                <KISIcon name="chevron-right" size={18} color={palette.subtext} />
              </Pressable>
            );
          })}

          <Pressable
            style={[styles.optRow, { backgroundColor: palette.card ?? palette.surfaceElevated }]}
            onPress={() => { customWorking.current = new Date(Date.now() + 60 * 60 * 1000); setShowCustomDate(true); }}
          >
            <View style={[styles.optIcon, { backgroundColor: (palette.primary) + '22' }]}>
              <KISIcon name="edit" size={18} color={palette.primary} focused />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optLabel, { color: palette.text }]}>Custom date & time</Text>
              <Text style={[styles.optSub, { color: palette.subtext }]}>Pick any date and exact minute</Text>
            </View>
            <KISIcon name="chevron-right" size={18} color={palette.subtext} />
          </Pressable>
        </View>

        {showCustomDate && (
          <DateTimePicker
            value={customWorking.current}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={handleCustomDateChange}
            onTouchCancel={() => setShowCustomDate(false)}
            // iOS-only: the inline calendar's own day-number/selected-date
            // text otherwise follows the SYSTEM light/dark setting, not
            // this app's theme. When that doesn't match palette.surface
            // (the sheet background it's drawn directly on top of here,
            // with no separate card behind it), the text renders in a
            // color that's invisible against it even though the calendar
            // still responds to taps - same root cause already fixed once
            // for KISDateTimeInput's own spinner.
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={palette.text}
          />
        )}
        {showCustomTime && (
          <DateTimePicker
            value={customWorking.current}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleCustomTimeChange}
            onTouchCancel={() => setShowCustomTime(false)}
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={palette.text}
          />
        )}
        {Platform.OS === 'ios' && showCustomDate && (
          <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
            <TouchableOpacity onPress={() => { setShowCustomDate(false); setShowCustomTime(true); }}>
              <Text style={{ color: palette.primary, fontWeight: '700', padding: 8 }}>Next: Time</Text>
            </TouchableOpacity>
          </View>
        )}
        {Platform.OS === 'ios' && showCustomTime && !showCustomDate && (
          <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
            <TouchableOpacity onPress={() => { setShowCustomTime(false); handleConfirm(customWorking.current); }}>
              <Text style={{ color: palette.primary, fontWeight: '700', padding: 8 }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  optIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLabel: { fontSize: 15, fontWeight: '600' },
  optSub: { fontSize: 12, marginTop: 2 },
});
