// src/screens/broadcast/channels/BroadcastSearchScreen.tsx
//
// Full-page search screen for broadcast content with type filters and sort options.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type ContentType = 'all' | 'video' | 'short' | 'audio' | 'live' | 'poll';
type SortOption = 'relevance' | 'date' | 'views';

type SearchResult = {
  id: string;
  title?: string;
  thumbnail_url?: string;
  channel_name?: string;
  view_count?: number;
  content_type?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTENT_TYPES: Array<{ value: ContentType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'short', label: 'Short' },
  { value: 'audio', label: 'Audio' },
  { value: 'live', label: 'Live' },
  { value: 'poll', label: 'Poll' },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'views', label: 'Most Viewed' },
];

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];

const DEBOUNCE_MS = 400;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BroadcastSearchScreen() {
  const route = useRoute<any>();
  const { palette } = useKISTheme();

  const initialQuery: string = route.params?.query ?? '';

  const [query, setQuery] = useState<string>(initialQuery);
  const [activeType, setActiveType] = useState<ContentType>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('relevance');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, type: ContentType, sort: SortOption) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const typeParam = type !== 'all' ? `&type=${type}` : '';
      const res = await getRequest(
        `${ROUTES.broadcasts.broadcastSearch}?q=${encodeURIComponent(q)}${typeParam}&sort=${sort}`,
        { errorMessage: '' },
      );
      const raw: SearchResult[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setResults(raw);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, activeType, activeSort);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeType, activeSort, runSearch]);

  const renderSkeleton = () => (
    <View style={styles.grid}>
      {SKELETON_KEYS.map(key => (
        <View
          key={key}
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: palette.border }]} />
          <View style={{ padding: 8, gap: 6 }}>
            <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: palette.border, width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderCard = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <View style={styles.thumbnailContainer}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: palette.border }]} />
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
        <Text style={[styles.cardViews, { color: palette.subtext }]}>
          {(item.view_count ?? 0).toLocaleString()} views
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.card }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: palette.surface,
            borderColor: focused ? palette.primaryStrong : palette.border,
          },
        ]}
      >
        <Text style={[styles.searchIcon, { color: focused ? palette.primaryStrong : palette.subtext }]}>
          🔍
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search videos, channels, and more"
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text }]}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
            <Text style={[styles.clearText, { color: palette.subtext }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Content type filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CONTENT_TYPES.map(ct => {
          const active = activeType === ct.value;
          return (
            <Pressable
              key={ct.value}
              onPress={() => setActiveType(ct.value)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? palette.primaryStrong : palette.surface,
                  borderColor: active ? palette.primaryStrong : palette.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: active ? '#fff' : palette.text }]}>
                {ct.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sort pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map(s => {
          const active = activeSort === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setActiveSort(s.value)}
              style={[
                styles.sortPill,
                {
                  backgroundColor: active ? palette.primarySoft ?? palette.surface : 'transparent',
                  borderColor: active ? palette.primary ?? palette.primaryStrong : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.sortPillText,
                  { color: active ? palette.primaryStrong : palette.subtext },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Results */}
      {!query.trim() ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon]}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Search for videos, channels, and more
          </Text>
        </View>
      ) : loading ? (
        renderSkeleton()
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: palette.subtext }]}>
            No results for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '700', paddingVertical: 2 },
  clearButton: { padding: 4 },
  clearText: { fontSize: 14, fontWeight: '700' },
  filterRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  sortRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  sortPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortPillText: { fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
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
  thumbnailPlaceholder: { width: '100%', aspectRatio: 16 / 9 },
  cardBody: { padding: 8, gap: 4 },
  cardTitle: { fontSize: 12, fontWeight: '800', lineHeight: 16 },
  cardChannel: { fontSize: 11, fontWeight: '600' },
  cardViews: { fontSize: 10, fontWeight: '600' },
  skeletonLine: { height: 10, borderRadius: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
