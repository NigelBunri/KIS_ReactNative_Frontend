import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
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
import { getRequest } from '@/network/get';
import { frontendKiscMajorToBackendCents } from '@/utils/currency';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type CartsListNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'CartsList'
>;

const CartsListPage = () => {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
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
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shippingModalCart, setShippingModalCart] = useState<ShopCart | null>(null);
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(false);

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

  const buildNormalizedItems = useCallback((cart: ShopCart) => {
    return cart.items.map(item => {
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
  }, []);

  const submitOrder = useCallback(async (
    cart: ShopCart,
    shipping?: { addressId: string; shippingMethodId: string },
  ) => {
    const totalValue = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const normalizedItems = buildNormalizedItems(cart);

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
      if (shipping) {
        metadata.address_id = shipping.addressId;
        metadata.shipping_method_id = shipping.shippingMethodId;
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
        // The order is created in a payment-pending state whenever the
        // buyer isn't paying from their KIS wallet (the normal USD/
        // provider-checkout path - see place_marketplace_order on the
        // backend) - it already creates a real DirectPaymentIntent and
        // returns its payment_url/next_action right here in the create
        // response. This used to just say "Order placed" and stop,
        // leaving the order sitting unpaid forever with nothing telling
        // the buyer a payment step still existed.
        const order = response.data;
        const nextAction = order?.next_action;
        const paymentUrl = order?.payment_url;
        if (nextAction?.code === 'open_checkout' && paymentUrl) {
          setOrderFeedback(prev => ({
            ...prev,
            [cart.shopId]: {
              type: 'success',
              message: 'Redirecting to secure checkout to complete payment…',
            },
          }));
          Linking.openURL(paymentUrl).catch(() => {
            setOrderFeedback(prev => ({
              ...prev,
              [cart.shopId]: {
                type: 'error',
                message: 'Order created, but the checkout page could not be opened. Open it from My Orders.',
              },
            }));
          });
        } else {
          setOrderFeedback(prev => ({
            ...prev,
            [cart.shopId]: {
              type: 'success',
              message: `Order placed for ${cart.shopName ?? 'your shop'}.`,
            },
          }));
        }
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
  }, [buildNormalizedItems]);

  const closeShippingModal = useCallback(() => {
    setShippingModalCart(null);
    setShippingAddresses([]);
    setSelectedAddressId(null);
    setShippingOptions([]);
    setSelectedMethodId(null);
  }, []);

  const loadShippingOptionsForAddress = useCallback(async (cart: ShopCart, addressId: string) => {
    setShippingOptionsLoading(true);
    setShippingOptions([]);
    setSelectedMethodId(null);
    const response = await postRequest(ROUTES.commerce.shippingOptions, {
      shop_id: cart.shopId,
      address_id: addressId,
      items: buildNormalizedItems(cart),
    }, { errorMessage: 'Unable to load shipping options.' });
    setShippingOptionsLoading(false);
    if (response.success) {
      const options = response.data?.options ?? [];
      setShippingOptions(options);
      if (options.length) setSelectedMethodId(options[0].shipping_method_id);
    }
  }, [buildNormalizedItems]);

  // Entry point for the "Place order" button - checks whether this buyer has
  // a saved address and this shop has any shipping configured for it at
  // all. If either is missing, checkout proceeds exactly as it always has
  // (place_marketplace_order treats shipping as fully optional), so shops
  // that haven't set up shipping yet, and buyers with no saved address, are
  // completely unaffected rather than being blocked.
  const handlePlaceOrder = useCallback(async (cart: ShopCart) => {
    if (!cart?.items?.length) {
      setOrderFeedback(prev => ({
        ...prev,
        [cart.shopId]: { type: 'error', message: 'This cart is empty.' },
      }));
      return;
    }

    const addressResponse = await getRequest(ROUTES.commerce.addresses, {
      errorMessage: 'Unable to load your addresses.',
    });
    const addresses = addressResponse.success
      ? (Array.isArray(addressResponse.data) ? addressResponse.data : addressResponse.data?.results ?? [])
      : [];

    if (!addresses.length) {
      // No saved address at all - ship-less checkout is still valid for
      // shops with no shipping configured, and for shops that do require
      // it the server will reject with a clear "address_id required"
      // error the buyer can act on from the feedback message.
      await submitOrder(cart);
      return;
    }

    const defaultAddress = addresses.find((a: any) => a.is_default) ?? addresses[0];
    setShippingAddresses(addresses);
    setSelectedAddressId(defaultAddress.id);
    setShippingModalCart(cart);
    await loadShippingOptionsForAddress(cart, defaultAddress.id);
  }, [submitOrder, loadShippingOptionsForAddress]);

  const handleConfirmShipping = useCallback(async () => {
    if (!shippingModalCart) return;
    const cart = shippingModalCart;
    const shipping = selectedAddressId && selectedMethodId
      ? { addressId: selectedAddressId, shippingMethodId: selectedMethodId }
      : undefined;
    closeShippingModal();
    await submitOrder(cart, shipping);
  }, [shippingModalCart, selectedAddressId, selectedMethodId, closeShippingModal, submitOrder]);

  const handleSkipShipping = useCallback(async () => {
    if (!shippingModalCart) return;
    const cart = shippingModalCart;
    closeShippingModal();
    await submitOrder(cart);
  }, [shippingModalCart, closeShippingModal, submitOrder]);

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
          >{`${totalValue.toFixed(2)} USD`}</Text>
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
                    : palette.danger,
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
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
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
      {ordersLoading && carts.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
        </View>
      ) : (
        <FlatList
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          data={carts}
          keyExtractor={item => item.shopId}
          renderItem={({ item }) => renderCart(item)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No active carts.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={Boolean(shippingModalCart)}
        animationType="slide"
        transparent
        onRequestClose={closeShippingModal}
      >
        <View style={styles.shippingModalOverlay}>
          <View style={[styles.shippingModalCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              Choose delivery
            </Text>
            <Text style={[styles.headerSubtitle, { color: palette.subtext, marginBottom: 12 }]}>
              {shippingModalCart?.shopName ?? 'This shop'}
            </Text>

            <Text style={[styles.shippingSectionLabel, { color: palette.subtext }]}>
              Delivery address
            </Text>
            {shippingAddresses.map(address => (
              <Pressable
                key={address.id}
                style={[
                  styles.shippingOptionRow,
                  {
                    borderColor: selectedAddressId === address.id ? palette.primaryStrong : palette.divider,
                    backgroundColor: palette.surfaceElevated,
                  },
                ]}
                onPress={() => {
                  setSelectedAddressId(address.id);
                  if (shippingModalCart) void loadShippingOptionsForAddress(shippingModalCart, address.id);
                }}
              >
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  {address.label ? `${address.label} · ` : ''}{address.recipient_name}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }} numberOfLines={1}>
                  {[address.street_address, address.city, address.country].filter(Boolean).join(', ')}
                </Text>
              </Pressable>
            ))}

            <Text style={[styles.shippingSectionLabel, { color: palette.subtext, marginTop: 10 }]}>
              Shipping method
            </Text>
            {shippingOptionsLoading ? (
              <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 12 }} />
            ) : shippingOptions.length ? (
              shippingOptions.map(option => (
                <Pressable
                  key={option.shipping_method_id}
                  style={[
                    styles.shippingOptionRow,
                    {
                      borderColor: selectedMethodId === option.shipping_method_id ? palette.primaryStrong : palette.divider,
                      backgroundColor: palette.surfaceElevated,
                    },
                  ]}
                  onPress={() => setSelectedMethodId(option.shipping_method_id)}
                >
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>
                    {option.shipping_method_name} · {(option.cost_cents / 100).toFixed(2)} USD
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Estimated {option.estimated_delivery_min} to {option.estimated_delivery_max}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>
                This shop hasn't configured shipping for this address yet - you can still place the order and arrange delivery directly.
              </Text>
            )}

            <View style={styles.shippingModalActions}>
              <KISButton title="Skip shipping" variant="ghost" onPress={handleSkipShipping} />
              <KISButton
                title="Confirm & place order"
                onPress={handleConfirmShipping}
                disabled={shippingOptions.length > 0 && !selectedMethodId}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    shippingModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    shippingModalCard: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '80%',
    },
    shippingSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    shippingOptionRow: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
      marginBottom: 8,
    },
    shippingModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 12,
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
