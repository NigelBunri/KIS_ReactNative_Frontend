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

type Props = NativeStackScreenProps<RootStackParamList, 'AuthorStudio'>;

type AuthorBook = {
  id: string;
  title: string;
  status: string;
  is_free: boolean;
  current_price_cents: number;
  currency: string;
  rejection_reason?: string;
  moderation_notes?: string;
  average_rating?: number;
  review_count?: number;
  view_count?: number;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', processing: 'Processing manuscript', conversion_failed: 'Conversion failed',
  pending_review: 'Awaiting review', under_review: 'Under review', corrections_requested: 'Corrections requested',
  approved: 'Approved', published: 'Published', rejected: 'Rejected', suspended: 'Suspended',
  removed: 'Removed', archived: 'Archived',
};

export default function AuthorStudioScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [books, setBooks] = useState<AuthorBook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.mine);
    if (res?.success) setBooks(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchBooks(); }, [fetchBooks]));

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    scroll: { flex: 1, padding: sp },
    row: { backgroundColor: palette.card, borderRadius: 12, padding: 14, marginBottom: 10, gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center' },
    rowTitle: { fontSize: 15, fontWeight: '700', color: palette.text, flex: 1 },
    statusBadge: { fontSize: 12, fontWeight: '700', color: palette.primary },
    notes: { fontSize: 12, color: palette.subtext },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    editLink: { fontSize: 12, fontWeight: '700', color: palette.primary },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Author Studio</Text>
        <Pressable onPress={() => navigation.navigate('MyEarnings')} hitSlop={8} accessibilityLabel="My earnings" style={{ marginRight: 10 }}>
          <KISIcon name="wallet" size={22} color={palette.text} />
        </Pressable>
        <KISButton title="New book" size="sm" variant="primary" onPress={() => navigation.navigate('CreateBook')} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll}>
          {books.length === 0 ? (
            <Text style={styles.empty}>You haven't started a book yet. Tap "New book" to begin.</Text>
          ) : (
            books.map((book) => (
              <Pressable
                key={book.id}
                style={styles.row}
                onPress={() => navigation.navigate('ManuscriptUpload', { id: book.id })}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>{book.title}</Text>
                  <Pressable onPress={() => navigation.navigate('EditBook', { id: book.id })} hitSlop={8}>
                    <Text style={styles.editLink}>Edit details</Text>
                  </Pressable>
                </View>
                <Text style={styles.statusBadge}>{STATUS_LABELS[book.status] || book.status}</Text>
                {!!book.review_count && (
                  <View style={styles.statsRow}>
                    <KISIcon name="star" focused size={12} color={palette.primary} />
                    <Text style={styles.notes}>
                      {Number(book.average_rating || 0).toFixed(1)} ({book.review_count} review{book.review_count === 1 ? '' : 's'})
                      {typeof book.view_count === 'number' ? ` · ${book.view_count} views` : ''}
                    </Text>
                  </View>
                )}
                {!!book.rejection_reason && <Text style={styles.notes}>Reason: {book.rejection_reason}</Text>}
                {!!book.moderation_notes && <Text style={styles.notes}>{book.moderation_notes}</Text>}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
