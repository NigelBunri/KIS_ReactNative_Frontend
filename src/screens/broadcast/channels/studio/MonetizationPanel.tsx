// src/screens/broadcast/channels/studio/MonetizationPanel.tsx
//
// Monetization dashboard for channel owners. Manage tips, memberships, ad
// revenue toggles; configure payout threshold/schedule; request payouts and
// view recent payout requests.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

// ── Types ──────────────────────────────────────────────────────────────────────

type PayoutSchedule = 'weekly' | 'monthly' | 'on_request';

type PayoutRequestStatus = 'pending' | 'approved' | 'paid' | 'rejected';

type PayoutRequest = {
  id: string;
  amount: number;
  status: PayoutRequestStatus;
  created_at: string;
};

// Mirrors ChannelMonetizationSettingsSerializer's actual field names
// (apps/broadcasts/serializers.py) - this used to read/write
// memberships_enabled/creator_share/platform_share/payout_threshold,
// none of which exist on that serializer, so DRF silently dropped them
// on every PATCH (a no-op save with no error shown) and every GET
// rendered the hardcoded JS defaults below instead of the real settings.
type MonetizationData = {
  tips_enabled: boolean;
  membership_enabled: boolean;
  ad_revenue_enabled: boolean;
  revenue_share_pct: number;
  payout_threshold_cents: number;
  payout_schedule: PayoutSchedule;
  payout_requests?: PayoutRequest[];
};

type Props = {
  channelId: string;
};

const PAYOUT_SCHEDULES: Array<{ value: PayoutSchedule; label: string }> = [
  { value: 'weekly',     label: 'Weekly' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'on_request', label: 'On Request' },
];

