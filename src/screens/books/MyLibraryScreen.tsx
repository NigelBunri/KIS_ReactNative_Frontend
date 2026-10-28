import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { listOfflineIndexEntries, type OfflineBookIndexEntry } from '@/services/books/offlineDownloadManager';
import { totalOfflineStorageBytes } from '@/storage/offlineBookStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLibrary'>;

type BookSummary = { id: string; title: string; author_name: string; status: string };

type Overview = {
  saved: BookSummary[];
  currently_reading: BookSummary[];
  completed: BookSummary[];
  bookmarked: BookSummary[];
};

type Purchase = {
  id: string;
  book: string;
  book_title: string;
  book_author_name: string;
  status: string;
  refunded_at: string | null;
};

const SECTIONS: { key: keyof Overview; label: string; empty: string }[] = [
  { key: 'currently_reading', label: 'Continue Reading', empty: 'Nothing in progress yet.' },
  { key: 'saved', label: 'Saved', empty: 'No saved books yet.' },
  { key: 'bookmarked', label: 'Bookmarked Chapters', empty: 'No chapter bookmarks yet.' },
  { key: 'completed', label: 'Finished', empty: 'No finished books yet.' },
];

export default function MyLibraryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState<OfflineBookIndexEntry[]>([]);
  const [storageBytes, setStorageBytes] = useState(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.libraryOverview);
    if (res?.success) setOverview(res.data);
    setLoading(false);
  }, []);

  // Purchased/entitled is a distinct concept from "saved" (a wishlist
  // bookmark) — fetched separately so the two are never conflated in the UI.
  const fetchPurchases = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.purchasesMine);
    if (res?.success && Array.isArray(res.data)) {
      setPurchases(res.data.filter((p: Purchase) => p.status === 'paid' && !p.refunded_at));
    }
  }, []);

  const fetchDownloaded = useCallback(async () => {
    const [entries, bytes] = await Promise.all([listOfflineIndexEntries(), totalOfflineStorageBytes()]);
    setDownloaded(entries);
    setStorageBytes(bytes);
  }, []);

  const downloadedIds = new Set(downloaded.map((d) => d.bookId));

  useFocusEffect(useCallback(() => {
    fetchOverview();
    fetchDownloaded();
    fetchPurchases();
  }, [fetchOverview, fetchDownloaded, fetchPurchases]));

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    scroll: { flex: 1, padding: sp },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginTop: 16, marginBottom: 8 },
    row: { backgroundColor: palette.card, borderRadius: 12, padding: 14, marginBottom: 8 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
    rowAuthor: { fontSize: 12, color: palette.subtext },
    empty: { fontSize: 13, color: palette.subtext, paddingBottom: 8 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    downloadBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    downloadBadgeText: { fontSize: 11, fontWeight: '700', color: palette.primary },
    storageSummary: { fontSize: 12, color: palette.subtext, marginBottom: 8 },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Library</Text>
      </View>

      {loading || !overview ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll}>
          <Text style={styles.sectionTitle}>Downloaded</Text>
          {downloaded.length === 0 ? (
            <Text style={styles.empty}>No books downloaded for offline reading yet.</Text>
          ) : (
            <>
              <Text style={styles.storageSummary}>
                {downloaded.length} book{downloaded.length === 1 ? '' : 's'} · {(storageBytes / 1024).toFixed(0)} KB used
              </Text>
              {downloaded.map((entry) => (
                <Pressable key={entry.bookId} style={styles.row} onPress={() => navigation.navigate('BookDetail', { id: entry.bookId })}>
                  <Text style={styles.rowTitle}>{entry.title}</Text>
                  <Text style={styles.rowAuthor}>by {entry.authorName}</Text>
                  <View style={styles.downloadBadgeRow}>
                    <KISIcon name="check" size={12} color={palette.primary} />
                    <Text style={styles.downloadBadgeText}>Available Offline</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Purchased</Text>
          {purchases.length === 0 ? (
            <Text style={styles.empty}>No purchased books yet.</Text>
          ) : (
            purchases.map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => navigation.navigate('BookDetail', { id: p.book })}>
                <Text style={styles.rowTitle}>{p.book_title}</Text>
                <Text style={styles.rowAuthor}>by {p.book_author_name}</Text>
                {downloadedIds.has(p.book) && (
                  <View style={styles.downloadBadgeRow}>
                    <KISIcon name="check" size={12} color={palette.primary} />
                    <Text style={styles.downloadBadgeText}>Available Offline</Text>
                  </View>
                )}
              </Pressable>
            ))
          )}

          {SECTIONS.map((section) => (
            <View key={section.key}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {overview[section.key].length === 0 ? (
                <Text style={styles.empty}>{section.empty}</Text>
              ) : (
                overview[section.key].map((book) => (
                  <Pressable key={book.id} style={styles.row} onPress={() => navigation.navigate('BookDetail', { id: book.id })}>
                    <Text style={styles.rowTitle}>{book.title}</Text>
                    <Text style={styles.rowAuthor}>by {book.author_name}</Text>
                    {downloadedIds.has(book.id) && (
                      <View style={styles.downloadBadgeRow}>
                        <KISIcon name="check" size={12} color={palette.primary} />
                        <Text style={styles.downloadBadgeText}>Available Offline</Text>
                      </View>
                    )}
                  </Pressable>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
