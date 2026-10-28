import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '../../../App';
import { useOfflineDownload } from './useOfflineDownload';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

type BookDetail = {
  id: string;
  title: string;
  subtitle?: string;
  author_name: string;
  description?: string;
  christian_category: string;
  is_free: boolean;
  current_price_cents: number;
  currency: string;
  status: string;
  estimated_reading_minutes: number;
  word_count: number;
  has_access: boolean;
  is_saved: boolean;
  average_rating: number;
  review_count: number;
  chapters: { stable_id: string; order: number; title: string }[];
};

type BookReview = {
  id: string;
  user: string;
  rating: number;
  review_text: string;
  reviewer_display_name: string;
  created_at: string;
};

type RelatedBook = { id: string; title: string; author_name: string };

export default function BookDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;
  const { user } = useAuth();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [myReviewText, setMyReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [related, setRelated] = useState<RelatedBook[]>([]);

  const fetchBook = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.detail(id));
    if (res?.success) setBook(res.data);
    setLoading(false);
  }, [id]);

  // Real "more in this category" using the same server-side category
  // filter the marketplace uses — not a fabricated recommendation engine.
  const fetchRelated = useCallback(async (category: string) => {
    const res: any = await getRequest(ROUTES.books.list(`?category=${encodeURIComponent(category)}`));
    const list = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
    if (res?.success) setRelated(list.filter((b: RelatedBook) => b.id !== id).slice(0, 10));
  }, [id]);

  const fetchReviews = useCallback(async () => {
    const res: any = await getRequest(ROUTES.books.reviews(id));
    if (res?.success && Array.isArray(res.data)) {
      setReviews(res.data);
      const mine = res.data.find((r: BookReview) => r.user === user?.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyReviewText(mine.review_text || '');
      }
    }
  }, [id, user?.id]);

  const offline = useOfflineDownload(id);

  useFocusEffect(useCallback(() => {
    fetchBook();
    fetchReviews();
    offline.refresh();
  }, [fetchBook, fetchReviews, offline.refresh]));

  useFocusEffect(useCallback(() => {
    if (book?.christian_category) fetchRelated(book.christian_category);
  }, [book?.christian_category, fetchRelated]));

  const submitReview = async () => {
    if (!myRating) {
      Alert.alert('Add a rating', 'Tap a star to rate this book before submitting.');
      return;
    }
    setSubmittingReview(true);
    const res: any = await postRequest(ROUTES.books.reviews(id), { rating: myRating, review_text: myReviewText.trim() });
    setSubmittingReview(false);
    if (res?.success) {
      await Promise.all([fetchBook(), fetchReviews()]);
    } else {
      Alert.alert('Could not submit review', res?.message || 'Please try again.');
    }
  };

  const reportReview = (reviewId: string) => {
    Alert.alert('Report review', 'Report this review as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          const res: any = await postRequest(ROUTES.books.reviewReport(reviewId), { reason: 'Reported by reader' });
          if (res?.success) Alert.alert('Reported', 'Thanks — our team will review this.');
        },
      },
    ]);
  };

  const handleGetFree = async () => {
    setBusy(true);
    const res: any = await postRequest(ROUTES.books.getFree(id), {});
    setBusy(false);
    if (res?.success) {
      await fetchBook();
      navigation.navigate('BookReader', { id });
    } else {
      Alert.alert('Error', res?.message || 'Could not add this book to your library.');
    }
  };

  const toggleSave = async () => {
    if (!book) return;
    const { deleteRequest } = await import('@/network/delete');
    if (book.is_saved) {
      await deleteRequest(ROUTES.books.save(id));
    } else {
      await postRequest(ROUTES.books.save(id), {});
    }
    setBook({ ...book, is_saved: !book.is_saved });
  };

  const handleBuy = async () => {
    setBusy(true);
    const res: any = await postRequest(ROUTES.books.checkout(id), { provider: 'flutterwave' });
    setBusy(false);
    if (res?.success && res.data?.payment_url) {
      Linking.openURL(res.data.payment_url);
    } else {
      Alert.alert('Checkout', res?.message || 'Could not start checkout for this book.');
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    content: { padding: sp, gap: 14 },
    cover: { height: 200, borderRadius: 14, backgroundColor: palette.primarySoft, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '800', color: palette.text },
    author: { fontSize: 14, color: palette.subtext },
    metaRow: { flexDirection: 'row', gap: 12 },
    metaText: { fontSize: 12, color: palette.subtext },
    description: { fontSize: 14, color: palette.text, lineHeight: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginTop: 8 },
    chapterRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.divider },
    chapterText: { fontSize: 14, color: palette.text },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    starRow: { flexDirection: 'row', gap: 4 },
    reviewComposer: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.divider },
    reviewInput: {
      borderWidth: 1, borderColor: palette.divider, borderRadius: 10, padding: 10, color: palette.text,
      minHeight: 60,
    },
    reviewCard: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.divider },
    reviewerName: { fontSize: 13, fontWeight: '700', color: palette.text },
    reviewText: { fontSize: 13, color: palette.text },
    reportLink: { fontSize: 11, color: palette.subtext, alignSelf: 'flex-end' },
    emptyReviews: { fontSize: 13, color: palette.subtext },
    offlineRow: { gap: 6 },
    offlineAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    offlineActionText: { fontSize: 13, fontWeight: '600', color: palette.text },
    offlineRemoveLink: { fontSize: 12, color: palette.subtext, textDecorationLine: 'underline' },
    relatedRow: { gap: 10 },
    relatedCard: {
      backgroundColor: palette.card, borderRadius: 12, padding: 12, width: 150, gap: 4,
      borderWidth: 1, borderColor: palette.divider,
    },
    relatedTitle: { fontSize: 13, fontWeight: '700', color: palette.text },
    relatedAuthor: { fontSize: 11, color: palette.subtext },
  });

  if (loading || !book) {
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
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
        <Pressable onPress={toggleSave} hitSlop={8} accessibilityLabel={book.is_saved ? 'Remove from library' : 'Save to library'}>
          <KISIcon name="heart" focused={book.is_saved} size={22} color={book.is_saved ? palette.primary : palette.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <KISIcon name="book" size={56} color={palette.primary} />
        </View>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>by {book.author_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{book.estimated_reading_minutes} min read</Text>
          <Text style={styles.metaText}>{book.word_count} words</Text>
          <Text style={styles.metaText}>{book.christian_category.replace(/_/g, ' ')}</Text>
        </View>
        {book.review_count > 0 && (
          <View style={styles.ratingRow}>
            <KISIcon name="star" focused size={14} color={palette.primary} />
            <Text style={styles.metaText}>
              {Number(book.average_rating).toFixed(1)} ({book.review_count} review{book.review_count === 1 ? '' : 's'})
            </Text>
          </View>
        )}
        {!!book.description && <Text style={styles.description}>{book.description}</Text>}

        {book.has_access ? (
          <KISButton title="Read Now" variant="primary" onPress={() => navigation.navigate('BookReader', { id })} />
        ) : book.is_free ? (
          <KISButton title="Get Free" variant="primary" loading={busy} onPress={handleGetFree} />
        ) : (
          <KISButton
            title={`Buy — ${book.currency} ${(book.current_price_cents / 100).toFixed(2)}`}
            variant="primary"
            loading={busy}
            onPress={handleBuy}
          />
        )}

        {book.has_access && (
          <View style={styles.offlineRow}>
            {offline.uiState === 'not_downloaded' && (
              <Pressable style={styles.offlineAction} onPress={offline.startDownload}>
                <KISIcon name="refresh" size={16} color={palette.primary} />
                <Text style={styles.offlineActionText}>Download for Offline Reading</Text>
              </Pressable>
            )}
            {offline.uiState === 'downloading' && (
              <View style={styles.offlineAction}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={styles.offlineActionText}>Downloading… {offline.progressPercent}%</Text>
              </View>
            )}
            {offline.uiState === 'downloaded' && (
              <>
                <View style={styles.offlineAction}>
                  <KISIcon name="check" size={16} color={palette.primary} />
                  <Text style={styles.offlineActionText}>
                    Downloaded — Available Offline ({(offline.sizeBytes / 1024).toFixed(0)} KB)
                  </Text>
                </View>
                <Pressable onPress={offline.removeDownload} hitSlop={6}>
                  <Text style={styles.offlineRemoveLink}>Remove Download</Text>
                </Pressable>
              </>
            )}
            {offline.uiState === 'update_available' && (
              <Pressable style={styles.offlineAction} onPress={offline.startDownload}>
                <KISIcon name="refresh" size={16} color={palette.primary} />
                <Text style={styles.offlineActionText}>Updating Download — tap to update</Text>
              </Pressable>
            )}
            {offline.uiState === 'license_expired' && (
              <Pressable style={styles.offlineAction} onPress={offline.startDownload}>
                <KISIcon name="refresh" size={16} color="#B23B3B" />
                <Text style={[styles.offlineActionText, { color: '#B23B3B' }]}>
                  Offline access expired — tap to renew
                </Text>
              </Pressable>
            )}
            {offline.uiState === 'failed' && (
              <Pressable style={styles.offlineAction} onPress={offline.startDownload}>
                <KISIcon name="refresh" size={16} color="#B23B3B" />
                <Text style={[styles.offlineActionText, { color: '#B23B3B' }]}>Download Failed — Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Table of contents</Text>
        {book.chapters.map((c) => (
          <View key={c.stable_id} style={styles.chapterRow}>
            <Text style={styles.chapterText}>{c.order}. {c.title || `Chapter ${c.order}`}</Text>
          </View>
        ))}

        {related.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>More in {book.christian_category.replace(/_/g, ' ')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
              {related.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.relatedCard}
                  onPress={() => navigation.push('BookDetail', { id: b.id })}
                >
                  <KISIcon name="book" size={18} color={palette.primary} />
                  <Text style={styles.relatedTitle} numberOfLines={2}>{b.title}</Text>
                  <Text style={styles.relatedAuthor} numberOfLines={1}>by {b.author_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>Reviews</Text>
        {book.has_access ? (
          <View style={styles.reviewComposer}>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setMyRating(n)} hitSlop={6} accessibilityLabel={`Rate ${n} stars`}>
                  <KISIcon name="star" focused={n <= myRating} size={24} color={palette.primary} />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Share your thoughts (optional)"
              placeholderTextColor={palette.subtext}
              value={myReviewText}
              onChangeText={setMyReviewText}
              multiline
            />
            <KISButton
              title={reviews.some((r) => r.user === user?.id) ? 'Update review' : 'Submit review'}
              variant="primary"
              loading={submittingReview}
              onPress={submitReview}
            />
          </View>
        ) : (
          <Text style={styles.emptyReviews}>Read this book to leave a review.</Text>
        )}

        {reviews.length === 0 ? (
          <Text style={styles.emptyReviews}>No reviews yet — be the first.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <KISIcon key={n} name="star" focused={n <= r.rating} size={12} color={palette.primary} />
                ))}
                <Text style={styles.reviewerName}>{r.reviewer_display_name}</Text>
              </View>
              {!!r.review_text && <Text style={styles.reviewText}>{r.review_text}</Text>}
              {r.user !== user?.id && (
                <Pressable onPress={() => reportReview(r.id)} hitSlop={6}>
                  <Text style={styles.reportLink}>Report</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
