import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISAUTH_BASE_URL } from '@/network/config';
import { launchKisAuthFlow } from '@/security/kisAuthBrowser';
import { useAuth } from '../../App';

// Distinct from the recovery redirect_uri — kis-auth's client registry
// keys allowed_redirect_uris per exact string, so each purpose gets its
// own path even though all three point at the same domain. This keeps
// deepLinkRouter.ts's routing unambiguous rather than overloading one
// path with a purpose flag baked into app state.
//
// go.kingdomimpactventures.org, not kis.app - kis.app is a parked domain
// KIS never actually owned, so it could never serve a real
// apple-app-site-association file; Universal Links silently failed to
// verify, and the Linking.openURL fallback path landed on a dead page.
const KIS_AUTH_LINK_REDIRECT_URI = 'https://go.kingdomimpactventures.org/auth/kisauth-link-callback';

// Not in RootStackParamList's KisAuthLink entry (currently `undefined`) —
// same situation ParentRecoveryScreen documents for its own deep-link
// params. Read locally via useRoute() rather than widening the shared type.
type KisAuthLinkDeepLinkParams = {
  kisAuthCode?: string;
  kisAuthState?: string;
  kisAuthError?: string;
  // Set when this screen is presented as a modal right after a fresh
  // phone/password registration (see App.tsx's pendingGoogleLinkPrompt
  // effect and the KisAuthLink screen's `presentation: 'modal'` option)
  // rather than opened from Settings. Swaps in the registration-flow copy
  // and adds the "Ignore" affordance — linking stays optional, so this
  // screen must never be a dead end. Not present on deep-link returns from
  // a killed app; in that case this falls back to the Settings framing,
  // which is still safe (the button says the same "Connect to Google" —
  // only the surrounding copy/title and the Ignore affordance differ).
  fromRegistration?: boolean;
};

