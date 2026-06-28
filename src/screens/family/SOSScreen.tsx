import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilySOS'>;

export default function SOSScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (sent) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [sent, pulseAnim]);

  async function handleSOS() {
    Alert.alert(
      'Send SOS Alert',
      'This will immediately alert your family with your location. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              let latitude = 0;
              let longitude = 0;
              try {
                const Geolocation = require('react-native-geolocation-service').default;
                await new Promise<void>((resolve) => {
                  Geolocation.getCurrentPosition(
                    (pos: { coords: { latitude: number; longitude: number } }) => {
                      latitude = pos.coords.latitude;
                      longitude = pos.coords.longitude;
                      resolve();
                    },
                    () => resolve(), // Fall back to 0,0 if GPS denied — better than blocking the SOS
                    { enableHighAccuracy: true, timeout: 5000 },
                  );
                });
              } catch { /* GPS unavailable — send without coordinates */ }

              await postRequest(ROUTES.family.sos, {
                latitude,
                longitude,
                message: 'SOS triggered',
              });
              setSent(true);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to send SOS alert');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  const gutter = layout.pageGutter;

  if (sent) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <View style={[styles.successContainer, { paddingHorizontal: gutter }]}>
          <View style={[styles.successIconCircle, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="checkmark-circle" size={72} color={palette.primary} />
          </View>
          <Text style={[styles.successTitle, { color: palette.text }]}>Alert Sent</Text>
          <Text style={[styles.successSubtitle, { color: palette.subtext }]}>
            Alert sent to your family. Help is on the way.
          </Text>
          <KISButton
            title="Back to Safety"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 32, width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <View style={[styles.container, { paddingHorizontal: gutter }]}>
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.centerContent}>
          <Text style={[styles.title, { color: palette.text }]}>Emergency SOS</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Press the button below to instantly alert your family members.
          </Text>

          {/* Pulsing SOS button */}
          <Animated.View style={[styles.pulseWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[styles.sosButton, { backgroundColor: palette.danger }]}
              onPress={handleSOS}
              activeOpacity={0.85}
              disabled={sending}
            >
              <KISIcon name="alert-circle" size={48} color={palette.ivory} />
              <Text style={[styles.sosLabel, { color: palette.ivory }]}>
                {sending ? 'SENDING…' : 'SEND SOS\nALERT'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={[styles.disclaimer, { color: palette.subtext }]}>
            All your family members will be notified immediately with your location.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  backBtn: { paddingTop: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 48, paddingHorizontal: 12 },
  pulseWrapper: { marginBottom: 40 },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 8,
    shadowColor: '#cc0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  sosLabel: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.5,
    lineHeight: 22,
  },
  disclaimer: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  successSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
