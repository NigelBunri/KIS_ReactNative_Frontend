import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchLaunchOpsReadinessSummary,
  type LaunchOpsCheck,
  type LaunchOpsReadinessSummary,
} from '@/services/launchOpsReadinessService';
import { useKISTheme } from '@/theme/useTheme';

const statusCopy: Record<string, string> = {
  go: 'GO',
  conditional_go: 'Conditional',
  no_go: 'No-go',
  ready: 'Ready',
  blocked: 'Blocked',
};

function toneFor(status: string, palette: any) {
  if (status === 'no_go' || status === 'blocked' || status === 'critical') {
    return { bg: 'rgba(185,28,28,0.1)', border: 'rgba(185,28,28,0.35)', text: '#B91C1C' };
  }
  if (status === 'conditional_go' || status === 'warning') {
    return { bg: palette.primarySoft, border: palette.goldBorder || palette.primaryStrong, text: palette.primaryStrong };
  }
  return { bg: palette.surface, border: palette.divider, text: palette.subtext };
}

function ReadinessCheck({ item }: { item: LaunchOpsCheck }) {
  const { palette } = useKISTheme();
  const tone = toneFor(item.status === 'ready' ? 'ready' : item.severity, palette);
  return (
    <View style={[styles.checkCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.checkStatus, { color: tone.text }]}>
        {statusCopy[item.status] || item.status}
      </Text>
      <Text numberOfLines={1} style={[styles.checkTitle, { color: palette.text }]}>
        {item.label}
      </Text>
      <Text numberOfLines={3} style={[styles.checkDetail, { color: palette.subtext }]}>
        {item.detail}
      </Text>
    </View>
  );
}

export default function LaunchOpsReadinessCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<LaunchOpsReadinessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchLaunchOpsReadinessSummary());
    } catch (err: any) {
      setError(err?.message || 'Launch operations readiness is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleChecks = useMemo(() => {
    const sections = summary?.sections || {};
    const all = [
      ...(sections.operational || []),
      ...(sections.provider_evidence || []),
      ...(sections.production_flags || []),
    ];
    const blocked = all.filter(item => item.status !== 'ready');
    return (blocked.length ? blocked : all).slice(0, 10);
  }, [summary?.sections]);

  const tone = toneFor(summary?.go_no_go || 'conditional_go', palette);

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
          <Text style={[styles.title, { color: palette.text }]}>Launch operations</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Staff-only go/no-go for operational evidence, provider proof, production flags, and rollback.
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
        <View style={styles.countRow}>
          <View style={[styles.countPill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
            <Text style={[styles.countValue, { color: tone.text }]}>
              {statusCopy[summary.go_no_go] || summary.go_no_go}
            </Text>
            <Text style={[styles.countLabel, { color: tone.text }]}>Status</Text>
          </View>
          <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
            <Text style={[styles.countValue, { color: palette.text }]}>{summary.readiness_percent}%</Text>
            <Text style={[styles.countLabel, { color: palette.subtext }]}>Ready</Text>
          </View>
          <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
            <Text style={[styles.countValue, { color: palette.text }]}>{summary.summary.critical_blockers}</Text>
            <Text style={[styles.countLabel, { color: palette.subtext }]}>Blockers</Text>
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.checkRow}>
        {visibleChecks.map(item => (
          <ReadinessCheck key={item.key} item={item} />
        ))}
      </ScrollView>

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Redacted staff summary only: no secrets, raw provider payloads, private health records, payment instruments, raw documents, or storage paths.
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
  checkRow: { gap: 10, paddingRight: 4 },
  checkCard: { width: 220, minHeight: 126, borderRadius: 16, borderWidth: 1, padding: 12 },
  checkStatus: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  checkTitle: { marginTop: 7, fontSize: 14, fontWeight: '900' },
  checkDetail: { marginTop: 5, fontSize: 12, lineHeight: 17 },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  errorText: { fontSize: 12, lineHeight: 17 },
  privacyText: { fontSize: 11, lineHeight: 16 },
});
