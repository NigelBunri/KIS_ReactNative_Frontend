// src/screens/profile/ReferralCommissionsScreen.tsx
// Lifetime cash-commission dashboard — reached from the Profile tab's
// "Referrals" quick action (ProfileScreen.tsx). Deliberately separate from
// src/screens/market/ReferralScreen.tsx ("Refer a friend" / KIS Coins):
// that screen's reward is a one-time, tier-rate, internal-points bonus;
// this screen's reward is a flat 24% of every qualifying account-upgrade
// payment the referred user ever makes, paid out in real money to a
// connected Stripe/Flutterwave payout account. Both share the same
// underlying referral code/link/relationship (apps.referrals.models.
// Referral) but track and pay out completely independently — see
// apps/referrals/commission_services.py (backend) for the full reasoning.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import QrCodeShareModal from '@/components/common/QrCodeShareModal';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type PayoutAccount = {
  provider: 'flutterwave' | 'stripe' | '';
  status: 'not_connected' | 'pending' | 'active';
  payout_account_name: string;
  payout_bank_last4: string;
  payout_country: string;
  stripe_account_id: string;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
};

type CommissionEntry = {
  referred_display_name: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed' | 'failed_payout';
  gross_amount_cents: number;
  commission_rate_percent: string | number;
  commission_amount_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
};

type CommissionSummary = {
  commission_rate_percent: string | number;
  payout_account: PayoutAccount | null;
  total_earned_cents: number;
  total_pending_cents: number;
  total_approved_cents: number;
  total_paid_cents: number;
  currency: string;
  history: CommissionEntry[];
};

type ReferralSummary = {
  code: string;
  referral_link: string;
  total_referred: number;
  total_qualified: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  reversed: 'Reversed',
  failed_payout: 'Payout failed',
};

const STATUS_COLOR = (status: string, palette: any) => {
  if (status === 'paid') return palette.success;
  if (status === 'reversed' || status === 'failed_payout') return palette.danger;
  if (status === 'approved') return palette.primaryStrong;
  return palette.subtext;
};

const formatMoney = (cents: number, currency: string) => {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
};

