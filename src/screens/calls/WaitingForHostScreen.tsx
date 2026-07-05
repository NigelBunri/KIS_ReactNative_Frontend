// src/screens/calls/WaitingForHostScreen.tsx
// Shown when a participant joins a scheduled call before the host has started it.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  callTitle: string;
  onLeave: () => void;
};

export default function WaitingForHostScreen({ visible, callTitle, onLeave }: Props) {
  const { palette } = useKISTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) return;
    const spinAnim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.9, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    spinAnim.start();
    pulseAnim.start();
    return () => { spinAnim.stop(); pulseAnim.stop(); };
  }, [visible]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <SafeAreaView style={styles.safe}>

          <View style={styles.center}>
            {/* Spinning ring */}
            <Animated.View style={[styles.ring, { borderColor: `${palette.gold}40`, transform: [{ rotate }] }]}>
              <Animated.View
                style={[
                  styles.avatar,
                  { backgroundColor: `${palette.gold}1A`, borderColor: palette.gold, transform: [{ scale: pulse }] },
                ]}
              >
                <KISIcon name="people" size={44} color={palette.gold} />
              </Animated.View>
            </Animated.View>

            <Text style={[styles.title, { color: palette.text }]}>Waiting for the host</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={2}>
              {callTitle}
            </Text>
            <Text style={[styles.note, { color: palette.subtext }]}>
              You'll be connected automatically when the host starts the call.
            </Text>
          </View>

          <Pressable
            onPress={onLeave}
            style={[styles.leaveBtn, { borderColor: palette.danger }]}
          >
            <KISIcon name="phone-off" size={18} color={palette.danger} />
            <Text style={[styles.leaveText, { color: palette.danger }]}>Leave</Text>
          </Pressable>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  ring: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  note: { fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 8,
  },
  leaveText: { fontSize: 16, fontWeight: '800' },
});
