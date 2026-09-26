// src/screens/education/provider/InstitutionSettingsScreen.tsx
//
// Education UX v2 — real "Institution Settings" destination, replacing
// the Settings sub-view inside EducationManagementModal.tsx's dashboard.
//
// Payments UX improvement (v2 brief section 19): the Stripe connect GET
// endpoint already calls Stripe's own refresh_account_status whenever it's
// hit (see apps.broadcasts.views.EducationInstitutionStripeConnectAccountView.get
// on the backend) — the old modal just never called it automatically. This
// screen does, via useFocusEffect, so returning from Stripe's hosted
// onboarding page (a real screen regains focus naturally) updates the
// status without the "tap refresh yourself" step the old modal needed.
// Flutterwave connect stays an in-app form with an immediate result, same
// as before — no backend change was needed there.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationInstitutionSettings'>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

export default function InstitutionSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [connectingPayout, setConnectingPayout] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.educationInstitution(institutionId), { forceNetwork: true });
      const inst = response?.data?.institution;
      if (inst) {
        setInstitution(inst);
        setName(inst.name ?? '');
        setDescription(inst.description ?? '');
        setContactEmail(inst.contact_email ?? '');
        setContactPhone(inst.contact_phone ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  const refreshStripeStatus = useCallback(async () => {
    const response = await getRequest(ROUTES.broadcasts.educationInstitutionStripeAccountConnect(institutionId), { forceNetwork: true });
    if (response?.success) setStripeStatus(response.data);
  }, [institutionId]);

  useEffect(() => {
    load();
    refreshStripeStatus();
  }, [load, refreshStripeStatus]);

  // Returning from Stripe's hosted onboarding page re-focuses this screen
  // naturally - refresh status automatically instead of requiring a
  // manual tap (see file header for why this is safe: the backend's GET
  // already re-syncs from Stripe on every call).
  useFocusEffect(
    useCallback(() => {
      refreshStripeStatus();
    }, [refreshStripeStatus]),
  );

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const response = await patchRequest(
        ROUTES.broadcasts.educationInstitution(institutionId),
        { name: name.trim(), description: description.trim(), contact_email: contactEmail.trim(), contact_phone: contactPhone.trim() },
        { errorMessage: 'Unable to save.' },
      );
      if (response?.success) Alert.alert('Institution', 'Saved.');
    } finally {
      setSaving(false);
    }
  }, [institutionId, name, description, contactEmail, contactPhone]);

  const connectFlutterwave = useCallback(async () => {
    if (!bankCode.trim() || !accountNumber.trim()) {
      Alert.alert('Payout account', 'Enter both the bank code and account number.');
      return;
    }
    setConnectingPayout(true);
    try {
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionPayoutAccountConnect(institutionId),
        { account_bank: bankCode.trim(), account_number: accountNumber.trim(), business_name: name.trim() || institutionName },
        { errorMessage: 'Unable to connect payout account.' },
      );
      if (!response?.success) {
        Alert.alert('Payout account', response?.message || 'Unable to connect payout account.');
        return;
      }
      Alert.alert('Payout account', 'Connected.');
      await load();
    } finally {
      setConnectingPayout(false);
    }
  }, [institutionId, bankCode, accountNumber, name, institutionName, load]);

  const connectStripe = useCallback(async () => {
    setConnectingStripe(true);
    try {
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionStripeAccountConnect(institutionId),
        {},
        { errorMessage: 'Unable to start Stripe onboarding.' },
      );
      if (!response?.success) {
        Alert.alert('Stripe', response?.message || 'Unable to start Stripe onboarding.');
        return;
      }
      const url = response.data?.onboarding_url;
      if (url) await Linking.openURL(url);
    } finally {
      setConnectingStripe(false);
    }
  }, [institutionId]);

  if (loading && !institution) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 22, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
            <KISIcon name="back" size={20} color={palette.text} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }} numberOfLines={1}>
            Settings
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Profile</Text>
          <View>
            <FieldLabel>Name</FieldLabel>
            <KISTextInput value={name} onChangeText={setName} />
          </View>
          <View>
            <FieldLabel>Description</FieldLabel>
            <KISTextInput value={description} onChangeText={setDescription} multiline />
          </View>
          <View>
            <FieldLabel>Contact email</FieldLabel>
            <KISTextInput value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View>
            <FieldLabel>Contact phone</FieldLabel>
            <KISTextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
          </View>
          <KISButton title={saving ? 'Saving…' : 'Save profile'} disabled={saving} loading={saving} onPress={() => void saveProfile()} />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Payments</Text>
          <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 8 }}>
            <Text style={{ fontWeight: '700', color: palette.text }}>Flutterwave</Text>
            <Text style={{ fontSize: 12, color: palette.subtext }}>
              Status: {institution?.payout_account_status ?? 'not_connected'}
              {institution?.payout_bank_last4 ? ` · ···${institution.payout_bank_last4}` : ''}
            </Text>
            <KISTextInput placeholder="Bank code" value={bankCode} onChangeText={setBankCode} />
            <KISTextInput placeholder="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
            <KISButton title={connectingPayout ? 'Connecting…' : 'Connect Flutterwave'} disabled={connectingPayout} loading={connectingPayout} onPress={() => void connectFlutterwave()} />
          </View>
          <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, gap: 8 }}>
            <Text style={{ fontWeight: '700', color: palette.text }}>Stripe</Text>
            <Text style={{ fontSize: 12, color: palette.subtext }}>
              {stripeStatus?.stripe_payouts_enabled ? 'Payouts enabled' : stripeStatus?.stripe_account_id ? 'Onboarding incomplete' : 'Not connected'}
            </Text>
            <KISButton
              title={connectingStripe ? 'Opening…' : stripeStatus?.stripe_account_id ? 'Continue onboarding' : 'Connect Stripe'}
              disabled={connectingStripe}
              loading={connectingStripe}
              variant="outline"
              onPress={() => void connectStripe()}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Landing page</Text>
          <KISButton
            title="Open landing page builder"
            variant="outline"
            onPress={() =>
              navigation.navigate('WebsiteBuilder', {
                ownerType: 'education_institution',
                ownerId: institutionId,
                ownerLabel: name || institutionName,
              })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
