import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { queueableJsonRequest } from '@/services/offlineActionQueue';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type WishlistNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'Wishlist'
>;

type SavedItem = {
  id: string;
  created_at?: string;
  product_detail: {
    id: string;
    name: string;
    price?: number | string;
    sale_price?: number | string | null;
    currency_display?: string;
    main_image?: string | null;
    stock_qty?: number;
    shop?: string;
  };
};

export default function WishlistPage() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<WishlistNavigation>();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.commerce.savedItems, {
        errorMessage: 'Unable to load your wishlist.',
      });
      if (response.success) {
        const payload = response.data;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        setItems(data);
      } else {
        setError(response.message ?? 'Unable to load your wishlist.');
      }
    } catch (loadError: any) {
      setError(loadError?.message ?? 'Unable to load your wishlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWishlist();
    setRefreshing(false);
  }, [loadWishlist]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const handleRemove = useCallback(
    async (item: SavedItem) => {
      setRemovingId(item.id);
      try {
        const response = await queueableJsonRequest({
          domain: 'Market',
          kind: 'market.wishlist.remove',
          method: 'DELETE',
          url: ROUTES.commerce.savedItemByProduct(item.product_detail.id),
          dedupeKey: `market:wishlist:${item.product_detail.id}`,
          errorMessage: 'Unable to remove from wishlist.',
        });
        if (!response.success) {
          throw new Error(response.message || 'Unable to remove from wishlist.');
        }
        setItems(prev => prev.filter(entry => entry.id !== item.id));
      } catch (removeError: any) {
        setError(removeError?.message || 'Unable to remove from wishlist.');
      } finally {
        setRemovingId(null);
      }
    },
    [],
  );

  const renderItem = ({ item }: { item: SavedItem }) => {
    const product = item.product_detail;
    const price = product.sale_price ?? product.price;

    return (
      <Pressable
        style={[
          styles.card,
          {
            borderColor: palette.surfaceDark,
            backgroundColor: palette.surfaceElevated,
            shadowColor: palette.royalInk,
          },
        ]}
        onPress={() =>
          navigation.navigate('ProductDetail', {
            productId: product.id,
          })
        }
      >
        {product.main_image ? (
          <Image source={{ uri: product.main_image }} style={styles.thumb} />
        ) : (
          <View
            style={[styles.thumb, { backgroundColor: palette.surfaceDark }]}
          />
        )}
        <View style={styles.cardBody}>
          <Text
            style={[styles.name, { color: palette.text }]}
            numberOfLines={2}
          >
            {product.name}
          </Text>
          <Text style={[styles.price, { color: palette.primaryStrong }]}>
            {product.currency_display ?? 'USD'} {price}
          </Text>
          {product.stock_qty === 0 ? (
            <Text style={[styles.outOfStock, { color: palette.danger }]}>
              Out of stock
            </Text>
          ) : null}
        </View>
        <KISButton
          title={removingId === item.id ? 'Removing…' : 'Remove'}
          loading={removingId === item.id}
          size="xs"
          variant="ghost"
          onPress={() => handleRemove(item)}
          disabled={Boolean(removingId)}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: palette.surface, borderColor: palette.divider },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Wishlist</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Items you've saved for later
          </Text>
        </View>
        <KISButton
          title="Refresh"
          size="sm"
          variant="ghost"
          onPress={handleRefresh}
          disabled={loading}
        />
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <Text style={{ color: palette.danger }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, 32) },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.loader}>
              <Text style={{ color: palette.subtext }}>
                Nothing saved yet. Tap the heart on a product to add it here.
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 0,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
  },
  outOfStock: {
    fontSize: 11,
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
    alignItems: 'center',
  },
});