// This is the ONLY entry point that can ever create a Google-identity
// link (Phase 2 §7/§8 decision: linking happens while already
// authenticated — either right after registration (RegisterScreen calls
// setAuth(true) before this screen ever mounts) or from Settings — never
// inferred from a recovery attempt). Recovery and Google sign-up both
// depend on a link already existing; neither can create one.
export default function KisAuthLinkScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const responsive = useResponsiveLayout();
  const formMaxWidth = Math.min(480, responsive.contentMaxWidth - 32);
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  // Seeded from the already-authenticated user's own server-reported
  // state (never client-writable — see apps.kis_auth_bridge's
  // UserSerializer.Meta.read_only_fields), not just "did THIS screen
  // session complete a link" — otherwise reopening this screen from
  // Settings on an already-linked account would show the "Connect to
  // Google" button again and invite a confusing, redundant attempt.
  const [linked, setLinked] = useState(Boolean(user?.verification?.google?.linked));
  const fromRegistration = Boolean((route.params as KisAuthLinkDeepLinkParams | undefined)?.fromRegistration);

  // Registration already completed and persisted before this screen is ever
  // shown (RegisterScreen calls setAuth(true) first) — so ignoring, failing,
  // or killing the app mid-link never loses the account or forces a retry
  // of registration itself. Ignoring just leaves the identity unlinked;
  // "Connect to Google" above remains available from Settings any time
  // afterward.
  const handleSkip = useCallback(() => {
    if (loading) return;
    navigation.goBack();
  }, [navigation, loading]);

  // Same replay/CSRF guard as ParentRecoveryScreen's expected-state ref —
  // this flow returns to the SAME screen (deepLinkRouter.ts navigates back
  // to 'KisAuthLink'), so a plain ref is enough; no need for the
  // cross-screen pending-state store registration's fallback needs.
  const kisAuthExpectedState = useRef<string | null>(null);
  const kisAuthHandledCode = useRef<string | null>(null);

  const completeLink = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const completeRes = await postRequest(
        ROUTES.auth.kisAuthLinkComplete,
        { code, redirect_uri: KIS_AUTH_LINK_REDIRECT_URI },
        { errorMessage: 'Unable to finish linking your Google account.' },
      );
      if (!completeRes?.success) {
        Alert.alert('Error', 'Unable to finish linking your Google account.');
        return;
      }
      setLinked(true);
      // The link-complete response is deliberately minimal ({ok, linked} —
      // see apps.kis_auth_bridge.KisAuthLinkCompleteView), so it never
      // carries the new verification.google block itself. Refetch the
      // profile so the in-memory user (ProfileScreen's row, and this
      // screen if reopened later this session) reflects "already
      // connected" immediately, not just after the next app restart.
      try {
        const profileRes = await getRequest(ROUTES.auth.profile, { errorMessage: '' });
        if (profileRes?.success && profileRes.data) {
          setUser?.(profileRes.data);
        }
      } catch {
        // Non-fatal — the link itself already succeeded; worst case the
        // "already connected" state just catches up on next app boot.
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to link your Google account.');
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    const params = (route.params ?? {}) as KisAuthLinkDeepLinkParams;
    if (!params.kisAuthCode && !params.kisAuthError) return;
    const dedupeKey = params.kisAuthCode ?? params.kisAuthError ?? '';
    if (kisAuthHandledCode.current === dedupeKey) return;
    if (!kisAuthExpectedState.current || params.kisAuthState !== kisAuthExpectedState.current) {
      Alert.alert('Error', 'We could not complete this authentication request.');
      return;
    }
    kisAuthHandledCode.current = dedupeKey;
    if (params.kisAuthError) {
      Alert.alert(
        'Could not link account',
        params.kisAuthError === 'already_linked'
          ? 'This Google account is already linked to a different KIS account.'
          : 'We could not complete this authentication request.',
      );
      return;
    }
    void completeLink(params.kisAuthCode!);
  }, [route.params, completeLink]);

  const handleLink = useCallback(async () => {
    setLoading(true);
    try {
      const initiateRes = await postRequest(
        ROUTES.auth.kisAuthLinkInitiate,
        {},
        { errorMessage: 'Unable to start linking your Google account.' },
      );
      const linkTicket = initiateRes?.data?.link_ticket;
      if (!initiateRes?.success || !linkTicket) {
        Alert.alert('Error', 'Unable to start linking your Google account.');
        return;
      }

      const state = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
      kisAuthExpectedState.current = state;
      const url =
        `${KISAUTH_BASE_URL}/authorize` +
        `?client_id=kis-mobile` +
        `&redirect_uri=${encodeURIComponent(KIS_AUTH_LINK_REDIRECT_URI)}` +
        `&purpose=link` +
        `&state=${encodeURIComponent(state)}` +
        `&link_ticket=${encodeURIComponent(linkTicket)}`;

      const outcome = await launchKisAuthFlow(url, KIS_AUTH_LINK_REDIRECT_URI);
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'pending') {
        // No InAppBrowser on this device — the deep-link effect above
        // handles the result once the universal link routes back here.
        return;
      }
      if (outcome.state !== state) {
        Alert.alert('Error', 'We could not complete this authentication request.');
        return;
      }
      if (outcome.kind === 'error') {
        Alert.alert(
          'Could not link account',
          outcome.error === 'already_linked'
            ? 'This Google account is already linked to a different KIS account.'
            : 'We could not complete this authentication request.',
        );
        return;
      }
      kisAuthHandledCode.current = outcome.code;
      await completeLink(outcome.code);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to link your Google account.');
    } finally {
      setLoading(false);
    }
  }, [completeLink]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      {/* The registration-prompt modal has its own large title in the body
          below and dismisses via the "Ignore" button — a thin header bar
          with a back arrow and the Settings-flow title would be redundant
          and wrong here, so it only renders when reached from Settings. */}
      {fromRegistration ? null : (
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Link Google Account</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
          <KISIcon name={linked ? 'check' : 'lock'} size={36} color={linked ? palette.success : palette.primary} />
        </View>

        {linked ? (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Google account connected</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {user?.verification?.google?.email
                ? `Your KIS account is connected to ${user.verification.google.email}. `
                : ''}
              You can now use "Recover with KIS Auth" to sign back in with Google if you ever lose access to this
              device. There's nothing more to connect.
            </Text>
            {fromRegistration ? (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: palette.primary, maxWidth: formMaxWidth }]}
                onPress={handleSkip}
              >
                <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Continue</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: palette.text }]}>
              {fromRegistration ? 'Secure your KIS account' : 'Link your Google account'}
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {fromRegistration
                ? 'Connect your Google account to help protect your account and make recovery easier if you forget your password or lose access to your usual sign-in method.'
                : 'Linking lets you sign back into KIS with Google if you lose this device — no SMS or email code needed. Your KIS account stays exactly as it is; this only adds a second way in.'}
            </Text>

            <Pressable
              style={[
                styles.primaryBtn,
                { backgroundColor: palette.primary, opacity: loading ? 0.6 : 1, maxWidth: formMaxWidth },
              ]}
              onPress={handleLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={palette.ivory} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>
                  Connect to Google
                </Text>
              )}
            </Pressable>

            {fromRegistration ? (
              <Text style={[styles.subtitle, { color: palette.subtext, fontSize: 12, lineHeight: 17 }]}>
                KIS uses Google to verify your identity securely. Your KIS account remains yours, and connecting
                Google does not give Google control over your KIS account.
              </Text>
            ) : null}

            {fromRegistration ? (
              <Pressable onPress={handleSkip} disabled={loading} style={styles.skipBtn}>
                <Text style={[styles.skipBtnText, { color: palette.subtext, opacity: loading ? 0.5 : 1 }]}>
                  Ignore
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        <View style={[styles.securityNote, { backgroundColor: palette.surface, borderColor: palette.divider, maxWidth: formMaxWidth }]}>
          <KISIcon name="lock" size={14} color={palette.subtext} />
          <Text style={[styles.securityNoteText, { color: palette.subtext }]}>
            Only your Google account&#8217;s stable identifier is stored, never your Google password. A Google
            account can only ever be linked to one KIS account at a time.
          </Text>
        </View>
      </ScrollView>
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
  primaryBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  skipBtn: { paddingVertical: 8 },
  skipBtnText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
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
