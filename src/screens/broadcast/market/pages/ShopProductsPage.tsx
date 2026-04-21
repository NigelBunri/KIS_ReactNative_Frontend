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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { KIS_COIN_CODE, KIS_TO_USD_RATE } from '@/screens/market/market.constants';
import {
  buildCartProductIndex,
  cartHasProduct,
  CartProductVariantIndex,
  getShopCartState,
  subscribeToShopCart,
} from '@/screens/market/cart/shopCartManager';

const fallbackCover = require('@/assets/logo-light.png');

type ShopProductsRoute = RouteProp<RootStackParamList, 'ShopProducts'>;
type ShopProductsNavigation = NativeStackNavigationProp<RootStackParamList, 'ShopProducts'>;

type ShopProduct = {
  id?: string;
  name?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  sale_price?: string | number;
  compare_at_price?: string | number;
  images?: (string | { image_url?: string | null })[];
  image_url?: string | null;
  stock_qty?: number;
  stock?: number;
  requires_shipping?: boolean;
  inventory_type?: string;
};

const ShopProductsPage = () => {
  const route = useRoute<ShopProductsRoute>();
  const navigation = useNavigation<ShopProductsNavigation>();
  const { palette } = useKISTheme();
  const shopId = route.params?.shopId;
  const shopName = route.params?.shopName;

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cartProductIndex, setCartProductIndex] = useState<CartProductVariantIndex>(() =>
    buildCartProductIndex(getShopCartState()),
  );

  const resolveImageUri = useCallback((product: ShopProduct) => {
    const candidate = Array.isArray(product.images) && product.images.length
      ? product.images[0]
      : product.image_url;
    if (!candidate) return '';
    if (typeof candidate === 'string') {
      return resolveBackendAssetUrl(candidate) ?? candidate;
    }
    if (candidate && typeof candidate === 'object') {
      return resolveBackendAssetUrl(candidate.image_url ?? '') ?? candidate.image_url ?? '';
    }
    return '';
  }, []);

  const normalizeListResponse = (payload: any) => {
    if (!payload) return { items: [], next: null };
    const fromData = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.results)
        ? payload.results
        : Array.isArray(payload.data?.results)
          ? payload.data.results
          : [];
    const next = payload.next ?? payload?.data?.next ?? null;
    return { items: fromData, next };
  };

  const loadProducts = useCallback(
    async (targetUrl?: string, reset = false) => {
      if (!shopId) {
        setError('Shop identifier missing.');
        return;
      }
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const url = targetUrl ?? `${ROUTES.commerce.products}?shop=${encodeURIComponent(shopId)}`;
        const response = await getRequest(url, {
          forceNetwork: true,
          errorMessage: 'Unable to load shop products.',
        });
        if (!response.success) {
          throw new Error(response.message || 'Unable to load shop products.');
        }
        const payload = response.data ?? response ?? {};
        const normalized = normalizeListResponse(payload);
        setProducts((prev) => (reset ? normalized.items : [...prev, ...normalized.items]));
        setNextPage(normalized.next || null);
        setError(null);
      } catch (loadError: any) {
        setError(loadError?.message ?? 'Unable to load shop products.');
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    setProducts([]);
    setNextPage(null);
    setError(null);
    if (shopId) {
      void loadProducts(undefined, true);
    }
  }, [shopId, loadProducts]);

  useEffect(() => {
    const unsubscribe = subscribeToShopCart((next) => {
      setCartProductIndex(buildCartProductIndex(next));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadProducts(undefined, true).finally(() => setRefreshing(false));
  }, [loadProducts]);

  const handleLoadMore = useCallback(() => {
    if (!nextPage || loadingMore) return;
    void loadProducts(nextPage, false);
  }, [nextPage, loadingMore, loadProducts]);

  const openProductDetail = useCallback(
    (productId?: string) => {
      if (!productId) return;
      navigation.navigate('ProductDetail', { productId });
    },
    [navigation],
  );

  const renderProductItem = useCallback(
    ({ item }: { item: ShopProduct }) => {
      const imageUri = resolveImageUri(item);
      const price = Number(item.price ?? 0);
      const comparePrice = Number(item.compare_at_price ?? item.sale_price ?? 0);
      const stockQty = Number(item.stock_qty ?? item.stock ?? 0);
      const isInStock = stockQty > 0;
      const productId = item.id ? String(item.id) : '';
      const alreadyInCart = Boolean(productId && cartHasProduct(cartProductIndex, productId));
      return (
        <View style={[productStyles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
          <View style={productStyles.cardBody}>
            <Image
              source={imageUri ? { uri: imageUri } : fallbackCover}
              style={productStyles.cardImage}
              resizeMode="cover"
            />
            <View style={productStyles.cardContent}>
              <Text style={[productStyles.cardTitle, { color: palette.text }]} numberOfLines={2}>
                {item.name ?? 'Untitled product'}
              </Text>
              <Text style={[productStyles.cardSubtitle, { color: palette.subtext }]} numberOfLines={2}>
                {item.inventory_type ?? 'Product'}
              </Text>
              <View style={productStyles.priceRow}>
                <Text style={[productStyles.priceTag, { color: palette.primaryStrong }]}> 
                  {`${price.toFixed(2)} ${item.currency ?? KIS_COIN_CODE}`}
                </Text>
                {comparePrice > price ? (
                  <Text style={[productStyles.comparePrice, { color: palette.subtext }]}> 
                    {`${comparePrice.toFixed(2)} ${item.currency ?? KIS_COIN_CODE}`}
                  </Text>
                ) : null}
              </View>
              <Text style={[productStyles.secondaryText, { color: palette.subtext }]}> 
                ≈ ${(price * KIS_TO_USD_RATE).toFixed(2)} USD
              </Text>
              <Text style={[productStyles.secondaryText, { color: palette.text, marginTop: 4 }]}> 
                {isInStock ? `In stock · ${stockQty}` : 'Out of stock'}
              </Text>
            </View>
          </View>
          <View style={productStyles.actionRow}> 
            <KISButton
              title="View details"
              size="xs"
              variant="secondary"
              style={productStyles.actionButton}
              onPress={() => openProductDetail(String(item.id ?? ''))}
            />
            {!alreadyInCart && (
              <KISButton
                title="Add to cart"
                size="xs"
                style={productStyles.actionButton}
                onPress={() => openProductDetail(String(item.id ?? ''))}
                disabled={!isInStock}
              />
            )}
          </View>
        </View>
      );
    },
    [palette.primaryStrong, palette.subtext, palette.surface, palette.divider, palette.text, cartProductIndex, openProductDetail],
  );

  const titleText = shopName ? `${shopName} · Products` : 'Shop products';

  if (!shopId) {
    return (
      <View style={[productStyles.root, { backgroundColor: palette.bg }]}> 
        <Text style={[productStyles.errorText, { color: palette.error || '#E53935' }]}>Shop not specified.</Text>
      </View>
    );
  }

  return (
    <View style={[productStyles.root, { backgroundColor: palette.bg }]}> 
      <View style={[productStyles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}> 
        <Pressable onPress={() => navigation.goBack()} style={productStyles.headerBack}> 
          <KISIcon name="arrow-left" size={20} color={palette.primaryStrong} />
        </Pressable>
        <View style={productStyles.headerTitleWrap}>
          <Text style={[productStyles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {titleText}
          </Text>
          <Text style={[productStyles.headerSubtitle, { color: palette.subtext }]}>Products from this shop</Text>
        </View>
      </View>
      {error ? (
        <View style={productStyles.errorBox}>
          <Text style={[productStyles.errorText, { color: palette.error || '#E53935' }]}>{error}</Text>
          <KISButton title="Retry" size="sm" onPress={() => loadProducts(undefined, true)} />
        </View>
      ) : null}
      {loading && !products.length ? (
        <View style={productStyles.loader}> 
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, index) => String(item.id ?? `shop-product-${index}`)}
          renderItem={renderProductItem}
          contentContainerStyle={productStyles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListFooterComponent={
            loadingMore ? (
              <View style={productStyles.footer}> 
                <ActivityIndicator color={palette.primaryStrong} />
              </View>
            ) : null
          }
          ListEmptyComponent={!loading ? (
            <View style={productStyles.emptyState}>
              <Text style={[productStyles.emptyText, { color: palette.subtext }]}>No products published by this shop yet.</Text>
            </View>
          ) : null}
        />
      )}
    </View>
  );
};

const productStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 12,
    padding: 12,
    gap: 10,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  priceTag: {
    fontSize: 18,
    fontWeight: '900',
  },
  comparePrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  secondaryText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  actionButton: {
    marginRight: 8,
    marginTop: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  footer: {
    padding: 14,
    alignItems: 'center',
  },
  errorBox: {
    padding: 14,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShopProductsPage;
