// src/screens/DeviceVerificationScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import KISText from '@/components/common/KISText';
import { KIS_TOKENS } from '@/theme/constants';
import { useAuth } from '../../App';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { initE2EE } from '@/security/e2ee';

type RouteParams = {
  phone?: string | null;
  purpose?: 'register' | 'login' | 'reset';
  channel?: 'sms' | 'email' | 'whatsapp';
};

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    flex: { flex: 1 },
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
    field: {
      gap: tokens.spacing.sm,
    },
    input: {
      borderWidth: 2,
      borderRadius: tokens.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      fontSize: tokens.typography.input,
      textAlign: 'center',
      letterSpacing: 8,
    },
    spacer: { height: tokens.spacing.sm },
    cooldownText: {
      textAlign: 'center',
      marginTop: tokens.spacing.xs,
    },
  });

export default function DeviceVerificationScreen({ navigation, setLoad }: any) {
  const route = useRoute<any>();
  const { setAuth, setUser } = useAuth();
  const params: RouteParams = route?.params || {};

  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [phone] = useState<string>(String(params.phone || ''));
  const [purpose] = useState<'register' | 'login' | 'reset'>(params.purpose || 'register');
  const [channel] = useState<string>(params.channel || 'sms');
  const [code, setCode] = useState('');
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isWhatsApp = channel === 'whatsapp';
  const channelLabel = channel === 'email' ? 'email' : channel === 'whatsapp' ? 'WhatsApp' : 'phone';

  const startCooldown = useCallback((seconds: number) => {
    setCooldownSeconds(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const getDeviceId = useCallback(async () => {
    return (await AsyncStorage.getItem('device_id')) || 'unknown-device';
  }, []);

  const getCountry = useCallback(async () => {
    return (await AsyncStorage.getItem('user_country_code')) || 'CM';
  }, []);

  const onVerify = useCallback(async () => {
    try {
      if (!phone.trim()) return Alert.alert('Missing phone', 'We need your phone number to verify.');
      if (!code.trim()) return Alert.alert('Missing code', 'Please enter the verification code.');
      setLoadingVerify(true);

      const [deviceId, country] = await Promise.all([getDeviceId(), getCountry()]);

      const res = await postRequest(
        ROUTES.auth.sendDeviceCode,
        {
          phone: phone.trim(),
          purpose,
          code: code.trim(),
          device_id: deviceId,
          device_platform: Platform.OS,
          country,
        },
        {
          cacheKey: 'DEVICE_CODE_VERIFY',
          cacheType: 'AUTH_CACHE',
          errorMessage: 'Verification failed.',
        },
      );

      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Invalid or expired code.';
        if (res?.data?.message === 'too many attempts') {
          Alert.alert('Too many attempts', 'This code is locked. Please request a new one.');
          setCode('');
        } else if (__DEV__ && res?.data?.debug) {
          // Developer diagnostic only — never shown in production builds
          const d = res.data.debug;
          Alert.alert(
            'Debug: user not found',
            `Phone raw: ${d.phone_raw}\nNormalized: ${d.phone_normalized}\nVariants: ${d.phone_variants_searched?.join(', ')}\nNational: ${d.national_variants_searched?.join(', ')}\nTotal users in DB: ${d.total_users_in_db}\nRecent users:\n${JSON.stringify(d.recent_users_phones, null, 2)}`,
          );
        } else {
          Alert.alert('Verification failed', msg);
        }
        return;
      }

      const access = res.data?.access || res.data?.access_token;
      const refresh = res.data?.refresh || res.data?.refresh_token;
      if (access) {
        await setAuthTokens({ accessToken: access, refreshToken: refresh ?? null });
      }
      const resolvedUser = res.data?.user ?? null;
      if (resolvedUser) {
        await setUserData(resolvedUser, res.data);
        setUser?.(resolvedUser);
        void initE2EE(String(resolvedUser.id ?? '')).catch(() => {});
      }

      setLoad?.(true);
      setAuth?.(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingVerify(false);
    }
  }, [phone, purpose, code, getDeviceId, getCountry, setAuth, setUser, setLoad]);

  // Auto-submit when exactly 6 digits are entered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (code.length === 6 && !loadingVerify) {
      onVerify();
    }
  }, [code]); // onVerify is intentionally omitted: including it would re-trigger on every keystroke due to its identity changing with `code`. The 6-digit gate prevents double-submission.

  const onResend = async () => {
    try {
      if (!phone.trim()) return Alert.alert('Missing phone', 'Enter your phone.');
      if (cooldownSeconds > 0) return;
      setLoadingResend(true);

      const [deviceId, country] = await Promise.all([getDeviceId(), getCountry()]);
      const r = await postRequest(
        ROUTES.auth.otp,
        { phone: phone.trim(), purpose, channel, device_id: deviceId, device_platform: Platform.OS, country },
        { errorMessage: 'Failed to resend code.' },
      );

      if (!r?.success) {
        const retryAfter = r?.data?.retry_after;
        if (retryAfter) startCooldown(Number(retryAfter));
        const msg = r?.message || r?.data?.detail || 'Please wait and try again.';
        Alert.alert('Resend failed', msg);
        return;
      }

      const cooldown = r?.data?.cooldown ?? 60;
      startCooldown(cooldown);
      Alert.alert('Code sent', `We sent a new code to your ${channelLabel}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingResend(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <KISText preset="h1" style={{ textAlign: 'center', color: palette.text }}>
              Verify your account
            </KISText>
            <KISText preset="body" color={palette.subtext} style={{ textAlign: 'center' }}>
              {isWhatsApp
                ? 'We sent a 6-digit code to your WhatsApp number'
                : `We sent a 6-digit code to your ${channelLabel}`}
            </KISText>
            {isWhatsApp && (
              <KISText preset="helper" color={palette.subtext} style={{ textAlign: 'center' }}>
                Open WhatsApp, find the message from KIS, then come back and enter the code below
              </KISText>
            )}
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.subtext}>
              Verification Code
            </KISText>
            <TextInput
              value={code}
              onChangeText={text => setCode(text.replace(/[^\d]/g, '').slice(0, 6))}
              autoCapitalize="none"
              keyboardType="number-pad"
              placeholder="• • • • • •"
              placeholderTextColor={palette.subtext}
              style={[
                styles.input,
                {
                  borderColor: code.length === 6 ? palette.primary : palette.inputBorder,
                  backgroundColor: palette.surface,
                  color: palette.text,
                },
              ]}
              maxLength={6}
              autoFocus
              textContentType="oneTimeCode"
            />
          </View>

          <KISButton
            title={loadingVerify ? undefined : 'Verify & Activate'}
            onPress={onVerify}
            disabled={loadingVerify || code.trim().length < 6}
            variant="primary"
            size="md"
          >
            {loadingVerify ? <ActivityIndicator /> : null}
          </KISButton>

          <View style={styles.spacer} />

          <KISButton
            title={
              loadingResend
                ? undefined
                : cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : `Resend Code${isWhatsApp ? ' via WhatsApp' : ''}`
            }
            onPress={onResend}
            disabled={loadingResend || cooldownSeconds > 0}
            variant="secondary"
            size="md"
          >
            {loadingResend ? <ActivityIndicator /> : null}
          </KISButton>

          <Pressable
            onPress={() => {
              if (navigation?.canGoBack?.()) navigation?.goBack();
            }}
            hitSlop={8}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <KISText preset="helper" color={palette.subtext}>
              Try a different method
            </KISText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
