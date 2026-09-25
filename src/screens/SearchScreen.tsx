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
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

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
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

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
  const showLanding = !focused && query.trim().length === 0 && recentSearches.length === 0;
  const hasResults = results.length > 0;
  const styles = useMemo(() => makeStyles(responsive), [responsive]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset + 10 }]}>
      {/* ── Header: pill search field + close ─────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={[
            styles.inputRow,
            {
              backgroundColor: palette.card,
              borderColor: focused ? palette.primary : palette.inputBorder,
              shadowColor: palette.shadow ?? '#000',
            },
          ]}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={[styles.searchIconWrap, { backgroundColor: palette.primarySoft ?? palette.surfaceElevated }]}>
            <KISIcon name="search" size={16} color={palette.primaryStrong} />
          </View>
          <TextInput
            ref={inputRef}
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
            <Pressable
              onPress={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              hitSlop={8}
              style={[styles.clearBtn, { backgroundColor: palette.surfaceElevated }]}
            >
              <KISIcon name="close" size={12} color={palette.subtext} />
            </Pressable>
          ) : null}
        </Pressable>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: palette.surfaceElevated }]}>
            <Text style={{ color: palette.primaryStrong, fontSize: 14, fontWeight: '800' }}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {/* ── Filter pills — only shown once there are results ─────────────── */}
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
                    backgroundColor: active ? palette.primaryStrong : palette.card,
                    borderColor: active ? palette.primaryStrong : palette.inputBorder,
                    shadowOpacity: active ? 0.16 : 0,
                    shadowColor: palette.primaryStrong,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: active ? palette.onPrimary : palette.text }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Landing state: nothing typed yet, no recent searches ─────────── */}
      {showLanding && (
        <View style={styles.centered}>
          <View style={[styles.landingIconWrap, { backgroundColor: palette.primarySoft ?? palette.surfaceElevated }]}>
            <KISIcon name="search" size={26} color={palette.primaryStrong} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Search KIS</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>
            Find chats, channels, courses, shops, health providers and Bible verses in one place.
          </Text>
        </View>
      )}

      {/* ── Recent searches ───────────────────────────────────────────────── */}
      {showRecentPanel && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.sectionHeader, { color: palette.subtext }]}>RECENT SEARCHES</Text>
            <Pressable onPress={clearAllRecent} hitSlop={8}>
              <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '800' }}>Clear all</Text>
            </Pressable>
          </View>
          <View style={[styles.recentCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
            {recentSearches.map((term, idx) => (
              <Pressable
                key={term}
                style={[
                  styles.recentRow,
                  idx < recentSearches.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider },
                ]}
                onPress={() => handleRecentTap(term)}
              >
                <View style={[styles.recentIconWrap, { backgroundColor: palette.surfaceElevated }]}>
                  <KISIcon name="call-history" size={14} color={palette.subtext} />
                </View>
                <Text style={[styles.recentText, { color: palette.text }]} numberOfLines={1}>{term}</Text>
                <Pressable onPress={() => removeRecentSearch(term)} hitSlop={8} style={styles.recentRemoveBtn}>
                  <KISIcon name="close" size={13} color={palette.subtext} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      )}

      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={{ color: palette.danger, fontWeight: '700' }}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && showShortQueryHint && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Keep typing</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>Enter at least 2 characters to search KIS.</Text>
        </View>
      )}

      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No results</Text>
          <Text style={[styles.emptyCopy, { color: palette.subtext }]}>Nothing matched "{query.trim()}".</Text>
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
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          data={sections}
          keyExtractor={([kind]) => kind}
          renderItem={({ item: [kind, items] }) => (
            <View style={{ marginBottom: 10 }}>
              <Text style={[styles.sectionHeader, { color: palette.subtext }]}>
                {SECTION_LABELS[kind] ?? kind.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <View style={[styles.resultCard, { backgroundColor: palette.card, borderColor: palette.divider, shadowColor: palette.shadow ?? '#000' }]}>
                {items.map((result, idx) => (
                  <Pressable
                    key={`${result.kind}-${result.target_id}`}
                    onPress={() => onSelectResult?.(result)}
                    style={({ pressed }) => [
                      styles.row,
                      idx < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider },
                      pressed && { backgroundColor: palette.surfaceElevated },
                    ]}
                  >
                    <ImagePlaceholder size={40} radius={13} style={styles.avatar} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                        {result.title}
                      </Text>
                      {!!result.subtitle && (
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {result.subtitle}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.kindBadge, { backgroundColor: palette.surfaceElevated }]}>
                      <KISIcon name={(KIND_ICON[kind] as any) ?? 'chevron-right'} size={13} color={palette.subtext} />
                    </View>
                  </Pressable>
                ))}
              </View>
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

const makeStyles = (responsive: ReturnType<typeof useResponsiveLayout>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: responsive.pageGutter,
      paddingBottom: 12,
      gap: 10,
    },
    inputRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      paddingLeft: 6,
      paddingRight: 10,
      gap: 8,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    searchIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    input: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0, height: 48 },
    clearBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterRow: { paddingHorizontal: responsive.pageGutter, paddingBottom: 14, gap: 8 },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    filterPillText: { fontSize: 13, fontWeight: '800' },
    landingIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    recentSection: { paddingHorizontal: responsive.pageGutter, paddingTop: 4 },
    recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    recentCard: {
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
    },
    recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
    recentIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentText: { flex: 1, fontSize: 14, fontWeight: '700' },
    recentRemoveBtn: { padding: 4 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
    emptyCopy: { marginTop: 6, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 280 },
    sectionHeader: { fontSize: 11, fontWeight: '800', paddingHorizontal: 4, paddingBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' },
    resultCard: {
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    avatar: { borderRadius: 13 },
    title: { fontSize: 14, fontWeight: '700' },
    kindBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });
