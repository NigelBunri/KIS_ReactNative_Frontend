// src/screens/VerificationChannelSelectScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import KISText from '@/components/common/KISText';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';

type RouteParams = {
  phone?: string | null;
  purpose?: 'register' | 'login' | 'reset';
};

type Channels = {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
};

const createStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    flex: { flex: 1 },
    topBar: {
      paddingHorizontal: tokens.spacing.lg,
      paddingTop: tokens.spacing.sm,
      paddingBottom: tokens.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
    },
    container: {
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.xl,
      flexGrow: 1,
      justifyContent: 'center',
    },
    headerBlock: {
      gap: tokens.spacing.sm,
      alignItems: 'center',
    },
    channelList: {
      gap: tokens.spacing.md,
    },
    channelCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.md,
      borderWidth: 2,
      borderRadius: tokens.radius.lg,
      padding: tokens.spacing.lg,
    },
    channelIcon: {
      fontSize: 28,
      lineHeight: 32,
      width: 36,
      textAlign: 'center',
    },
    channelTextBlock: {
      flex: 1,
      gap: tokens.spacing.xs,
    },
    channelArrow: {
      fontSize: tokens.typography.body,
    },
    spacer: {
      height: tokens.spacing['2xl'],
    },
  });

const CHANNEL_META: Record<string, { emoji: string; label: string; description: string }> = {
  sms: {
    emoji: '💬',
    label: 'Text Message (SMS)',
    description: 'We will send a 6-digit code to your phone via SMS',
  },
  email: {
    emoji: '✉️',
    label: 'Email',
    description: 'We will send a 6-digit code to your email address',
  },
  whatsapp: {
    emoji: '🟢',
    label: 'WhatsApp',
    description: 'We will send a 6-digit code to your WhatsApp number',
  },
};

const CHANNEL_ORDER = ['sms', 'email', 'whatsapp'];

export default function VerificationChannelSelectScreen({ navigation }: any) {
  const route = useRoute<any>();
  const params: RouteParams = route?.params || {};
  const phone = String(params.phone || '');
  const purpose = params.purpose || 'register';

  const { palette, tokens, tone } = useKISTheme();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [channels, setChannels] = useState<Channels | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getRequest(ROUTES.auth.otpChannels, {
          errorMessage: 'Could not load verification options.',
          forceNetwork: true,
        });
        if (!cancelled) {
          if (res?.success && res?.data) {
            setChannels({
              sms: Boolean(res.data.sms),
              email: Boolean(res.data.email),
              whatsapp: Boolean(res.data.whatsapp ?? true),
            });
          } else {
            // Fall back to WhatsApp only
            setChannels({ sms: false, email: false, whatsapp: true });
          }
        }
      } catch {
        if (!cancelled) {
          setChannels({ sms: false, email: false, whatsapp: true });
        }
      } finally {
        if (!cancelled) setLoadingChannels(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelectChannel = useCallback(async (channel: string) => {
    if (!phone) {
      Alert.alert('Missing phone', 'Phone number is required for verification.');
      return;
    }
    try {
      setInitiating(channel);
      const deviceId = (await AsyncStorage.getItem('device_id')) || 'unknown-device';
      const res = await postRequest(
        ROUTES.auth.otp,
        { phone: phone.trim(), channel, purpose, device_id: deviceId },
        { errorMessage: 'Failed to start verification.' },
      );

      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Could not send verification code.';
        Alert.alert('Verification failed', msg);
        return;
      }

      navigation.navigate('DeviceVerification', {
        phone: phone.trim(),
        channel,
        purpose,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setInitiating(null);
    }
  }, [phone, purpose, navigation]);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation.replace?.('Welcome');
  };

  const availableChannels = CHANNEL_ORDER.filter(ch => channels?.[ch as keyof Channels]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <StatusBar
        barStyle={tone === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={palette.bg}
      />
      <View style={[styles.topBar, { backgroundColor: palette.surface }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={palette.text} />
          <KISText preset="body" color={palette.text}>Back</KISText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <KISText preset="h1" color={palette.text} style={{ textAlign: 'center' }}>
            Verify your account
          </KISText>
          <KISText preset="body" color={palette.subtext} style={{ textAlign: 'center' }}>
            Choose how you want to receive your verification code
          </KISText>
          {!!phone && (
            <KISText preset="helper" color={palette.subtext} style={{ textAlign: 'center' }}>
              {phone}
            </KISText>
          )}
        </View>

        {loadingChannels ? (
          <ActivityIndicator size="large" color={palette.primary} />
        ) : (
          <View style={styles.channelList}>
            {availableChannels.length === 0 ? (
              <KISText preset="body" color={palette.subtext} style={{ textAlign: 'center' }}>
                No verification channels available. Please contact support.
              </KISText>
            ) : (
              availableChannels.map(ch => {
                const meta = CHANNEL_META[ch];
                const isLoading = initiating === ch;
                const disabled = initiating !== null;
                return (
                  <Pressable
                    key={ch}
                    onPress={() => handleSelectChannel(ch)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.channelCard,
                      {
                        borderColor: pressed ? palette.primary : palette.inputBorder,
                        backgroundColor: palette.surface,
                        opacity: disabled && !isLoading ? 0.5 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={meta.label}
                  >
                    <KISText preset="body" style={styles.channelIcon}>{meta.emoji}</KISText>
                    <View style={styles.channelTextBlock}>
                      <KISText preset="label" color={palette.text}>{meta.label}</KISText>
                      <KISText preset="helper" color={palette.subtext}>{meta.description}</KISText>
                    </View>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <KISText preset="body" color={palette.subtext} style={styles.channelArrow}>›</KISText>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
