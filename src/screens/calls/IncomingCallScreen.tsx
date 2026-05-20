// src/screens/calls/IncomingCallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import type { CallSession } from '@/services/calls/callTypes';
import { callTypeLabel, callTypeIcon } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  session: CallSession | null;
  onAnswer: () => void;
  onDecline: () => void;
};

const PULSE_PATTERN = [0, 400, 200, 400];

export default function IncomingCallScreen({ session, onAnswer, onDecline }: Props) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!session) return;
    Vibration.vibrate(PULSE_PATTERN, true);

    // Staggered ripple rings
    const animate = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 2.4, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(ring1, 0);
    const a2 = animate(ring2, 450);
    const a3 = animate(ring3, 900);
    a1.start(); a2.start(); a3.start();

    return () => {
      Vibration.cancel();
      a1.stop(); a2.stop(); a3.stop();
    };
  }, [!!session]);

  if (!session) return null;

  const callerInitials = session.title.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const typeLabel = callTypeLabel(session.callType);
  const typeIcon = callTypeIcon(session.callType);

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.bg}>
        <SafeAreaView style={styles.safe}>
          {/* Call type pill */}
          <View style={styles.typePill}>
            <KISIcon name={typeIcon} size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>

          {/* Avatar + rings */}
          <View style={styles.avatarSection}>
            {[ring1, ring2, ring3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    opacity: anim.interpolate({ inputRange: [1, 2.4], outputRange: [0.35, 0] }),
                    transform: [{ scale: anim }],
                  },
                ]}
              />
            ))}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerInitials}</Text>
            </View>
          </View>

          {/* Name & subtitle */}
          <Text style={styles.callerName}>{session.title}</Text>
          <Text style={styles.subtitle}>Incoming {typeLabel.toLowerCase()}</Text>

          {/* If group call, show participant count */}
          {session.participants.length > 0 && (
            <Text style={styles.participantsNote}>
              {session.participants.length} other{session.participants.length !== 1 ? 's' : ''} in call
            </Text>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Decline */}
            <View style={styles.actionCol}>
              <Pressable
                onPress={onDecline}
                style={[styles.actionBtn, styles.declineBtn]}
                android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 40 }}
              >
                <KISIcon name="phone-off" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            {/* Accept */}
            <View style={styles.actionCol}>
              <Pressable
                onPress={onAnswer}
                style={[styles.actionBtn, styles.acceptBtn]}
                android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 40 }}
              >
                <KISIcon
                  name={session.callType === 'video' || session.callType === 'video-group' ? 'video' : 'phone'}
                  size={30}
                  color="#fff"
                />
              </Pressable>
              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  safe: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 50,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 48,
  },
  typeText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  avatarSection: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  callerName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  participantsNote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 80,
    marginTop: 'auto',
  },
  actionCol: { alignItems: 'center', gap: 10 },
  actionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  declineBtn: {
    backgroundColor: '#E52B2B',
    shadowColor: '#E52B2B',
  },
  acceptBtn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
});
