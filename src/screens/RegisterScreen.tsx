// src/screens/RegisterScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { postRequest } from '@/network/post/index';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { ensureDeviceId } from '@/security/e2ee';
import { setAuthTokens } from '@/security/authStorage';
import { useKISTheme } from '@/theme/useTheme';
import KISText from '@/components/common/KISText';
import { KIS_TOKENS } from '@/theme/constants';
import { useAuth } from '../../App';

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
    backIcon: {
      fontSize: tokens.typography.h3,
      lineHeight: tokens.typography.h3,
    },
    backText: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
    },
    container: {
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.lg,
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
    label: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
    },
    input: {
      borderWidth: 2,
      borderRadius: tokens.radius.lg,
      paddingHorizontal: tokens.spacing.lg,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      fontSize: tokens.typography.body,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
    },
    prefixBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.xs,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      minWidth: 128,
    },
    phoneInput: {
      flex: 1,
    },
    readonly: {
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      borderWidth: 2,
      borderRadius: tokens.radius.lg,
    },
    passwordReqTitle: {
      fontSize: tokens.typography.helper,
      fontWeight: tokens.typography.weight.semibold,
    },
    passwordReqList: {
      marginTop: tokens.spacing.xs,
      gap: tokens.spacing.xs,
    },
    passwordReqItem: {
      fontSize: tokens.typography.helper,
    },
    privacy: {
      textAlign: 'center',
      fontSize: tokens.typography.helper,
      marginTop: tokens.spacing.lg,
    },
    spacer: {
      height: tokens.spacing['3xl'],
    },
  });

