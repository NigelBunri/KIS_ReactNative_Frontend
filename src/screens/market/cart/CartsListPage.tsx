import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import {
  getShopCartState,
  ShopCart,
  subscribeToShopCart,
  refreshShopCartForShop,
  setShopCartStatus,
} from '@/screens/market/cart/shopCartManager';
import { KIS_COIN_CODE } from '@/screens/market/market.constants';
import { getRequest } from '@/network/get';
import { frontendKiscMajorToBackendCents } from '@/utils/currency';

type CartsListNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'CartsList'
>;

const CartsListPage = () => {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const navigation = useNavigation<CartsListNavigation>();
  const [cartState, setCartState] = useState(getShopCartState());
  const [orderLoadingShopId, setOrderLoadingShopId] = useState<string | null>(
    null,
  );
  const [orderFeedback, setOrderFeedback] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({});
  const [orderPlacedShops, setOrderPlacedShops] = useState<
    Record<string, boolean>
  >({});
  const [, setOrdersLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToShopCart(setCartState);
    return () => {
      unsubscribe();
    };
  }, []);

  const carts = useMemo(
    () => Object.values(cartState.carts),
    [cartState.carts],
  );

  const loadMarketplaceOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await getRequest(ROUTES.commerce.marketplaceOrders, {
        errorMessage: 'Unable to load marketplace orders.',
      });
      if (response.success) {
        const payload = response.data;
        const data = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        const shopsWithOrders: Record<string, boolean> = {};
        data.forEach((order: any) => {
          const shopRef = order?.shop;
          const shopId =
            typeof shopRef === 'string'
              ? shopRef
              : shopRef?.id
              ? shopRef.id
              : shopRef?.shop_id
              ? shopRef.shop_id
              : null;
          if (!shopId) return;
          if ((order?.status ?? '').toLowerCase() === 'cancelled') return;
          shopsWithOrders[shopId] = true;
        });
        setOrderPlacedShops(shopsWithOrders);
      }
    } catch {
      // ignore for now
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarketplaceOrders();
  }, [cartState.carts, loadMarketplaceOrders]);

  useEffect(() => {
    Object.entries(cartState.carts).forEach(([shopId, cart]) => {
      if (!cart) return;
      if (orderPlacedShops[shopId]) return;
      if (cart.status === 'checked_out') {
        void setShopCartStatus(shopId, 'active');
      }
    });
  }, [cartState.carts, orderPlacedShops]);

  const handlePlaceOrder = useCallback(async (cart: ShopCart) => {
    if (!cart?.items?.length) {
      setOrderFeedback(prev => ({
        ...prev,
        [cart.shopId]: { type: 'error', message: 'This cart is empty.' },
      }));
      return;
    }

    const totalValue = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const normalizedItems = cart.items.map(item => {
      const quantity = Math.max(1, Math.floor(item.quantity));
      const unitPriceCents = Math.max(
        1,
        frontendKiscMajorToBackendCents(item.price),
      );
      return {
        product_id: item.productId,
        variant_id: item.variantId ?? '',
        quantity,
        unit_price_cents: unitPriceCents,
        selected_attributes: item.selectedAttributes ?? {},
        custom_description: item.customDescription ?? '',
      };
    });

    setOrderLoadingShopId(cart.shopId);
    setOrderFeedback(prev => ({
      ...prev,
      [cart.shopId]: { type: 'success', message: '' },
    }));

    try {
      const metadata: Record<string, unknown> = {
        source: 'cart_place_order',
        shop_name: cart.shopName,
        cart_items: cart.items.length,
        cart_total_amount: Number(totalValue.toFixed(2)),
      };
      if (cart.remoteCartId) {
        metadata.cart_id = cart.remoteCartId;
      }
      const response = await postRequest(
        ROUTES.commerce.marketplaceOrders,
        {
          shop_id: cart.shopId,
          items: normalizedItems,
          metadata,
        },
        {
          errorMessage: 'Unable to place this order.',
        },
      );

      if (response.success) {
        setOrderFeedback(prev => ({
          ...prev,
          [cart.shopId]: {
            type: 'success',
            message: `Order placed for ${cart.shopName ?? 'your shop'}.`,
          },
        }));
        setOrderPlacedShops(prev => ({ ...prev, [cart.shopId]: true }));
        void setShopCartStatus(cart.shopId, 'checked_out');
        void refreshShopCartForShop(cart.shopId);
      } else {
        setOrderFeedback(prev => ({
          ...prev,
          [cart.shopId]: {
            type: 'error',
            message: response.message || 'Unable to place this order.',
          },
        }));
      }
    } catch (orderError: any) {
      setOrderFeedback(prev => ({
        ...prev,
        [cart.shopId]: {
          type: 'error',
          message: orderError?.message || 'Unable to place this order.',
        },
      }));
    } finally {
      setOrderLoadingShopId(null);
    }
  }, []);

  const renderCart = (cart: ShopCart) => {
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const formattedUsd = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(totalValue);
    return (
      <Pressable
        key={cart.shopId}
        onPress={() =>
          navigation.navigate('CartDetail', {
            shopId: cart.shopId,
            shopName: cart.shopName,
          })
        }
        style={[styles.card, { backgroundColor: palette.surfaceElevated }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.shopInfo}>
            {cart.shopImage ? (
              <Image
                source={{ uri: cart.shopImage }}
                style={styles.shopAvatar}
              />
            ) : (
              <View
                style={[
                  styles.shopAvatar,
                  {
                    backgroundColor: palette.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <KISIcon name="shop" size={22} color={palette.subtext} />
              </View>
            )}
            <View style={styles.shopTextWrap}>
              <Text
                style={[styles.shopName, { color: palette.text }]}
                numberOfLines={1}
              >
                {cart.shopName ?? 'Shop cart'}
              </Text>
              <Text
                style={[styles.shopSubtitle, { color: palette.subtext }]}
                numberOfLines={2}
              >
                {cart.shopDescription ?? 'Products you saved for later.'}
              </Text>
            </View>
          </View>
          <View style={styles.metaWrap}>
            <Text
              style={[styles.shopMeta, { color: palette.subtext }]}
            >{`${itemCount} item${itemCount === 1 ? '' : 's'}`}</Text>
            <Text style={[styles.shopMeta, { color: palette.subtext }]}>
              {formattedUsd}
            </Text>
          </View>
        </View>
        <View style={styles.footerRow}>
          <Text
            style={[styles.total, { color: palette.primaryStrong }]}
          >{`${totalValue.toFixed(2)} ${KIS_COIN_CODE}`}</Text>
          <View style={styles.footerButtons}>
            <KISButton
              size="xs"
              title="View items"
              variant="outline"
              style={styles.footerButton}
              onPress={() =>
                navigation.navigate('CartDetail', {
                  shopId: cart.shopId,
                  shopName: cart.shopName,
                })
              }
            />
            {!orderPlacedShops[cart.shopId] ? (
              <KISButton
                size="xs"
                title="Place order"
                variant="secondary"
                style={styles.footerButton}
                onPress={() => handlePlaceOrder(cart)}
                loading={orderLoadingShopId === cart.shopId}
              />
            ) : (
              <KISButton
                size="xs"
                title="View orders"
                variant="ghost"
                style={styles.footerButton}
                onPress={() => navigation.navigate('MarketplaceOrders')}
              />
            )}
          </View>
        </View>
        {orderFeedback[cart.shopId] ? (
          <Text
            style={[
              styles.feedbackText,
              {
                color:
                  orderFeedback[cart.shopId]?.type === 'success'
                    ? palette.success
                    : palette.error || '#E53935',
              },
            ]}
          >
            {orderFeedback[cart.shopId]?.message}
          </Text>
        ) : null}
        {orderPlacedShops[cart.shopId] ? (
          <Text style={[styles.feedbackText, { color: palette.subtext }]}>
            Order placed—check My Orders for updates.
          </Text>
        ) : null}
        <Text style={[styles.previewLabel, { color: palette.subtext }]}>
          Tap the card to review its items.
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.header,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Your carts
          </Text>
          <Text style={[styles.headerSubtitle, { color: palette.subtext }]}>
            Each shop keeps its own cart.
          </Text>
        </View>
        <Text style={[styles.headerCaption, { color: palette.subtext }]}>
          Tap a card to review its items.
        </Text>
      </View>
      {carts.length ? (
        <FlatList
          data={carts}
          keyExtractor={item => item.shopId}
          renderItem={({ item }) => renderCart(item)}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            You have no carts yet.
          </Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    headerSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    headerCaption: {
      fontSize: 12,
      fontWeight: '600',
    },
    list: {
      padding: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    shopInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    shopAvatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
    },
    shopTextWrap: {
      flex: 1,
    },
    shopName: {
      fontSize: 16,
      fontWeight: '800',
    },
    shopSubtitle: {
      fontSize: 12,
      marginTop: 4,
    },
    metaWrap: {
      alignItems: 'flex-end',
    },
    shopMeta: {
      fontSize: 12,
    },
    footerRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      marginTop: 8,
      gap: 12,
    },
    footerButtons: {
      flexDirection: 'row',
      alignItems: 'stretch',
      flexWrap: 'wrap',
      gap: 8,
      width: '100%',
      marginTop: 4,
    },
    footerButton: {
      flexGrow: 1,
      minWidth: 132,
    },
    total: {
      fontSize: 16,
      fontWeight: '900',
      flexShrink: 1,
    },
    previewLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    feedbackText: {
      fontSize: 12,
      fontWeight: '700',
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
  });

export default CartsListPage;
