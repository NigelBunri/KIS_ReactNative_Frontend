// src/screens/broadcast/channels/studio/AdCampaignPanel.tsx
//
// Ad campaign manager — list campaigns, create new ones, track budget progress.

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

// ── Types ──────────────────────────────────────────────────────────────────────

type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

type Campaign = {
  id: string;
  title: string;
  status: CampaignStatus;
  budget_total: number;
  budget_spent: number;
  impression_count?: number;
  start_date?: string;
  end_date?: string;
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const campaignStatusColor = (status: CampaignStatus, p: any): string =>
  ({ draft: p.subtext, active: p.success, paused: p.gold, ended: p.danger } as Record<CampaignStatus, string>)[status] ?? p.subtext;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdCampaignPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formActive, setFormActive] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.channelAdCampaigns(channelId),
        { errorMessage: '' },
      );
      const raw: Campaign[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setCampaigns(raw);
    } catch {
      setError('Could not load campaigns.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const resetForm = () => {
    setFormTitle('');
    setFormBudget('');
    setFormStart('');
    setFormEnd('');
    setFormActive(false);
  };

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert('Validation', 'Campaign title is required.');
      return;
    }
    const budget = parseFloat(formBudget);
    if (!budget || budget <= 0) {
      Alert.alert('Validation', 'Enter a valid budget amount.');
      return;
    }
    setCreating(true);
    try {
      const res = await postRequest(
        ROUTES.broadcasts.channelAdCampaigns(channelId),
        {
          title: formTitle.trim(),
          budget_total: budget,
          start_date: formStart.trim() || undefined,
          end_date: formEnd.trim() || undefined,
          status: formActive ? 'active' : 'draft',
        },
        { errorMessage: 'Could not create campaign.' },
      );
      if (res?.data || res?.id) {
        resetForm();
        setShowForm(false);
        await fetchCampaigns();
      } else {
        Alert.alert('Error', res?.message ?? 'Could not create campaign.');
      }
    } catch {
      Alert.alert('Error', 'Could not create campaign. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [channelId, fetchCampaigns, formActive, formBudget, formEnd, formStart, formTitle]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header action */}
      <Pressable
        onPress={() => setShowForm(prev => !prev)}
        style={[styles.newBtn, { backgroundColor: palette.primaryStrong }]}
      >
        <Text style={[styles.newBtnText, { color: palette.onPrimary }]}>{showForm ? 'Cancel' : '+ New Campaign'}</Text>
      </Pressable>

      {/* Creation form */}
      {showForm && (
        <View style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>New Ad Campaign</Text>
          <TextInput
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Campaign title"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <TextInput
            value={formBudget}
            onChangeText={setFormBudget}
            placeholder="Budget ($)"
            placeholderTextColor={palette.subtext}
            keyboardType="decimal-pad"
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <TextInput
            value={formStart}
            onChangeText={setFormStart}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <TextInput
            value={formEnd}
            onChangeText={setFormEnd}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: palette.text }]}>Set as Active</Text>
            <Switch
              value={formActive}
              onValueChange={setFormActive}
              trackColor={{ false: palette.border, true: palette.primaryStrong }}
              thumbColor={palette.ivory}
            />
          </View>
          <Pressable
            onPress={handleCreate}
            disabled={creating}
            style={[styles.createBtn, { backgroundColor: palette.primaryStrong }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={palette.onPrimary} />
            ) : (
              <Text style={[styles.createBtnText, { color: palette.onPrimary }]}>Create Campaign</Text>
            )}
          </Pressable>
        </View>
      )}

      {error && (
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 && !showForm ? (
        <View style={[styles.emptyState, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No ad campaigns yet. Create one to get started.
          </Text>
        </View>
      ) : (
        campaigns.map(campaign => {
          const spentPct =
            campaign.budget_total > 0
              ? Math.min((campaign.budget_spent / campaign.budget_total) * 100, 100)
              : 0;
          const statusColor = campaignStatusColor(campaign.status, palette);
          return (
            <View
              key={campaign.id}
              style={[styles.campaignCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.campaignHeader}>
                <Text numberOfLines={1} style={[styles.campaignTitle, { color: palette.text, flex: 1 }]}>
                  {campaign.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {campaign.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetText, { color: palette.subtext }]}>
                  ${campaign.budget_spent.toFixed(2)} spent of ${campaign.budget_total.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${spentPct}%` as any, backgroundColor: palette.primaryStrong },
                  ]}
                />
              </View>
              {campaign.impression_count != null && (
                <Text style={[styles.impressionText, { color: palette.subtext }]}>
                  {campaign.impression_count} impressions
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  newBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newBtnText: { fontWeight: '800', fontSize: 13 },
  formCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  createBtn: {
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  createBtnText: { fontWeight: '800', fontSize: 14 },
  campaignCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  campaignHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campaignTitle: { fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  budgetRow: {},
  budgetText: { fontSize: 12, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  impressionText: { fontSize: 11, fontWeight: '600' },
  emptyState: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
