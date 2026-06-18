// src/screens/broadcast/channels/studio/CopyrightClaimsPanel.tsx
//
// Copyright claims manager — lists claims, lets owners dispute matched/pending ones.

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
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

// ── Types ──────────────────────────────────────────────────────────────────────

type ClaimType = 'AUDIO' | 'VIDEO' | 'MANUAL';
type ClaimStatus = 'pending' | 'matched' | 'disputed' | 'resolved';

type CopyrightClaim = {
  id: string;
  content_title?: string;
  claim_type: ClaimType;
  status: ClaimStatus;
  dispute_url?: string;
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const claimTypeColor = (type: ClaimType, p: any): string =>
  ({ AUDIO: p.primaryStrong, VIDEO: p.danger, MANUAL: p.gold } as Record<ClaimType, string>)[type] ?? p.subtext;

const statusColor = (status: ClaimStatus, p: any): string =>
  ({ pending: p.gold, matched: p.danger, disputed: p.primary, resolved: p.success } as Record<ClaimStatus, string>)[status] ?? p.subtext;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CopyrightClaimsPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [claims, setClaims] = useState<CopyrightClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [disputeFormId, setDisputeFormId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const fetchClaims = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        ROUTES.broadcasts.channelCopyrightClaims(channelId),
        { errorMessage: '' },
      );
      const raw: CopyrightClaim[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setClaims(raw);
    } catch {
      setError('Could not load copyright claims.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchClaims();
  }, [fetchClaims]);

  const openDisputeForm = (claim: CopyrightClaim) => {
    setDisputeFormId(claim.id);
    setDisputeReason('');
  };

  const submitDispute = useCallback(async (claim: CopyrightClaim) => {
    if (!disputeReason.trim()) {
      Alert.alert('Reason required', 'Enter a reason to dispute this claim.');
      return;
    }
    setDisputingId(claim.id);
    try {
      await postRequest(
        ROUTES.broadcasts.channelCopyrightDisputeUrl(claim.id),
        { reason: disputeReason.trim() },
        { errorMessage: 'Could not submit dispute.' },
      );
      setDisputeFormId(null);
      setDisputeReason('');
      await fetchClaims();
    } catch {
      Alert.alert('Error', 'Could not submit dispute. Please try again.');
    } finally {
      setDisputingId(null);
    }
  }, [channelId, disputeReason, fetchClaims]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {claims.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No copyright claims</Text>
          <Text style={[styles.emptySubtext, { color: palette.subtext }]}>
            Your content is in good standing.
          </Text>
        </View>
      ) : (
        claims.map(claim => (
          <View
            key={claim.id}
            style={[styles.claimCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <View style={styles.claimHeader}>
              <Text
                numberOfLines={1}
                style={[styles.claimTitle, { color: palette.text, flex: 1 }]}
              >
                {claim.content_title ?? 'Untitled content'}
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: claimTypeColor(claim.claim_type, palette) + '22' },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: claimTypeColor(claim.claim_type, palette) }]}
                  >
                    {claim.claim_type}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: statusColor(claim.status, palette) + '22' },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: statusColor(claim.status, palette) }]}
                  >
                    {claim.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            {(claim.status === 'matched' || claim.status === 'pending') && disputeFormId !== claim.id && (
              <Pressable
                disabled={disputingId === claim.id}
                onPress={() => openDisputeForm(claim)}
                style={[
                  styles.disputeBtn,
                  {
                    backgroundColor: palette.primaryStrong,
                    opacity: disputingId === claim.id ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.disputeBtnText, { color: palette.onPrimary }]}>
                  {disputingId === claim.id ? 'Submitting...' : 'Dispute'}
                </Text>
              </Pressable>
            )}
            {disputeFormId === claim.id && (
              <View style={styles.disputeForm}>
                <TextInput
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  placeholder="Reason for dispute"
                  placeholderTextColor={palette.subtext}
                  multiline
                  style={[styles.disputeInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]}
                />
                <View style={styles.disputeFormActions}>
                  <Pressable
                    onPress={() => { setDisputeFormId(null); setDisputeReason(''); }}
                    style={[styles.cancelBtn, { borderColor: palette.border }]}
                  >
                    <Text style={[styles.cancelBtnText, { color: palette.subtext }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={disputingId === claim.id}
                    onPress={() => submitDispute(claim)}
                    style={[styles.disputeBtn, styles.disputeSubmitBtn, { backgroundColor: palette.primaryStrong, opacity: disputingId === claim.id ? 0.5 : 1 }]}
                  >
                    <Text style={[styles.disputeBtnText, { color: palette.onPrimary }]}>
                      {disputingId === claim.id ? 'Submitting...' : 'Submit dispute'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  claimCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  claimTitle: { fontSize: 13, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  disputeBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  disputeBtnText: { fontSize: 12, fontWeight: '800' },
  disputeForm: { gap: 8 },
  disputeInput: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  disputeFormActions: { flexDirection: 'row', gap: 8 },
  disputeSubmitBtn: { flex: 1 },
  cancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '900' },
  emptyState: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptySubtext: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
