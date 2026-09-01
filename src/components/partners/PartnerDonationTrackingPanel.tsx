// src/components/partners/PartnerDonationTrackingPanel.tsx
//
// Donation Tracking: admins log donations received through any channel
// (cash, check, bank transfer, card, mobile money) for receipt and
// reporting purposes. This is a bookkeeping ledger, not a payment
// processor — it never moves money, it records that money was already
// received elsewhere. Backed by apps.partners.PartnerDonation, which
// auto-generates a receipt number on creation.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Donation = {
  id: string | number;
  donor_display_name: string;
  amount: string | number;
  currency: string;
  method: string;
  fund?: string;
  received_at: string;
  receipt_number: string;
  notes?: string;
};
type Summary = {
  total_amount: string | number;
  donation_count: number;
  by_fund: { fund: string; total: string | number; count: number }[];
  by_method: { method: string; total: string | number; count: number }[];
};

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

const methodLabel: Record<string, string> = {
  cash: 'Cash', check: 'Check', bank_transfer: 'Bank transfer', card: 'Card', mobile_money: 'Mobile money', other: 'Other',
};
const METHODS = Object.keys(methodLabel);

export default function PartnerDonationTrackingPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [fund, setFund] = useState('');
  const [notes, setNotes] = useState('');

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const [donationRes, summaryRes] = await Promise.all([
      getRequest(ROUTES.partners.donations(partnerId), { errorMessage: 'Unable to load donations.' }),
      getRequest(ROUTES.partners.donationsSummary(partnerId), { errorMessage: 'Unable to load summary.' }),
    ]);
    const payload = donationRes?.data ?? [];
    setDonations(Array.isArray(payload) ? payload : []);
    setSummary(summaryRes?.data ?? null);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const createDonation = async () => {
    if (!partnerId || !donorName.trim() || !amount.trim()) {
      Alert.alert('Missing info', 'Donor name and amount are required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.donations(partnerId),
      { donor_name: donorName.trim(), amount: amount.trim(), method, fund: fund.trim(), notes: notes.trim() },
      { errorMessage: 'Unable to record donation.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to record donation.');
      return;
    }
    setDonorName('');
    setAmount('');
    setMethod('cash');
    setFund('');
    setNotes('');
    setShowCreate(false);
    load();
  };

  const deleteDonation = (donation: Donation) => {
    if (!partnerId) return;
    Alert.alert('Delete donation record?', `Receipt ${donation.receipt_number} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.donationDetail(partnerId, String(donation.id)), {
            errorMessage: 'Unable to delete donation.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete donation.');
            return;
          }
          load();
        },
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Donation Tracking</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Track donations and receipts</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              {summary ? (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.primary, backgroundColor: `${palette.primary}11`, marginBottom: 16 }]}>
                  <Text style={{ color: palette.primary, fontSize: 22, fontWeight: '900' }}>${summary.total_amount}</Text>
                  <Text style={{ color: palette.text, fontSize: 12, marginTop: 2 }}>
                    {summary.donation_count} donation{summary.donation_count === 1 ? '' : 's'} recorded
                  </Text>
                  {summary.by_fund.length > 0 ? (
                    <View style={{ marginTop: 8 }}>
                      {summary.by_fund.map((row) => (
                        <Text key={row.fund} style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                          {row.fund}: ${row.total} ({row.count})
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new donation' : '+ Record a donation'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={donorName} onChangeText={setDonorName} placeholder="Donor name (or 'Anonymous')" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={palette.subtext} keyboardType="decimal-pad" style={inputStyle(palette)} />
                  <TextInput value={fund} onChangeText={setFund} placeholder="Fund (optional, e.g. General Fund)" placeholderTextColor={palette.subtext} style={inputStyle(palette)} />
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 10, marginBottom: 4 }}>Method</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {METHODS.map((m) => {
                      const selected = method === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setMethod(m)}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{methodLabel[m]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={palette.subtext} multiline style={[inputStyle(palette), { minHeight: 50, textAlignVertical: 'top' }]} />
                  <Pressable
                    onPress={createDonation}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Recording…' : 'Record donation'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {donations.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No donations recorded yet.</Text>
              ) : (
                donations.map((donation) => (
                  <View key={donation.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{donation.donor_display_name}</Text>
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>${donation.amount}</Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {donation.received_at} · {methodLabel[donation.method] ?? donation.method}
                      {donation.fund ? ` · ${donation.fund}` : ''}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 2 }}>{donation.receipt_number}</Text>
                    <Pressable onPress={() => deleteDonation(donation)} style={{ marginTop: 6 }}>
                      <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
