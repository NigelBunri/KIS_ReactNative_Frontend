// src/screens/EmailVerificationScreen.tsx
// Lets an already-authenticated user set/confirm their email and verify it
// via OTP (purpose="email_verify"). A verified email is required before the
// account-recovery flow (ParentRecoveryScreen) will act on it — this screen
// exists so a user can do this ahead of time, not only after losing their
// primary device.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { ensureDeviceId } from '@/security/e2ee';
import { useAuth } from '../../App';

type Step = 'email' | 'code' | 'done';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailVerificationScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const { user, setUser } = useAuth();

  const alreadyHasEmail = !!user?.email;
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(user?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(palette, responsive.contentMaxWidth), [palette, responsive.contentMaxWidth]);

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      Alert.alert('Verify email', 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      // The email_verify OTP always mails the account's email on file, so a
      // changed/new address must be saved first, or the code goes nowhere.
      if (trimmed !== (user?.email || '')) {
        const userId = user?.id;
        if (!userId) throw new Error('Unable to update account details.');
        const saveRes = await patchRequest(
          ROUTES.user.detail(userId),
          { email: trimmed },
          { errorMessage: 'Unable to save email address.' },
        );
        if (!saveRes?.success) {
          throw new Error(saveRes?.message || 'Unable to save email address.');
        }
        setUser?.({ ...(user as any), email: trimmed, email_verified: false });
      }

      const deviceId = await ensureDeviceId();
      const res = await postRequest(
        ROUTES.auth.otp,
        {
          phone: user?.phone,
          purpose: 'email_verify',
          channel: 'email',
          device_id: deviceId,
        },
        { errorMessage: 'Unable to send verification code.' },
      );
      if (!res?.success) {
        throw new Error(res?.message || res?.data?.message || 'Unable to send verification code.');
      }
      setStep('code');
    } catch (err: any) {
      Alert.alert('Verify email', err?.message || 'Unable to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      Alert.alert('Verify email', 'Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const deviceId = await ensureDeviceId();
      const res = await postRequest(
        ROUTES.auth.sendDeviceCode,
        {
          phone: user?.phone,
          purpose: 'email_verify',
          code: trimmedCode,
          device_id: deviceId,
        },
        { errorMessage: 'Verification failed.' },
      );
      if (!res?.success) {
        throw new Error(res?.message || res?.data?.message || 'Invalid or expired code.');
      }
      setUser?.({ ...(user as any), email_verified: true });
      setStep('done');
    } catch (err: any) {
      Alert.alert('Verify email', err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <KISIcon name="chevron-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Verify Email</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={{ color: palette.subtext, fontSize: 14, lineHeight: 20 }}>
            A verified email lets you recover your account if you ever lose access to
            your primary device. It's not used for anything else.
          </Text>

          {step === 'email' && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>
                  {alreadyHasEmail ? 'Email address' : 'Add an email address'}
                </Text>
                <View style={[styles.inputRow, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
                  <TextInput
                    style={[styles.input, { color: palette.text }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={palette.subtext}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: palette.primary, opacity: loading ? 0.6 : 1 }]}
                onPress={sendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={palette.onPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Send Verification Code</Text>
                )}
              </Pressable>
            </View>
          )}

          {step === 'code' && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={{ color: palette.text, fontSize: 14 }}>
                Enter the 6-digit code sent to {email.trim()}.
              </Text>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Verification code</Text>
                <View style={[styles.inputRow, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
                  <TextInput
                    style={[styles.input, { color: palette.text, letterSpacing: 6, textAlign: 'center', fontWeight: '700' }]}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    placeholderTextColor={palette.subtext}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                  />
                </View>
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: palette.primary, opacity: loading ? 0.6 : 1 }]}
                onPress={verifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={palette.onPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Verify</Text>
                )}
              </Pressable>

              <Pressable onPress={() => setStep('email')} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
                  ← Use a different email
                </Text>
              </Pressable>
            </View>
          )}

          {step === 'done' && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider, alignItems: 'center', gap: 10 }]}>
              <KISIcon name="check" size={28} color={palette.success} />
              <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>Email verified</Text>
              <Pressable
                style={[styles.submitButton, { backgroundColor: palette.primary, width: '100%' }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.submitButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ReturnType<typeof useKISTheme>['palette'], contentMaxWidth: number) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    content: {
      padding: 18,
      gap: 16,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 18 },
    fieldGroup: { gap: 6 },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
    },
    input: { flex: 1, fontSize: 16, paddingVertical: 12 },
    submitButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    submitButtonText: { color: palette.onPrimary, fontSize: 16, fontWeight: '800' },
  });
