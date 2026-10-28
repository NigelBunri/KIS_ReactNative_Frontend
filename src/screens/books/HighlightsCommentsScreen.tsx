import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HighlightsComments'>;

type Annotation = {
  id: string;
  book: string;
  book_title: string;
  book_cover_url: string;
  chapter: string;
  chapter_stable_id: string;
  chapter_title: string;
  block_id: string;
  color: string;
  highlighted_text: string;
  note: string;
  has_comment: boolean;
  resolved: boolean;
  created_at: string;
};

const COLORS: Record<string, string> = {
  yellow: '#FACC15', green: '#4ADE80', blue: '#60A5FA', pink: '#F472B6',
};
const COLOR_FILTERS = ['yellow', 'green', 'blue', 'pink'];

export default function HighlightsCommentsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [commentsOnly, setCommentsOnly] = useState(false);

  const fetchAnnotations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (colorFilter) params.set('color', colorFilter);
    if (commentsOnly) params.set('has_comment', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    const res: any = await getRequest(ROUTES.books.annotationsMine(query));
    if (res?.success) {
      setAnnotations(res.data?.results || []);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [colorFilter, commentsOnly]);

  useFocusEffect(useCallback(() => { fetchAnnotations(); }, [fetchAnnotations]));

  const openPassage = (a: Annotation) => {
    navigation.navigate('BookReader', {
      id: a.book, chapterStableId: a.chapter_stable_id, highlightBlockId: a.block_id, targetHighlightId: a.id,
    });
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: sp, paddingBottom: 10, flexWrap: 'wrap' },
    filterPill: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: palette.divider,
      flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    filterPillActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
    filterPillText: { fontSize: 12, fontWeight: '600', color: palette.text },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    list: { padding: sp, gap: 10 },
    card: { backgroundColor: palette.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: palette.divider, gap: 6 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardBookTitle: { fontSize: 12, fontWeight: '700', color: palette.subtext, flex: 1 },
    cardChapter: { fontSize: 11, color: palette.subtext },
    excerpt: { fontSize: 14, color: palette.text, lineHeight: 20, fontStyle: 'italic' },
    noteText: { fontSize: 12, color: palette.text, opacity: 0.75 },
    staleBadge: { fontSize: 10, fontWeight: '700', color: '#B23B3B' },
    empty: { padding: sp * 2, alignItems: 'center', gap: 8 },
    emptyText: { fontSize: 13, color: palette.subtext, textAlign: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Highlights & Comments</Text>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterPill, !colorFilter && !commentsOnly && styles.filterPillActive]}
          onPress={() => { setColorFilter(null); setCommentsOnly(false); }}
        >
          <Text style={styles.filterPillText}>All</Text>
        </Pressable>
        {COLOR_FILTERS.map((c) => (
          <Pressable
            key={c}
            style={[styles.filterPill, colorFilter === c && styles.filterPillActive]}
            onPress={() => setColorFilter(colorFilter === c ? null : c)}
            accessibilityLabel={`Filter by ${c}`}
          >
            <View style={[styles.colorDot, { backgroundColor: COLORS[c] }]} />
            <Text style={styles.filterPillText}>{c[0].toUpperCase() + c.slice(1)}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.filterPill, commentsOnly && styles.filterPillActive]}
          onPress={() => setCommentsOnly((v) => !v)}
        >
          <KISIcon name="chat" size={12} color={palette.text} />
          <Text style={styles.filterPillText}>Comments</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : loadError ? (
        <View style={styles.empty}><Text style={styles.emptyText}>Could not load your highlights. Pull down to try again.</Text></View>
      ) : annotations.length === 0 ? (
        <View style={styles.empty}>
          <KISIcon name="bookmark" size={28} color={palette.subtext} />
          <Text style={styles.emptyText}>
            {colorFilter || commentsOnly
              ? 'No highlights or comments match this filter yet.'
              : 'Select a sentence while reading to save your first highlight or comment.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={annotations}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openPassage(item)}>
              <View style={styles.cardTopRow}>
                <View style={[styles.colorDot, { backgroundColor: COLORS[item.color] || COLORS.yellow }]} />
                <Text style={styles.cardBookTitle} numberOfLines={1}>{item.book_title}</Text>
                <Text style={styles.cardChapter} numberOfLines={1}>{item.chapter_title}</Text>
                {!item.resolved && <Text style={styles.staleBadge}>Changed</Text>}
              </View>
              <Text style={styles.excerpt} numberOfLines={3}>"{item.highlighted_text}"</Text>
              {!!item.note && <Text style={styles.noteText} numberOfLines={3}>{item.note}</Text>}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
