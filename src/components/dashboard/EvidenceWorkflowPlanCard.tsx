import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchProfitabilityEvidenceWorkflowPlan,
  type ProfitabilityEvidenceWorkflowPlan,
} from '@/services/profitabilityEvidenceWorkflowService';
import { useKISTheme } from '@/theme/useTheme';

export default function EvidenceWorkflowPlanCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<ProfitabilityEvidenceWorkflowPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchProfitabilityEvidenceWorkflowPlan());
    } catch (err: any) {
      setError(err?.message || 'Evidence workflow plan is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const evidenceItems = useMemo(
    () => Object.values(summary?.evidence_areas || {}).slice(0, 4),
    [summary?.evidence_areas],
  );

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
          <KISIcon name="archive" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Evidence workflow plan</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Planned approval states, audit trail, private media references, reviewer roles, and redacted serializer contract.
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

      {summary ? (
        <>
          <View style={styles.metricRow}>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.approval_states.length}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>States</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.audit_event_types.length}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Audit events</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.guardrails.no_database_migration_created ? 'Plan' : 'Live'}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Mode</Text>
            </View>
          </View>

          <View style={styles.guardrailList}>
            {[
              summary.guardrails.private_media_references_only ? 'Private media refs only' : 'Review media storage',
              summary.guardrails.no_raw_documents ? 'No raw documents' : 'Review documents',
              summary.guardrails.no_raw_provider_payloads ? 'No raw provider payloads' : 'Review provider data',
            ].map(item => (
              <View key={item} style={styles.guardrailRow}>
                <KISIcon name="check" size={14} color={palette.primaryStrong} />
                <Text style={[styles.guardrailText, { color: palette.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.list}>
            {evidenceItems.map(item => (
              <View key={item.key || item.label} style={[styles.item, { borderColor: palette.divider, backgroundColor: palette.inputBg }]}>
                <Text style={[styles.itemLabel, { color: palette.text }]}>{item.label}</Text>
                <Text style={[styles.itemStatus, { color: palette.subtext }]}>
                  {item.requires_private_media_reference ? 'Private evidence reference required' : 'Approval evidence required'}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: palette.subtext }]}>
        No migrations or write actions are active yet. This is the safe implementation plan for evidence storage and approval.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 12, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  metricValue: { fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
  metricLabel: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  guardrailList: { gap: 7 },
  guardrailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guardrailText: { fontSize: 12, fontWeight: '800', flex: 1 },
  list: { gap: 8 },
  item: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 3 },
  itemLabel: { fontSize: 12, fontWeight: '900' },
  itemStatus: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  footer: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
});
