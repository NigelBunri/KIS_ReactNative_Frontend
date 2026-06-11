// src/components/broadcast/RecommendationsSection.tsx
//
// Horizontal content recommendations feed. Fetches from the recommendations
// endpoint, renders scrollable content cards with skeleton loading.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
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

type ContentCard = {
  id: string;
  title: string;
  channel_name?: string;
  thumbnail_url?: string;
  view_count?: number;
  duration_seconds?: number;
};

type Props = {
  onPressContent: (contentId: string) => void;
  style?: object;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard({ palette }: { palette: any }) {
  return (
    <View style={[styles.card, { backgroundColor: palette.surfaceElevated }]}>
      <View style={[styles.cardThumb, { backgroundColor: palette.border }]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '90%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '60%', marginTop: 4 }]} />
      </View>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecommendationsSection({ onPressContent, style }: Props) {
  const { palette } = useKISTheme();

  const [items, setItems]     = useState<ContentCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRequest(ROUTES.broadcasts.recommendations)
      .then(res => {
        if (res?.data) {
          const raw: ContentCard[] = Array.isArray(res.data)
            ? res.data
            : res.data.results ?? [];
          setItems(raw);
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, []);

  const renderCard = useCallback((item: ContentCard) => (
    <Pressable
      key={item.id}
      onPress={() => onPressContent(item.id)}
      style={[styles.card, { backgroundColor: palette.surfaceElevated }]}
    >
      {/* Thumbnail */}
      <View style={styles.thumbContainer}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.cardThumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardThumb, { backgroundColor: palette.border }]} />
        )}
        {/* Duration badge */}
        {!!item.duration_seconds && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(item.duration_seconds)}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, { color: palette.text }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {!!item.channel_name && (
          <Text
            style={[styles.cardChannel, { color: palette.subtext }]}
            numberOfLines={1}
          >
            {item.channel_name}
          </Text>
        )}
        {!!item.view_count && (
          <Text style={[styles.cardMeta, { color: palette.subtext }]}>
            {formatViewCount(item.view_count)}
          </Text>
        )}
      </View>
    </Pressable>
  ), [onPressContent, palette]);

  // Empty state (after load, no items)
  const showEmpty = !loading && items.length === 0;

  return (
    <View style={[styles.container, style]}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Recommended for You
        </Text>
        <Pressable>
          <Text style={[styles.seeAll, { color: palette.gold }]}>See All</Text>
        </Pressable>
      </View>

      {showEmpty ? (
        <Text style={[styles.empty, { color: palette.subtext }]}>
          Subscribe to channels to see recommendations
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {loading
            ? [0, 1, 2].map(i => <SkeletonCard key={i} palette={palette} />)
            : items.map(renderCard)}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_WIDTH  = 200;
const CARD_HEIGHT = 180;
const THUMB_HEIGHT = 110;

const styles = StyleSheet.create({
  container: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 2,
  },
  thumbContainer: {
    position: 'relative',
  },
  cardThumb: {
    width: CARD_WIDTH,
    height: THUMB_HEIGHT,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardBody: {
    padding: 8,
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardChannel: {
    fontSize: 11,
  },
  cardMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 13,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});
