import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import {
  fetchBillingReconciliations,
  fetchInsuranceClaims,
  fetchPaymentDisputes,
  fetchPricingInsights,
  reconcileBillingEntry,
  updateInsuranceClaimStatus,
  resolvePaymentDispute,
} from '@/services/financialService';

const unwrapList = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

const CLAIM_TRANSITIONS: Record<string, string[]> = {
  submitted: ['in_review'],
  in_review: ['approved', 'denied'],
  approved: ['paid'],
  denied: [],
  paid: [],
};

type FinancialPanelProps = {
  palette: KISPalette;
  profileId?: string;
  organizationId?: string;
  refreshKey?: string | number;
};

export function FinancialPanel({ palette, profileId, organizationId, refreshKey }: FinancialPanelProps) {
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [insights, setInsights] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReconcileId, setPendingReconcileId] = useState<string | null>(null);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [pendingDisputeId, setPendingDisputeId] = useState<string | null>(null);

  const loadFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = organizationId ? { organization: organizationId } : {};
      const [
        reconciliationsRes,
        claimsRes,
        disputesRes,
        pricingRes,
      ] = await Promise.all([
        fetchBillingReconciliations({ ordering: '-created_at', limit: 3, ...filters }),
        fetchInsuranceClaims({ ordering: '-submitted_at', limit: 4, ...filters }),
        fetchPaymentDisputes({ ordering: '-created_at', limit: 4, ...filters }),
        fetchPricingInsights(),
      ]);

      if (!reconciliationsRes.success) {
        throw new Error(reconciliationsRes.message || 'Unable to load reconciliations.');
      }
      if (!claimsRes.success) {
        throw new Error(claimsRes.message || 'Unable to load claims.');
      }
      if (!disputesRes.success) {
        throw new Error(disputesRes.message || 'Unable to load disputes.');
      }
      if (!pricingRes.success) {
        throw new Error(pricingRes.message || 'Unable to load pricing insights.');
      }

      setReconciliations(unwrapList(reconciliationsRes.data));
      setClaims(unwrapList(claimsRes.data));
      setDisputes(unwrapList(disputesRes.data));
      setInsights(pricingRes.data);
    } catch (error: any) {
      Alert.alert('Financial operations', error?.message || 'Unable to load finance data.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadFinancialData();
  }, [loadFinancialData, profileId, refreshKey]);

  const handleReconcile = useCallback(
    async (id: string) => {
      setPendingReconcileId(id);
      try {
        const res = await reconcileBillingEntry(id);
        if (!res?.success) throw new Error(res?.message || 'Unable to reconcile.');
        Alert.alert('Reconciliation', 'Entry marked as reconciled.');
        await loadFinancialData();
      } catch (error: any) {
        Alert.alert('Reconciliation', error?.message || 'Unable to reconcile entry.');
      } finally {
        setPendingReconcileId(null);
      }
    },
    [loadFinancialData],
  );

  const handleClaimTransition = useCallback(
    async (id: string, status: string) => {
      setPendingClaimId(id);
      try {
        const res = await updateInsuranceClaimStatus(id, { status });
        if (!res?.success) throw new Error(res?.message || 'Unable to update claim.');
        Alert.alert('Claims', 'Claim updated.');
        await loadFinancialData();
      } catch (error: any) {
        Alert.alert('Claims', error?.message || 'Unable to update claim.');
      } finally {
        setPendingClaimId(null);
      }
    },
    [loadFinancialData],
  );

  const handleResolveDispute = useCallback(
    async (id: string) => {
      setPendingDisputeId(id);
      try {
        const res = await resolvePaymentDispute(id, { resolution: 'Resolved via platform' });
        if (!res?.success) throw new Error(res?.message || 'Unable to resolve dispute.');
        Alert.alert('Disputes', 'Dispute marked resolved.');
        await loadFinancialData();
      } catch (error: any) {
        Alert.alert('Disputes', error?.message || 'Unable to resolve dispute.');
      } finally {
        setPendingDisputeId(null);
      }
    },
    [loadFinancialData],
  );

  const sectionStyle = useMemo(
    () => ({
      borderWidth: 2,
      borderColor: palette.divider,
      borderRadius: 14,
      padding: 12,
      backgroundColor: palette.card,
      marginTop: 10,
      gap: 8,
    }),
    [palette.card, palette.divider],
  );

  const statStyle = useMemo(
    () => ({
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 12,
      padding: 10,
      marginTop: 6,
    }),
    [palette.divider],
  );

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '$0.00';
    return `$${(value / 100).toFixed(2)}`;
  };

  return (
    <View style={styles.managementForm}>
      <View style={sectionStyle}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Financial control center</Text>
          <KISButton
            title="Refresh"
            variant="ghost"
            size="xs"
            onPress={() => {
              void loadFinancialData();
            }}
            disabled={loading}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={palette.primaryStrong} />
        ) : (
          <>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Billing, claims, disputes, and pricing telemetry.</Text>
            {profileId ? (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>Profile ID: {profileId}</Text>
            ) : null}
            {organizationId ? (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>Organization ID: {organizationId}</Text>
            ) : null}
            <View style={statStyle}>
              <Text style={{ color: palette.subtext }}>Wallet balance</Text>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {formatCurrency(insights?.wallet_balance_cents)}
              </Text>
            </View>
            <View style={statStyle}>
              <Text style={{ color: palette.subtext }}>Current tier</Text>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {insights?.current_subscription?.tier?.name ?? 'Free'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Reconciliations</Text>
        {loading ? (
          <ActivityIndicator size="small" color={palette.primaryStrong} />
        ) : reconciliations.length ? (
          reconciliations.map((entry) => (
            <View key={entry.id} style={[styles.managementItemCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={{ color: palette.text, fontWeight: '700' }}>
                  {entry.insurance_provider || 'Manual'} · {formatCurrency(entry.amount_cents)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Status: {entry.status}
                </Text>
              </View>
              <KISButton
                title={pendingReconcileId === entry.id ? 'Reconciling…' : 'Reconcile'}
                size="xs"
                variant="outline"
                onPress={() => {
                  void handleReconcile(entry.id);
                }}
                disabled={pendingReconcileId === entry.id || entry.status === 'reconciled'}
              />
            </View>
          ))
        ) : (
          <Text style={{ color: palette.subtext }}>Nothing to reconcile.</Text>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Claims lifecycle</Text>
        {claims.length ? (
          claims.map((claim) => (
            <View key={claim.id} style={styles.managementItemCard}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {claim.service_code || 'Claim'} · {formatCurrency(claim.amount_cents)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Status: {claim.status} · Ref: {claim.claim_reference || '–'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {(CLAIM_TRANSITIONS[claim.status] || []).map((next) => (
                  <KISButton
                    key={`${claim.id}-${next}`}
                    title={`Mark ${next}`}
                    size="xs"
                    variant="ghost"
                    onPress={() => {
                      void handleClaimTransition(claim.id, next);
                    }}
                    disabled={pendingClaimId === claim.id}
                  />
                ))}
                {!CLAIM_TRANSITIONS[claim.status]?.length ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No transitions available.</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: palette.subtext }}>No claims reported.</Text>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Payment disputes</Text>
        {disputes.length ? (
          disputes.map((dispute) => (
            <View key={dispute.id} style={styles.managementItemCard}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {dispute.dispute_reason || 'User flagged transaction'}
              </Text>
              <KISButton
                title={pendingDisputeId === dispute.id ? 'Resolving…' : 'Resolve'}
                size="xs"
                variant="outline"
                onPress={() => {
                  void handleResolveDispute(dispute.id);
                }}
                disabled={pendingDisputeId === dispute.id || dispute.status === 'resolved'}
              />
            </View>
          ))
        ) : (
          <Text style={{ color: palette.subtext }}>No open disputes.</Text>
        )}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Pricing transparency</Text>
        {insights?.tiers?.length ? (
          insights.tiers.map((tier: any) => (
            <View key={tier.id} style={[styles.managementItemCard, { borderColor: palette.divider }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>{tier.name}</Text>
                <Text style={{ color: palette.subtext }}>{formatCurrency(tier.price_cents)}</Text>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {tier.features_json?.summary || 'Feature list available in admin.'}
              </Text>
              {insights.current_subscription?.tier?.name === tier.name ? (
                <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>Current plan</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={{ color: palette.subtext }}>Pricing info unavailable.</Text>
        )}
      </View>
    </View>
  );
}
