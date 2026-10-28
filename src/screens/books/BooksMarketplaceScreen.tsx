import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BooksMarketplace'>;

type BookSummary = {
  id: string;
  title: string;
  author_name: string;
  cover_url?: string;
  is_free: boolean;
  current_price_cents: number;
  currency: string;
  christian_category: string;
  estimated_reading_minutes: number;
};

// Real categories matching apps.books.models.ChristianCategory — kept in
// sync manually with CreateBookScreen.tsx's identical list (no shared
// backend "list categories" endpoint exists yet to source this from).
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'bible_study', label: 'Bible studies' },
  { key: 'theology', label: 'Theology' },
  { key: 'discipleship', label: 'Discipleship' },
  { key: 'devotional', label: 'Devotionals' },
  { key: 'biography', label: 'Biography' },
  { key: 'fiction', label: 'Fiction' },
  { key: 'children', label: "Children's" },
  { key: 'family', label: 'Family' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'apologetics', label: 'Apologetics' },
  { key: 'church_history', label: 'Church history' },
  { key: 'counseling', label: 'Counseling' },
  { key: 'living', label: 'Christian living' },
  { key: 'worship', label: 'Worship' },
];

type LoadState = 'loading' | 'ready' | 'error';

type BookCardProps = {
  book: BookSummary;
  horizontal?: boolean;
  palette: ReturnType<typeof useKISTheme>['palette'];
  styles: ReturnType<typeof StyleSheet.create>;
  onPress: () => void;
};