export default function RegisterScreen({ navigation }: any) {
  const { palette, tokens, tone } = useKISTheme();
  const {
    countryISO: detectedCountryISO,
    callingCode: detectedCallingCode,
    locationReady,
  } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const inputStyle = useMemo(
    () => ({
      borderColor: palette.inputBorder,
      backgroundColor: palette.inputBg,
      color: palette.text,
    }),
    [palette]
  );

  // form fields
  const [displayName, setDisplayName] = useState('');
  const [regPhone, setRegPhone] = useState(''); // national digits only (no +code)
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

  // ui
  const [loading, setLoading] = useState(false);

  const onChangeRegPhone = useCallback((value: string) => {
    const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 14);
    setRegPhone(digits);
  }, []);

  const countryISO = useMemo(
    () => String(detectedCountryISO || 'CM').trim().toUpperCase() || 'CM',
    [detectedCountryISO],
  );

  const callingCode = useMemo(() => {
    const digits = String(detectedCallingCode || '+237').replace(/[^\d]/g, '').slice(0, 4);
    return digits ? `+${digits}` : '+237';
  }, [detectedCallingCode]);

  // validators
  const passwordValid = (pwd: string) => {
    return (
      pwd.length >= 10 &&
      /[A-Z]/.test(pwd) &&   // contains uppercase
      /[a-z]/.test(pwd) &&   // contains lowercase
      /[0-9]/.test(pwd)      // contains number
    );
  };

  const phoneValid = useMemo(() => {
    const cleaned = regPhone.trim().replace(/[^\d]/g, '');
    return cleaned.length >= 6;
  }, [regPhone]);
  const countryCodeValid = useMemo(
    () => callingCode.replace(/[^\d]/g, '').length > 0,
    [callingCode]
  );
  const passwordsMatch = regPassword.length > 0 && regPassword === regPassword2;

  const registerReady =
    !!locationReady &&
    countryCodeValid &&
    phoneValid &&
    passwordValid(regPassword) &&
    passwordsMatch &&
    !loading;

  const persistTokensIfAny = async (payload: any) => {
    try {
      const d = payload?.data || payload || {};
      await setAuthTokens({
        accessToken: d?.access ?? null,
        refreshToken: d?.refresh ?? null,
      });
    } catch {}
  };

  // Utility: cryptographically-strong 6-digit code
  const generateOtp = (len: number = 6) => {
    const digits = '0123456789';
    let code = '';
    if (globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(len);
      globalThis.crypto.getRandomValues(arr);
      for (let i = 0; i < len; i++) code += digits[arr[i] % 10];
    } else {
      for (let i = 0; i < len; i++) code += digits[Math.floor(Math.random() * 10)];
    }
    if (/^0+$/.test(code)) return generateOtp(len);
    return code;
  };

  const onRegister = async () => {
    try {
      if (!locationReady) {
        Alert.alert('Location required', 'Enable device location to continue.');
        return;
      }
      setLoading(true);

      const normalizedPhoneNumber = regPhone.replace(/[^\d]/g, '');
      const normalizedCountryDigits = callingCode.replace(/[^\d]/g, '');
      const normalizedCountryCode = normalizedCountryDigits ? `+${normalizedCountryDigits}` : '';
      if (!normalizedCountryCode) {
        return Alert.alert('Registration failed', 'Country code is required.');
      }
      const phoneE164 = `${normalizedCountryCode}${normalizedPhoneNumber}`;

      const deviceId = await ensureDeviceId();
      const payload: Record<string, any> = {
        phone: phoneE164,
        phone_country_code: normalizedCountryCode,
        phone_number: normalizedPhoneNumber,
        password: regPassword,
        password2: regPassword2,
        country: countryISO,
        device_id: deviceId,
        device_platform: Platform.OS,
      };
      if (displayName.trim()) payload.display_name = displayName.trim();

      const res = await postRequest(ROUTES.auth.register, payload, {
        cacheKey: 'USER_KEY',
        cacheType: 'AUTH_CACHE',
        errorMessage: 'Unable to register.',
      });

      if (!res?.success) {
        const msg =
          res?.message ||
          res?.data?.message ||
          res?.data?.detail ||
          'Please review your details and try again.';
        return Alert.alert('Registration failed', msg);
      }

      await persistTokensIfAny(res);

      const user = res.data?.user || res.data || {};
      const isActive = user?.is_active ?? user?.status === 'active';

      if (isActive) {
        Alert.alert('Success', 'Account created and activated.');
        // e.g. navigation.replace('Home');
      }

      // Not active yet → generate OTP, ask backend to send SMS via Infobip, then go to verification
      const code = generateOtp(6);

      const otpInitRes = await postRequest(
        ROUTES.auth.otp,
        {
          phone: phoneE164,
          code,
          channel: 'sms',
          purpose: 'register',
        },
        { errorMessage: 'Unable to send verification code.' }
      );

      if (!otpInitRes?.success) {
        const msg =
          otpInitRes?.message ||
          otpInitRes?.data?.message ||
          otpInitRes?.data?.detail ||
          'We could not send your verification code. Please try again.';
        return Alert.alert('SMS failed', msg);
      }

      Alert.alert('Almost done', 'We sent you a verification code via SMS.');
      navigation.navigate('DeviceVerification', {
        phone: phoneE164,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected issue occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.replace?.('Welcome');
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <StatusBar
        barStyle={tone === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={palette.bg}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={[styles.topBar, { backgroundColor: palette.surface }]}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <KISText preset="h3" color={palette.text} style={styles.backIcon}>
              ←
            </KISText>
            <KISText preset="body" color={palette.text} style={styles.backText}>
              Back
            </KISText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBlock}>
            <KISText preset="h1" color={palette.text}>
              Create account
            </KISText>
            <KISText preset="body" color={palette.subtext}>
              Phone required; country auto-detected
            </KISText>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.subtext}>
              Display Name (optional)
            </KISText>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              placeholder="John Doe"
              placeholderTextColor={palette.subtext}
              style={[styles.input, inputStyle]}
            />
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>
              Phone
            </KISText>
            <View style={styles.phoneRow}>
              <View
                style={[
                  styles.prefixBox,
                  {
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.surface,
                  },
                ]}
                accessible
                accessibilityLabel={`Country ${countryISO}, code ${callingCode}`}
              >
                <KISText preset="title" color={palette.text}>
                  {countryISO}
                </KISText>
                <KISText preset="title" color={palette.text}>
                  {callingCode}
                </KISText>
              </View>
              <TextInput
                value={regPhone}
                onChangeText={onChangeRegPhone}
                autoCapitalize="none"
                keyboardType="phone-pad"
                placeholder="6xx xxx xxx"
                placeholderTextColor={palette.subtext}
                style={[
                  styles.input,
                  inputStyle,
                  styles.phoneInput,
                  !!regPhone && !phoneValid && { borderColor: palette.danger },
                ]}
                textContentType="telephoneNumber"
              />
            </View>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>
              Password
            </KISText>
            <TextInput
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              placeholder="Choose a strong password"
              placeholderTextColor={palette.subtext}
              style={[
                styles.input,
                inputStyle,
                !!regPassword && !passwordValid(regPassword) && { borderColor: palette.danger },
              ]}
              textContentType="newPassword"
            />

            {/* Password Requirements */}
            <View style={{ marginTop: 4 }}>
            <View style={styles.passwordReqList}>
              <KISText preset="helper" color={palette.subtext} style={styles.passwordReqTitle}>
                Password must include:
              </KISText>
              <KISText
                preset="helper"
                style={[
                  styles.passwordReqItem,
                  {
                    color: regPassword.length >= 10 ? palette.success : palette.danger,
                  },
                ]}
              >
                • At least 10 characters
              </KISText>
              <KISText
                preset="helper"
                style={[
                  styles.passwordReqItem,
                  {
                    color: /[A-Z]/.test(regPassword) ? palette.success : palette.danger,
                  },
                ]}
              >
                • One uppercase letter (A-Z)
              </KISText>
              <KISText
                preset="helper"
                style={[
                  styles.passwordReqItem,
                  {
                    color: /[a-z]/.test(regPassword) ? palette.success : palette.danger,
                  },
                ]}
              >
                • One lowercase letter (a-z)
              </KISText>
              <KISText
                preset="helper"
                style={[
                  styles.passwordReqItem,
                  {
                    color: /[0-9]/.test(regPassword) ? palette.success : palette.danger,
                  },
                ]}
              >
                • One number (0-9)
              </KISText>
            </View>
          </View>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>
              Confirm Password
            </KISText>
            <TextInput
              value={regPassword2}
              onChangeText={setRegPassword2}
              secureTextEntry
              placeholder="Re-enter password"
              placeholderTextColor={palette.subtext}
              style={[
                styles.input,
                inputStyle,
                !!regPassword2 && regPassword2 !== regPassword && { borderColor: palette.danger },
              ]}
              textContentType="newPassword"
            />
          </View>

          {/* Country is auto-detected from device location */}
          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>
              Country
            </KISText>
            <View
              style={[
                styles.input,
                styles.readonly,
                {
                  borderColor: palette.inputBorder,
                  backgroundColor: palette.surfaceElevated,
                },
              ]}
            >
              <KISText preset="title" color={palette.text}>
                {countryISO}
              </KISText>
            </View>
          </View>

          <KISButton
            title={loading ? undefined : 'Create Account'}
            onPress={onRegister}
            disabled={!registerReady}
            variant="primary"
            size="md"
          >
            {loading ? <ActivityIndicator /> : null}
          </KISButton>

          <KISText preset="helper" color={palette.subtext} style={styles.privacy}>
            By creating an account, you agree to our Terms and Privacy Policy.
          </KISText>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