export default function ReferralCommissionsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [commission, setCommission] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const [connectingStripe, setConnectingStripe] = useState(false);
  const [connectingFlutterwave, setConnectingFlutterwave] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showFlwForm, setShowFlwForm] = useState(false);
  const [flwBank, setFlwBank] = useState('');
  const [flwAccountNumber, setFlwAccountNumber] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [referralRes, commissionRes] = await Promise.all([
        getRequest(ROUTES.referrals.me, { forceNetwork: isRefresh, errorMessage: 'Unable to load your referral link.' }),
        getRequest(ROUTES.referrals.commissions, { forceNetwork: isRefresh, errorMessage: 'Unable to load your commissions.' }),
      ]);
      if (referralRes?.success) setReferral(referralRes.data ?? null);
      if (commissionRes?.success) setCommission(commissionRes.data ?? null);
      if (!referralRes?.success && !commissionRes?.success) {
        setError('Unable to load your referral commissions right now.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load your referral commissions right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh payout-account status whenever this screen regains focus — the
  // Stripe Express onboarding flow completes in the device browser, outside
  // this screen entirely; the GET handler re-queries Stripe directly, so
  // coming back from onboarding should show the real current state without
  // the user needing to pull-to-refresh themselves.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    void load(true);
  }, [load]);

  const payoutAccount = commission?.payout_account ?? null;
  const payoutConnected = payoutAccount?.status === 'active';
  const payoutPending = payoutAccount?.status === 'pending';

  const handleConnectStripe = useCallback(async () => {
    setConnectingStripe(true);
    try {
      const res = await postRequest(ROUTES.referrals.payoutAccountStripe, {}, {
        errorMessage: 'Unable to start Stripe onboarding.',
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to start Stripe onboarding.');
      const onboardingUrl = res.data?.onboarding_url;
      if (onboardingUrl) {
        const canOpen = await Linking.canOpenURL(onboardingUrl).catch(() => false);
        if (canOpen) await Linking.openURL(onboardingUrl);
        else Alert.alert('Payout account', `Please visit: ${onboardingUrl}`);
      }
      await load(true);
    } catch (err: any) {
      Alert.alert('Payout account', err?.message || 'Unable to start Stripe onboarding.');
    } finally {
      setConnectingStripe(false);
    }
  }, [load]);

  const handleConnectFlutterwave = useCallback(async () => {
    const account_bank = flwBank.trim();
    const account_number = flwAccountNumber.trim();
    if (!account_bank || !account_number) return;
    setConnectingFlutterwave(true);
    try {
      const res = await postRequest(
        ROUTES.referrals.payoutAccountFlutterwave,
        { account_bank, account_number },
        { errorMessage: 'Unable to connect your payout account.' },
      );
      if (!res?.success) throw new Error(res?.message || 'Unable to connect your payout account.');
      setShowFlwForm(false);
      setFlwBank('');
      setFlwAccountNumber('');
      Alert.alert('Payout account', 'Your payout account is connected. Your referral link is now ready to share.');
      await load(true);
    } catch (err: any) {
      Alert.alert('Payout account', err?.message || 'Unable to connect your payout account.');
    } finally {
      setConnectingFlutterwave(false);
    }
  }, [flwBank, flwAccountNumber, load]);

  const handleDisconnectPayout = useCallback(() => {
    Alert.alert(
      'Disconnect payout account',
      'New commissions will keep accruing, but nothing can be paid out until you connect another account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              const provider = payoutAccount?.provider;
              const route = provider === 'stripe' ? ROUTES.referrals.payoutAccountStripe : ROUTES.referrals.payoutAccountFlutterwave;
              const res = await deleteRequest(route, { errorMessage: 'Unable to disconnect your payout account.' });
              if (!res?.success) throw new Error(res?.message || 'Unable to disconnect your payout account.');
              await load(true);
            } catch (err: any) {
              Alert.alert('Payout account', err?.message || 'Unable to disconnect your payout account.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ],
    );
  }, [payoutAccount?.provider, load]);

  const handleCopyLink = useCallback(() => {
    if (!referral?.referral_link) return;
    Clipboard.setString(referral.referral_link);
    Alert.alert('Copied', 'Your referral link has been copied to the clipboard.');
  }, [referral?.referral_link]);

  const handleShare = useCallback(() => {
    if (!referral?.referral_link) return;
    Share.share({
      message: `Join me on KIS! Use my link to sign up: ${referral.referral_link}`,
    }).catch(() => {});
  }, [referral?.referral_link]);

  const ratePercent = commission?.commission_rate_percent ?? 24;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>Referrals</Text>
        <View style={s.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error && !referral && !commission ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => void load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primaryStrong} />}
        >
          {/* Explainer card */}
          <View style={[s.explainerCard, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[s.explainerTitle, { color: palette.onPrimary }]}>
              Earn {String(ratePercent)}% for the lifetime of every account you refer
            </Text>
            <Text style={[s.explainerBody, { color: palette.ivory }]}>
              Invite people to KIS and earn {String(ratePercent)}% of every qualifying account upgrade
              payment they make, for the lifetime of their account. Connect your payout account to get
              started.
            </Text>
            <View style={s.explainerBullets}>
              <Text style={[s.explainerBullet, { color: palette.ivory }]}>
                • You earn commissions when people you refer upgrade their KIS accounts.
              </Text>
              <Text style={[s.explainerBullet, { color: palette.ivory }]}>
                • Commissions continue for the lifetime of each referred account — not just the first payment.
              </Text>
              <Text style={[s.explainerBullet, { color: palette.ivory }]}>
                • Only qualifying account upgrade payments generate commissions.
              </Text>
              <Text style={[s.explainerBullet, { color: palette.ivory }]}>
                • Other purchases and transactions do not generate commissions.
              </Text>
            </View>
          </View>

          {/* Payout account */}
          <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.cardTitle, { color: palette.text }]}>Payout account</Text>
            {payoutConnected ? (
              <>
                <View style={s.connectedRow}>
                  <KISIcon name="checkmark-circle" size={18} color={palette.success} />
                  <Text style={[s.connectedText, { color: palette.success }]}>
                    {payoutAccount?.provider === 'stripe'
                      ? 'Connected via Stripe'
                      : `Connected via Flutterwave${payoutAccount?.payout_bank_last4 ? ` (•••• ${payoutAccount.payout_bank_last4})` : ''}`}
                  </Text>
                </View>
                <Pressable onPress={handleDisconnectPayout} disabled={disconnecting} style={s.disconnectBtn}>
                  <Text style={[s.disconnectText, { color: palette.danger }]}>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect payout account'}
                  </Text>
                </Pressable>
              </>
            ) : payoutPending ? (
              <>
                <Text style={[s.cardHelper, { color: palette.subtext }]}>
                  {payoutAccount?.provider === 'stripe'
                    ? 'Stripe onboarding started — finish it in your browser, then come back here.'
                    : 'Connecting…'}
                </Text>
                {payoutAccount?.provider === 'stripe' && (
                  <KISButton
                    title={connectingStripe ? 'Opening…' : 'Continue Stripe onboarding'}
                    size="sm"
                    variant="outline"
                    onPress={handleConnectStripe}
                    disabled={connectingStripe}
                  />
                )}
              </>
            ) : (
              <>
                <Text style={[s.cardHelper, { color: palette.subtext }]}>
                  Connect how you get paid before sharing your referral link — commissions can't be paid
                  out until you have a connected account.
                </Text>
                <View style={s.payoutBtnRow}>
                  <KISButton
                    title={connectingStripe ? 'Opening…' : 'Connect with Stripe'}
                    size="sm"
                    variant="outline"
                    onPress={handleConnectStripe}
                    disabled={connectingStripe}
                  />
                  <KISButton
                    title={showFlwForm ? 'Cancel' : 'Connect with Flutterwave'}
                    size="sm"
                    variant="outline"
                    onPress={() => setShowFlwForm(v => !v)}
                    disabled={connectingStripe}
                  />
                </View>
                {showFlwForm && (
                  <>
                    <KISTextInput
                      label="Bank code"
                      value={flwBank}
                      onChangeText={setFlwBank}
                      placeholder="e.g. 044"
                    />
                    <KISTextInput
                      label="Account number"
                      value={flwAccountNumber}
                      onChangeText={setFlwAccountNumber}
                      keyboardType="numeric"
                    />
                    <KISButton
                      title={connectingFlutterwave ? 'Connecting…' : 'Save payout account'}
                      size="sm"
                      onPress={handleConnectFlutterwave}
                      disabled={connectingFlutterwave || !flwBank.trim() || !flwAccountNumber.trim()}
                    />
                  </>
                )}
              </>
            )}
          </View>

          {/* Referral link — gated behind a connected payout account */}
          <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.cardTitle, { color: palette.text }]}>Your referral link</Text>
            {!payoutConnected ? (
              <Text style={[s.cardHelper, { color: palette.subtext }]}>
                Connect your payout account above to unlock your referral link and QR code.
              </Text>
            ) : (
              <>
                <Text style={[s.linkText, { color: palette.primaryStrong }]} numberOfLines={2}>
                  {referral?.referral_link || referral?.code || '—'}
                </Text>
                <View style={s.linkBtnRow}>
                  <Pressable onPress={handleCopyLink} style={[s.linkBtn, { backgroundColor: `${palette.primary}1A`, borderColor: `${palette.primary}60` }]}>
                    <KISIcon name="copy" size={16} color={palette.primary} />
                    <Text style={[s.linkBtnText, { color: palette.primary }]}>Copy</Text>
                  </Pressable>
                  <Pressable onPress={handleShare} style={[s.linkBtn, { backgroundColor: `${palette.primary}1A`, borderColor: `${palette.primary}60` }]}>
                    <KISIcon name="share" size={16} color={palette.primary} />
                    <Text style={[s.linkBtnText, { color: palette.primary }]}>Share</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowQr(true)} style={[s.linkBtn, { backgroundColor: `${palette.gold}1A`, borderColor: `${palette.gold}60` }]}>
                    <KISIcon name="qr-code" size={16} color={palette.gold} />
                    <Text style={[s.linkBtnText, { color: palette.gold }]}>QR code</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>{referral?.total_referred ?? 0}</Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Referred & registered</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>{referral?.total_qualified ?? 0}</Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Have upgraded</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.success }]}>
                {formatMoney(commission?.total_earned_cents ?? 0, commission?.currency || 'USD')}
              </Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Total earned</Text>
            </View>
          </View>
          <View style={s.statsGrid}>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>
                {formatMoney(commission?.total_pending_cents ?? 0, commission?.currency || 'USD')}
              </Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Pending</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>
                {formatMoney(commission?.total_approved_cents ?? 0, commission?.currency || 'USD')}
              </Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Approved</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>
                {formatMoney(commission?.total_paid_cents ?? 0, commission?.currency || 'USD')}
              </Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Paid out</Text>
            </View>
          </View>

          {/* History */}
          <View>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Commission history</Text>
            {(commission?.history?.length ?? 0) === 0 ? (
              <Text style={[s.emptyNote, { color: palette.subtext }]}>
                No commissions yet. Once someone you referred upgrades their account, it will show up here.
              </Text>
            ) : (
              commission!.history.map((entry, idx) => (
                <View key={`${entry.referred_display_name}-${entry.created_at}-${idx}`} style={[s.historyRow, { borderBottomColor: palette.divider }]}>
                  <View style={s.historyLeft}>
                    <Text style={[s.historyName, { color: palette.text }]} numberOfLines={1}>
                      {entry.referred_display_name}
                    </Text>
                    <Text style={[s.historyDate, { color: palette.subtext }]}>{formatDate(entry.created_at)}</Text>
                  </View>
                  <View style={s.historyRight}>
                    <Text style={[s.historyAmount, { color: palette.text }]}>
                      {formatMoney(entry.commission_amount_cents, entry.currency)}
                    </Text>
                    <Text style={[s.historyStatus, { color: STATUS_COLOR(entry.status, palette) }]}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={[s.disclaimerCard, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.disclaimerText, { color: palette.subtext }]}>
              Referral cash commissions are paid directly to your connected Stripe or Flutterwave account
              through that provider's own payout mechanism. KIS does not hold or transfer funds on your
              behalf outside of that provider.
            </Text>
          </View>
        </ScrollView>
      )}

      <QrCodeShareModal
        visible={showQr}
        onClose={() => setShowQr(false)}
        link={referral?.referral_link ?? ''}
        title="Referral QR code"
        subtitle="Anyone who scans this signs up under your referral link."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  explainerCard: { borderRadius: 20, padding: 20, gap: 10 },
  explainerTitle: { fontSize: 17, fontWeight: '900', lineHeight: 22 },
  explainerBody: { fontSize: 13, lineHeight: 19 },
  explainerBullets: { gap: 4, marginTop: 4 },
  explainerBullet: { fontSize: 12, lineHeight: 17 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHelper: { fontSize: 12.5, lineHeight: 18 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectedText: { fontSize: 14, fontWeight: '700' },
  disconnectBtn: { marginTop: 4, alignSelf: 'flex-start' },
  disconnectText: { fontSize: 13, fontWeight: '700' },
  payoutBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkText: { fontSize: 13, fontWeight: '700' },
  linkBtnRow: { flexDirection: 'row', gap: 8 },
  linkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 14, paddingVertical: 11 },
  linkBtnText: { fontSize: 13, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  historyLeft: { flex: 1, marginRight: 12 },
  historyName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  historyDate: { fontSize: 12 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  historyStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  disclaimerCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  disclaimerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
