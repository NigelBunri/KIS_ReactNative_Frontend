import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteVisits'>;

type Summary = {
  days: number;
  total_views: number;
  unique_visitors: number;
  daily: Array<{ date: string; count: number }>;
  top_pages: Array<{ page_id: string; title: string; slug: string; count: number }>;
};

function StatCard({ label, value, palette, typography, spacing }: { label: string; value: number; palette: any; typography: any; spacing: any }) {
  return (
    <View style={{ flex: 1, borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, padding: spacing.sm }}>
      <Text style={{ ...typography.h2, color: palette.text }}>{value}</Text>
      <Text style={{ ...typography.caption, color: palette.subtext }}>{label}</Text>
    </View>
  );
}

export default function WebsiteVisitsScreen({ route }: Props) {
  const { websiteId } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.analyticsSummary(websiteId, 30));
      const data = (res as any)?.data ?? res;
      setSummary(data && typeof data === 'object' ? data : null);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (loading || !summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  const maxDaily = Math.max(1, ...summary.daily.map((d) => d.count));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: palette.text }}>Visits</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>Last {summary.days} days</Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <StatCard label="Total Views" value={summary.total_views} palette={palette} typography={typography} spacing={spacing} />
          <StatCard label="Unique Visitors" value={summary.unique_visitors} palette={palette} typography={typography} spacing={spacing} />
        </View>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Daily Views</Text>
        {summary.daily.length === 0 ? (
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>No visits recorded yet.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: spacing.sm, height: 100 }}>
            {summary.daily.map((d) => (
              <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(4, (d.count / maxDaily) * 90),
                    backgroundColor: palette.accentPrimary,
                    borderRadius: 3,
                  }}
                />
              </View>
            ))}
          </View>
        )}

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Top Pages</Text>
        {summary.top_pages.length === 0 ? (
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>No page views yet.</Text>
        ) : (
          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            {summary.top_pages.map((p) => (
              <View
                key={p.page_id}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider,
                  backgroundColor: palette.card, padding: spacing.sm,
                }}
              >
                <Text style={{ ...typography.label, color: palette.text }}>{p.title}</Text>
                <Text style={{ ...typography.label, color: palette.subtext }}>{p.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
