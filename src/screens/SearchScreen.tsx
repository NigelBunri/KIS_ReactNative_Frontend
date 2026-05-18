import React, { useCallback, useRef, useState } from 'react';
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

type ResultKind = 'user' | 'content' | 'community' | 'group' | 'channel' | string;

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
  content: 'document',
  community: 'people',
  group: 'people-outline',
  channel: 'megaphone',
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
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getRequest(ROUTES.search.unified, {
        params: { q: q.trim(), limit: 30 },
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

  const sections = Object.entries(grouped);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <View style={[styles.inputRow, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
          <KISIcon name="search" size={18} color={palette.subtext} />
          <TextInput
            style={[styles.input, { color: palette.text }]}
            placeholder="Search people, content, communities…"
            placeholderTextColor={palette.subtext}
            value={query}
            onChangeText={onChangeText}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => search(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); }}>
              <KISIcon name="close-circle" size={16} color={palette.subtext} />
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

      {!loading && !error && query.length > 0 && results.length === 0 && (
        <View style={styles.centered}>
          <Text style={{ color: palette.subtext }}>No results for "{query}"</Text>
        </View>
      )}

      {!loading && sections.length > 0 && (
        <FlatList
          data={sections}
          keyExtractor={([kind]) => kind}
          renderItem={({ item: [kind, items] }) => (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.sectionHeader, { color: palette.subtext }]}>
                {kind.toUpperCase()}
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
