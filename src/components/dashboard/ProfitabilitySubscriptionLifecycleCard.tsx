import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchProfitabilitySubscriptionLifecycleSummary,
  type ProfitabilitySubscriptionLifecycleSummary,
} from '@/services/profitabilitySubscriptionLifecycleService';
import { useKISTheme } from '@/theme/useTheme';

export default function ProfitabilitySubscriptionLifecycleCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<ProfitabilitySubscriptionLifecycleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchProfitabilitySubscriptionLifecycleSummary());
    } catch (err: any) {
      setError(err?.message || 'Subscription lifecycle readiness is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lifecycleItems = useMemo(
    () => Object.values(summary?.subscription_lifecycle_states || {}).slice(0, 4),
    [summary?.subscription_lifecycle_states],
  );
  const sandboxItems = useMemo(
    () => Object.values(summary?.provider_sandbox_checks || {}).slice(0, 3),
    [summary?.provider_sandbox_checks],
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
          <KISIcon name="document" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Billing sandbox readiness</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Subscription lifecycle, invoices, refunds, trials, promotion fees, verification fees, and support planning only.
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
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.provider}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Provider</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.provider_links_enabled ? 'ON' : 'OFF'}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Links</Text>
            </View>
            <View style={[styles.metric, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{summary.production_provider_connected ? 'LIVE' : 'SAFE'}</Text>
              <Text style={[styles.metricLabel, { color: palette.subtext }]}>Provider</Text>
            </View>
          </View>

          <View style={styles.guardrailList}>
            {[
              summary.guardrails.no_live_charges ? 'No live charges' : 'Review charges',
              summary.guardrails.no_payment_instrument_collection ? 'No payment instruments' : 'Review payment privacy',
              summary.guardrails.no_kis_credit_cash_value ? 'KIS credits stay non-cash' : 'Review credit safety',
            ].map(item => (
              <View key={item} style={styles.guardrailRow}>
                <KISIcon name="check" size={14} color={palette.primaryStrong} />
                <Text style={[styles.guardrailText, { color: palette.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {lifecycleItems.map(item => (
              <View key={item.key || item.label} style={[styles.item, { backgroundColor: palette.inputBg, borderColor: palette.divider }]}>
                <Text style={[styles.itemLabel, { color: palette.text }]}>{item.label}</Text>
                <Text style={[styles.itemStatus, { color: palette.subtext }]}>{String(item.status || 'planned').replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.sandboxBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={[styles.sectionLabel, { color: palette.text }]}>Sandbox checks</Text>
            {sandboxItems.map(item => (
              <Text key={item.key || item.label} style={[styles.nextText, { color: palette.subtext }]}>
                - {item.label}: {String(item.status || 'planned').replace(/_/g, ' ')}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: palette.subtext }]}>
        This card does not start payments, subscriptions, trials, invoices, refunds, or entitlement enforcement.
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
  grid: { gap: 8 },
  item: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 3 },
  itemLabel: { fontSize: 12, fontWeight: '900' },
  itemStatus: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  sandboxBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  nextText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  footer: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
});
