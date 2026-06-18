// src/screens/broadcast/channels/CategoryBrowsePage.tsx
//
// Browse broadcast categories grid or paginated content within a category.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  slug: string;
  icon_name?: string;
  description?: string;
  subcategories?: Category[];
};

type ChannelContent = {
  id: string;
  title?: string;
  thumbnail_url?: string;
  channel_name?: string;
  view_count?: number;
};

type Props = {
  categorySlug?: string;
  onSelectCategory?: (slug: string, name: string) => void;
  onSelectContent?: (contentId: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CategoryBrowsePage(props: Props) {
  const { palette } = useKISTheme();
  const { pageGutter, cardGap, columns } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CategoryBrowsePage'>>();

  const categorySlug = props.categorySlug ?? route.params?.categorySlug;

  const handleSelectCategory = useCallback((slug: string, name: string) => {
    if (props.onSelectCategory) {
      props.onSelectCategory(slug, name);
    } else {
      navigation.navigate('CategoryBrowsePage', { categorySlug: slug, categoryName: name });
    }
  }, [props.onSelectCategory, navigation]);

  const handleSelectContent = useCallback((contentId: string) => {
    if (props.onSelectContent) {
      props.onSelectContent(contentId);
    } else {
      navigation.navigate('ChannelContentDetail', { contentId });
    }
  }, [props.onSelectContent, navigation]);

  const isGridMode = !categorySlug;

  // Grid mode state
  const [categories, setCategories] = useState<Category[]>([]);

  // Browse mode state
  const [contents, setContents] = useState<ChannelContent[]>([]);
  const [categoryName, setCategoryName] = useState<string>(route.params?.categoryName ?? '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.broadcasts.categories, { errorMessage: '' });
      const raw: Category[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setCategories(raw);
    } catch {
      setError('Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBrowse = useCallback(async (slug: string, nextPage: number, append: boolean) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.categoryBrowse(slug)}?page=${nextPage}`,
        { errorMessage: '' },
      );
      const name: string = res?.category_name ?? res?.name ?? slug;
      if (nextPage === 1) setCategoryName(name);
      const raw: ChannelContent[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.results ?? [];
      setContents(prev => append ? [...prev, ...raw] : raw);
      setHasMore(raw.length > 0 && !!(res?.next || res?.has_more));
    } catch {
      setError('Could not load content.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isGridMode) {
      void fetchCategories();
    } else {
      setContents([]);
      setPage(1);
      setHasMore(true);
      void fetchBrowse(categorySlug, 1, false);
    }
  }, [isGridMode, categorySlug, fetchCategories, fetchBrowse]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchBrowse(categorySlug!, nextPage, true);
  }, [hasMore, loadingMore, loading, page, categorySlug, fetchBrowse]);

  if (loading && contents.length === 0 && categories.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.card, paddingTop: insets.top }]}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.card, paddingTop: insets.top }]}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  // Grid mode: category tiles
  if (isGridMode) {
    const renderCategoryTile = ({ item }: { item: Category }) => (
      <Pressable
        onPress={() => handleSelectCategory(item.slug, item.name)}
        style={[styles.categoryTile, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <View style={[styles.categoryIconWrap, { backgroundColor: palette.primarySoft ?? palette.surface }]}>
          <KISIcon
            name={(item.icon_name as any) || 'channel'}
            size={24}
            color={palette.primaryStrong}
          />
        </View>
        <Text numberOfLines={1} style={[styles.categoryName, { color: palette.text }]}>
          {item.name}
        </Text>
        {item.description ? (
          <Text numberOfLines={2} style={[styles.categoryDesc, { color: palette.subtext }]}>
            {item.description}
          </Text>
        ) : null}
      </Pressable>
    );

    const numColumns = Math.max(2, columns.dense);
    return (
      <View style={[styles.container, { backgroundColor: palette.card, paddingTop: insets.top }]}>
        <Text style={[styles.pageTitle, { color: palette.text, paddingHorizontal: pageGutter, paddingTop: pageGutter }]}>Browse Categories</Text>
        <FlatList
          key={`category-cols-${numColumns}`}
          data={categories}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          columnWrapperStyle={[styles.columnWrapper, { gap: cardGap, paddingHorizontal: pageGutter }]}
          renderItem={renderCategoryTile}
          contentContainerStyle={[styles.listContent, { gap: cardGap }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No categories available.</Text>
          }
        />
      </View>
    );
  }

  // Browse mode: content grid with infinite scroll
  const renderContentCard = ({ item }: { item: ChannelContent }) => (
    <Pressable
      onPress={() => handleSelectContent(item.id)}
      style={[styles.contentCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.contentThumbnail} />
      ) : (
        <View style={[styles.contentThumbnail, { backgroundColor: palette.border }]} />
      )}
      <View style={styles.contentBody}>
        <Text numberOfLines={2} style={[styles.contentTitle, { color: palette.text }]}>
          {item.title || 'Untitled'}
        </Text>
        {item.channel_name ? (
          <Text numberOfLines={1} style={[styles.contentChannel, { color: palette.subtext }]}>
            {item.channel_name}
          </Text>
        ) : null}
        <Text style={[styles.contentViews, { color: palette.subtext }]}>
          {(item.view_count ?? 0).toLocaleString()} views
        </Text>
      </View>
    </Pressable>
  );

  const numColumns = Math.max(2, columns.dense);

  return (
    <View style={[styles.container, { backgroundColor: palette.card, paddingTop: insets.top }]}>
      {categoryName ? (
        <Text style={[styles.pageTitle, { color: palette.text, paddingHorizontal: pageGutter, paddingTop: pageGutter }]}>{categoryName}</Text>
      ) : null}
      <FlatList
        key={`category-content-cols-${numColumns}`}
        data={contents}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        columnWrapperStyle={[styles.columnWrapper, { gap: cardGap, paddingHorizontal: pageGutter }]}
        renderItem={renderContentCard}
        contentContainerStyle={[styles.listContent, { gap: cardGap }]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={palette.primaryStrong} style={styles.footerLoader} /> : null
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No content in this category yet.</Text>
        }
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  pageTitle: { fontSize: 20, fontWeight: '900', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  columnWrapper: { gap: 10, paddingHorizontal: 14 },
  listContent: { paddingBottom: 24, gap: 10 },
  categoryTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  categoryIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: { fontSize: 14, fontWeight: '900' },
  categoryDesc: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  contentCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  contentThumbnail: { width: '100%', aspectRatio: 16 / 9 },
  contentBody: { padding: 8, gap: 4 },
  contentTitle: { fontSize: 12, fontWeight: '800', lineHeight: 16 },
  contentChannel: { fontSize: 11, fontWeight: '600' },
  contentViews: { fontSize: 10, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 13, fontWeight: '700', padding: 40 },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  footerLoader: { paddingVertical: 16 },
});
