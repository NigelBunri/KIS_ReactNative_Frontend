// src/screens/LoginScreen.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Country, CountryCode } from 'react-native-country-picker-modal';
import SafeCountryPicker from '@/components/common/SafeCountryPicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '../constants/KISButton';
import KISTextInput from '../constants/KISTextInput';
import KISText from '@/components/common/KISText';
import { setUserData } from '@/network/cache';
import { postRequest } from '@/network/post/index';
import ROUTES from '@/network';
import { useAuth } from '../../App';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { getSimPhoneNumber } from '@/services/simInfo';
import { setAuthTokens } from '@/security/authStorage';
import { KIS_TOKENS } from '@/theme/constants';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

const makeStyles = (tokens: typeof KIS_TOKENS, modalMaxWidth: number, backdropColor: string) =>
  StyleSheet.create({
    root: {
      flex: 1,
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.lg,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: tokens.spacing.sm,
      gap: 2,
    },
    backTxt: {
      fontSize: tokens.typography.body,
      fontWeight: tokens.typography.weight.semibold,
    },
    header: {
      fontSize: tokens.typography.h2,
      fontWeight: tokens.typography.weight.extrabold,
      marginTop: tokens.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: tokens.spacing.md,
      marginTop: tokens.spacing.xs,
    },
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm,
    },
    bottomCallout: {
      alignItems: 'center',
      marginTop: tokens.spacing['2xl'],
    },
    centerText: {
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: backdropColor,
      padding: tokens.spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: modalMaxWidth,
      borderRadius: tokens.radius.xl,
      padding: tokens.spacing.lg,
    },
    modalTitle: {
      fontSize: tokens.typography.h3,
      fontWeight: tokens.typography.weight.bold,
      marginBottom: tokens.spacing.sm,
    },
    modalRow: {
      marginTop: tokens.spacing.md,
      gap: tokens.spacing.lg,
    },
    link: {
      textDecorationLine: 'underline',
    },
    secondaryDeviceBtn: {
      borderWidth: 1.5,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: tokens.spacing.sm,
    },
    prefixBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: Platform.select({ ios: 13, android: 11 }),
      gap: tokens.spacing.xs,
    },
    phoneInput: {
      flex: 1,
    },
  });

