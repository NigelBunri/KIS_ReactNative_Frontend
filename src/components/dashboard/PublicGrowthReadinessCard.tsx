import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { fetchPublicSitemapPlan, type PublicSitemapPlan } from '@/services/publicGrowthService';
import { useKISTheme } from '@/theme/useTheme';

export default function PublicGrowthReadinessCard() {
  const { isDark, palette } = useKISTheme();
  const [plan, setPlan] = useState<PublicSitemapPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlan(await fetchPublicSitemapPlan());
    } catch (err: any) {
      setError(err?.message || 'Public growth readiness is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const indexingReady = Boolean(plan?.indexing_enabled);

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
        <View style={[styles.iconBox, { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.primaryStrong }]}>
          <KISIcon name="share-2" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Public growth readiness</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Safe public channel/content metadata, share cards, embeds, reports, and SEO gates.
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

      <View style={styles.countRow}>
        <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
          <Text style={[styles.countValue, { color: palette.text }]}>{plan?.channels?.length ?? 0}</Text>
          <Text style={[styles.countLabel, { color: palette.subtext }]}>Channels</Text>
        </View>
        <View style={[styles.countPill, { borderColor: palette.goldBorder || palette.divider }]}>
          <Text style={[styles.countValue, { color: palette.text }]}>{plan?.contents?.length ?? 0}</Text>
          <Text style={[styles.countLabel, { color: palette.subtext }]}>Content URLs</Text>
        </View>
        <View style={[styles.countPill, { borderColor: indexingReady ? palette.goldBorder || palette.primaryStrong : palette.divider, backgroundColor: indexingReady ? palette.primarySoft : 'transparent' }]}>
          <Text style={[styles.countValue, { color: indexingReady ? palette.primaryStrong : palette.text }]}>{indexingReady ? 'ON' : 'OFF'}</Text>
          <Text style={[styles.countLabel, { color: indexingReady ? palette.primaryStrong : palette.subtext }]}>Indexing</Text>
        </View>
      </View>

      <View style={styles.policyList}>
        {[
          'Only public, published, non-child-sensitive content is exposed',
          'Private storage paths and secrets stay hidden',
          'Public reports remain available for abuse-safe growth',
        ].map(item => (
          <View key={item} style={styles.policyRow}>
            <KISIcon name="check-circle" size={14} color={palette.primaryStrong} />
            <Text style={[styles.policyText, { color: palette.text }]}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        SEO indexing is intentionally off until production QA approves public pages, embeds, moderation, and child-safety evidence.
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
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  errorText: { fontSize: 12, lineHeight: 17 },
  privacyText: { fontSize: 11, lineHeight: 16 },
});
