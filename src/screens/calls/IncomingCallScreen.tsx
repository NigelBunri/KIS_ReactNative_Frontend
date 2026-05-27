// src/screens/calls/IncomingCallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import type { CallSession } from '@/services/calls/callTypes';
import { callTypeLabel, callTypeIcon } from '@/services/calls/callTypes';
import { audioRouteManager } from '@/services/calls/audioRouteManager';
import { KISIcon } from '@/constants/kisIcons';

// Each call type has its own royal accent colour
const ACCENT: Record<string, string> = {
  voice: '#C9A227',
  video: '#8B5CF6',
  'voice-group': '#3B82F6',
  'video-group': '#06B6D4',
  broadcast: '#EC4899',
};

type Props = {
  session: CallSession | null;
  onAnswer: () => void;
  onDecline: () => void;
};

const VIBRATE_PATTERN = [0, 400, 200, 400];

export default function IncomingCallScreen({ session, onAnswer, onDecline }: Props) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!session) return;
    Vibration.vibrate(VIBRATE_PATTERN, true);
    audioRouteManager.startRingtone();

    const ringLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 2.8,
            duration: 1700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(avatarPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    const a1 = ringLoop(ring1, 0);
    const a2 = ringLoop(ring2, 550);
    const a3 = ringLoop(ring3, 1100);
    a1.start(); a2.start(); a3.start();
    pulseLoop.start();

    return () => {
      Vibration.cancel();
      audioRouteManager.stopRingtone();
      a1.stop(); a2.stop(); a3.stop();
      pulseLoop.stop();
    };
  }, [!!session]);

  if (!session) return null;

  const initials = session.title.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const typeLabel = callTypeLabel(session.callType);
  const typeIcon = callTypeIcon(session.callType);
  const accent = ACCENT[session.callType] ?? '#C9A227';
  const isVideo = session.callType === 'video' || session.callType === 'video-group';
  const extraCount = session.participants.length;

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#080814" />
      <View style={styles.bg}>

        {/* Ambient glow blob centred behind the avatar */}
        <View style={[styles.glow, { backgroundColor: accent }]} />

        <SafeAreaView style={styles.safe}>

          {/* ── Call type pill ── */}
          <View style={styles.header}>
            <View style={[styles.typePill, { borderColor: accent + '60', backgroundColor: accent + '20' }]}>
              <KISIcon name={typeIcon} size={15} color={accent} />
              <Text style={[styles.typeLabel, { color: accent }]}>{typeLabel} Call</Text>
            </View>
          </View>

          {/* ── Avatar + pulsing rings ── */}
          <View style={styles.centerSection}>
            <View style={styles.ringsWrap}>
              {[ring1, ring2, ring3].map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.ring,
                    { borderColor: accent },
                    {
                      opacity: anim.interpolate({ inputRange: [1, 2.8], outputRange: [0.5, 0] }),
                      transform: [{ scale: anim }],
                    },
                  ]}
                />
              ))}

              {/* Avatar bordered by accent colour */}
              <Animated.View
                style={[styles.avatarBorder, { borderColor: accent, transform: [{ scale: avatarPulse }] }]}
              >
                <View style={[styles.avatar, { backgroundColor: accent + 'CC' }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Name */}
            <Text style={styles.callerName}>{session.title}</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              {extraCount > 0
                ? `+${extraCount} other${extraCount !== 1 ? 's' : ''} in this call`
                : `Incoming ${typeLabel.toLowerCase()} call`}
            </Text>
          </View>

          {/* ── Answer / Decline ── */}
          <View style={styles.actionsSection}>
            <CallActionButton
              icon="phone-off"
              label="Decline"
              color="#DC2626"
              onPress={onDecline}
            />
            <CallActionButton
              icon={isVideo ? 'video' : 'phone'}
              label="Accept"
              color="#16A34A"
              onPress={onAnswer}
            />
          </View>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

function CallActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionCol}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: color, shadowColor: color },
          pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true, radius: 40 }}
      >
        <KISIcon name={icon} size={32} color="#fff" />
      </Pressable>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#080814',
  },
  glow: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    alignSelf: 'center',
    top: '10%',
    opacity: 0.12,
  },
  safe: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Center
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  ringsWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1.5,
  },
  avatarBorder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 28,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Actions
  actionsSection: {
    flexDirection: 'row',
    gap: 88,
    paddingBottom: 24,
  },
  actionCol: {
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 16,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
