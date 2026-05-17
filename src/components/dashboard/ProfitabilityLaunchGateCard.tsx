import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchProfitabilityLaunchGateSummary,
  type ProfitabilityLaunchGateSummary,
} from '@/services/profitabilityLaunchGateService';
import { useKISTheme } from '@/theme/useTheme';

export default function ProfitabilityLaunchGateCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<ProfitabilityLaunchGateSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchProfitabilityLaunchGateSummary());
    } catch (err: any) {
      setError(err?.message || 'Profitability launch gate is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checklistItems = useMemo(
    () => Object.values(summary?.checklist || {}).slice(0, 6),
    [summary?.checklist],
  );
  const statusLabel = summary?.go_no_go?.replace(/_/g, ' ') || 'no go';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(19, 14, 25, 0.97)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.divider }]}>
          <KISIcon name="shield" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Pricing launch gate</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Legal, pastoral, tax, payment, refund, privacy, and rollback readiness before monetization can go live.
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
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.readiness_percent}%</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Ready</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{statusLabel}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Go/no-go</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.production_feature_flags?.risky_enabled_flags?.length || 0}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Risk flags</Text>
            </View>
          </View>

          <View style={styles.guardrailList}>
            {[
              summary.guardrails.no_live_charges ? 'No live charges' : 'Review charges',
              summary.guardrails.no_entitlement_enforcement ? 'No entitlement enforcement' : 'Review entitlements',
              summary.guardrails.no_conversion_tracking ? 'No conversion tracking' : 'Review tracking',
            ].map(item => (
              <View key={item} style={styles.guardrailRow}>
                <KISIcon name="check" size={14} color={palette.primaryStrong} />
                <Text style={[styles.guardrailText, { color: palette.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.checklist}>
            {checklistItems.map(item => (
              <View key={item.label} style={[styles.checkItem, { borderColor: palette.divider, backgroundColor: palette.inputBg }]}>
                <Text style={[styles.checkLabel, { color: palette.text }]}>{item.label}</Text>
                <Text style={[styles.checkStatus, { color: item.ready ? palette.primaryStrong : palette.subtext }]}>
                  {item.ready ? 'Ready' : item.status.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.nextBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            {(summary.next_readiness_steps || []).slice(0, 3).map(item => (
              <Text key={item} style={[styles.nextText, { color: palette.subtext }]}>- {item}</Text>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: palette.subtext }]}>
        This is a read-only readiness view. It does not enable subscriptions, charges, promotion checkout, enterprise leads, or analytics tracking.
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
  checklist: { gap: 8 },
  checkItem: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 3 },
  checkLabel: { fontSize: 12, fontWeight: '900' },
  checkStatus: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  nextBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  nextText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  footer: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
});
