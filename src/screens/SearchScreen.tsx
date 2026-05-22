import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import { KISIcon } from '@/constants/kisIcons';

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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } catch {
      setError('Search unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 350);
    },
    [search],
  );

  const grouped = React.useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const key = r.kind ?? 'other';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [results]);

  const sections = useMemo(() => Object.entries(grouped).sort(([a], [b]) => {
    const ai = SECTION_ORDER.indexOf(a);
    const bi = SECTION_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  }), [grouped]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const showShortQueryHint = query.trim().length > 0 && query.trim().length < 2;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
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
            onSubmitEditing={() => search(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); }}>
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          )}
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={{ color: palette.primary, fontSize: 14 }}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}

      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={{ color: palette.danger ?? '#d9534f' }}>{error}</Text>
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

      {!loading && sections.length > 0 && (
        <FlatList
          data={sections}
          keyExtractor={([kind]) => kind}
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
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
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
