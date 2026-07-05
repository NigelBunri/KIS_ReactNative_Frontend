import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchCamera } from 'react-native-image-picker';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { ensureDeviceId, initE2EE, rotateDeviceId } from '@/security/e2ee';
import { prefetchNow, resetPrefetchFlag, startBackgroundPrefetch } from '@/services/backgroundPrefetch';
import { useAuth } from '../../App';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/*
 * QR code scanning:
 * When react-native-vision-camera is added to the project (run: npm install react-native-vision-camera),
 * replace the manual-token fallback below with a live camera frame processor.
 * The parsed QR value is the token string — pass it directly to handleToken().
 *
 * For now, the flow is: user photographs the QR with the standard camera,
 * then pastes or types the resulting token. This is a transitional implementation
 * until the vision-camera native module is linked.
 */

export default function QRScanLoginScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<Nav>();
  const { setAuth, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'scan' | 'manual'>('scan');

  const extractQRToken = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      const candidate = parsed?.qr_payload ?? parsed?.token ?? parsed?.data?.qr_payload ?? parsed?.data?.token;
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    } catch {
      // Plain token paste is the expected path.
    }
    const tokenMatch =
      trimmed.match(/(?:qr_payload|token)=([^\s&]+)/i) ||
      trimmed.match(/(?:qr_payload|token)["']?\s*[:=]\s*["']([^"'\s]+)/i);
    if (tokenMatch?.[1]) return decodeURIComponent(tokenMatch[1]).trim();
    return trimmed;
  };

  const handleToken = useCallback(async (rawToken: string) => {
    const trimmed = extractQRToken(rawToken);
    if (!trimmed) return;
    setLoading(true);
    try {
      const loginWithDevice = async (deviceId: string) =>
        postRequest(
          ROUTES.auth.deviceQRLogin,
          {
            token: trimmed,
            device_id: deviceId,
            device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (secondary)`,
            platform: Platform.OS,
          },
          { errorMessage: 'QR login failed.' },
        );

      let deviceId = await ensureDeviceId();
      let res = await loginWithDevice(deviceId);
      const firstDetail = String(res?.data?.detail ?? res?.message ?? '').toLowerCase();

      if (!res?.success && firstDetail.includes('primary device cannot consume')) {
        deviceId = await rotateDeviceId();
        res = await loginWithDevice(deviceId);
      }

      if (!res?.success) {
        const detail =
          res?.data?.detail ||
          res?.data?.message ||
          res?.message ||
          'QR code is invalid or has expired. Ask the primary device to show a fresh code.';
        Alert.alert('Login failed', String(detail));
        return;
      }

      const payload = res.data ?? {};
      const t = payload?.tokens ?? payload;
      const access = t.access ?? t.access_token;
      const refresh = t.refresh ?? t.refresh_token;
      if (!access) {
        Alert.alert('Login failed', 'The server linked the device but did not return an access token. Please refresh the QR and try again.');
        return;
      }
      await setAuthTokens({ accessToken: access, refreshToken: refresh ?? null });
      const resolvedUser = payload?.user ?? null;
      const resolvedUserId = String(resolvedUser?.id ?? '');
      await setUserData(resolvedUser, payload);
      setUser?.(resolvedUser);
      if (resolvedUserId) {
        await initE2EE(resolvedUserId).catch((err: any) => {
          if (__DEV__) console.warn('[QRScanLogin] E2EE init failed:', err?.message ?? err);
        });
        resetPrefetchFlag();
        startBackgroundPrefetch(resolvedUserId);
        void prefetchNow(resolvedUserId).catch((err: any) => {
          if (__DEV__) console.warn('[QRScanLogin] initial prefetch failed:', err?.message ?? err);
        });
      }
      DeviceEventEmitter.emit('auth.device.changed', { source: 'qr-secondary-login', deviceId });
      setAuth(true);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' as never, params: { screen: 'Messages' } as never }],
        }),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [setAuth, setUser]);

  const handleCameraCapture = useCallback(async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 1,
        includeBase64: false,
      });
      if (result.didCancel) return;
      // After capturing, prompt user to switch to manual entry
      // (full jsQR decode requires adding the jsqr package)
      Alert.alert(
        'Enter the QR token',
        'Copy the token shown below the QR code on the primary device and paste it here, or ask the primary device to share it directly.',
        [{ text: 'OK', onPress: () => setStep('manual') }],
      );
    } catch {
      setStep('manual');
    }
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Login');
          }}
          style={styles.backBtn}
          hitSlop={12}
        >
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Secondary Device Login</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.body, { padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' }]}>
        {/* Lock icon */}
        <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
          <KISIcon name="lock" size={40} color={palette.primary} />
        </View>

        <Text style={[styles.title, { color: palette.text }]}>Link this device</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Open the KIS app on your primary device, go to{' '}
          <Text style={{ fontWeight: '700' }}>Profile → Manage Devices</Text>, then show
          the QR code and scan it here.
        </Text>

        {step === 'scan' ? (
          <>
            <Pressable
              style={[styles.scanBtn, { backgroundColor: palette.primary }]}
              onPress={handleCameraCapture}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={palette.onPrimary} />
              ) : (
                <Text style={[styles.scanBtnText, { color: palette.onPrimary }]}>Open Camera to Scan QR</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setStep('manual')} style={styles.manualLink}>
              <Text style={[styles.manualLinkText, { color: palette.subtext }]}>
                Enter token manually instead
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.subtext }]}>
              Paste the token from the primary device:
            </Text>
            <TextInput
              style={[styles.tokenInput, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
              placeholder="Paste QR token here"
              placeholderTextColor={palette.subtext}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <Pressable
              style={[styles.scanBtn, { backgroundColor: palette.primary, opacity: token.trim() ? 1 : 0.5 }]}
              onPress={() => handleToken(token)}
              disabled={loading || !token.trim()}
            >
              {loading ? (
                <ActivityIndicator color={palette.onPrimary} />
              ) : (
                <Text style={[styles.scanBtnText, { color: palette.onPrimary }]}>Link this Device</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setStep('scan')} style={styles.manualLink}>
              <Text style={[styles.manualLinkText, { color: palette.subtext }]}>
                ← Back to camera scan
              </Text>
            </Pressable>
          </>
        )}

        <View style={[styles.securityNote, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <KISIcon name="lock" size={14} color={palette.subtext} />
          <Text style={[styles.securityNoteText, { color: palette.subtext }]}>
            The QR code expires every 3 hours and can only be used once. Never share it with anyone.
          </Text>
        </View>
      </View>
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
  body: { flex: 1, alignItems: 'center', gap: 16 },
  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  scanBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanBtnText: { fontSize: 16, fontWeight: '800' },
  manualLink: { paddingVertical: 8 },
  manualLinkText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  label: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600' },
  tokenInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 80,
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
