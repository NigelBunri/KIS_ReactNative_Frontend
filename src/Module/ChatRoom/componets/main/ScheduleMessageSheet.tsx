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
import { KISIcon } from '@/constants/kisIcons';

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
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
            backgroundColor: palette.surface ?? palette.background,
            transform: [{ translateY }],
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
                <View style={[styles.optIcon, { backgroundColor: (palette.primary ?? '#4F46E5') + '22' }]}>
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
        </View>
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