export default function LoginScreen({ navigation }: any) {
  const { palette, tokens } = useKISTheme();
  const responsive = useResponsiveLayout();
  const modalMaxWidth = Math.min(440, responsive.contentMaxWidth - 32);
  const styles = useMemo(() => makeStyles(tokens, modalMaxWidth, palette.backdrop), [tokens, modalMaxWidth, palette.backdrop]);
  const { setAuth, setPhone, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('CM');
  const [dialCode, setDialCode] = useState('+237');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotDialCode, setForgotDialCode] = useState('+237');
  const [forgotCountryCode, setForgotCountryCode] = useState<CountryCode>('CM');
  const [forgotCountryPickerVisible, setForgotCountryPickerVisible] = useState(false);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    return navigation.addListener('focus', () => setQrLoading(false));
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.multiGet(['user_dial_code', 'user_country_code']).then(pairs => {
      const stored = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (stored.user_dial_code) {
        setDialCode(stored.user_dial_code);
        setForgotDialCode(stored.user_dial_code);
      }
      if (stored.user_country_code) {
        setCountryCode(stored.user_country_code as CountryCode);
        setForgotCountryCode(stored.user_country_code as CountryCode);
      }
    }).catch(() => {});
  }, []);

  const onChangePhoneNumber = useCallback((value: string) => {
    const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 14);
    setPhoneNumber(digits);
  }, []);

  const onCountrySelect = useCallback((country: Country) => {
    const code = country.callingCode?.[0];
    if (code) setDialCode(`+${code}`);
    setCountryCode(country.cca2 as CountryCode);
    setCountryPickerVisible(false);
  }, []);

  const phoneValid = useMemo(
    () => String(phoneNumber || '').replace(/[^\d]/g, '').length >= 6,
    [phoneNumber],
  );

  const canSubmit = phoneValid && password.length > 0 && !loading;

  const persistAuth = async (data: any) => {
    const access = data?.access || data?.access_token;
    const refresh = data?.refresh || data?.refresh_token;
    await setAuthTokens({ accessToken: access ?? null, refreshToken: refresh ?? null });

    if (remember && phoneNumber) {
      await AsyncStorage.setItem('user_phone', phoneNumber.trim());
      setPhone?.(phoneNumber.trim());
    } else {
      await AsyncStorage.removeItem('user_phone');
      setPhone?.(null);
    }
  };

  const onLogin = async () => {
    try {
      if (!canSubmit) return;
      setLoading(true);

      const deviceId = await ensureDeviceId();
      const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
      const phoneE164 = `${dialCode}${normalizedPhone}`;
      // Best-effort: if this device's SIM matches the account's number, the
      // backend recognizes it as the primary device even on a fresh install,
      // skipping the QR re-link requirement. Android only — always null on iOS.
      const simPhoneNumber = await getSimPhoneNumber();
      const payload = {
        phone: phoneE164,
        phone_number: normalizedPhone,
        phone_country_code: dialCode,
        password,
        device_id: deviceId,
        device_platform: Platform.OS,
        ...(simPhoneNumber ? { sim_phone_number: simPhoneNumber } : {}),
      };

      const res = await postRequest(ROUTES.auth.login, payload, {
        errorMessage: 'Unable to log in.',
        cacheType: 'AUTH_CACHE',
        cacheKey: 'USER_KEY',
      });

      if (!res?.success) {
        const errorCode = res?.data?.error_code;
        if (errorCode === 'phone_not_found') {
          return Alert.alert(
            'Phone not registered',
            'This phone number is not registered. Please check the number and try again.',
          );
        }
        if (errorCode === 'wrong_password') {
          return Alert.alert(
            'Wrong password',
            'The password you entered is incorrect. Please try again.',
          );
        }
        if (errorCode === 'account_disabled') {
          return Alert.alert(
            'Account disabled',
            'This account has been disabled. Please contact support.',
          );
        }
        if (
          errorCode === 'secondary_device_qr_required' ||
          res?.data?.secondary_device_required ||
          res?.data?.qr_login_required
        ) {
          return Alert.alert(
            'Use secondary device login',
            'This account is already active on another device. Open Profile -> Manage Devices on the primary device, then link this device with the QR code.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Scan QR',
                onPress: () => navigation.navigate('QRScanLogin'),
              },
            ],
          );
        }
        const isVerifyRequired =
          errorCode === 'phone_not_verified' ||
          String(res?.message ?? '').toLowerCase().includes('verif') ||
          String(res?.data?.detail ?? '').toLowerCase().includes('verif');

        if (isVerifyRequired) {
          // Prefer server-returned E.164; fall back to locally composed E.164 (dialCode + digits)
          const phone = String(
            res?.data?.phone ||
            res?.data?.data?.phone ||
            (normalizedPhone ? `${dialCode}${normalizedPhone}` : '') ||
            '',
          );
          try {
            navigation.navigate('VerificationChannelSelect', { phone, purpose: 'register' });
          } catch {
            Alert.alert(
              'Phone verification required',
              'Your account needs to be verified before you can log in.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Verify Now',
                  onPress: () =>
                    navigation.navigate('VerificationChannelSelect', { phone, purpose: 'register' }),
                },
              ],
            );
          }
          return;
        }
        if (res?.data?.two_factor_required) {
          navigation.navigate('TwoFactor', {
            phone: normalizedPhone,
            tokens: res?.data?.tokens ?? {},
          });
          return;
        }
        const msg =
          res?.message ||
          res?.data?.message ||
          res?.data?.detail ||
          'Invalid phone or password.';
        return Alert.alert('Login failed', String(msg));
      }

      const accessToken = res?.data?.access || res?.data?.access_token;
      if (!accessToken) {
        return Alert.alert('Login failed', 'No authentication token received. Please try again.');
      }

      await persistAuth(res.data);
      const resolvedUser = res?.data?.user ?? null;
      await setUserData(resolvedUser, res.data);
      setUser?.(resolvedUser);
      void initE2EE(String(resolvedUser?.id ?? '')).catch(() => {});
      setAuth(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  const forgotPhoneDigits = useMemo(
    () => String(forgotPhone || '').replace(/[^\d]/g, ''),
    [forgotPhone],
  );
  const forgotPhoneValid = forgotPhoneDigits.length >= 6;
  const forgotPhoneE164 = forgotPhoneValid ? `${forgotDialCode}${forgotPhoneDigits}` : '';

  const onForgotCountrySelect = useCallback((country: Country) => {
    const code = country.callingCode?.[0];
    if (code) setForgotDialCode(`+${code}`);
    setForgotCountryCode(country.cca2 as CountryCode);
    setForgotCountryPickerVisible(false);
  }, []);

  const requestResetCode = async () => {
    try {
      if (!forgotPhoneValid || forgotLoading) return;
      setForgotLoading(true);
      const payload = { phone: forgotPhoneE164, channel: 'sms' };
      const res = await postRequest(ROUTES.auth.forgotPassword, payload, {
        errorMessage: 'Unable to send reset code.',
      });
      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Failed to send code.';
        return Alert.alert('Reset failed', msg);
      }
      setForgotStep('reset');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async () => {
    try {
      if (!forgotPhoneValid || !forgotCode || !forgotPassword || forgotLoading) return;
      setForgotLoading(true);
      const payload = {
        phone: forgotPhoneE164,
        code: forgotCode.trim(),
        new_password: forgotPassword,
      };
      const res = await postRequest(ROUTES.auth.resetPassword, payload, {
        errorMessage: 'Unable to reset password.',
      });
      if (!res?.success) {
        const msg = res?.message || res?.data?.detail || 'Reset failed.';
        return Alert.alert('Reset failed', msg);
      }
      Alert.alert('Success', 'Password reset. Please log in.');
      setForgotVisible(false);
      setForgotStep('request');
      setForgotPhone('');
      setForgotCode('');
      setForgotPassword('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg, marginTop: topInset }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset || tokens.spacing['2xl'], paddingBottom: insets.bottom + tokens.spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={palette.text} />
        <KISText preset="label" style={[styles.backTxt, { color: palette.text }]}>Back</KISText>
      </Pressable>

      <KISText preset="h2" color={palette.text} style={styles.header}>
        Log In
      </KISText>

      <KISText preset="label" color={palette.subtext} style={{ marginBottom: 4 }}>Phone number</KISText>
      <View style={styles.phoneRow}>
        <Pressable
          onPress={() => setCountryPickerVisible(true)}
          style={[styles.prefixBox, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
          accessibilityLabel="Select country code"
          accessibilityRole="button"
        >
          <KISText preset="body" color={palette.text} style={{ fontWeight: '600' }}>{dialCode}</KISText>
          <KISText preset="helper" color={palette.subtext}>▾</KISText>
        </Pressable>
        <SafeCountryPicker
          visible={countryPickerVisible}
          countryCode={countryCode}
          onSelect={onCountrySelect}
          onClose={() => setCountryPickerVisible(false)}
        />
        <KISTextInput
          placeholder="e.g. 676139881"
          autoCapitalize="none"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={onChangePhoneNumber}
          errorText={phoneNumber.length > 0 && !phoneValid ? 'Enter a valid phone number.' : undefined}
          containerStyle={styles.phoneInput}
        />
      </View>

      <KISTextInput
        label="Password"
        placeholder="Your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <View style={styles.inlineRow}>
          <Switch value={remember} onValueChange={setRemember} />
          <KISText preset="helper" color={palette.subtext}>
            Remember me
          </KISText>
        </View>
        <Pressable onPress={() => setForgotVisible(true)}>
          <KISText preset="helper" color={palette.subtext} style={styles.link}>
            Forgot password?
          </KISText>
        </Pressable>
      </View>

      <KISButton
        title={loading ? undefined : 'Log In'}
        onPress={onLogin}
        disabled={!canSubmit}
      >
        {loading ? <ActivityIndicator /> : null}
      </KISButton>

      <Pressable
        onPress={() => {
          setQrLoading(true);
          navigation.navigate('QRScanLogin');
        }}
        disabled={qrLoading}
        style={[styles.secondaryDeviceBtn, { borderColor: palette.primary, opacity: qrLoading ? 0.6 : 1 }]}
      >
        {qrLoading ? (
          <ActivityIndicator color={palette.primary} size="small" />
        ) : (
          <KISText preset="helper" color={palette.primary} style={{ fontWeight: '700', textAlign: 'center' }}>
            Log in as a secondary device (scan QR)
          </KISText>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('ParentRecovery')}>
        <KISText preset="helper" color={palette.subtext} style={[styles.centerText, { textAlign: 'center' }]}>
          Lost your primary device?{' '}
          <KISText preset="helper" color={palette.primary} style={styles.link}>
            Recover account
          </KISText>
        </KISText>
      </Pressable>

      <View style={styles.bottomCallout}>
        <KISText preset="helper" color={palette.subtext} style={styles.centerText}>
          Don't have an account?{' '}
          <KISText
            preset="helper"
            color={palette.text}
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
          >
            Create one
          </KISText>
        </KISText>
      </View>

      <KISText preset="helper" color={palette.subtext} style={[styles.centerText, { textAlign: 'center' }]}>
        <KISText
          preset="helper"
          color={palette.primary}
          style={styles.link}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          Privacy
        </KISText>
        {' · '}
        <KISText
          preset="helper"
          color={palette.primary}
          style={styles.link}
          onPress={() => navigation.navigate('TermsAndConditions')}
        >
          Terms
        </KISText>
      </KISText>

      </ScrollView>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <KISText preset="h3" color={palette.text} style={styles.modalTitle}>
              Reset password
            </KISText>
            <KISText preset="label" color={palette.subtext} style={{ marginBottom: 6 }}>Phone number</KISText>
            <View style={styles.phoneRow}>
              <Pressable
                onPress={() => setForgotCountryPickerVisible(true)}
                style={[styles.prefixBox, { borderColor: palette.inputBorder, backgroundColor: palette.surface }]}
                accessibilityLabel="Select country code"
                accessibilityRole="button"
              >
                <KISText preset="body" color={palette.text} style={{ fontWeight: '600' }}>{forgotDialCode}</KISText>
                <KISText preset="helper" color={palette.subtext}>▾</KISText>
              </Pressable>
              <SafeCountryPicker
                visible={forgotCountryPickerVisible}
                countryCode={forgotCountryCode}
                onSelect={onForgotCountrySelect}
                onClose={() => setForgotCountryPickerVisible(false)}
              />
              <KISTextInput
                placeholder="e.g. 676139881"
                autoCapitalize="none"
                keyboardType="phone-pad"
                value={forgotPhone}
                onChangeText={text => setForgotPhone(text.replace(/[^\d]/g, '').slice(0, 14))}
                errorText={forgotPhone.length > 0 && !forgotPhoneValid ? 'Enter a valid phone number.' : undefined}
                containerStyle={styles.phoneInput}
              />
            </View>
            {forgotStep === 'reset' ? (
              <>
                <KISTextInput
                  label="Code"
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  value={forgotCode}
                  onChangeText={setForgotCode}
                />
                <KISTextInput
                  label="New password"
                  placeholder="New password"
                  secureTextEntry
                  value={forgotPassword}
                  onChangeText={setForgotPassword}
                />
              </>
            ) : null}
            <View style={styles.modalRow}>
              <KISButton
                title={forgotLoading ? undefined : forgotStep === 'request' ? 'Send code' : 'Reset'}
                onPress={forgotStep === 'request' ? requestResetCode : resetPassword}
                disabled={forgotLoading || !forgotPhoneValid || (forgotStep === 'reset' && (!forgotCode || !forgotPassword))}
              >
                {forgotLoading ? <ActivityIndicator /> : null}
              </KISButton>
              <Pressable onPress={() => {
                setForgotVisible(false);
                setForgotStep('request');
                setForgotPhone('');
                setForgotCode('');
                setForgotPassword('');
              }}>
                <KISText preset="helper" color={palette.subtext}>
                  Cancel
                </KISText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
