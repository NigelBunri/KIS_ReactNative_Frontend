import React, { useCallback, useState } from 'react';
import { Country, CountryCode } from 'react-native-country-picker-modal';
import SafeCountryPicker from '@/components/common/SafeCountryPicker';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { setAuthTokens } from '@/security/authStorage';
import { setUserData } from '@/network/cache';
import { ensureDeviceId, initE2EE } from '@/security/e2ee';
import { useAuth } from '../../App';

// Not in RootStackParamList's generated navigator typings at the point
// this screen was added (same situation ParentRecoveryScreen documents) —
// read locally via useRoute() rather than fighting the navigator types.
type Params = { registrationCode?: string; redirectUri?: string };

// The one screen a Google sign-up needs beyond what kis-auth's OAuth round
// trip already proved: KIS accounts are phone-centric (USERNAME_FIELD,
// SMS/WhatsApp notifications) and Google never provides a phone number.
// Everything else — identity, email, password (there isn't one; Google is
// the credential) — is already settled by the time the user lands here.
export default function KisAuthRegisterPhoneScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { setAuth, setUser } = useAuth();
  const responsive = useResponsiveLayout();
  const formMaxWidth = Math.min(480, responsive.contentMaxWidth - 32);
  const params = (route.params ?? {}) as Params;

  const [regPhone, setRegPhone] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('CM');
  const [callingCode, setCallingCode] = useState('+237');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChangeRegPhone = useCallback((value: string) => {
    setRegPhone(String(value || '').replace(/[^\d]/g, '').slice(0, 14));
  }, []);

  const onCountrySelect = useCallback((country: Country) => {
    const code = country.callingCode?.[0];
    if (code) setCallingCode(`+${code}`);
    setCountryCode(country.cca2 as CountryCode);
    setCountryPickerVisible(false);
  }, []);

  const phoneValid = regPhone.trim().replace(/[^\d]/g, '').length >= 6;

  const onFinish = useCallback(async () => {
    if (!params.registrationCode || !params.redirectUri) {
      Alert.alert('Error', 'Missing registration details — please start over.');
      navigation.goBack();
      return;
    }
    const normalizedPhone = regPhone.replace(/[^\d]/g, '');
    if (!phoneValid) return;

    setLoading(true);
    try {
      const deviceId = await ensureDeviceId();
      const res = await postRequest(
        ROUTES.auth.kisAuthRegistrationComplete,
        {
          registration_code: params.registrationCode,
          redirect_uri: params.redirectUri,
          phone: `${callingCode}${normalizedPhone}`,
          phone_country_code: callingCode,
          phone_number: normalizedPhone,
          country: countryCode,
          device_id: deviceId,
          device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} (KIS Auth sign-up)`,
          platform: Platform.OS,
        },
        { errorMessage: 'Unable to complete sign-up.' },
      );

      if (!res?.success) {
        Alert.alert(
          'Sign-up failed',
          res?.message || res?.data?.detail || 'Please check your phone number and try again.',
        );
        return;
      }

      const accessToken = res.data?.access;
      if (!accessToken) {
        Alert.alert('Sign-up failed', 'We could not complete this authentication request.');
        return;
      }

      await setAuthTokens({ accessToken, refreshToken: res.data?.refresh ?? null });
      const resolvedUser = res?.data?.user ?? null;
      await setUserData(resolvedUser, res.data);
      setUser?.(resolvedUser);
      void initE2EE(String(resolvedUser?.id ?? '')).catch(() => {});
      setAuth(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to complete sign-up.');
    } finally {
      setLoading(false);
    }
  }, [params.registrationCode, params.redirectUri, regPhone, callingCode, countryCode, phoneValid, navigation, setAuth, setUser]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Almost done</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { padding: responsive.pageGutter, maxWidth: responsive.contentMaxWidth, width: '100%', alignSelf: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
            <KISIcon name="check" size={36} color={palette.primary} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>Add your phone number</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Your Google account is verified. KIS uses your phone number for account recovery and notifications —
            add it to finish creating your account.
          </Text>

          <View style={[styles.phoneRow, { maxWidth: formMaxWidth }]}>
            <Pressable
              onPress={() => setCountryPickerVisible(true)}
              style={[styles.prefixBox, { borderColor: palette.border, backgroundColor: palette.surface }]}
              accessibilityLabel="Select country code"
              accessibilityRole="button"
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>{callingCode}</Text>
              <Text style={{ color: palette.subtext }}>▾</Text>
            </Pressable>
            <SafeCountryPicker
              visible={countryPickerVisible}
              countryCode={countryCode}
              onSelect={onCountrySelect}
              onClose={() => setCountryPickerVisible(false)}
            />
            <TextInput
              value={regPhone}
              onChangeText={onChangeRegPhone}
              keyboardType="phone-pad"
              placeholder="6xx xxx xxx"
              placeholderTextColor={palette.subtext}
              style={[
                styles.input,
                { flex: 1, backgroundColor: palette.surface, borderColor: palette.border, color: palette.text },
                !!regPhone && !phoneValid && { borderColor: palette.danger },
              ]}
              textContentType="telephoneNumber"
            />
          </View>

          <Pressable
            style={[
              styles.primaryBtn,
              { backgroundColor: palette.primary, opacity: phoneValid && !loading ? 1 : 0.5, maxWidth: formMaxWidth },
            ]}
            onPress={onFinish}
            disabled={loading || !phoneValid}
          >
            {loading ? <ActivityIndicator color={palette.ivory} /> : <Text style={[styles.primaryBtnText, { color: palette.ivory }]}>Finish creating account</Text>}
          </Pressable>
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
  phoneRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
    minWidth: 80,
  },
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
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
});
