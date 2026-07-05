// src/screens/calls/IncomingCallScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import type { CallSession } from '@/services/calls/callTypes';
import { callTypeLabel, callTypeIcon } from '@/services/calls/callTypes';
import { audioRouteManager } from '@/services/calls/audioRouteManager';
import { KISIcon } from '@/constants/kisIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';

// Per call type, resolve accent from palette tokens only — no hardcoded hex.
// voice-group → palette.info (sky blue), video-group → palette.info,
// broadcast → palette.danger (red-pink is close enough and avoids hardcoding).
const buildAccent = (p: any): Record<string, string> => ({
  voice: p.primary,
  video: p.primaryStrong,
  'voice-group': p.info,
  'video-group': p.info,
  broadcast: p.danger,
});

type Props = {
  session: CallSession | null;
  onAnswer: (opts?: { videoOff?: boolean }) => void;
  onDecline: () => void;
};

const VIBRATE_PATTERN = [0, 400, 200, 400];

export default function IncomingCallScreen({ session, onAnswer, onDecline }: Props) {
  const { palette } = useKISTheme();
  const { width: screenWidth } = useWindowDimensions();

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

  const ACCENT = buildAccent(palette);
  const accent = ACCENT[session.callType] ?? palette.primary;

  const isVideo = session.callType === 'video' || session.callType === 'video-group';
  const extraCount = session.participants.length;

  // Screen-relative ring sizes — capped to prevent overflow on narrow devices
  const ringSize = Math.min(168, screenWidth * 0.44);
  const ringRadius = ringSize / 2;
  const ringsWrapSize = Math.min(200, screenWidth * 0.53);
  const glowSize = Math.min(380, screenWidth - 16);

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      <View style={[styles.bg, { backgroundColor: palette.bg, marginTop: 25 }]}>

        {/* Ambient glow blob centred behind the avatar */}
        <View
          style={[
            styles.glow,
            {
              backgroundColor: accent,
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
            },
          ]}
        />

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
            <View style={{ width: ringsWrapSize, height: ringsWrapSize, alignItems: 'center', justifyContent: 'center' }}>
              {[ring1, ring2, ring3].map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    {
                      position: 'absolute',
                      width: ringSize,
                      height: ringSize,
                      borderRadius: ringRadius,
                      borderWidth: 1.5,
                      borderColor: accent,
                    },
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
                  <Text style={[styles.avatarText, { color: palette.card }]}>{initials}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Name */}
            <Text style={[styles.callerName, { color: palette.text }]}>{session.title}</Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: `${palette.text}66` }]}>
              {extraCount > 0
                ? `+${extraCount} other${extraCount !== 1 ? 's' : ''} in this call`
                : `Incoming ${typeLabel.toLowerCase()} call`}
            </Text>
          </View>

          {/* ── Snooze / more options row ── */}
          <View style={styles.snoozeRow}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Remind me',
                  'We\'ll notify you again in:',
                  [
                    { text: '1 minute',  onPress: () => setTimeout(() => Vibration.vibrate(VIBRATE_PATTERN, true), 60_000) },
                    { text: '5 minutes', onPress: () => setTimeout(() => Vibration.vibrate(VIBRATE_PATTERN, true), 300_000) },
                    { text: 'Cancel', style: 'cancel' },
                  ],
                )
              }
              style={[styles.snoozeBtn, { backgroundColor: `${palette.text}14` }]}
              hitSlop={8}
            >
              <Text style={[styles.snoozeText, { color: `${palette.text}80` }]}>Remind me</Text>
            </Pressable>

            {isVideo && (
              <Pressable
                onPress={() => onAnswer({ videoOff: true })}
                style={[styles.snoozeBtn, { backgroundColor: `${palette.text}14` }]}
                hitSlop={8}
              >
                <Text style={[styles.snoozeText, { color: `${palette.text}80` }]}>Answer (no cam)</Text>
              </Pressable>
            )}
          </View>

          {/* ── Answer / Decline ── */}
          <View style={styles.actionsSection}>
            <CallActionButton
              icon="phone-off"
              label="Decline"
              color={palette.danger}
              iconColor={palette.card}
              labelColor={`${palette.text}99`}
              onPress={onDecline}
              accessibilityLabel="Decline call"
            />
            <CallActionButton
              icon={isVideo ? 'video' : 'phone'}
              label="Accept"
              color={palette.success}
              iconColor={palette.card}
              labelColor={`${palette.text}99`}
              onPress={() => onAnswer()}
              accessibilityLabel="Accept call"
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
  iconColor,
  labelColor,
  onPress,
  accessibilityLabel,
}: {
  icon: string;
  label: string;
  color: string;
  iconColor: string;
  labelColor: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.actionCol}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: color, shadowColor: color },
          pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true, radius: 40 }}
      >
        <KISIcon name={icon} size={32} color={iconColor} />
      </Pressable>
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
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
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1,
  },
  callerName: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 28,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Snooze row
  snoozeRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  snoozeBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  snoozeText: { fontSize: 12, fontWeight: '600' },

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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
