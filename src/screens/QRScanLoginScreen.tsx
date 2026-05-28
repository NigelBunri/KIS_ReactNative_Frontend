import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchCamera } from 'react-native-image-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
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
  const navigation = useNavigation<Nav>();
  const { setAuth, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'scan' | 'manual'>('scan');

  const handleToken = useCallback(async (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const deviceId = await ensureDeviceId();
      const res = await postRequest(
        ROUTES.auth.deviceQRLogin,
        {
          token: trimmed,
          device_id: deviceId,
          device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (secondary)`,
          platform: Platform.OS,
        },
        { errorMessage: 'QR login failed.' },
      );

      if (!res?.success) {
        Alert.alert(
          'Login failed',
          res?.message || res?.data?.detail || 'QR code is invalid or has expired. Ask the primary device to show a fresh code.',
        );
        return;
      }

      const t = res.data?.tokens ?? res.data ?? {};
      await setAuthTokens({ accessToken: t.access ?? t.access_token, refreshToken: t.refresh ?? t.refresh_token });
      const resolvedUser = res?.data?.user ?? null;
      await setUserData(resolvedUser, res.data);
      setUser?.(resolvedUser);
      void initE2EE(String(resolvedUser?.id ?? '')).catch(() => {});
      setAuth(true);
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
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Secondary Device Login</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanBtnText}>Open Camera to Scan QR</Text>
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanBtnText}>Link this Device</Text>
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
  body: { flex: 1, padding: 24, alignItems: 'center', gap: 16 },
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
    maxWidth: 360,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  manualLink: { paddingVertical: 8 },
  manualLinkText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  label: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600' },
  tokenInput: {
    width: '100%',
    maxWidth: 360,
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
    maxWidth: 360,
    marginTop: 8,
  },
  securityNoteText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
});
