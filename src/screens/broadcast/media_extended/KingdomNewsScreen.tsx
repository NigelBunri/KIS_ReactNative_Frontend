import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'KingdomNews'>;

type Article = {
  id: string;
  title: string;
  author?: string;
  source?: string;
  content?: string;
  category: string;
  published_at: string;
  is_featured?: boolean;
  credibility_score?: number;
  thumbnail_url?: string;
};

const CATEGORIES = ['All', 'Revival', 'Persecution', 'Policy', 'Business', 'Health', 'Education'];

export default function KingdomNewsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.mediaExtended.news)
        .then((res: any) => {
          if (active) setArticles(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const filtered = useMemo(() => {
    return category === 'All'
      ? articles
      : articles.filter((a) => a.category === category);
  }, [articles, category]);

  const featured = filtered.find((a) => a.is_featured);
  const rest = filtered.filter((a) => !a.is_featured);

  const credibilityColor = (score?: number) => {
    if (!score) return palette.subtext;
    if (score >= 80) return palette.primary;
    if (score >= 50) return palette.gold;
    return palette.danger;
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    catBar: { paddingHorizontal: sp, paddingVertical: 10 },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 34,
      justifyContent: 'center',
    },
    chipText: { fontSize: 12, fontWeight: '500' },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    featuredCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 16,
    },
    featuredThumb: {
      height: 180,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    featuredBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: palette.gold,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    featuredBadgeText: { fontSize: 11, fontWeight: '700', color: palette.ivory },
    featuredBody: { padding: sp },
    featuredTitle: { fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 6 },
    articleCard: {
      flexDirection: 'row',
      backgroundColor: palette.card,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 10,
      minHeight: 88,
    },
    articleThumb: {
      width: 80,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    articleBody: { flex: 1, padding: 12 },
    articleTitle: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 4 },
    articleMeta: { fontSize: 12, color: palette.subtext },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    credChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    credText: { fontSize: 11, fontWeight: '600', color: palette.ivory },
    // Full article view
    articleFull: { flex: 1, backgroundColor: palette.bg },
    articleFullHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      minHeight: 56,
    },
    articleFullBackBtn: { marginRight: 12, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    articleFullTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text },
    articleContent: { padding: sp, paddingBottom: 80 },
    fullTitle: { fontSize: 20, fontWeight: '700', color: palette.text, marginBottom: 8 },
    fullMeta: { fontSize: 13, color: palette.subtext, marginBottom: 16 },
    fullBody: { fontSize: 15, color: palette.text, lineHeight: 24 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (selectedArticle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.articleFullHeader}>
          <Pressable
            style={styles.articleFullBackBtn}
            onPress={() => setSelectedArticle(null)}
            hitSlop={8}
          >
            <KISIcon name="chevron-back-outline" size={22} color={palette.primary} />
          </Pressable>
          <Text style={styles.articleFullTitle} numberOfLines={2}>{selectedArticle.title}</Text>
          {selectedArticle.credibility_score != null && (
            <View style={[styles.credChip, { backgroundColor: credibilityColor(selectedArticle.credibility_score) }]}>
              <Text style={styles.credText}>{selectedArticle.credibility_score}%</Text>
            </View>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.articleContent}>
          <Text style={styles.fullTitle}>{selectedArticle.title}</Text>
          <Text style={styles.fullMeta}>
            {selectedArticle.author ?? 'Unknown Author'}
            {selectedArticle.source ? ` · ${selectedArticle.source}` : ''}
            {selectedArticle.published_at ? ` · ${new Date(selectedArticle.published_at).toLocaleDateString()}` : ''}
          </Text>
          <Text style={styles.fullBody}>
            {selectedArticle.content ?? 'Full article content not available.'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Kingdom News</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar}>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.divider,
                  },
                ]}
                onPress={() => setCategory(cat)}
                hitSlop={4}
              >
                <Text style={[styles.chipText, { color: active ? palette.ivory : palette.text }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 && (
          <Text style={styles.empty}>No articles found.</Text>
        )}

        {featured && (
          <Pressable
            style={styles.featuredCard}
            onPress={() => setSelectedArticle(featured)}
            hitSlop={4}
          >
            <View style={styles.featuredThumb}>
              <KISIcon name="newspaper-outline" size={48} color={palette.primary} />
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>FEATURED</Text>
              </View>
            </View>
            <View style={styles.featuredBody}>
              <Text style={styles.featuredTitle} numberOfLines={3}>{featured.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.articleMeta}>
                  {featured.author ?? ''}
                  {featured.published_at ? ` · ${new Date(featured.published_at).toLocaleDateString()}` : ''}
                </Text>
                {featured.credibility_score != null && (
                  <View style={[styles.credChip, { backgroundColor: credibilityColor(featured.credibility_score) }]}>
                    <Text style={styles.credText}>Cred: {featured.credibility_score}%</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}

        {rest.map((article) => (
          <Pressable
            key={article.id}
            style={styles.articleCard}
            onPress={() => setSelectedArticle(article)}
            hitSlop={4}
          >
            <View style={styles.articleThumb}>
              <KISIcon name="newspaper-outline" size={28} color={palette.primary} />
            </View>
            <View style={styles.articleBody}>
              <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
              <Text style={styles.articleMeta}>
                {article.author ?? ''}
                {article.source ? ` · ${article.source}` : ''}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.articleMeta}>
                  {article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}
                </Text>
                {article.credibility_score != null && (
                  <View style={[styles.credChip, { backgroundColor: credibilityColor(article.credibility_score) }]}>
                    <Text style={styles.credText}>{article.credibility_score}%</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
