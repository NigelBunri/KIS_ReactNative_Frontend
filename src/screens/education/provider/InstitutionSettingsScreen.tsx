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
//
// Visual pass: rebuilt on the shared premium education component kit.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import type { RootStackParamList } from '@/navigation/types';
import { EducationScreenScaffold, EducationSectionCard, EducationActionButton } from '@/screens/education/shared/components';

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

  // institution.partner_id/partner_name already come back from the
  // existing load() below (EducationInstitutionSerializer includes both) -
  // no separate fetch needed, unlike manageablePartners which has its own
  // endpoint (every partner org the current user can manage).
  const [manageablePartners, setManageablePartners] = useState<{ id: string; name: string }[]>([]);
  const [manageablePartnersLoading, setManageablePartnersLoading] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerConnecting, setPartnerConnecting] = useState(false);

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

  const loadManageablePartners = useCallback(async () => {
    setManageablePartnersLoading(true);
    try {
      const response = await getRequest(ROUTES.partners.list, {
        errorMessage: 'Unable to load your partner organizations.',
      });
      if (!response?.success) return;
      const results = (response as any)?.data?.results ?? (response as any)?.data ?? [];
      const list = Array.isArray(results) ? results : [];
      setManageablePartners(
        list
          .filter((partner: any) => partner?.can_manage)
          .map((partner: any) => ({ id: String(partner.id), name: String(partner.name || 'Partner') })),
      );
    } finally {
      setManageablePartnersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManageablePartners();
  }, [loadManageablePartners]);

  const handleConnectPartner = useCallback(async () => {
    if (!institutionId || !selectedPartnerId) return;
    setPartnerConnecting(true);
    try {
      const response = await postRequest(
        ROUTES.broadcasts.educationInstitutionPartnerConnect(institutionId),
        { partner_id: selectedPartnerId },
        { errorMessage: 'Unable to connect this partner.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to connect this partner.');
      }
      await load();
      setSelectedPartnerId('');
      Alert.alert('Partner organization', 'This institution is now managed by the partner organization too. Existing enrolled learners and staff have been added to it automatically.');
    } catch (error: any) {
      Alert.alert('Partner organization', error?.message || 'Unable to connect this partner.');
    } finally {
      setPartnerConnecting(false);
    }
  }, [institutionId, selectedPartnerId, load]);

  const handleDisconnectPartner = useCallback(async () => {
    if (!institutionId) return;
    setPartnerConnecting(true);
    try {
      const response = await deleteRequest(
        ROUTES.broadcasts.educationInstitutionPartnerConnect(institutionId),
        { errorMessage: 'Unable to disconnect this partner.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to disconnect this partner.');
      }
      await load();
      Alert.alert('Partner organization', 'This institution is no longer managed by that partner organization.');
    } catch (error: any) {
      Alert.alert('Partner organization', error?.message || 'Unable to disconnect this partner.');
    } finally {
      setPartnerConnecting(false);
    }
  }, [institutionId, load]);

  if (loading && !institution) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title="Settings"
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, paddingBottom: 60 }}>
          <EducationSectionCard palette={palette} title="Profile">
            <View style={{ gap: 10, marginTop: 4 }}>
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
              <EducationActionButton palette={palette} label={saving ? 'Saving…' : 'Save profile'} disabled={saving} onPress={() => void saveProfile()} />
            </View>
          </EducationSectionCard>

          <EducationSectionCard
            palette={palette}
            title="Partner organization"
            meta={institution?.partner_id ? `Managed by: ${institution.partner_name || 'Partner'}` : 'Not connected'}
          >
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: palette.subtext }}>
                Attach this institution to a partner organization you manage — anyone with manager rights on that
                partner gets the same ability to manage this institution that you have, and every enrolled learner
                and staff member is added to the partner automatically.
              </Text>
              {institution?.partner_id ? (
                <EducationActionButton
                  palette={palette}
                  label={partnerConnecting ? 'Disconnecting…' : 'Disconnect partner'}
                  variant="secondary"
                  disabled={partnerConnecting}
                  onPress={() => void handleDisconnectPartner()}
                />
              ) : manageablePartnersLoading ? (
                <Text style={{ fontSize: 13, color: palette.subtext }}>Loading your partner organizations…</Text>
              ) : manageablePartners.length ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {manageablePartners.map(partner => (
                      <EducationActionButton
                        key={partner.id}
                        palette={palette}
                        label={partner.name}
                        variant={selectedPartnerId === partner.id ? 'primary' : 'secondary'}
                        onPress={() => setSelectedPartnerId(partner.id)}
                      />
                    ))}
                  </View>
                  <EducationActionButton
                    palette={palette}
                    label={partnerConnecting ? 'Connecting…' : 'Connect partner'}
                    disabled={partnerConnecting || !selectedPartnerId}
                    onPress={() => void handleConnectPartner()}
                  />
                </>
              ) : (
                <Text style={{ fontSize: 13, color: palette.subtext }}>You don't manage any partner organizations yet.</Text>
              )}
            </View>
          </EducationSectionCard>

          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Payments</Text>
            <EducationSectionCard palette={palette} title="Flutterwave" meta={`Status: ${institution?.payout_account_status ?? 'not_connected'}${institution?.payout_bank_last4 ? ` · ···${institution.payout_bank_last4}` : ''}`}>
              <View style={{ gap: 8, marginTop: 4 }}>
                <KISTextInput placeholder="Bank code" value={bankCode} onChangeText={setBankCode} />
                <KISTextInput placeholder="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
                <EducationActionButton palette={palette} label={connectingPayout ? 'Connecting…' : 'Connect Flutterwave'} disabled={connectingPayout} onPress={() => void connectFlutterwave()} />
              </View>
            </EducationSectionCard>
            <EducationSectionCard
              palette={palette}
              title="Stripe"
              meta={stripeStatus?.stripe_payouts_enabled ? 'Payouts enabled' : stripeStatus?.stripe_account_id ? 'Onboarding incomplete' : 'Not connected'}
            >
              <EducationActionButton
                palette={palette}
                label={connectingStripe ? 'Opening…' : stripeStatus?.stripe_account_id ? 'Continue onboarding' : 'Connect Stripe'}
                disabled={connectingStripe}
                variant="secondary"
                onPress={() => void connectStripe()}
              />
            </EducationSectionCard>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>Landing page</Text>
            <EducationActionButton
              palette={palette}
              label="Open landing page builder"
              variant="secondary"
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
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
