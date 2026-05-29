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
import { useKISTheme } from '@/theme/useTheme';
import KISText from '@/components/common/KISText';
import { KIS_TOKENS } from '@/theme/constants';

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
      borderWidth: 2,
      borderRadius: tokens.radius.lg,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: Platform.select({ ios: 12, android: 10 }),
      minWidth: 88,
    },
    prefixPlus: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
      marginRight: 2,
    },
    prefixInput: {
      fontSize: tokens.typography.body,
      minWidth: 48,
      padding: 0,
    },
    phoneInput: {
      flex: 1,
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
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.lg,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      flexShrink: 0,
    },
    termsText: {
      flex: 1,
      lineHeight: 20,
    },
    spacer: {
      height: tokens.spacing['3xl'],
    },
  });

export default function RegisterScreen({ navigation }: any) {
  const { palette, tokens, tone } = useKISTheme();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const inputStyle = useMemo(
    () => ({
      borderColor: palette.inputBorder,
      backgroundColor: palette.inputBg,
      color: palette.text,
    }),
    [palette],
  );

  const [displayName, setDisplayName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  // User manually enters country calling code digits (without +), e.g. "237"
  const [callingCodeDigits, setCallingCodeDigits] = useState('237');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const onChangeRegPhone = useCallback((value: string) => {
    setRegPhone(String(value || '').replace(/[^\d]/g, '').slice(0, 14));
  }, []);

  const onChangeCallingCode = useCallback((value: string) => {
    // Keep only digits, max 4 (country codes are 1-4 digits)
    setCallingCodeDigits(String(value || '').replace(/[^\d]/g, '').slice(0, 4));
  }, []);

  const callingCode = useMemo(
    () => (callingCodeDigits ? `+${callingCodeDigits}` : ''),
    [callingCodeDigits],
  );

  const passwordValid = (pwd: string) =>
    pwd.length >= 10 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd);

  const phoneValid = regPhone.trim().replace(/[^\d]/g, '').length >= 6;
  const countryCodeValid = callingCodeDigits.length >= 1;
  const passwordsMatch = regPassword.length > 0 && regPassword === regPassword2;

  const registerReady =
    countryCodeValid &&
    phoneValid &&
    passwordValid(regPassword) &&
    passwordsMatch &&
    termsAgreed &&
    !loading;

  const onRegister = async () => {
    try {
      setLoading(true);
      const normalizedPhone = regPhone.replace(/[^\d]/g, '');
      if (!callingCode) {
        return Alert.alert('Registration failed', 'Country code is required.');
      }
      const phoneE164 = `${callingCode}${normalizedPhone}`;

      const deviceId = await ensureDeviceId();
      const payload: Record<string, any> = {
        phone: phoneE164,
        phone_country_code: callingCode,
        phone_number: normalizedPhone,
        password: regPassword,
        password2: regPassword2,
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

      // Account created — now verify. No tokens yet.
      navigation.navigate('VerificationChannelSelect', { phone: phoneE164 });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected issue occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation.replace?.('Welcome');
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
            <KISText preset="h3" color={palette.text} style={styles.backIcon}>←</KISText>
            <KISText preset="body" color={palette.text} style={styles.backText}>Back</KISText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: palette.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBlock}>
            <KISText preset="h1" color={palette.text}>Create account</KISText>
            <KISText preset="body" color={palette.subtext}>
              Enter your country code and phone number
            </KISText>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.subtext}>Display Name (optional)</KISText>
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
            <KISText preset="label" color={palette.text}>Phone</KISText>
            <View style={styles.phoneRow}>
              {/* Country code input — digits only, user types e.g. 237 */}
              <View
                style={[
                  styles.prefixBox,
                  {
                    borderColor: countryCodeValid ? palette.inputBorder : palette.danger,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <KISText preset="body" color={palette.subtext} style={styles.prefixPlus}>+</KISText>
                <TextInput
                  value={callingCodeDigits}
                  onChangeText={onChangeCallingCode}
                  keyboardType="number-pad"
                  placeholder="237"
                  placeholderTextColor={palette.subtext}
                  style={[styles.prefixInput, { color: palette.text }]}
                  maxLength={4}
                  accessibilityLabel="Country calling code"
                />
              </View>
              <TextInput
                value={regPhone}
                onChangeText={onChangeRegPhone}
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
            <KISText preset="helper" color={palette.subtext}>
              Enter your country code (e.g. 237 for Cameroon) then your phone number
            </KISText>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>Password</KISText>
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
            <View style={styles.passwordReqList}>
              <KISText preset="helper" color={palette.subtext} style={styles.passwordReqTitle}>
                Password must include:
              </KISText>
              {[
                { label: '• At least 10 characters', ok: regPassword.length >= 10 },
                { label: '• One uppercase letter (A-Z)', ok: /[A-Z]/.test(regPassword) },
                { label: '• One lowercase letter (a-z)', ok: /[a-z]/.test(regPassword) },
                { label: '• One number (0-9)', ok: /[0-9]/.test(regPassword) },
              ].map(({ label, ok }) => (
                <KISText
                  key={label}
                  preset="helper"
                  style={[
                    styles.passwordReqItem,
                    {
                      color:
                        regPassword.length === 0
                          ? palette.subtext
                          : ok
                          ? palette.success
                          : palette.danger,
                    },
                  ]}
                >
                  {label}
                </KISText>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <KISText preset="label" color={palette.text}>Confirm Password</KISText>
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

          <KISButton
            title={loading ? undefined : 'Create Account'}
            onPress={onRegister}
            disabled={!registerReady}
            variant="primary"
            size="md"
          >
            {loading ? <ActivityIndicator /> : null}
          </KISButton>

          <Pressable
            onPress={() => setTermsAgreed(v => !v)}
            style={styles.termsRow}
            hitSlop={8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: termsAgreed ? palette.primary : palette.inputBorder,
                  backgroundColor: termsAgreed ? palette.primary : 'transparent',
                },
              ]}
            >
              {termsAgreed && (
                <KISText preset="helper" style={{ color: '#fff', fontWeight: '900', lineHeight: 14 }}>
                  ✓
                </KISText>
              )}
            </View>
            <KISText preset="helper" color={palette.subtext} style={styles.termsText}>
              I have read and agree to the{' '}
              <KISText
                preset="helper"
                color={palette.primary}
                style={{ fontWeight: '600' }}
                onPress={() => navigation.navigate('TermsAndConditions')}
              >
                Terms & Conditions
              </KISText>
              {' '}and{' '}
              <KISText
                preset="helper"
                color={palette.primary}
                style={{ fontWeight: '600' }}
                onPress={() => navigation.navigate('TermsAndConditions')}
              >
                Privacy Policy
              </KISText>
            </KISText>
          </Pressable>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
