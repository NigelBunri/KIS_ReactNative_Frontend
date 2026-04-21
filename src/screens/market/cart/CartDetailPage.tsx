import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import KISButton from '@/constants/KISButton';
import { formatKiscAmount } from '@/utils/currency';
import {
  deleteShopCart,
  getShopCartState,
  removeShopCartItem,
  ShopCart,
  ShopCartItem,
  subscribeToShopCart,
  updateShopCartItem,
} from '@/screens/market/cart/shopCartManager';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { KIS_COIN_CODE } from '@/screens/market/market.constants';

type CartDetailRoute = RouteProp<RootStackParamList, 'CartDetail'>;
type CartDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'CartDetail'>;

const CartDetailPage = () => {
  const { palette } = useKISTheme();
  const navigation = useNavigation<CartDetailNavigation>();
  const route = useRoute<CartDetailRoute>();
  const shopId = route.params?.shopId;
  const shopName = route.params?.shopName;

  const [cartState, setCartState] = useState(getShopCartState());
  const [shopAwaitingSatisfaction, setShopAwaitingSatisfaction] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToShopCart(setCartState);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!shopId) {
      setShopAwaitingSatisfaction(false);
      return;
    }
    (async () => {
      try {
        const response = await getRequest(ROUTES.commerce.marketplaceOrders, {
          params: { shop: shopId },
        });
        if (!active) return;
        if (!response?.success) {
          setShopAwaitingSatisfaction(false);
          return;
        }
        const payload = response.data;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        const hasAwaiting = data.some((entry) => (entry?.status ?? '').toLowerCase() === 'awaiting_satisfaction');
        setShopAwaitingSatisfaction(Boolean(hasAwaiting));
      } catch (error) {
        if (active) {
          setShopAwaitingSatisfaction(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [shopId]);

  const cart = useMemo(() => (shopId ? cartState.carts[shopId] : undefined), [cartState.carts, shopId]);
  const items = cart?.items ?? [];
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartIsCheckedOut = cart?.status === 'checked_out';

  const handleQuantityChange = useCallback(
    (item: ShopCartItem, delta: number) => {
      void updateShopCartItem(shopId ?? '', item.id, { quantity: item.quantity + delta });
    },
    [shopId],
  );

  const handleUpdateOption = useCallback(
    (item: ShopCartItem, kind: 'size' | 'color', value: string) => {
      if (kind === 'size' && value === item.size) return;
      if (kind === 'color' && value === item.color) return;
      void updateShopCartItem(shopId ?? '', item.id, { [kind]: value });
    },
    [shopId],
  );

  const handleRemove = useCallback(
    (item: ShopCartItem) => {
      void removeShopCartItem(shopId ?? '', item.id);
    },
    [shopId],
  );

  const handleViewProduct = useCallback(
    (item: ShopCartItem) => {
      if (!item.productId) return;
      navigation.navigate('ProductDetail', {
        productId: item.productId,
        variantId: item.variantId ?? undefined,
      });
    },
    [navigation],
  );

  const handleDeleteCart = useCallback(() => {
    if (!shopId) return;
    Alert.alert('Delete cart', 'Remove all items from this shop cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteShopCart(shopId);
          navigation.goBack();
        },
      },
    ]);
  }, [navigation, shopId]);

  const renderOptionChips = (item: ShopCartItem, kind: 'size' | 'color', options?: string[]) => {
    if (!options?.length) return null;
    return (
      <View style={cartDetailStyles.optionRow}> 
        <Text style={[cartDetailStyles.optionLabel, { color: palette.subtext }]}>
          {kind === 'size' ? 'Size' : 'Color'}
        </Text>
        <View style={cartDetailStyles.chipRow}>
          {options.map((value) => (
            <Pressable
              key={value}
              style={
                value === (kind === 'size' ? item.size : item.color)
                  ? [cartDetailStyles.optionChip, { borderColor: palette.primaryStrong, backgroundColor: `${palette.primaryStrong}20` }]
                  : [cartDetailStyles.optionChip, { borderColor: palette.divider, backgroundColor: palette.surface }]
              }
              onPress={() => handleUpdateOption(item, kind, value)}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  if (!shopId) {
    return (
      <View style={[cartDetailStyles.root, { backgroundColor: palette.bg, padding: 16 }]}> 
        <Text style={[cartDetailStyles.errorText, { color: palette.error || '#E53935' }]}>Shop not found.</Text>
        <KISButton title="Go back" size="sm" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={[cartDetailStyles.root, { backgroundColor: palette.bg }]}> 
      <View style={[cartDetailStyles.header, { borderBottomColor: palette.divider }]}> 
        <Text style={[cartDetailStyles.headerTitle, { color: palette.text }]}>Cart · {shopName ?? 'Shop'}</Text>
        <Text style={[cartDetailStyles.headerSubtitle, { color: palette.subtext }]}>{`${items.length} items · ${totalAmount.toFixed(2)} ${KIS_COIN_CODE}`}</Text>
      </View>
      {shopAwaitingSatisfaction ? (
        <View style={[cartDetailStyles.awaitingBanner, { borderColor: palette.primaryLight }]}>
          <Text style={[cartDetailStyles.awaitingBannerText, { color: palette.primaryStrong }]}>
            Provider marked this order complete. Confirm satisfaction within 3 days or file a complaint.
          </Text>
        </View>
      ) : null}
      {!items.length ? (
        <View style={cartDetailStyles.emptyState}>
          <Text style={[cartDetailStyles.emptyText, { color: palette.subtext }]}>This cart is empty.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={cartDetailStyles.content}> 
          {items.map((item) => (
            <View
              key={item.id}
              style={[cartDetailStyles.itemCard, { borderColor: palette.divider, backgroundColor: palette.surfaceElevated }]}
            > 
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={cartDetailStyles.itemImage} />
              ) : null}
              <View style={cartDetailStyles.itemBody}>
                <View style={cartDetailStyles.itemHeader}>
                  <Text style={[cartDetailStyles.itemTitle, { color: palette.text }]} numberOfLines={2}>{item.name ?? 'Product'}</Text>
                  <Text style={[cartDetailStyles.itemPrice, { color: palette.primaryStrong }]}>
                    {formatKiscAmount(item.price * item.quantity)}
                  </Text>
                </View>
                <View style={cartDetailStyles.quantityRow}>
                  {cartIsCheckedOut ? (
                    <Text style={[cartDetailStyles.quantityValue, { color: palette.text }]}>
                      Quantity · {item.quantity}
                    </Text>
                  ) : (
                    <>
                      <KISButton title="-" size="xs" variant="outline" onPress={() => handleQuantityChange(item, -1)} />
                      <Text style={[cartDetailStyles.quantityValue, { color: palette.text }]}>{item.quantity}</Text>
                      <KISButton title="+" size="xs" onPress={() => handleQuantityChange(item, 1)} />
                    </>
                  )}
                  <Text style={[cartDetailStyles.quantityMeta, { color: palette.subtext }]}>
                    {`${formatKiscAmount(item.price)} per item`}
                  </Text>
                </View>
                {!cartIsCheckedOut && renderOptionChips(item, 'size', item.availableSizes)}
                {!cartIsCheckedOut && renderOptionChips(item, 'color', item.availableColors)}
                {!cartIsCheckedOut && (
                  <KISButton
                    title="Remove item"
                    size="xs"
                    variant="outline"
                    onPress={() => handleRemove(item)}
                    style={{ marginTop: 8 }}
                  />
                )}
                <KISButton
                  title="View product"
                  size="xs"
                  variant="secondary"
                  onPress={() => handleViewProduct(item)}
                  style={{ marginTop: 6 }}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={cartDetailStyles.footer}> 
        <Text style={[cartDetailStyles.footerText, { color: palette.text }]}>
          Total · {formatKiscAmount(totalAmount)}
        </Text>
        <KISButton title="Delete cart" size="sm" variant="outline" onPress={handleDeleteCart} />
      </View>
    </View>
  );
};

const cartDetailStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  awaitingBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  awaitingBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 12,
    paddingBottom: 100,
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  itemBody: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  quantityMeta: {
    fontSize: 12,
  },
  optionRow: {
    marginTop: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
});

export default CartDetailPage;
