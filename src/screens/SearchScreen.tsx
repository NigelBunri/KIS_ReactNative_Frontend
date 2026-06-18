import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import { KISIcon } from '@/constants/kisIcons';

const RECENT_SEARCHES_KEY = 'kis_recent_searches';
const MAX_RECENT = 8;

type ResultKind = 'user' | 'contact' | 'conversation' | 'content' | 'community' | 'group' | 'channel' | 'channel_content' | 'market_shop' | 'market_product' | 'education_institution' | 'education_course' | 'health_institution' | 'partner' | 'bible_verse' | string;

type SearchResult = {
  kind: ResultKind;
  title: string;
  subtitle?: string;
  target_id: string;
  target_type: string;
  route?: string;
  score?: number;
  metadata?: Record<string, any>;
};

type FilterTab = 'all' | 'videos' | 'channels' | 'education' | 'market' | 'health' | 'bible';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'videos', label: 'Videos' },
  { key: 'channels', label: 'Channels' },
  { key: 'education', label: 'Education' },
  { key: 'market', label: 'Market' },
  { key: 'health', label: 'Health' },
  { key: 'bible', label: 'Bible' },
];

const FILTER_KINDS: Record<FilterTab, string[]> = {
  all: [],
  videos: ['channel_content', 'content'],
  channels: ['channel'],
  education: ['education_institution', 'education_course'],
  market: ['market_shop', 'market_product'],
  health: ['health_institution'],
  bible: ['bible_verse'],
};

const KIND_ICON: Record<string, string> = {
  user: 'person',
  contact: 'person',
  conversation: 'chat',
  content: 'document',
  community: 'people',
  group: 'people',
  channel: 'megaphone',
  channel_content: 'document',
  market_shop: 'storefront',
  market_product: 'cart',
  education_institution: 'school',
  education_course: 'school',
  health_institution: 'heart',
  partner: 'people',
  bible_verse: 'book',
};

const SECTION_ORDER = [
  'contact',
  'conversation',
  'channel',
  'channel_content',
  'education_institution',
  'education_course',
  'market_shop',
  'market_product',
  'health_institution',
  'partner',
  'bible_verse',
  'notification',
  'verification',
];

const SECTION_LABELS: Record<string, string> = {
  contact: 'Contacts',
  conversation: 'Chats',
  channel: 'Channels',
  channel_content: 'Feeds',
  education_institution: 'Education institutions',
  education_course: 'Courses',
  market_shop: 'Shops',
  market_product: 'Products',
  health_institution: 'Health institutions',
  partner: 'Partners',
  bible_verse: 'Bible',
  notification: 'Notifications',
  verification: 'Verification',
};

type Props = {
  onClose?: () => void;
  onSelectResult?: (result: SearchResult) => void;
};

