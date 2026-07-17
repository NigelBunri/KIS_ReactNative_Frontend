// src/screens/RegisterScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Country, CountryCode } from 'react-native-country-picker-modal';
import SafeCountryPicker from '@/components/common/SafeCountryPicker';
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
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

import { setUserData } from '@/network/cache';
import { postRequest } from '@/network/post/index';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { getSimPhoneNumber } from '@/services/simInfo';
import { setAuthTokens } from '@/security/authStorage';
import { useAuth } from '../../App';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISText from '@/components/common/KISText';
import { KIS_TOKENS } from '@/theme/constants';

const createStyles = (tokens: typeof KIS_TOKENS, contentMaxWidth: number) =>
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
    backText: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
    },
    container: {
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.lg,
      flexGrow: 1,
      justifyContent: 'center',
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
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
      minWidth: 80,
      gap: tokens.spacing.xs,
    },
    prefixPlus: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
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
  const { setAuth, setUser } = useAuth();
  const { palette, tokens, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const styles = useMemo(() => createStyles(tokens, responsive.contentMaxWidth), [tokens, responsive.contentMaxWidth]);
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
  const [countryCode, setCountryCode] = useState<CountryCode>('CM');
  const [callingCode, setCallingCode] = useState('+237');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const onChangeRegPhone = useCallback((value: string) => {
    setRegPhone(String(value || '').replace(/[^\d]/g, '').slice(0, 14));
  }, []);

  const onCountrySelect = useCallback((country: Country) => {
    const code = country.callingCode?.[0];
    if (code) setCallingCode(`+${code}`);
    setCountryCode(country.cca2 as CountryCode);
    setCountryPickerVisible(false);
  }, []);

  const passwordValid = (pwd: string) =>
    pwd.length >= 10 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd);

  const phoneValid = regPhone.trim().replace(/[^\d]/g, '').length >= 6;
  const countryCodeValid = callingCode.replace(/[^\d]/g, '').length >= 1;
  const passwordsMatch = regPassword.length > 0 && regPassword === regPassword2;

  const registerReady =
    countryCodeValid &&
    phoneValid &&
    passwordValid(regPassword) &&
    passwordsMatch &&
    termsAgreed &&
    !loading;

  const onRegister = async () => {
    const normalizedPhone = regPhone.replace(/[^\d]/g, '');
    if (!callingCode) {
      Alert.alert('Registration failed', 'Country code is required.');
      return;
    }
    if (!normalizedPhone || !passwordValid(regPassword) || regPassword !== regPassword2 || !termsAgreed) {
      return;
    }
    try {
      setLoading(true);
      const phoneE164 = `${callingCode}${normalizedPhone}`;

      // Best-effort: Android only (iOS has no API for this). If the SIM's own
      // number doesn't match what was typed, warn but let the user proceed —
      // OTP verification is suspended, so this is the closest we can get to
      // proof of ownership, and many Android devices won't expose it anyway.
      const simPhoneNumber = await getSimPhoneNumber();
      if (simPhoneNumber) {
        const simDigits = simPhoneNumber.replace(/[^\d]/g, '');
        const simMatches =
          simDigits.endsWith(normalizedPhone) || normalizedPhone.endsWith(simDigits);
        if (!simMatches) {
          const proceed = await new Promise<boolean>(resolve => {
            Alert.alert(
              "Number doesn't match this device's SIM",
              "The number you entered doesn't match this device's SIM card. Using your SIM number lets this device be recognized as your primary device later without needing a QR code.",
              [
                { text: 'Edit number', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Use this number anyway', onPress: () => resolve(true) },
              ],
            );
          });
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      const deviceId = await ensureDeviceId();
      const payload: Record<string, any> = {
        phone: phoneE164,
        phone_country_code: callingCode,
        phone_number: normalizedPhone,
        country: countryCode,
        password: regPassword,
        password2: regPassword2,
        device_id: deviceId,
        device_platform: Platform.OS,
        ...(simPhoneNumber ? { sim_phone_number: simPhoneNumber } : {}),
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

      // Persist country selection so login screen can pre-populate it
      await AsyncStorage.multiSet([
        ['user_dial_code', callingCode],
        ['user_country_code', countryCode],
      ]);

      // Phone verification suspended (FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED false):
      // the backend auto-verifies and returns tokens directly, so log the user in now.
      const accessToken = res?.data?.access || res?.data?.access_token;
      if (!FEATURE_FLAGS.PHONE_VERIFICATION_ENABLED && accessToken) {
        await setAuthTokens({
          accessToken,
          refreshToken: res?.data?.refresh || res?.data?.refresh_token || null,
        });
        const resolvedUser = res?.data?.user ?? null;
        await setUserData(resolvedUser, res.data);
        setUser?.(resolvedUser);
        void initE2EE(String(resolvedUser?.id ?? '')).catch(() => {});
        setAuth(true);
        return;
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
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <StatusBar
        barStyle={tone === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={palette.bg}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <Ionicons name="chevron-back" size={22} color={palette.text} />
            <KISText preset="body" color={palette.text} style={styles.backText}>Back</KISText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: palette.bg, }]}
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
              {/* Country picker button */}
              <Pressable
                onPress={() => setCountryPickerVisible(true)}
                style={[
                  styles.prefixBox,
                  { borderColor: palette.inputBorder, backgroundColor: palette.surface },
                ]}
                accessibilityLabel="Select country code"
                accessibilityRole="button"
              >
                <KISText preset="body" color={palette.text} style={styles.prefixPlus}>
                  {callingCode}
                </KISText>
                <KISText preset="helper" color={palette.subtext}>▾</KISText>
              </Pressable>
              <SafeCountryPicker
                visible={countryPickerVisible}
                countryCode={countryCode}
                onSelect={onCountrySelect}
                onClose={() => setCountryPickerVisible(false)}
              />
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
              Tap the country code to change it
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
                <KISText preset="helper" style={{ color: palette.onPrimary, fontWeight: '900', lineHeight: 14 }}>
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
                onPress={() => navigation.navigate('PrivacyPolicy')}
              >
                Privacy Policy
              </KISText>
            </KISText>
          </Pressable>

          <KISButton
            title={loading ? undefined : 'Create Account'}
            onPress={onRegister}
            disabled={!registerReady}
            variant="primary"
            size="md"
          >
            {loading ? <ActivityIndicator /> : null}
          </KISButton>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
