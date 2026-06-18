import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type TwoFactorStatus = {
  enabled: boolean;
  method?: 'sms' | 'totp';
  setup_complete?: boolean;
  provisioning_uri?: string;
  qr_code?: string;
};

type Props = {
  onBack?: () => void;
};

export default function TwoFactorScreen({ onBack }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [disableCode, setDisableCode] = useState('');
  const [disableModalVisible, setDisableModalVisible] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.auth.twoFactorStatus, { errorMessage: '2FA status unavailable' });
      setStatus(res?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const startSetup = useCallback(async () => {
    setSaving(true);
    try {
      const res = await postRequest(ROUTES.auth.twoFactorSetup, {}, { errorMessage: 'Setup failed' });
      if (res?.success) {
        // Backend returns { enabled, secret, provisioning_uri } — no qr_code field
        const data = res.data ?? {};
        setStatus((prev) => ({
          ...prev,
          ...data,
          // Synthesise qr_code so QR display code can remain unchanged
          qr_code: data.provisioning_uri ?? data.qr_code ?? null,
        }));
        setStep('verify');
      } else {
        Alert.alert('Error', res?.message || res?.data?.detail || 'Setup failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Setup failed');
    } finally {
      setSaving(false);
    }
  }, []);

  const enableTwoFactor = useCallback(async () => {
    if (!code.trim()) return;
    setSaving(true);
    const res = await postRequest(ROUTES.auth.twoFactorEnable, { code: code.trim() }, { errorMessage: 'Enable failed' });
    setSaving(false);
    if (res?.success) {
      setCode('');
      setStep('idle');
      loadStatus();
      Alert.alert('Success', 'Two-factor authentication is now enabled.');
    } else {
      Alert.alert('Invalid code', res?.message || 'Code verification failed');
    }
  }, [code, loadStatus]);

  const disableTwoFactor = useCallback(() => {
    // Show modal to collect TOTP code before calling disable endpoint
    setDisableCode('');
    setDisableModalVisible(true);
  }, []);

  const confirmDisableTwoFactor = useCallback(async () => {
    if (!disableCode.trim() || disableCode.trim().length < 6) {
      Alert.alert('Code required', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.auth.twoFactorDisable,
      { code: disableCode.trim() },
      { errorMessage: 'Disable failed' },
    );
    setSaving(false);
    if (res?.success) {
      setDisableModalVisible(false);
      setDisableCode('');
      loadStatus();
    } else {
      Alert.alert('Invalid code', res?.message || res?.data?.detail || 'TOTP code is incorrect or expired.');
    }
  }, [disableCode, loadStatus]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.headerRow, { borderBottomColor: palette.divider }]}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backBtn}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
        )}
        <Text style={[styles.title, { color: palette.text }]}>Two-Factor Authentication</Text>
      </View>

      <View style={[styles.content, { maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' }]}>
        <View style={[styles.statusCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: status?.enabled ? palette.success : palette.danger }]} />
            <Text style={[styles.statusText, { color: palette.text }]}>
              2FA is currently {status?.enabled ? 'enabled' : 'disabled'}
            </Text>
          </View>
          {status?.enabled && status.method && (
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
              Method: {status.method === 'totp' ? 'Authenticator app (TOTP)' : 'SMS'}
            </Text>
          )}
        </View>

        {!status?.enabled && step === 'idle' && (
          <>
            <Text style={[styles.desc, { color: palette.subtext }]}>
              Two-factor authentication adds an extra layer of security to your account. After enabling, you'll need a verification code each time you log in.
            </Text>
            <Pressable
              onPress={startSetup}
              disabled={saving}
              style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={palette.onPrimary} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: palette.onPrimary }]}>Enable Two-Factor Authentication</Text>
              )}
            </Pressable>
          </>
        )}

        {step === 'verify' && (
          <View style={{ gap: 12 }}>
            <Text style={[styles.desc, { color: palette.subtext }]}>
              Scan the QR code with your authenticator app, then enter the 6-digit code below to confirm setup.
            </Text>
            {status?.qr_code && (
              <View style={[styles.qrContainer, { borderColor: palette.inputBorder }]}>
                <Text style={{ color: palette.subtext, textAlign: 'center' }}>
                  [QR Code — open in authenticator app]{'\n'}
                  {status.provisioning_uri}
                </Text>
              </View>
            )}
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={palette.subtext}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.codeInput, { color: palette.text, borderColor: palette.inputBorder }]}
            />
            <Pressable
              onPress={enableTwoFactor}
              disabled={saving || code.length < 6}
              style={[styles.primaryBtn, { backgroundColor: code.length === 6 ? palette.primary : palette.surface }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={palette.onPrimary} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: code.length === 6 ? (palette.onPrimary) : palette.subtext }]}>
                  Verify & Enable
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setStep('idle')}>
              <Text style={{ color: palette.subtext, textAlign: 'center', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {status?.enabled && step === 'idle' && (
          <Pressable
            onPress={disableTwoFactor}
            disabled={saving}
            style={[styles.dangerBtn, { borderColor: palette.danger }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={palette.danger} />
            ) : (
              <Text style={[styles.dangerBtnText, { color: palette.danger }]}>
                Disable Two-Factor Authentication
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>

    {/* Disable 2FA confirmation modal — requires TOTP code */}
    <Modal
      visible={disableModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setDisableModalVisible(false)}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: palette.backdrop }]}>
        <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text, marginBottom: 8 }]}>Confirm Disable 2FA</Text>
          <Text style={[styles.desc, { color: palette.subtext, marginBottom: 12 }]}>
            Enter the 6-digit code from your authenticator app to disable two-factor authentication.
          </Text>
          <TextInput
            value={disableCode}
            onChangeText={setDisableCode}
            placeholder="6-digit code"
            placeholderTextColor={palette.subtext}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.codeInput, { color: palette.text, borderColor: palette.inputBorder }]}
            autoFocus
          />
          <View style={{ gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={confirmDisableTwoFactor}
              disabled={saving || disableCode.length < 6}
              style={[styles.dangerBtn, { borderColor: palette.danger, backgroundColor: disableCode.length === 6 ? `${palette.danger}18` : 'transparent' }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={palette.danger} />
              ) : (
                <Text style={[styles.dangerBtnText, { color: palette.danger }]}>Disable 2FA</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setDisableModalVisible(false)}>
              <Text style={{ color: palette.subtext, textAlign: 'center', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  statusCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 14, lineHeight: 20 },
  primaryBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  qrContainer: { borderWidth: 1, borderRadius: 10, padding: 16, alignItems: 'center' },
  dangerBtn: { paddingVertical: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
});
