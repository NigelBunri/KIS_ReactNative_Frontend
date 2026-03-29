import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type Stats = {
  reading_sessions: number;
  bookmarks: number;
  highlights: number;
  notes: number;
  active_plans: number;
  streak: number;
};

const fallbackStats: Stats = {
  reading_sessions: 7,
  bookmarks: 12,
  highlights: 18,
  notes: 4,
  active_plans: 2,
  streak: 5,
};

export default function BibleStatsPanel() {
  const { palette } = useKISTheme();
  const [stats, setStats] = useState<Stats>(fallbackStats);

  useEffect(() => {
    const loadStats = async () => {
      const res = await getRequest(ROUTES.bible.stats, { errorMessage: 'Unable to load stats.' });
      if (res?.success) {
        setStats({ ...fallbackStats, ...res.data });
      }
    };
    loadStats();
  }, []);

  return (
    <BibleSectionCard>
      <Text style={[styles.title, { color: palette.text }]}>Your Bible journey</Text>
      <View style={styles.grid}>
        {[
          { label: 'Reading sessions', value: stats.reading_sessions },
          { label: 'Bookmarks', value: stats.bookmarks },
          { label: 'Highlights', value: stats.highlights },
          { label: 'Notes', value: stats.notes },
          { label: 'Active plans', value: stats.active_plans },
          { label: 'Streak (days)', value: stats.streak },
        ].map((item) => (
          <View key={item.label} style={[styles.statCard, { borderColor: palette.divider }]}
          >
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.label}</Text>
            <Text style={{ color: palette.text, fontSize: 20, fontWeight: '700' }}>{item.value}</Text>
          </View>
        ))}
      </View>
    </BibleSectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { borderWidth: 2, borderRadius: 12, padding: 12, width: '47%', gap: 6 },
});