export default function SearchScreen({ onClose, onSelectResult }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then(raw => {
      if (raw) {
        try { setRecentSearches(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  const saveRecentSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(s => s !== term);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  const search = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getRequest(ROUTES.search.unified, {
        params: { q: term, limit: 30 },
        errorMessage: 'Search failed',
      });
      const list: SearchResult[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setResults(list);
      if (list.length > 0) void saveRecentSearch(term);
    } catch {
      setError('Search unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [saveRecentSearch]);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      setActiveFilter('all');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 300);
    },
    [search],
  );

  const handleRecentTap = useCallback((term: string) => {
    setQuery(term);
    void search(term);
  }, [search]);

  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results;
    const allowed = FILTER_KINDS[activeFilter];
    return results.filter(r => allowed.includes(r.kind));
  }, [results, activeFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    for (const r of filteredResults) {
      const key = r.kind ?? 'other';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filteredResults]);

  const sections = useMemo(() => Object.entries(grouped).sort(([a], [b]) => {
    const ai = SECTION_ORDER.indexOf(a);
    const bi = SECTION_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  }), [grouped]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const showShortQueryHint = query.trim().length > 0 && query.trim().length < 2;
  const showRecentPanel = focused && query.trim().length === 0 && recentSearches.length > 0;
  const hasResults = results.length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Search header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <View style={[styles.inputRow, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
          <KISIcon name="search" size={18} color={palette.subtext} />
          <TextInput
            style={[styles.input, { color: palette.text }]}
            placeholder="Search chats, channels, courses, shops, health, Bible…"
            placeholderTextColor={palette.subtext}
            value={query}
            onChangeText={onChangeText}
            autoFocus
            returnKeyType="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => { void search(query); void saveRecentSearch(query); }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => { setQuery(''); setResults([]); }}>
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          ) : null}
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={{ color: palette.primary, fontSize: 14 }}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {/* Filter tabs — only shown when there are results */}
      {hasResults && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyboardShouldPersistTaps="handled"
        >
          {FILTER_TABS.map(tab => {
            const active = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? palette.primaryStrong : palette.surface,
                    borderColor: active ? palette.primaryStrong : palette.inputBorder,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: active ? palette.onPrimary : palette.subtext }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Recent searches panel */}
      {showRecentPanel && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View style={styles.recentHeader}>
            <Text style={[styles.sectionHeader, { color: palette.subtext, paddingHorizontal: 0, paddingVertical: 0 }]}>RECENT SEARCHES</Text>
            <Pressable onPress={clearAllRecent} hitSlop={8}>
              <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>Clear all</Text>
            </Pressable>
          </View>
          {recentSearches.map(term => (
            <Pressable
              key={term}
              style={[styles.recentRow, { borderBottomColor: palette.divider }]}
              onPress={() => handleRecentTap(term)}
            >
              <KISIcon name="call-history" size={16} color={palette.subtext} />
              <Text style={[styles.recentText, { color: palette.text }]} numberOfLines={1}>{term}</Text>
              <Pressable onPress={() => removeRecentSearch(term)} hitSlop={8}>
                <KISIcon name="close" size={14} color={palette.subtext} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}

      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={{ color: palette.danger }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && showShortQueryHint && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Keep typing</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>Enter at least 2 characters to search KIS quickly.</Text>
        </View>
      )}

      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No results</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>Nothing matched "{query.trim()}" in your safe discovery results.</Text>
        </View>
      )}

      {!loading && !error && hasResults && filteredResults.length === 0 && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No {FILTER_TABS.find(t => t.key === activeFilter)?.label} results</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>Try a different filter or search term.</Text>
        </View>
      )}

      {!loading && sections.length > 0 && (
        <FlatList
          data={sections}
          keyExtractor={([kind]) => kind}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No results found
              </Text>
            </View>
          }
          renderItem={({ item: [kind, items] }) => (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.sectionHeader, { color: palette.subtext }]}>
                {SECTION_LABELS[kind] ?? kind.replace(/_/g, ' ').toUpperCase()}
              </Text>
              {items.map((result) => (
                <Pressable
                  key={`${result.kind}-${result.target_id}`}
                  onPress={() => onSelectResult?.(result)}
                  style={[styles.row, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}
                >
                  <ImagePlaceholder size={38} radius={19} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                      {result.title}
                    </Text>
                    {!!result.subtitle && (
                      <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={1}>
                        {result.subtitle}
                      </Text>
                    )}
                  </View>
                  <KISIcon name={KIND_ICON[kind] ?? 'chevron-right'} size={16} color={palette.subtext} />
                </Pressable>
              ))}
            </View>
          )}
          contentContainerStyle={{ padding: responsive.pageGutter, paddingBottom: insets.bottom + responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  cancelBtn: { paddingHorizontal: 4 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: '700' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  recentText: { flex: 1, fontSize: 14, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { marginTop: 6, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  sectionHeader: { fontSize: 11, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6, letterSpacing: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  avatar: { borderRadius: 19 },
  title: { fontSize: 14, fontWeight: '600' },
});
