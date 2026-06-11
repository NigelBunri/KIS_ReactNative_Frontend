// src/screens/broadcast/channels/TrendingScreen.tsx
//
// Full-screen trending content browser with period selector and 2-column grid.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = '24h' | '7d' | '30d' | 'all';

type TrendingItem = {
  id: string;
  title?: string;
  thumbnail_url?: string;
  channel_name?: string;
  reaction_count?: number;
  comment_count?: number;
  rank?: number;
};

type Props = {
  onPressContent: (contentId: string) => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All Time' },
];

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrendingScreen({ onPressContent }: Props) {
  const { palette } = useKISTheme();
  const [period, setPeriod] = useState<Period>('7d');
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.trending}?period=${p}`,
        { errorMessage: '' },
      );
      const raw: TrendingItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setItems(raw.map((item, idx) => ({ ...item, rank: idx + 1 })));
    } catch {
      setError('Could not load trending content.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrending(period);
  }, [fetchTrending, period]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  const renderSkeleton = () => (
    <View style={styles.grid}>
      {SKELETON_KEYS.map(key => (
        <View
          key={key}
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={[styles.thumbnailSkeleton, { backgroundColor: palette.border }]} />
          <View style={{ padding: 8, gap: 6 }}>
            <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderCard = ({ item }: { item: TrendingItem }) => {
    const rankColor = item.rank ? RANK_COLORS[item.rank] : undefined;
    return (
      <Pressable
        onPress={() => onPressContent(item.id)}
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <View style={styles.thumbnailContainer}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: palette.border }]} />
          )}
          {item.rank != null && (
            <View
              style={[
                styles.rankBadge,
                { backgroundColor: rankColor ?? palette.surfaceElevated ?? palette.border },
              ]}
            >
              <Text style={[styles.rankText, { color: rankColor ? '#000' : palette.text }]}>
                #{item.rank}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.text }]}>
            {item.title || 'Untitled'}
          </Text>
          {item.channel_name ? (
            <Text numberOfLines={1} style={[styles.cardChannel, { color: palette.subtext }]}>
              {item.channel_name}
            </Text>
          ) : null}
          <View style={styles.cardStats}>
            <Text style={[styles.cardStat, { color: palette.subtext }]}>
              {item.reaction_count ?? 0} reactions
            </Text>
            <Text style={[styles.cardStat, { color: palette.subtext }]}>
              {item.comment_count ?? 0} comments
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.card }]}>
      {/* Period selector */}
      <View style={styles.pillRow}>
        {PERIODS.map(p => {
          const active = period === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => handlePeriodChange(p.value)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? palette.primaryStrong : palette.surface,
                  borderColor: active ? palette.primaryStrong : palette.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: active ? '#fff' : palette.text }]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        renderSkeleton()
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            Nothing trending yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  columnWrapper: { gap: 10, paddingHorizontal: 14 },
  listContent: { paddingBottom: 20, gap: 10 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: '100%', aspectRatio: 16 / 9 },
  thumbnailSkeleton: { width: '100%', aspectRatio: 16 / 9 },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rankText: { fontSize: 10, fontWeight: '900' },
  cardBody: { padding: 8, gap: 4 },
  cardTitle: { fontSize: 12, fontWeight: '800', lineHeight: 16 },
  cardChannel: { fontSize: 11, fontWeight: '600' },
  cardStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cardStat: { fontSize: 10, fontWeight: '600' },
  skeletonLine: { height: 10, borderRadius: 4 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