// Defined outside the screen component (not inline during render) so
// React can reconcile it as a stable component type across re-renders
// instead of remounting the whole card subtree every time the parent
// re-renders (search typing, category change, etc.).
function BookCard({ book, horizontal, palette, styles, onPress }: BookCardProps) {
  return (
    <Pressable
      style={horizontal ? styles.cardHorizontal : styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.title} by ${book.author_name}`}
    >
      <View style={styles.coverPlaceholder}>
        <KISIcon name="book" size={32} color={palette.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.author} numberOfLines={1}>{book.author_name}</Text>
        {!horizontal && <Text style={styles.meta} numberOfLines={1}>{book.estimated_reading_minutes} min read</Text>}
        <View style={styles.priceRow}>
          {book.is_free ? (
            <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>FREE</Text></View>
          ) : (
            <Text style={styles.price}>{book.currency} {(book.current_price_cents / 100).toFixed(2)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function BooksMarketplaceScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [books, setBooks] = useState<BookSummary[]>([]);
  const [continueReading, setContinueReading] = useState<BookSummary[]>([]);
  const [discover, setDiscover] = useState<{
    new_releases: BookSummary[]; top_rated: BookSummary[]; trending: BookSummary[]; free_books: BookSummary[];
  } | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const fetchBooks = useCallback(async (query: string, categoryKey: string | null) => {
    setLoadState('loading');
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (categoryKey) params.set('category', categoryKey);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res: any = await getRequest(ROUTES.books.list(qs));
      if (!res?.success) throw new Error(res?.message || 'Request failed');
      // BookListView is a paginated generics.ListAPIView — the project-wide
      // default pagination class (common.pagination.StandardResultsSetPagination)
      // wraps every list response as {meta, results}, same convention
      // EventsScreen/SearchScreen already follow. A bare-array fallback is
      // kept only for resilience, never relied on.
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setBooks(list);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  const fetchContinueReading = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.libraryOverview);
    if (res?.success) setContinueReading(res.data?.currently_reading || []);
  }, []);

  // Real, backend-computed curation (apps.books.views.DiscoveryView) — new
  // releases, top-rated (only books with at least one review), and
  // trending (view-count ranked). Never fabricated client-side; sections
  // with no qualifying books come back empty and are simply not rendered
  // (see the JSX below), rather than showing an empty-looking shelf.
  const fetchDiscover = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.discover);
    if (res?.success) setDiscover(res.data);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchBooks(appliedSearch, category).then(() => {}).catch(() => {});
    fetchContinueReading().then(() => {}).catch(() => {});
    if (!appliedSearch && !category) fetchDiscover().then(() => {}).catch(() => {});
  }, [fetchBooks, fetchContinueReading, fetchDiscover, appliedSearch, category]));

  const runSearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => { setSearch(''); setAppliedSearch(''); };

  const numCols = 2;
  const cardGap = 12;
  const cardWidth = (layout.width - sp * 2 - cardGap) / numCols;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },

    // Header: a plain, normally-flowing content row determines the real
    // height; the gradient is an absolutely-filled background BEHIND it
    // (same pattern as MessagesScreen's gold header). A LinearGradient
    // given only padding/no explicit height does not reliably auto-size
    // to its own children in this RN setup — using it as the box itself
    // (previous implementation) clipped the header content behind its
    // own background edge. This structure makes that class of bug
    // impossible: the background can never be smaller than the content
    // that defines the parent's size.
    headerOuter: { overflow: 'hidden' },
    headerContent: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: sp, paddingVertical: 12, minHeight: 52,
    },
    headerTitle: { fontSize: 19, fontWeight: '700', color: palette.ivory },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    iconButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },

    searchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: sp, paddingVertical: 10, gap: 8 },
    searchBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: palette.card, borderRadius: 10, paddingHorizontal: 12, height: 40,
      borderWidth: 1, borderColor: palette.divider,
    },
    searchInput: { flex: 1, color: palette.text, fontSize: 14, padding: 0 },

    categoryScrollOuter: { flexGrow: 0, flexShrink: 0, height: 44 },
    categoryScroll: { paddingHorizontal: sp, alignItems: 'center', gap: 8 },
    categoryPill: {
      height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1,
      borderColor: palette.divider, backgroundColor: palette.card, marginRight: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    categoryPillActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    categoryPillText: { fontSize: 12, fontWeight: '600', color: palette.text },
    categoryPillTextActive: { color: palette.ivory },

    sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: sp, marginBottom: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: palette.text },

    scroll: { flex: 1 },
    horizontalRowOuter: { flexGrow: 0, flexShrink: 0 },
    horizontalRow: { paddingHorizontal: sp, gap: 10, paddingBottom: 18 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: sp, gap: cardGap, paddingBottom: 120 },

    card: { width: cardWidth, backgroundColor: palette.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: palette.divider },
    cardHorizontal: { width: 130, backgroundColor: palette.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: palette.divider },
    coverPlaceholder: {
      aspectRatio: 0.72, backgroundColor: palette.primarySoft, justifyContent: 'center', alignItems: 'center',
    },
    cardBody: { padding: 10, gap: 3 },
    bookTitle: { fontSize: 13, fontWeight: '700', color: palette.text, lineHeight: 17 },
    author: { fontSize: 11, color: palette.subtext },
    meta: { fontSize: 10, color: palette.subtext },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    price: { fontSize: 12, fontWeight: '700', color: palette.text },
    freeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: palette.primary },
    freeBadgeText: { fontSize: 10, fontWeight: '700', color: palette.ivory },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    emptyWrap: { alignItems: 'center', paddingHorizontal: sp * 1.5, paddingTop: 48, paddingBottom: 32, gap: 12 },
    emptyIconCircle: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: palette.primarySoft,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: palette.text, textAlign: 'center' },
    emptyText: { fontSize: 13, color: palette.subtext, textAlign: 'center', lineHeight: 19, maxWidth: 300 },
    errorText: { color: palette.danger, textAlign: 'center', fontSize: 14 },

    fab: {
      position: 'absolute', right: sp, bottom: 20, width: 52, height: 52, borderRadius: 26,
      backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 4,
    },

    skeletonCard: { width: cardWidth, backgroundColor: palette.card, borderRadius: 14, overflow: 'hidden' },
    skeletonTitleGap: { marginBottom: 6 },
  });

  const renderEmptyOrError = () => {
    if (loadState === 'error') {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <KISIcon name="warning" size={30} color={palette.danger} />
          </View>
          <Text style={styles.emptyTitle}>Couldn't load books</Text>
          <Text style={styles.errorText}>Check your connection and try again.</Text>
          <KISButton title="Retry" size="sm" variant="outline" onPress={() => fetchBooks(appliedSearch, category)} />
        </View>
      );
    }
    if (appliedSearch || category) {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <KISIcon name="search" size={28} color={palette.primary} />
          </View>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptyText}>
            {appliedSearch
              ? `No books match "${appliedSearch}"${category ? ' in this category' : ''}.`
              : 'No books are published in this category yet.'}
          </Text>
          <KISButton
            title="Clear filters"
            size="sm"
            variant="outline"
            onPress={() => { clearSearch(); setCategory(null); }}
          />
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <KISIcon name="book" size={30} color={palette.primary} />
        </View>
        <Text style={styles.emptyTitle}>Your next great read starts here</Text>
        <Text style={styles.emptyText}>
          Approved Christian books will appear here as authors publish them. Be the first —
          share a book with the KIS community.
        </Text>
        <KISButton title="Publish a book" size="sm" variant="primary" onPress={() => navigation.navigate('AuthorStudio')} />
      </View>
    );
  };

  const renderSkeletonGrid = () => (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={cardWidth / 0.72} radius={0} />
          <View style={styles.cardBody}>
            <Skeleton height={13} width="90%" style={styles.skeletonTitleGap} />
            <Skeleton height={11} width="60%" />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerOuter}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
            <KISIcon name="back" size={22} color={palette.ivory} />
          </Pressable>
          <Text style={styles.headerTitle}>Books</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('MyLibrary')} hitSlop={8} accessibilityRole="button" accessibilityLabel="My library">
              <KISIcon name="library" size={21} color={palette.ivory} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('AuthorStudio')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Author studio">
              <KISIcon name="edit" size={20} color={palette.ivory} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <KISIcon name="search" size={16} color={palette.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books, authors, topics"
            placeholderTextColor={palette.subtext}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8} accessibilityLabel="Clear search">
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollOuter} contentContainerStyle={styles.categoryScroll}>
        <Pressable style={[styles.categoryPill, !category && styles.categoryPillActive]} onPress={() => setCategory(null)}>
          <Text style={[styles.categoryPillText, !category && styles.categoryPillTextActive]}>All</Text>
        </Pressable>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.categoryPill, category === c.key && styles.categoryPillActive]}
            onPress={() => setCategory(category === c.key ? null : c.key)}
          >
            <Text style={[styles.categoryPillText, category === c.key && styles.categoryPillTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loadState === 'loading' ? (
        <ScrollView style={styles.scroll}>{renderSkeletonGrid()}</ScrollView>
      ) : (
        <ScrollView style={styles.scroll}>
          {!appliedSearch && !category && continueReading.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Continue Reading</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRowOuter} contentContainerStyle={styles.horizontalRow}>
                {continueReading.map((book) => (
                  <BookCard
                    key={book.id} book={book} horizontal palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {!appliedSearch && !category && discover?.new_releases && discover.new_releases.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Releases</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRowOuter} contentContainerStyle={styles.horizontalRow}>
                {discover.new_releases.map((book) => (
                  <BookCard
                    key={book.id} book={book} horizontal palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {!appliedSearch && !category && discover?.trending && discover.trending.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trending Now</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRowOuter} contentContainerStyle={styles.horizontalRow}>
                {discover.trending.map((book) => (
                  <BookCard
                    key={book.id} book={book} horizontal palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {!appliedSearch && !category && discover?.top_rated && discover.top_rated.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Highly Rated</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRowOuter} contentContainerStyle={styles.horizontalRow}>
                {discover.top_rated.map((book) => (
                  <BookCard
                    key={book.id} book={book} horizontal palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {!appliedSearch && !category && discover?.free_books && discover.free_books.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Free to Read</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRowOuter} contentContainerStyle={styles.horizontalRow}>
                {discover.free_books.map((book) => (
                  <BookCard
                    key={book.id} book={book} horizontal palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {books.length === 0 ? (
            renderEmptyOrError()
          ) : (
            <>
              {!appliedSearch && !category && (continueReading.length > 0 || !!discover) && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Browse Books</Text>
                </View>
              )}
              <View style={styles.grid}>
                {books.map((book) => (
                  <BookCard
                    key={book.id} book={book} palette={palette} styles={styles}
                    onPress={() => navigation.navigate('BookDetail', { id: book.id })}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AuthorStudio')} accessibilityRole="button" accessibilityLabel="Publish a book">
        <KISIcon name="add" size={24} color={palette.ivory} />
      </Pressable>
    </SafeAreaView>
  );
}
