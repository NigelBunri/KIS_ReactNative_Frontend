// src/screens/DeviceVerificationScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import KISButton from '@/constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import KISText from '@/components/common/KISText';
import { KIS_TOKENS } from '@/theme/constants';
import { useAuth } from '../../App';

type RouteParams = {
  phone?: string | null;   // <-- we expect phone passed from Register
  purpose?: 'register' | 'login';
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
    },
    spacer: { height: tokens.spacing.sm },
  });

export default function DeviceVerificationScreen({ setLoad }: any) {
  const route = useRoute<any>();
  const { setAuth } = useAuth();
  const params: RouteParams = route?.params || {};

  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [phone, setPhone] = useState<string>(params.phone || '');
  const [purpose] = useState<'register' | 'login'>(params.purpose || 'register');
  const [code, setCode] = useState('');
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  const onVerify = async () => {
    try {
      if (!phone.trim()) {
        return Alert.alert('Missing phone', 'We need your phone number to verify.');
      }
      if (!code.trim()) {
        return Alert.alert('Missing code', 'Please enter the verification code.');
      }
      setLoadingVerify(true);

      const res = await postRequest(
        ROUTES.auth.sendDeviceCode, // '/api/v1/auth/otp/verify/'
        { phone: phone.trim(), purpose, code: code.trim() },
        {
          cacheKey: 'DEVICE_CODE_VERIFY',
          cacheType: 'AUTH_CACHE',
          errorMessage: 'Verification failed.',
        }
      );

      if (!res?.success) {
        const msg = res?.message || 'Invalid or expired code.';
        return Alert.alert('Verification failed', msg);
      }

      Alert.alert('Verified', 'Your account is now activated.');
      setAuth?.(true);
      setLoad?.(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingVerify(false);
    }
  };

  // Optional: resend (only if user asks)
  const onResend = async () => {
    try {
      if (!phone.trim()) return Alert.alert('Missing phone', 'Enter your phone.');
      setLoadingResend(true);
      const r = await postRequest(
        ROUTES.auth.otp, // '/api/v1/auth/otp/initiate/'
        { phone: phone.trim(), purpose, channel: 'sms' },
        { errorMessage: 'Failed to resend code.' }
      );
      if (!r?.success) {
        const msg = r?.message || 'Please wait and try again.';
        return Alert.alert('Resend failed', msg);
      }
      Alert.alert('Code sent', `We sent a new code to ${phone}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setLoadingResend(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <KISText preset="h1" style={{ textAlign: 'center', color: palette.text }}>
              Verify your account
            </KISText>
            <KISText preset="body" color={palette.subtext}>
              We sent a 6-digit code to your phone.
            </KISText>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.subtext}>
              Phone (read-only)
            </KISText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              editable={false}
              style={[
                styles.input,
                {
                  borderColor: palette.inputBorder,
                  backgroundColor: palette.surface,
                  color: palette.text,
                  opacity: 0.8,
                },
              ]}
            />
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.subtext}>
              Verification Code
            </KISText>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              placeholder="Enter 6-digit code"
              placeholderTextColor={palette.subtext}
              style={[
                styles.input,
                {
                  borderColor: palette.inputBorder,
                  backgroundColor: palette.surface,
                  color: palette.text,
                },
              ]}
              maxLength={6}
            />
          </View>

          <KISButton
            title={loadingVerify ? undefined : 'Verify & Activate'}
            onPress={onVerify}
            disabled={loadingVerify || !code.trim()}
            variant="primary"
            size="md"
          >
            {loadingVerify ? <ActivityIndicator /> : null}
          </KISButton>

          <View style={styles.spacer} />

          <KISButton
            title={loadingResend ? undefined : 'Resend Code'}
            onPress={onResend}
            disabled={loadingResend}
            variant="secondary"
            size="md"
          >
            {loadingResend ? <ActivityIndicator /> : null}
          </KISButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
