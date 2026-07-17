import React, { useRef, useEffect } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';

export type DisappearDuration = 0 | 86400 | 604800 | 7776000;

const DURATIONS: { label: string; sublabel: string; value: DisappearDuration }[] = [
  { label: 'Off', sublabel: 'Messages stay forever', value: 0 },
  { label: '24 hours', sublabel: 'Messages disappear after 1 day', value: 86400 },
  { label: '7 days', sublabel: 'Messages disappear after 1 week', value: 604800 },
  { label: '90 days', sublabel: 'Messages disappear after 3 months', value: 7776000 },
];

type Props = {
  visible: boolean;
  currentValue: DisappearDuration;
  onClose: () => void;
  onSelect: (value: DisappearDuration) => void;
  palette: any;
};

export const DisappearingTimerSheet: React.FC<Props> = ({
  visible,
  currentValue,
  onClose,
  onSelect,
  palette,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface ?? palette.bg,
            transform: [{ translateY }],
            paddingBottom: Math.max(insets.bottom, 36),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />

        <Text style={[styles.title, { color: palette.text }]}>
          Disappearing Messages
        </Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          New messages in this chat will disappear after the selected time.
        </Text>

        {DURATIONS.map((d) => {
          const isSelected = d.value === currentValue;
          return (
            <Pressable
              key={d.value}
              style={[
                styles.row,
                isSelected && {
                  backgroundColor:
                    (palette.primary) + '18',
                  borderRadius: 14,
                },
              ]}
              onPress={() => {
                onSelect(d.value);
                onClose();
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>
                  {d.label}
                </Text>
                <Text style={[styles.rowSub, { color: palette.subtext }]}>
                  {d.sublabel}
                </Text>
              </View>
              {isSelected && (
                <KISIcon name="check" size={20} color={palette.primary} focused />
              )}
            </Pressable>
          );
        })}
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
    paddingBottom: 36,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});
