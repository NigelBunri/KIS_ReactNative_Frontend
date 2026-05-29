// src/screens/LoginScreen.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import KISButton from '../constants/KISButton';
import KISTextInput from '../constants/KISTextInput';
import KISText from '@/components/common/KISText';
import { setUserData } from '@/network/cache';
import { postRequest } from '@/network/post/index';
import ROUTES from '@/network';
import { useAuth } from '../../App';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { setAuthTokens } from '@/security/authStorage';
import { KIS_TOKENS } from '@/theme/constants';

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    root: {
      flex: 1,
      padding: tokens.spacing['2xl'],
      gap: tokens.spacing.lg,
    },
    backBtn: {
      marginBottom: tokens.spacing.sm,
      alignSelf: 'flex-start',
    },
    backTxt: {
      fontSize: tokens.typography.title,
      fontWeight: tokens.typography.weight.bold,
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
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: tokens.spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
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
  });

export default function LoginScreen({ navigation }: any) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const { setAuth, setPhone, setUser } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    return navigation.addListener('focus', () => setQrLoading(false));
  }, [navigation]);

  const onChangePhoneNumber = useCallback((value: string) => {
    const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 14);
    setPhoneNumber(digits);
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
      const payload = {
        phone_number: normalizedPhone,
        password,
        device_id: deviceId,
        device_platform: Platform.OS,
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
        const isVerifyRequired =
          errorCode === 'phone_not_verified' ||
          String(res?.message ?? '').toLowerCase().includes('verif') ||
          String(res?.data?.detail ?? '').toLowerCase().includes('verif');

        if (isVerifyRequired) {
          // Use server-returned phone (E.164) or fall back to what the user typed
          const phone = String(
            res?.data?.phone ||
            res?.data?.data?.phone ||
            normalizedPhone ||
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

  const forgotPhoneValid = useMemo(() => {
    if (!forgotPhone) return false;
    if (forgotPhone.startsWith('+')) {
      return forgotPhone.replace(/[^\d]/g, '').length >= 8;
    }
    return /^\d{6,14}$/.test(forgotPhone);
  }, [forgotPhone]);

  const requestResetCode = async () => {
    try {
      if (!forgotPhoneValid || forgotLoading) return;
      setForgotLoading(true);
      const payload = { phone: forgotPhone.trim(), channel: 'sms' };
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
        phone: forgotPhone.trim(),
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
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.root, { backgroundColor: palette.bg }]}
        keyboardShouldPersistTaps="handled"
      >
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
        <KISText preset="label" style={[styles.backTxt, { color: palette.text }]}>
          {Platform.OS === 'ios' ? '‹' : '←'} Back
        </KISText>
      </Pressable>

      <KISText preset="h2" color={palette.text} style={styles.header}>
        Log In
      </KISText>

      <KISTextInput
        label="Phone number"
        placeholder="e.g. 676139881"
        autoCapitalize="none"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={onChangePhoneNumber}
        errorText={phoneNumber.length > 0 && !phoneValid ? 'Enter a valid phone number.' : undefined}
      />
      <KISText preset="helper" color={palette.subtext}>
        Enter your phone number without the country code
      </KISText>

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
        onPress={() => onLogin().catch((e: any) => Alert.alert('Error', e?.message ?? 'Unexpected error while logging in.'))}
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

      </ScrollView>

      <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <KISText preset="h3" color={palette.text} style={styles.modalTitle}>
              Reset password
            </KISText>
            <KISTextInput
              label="Phone number"
              placeholder="e.g. 237676139881 or +237676139881"
              autoCapitalize="none"
              keyboardType="phone-pad"
              value={forgotPhone}
              onChangeText={setForgotPhone}
              errorText={
                forgotPhone.length > 0 && !forgotPhoneValid
                  ? 'Enter a valid phone number (with country code)'
                  : undefined
              }
            />
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
              <Pressable onPress={() => setForgotVisible(false)}>
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