const payoutStatusColor = (status: PayoutRequestStatus, p: any): string =>
  ({ pending: p.gold, approved: p.primary, paid: p.success, rejected: p.danger } as Record<PayoutRequestStatus, string>)[status] ?? p.subtext;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MonetizationPanel({ channelId }: Props) {
  const { palette } = useKISTheme();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [tipsEnabled,       setTipsEnabled]       = useState(false);
  const [membershipsEnabled, setMembershipsEnabled] = useState(false);
  const [adRevenueEnabled,  setAdRevenueEnabled]  = useState(false);
  const [creatorShare,      setCreatorShare]       = useState(70);
  const [platformShare,     setPlatformShare]      = useState(30);
  const [payoutThreshold,   setPayoutThreshold]    = useState('');
  const [payoutSchedule,    setPayoutSchedule]     = useState<PayoutSchedule>('monthly');
  const [payoutRequests,    setPayoutRequests]     = useState<PayoutRequest[]>([]);
  const [payoutAmount,      setPayoutAmount]       = useState('');
  const [loadFailed,        setLoadFailed]         = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await getRequest(ROUTES.broadcasts.channelMonetization(channelId));
      // getRequest resolves {success:false, data: <error body>} on failure
      // rather than throwing — `if (res?.data)` was truthy even on a failed
      // load (an error body is still an object), so every toggle below
      // silently defaulted to OFF/0 and the threshold/schedule reset to
      // blank/monthly. Tapping "Save Settings" on that fabricated state
      // would then overwrite the creator's real monetization settings with
      // these defaults. Now a failed load blocks Save entirely instead.
      if (!res?.success) {
        setLoadFailed(true);
        Alert.alert('Error', 'Could not load monetization settings. Pull to retry before saving — saving now would overwrite your real settings with blank defaults.');
        return;
      }
      const d: MonetizationData = res.data;
      setTipsEnabled(d.tips_enabled ?? false);
      setMembershipsEnabled(d.membership_enabled ?? false);
      setAdRevenueEnabled(d.ad_revenue_enabled ?? false);
      const share = Number(d.revenue_share_pct ?? 70);
      setCreatorShare(share);
      setPlatformShare(100 - share);
      setPayoutThreshold(
        d.payout_threshold_cents != null ? (d.payout_threshold_cents / 100).toFixed(2) : '',
      );
      setPayoutSchedule(d.payout_schedule ?? 'monthly');
      setPayoutRequests(d.payout_requests ?? []);
      // Also fetch payout requests separately if not bundled
      const reqRes = await getRequest(ROUTES.broadcasts.channelPayoutRequests(channelId));
      if (reqRes?.success && reqRes?.data) {
        const raw: PayoutRequest[] = Array.isArray(reqRes.data)
          ? reqRes.data
          : reqRes.data.results ?? [];
        setPayoutRequests(raw.slice(0, 5));
      }
    } catch {
      setLoadFailed(true);
      Alert.alert('Error', 'Could not load monetization settings.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Save settings ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const thresholdCents = Math.max(0, Math.round((parseFloat(payoutThreshold) || 0) * 100));
      const res = await patchRequest(
        ROUTES.broadcasts.channelMonetization(channelId),
        {
          tips_enabled:           tipsEnabled,
          membership_enabled:     membershipsEnabled,
          ad_revenue_enabled:     adRevenueEnabled,
          payout_threshold_cents: thresholdCents,
          payout_schedule:        payoutSchedule,
        },
        { errorMessage: 'Failed to save settings' },
      );
      if (!(res?.success || res?.data)) {
        Alert.alert('Save failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    saving, channelId, tipsEnabled, membershipsEnabled,
    adRevenueEnabled, payoutThreshold, payoutSchedule,
  ]);

  // ── Request payout ───────────────────────────────────────────────────────────

  const handlePayoutRequest = useCallback(async () => {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0 || requesting) return;
    setRequesting(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.channelPayoutRequests(channelId),
        { amount: amt },
        { errorMessage: 'Failed to submit payout request' },
      );
      if (res?.success || res?.data) {
        setPayoutAmount('');
        await fetchData();
      } else {
        Alert.alert('Request failed', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Request failed', e?.message || 'Please try again.');
    } finally {
      setRequesting(false);
    }
  }, [payoutAmount, requesting, channelId, fetchData]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.gold} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Toggle switches */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Monetization Features
        </Text>

        {[
          { label: 'Tips (Super Thanks)', value: tipsEnabled, onChange: setTipsEnabled },
          { label: 'Memberships',         value: membershipsEnabled, onChange: setMembershipsEnabled },
          { label: 'Ad Revenue',          value: adRevenueEnabled, onChange: setAdRevenueEnabled },
        ].map(row => (
          <View key={row.label} style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>{row.label}</Text>
            <Switch
              value={row.value}
              onValueChange={row.onChange}
              trackColor={{ false: palette.border, true: palette.gold }}
              thumbColor={palette.ivory}
            />
          </View>
        ))}
      </View>

      {/* Revenue share */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Revenue Share
        </Text>
        <View style={[styles.infoRow, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.infoText, { color: palette.text }]}>
            Creator: {creatorShare}% | Platform: {platformShare}%
          </Text>
        </View>
      </View>

      {/* Payout threshold */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Payout Threshold ($)
        </Text>
        <TextInput
          value={payoutThreshold}
          onChangeText={setPayoutThreshold}
          placeholder="e.g. 50"
          placeholderTextColor={palette.subtext}
          keyboardType="decimal-pad"
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
      </View>

      {/* Payout schedule */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Payout Schedule
        </Text>
        <View style={styles.pillRow}>
          {PAYOUT_SCHEDULES.map(sch => (
            <Pressable
              key={sch.value}
              onPress={() => setPayoutSchedule(sch.value)}
              style={[
                styles.pill,
                {
                  backgroundColor:
                    payoutSchedule === sch.value ? palette.gold : palette.surfaceElevated,
                  borderColor:
                    payoutSchedule === sch.value ? palette.gold : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: payoutSchedule === sch.value ? palette.onPrimary : palette.text },
                ]}
              >
                {sch.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loadFailed && (
        <Text style={[styles.loadFailedNote, { color: palette.danger }]}>
          Settings failed to load — saving is disabled until this reloads correctly, to avoid overwriting your real settings with blank defaults.
        </Text>
      )}

      {/* Save button */}
      <KISButton
        variant="primary"
        title="Save Settings"
        loading={saving}
        disabled={saving || loadFailed}
        onPress={handleSave}
      />

      {/* Separator */}
      <View style={[styles.separator, { backgroundColor: palette.border }]} />

      {/* Request payout */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Request Payout
        </Text>
        <TextInput
          value={payoutAmount}
          onChangeText={setPayoutAmount}
          placeholder="Amount ($)"
          placeholderTextColor={palette.subtext}
          keyboardType="decimal-pad"
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <KISButton
          variant="secondary"
          title="Submit Payout Request"
          loading={requesting}
          disabled={!payoutAmount.trim() || requesting}
          onPress={handlePayoutRequest}
          style={{ marginTop: 10 }}
        />
      </View>

      {/* Recent requests */}
      {payoutRequests.length > 0 && (
        <View style={[styles.section, { borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Recent Requests
          </Text>
          {payoutRequests.map(req => (
            <View
              key={req.id}
              style={[styles.requestRow, { backgroundColor: palette.surfaceElevated }]}
            >
              <Text style={[styles.requestAmt, { color: palette.text }]}>
                ${req.amount}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: payoutStatusColor(req.status, palette) + '22' },
                ]}
              >
                <Text
                  style={[styles.statusText, { color: payoutStatusColor(req.status, palette) }]}
                >
                  {req.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.requestDate, { color: palette.subtext }]}>
                {new Date(req.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoRow: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontWeight: '700',
    fontSize: 13,
  },
  loadFailedNote: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  requestAmt: {
    fontWeight: '700',
    fontSize: 14,
    minWidth: 60,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  requestDate: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
});
