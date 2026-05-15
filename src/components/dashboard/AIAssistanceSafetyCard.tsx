import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchAIAssistanceSafetyPolicy,
  type AIAssistanceSafetyCheck,
  type AIAssistanceSafetyPolicy,
} from '@/services/aiAssistanceSafetyService';
import { useKISTheme } from '@/theme/useTheme';

const toneFor = (status: string, palette: any) => {
  if (status === 'blocked' || status === 'critical' || status === 'fail') {
    return { bg: 'rgba(185,28,28,0.1)', border: 'rgba(185,28,28,0.35)', text: '#B91C1C' };
  }
  if (status === 'conditional' || status === 'warning') {
    return { bg: palette.primarySoft, border: palette.goldBorder || palette.primaryStrong, text: palette.primaryStrong };
  }
  return { bg: palette.surface, border: palette.divider, text: palette.subtext };
};

function AICheck({ item }: { item: AIAssistanceSafetyCheck }) {
  const { palette } = useKISTheme();
  const tone = toneFor(item.status === 'pass' ? 'healthy' : item.severity, palette);
  return (
    <View style={[styles.checkCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.checkStatus, { color: tone.text }]}>{item.status === 'pass' ? 'PASS' : item.severity}</Text>
      <Text numberOfLines={1} style={[styles.checkTitle, { color: palette.text }]}>{item.label}</Text>
      <Text numberOfLines={3} style={[styles.checkDetail, { color: palette.subtext }]}>{item.detail}</Text>
    </View>
  );
}

export default function AIAssistanceSafetyCard() {
  const { isDark, palette } = useKISTheme();
  const [policy, setPolicy] = useState<AIAssistanceSafetyPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPolicy(await fetchAIAssistanceSafetyPolicy());
    } catch (err: any) {
      setError(err?.message || 'AI safety policy is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleChecks = useMemo(
    () => (policy?.checks || []).filter(item => item.status !== 'pass').slice(0, 8),
    [policy?.checks],
  );
  const surfaces = useMemo(
    () => Object.keys(policy?.assistant_surfaces || {}).slice(0, 7).map(key => key.replace(/_/g, ' ')),
    [policy?.assistant_surfaces],
  );
  const tone = toneFor(policy?.summary?.go_live_status || 'healthy', palette);

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
        <View style={[styles.iconBox, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <KISIcon name="shield" size={20} color={tone.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>AI safety boundaries</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Placeholder-ready assistance with Christian, child-safety, privacy, and human-review guardrails.
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

      {policy ? (
        <>
          <View style={styles.countRow}>
            <View style={[styles.countPill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
              <Text style={[styles.countValue, { color: tone.text }]}>{policy.summary.go_live_status.toUpperCase()}</Text>
              <Text style={[styles.countLabel, { color: tone.text }]}>Status</Text>
            </View>
            <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.countValue, { color: palette.text }]}>{policy.provider.live_calls_enabled ? 'ON' : 'OFF'}</Text>
              <Text style={[styles.countLabel, { color: palette.subtext }]}>Live calls</Text>
            </View>
            <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
              <Text style={[styles.countValue, { color: palette.text }]}>{policy.summary.critical_failures}</Text>
              <Text style={[styles.countLabel, { color: palette.subtext }]}>Critical</Text>
            </View>
          </View>

          <View style={styles.policyList}>
            {[
              'No diagnosis, financial advice, or legal advice',
              'No raw private health, payment, or verification data',
              'Explicit, manipulative, and predatory content blocked',
            ].map(item => (
              <View key={item} style={styles.policyRow}>
                <KISIcon name="check-circle" size={14} color={palette.primaryStrong} />
                <Text style={[styles.policyText, { color: palette.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surfaceRow}>
            {surfaces.map(label => (
              <View key={label} style={[styles.surfaceChip, { borderColor: palette.goldBorder || palette.divider, backgroundColor: palette.surface }]}>
                <Text style={[styles.surfaceText, { color: palette.text }]}>{label}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.checkRow}>
        {(visibleChecks.length ? visibleChecks : (policy?.checks || []).slice(0, 4)).map(item => (
          <AICheck key={item.key} item={item} />
        ))}
      </ScrollView>

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Redacted policy only: no provider secrets, raw prompts, raw responses, private records, or payment instruments.
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
  policyText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  surfaceRow: { gap: 8, paddingRight: 4 },
  surfaceChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  surfaceText: { fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  checkRow: { gap: 10, paddingRight: 4 },
  checkCard: { width: 220, minHeight: 124, borderRadius: 16, borderWidth: 1, padding: 12 },
  checkStatus: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  checkTitle: { marginTop: 7, fontSize: 14, fontWeight: '900' },
  checkDetail: { marginTop: 5, fontSize: 12, lineHeight: 17 },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  errorText: { fontSize: 12, lineHeight: 17 },
  privacyText: { fontSize: 11, lineHeight: 16 },
});
