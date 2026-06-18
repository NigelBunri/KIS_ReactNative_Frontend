// src/screens/broadcast/channels/studio/AudienceDemographicsPanel.tsx
//
// Audience demographics panel — age-group and country breakdown with
// proportional bar charts using View widths (no external chart library).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type DemoPeriod = '30d' | '90d';

type AgeBucket = {
  age_bucket: string;
  view_count: number;
};

type CountryBucket = {
  country_code: string;
  view_count: number;
};

type DemographicsData = {
  age_groups?: AgeBucket[];
  top_countries?: CountryBucket[];
};

type Props = {
  channelId: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudienceDemographicsPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [period, setPeriod] = useState<DemoPeriod>('30d');
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: DemoPeriod) => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.channelDemographics(channelId)}?period=${p}`,
        { errorMessage: '' },
      );
      setData(res?.data ?? res ?? {});
    } catch {
      setError('Could not load demographics data.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchData(period);
  }, [fetchData, period]);

  const ageGroups: AgeBucket[] = data?.age_groups ?? [];
  const countries: CountryBucket[] = data?.top_countries ?? [];

  const ageTotal = ageGroups.reduce((sum, g) => sum + g.view_count, 0);
  const countryTotal = countries.reduce((sum, c) => sum + c.view_count, 0);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Period selector */}
      <View style={styles.pillRow}>
        {(['30d', '90d'] as DemoPeriod[]).map(p => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? palette.primaryStrong : (palette.surfaceElevated ?? palette.surface),
                  borderColor: active ? palette.primaryStrong : palette.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: active ? palette.onPrimary : palette.text }]}>
                {p === '30d' ? '30 days' : '90 days'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Age groups */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Age Groups</Text>
        {ageGroups.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No age data yet</Text>
        ) : (
          ageGroups.map(group => {
            const pct = ageTotal > 0 ? (group.view_count / ageTotal) * 100 : 0;
            return (
              <View key={group.age_bucket} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: palette.text }]}>
                  {group.age_bucket}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` as any, backgroundColor: palette.primaryStrong },
                    ]}
                  />
                </View>
                <Text style={[styles.barPct, { color: palette.subtext }]}>
                  {pct.toFixed(0)}%
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Top countries */}
      <View style={[styles.section, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Top Countries</Text>
        {countries.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No country data yet</Text>
        ) : (
          countries.slice(0, 10).map(country => {
            const pct = countryTotal > 0 ? (country.view_count / countryTotal) * 100 : 0;
            return (
              <View key={country.country_code} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: palette.text }]}>
                  {country.country_code}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` as any, backgroundColor: palette.primaryStrong },
                    ]}
                  />
                </View>
                <Text style={[styles.barPct, { color: palette.subtext }]}>
                  {pct.toFixed(0)}%
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  section: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 56, fontSize: 12, fontWeight: '700' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barPct: { width: 36, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  emptyText: { fontSize: 12, fontWeight: '600' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
