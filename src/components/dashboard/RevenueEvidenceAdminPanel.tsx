import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  createRevenueLaunchEvidenceRecord,
  fetchRevenueLaunchEvidenceRecords,
  runRevenueLaunchEvidenceAction,
  type RevenueLaunchEvidencePayload,
  type RevenueLaunchEvidenceRecord,
} from '@/services/revenueLaunchEvidenceService';
import {
  fetchProfitabilityRevenueReadiness,
  type ProfitabilityRevenueReadinessSummary,
} from '@/services/profitabilityRevenueReadinessService';
import {
  fetchStagingProofWorkflows,
  type StagingProofWorkflow,
  type StagingProofWorkflowSummary,
} from '@/services/profitabilityStagingProofService';
import {
  fetchProductionGoNoGoSummary,
  type ProductionGoNoGoSummary,
} from '@/services/profitabilityProductionGoNoGoService';
import {
  fetchProfitabilityBetaLaunchPlan,
  type ProfitabilityBetaLaunchSummary,
} from '@/services/profitabilityBetaLaunchService';
import {
  fetchProfitabilityBetaOperations,
  type ProfitabilityBetaOperationsSummary,
} from '@/services/profitabilityBetaOperationsService';
import { useKISTheme } from '@/theme/useTheme';

const AREA_OPTIONS = [
  'legal_review',
  'pastoral_child_safety_review',
  'tax_accounting_review',
  'flutterwave_sandbox_proof',
  'invoice_receipt_proof',
  'refund_support_proof',
  'entitlement_grace_policy',
  'promotion_sponsored_label_policy',
  'verification_fee_policy',
  'enterprise_contract_policy',
  'privacy_analytics_policy',
  'rollback_proof',
];

const cleanLabel = (value: string) => value.replace(/_/g, ' ');

