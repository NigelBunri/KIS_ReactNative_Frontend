import React, { useCallback, useState } from 'react';
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
import ROUTES from '@/network';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { useAuth } from '../../App';

type Step = 'identify' | 'verify' | 'done';

export default function ParentRecoveryScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const { setAuth, setUser } = useAuth();
  const responsive = useResponsiveLayout();
  const formMaxWidth = Math.min(480, responsive.contentMaxWidth - 32);

  const [step, setStep] = useState<Step>('identify');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInitiate = useCallback(async () => {
    if (!phone.trim() && !email.trim()) {
      Alert.alert('Required', 'Enter your phone number or email address.');
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (phone.trim()) body.phone = phone.trim();
      if (email.trim()) body.email = email.trim();

      await postRequest(ROUTES.auth.parentRecoveryInit, body, {
        errorMessage: 'Recovery initiation failed.',
      });
      // Always show this message regardless of result — prevents account enumeration
      Alert.alert(
        'Check your email',
        'If an account matches, a recovery code has been sent. It expires in 15 minutes.\n\nNote: there is a 24-hour delay before the parent device role transfers, for your security.',
      );
      setStep('verify');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to initiate recovery.');
    } finally {
      setLoading(false);
    }
  }, [phone, email]);

  const handleConfirm = useCallback(async () => {
    if (!recoveryToken.trim()) {
      Alert.alert('Required', 'Enter the recovery code from your email.');
      return;
    }
    setLoading(true);
    try {
      const deviceId = await ensureDeviceId();
      const res = await postRequest(
        ROUTES.auth.parentRecoveryConfirm,
        {
          recovery_token: recoveryToken.trim(),
          device_id: deviceId,
          device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (recovered)`,
          platform: Platform.OS,
        },
        { errorMessage: 'Recovery confirmation failed.' },
      );

      if (!res?.success) {
        Alert.alert(
          'Invalid code',
          res?.message || res?.data?.detail || 'Recovery code is invalid or expired.',
        );
        return;
      }

      const t = res.data?.tokens ?? res.data ?? {};
      const accessToken = t.access ?? t.access_token;
      if (!accessToken) {
        // Recovery initiated (24-hour delay) — no immediate login token
        setStep('done');
        return;
      }

      setStep('done');
      await setAuthTokens({ accessToken, refreshToken: t.refresh ?? t.refresh_token ?? null });
      const resolvedUser = res?.data?.user ?? null;
      await setUserData(resolvedUser, res.data);
      setUser?.(resolvedUser);
      void initE2EE(String(resolvedUser?.id ?? '')).catch(() => {});
      setAuth(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to complete recovery.');
    } finally {
      setLoading(false);
    }
  }, [recoveryToken, setAuth, setUser]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Account Recovery</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.body, { padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
          <KISIcon name="warning" size={36} color={palette.primary} />
        </View>

        {step === 'identify' && (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Recover Primary Device</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              If you lost your primary device, enter your phone number or email. We'll send a recovery code.
              For security, there is a 24-hour delay before the primary role is transferred.
            </Text>

            <View style={[styles.inputGroup, { maxWidth: formMaxWidth }]}>
              <Text style={[styles.label, { color: palette.subtext }]}>Phone number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
                placeholder="+237 6XX XXX XXX"
                placeholderTextColor={palette.subtext}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <Text style={[{ color: palette.subtext, fontWeight: '600', fontSize: 12 }]}>— or —</Text>

            <View style={[styles.inputGroup, { maxWidth: formMaxWidth }]}>
              <Text style={[styles.label, { color: palette.subtext }]}>Email address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
                placeholder="you@example.com"
                placeholderTextColor={palette.subtext}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: palette.primary, opacity: (phone.trim() || email.trim()) && !loading ? 1 : 0.5, maxWidth: formMaxWidth }]}
              onPress={handleInitiate}
              disabled={loading || (!phone.trim() && !email.trim())}
            >
              {loading ? <ActivityIndicator color={palette.ivory} /> : <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Send Recovery Code</Text>}
            </Pressable>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Enter Recovery Code</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Check your email for a 6-character recovery code. It expires in 15 minutes and can only be used once.
            </Text>

            <View style={[styles.inputGroup, { maxWidth: formMaxWidth }]}>
              <Text style={[styles.label, { color: palette.subtext }]}>Recovery code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text, letterSpacing: 4, textAlign: 'center', fontSize: 22, fontWeight: '700' }]}
                placeholder="A1B2C3"
                placeholderTextColor={palette.subtext}
                value={recoveryToken}
                onChangeText={(t) => setRecoveryToken(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={64}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: palette.primary, opacity: recoveryToken.trim() && !loading ? 1 : 0.5, maxWidth: formMaxWidth }]}
              onPress={handleConfirm}
              disabled={loading || !recoveryToken.trim()}
            >
              {loading ? <ActivityIndicator color={palette.ivory} /> : <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Verify & Recover</Text>}
            </Pressable>

            <Pressable onPress={() => setStep('identify')} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: palette.subtext }]}>← Back</Text>
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Recovery Initiated</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Your recovery is being processed. This device will become your primary device within 24 hours. You are now logged in.
            </Text>
            <View style={[styles.successBox, { backgroundColor: `${palette.success}22`, borderColor: palette.success, maxWidth: formMaxWidth }]}>
              <KISIcon name="check" size={20} color={palette.success} />
              <Text style={{ color: palette.success, fontWeight: '700', fontSize: 14 }}>Logged in successfully</Text>
            </View>
          </>
        )}

        <View style={[styles.securityNote, { backgroundColor: palette.surface, borderColor: palette.divider, maxWidth: formMaxWidth }]}>
          <KISIcon name="lock" size={14} color={palette.subtext} />
          <Text style={[styles.securityNoteText, { color: palette.subtext }]}>
            For your security, the 24-hour delay gives you time to cancel if this recovery was not initiated by you.
            All recovery attempts are logged and audited.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  body: { alignItems: 'center', gap: 16 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22 },
  inputGroup: { width: '100%', gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    fontSize: 15,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  securityNoteText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
});
