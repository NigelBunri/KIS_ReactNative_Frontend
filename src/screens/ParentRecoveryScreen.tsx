import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISAUTH_BASE_URL } from '@/network/config';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { launchKisAuthFlow } from '@/security/kisAuthBrowser';
import { useAuth } from '../../App';

const KIS_AUTH_RECOVERY_REDIRECT_URI = 'https://kis.app/auth/kisauth-callback';

// Email/SMS-code recovery has been removed; KIS Auth (Google) is now the
// only account-recovery mechanism. 'idle' just shows the explainer + the
// one action; 'done' is the success state.
type Step = 'idle' | 'done';

const SUPPORT_CONTACT_COPY =
  "We couldn't complete recovery with that Google account. If you haven't connected a Google account to KIS, " +
  'email support@kingdomimpact.social for help regaining access.';

// Not in RootStackParamList (src/navigation/types.ts) — that file had
// unrelated uncommitted changes in flight from a concurrent session when
// this was written, so these params are read locally via useRoute()
// instead of extending the shared navigator types.
type KisAuthCallbackParams = { kisAuthCode?: string; kisAuthState?: string };

export default function ParentRecoveryScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { setAuth, setUser } = useAuth();
  const responsive = useResponsiveLayout();
  const formMaxWidth = Math.min(480, responsive.contentMaxWidth - 32);

  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [kisAuthLoading, setKisAuthLoading] = useState(false);

  // Set when the KIS Auth browser round trip is launched; compared against
  // the state query param on return so a deep link this screen didn't
  // itself initiate (or a replayed one) is rejected rather than acted on.
  const kisAuthExpectedState = useRef<string | null>(null);
  // Guards against double-handling the same deep link (e.g. a duplicate
  // AppState/Linking event firing for one physical return-to-app).
  const kisAuthHandledCode = useRef<string | null>(null);

  const completeKisAuthRecovery = useCallback(
    async (code: string) => {
      setLoading(true);
      try {
        const deviceId = await ensureDeviceId();
        const res = await postRequest(
          ROUTES.auth.kisAuthRecoveryComplete,
          {
            authorization_code: code,
            redirect_uri: KIS_AUTH_RECOVERY_REDIRECT_URI,
            device_id: deviceId,
            device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (recovered via KIS Auth)`,
            platform: Platform.OS,
          },
          { errorMessage: 'Recovery via KIS Auth failed.' },
        );

        if (!res?.success) {
          Alert.alert('Recovery failed', res?.message || res?.data?.detail || SUPPORT_CONTACT_COPY);
          return;
        }

        const accessToken = res.data?.access;
        if (!accessToken) {
          Alert.alert('Recovery failed', SUPPORT_CONTACT_COPY);
          return;
        }

        setStep('done');
        await setAuthTokens({ accessToken, refreshToken: res.data?.refresh ?? null });
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
    },
    [setAuth, setUser],
  );

  const handleKisAuthRecovery = useCallback(async () => {
    setKisAuthLoading(true);
    try {
      const deviceId = await ensureDeviceId();
      const state = `${deviceId}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      kisAuthExpectedState.current = state;
      const url =
        `${KISAUTH_BASE_URL}/authorize` +
        `?client_id=kis-mobile` +
        `&redirect_uri=${encodeURIComponent(KIS_AUTH_RECOVERY_REDIRECT_URI)}` +
        `&purpose=recovery` +
        `&state=${encodeURIComponent(state)}`;

      const outcome = await launchKisAuthFlow(url, KIS_AUTH_RECOVERY_REDIRECT_URI);
      if (outcome.kind === 'pending') {
        // InAppBrowser wasn't available — the deep-link effect below
        // handles the result once the universal link routes back here.
        return;
      }
      if (outcome.kind === 'cancelled') {
        return;
      }
      if (outcome.state !== state) {
        Alert.alert('Error', 'We could not complete this authentication request.');
        return;
      }
      if (outcome.kind === 'error') {
        // Deliberately the same generic message regardless of the real
        // failure reason (not_linked vs. anything else) — distinguishing
        // them would let an attacker enumerate which Google accounts are
        // linked to a KIS account.
        Alert.alert('Recovery failed', SUPPORT_CONTACT_COPY);
        return;
      }
      kisAuthHandledCode.current = outcome.code;
      await completeKisAuthRecovery(outcome.code);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to start KIS Auth recovery.');
    } finally {
      setKisAuthLoading(false);
    }
  }, [completeKisAuthRecovery]);

  useEffect(() => {
    const params = (route.params ?? {}) as KisAuthCallbackParams;
    if (!params.kisAuthCode || !params.kisAuthState) return;
    if (kisAuthHandledCode.current === params.kisAuthCode) return;
    if (!kisAuthExpectedState.current || params.kisAuthState !== kisAuthExpectedState.current) {
      // Either this screen never launched a KIS Auth attempt (app was
      // killed and relaunched by the link) or the state doesn't match —
      // fail closed rather than guess. The user can just retry.
      Alert.alert('Error', 'We could not complete this authentication request.');
      return;
    }
    kisAuthHandledCode.current = params.kisAuthCode;
    void completeKisAuthRecovery(params.kisAuthCode);
  }, [route.params, completeKisAuthRecovery]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
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

        {step === 'idle' && (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Recover Your Account</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              If you lost your primary device or forgot your password, recover access using the Google account
              previously linked to your KIS account. Verifying it makes this device your primary immediately and
              signs your previous primary device out.
            </Text>

            <Pressable
              style={[
                styles.primaryBtn,
                { backgroundColor: palette.primary, opacity: kisAuthLoading ? 0.6 : 1, maxWidth: formMaxWidth },
              ]}
              onPress={handleKisAuthRecovery}
              disabled={kisAuthLoading || loading}
            >
              {kisAuthLoading ? (
                <ActivityIndicator color={palette.ivory} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Recover with Google</Text>
              )}
            </Pressable>

            <Text style={[styles.subtitle, { color: palette.subtext, fontSize: 12, lineHeight: 17 }]}>
              Haven't connected a Google account, or recovery didn't work? Email support@kingdomimpact.social for
              help regaining access.
            </Text>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Recovery Complete</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              This device is now your primary device. Your previous primary device has been signed out immediately. You are now logged in.
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
            Recovery transfers primary-device status immediately once Google confirms your identity — your previous
            primary device is signed out as soon as this completes. All recovery attempts are logged and audited.
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