export default function RevenueEvidenceAdminPanel() {
  const { isDark, palette } = useKISTheme();
  const [records, setRecords] = useState<RevenueLaunchEvidenceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaIndex, setAreaIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [ownerRole, setOwnerRole] = useState('');
  const [privateMediaAssetId, setPrivateMediaAssetId] = useState('');
  const [redactedSummary, setRedactedSummary] = useState('');
  const [readiness, setReadiness] = useState<ProfitabilityRevenueReadinessSummary | null>(null);
  const [stagingProof, setStagingProof] = useState<StagingProofWorkflowSummary | null>(null);
  const [productionGoNoGo, setProductionGoNoGo] = useState<ProductionGoNoGoSummary | null>(null);
  const [betaLaunch, setBetaLaunch] = useState<ProfitabilityBetaLaunchSummary | null>(null);
  const [betaOperations, setBetaOperations] = useState<ProfitabilityBetaOperationsSummary | null>(null);

  const selected = useMemo(
    () => records.find(record => record.id === selectedId) || records[0] || null,
    [records, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchRevenueLaunchEvidenceRecords();
      const readinessPayload = await fetchProfitabilityRevenueReadiness();
      const stagingProofPayload = await fetchStagingProofWorkflows();
      const productionPayload = await fetchProductionGoNoGoSummary();
      const betaPayload = await fetchProfitabilityBetaLaunchPlan();
      const betaOpsPayload = await fetchProfitabilityBetaOperations();
      const nextRecords = payload.results || [];
      setRecords(nextRecords);
      setReadiness(readinessPayload);
      setStagingProof(stagingProofPayload);
      setProductionGoNoGo(productionPayload);
      setBetaLaunch(betaPayload);
      setBetaOperations(betaOpsPayload);
      setSelectedId(current => current || nextRecords[0]?.id || '');
    } catch (err: any) {
      setError(err?.message || 'Revenue evidence records are unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createRecord = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedSummary = redactedSummary.trim();
    if (!trimmedTitle || !trimmedSummary) {
      Alert.alert('Evidence required', 'Add a title and a redacted summary before creating a record.');
      return;
    }
    const payload: RevenueLaunchEvidencePayload = {
      area: AREA_OPTIONS[areaIndex],
      title: trimmedTitle,
      owner_role: ownerRole.trim(),
      redacted_summary: trimmedSummary,
      private_media_asset_id: privateMediaAssetId.trim() || null,
    };
    setSaving(true);
    try {
      const created = await createRevenueLaunchEvidenceRecord(payload);
      const readinessPayload = await fetchProfitabilityRevenueReadiness();
      const productionPayload = await fetchProductionGoNoGoSummary();
      const betaPayload = await fetchProfitabilityBetaLaunchPlan();
      const betaOpsPayload = await fetchProfitabilityBetaOperations();
      setRecords(prev => [created, ...prev]);
      setReadiness(readinessPayload);
      setProductionGoNoGo(productionPayload);
      setBetaLaunch(betaPayload);
      setBetaOperations(betaOpsPayload);
      setSelectedId(created.id);
      setTitle('');
      setOwnerRole('');
      setPrivateMediaAssetId('');
      setRedactedSummary('');
    } catch (err: any) {
      Alert.alert('Unable to create evidence', err?.message || 'The evidence record could not be created.');
    } finally {
      setSaving(false);
    }
  }, [areaIndex, ownerRole, privateMediaAssetId, redactedSummary, title]);

  const runAction = useCallback(async (action: 'submit' | 'approve' | 'needs_changes' | 'reject' | 'revoke') => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await runRevenueLaunchEvidenceAction(selected.id, action);
      const readinessPayload = await fetchProfitabilityRevenueReadiness();
      const productionPayload = await fetchProductionGoNoGoSummary();
      const betaPayload = await fetchProfitabilityBetaLaunchPlan();
      const betaOpsPayload = await fetchProfitabilityBetaOperations();
      setRecords(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setReadiness(readinessPayload);
      setProductionGoNoGo(productionPayload);
      setBetaLaunch(betaPayload);
      setBetaOperations(betaOpsPayload);
      setSelectedId(updated.id);
    } catch (err: any) {
      Alert.alert('Unable to update evidence', err?.message || 'The evidence status could not be updated.');
    } finally {
      setSaving(false);
    }
  }, [selected]);

  const applyWorkflowTemplate = useCallback((workflow: StagingProofWorkflow) => {
    const index = AREA_OPTIONS.indexOf(workflow.area);
    setAreaIndex(index >= 0 ? index : 0);
    setTitle(workflow.title);
    setOwnerRole(workflow.owner_role);
    setRedactedSummary(workflow.redacted_summary_template);
    if (workflow.private_media_required && !privateMediaAssetId.trim()) {
      setPrivateMediaAssetId('');
    }
  }, [privateMediaAssetId]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(18, 14, 25, 0.97)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.divider }]}>
          <KISIcon name="settings" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Revenue evidence admin</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Staff-only review workflow. No live billing, no provider payloads, no private documents.
          </Text>
        </View>
        {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: palette.divider }]}>
          <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
          <KISButton title="Retry" size="sm" variant="outline" onPress={load} />
        </View>
      ) : null}

      <View style={styles.noGoBox}>
        <KISIcon name="shield" size={15} color={palette.primaryStrong} />
        <Text style={[styles.noGoText, { color: palette.text }]}>
          Monetization remains {readiness?.go_no_go?.replace(/_/g, ' ') || 'NO-GO'} until evidence is approved by legal, pastoral/child-safety, tax, payment, privacy, and release owners.
        </Text>
      </View>

      {readiness ? (
        <>
          <View style={styles.metricRow}>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{readiness.readiness_percent}%</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Ready</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{readiness.ready_count}/{readiness.total_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Approved</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{readiness.blocked_count + readiness.expired_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Blocked</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {Object.entries(readiness.areas).map(([area, item]) => (
              <View
                key={area}
                style={[
                  styles.statusChip,
                  {
                    borderColor: item.ready ? (palette.goldBorder || palette.primaryStrong) : palette.divider,
                    backgroundColor: item.ready ? palette.primarySoft : palette.inputBg,
                  },
                ]}
              >
                <Text style={[styles.statusChipLabel, { color: palette.text }]}>{item.label}</Text>
                <Text style={[styles.statusChipState, { color: palette.subtext }]}>
                  {cleanLabel(item.state)} - {item.required_reviewer_role || 'reviewer'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {productionGoNoGo ? (
        <View style={[styles.productionBox, { borderColor: palette.goldBorder || palette.divider, backgroundColor: palette.inputBg }]}>
          <View style={styles.proofHeader}>
            <KISIcon name="shield" size={15} color={palette.primaryStrong} />
            <Text style={[styles.proofTitle, { color: palette.text }]}>Production monetization go/no-go</Text>
          </View>
          <View style={styles.metricRow}>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{productionGoNoGo.readiness_percent}%</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Production</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{cleanLabel(productionGoNoGo.go_no_go)}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Status</Text>
            </View>
          </View>
          {productionGoNoGo.blocked_checks.slice(0, 4).map(item => (
            <Text key={item} style={[styles.proofText, { color: palette.subtext }]}>- {cleanLabel(item)}</Text>
          ))}
        </View>
      ) : null}

      {betaLaunch ? (
        <View style={[styles.betaBox, { borderColor: palette.goldBorder || palette.divider, backgroundColor: palette.surface }]}>
          <View style={styles.proofHeader}>
            <KISIcon name="shield" size={15} color={palette.primaryStrong} />
            <Text style={[styles.proofTitle, { color: palette.text }]}>Limited beta monetization plan</Text>
          </View>
          <Text style={[styles.proofText, { color: palette.subtext }]}>
            {cleanLabel(betaLaunch.go_no_go)}. Live charges, provider calls, entitlement enforcement, promotion checkout, and enterprise lead capture remain gated.
          </Text>
          <View style={styles.metricRow}>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{betaLaunch.readiness_percent}%</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Beta ready</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{betaLaunch.ready_count}/{betaLaunch.total_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Modules</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {Object.values(betaLaunch.modules).map(module => (
              <View
                key={module.key}
                style={[
                  styles.statusChip,
                  {
                    borderColor: module.ready ? (palette.goldBorder || palette.primaryStrong) : palette.divider,
                    backgroundColor: module.ready ? palette.primarySoft : palette.inputBg,
                  },
                ]}
              >
                <Text style={[styles.statusChipLabel, { color: palette.text }]}>{module.label}</Text>
                <Text style={[styles.statusChipState, { color: palette.subtext }]}>
                  {cleanLabel(module.state)} - {cleanLabel(module.reason)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {betaOperations ? (
        <View style={[styles.betaBox, { borderColor: palette.goldBorder || palette.divider, backgroundColor: palette.inputBg }]}>
          <View style={styles.proofHeader}>
            <KISIcon name="users" size={15} color={palette.primaryStrong} />
            <Text style={[styles.proofTitle, { color: palette.text }]}>Beta cohort operations</Text>
          </View>
          <Text style={[styles.proofText, { color: palette.subtext }]}>
            {cleanLabel(betaOperations.go_no_go)}. Invites are manual, staff-only, and unavailable until owners, support, rollback, and evidence are ready.
          </Text>
          <View style={styles.metricRow}>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{betaOperations.ready_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Ready</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{betaOperations.paused_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Paused</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{betaOperations.blocked_count}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Blocked</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {Object.values(betaOperations.cohorts).map(cohort => (
              <View
                key={cohort.key}
                style={[
                  styles.statusChip,
                  {
                    borderColor: cohort.state === 'ready' ? (palette.goldBorder || palette.primaryStrong) : palette.divider,
                    backgroundColor: cohort.state === 'ready' ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={[styles.statusChipLabel, { color: palette.text }]}>{cohort.label}</Text>
                <Text style={[styles.statusChipState, { color: palette.subtext }]}>
                  {cleanLabel(cohort.state)} - support: {cleanLabel(cohort.owner_tracking.support_owner_role)}
                </Text>
                <Text style={[styles.privateRef, { color: palette.subtext }]}>
                  rollback: {cleanLabel(cohort.owner_tracking.rollback_owner_role)}
                </Text>
              </View>
            ))}
          </ScrollView>
          {betaOperations.final_beta_readiness ? (
            <View style={[styles.auditBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>Final beta readiness</Text>
              {Object.entries(betaOperations.final_beta_readiness).map(([key, item]) => (
                <Text key={key} style={[styles.auditText, { color: palette.subtext }]}>
                  - {cleanLabel(key)}: {cleanLabel(item.state)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {stagingProof ? (
        <View style={[styles.proofBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <View style={styles.proofHeader}>
            <KISIcon name="shield" size={15} color={palette.primaryStrong} />
            <Text style={[styles.proofTitle, { color: palette.text }]}>Staging proof templates</Text>
          </View>
          <Text style={[styles.proofText, { color: palette.subtext }]}>
            Templates only. Run staging checks outside the app, then store redacted summaries and private MediaAsset references here.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {Object.values(stagingProof.workflows).map(workflow => (
              <KISButton
                key={workflow.key}
                title={cleanLabel(workflow.key)}
                size="sm"
                variant="outline"
                onPress={() => applyWorkflowTemplate(workflow)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {AREA_OPTIONS.map((area, index) => (
          <KISButton
            key={area}
            title={cleanLabel(area)}
            size="sm"
            variant={index === areaIndex ? 'primary' : 'outline'}
            onPress={() => setAreaIndex(index)}
          />
        ))}
      </ScrollView>

      <View style={styles.form}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Evidence title"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.inputBg }]}
        />
        <TextInput
          value={ownerRole}
          onChangeText={setOwnerRole}
          placeholder="Owner role, e.g. legal_counsel"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.inputBg }]}
        />
        <TextInput
          value={privateMediaAssetId}
          onChangeText={setPrivateMediaAssetId}
          placeholder="Private MediaAsset id only, optional"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.inputBg }]}
        />
        <TextInput
          value={redactedSummary}
          onChangeText={setRedactedSummary}
          placeholder="Redacted summary. Do not paste secrets, raw provider payloads, payment data, or private documents."
          placeholderTextColor={palette.subtext}
          multiline
          style={[styles.textarea, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.inputBg }]}
        />
        <KISButton title={saving ? 'Saving...' : 'Create evidence'} size="sm" onPress={createRecord} disabled={saving} />
      </View>

      <View style={styles.records}>
        {records.length === 0 && !loading ? (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No revenue launch evidence records yet.
          </Text>
        ) : null}
        {records.slice(0, 6).map(record => (
          <View
            key={record.id}
            style={[
              styles.record,
              {
                borderColor: selected?.id === record.id ? (palette.goldBorder || palette.primaryStrong) : palette.divider,
                backgroundColor: selected?.id === record.id ? palette.primarySoft : palette.inputBg,
              },
            ]}
          >
            <Text onPress={() => setSelectedId(record.id)} style={[styles.recordTitle, { color: palette.text }]}>
              {record.title}
            </Text>
            <Text style={[styles.recordMeta, { color: palette.subtext }]}>
              {cleanLabel(record.area)} - {cleanLabel(record.status)}{record.is_expired ? ' - expired' : ''} - reviewer: {record.reviewer_display || record.required_reviewer_role || 'unassigned'}
            </Text>
            {record.private_media_asset_id ? (
              <Text style={[styles.privateRef, { color: palette.subtext }]}>
                Private media ref: {record.private_media_asset_id}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {selected ? (
        <>
          <View style={styles.actionRow}>
            <KISButton title="Submit" size="sm" variant="outline" onPress={() => runAction('submit')} disabled={saving} />
            <KISButton title="Approve" size="sm" variant="outline" onPress={() => runAction('approve')} disabled={saving} />
            <KISButton title="Changes" size="sm" variant="outline" onPress={() => runAction('needs_changes')} disabled={saving} />
            <KISButton title="Reject" size="sm" variant="outline" onPress={() => runAction('reject')} disabled={saving} />
            <KISButton title="Revoke" size="sm" variant="outline" onPress={() => runAction('revoke')} disabled={saving} />
          </View>
          <View style={[styles.auditBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={[styles.sectionLabel, { color: palette.text }]}>Audit timeline</Text>
            {(selected.audit_events || []).slice(0, 5).map(event => (
              <Text key={event.id || `${event.event_type}-${event.created_at}`} style={[styles.auditText, { color: palette.subtext }]}>
                - {cleanLabel(String(event.event_type || 'event'))} by {event.actor_display || 'KIS staff'}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  noGoBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noGoText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  metricValue: { fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
  metricLabel: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  statusRow: { gap: 8, paddingVertical: 2 },
  statusChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 220 },
  statusChipLabel: { fontSize: 11, fontWeight: '900' },
  statusChipState: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: '800', textTransform: 'capitalize' },
  proofBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proofTitle: { fontSize: 12, fontWeight: '900' },
  proofText: { fontSize: 11, lineHeight: 16, fontWeight: '800' },
  productionBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  betaBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  chipRow: { gap: 8, paddingVertical: 2 },
  form: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 44, fontSize: 13, fontWeight: '700' },
  textarea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, minHeight: 86, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlignVertical: 'top' },
  records: { gap: 8 },
  record: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  recordTitle: { fontSize: 13, fontWeight: '900' },
  recordMeta: { fontSize: 11, lineHeight: 16, fontWeight: '800', textTransform: 'capitalize' },
  privateRef: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
  emptyText: { fontSize: 12, fontWeight: '800' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  auditBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  auditText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
