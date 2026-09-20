import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISAUTH_BASE_URL } from '@/network/config';
import { launchKisAuthFlow } from '@/security/kisAuthBrowser';

// Distinct from the recovery redirect_uri — kis-auth's client registry
// keys allowed_redirect_uris per exact string, so each purpose gets its
// own path even though all three point at the same kis.app domain. This
// keeps deepLinkRouter.ts's routing unambiguous rather than overloading
// one path with a purpose flag baked into app state.
const KIS_AUTH_LINK_REDIRECT_URI = 'https://kis.app/auth/kisauth-link-callback';

// This is the ONLY entry point that can ever create a Google-identity
// link (Phase 2 §7/§8 decision: linking happens from Settings, while
// already authenticated — never inferred from a recovery or registration
// attempt). Recovery and Google sign-up both depend on a link already
// existing; neither can create one.
export default function KisAuthLinkScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const formMaxWidth = Math.min(480, responsive.contentMaxWidth - 32);

  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);

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
        // No InAppBrowser on this device — nothing more this screen can
        // do; the universal link (once kis.app is verified) would need
        // to route back here, but there's no in-memory state left to
        // resume into after a full system-browser round trip for a
        // screen with no deep-link handler of its own. Tell the user
        // plainly rather than leaving them stuck.
        Alert.alert(
          'Continue in your browser',
          'Finish linking in the browser that just opened, then come back to KIS and try again if it doesn’t update automatically.',
        );
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

      const completeRes = await postRequest(
        ROUTES.auth.kisAuthLinkComplete,
        { code: outcome.code, redirect_uri: KIS_AUTH_LINK_REDIRECT_URI },
        { errorMessage: 'Unable to finish linking your Google account.' },
      );
      if (!completeRes?.success) {
        Alert.alert('Error', 'Unable to finish linking your Google account.');
        return;
      }
      setLinked(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to link your Google account.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Link Google Account</Text>
        <View style={{ width: 40 }} />
      </View>

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
            <Text style={[styles.title, { color: palette.text }]}>Google account linked</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              You can now use "Recover with KIS Auth" to sign back in with Google if you ever lose access to this
              device.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: palette.text }]}>Link your Google account</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Linking lets you sign back into KIS with Google if you lose this device — no SMS or email code needed.
              Your KIS account stays exactly as it is; this only adds a second way in.
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
                <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Continue with Google</Text>
              )}
            </Pressable>
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
