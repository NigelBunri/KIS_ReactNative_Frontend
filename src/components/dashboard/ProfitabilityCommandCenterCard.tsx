import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchProfitabilityCommandCenterSummary,
  type ProfitabilityCommandCenterSummary,
} from '@/services/profitabilityCommandCenterService';
import { useKISTheme } from '@/theme/useTheme';

export default function ProfitabilityCommandCenterCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<ProfitabilityCommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchProfitabilityCommandCenterSummary());
    } catch (err: any) {
      setError(err?.message || 'Profitability command center is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleLabels = useMemo(
    () => Object.keys(summary?.module_revenue_potential || {}).slice(0, 8).map(key => key.replace(/_/g, ' ')),
    [summary?.module_revenue_potential],
  );
  const directPayment = summary?.direct_usd_payment_readiness;
  const guardrails = summary?.guardrails || {};

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(20, 16, 27, 0.97)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.divider }]}>
          <KISIcon name="poll" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Profitability command center</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Aggregate revenue readiness only. No private payment, health, verification, or personal tracking data.
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
          <View style={styles.countRow}>
            <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.countValue, { color: palette.text }]}>{summary.tracking_live ? 'LIVE' : 'OFF'}</Text>
              <Text style={[styles.countLabel, { color: palette.subtext }]}>Tracking</Text>
            </View>
            <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.countValue, { color: palette.text }]}>{directPayment?.total_intents ?? 0}</Text>
              <Text style={[styles.countLabel, { color: palette.subtext }]}>USD intents</Text>
            </View>
            <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.countValue, { color: palette.text }]}>{summary.enabled ? 'ON' : 'PREVIEW'}</Text>
              <Text style={[styles.countLabel, { color: palette.subtext }]}>Revenue</Text>
            </View>
          </View>

          <View style={styles.policyList}>
            {[
              guardrails.no_live_charges ? 'No live charges' : 'Review live charges',
              guardrails.no_intrusive_tracking ? 'No intrusive tracking' : 'Review tracking',
              guardrails.no_payment_instrument_data ? 'No payment instrument data' : 'Review payment privacy',
            ].map(item => (
              <View key={item} style={styles.policyRow}>
                <KISIcon name="check" size={14} color={palette.primaryStrong} />
                <Text style={[styles.policyText, { color: palette.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surfaceRow}>
            {moduleLabels.map(label => (
              <View key={label} style={[styles.surfaceChip, { borderColor: palette.goldBorder || palette.divider, backgroundColor: palette.surface }]}>
                <Text style={[styles.surfaceText, { color: palette.text }]}>{label}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.nextBox, { borderColor: palette.divider, backgroundColor: palette.inputBg }]}>
            {(summary.next_readiness_steps || []).slice(0, 3).map(item => (
              <Text key={item} style={[styles.nextText, { color: palette.subtext }]}>- {item}</Text>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Conversion data is placeholder-only until consent, privacy review, and aggregate event schemas are approved.
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
  countRow: { flexDirection: 'row', gap: 8 },
  countPill: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 10 },
  countValue: { fontSize: 16, fontWeight: '900' },
  countLabel: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  policyList: { gap: 7 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyText: { fontSize: 12, fontWeight: '800', flex: 1 },
  surfaceRow: { gap: 8, paddingVertical: 2 },
  surfaceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  surfaceText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  nextBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  nextText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  privacyText: { fontSize: 10, lineHeight: 15, fontWeight: '800' },
});
