import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchUnifiedDashboardSummary,
  type UnifiedDashboardSummary,
  type UnifiedDashboardSurface,
} from '@/services/unifiedDashboardService';
import { useKISTheme } from '@/theme/useTheme';

const METRIC_LABELS: Record<string, string> = {
  dashboards: 'Dashboards',
  channels: 'Channels',
  shops: 'Shops',
  education_institutions: 'Education',
  health_institutions: 'Health',
  partners: 'Partners',
  verified_surfaces: 'Verified',
};

const READINESS_LABELS: Record<string, string> = {
  analytics: 'Analytics',
  content: 'Content',
  moderation: 'Moderation',
  verification: 'Trust',
  payments: 'USD payments',
  members: 'Members',
  accessibility_family_safety: 'Family safe',
  launch: 'Launch',
};

function SurfaceCard({ surface }: { surface: UnifiedDashboardSurface }) {
  const { palette } = useKISTheme();
  const visibleMetrics = Object.entries(surface.metrics || {}).slice(0, 3);
  return (
    <View
      style={[
        styles.surfaceCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.goldBorder || palette.divider,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.surfaceTitle, { color: palette.text }]}>
        {surface.title}
      </Text>
      <Text numberOfLines={1} style={[styles.surfaceSubtitle, { color: palette.subtext }]}>
        {surface.subtitle}
      </Text>
      <View style={styles.surfaceMetrics}>
        {visibleMetrics.map(([key, value]) => (
          <Text key={key} style={[styles.surfaceMetricText, { color: palette.subtext }]}>
            {key.replace(/_/g, ' ')}: {String(value ?? 0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function UnifiedDashboardSummaryCard() {
  const { isDark, palette } = useKISTheme();
  const [summary, setSummary] = useState<UnifiedDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchUnifiedDashboardSummary();
      setSummary(payload);
    } catch (err: any) {
      setError(err?.message || 'Dashboard summary is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metricItems = useMemo(() => {
    const counts = summary?.counts || {};
    return Object.entries(METRIC_LABELS).map(([key, label]) => ({
      key,
      label,
      value: Number((counts as any)[key] || 0),
    }));
  }, [summary?.counts]);

  const readinessItems = useMemo(() => {
    const readiness = summary?.readiness || {};
    return Object.entries(READINESS_LABELS).map(([key, label]) => ({
      key,
      label,
      ready: Boolean(readiness[key]),
    }));
  }, [summary?.readiness]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(18, 16, 28, 0.96)' : 'rgba(255,255,255,0.98)',
          borderColor: palette.goldBorder || palette.divider,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: palette.primarySoft, borderColor: palette.goldBorder || palette.divider },
          ]}
        >
          <KISIcon name="briefcase" size={20} color={palette.primaryStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Command dashboards</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Creator, institution, business, ministry, safety, and launch readiness.
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

      <View style={styles.metricsGrid}>
        {metricItems.map(item => (
          <View key={item.key} style={[styles.metricPill, { borderColor: palette.goldBorder || palette.divider }]}>
            <Text style={[styles.metricValue, { color: palette.text }]}>{item.value}</Text>
            <Text style={[styles.metricLabel, { color: palette.subtext }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.readinessRow}>
        {readinessItems.map(item => (
          <View
            key={item.key}
            style={[
              styles.readinessChip,
              {
                backgroundColor: item.ready ? palette.primarySoft : palette.surface,
                borderColor: item.ready ? palette.goldBorder || palette.primaryStrong : palette.divider,
              },
            ]}
          >
            <Text style={[styles.readinessText, { color: item.ready ? palette.primaryStrong : palette.subtext }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      {summary?.surfaces?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surfaceRow}>
          {summary.surfaces.map(surface => (
            <Pressable key={surface.key}>
              <SurfaceCard surface={surface} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>
          Create a channel, shop, institution, health provider, or partner workspace to activate dashboard cards.
        </Text>
      )}

      <Text style={[styles.privacyText, { color: palette.subtext }]}>
        Privacy-safe summary only: no secrets, raw evidence, payment instruments, private health records, or storage paths.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  readinessRow: {
    gap: 8,
    paddingRight: 4,
  },
  readinessChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  readinessText: {
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceRow: {
    gap: 10,
    paddingRight: 4,
  },
  surfaceCard: {
    width: 180,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  surfaceTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  surfaceSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  surfaceMetrics: {
    marginTop: 10,
    gap: 2,
  },
  surfaceMetricText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
