import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '../../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'MyBooksCenter'>;

type BookSummary = { id: string; title: string; author_name: string };

type Overview = {
  saved: BookSummary[];
  currently_reading: BookSummary[];
  completed: BookSummary[];
  bookmarked: BookSummary[];
};

type AuthorBook = { id: string; title: string; status: string };

const PUBLISHING_PENDING_STATUSES = new Set([
  'draft', 'processing', 'conversion_failed', 'pending_review', 'under_review', 'corrections_requested',
]);

// This screen is deliberately a thin overview + shortcut hub, not a
// reimplementation of MyLibraryScreen / AuthorStudioScreen — "one
// personal library, one publishing dashboard," reused here, not
// duplicated. See the Books restructuring report for why.
export default function MyBooksCenterScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [authorBooks, setAuthorBooks] = useState<AuthorBook[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [overviewRes, offlineRes, authorRes]: any[] = await Promise.all([
      getRequest(ROUTES.books.libraryOverview),
      getRequest(ROUTES.books.offlineMine),
      getRequest(ROUTES.books.mine),
    ]);
    if (overviewRes?.success) setOverview(overviewRes.data);
    if (offlineRes?.success && Array.isArray(offlineRes.data)) setDownloadedCount(offlineRes.data.length);
    if (authorRes?.success && Array.isArray(authorRes.data)) setAuthorBooks(authorRes.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const publishedCount = authorBooks.filter((b) => b.status === 'published').length;
  const pendingCount = authorBooks.filter((b) => PUBLISHING_PENDING_STATUSES.has(b.status)).length;
  const greetingName = user?.display_name || 'Reader';

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    scroll: { flex: 1, padding: sp },
    greeting: { fontSize: 22, fontWeight: '800', color: palette.text, marginBottom: 2 },
    greetingSub: { fontSize: 13, color: palette.subtext, marginBottom: 18 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: palette.text, marginTop: 20, marginBottom: 10 },
    continueRow: { gap: 10 },
    continueCard: {
      backgroundColor: palette.card, borderRadius: 12, padding: 12, width: 160, gap: 4,
      borderWidth: 1, borderColor: palette.divider,
    },
    continueTitle: { fontSize: 13, fontWeight: '700', color: palette.text },
    continueAuthor: { fontSize: 11, color: palette.subtext },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      backgroundColor: palette.card, borderRadius: 14, padding: 14, flexGrow: 1, flexBasis: '47%',
      borderWidth: 1, borderColor: palette.divider, gap: 6,
    },
    statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statValue: { fontSize: 22, fontWeight: '800', color: palette.text },
    statLabel: { fontSize: 12, fontWeight: '600', color: palette.subtext },
    highlightsRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 14,
      borderRadius: 12, borderWidth: 1, borderColor: palette.divider,
    },
    highlightsRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.text },
    studioCard: {
      backgroundColor: palette.primarySoft, borderRadius: 14, padding: 16, gap: 8, marginTop: 20,
    },
    studioTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
    studioSub: { fontSize: 13, color: palette.subtext, lineHeight: 18 },
    studioActions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
    empty: { fontSize: 13, color: palette.subtext },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (loading || !overview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Books</Text>
        <Pressable onPress={() => navigation.navigate('BooksMarketplace')} hitSlop={8} accessibilityLabel="Browse the Books Marketplace">
          <KISIcon name="search" size={21} color={palette.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll}>
        <Text style={styles.greeting}>Welcome back, {greetingName}</Text>
        <Text style={styles.greetingSub}>Your reading, downloads, and publishing in one place.</Text>

        {overview.currently_reading.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Continue Reading</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.continueRow}>
              {overview.currently_reading.map((book) => (
                <Pressable
                  key={book.id}
                  style={styles.continueCard}
                  onPress={() => navigation.navigate('BookReader', { id: book.id })}
                >
                  <KISIcon name="book" size={20} color={palette.primary} />
                  <Text style={styles.continueTitle} numberOfLines={2}>{book.title}</Text>
                  <Text style={styles.continueAuthor} numberOfLines={1}>by {book.author_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>My Library</Text>
        <View style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('MyLibrary')}>
            <View style={styles.statIconRow}>
              <KISIcon name="check" size={16} color={palette.primary} />
              <Text style={styles.statValue}>{downloadedCount}</Text>
            </View>
            <Text style={styles.statLabel}>Available Offline</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('MyLibrary')}>
            <View style={styles.statIconRow}>
              <KISIcon name="heart" size={16} color={palette.primary} />
              <Text style={styles.statValue}>{overview.saved.length}</Text>
            </View>
            <Text style={styles.statLabel}>Saved Books</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('MyLibrary')}>
            <View style={styles.statIconRow}>
              <KISIcon name="bookmark" size={16} color={palette.primary} />
              <Text style={styles.statValue}>{overview.bookmarked.length}</Text>
            </View>
            <Text style={styles.statLabel}>Bookmarked Chapters</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('MyLibrary')}>
            <View style={styles.statIconRow}>
              <KISIcon name="star" size={16} color={palette.primary} />
              <Text style={styles.statValue}>{overview.completed.length}</Text>
            </View>
            <Text style={styles.statLabel}>Finished Books</Text>
          </Pressable>
        </View>

        <Pressable style={styles.highlightsRow} onPress={() => navigation.navigate('HighlightsComments')}>
          <KISIcon name="chat" size={18} color={palette.primary} />
          <Text style={styles.highlightsRowText}>Highlights & Comments</Text>
          <KISIcon name="chevron-right" size={16} color={palette.subtext} />
        </Pressable>

        <View style={styles.studioCard}>
          <Text style={styles.studioTitle}>My Publishing Studio</Text>
          <Text style={styles.studioSub}>
            {authorBooks.length === 0
              ? "Haven't published a book yet? Share your writing with the KIS community."
              : `${publishedCount} published${pendingCount > 0 ? ` · ${pendingCount} in progress` : ''}`}
          </Text>
          <View style={styles.studioActions}>
            <KISButton title="Open Studio" size="sm" variant="primary" onPress={() => navigation.navigate('AuthorStudio')} />
            <KISButton title="New Book" size="sm" variant="outline" onPress={() => navigation.navigate('CreateBook')} />
            {publishedCount > 0 && (
              <KISButton title="My Earnings" size="sm" variant="outline" onPress={() => navigation.navigate('MyEarnings')} />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
