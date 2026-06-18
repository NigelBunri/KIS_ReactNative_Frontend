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

type MonetizationData = {
  tips_enabled: boolean;
  memberships_enabled: boolean;
  ad_revenue_enabled: boolean;
  creator_share: number;
  platform_share: number;
  payout_threshold: string;
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

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.channelMonetization(channelId));
      if (res?.data) {
        const d: MonetizationData = res.data;
        setTipsEnabled(d.tips_enabled ?? false);
        setMembershipsEnabled(d.memberships_enabled ?? false);
        setAdRevenueEnabled(d.ad_revenue_enabled ?? false);
        setCreatorShare(d.creator_share ?? 70);
        setPlatformShare(d.platform_share ?? 30);
        setPayoutThreshold(d.payout_threshold ?? '');
        setPayoutSchedule(d.payout_schedule ?? 'monthly');
        setPayoutRequests(d.payout_requests ?? []);
      }
      // Also fetch payout requests separately if not bundled
      const reqRes = await getRequest(ROUTES.broadcasts.channelPayoutRequests(channelId));
      if (reqRes?.data) {
        const raw: PayoutRequest[] = Array.isArray(reqRes.data)
          ? reqRes.data
          : reqRes.data.results ?? [];
        setPayoutRequests(raw.slice(0, 5));
      }
    } catch {
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
      const res = await patchRequest(
        ROUTES.broadcasts.channelMonetization(channelId),
        {
          tips_enabled:        tipsEnabled,
          memberships_enabled: membershipsEnabled,
          ad_revenue_enabled:  adRevenueEnabled,
          payout_threshold:    payoutThreshold,
          payout_schedule:     payoutSchedule,
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

      {/* Save button */}
      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: palette.gold }]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={[styles.saveBtnText, { color: palette.onPrimary }]}>Save Settings</Text>
        )}
      </Pressable>

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
        <Pressable
          onPress={handlePayoutRequest}
          disabled={!payoutAmount.trim() || requesting}
          style={[
            styles.payoutBtn,
            {
              backgroundColor:
                payoutAmount.trim() && !requesting
                  ? palette.primaryStrong
                  : palette.surfaceElevated,
            },
          ]}
        >
          {requesting ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={[styles.payoutBtnText, { color: palette.onPrimary }]}>Submit Payout Request</Text>
          )}
        </Pressable>
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
  saveBtn: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontWeight: '800',
    fontSize: 15,
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  payoutBtn: {
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  payoutBtnText: {
    fontWeight: '700',
    fontSize: 14,
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
