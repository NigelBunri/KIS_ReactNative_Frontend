// src/screens/broadcast/channels/studio/CopyrightClaimsPanel.tsx
//
// Copyright claims manager — lists claims, lets owners dispute matched/pending ones.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const CLAIM_TYPE_COLOR: Record<ClaimType, string> = {
  AUDIO: '#8B5CF6',
  VIDEO: '#EF4444',
  MANUAL: '#F59E0B',
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  pending: '#F59E0B',
  matched: '#EF4444',
  disputed: '#3B82F6',
  resolved: '#22C55E',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CopyrightClaimsPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [claims, setClaims] = useState<CopyrightClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);

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

  const handleDispute = (claim: CopyrightClaim) => {
    Alert.prompt(
      'Dispute Claim',
      `Provide a reason to dispute the "${claim.content_title ?? 'content'}" claim:`,
      async (reason: string) => {
        if (!reason?.trim()) return;
        setDisputingId(claim.id);
        try {
          await postRequest(
            `${ROUTES.broadcasts.channelCopyrightClaims(channelId)}${claim.id}/dispute/`,
            { reason: reason.trim() },
            { errorMessage: 'Could not submit dispute.' },
          );
          await fetchClaims();
        } catch {
          Alert.alert('Error', 'Could not submit dispute. Please try again.');
        } finally {
          setDisputingId(null);
        }
      },
      'plain-text',
    );
  };

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
                    { backgroundColor: CLAIM_TYPE_COLOR[claim.claim_type] + '22' },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: CLAIM_TYPE_COLOR[claim.claim_type] }]}
                  >
                    {claim.claim_type}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: STATUS_COLOR[claim.status] + '22' },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: STATUS_COLOR[claim.status] }]}
                  >
                    {claim.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            {(claim.status === 'matched' || claim.status === 'pending') && (
              <Text
                onPress={() => {
                  if (disputingId === claim.id) return;
                  handleDispute(claim);
                }}
                style={[
                  styles.disputeBtn,
                  {
                    backgroundColor: palette.primaryStrong,
                    opacity: disputingId === claim.id ? 0.5 : 1,
                  },
                ]}
              >
                {disputingId === claim.id ? 'Submitting...' : 'Dispute'}
              </Text>
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
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
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
