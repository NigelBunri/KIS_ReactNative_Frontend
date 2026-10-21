// src/screens/broadcast/channels/studio/MembershipTiersPanel.tsx
//
// Owner-facing membership tier management: list existing tiers, create new
// ones, retire old ones, and edit each tier's perks inline. Closes a real
// gap — ChannelMembershipTierListView.post (the create-tier endpoint) had
// no mobile call site anywhere, so there was no way for a creator to ever
// put a tier in front of members, even though the join/gift/perks-edit
// flows on the member side were already fully wired.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import MembershipPerksEditor from '@/screens/broadcast/channels/studio/MembershipPerksEditor';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tier = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  perks: string[];
};

type Props = {
  channelId: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MembershipTiersPanel({ channelId }: Props) {
  const { palette } = useKISTheme();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.channelMembershipTiers(channelId), { errorMessage: '' });
      const rows = Array.isArray(res) ? res : res?.data ?? [];
      setTiers(Array.isArray(rows) ? rows : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    const priceCents = Math.max(0, Math.round((parseFloat(newPrice) || 0) * 100));
    setCreating(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.channelMembershipTiers(channelId),
        { title, price_cents: priceCents, currency: newCurrency.trim().toUpperCase() || 'USD' },
        { errorMessage: 'Could not create tier.' },
      );
      if (!res?.success) {
        Alert.alert('Error', res?.message || 'Could not create tier. Please try again.');
        return;
      }
      setNewTitle('');
      setNewPrice('');
      await load();
    } finally {
      setCreating(false);
    }
  }, [newTitle, newPrice, newCurrency, creating, channelId, load]);

  const handleRetire = useCallback((tier: Tier) => {
    Alert.alert('Retire tier', `Retire "${tier.title}"? Existing members keep access; new members can no longer join it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retire', style: 'destructive',
        onPress: async () => {
          setRetiringId(tier.id);
          const res = await deleteRequest(
            ROUTES.broadcasts.membershipTier(tier.id),
            { errorMessage: 'Could not retire tier.' },
          ).catch(() => null);
          if (!res || res.success === false) {
            Alert.alert('Error', res?.message || 'Could not retire tier. Please try again.');
          }
          await load();
          setRetiringId(null);
        },
      },
    ]);
  }, [load]);

  const formatPrice = (cents: number, currency: string) =>
    cents === 0 ? 'Free' : `${currency} ${(cents / 100).toFixed(2)}/mo`;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.surface }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Membership Tiers</Text>
      <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>
        Create free or paid tiers members can join from your channel page.
      </Text>

      {tiers.length === 0 && (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>No tiers yet — create your first one below.</Text>
      )}

      {tiers.map(tier => (
        <View key={tier.id} style={[styles.tierCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Pressable
            onPress={() => setExpandedId(prev => (prev === tier.id ? null : tier.id))}
            style={styles.tierHeaderRow}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierTitle, { color: palette.text }]}>{tier.title}</Text>
              <Text style={[styles.tierPrice, { color: palette.gold }]}>
                {formatPrice(tier.price_cents, tier.currency)}
              </Text>
            </View>
            <KISButton
              variant="danger"
              size="xs"
              title="Retire"
              loading={retiringId === tier.id}
              disabled={retiringId === tier.id}
              onPress={() => handleRetire(tier)}
              accessibilityLabel={`Retire ${tier.title}`}
            />
          </Pressable>

          {expandedId === tier.id && (
            <MembershipPerksEditor tierId={tier.id} tierTitle={tier.title} initialPerks={tier.perks || []} />
          )}
        </View>
      ))}

      {/* Create tier */}
      <View style={[styles.createCard, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>New Tier</Text>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Tier name (e.g. Gold)"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <View style={styles.row}>
          <TextInput
            value={newPrice}
            onChangeText={setNewPrice}
            placeholder="Price / mo (0 = free)"
            placeholderTextColor={palette.subtext}
            keyboardType="decimal-pad"
            style={[styles.input, styles.rowInput, { color: palette.text, borderColor: palette.border }]}
          />
          <TextInput
            value={newCurrency}
            onChangeText={setNewCurrency}
            placeholder="USD"
            placeholderTextColor={palette.subtext}
            autoCapitalize="characters"
            maxLength={3}
            style={[styles.input, styles.currencyInput, { color: palette.text, borderColor: palette.border }]}
          />
        </View>
        <KISButton
          variant="primary"
          title="Create Tier"
          loading={creating}
          disabled={!newTitle.trim() || creating}
          onPress={handleCreate}
        />
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  tierCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  tierHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  tierTitle: { fontSize: 14, fontWeight: '800' },
  tierPrice: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  createCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowInput: { flex: 1 },
  currencyInput: { width: 72 },
});
