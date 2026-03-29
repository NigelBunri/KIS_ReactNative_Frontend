import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import Skeleton from '@/components/common/Skeleton';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { PickedImage } from '@/screens/tabs/profile/profile.types';
import { KISIcon } from '@/constants/kisIcons';

/**
 * MarketStudioSection.tsx (UPDATED)
 * - Matches futuristic KIS broadcast design language: segmented tabs, elevated cards, pill CTAs.
 * - Adds Live + 19 more features scaffolding specifically for Market + Lessons integration.
 * - Keeps your existing logic (CRUD, tier limits, broadcast product) but reorganizes layout.
 */

type Props = {
  profile: any;
  canUseMarket: boolean;
  onUpgrade?: () => void;
  // Optional: deep-link into a tab from BroadcastFeedSection
  initialTab?: 'feed' | 'shops' | 'products' | 'analytics' | 'drops' | 'lessons';
};

const parseTierLimit = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === '' || cleaned === 'unlimited') return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
};

const MARKET_DIFFERENTIATORS = [
  'Verified shop badges with analytics',
  'Smart product descriptions & tag suggestions',
  'Global discovery feed with search, filters, and trending badges',
  'Auto-pricing alerts when competitors discount similar goods',
  'Custom storefront theming per shop',
  'Flash sale scheduling with countdown timers',
  'Multi-currency display + automatic conversion hints',
  'Bundled products (kits and collections)',
  'Customer reviews + verified order badges',
  'Dynamic shipping estimate builder',
  'Promo codes + loyalty point rules',
  'Live chat / broadcast integration for product drops',
  'Inventory alerts & restock reminders',
  'Abandoned cart recovery notes',
  'Revenue dashboards + payout exports',
];

const MARKET_ANALYTICS_FEATURES = [
  'Real-time revenue dashboards stratified by shop and partner tiers',
  'Credit flow snapshots (earned vs spent) updated every minute',
  'Geo + timezone heatmaps showing engagement spikes across regions',
  'Inventory velocity forecasting with auto-restock triggers',
  'Data-driven pricing elasticity curves for premium drops',
  'Live conversion rates and attendee retention per broadcast',
  'Segmented subscription churn risk scoring by shop',
  'Automated compliance flags with VIP contact tracing',
  'Trend signals for credit-backed kit launches',
  'Sentiment analysis on product chatter and broadcast comments',
  'Revenue impact modelling for exclusive lessons or drops',
  'Creator ranking leaderboards by total credits generated',
  'Product bundling performance insights with ROI estimates',
  'Marketplace health overview including fraud & authenticity cues',
  'Follower growth and loyalty lift metrics across channels',
  'Custom KPI boards (sales, enrollments, credits) with share links',
  'Video + broadcast attribution per promoted product',
  'Auto-generated highlight reels summarizing credit peaks',
  'Audience geography matrix for global lesson attractions',
  'Actionable alerts for supply shortages or fulfillment delays',
];

const MARKET_POWER_FEATURES = [
  'Subscribe to product alerts and receive in-app credit notifications',
  'Join a shop to unlock exclusive drops, member-only feeds, and briefs',
  'Credit-only checkout keeps experience cash-free and auditable',
  'Broadcast-integrated carts let you buy while watching a drop',
  'Portfolio-based shop layouts with curated kit showcases',
  'Automated bundling suggestions for cross-shop exposure',
  'Authenticity badges with real-time verification',
  'Live fraud scoring plus moderation cues on every checkout',
  'Dynamic promo codes tied to loyalty tiers and analytics',
  'Community highlights for trending products and testimonials',
];

/**
 * ✅ Live Broadcast + 19 more market/lesson-oriented features (scaffold list)
 * You can hook these to backend gradually without changing UI again.
 */
const MARKET_PLATFORM_FEATURES = [
  'Live product drops (LIVE badge + broadcast studio entry)',
  'Scheduled drops with countdown timers',
  'Limited stock badges (Only X left)',
  'Trending products sort',
  'Saved products (wishlist)',
  'Creator/Shop follow',
  'Shop verification badge (tier-based)',
  'Bundles / kits support',
  'Promo codes & loyalty rules UI',
  'Flash sale toggles',
  'Abandoned cart nudges (copy hooks)',
  'Product reviews UI stub',
  'Delivery estimate chip',
  'Price change alerts subscription',
  'Drop replay videos linked to broadcasts',
  'Lesson + product bundles (course kits)',
  'Shop membership tiers',
  'Auto-approve join policy UI',
  'Multi-currency display hint chip',
  'Insights shortcut + KPI cards',
] as const;

type MarketTabId = 'feed' | 'drops' | 'shops' | 'products' | 'analytics' | 'lessons';

const MARKET_TABS: { id: MarketTabId; label: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', icon: 'spark' },
  { id: 'drops', label: 'Drops', icon: 'radio' },
  { id: 'shops', label: 'Shops', icon: 'store' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'analytics', label: 'Insights', icon: 'chart' },
  { id: 'lessons', label: 'Lessons', icon: 'book' },
];

const normalizeEmployeeSlots = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return '1';
  }
  return String(Math.floor(parsed));
};

export default function MarketStudioSection({
  profile,
  canUseMarket,
  onUpgrade,
  initialTab = 'feed',
}: Props) {
  const { palette } = useKISTheme();
  const normalizedProfileUserId = useMemo(() => {
    const id = profile?.user?.id;
    return id ? String(id) : null;
  }, [profile?.user?.id]);

  const isShopOwnedByUser = useCallback(
    (owner?: string | null) => {
      if (!normalizedProfileUserId || !owner) {
        return false;
      }
      return normalizedProfileUserId === String(owner);
    },
    [normalizedProfileUserId],
  );

  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [shopForm, setShopForm] = useState({
    name: '',
    description: '',
    employeeSlots: '1',
  });

  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    currency: 'USD',
    stock: '',
    description: '',
  });

  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [marketplaceProducts, setMarketplaceProducts] = useState<any[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const [shopImage, setShopImage] = useState<PickedImage | null>(null);
  const [shopImagePreview, setShopImagePreview] = useState('');
  const [productImage, setProductImage] = useState<PickedImage | null>(null);
  const [productImagePreview, setProductImagePreview] = useState('');

  const [activeMarketTab, setActiveMarketTab] = useState<MarketTabId>(initialTab);

  const tierFeatures = useMemo(() => profile?.tier?.features_json ?? {}, [profile?.tier?.features_json]);
  const isMarketPro = Boolean(tierFeatures.market_pro_insights);
  const hasAnalyticsAccess = Boolean(tierFeatures.market_analytics);

  const shopLimit = parseTierLimit(tierFeatures.shops_limit);
  const productLimit = parseTierLimit(tierFeatures.products_per_shop_limit);

  const canCreateShop = shopLimit === null || shops.length < shopLimit;

  const activeShop = useMemo(
    () => shops.find((shop) => shop.id === activeShopId) ?? shops[0] ?? null,
    [shops, activeShopId],
  );

  const productsForActiveShop = useMemo(() => {
    if (!activeShop) return [];
    return products.filter((product) => product.shop === activeShop.id);
  }, [activeShop, products]);

  const canAddProduct =
    Boolean(activeShop) && (productLimit === null || productsForActiveShop.length < productLimit);

  const shopUsage = shopLimit === null ? `${shops.length} shops created` : `${shops.length}/${shopLimit} shops`;
  const productUsage = activeShop
    ? productLimit === null
      ? `${productsForActiveShop.length} listings`
      : `${productsForActiveShop.length}/${productLimit} listings`
    : 'Create a shop to add products';

  const isEditingShop = Boolean(editingShopId);
  const isEditingProduct = Boolean(editingProductId);

  const editingShop = editingShopId ? shops.find((shop) => shop.id === editingShopId) ?? null : null;
  const editingProduct = editingProductId ? products.find((product) => product.id === editingProductId) ?? null : null;

  const resetShopForm = () => {
    setShopForm({ name: '', description: '', employeeSlots: '1' });
    setEditingShopId(null);
    setShopImage(null);
    setShopImagePreview('');
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      price: '',
      currency: 'USD',
      stock: '',
      description: '',
    });
    setEditingProductId(null);
    setProductImage(null);
    setProductImagePreview('');
  };

  const loadMarketplaceFeed = useCallback(async () => {
    setMarketplaceLoading(true);
    const res = await getRequest(ROUTES.commerce.products, {
      errorMessage: 'Unable to load marketplace products.',
    });
    if (res?.success) {
      const payload = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data ?? [];
      setMarketplaceProducts(Array.isArray(payload) ? payload : []);
    }
    setMarketplaceLoading(false);
  }, []);

  const loadMarket = useCallback(async () => {
    if (!profile?.user?.id) return;
    setLoading(true);

    const ownerId = profile.user.id;
    const [shopsRes, productsRes] = await Promise.all([
      getRequest(`${ROUTES.commerce.shops}?owner=${ownerId}`, {
        errorMessage: 'Unable to load shops.',
      }),
      getRequest(`${ROUTES.commerce.products}?owner=${ownerId}`, {
        errorMessage: 'Unable to load products.',
      }),
    ]);

    const shopList = shopsRes?.data?.results ?? shopsRes?.data ?? shopsRes ?? [];
    const productList = productsRes?.data?.results ?? productsRes?.data ?? productsRes ?? [];

    setShops(Array.isArray(shopList) ? shopList : []);
    setProducts(Array.isArray(productList) ? productList : []);
    setLoading(false);
  }, [profile?.user?.id]);

  const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
    if (!asset?.uri) return null;
    const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
    const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
    return {
      uri: asset.uri,
      name,
      type: asset.type || 'image/jpeg',
    };
  };

  const pickShopImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'shop');
    if (!picked) return;
    setShopImage(picked);
    setShopImagePreview(asset?.uri || '');
  }, []);

  const pickProductImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'product');
    if (!picked) return;
    setProductImage(picked);
    setProductImagePreview(asset?.uri || '');
  }, []);

  useEffect(() => {
    loadMarketplaceFeed();
  }, [loadMarketplaceFeed]);

  useEffect(() => {
    if (canUseMarket) loadMarket();
  }, [canUseMarket, loadMarket]);

  useEffect(() => {
    if (!shops.length) {
      setActiveShopId(null);
      return;
    }
    if (!activeShopId || !shops.some((shop) => shop.id === activeShopId)) {
      setActiveShopId(shops[0].id);
    }
  }, [shops, activeShopId]);

  useEffect(() => {
    if (editingShop && editingShopId) {
      setShopForm({
        name: editingShop.name,
        description: editingShop.description || '',
        employeeSlots: String(editingShop.employee_slots ?? 1),
      });
      setShopImagePreview(editingShop.image_url || '');
      setShopImage(null);
    }
  }, [editingShop, editingShopId]);

  useEffect(() => {
    if (editingProduct && editingProductId) {
      setProductForm({
        name: editingProduct.name,
        price: String(editingProduct.price),
        currency: editingProduct.currency || 'USD',
        description: editingProduct.description || '',
        stock: String(editingProduct.stock_qty ?? 0),
      });
      setProductImage(null);
      setProductImagePreview(editingProduct.image_url || '');
    }
  }, [editingProduct, editingProductId]);

  const handleShopSubmit = useCallback(async () => {
    if (!shopForm.name?.trim()) {
      Alert.alert('Market', 'Shop name is required.');
      return;
    }
    if (!isEditingShop && !canCreateShop) {
      Alert.alert('Market', 'You have reached your shop limit.');
      return;
    }

    const shopData = new FormData();
    shopData.append('name', shopForm.name.trim());
    shopData.append('employee_slots', normalizeEmployeeSlots(shopForm.employeeSlots));
    shopData.append('description', shopForm.description.trim());

    if (shopImage) {
      shopData.append(
        'image_file',
        {
          uri: shopImage.uri,
          name: shopImage.name,
          type: shopImage.type,
        } as any,
      );
    }

    const url = isEditingShop ? `${ROUTES.commerce.shops}${editingShopId}/` : ROUTES.commerce.shops;
    const method = isEditingShop ? patchRequest : postRequest;

    const res = await method(url, shopData, {
      errorMessage: isEditingShop ? 'Unable to update shop.' : 'Unable to create shop.',
    });

    if (res?.success) {
      resetShopForm();
      loadMarket();
    }
  }, [shopForm, isEditingShop, editingShopId, canCreateShop, loadMarket, shopImage]);

  const handleProductSubmit = useCallback(async () => {
    if (!productForm.name?.trim() || !productForm.price?.trim()) {
      Alert.alert('Market', 'Product name and price are required.');
      return;
    }

    const targetShopId = editingProduct ? editingProduct.shop : activeShop?.id;
    if (!targetShopId) {
      Alert.alert('Market', 'Create a shop before adding products.');
      return;
    }

    if (!isEditingProduct && !canAddProduct) {
      Alert.alert('Market', 'You have reached your product limit for this shop.');
      return;
    }

    if (!isEditingProduct && !productImage) {
      Alert.alert('Market', 'Product image is required.');
      return;
    }

    const form = new FormData();
    form.append('shop', targetShopId);
    form.append('name', productForm.name.trim());
    form.append('description', productForm.description.trim());
    form.append('price', productForm.price.trim());
    form.append('currency', (productForm.currency || 'USD').trim() || 'USD');
    const stockQty = Math.max(0, Number(productForm.stock || 0));
    form.append('stock_qty', String(Number.isFinite(stockQty) ? Math.floor(stockQty) : 0));

    if (productImage) {
      form.append(
        'image_file',
        {
          uri: productImage.uri,
          name: productImage.name,
          type: productImage.type,
        } as any,
      );
    }

    const url = isEditingProduct ? `${ROUTES.commerce.products}${editingProductId}/` : ROUTES.commerce.products;
    const method = isEditingProduct ? patchRequest : postRequest;

    const res = await method(url, form, {
      errorMessage: isEditingProduct ? 'Unable to update product.' : 'Unable to add product.',
    });

    if (res?.success) {
      resetProductForm();
      loadMarket();
    }
  }, [productForm, editingProduct, activeShop, isEditingProduct, editingProductId, canAddProduct, loadMarket, productImage]);

  const handleBroadcastProduct = async (productId: string) => {
    const res = await postRequest(
      ROUTES.commerce.productBroadcast(productId),
      {},
      { errorMessage: 'Unable to broadcast product.' },
    );
    if (res?.success) {
      Alert.alert('Broadcast', 'Product added to broadcast.');
      DeviceEventEmitter.emit('broadcast.refresh');
    }
  };

  const handleDeleteShop = useCallback(
    async (shopId: string, shopOwner?: string | null) => {
      if (!shopId) return;
      if (!isShopOwnedByUser(shopOwner)) {
        Alert.alert('Delete shop', 'Only the shop owner can delete this shop.');
        return;
      }
      const res = await deleteRequest(`${ROUTES.commerce.shops}${shopId}/`, {
        errorMessage: 'Unable to delete shop.',
      });
      if (res?.success) loadMarket();
    },
    [isShopOwnedByUser, loadMarket],
  );

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      const res = await deleteRequest(`${ROUTES.commerce.products}${productId}/`, {
        errorMessage: 'Unable to delete product.',
      });
      if (res?.success) loadMarket();
    },
    [loadMarket],
  );

  const handleShopEdit = useCallback((shop: any) => {
    setActiveShopId(shop.id);
    setEditingShopId(shop.id);
    setShopForm({
      name: shop.name,
      description: shop.description || '',
      employeeSlots: String(shop.employee_slots ?? 1),
    });
  }, []);

  const handleProductEdit = useCallback((product: any) => {
    setActiveShopId(product.shop);
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      price: String(product.price),
      currency: product.currency || 'USD',
      description: product.description || '',
      stock: String(product.stock_qty ?? 0),
    });
  }, []);

  const cancelShopEdit = () => resetShopForm();
  const cancelProductEdit = () => resetProductForm();

  const handleProductSubscribe = useCallback(
    async (productId: string) => {
      const res = await postRequest(
        ROUTES.commerce.productSubscribe(productId),
        {},
        { errorMessage: 'Unable to subscribe to product.' },
      );
      if (res?.success) {
        Alert.alert('Market', 'You will receive credit alerts when this listing updates.');
        loadMarketplaceFeed();
      }
    },
    [loadMarketplaceFeed],
  );

  const handleJoinShop = useCallback(
    async (shopId: string) => {
      if (!shopId) {
        Alert.alert('Market', 'Shop identifier missing.');
        return;
      }
      const res = await postRequest(
        ROUTES.commerce.shopJoin(shopId),
        {},
        { errorMessage: 'Unable to join shop.' },
      );
      if (res?.success) {
        Alert.alert('Market', 'Shop membership granted; notifications will follow.');
        loadMarket();
        loadMarketplaceFeed();
      }
    },
    [loadMarket, loadMarketplaceFeed],
  );

  const handleGoLiveDrop = () => {
    Alert.alert('Live drop', 'Live product drops studio coming next. (entry wired)');
  };

  if (!canUseMarket) {
    return (
      <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 14, backgroundColor: palette.surface }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Marketplace studio</Text>
        <Text style={{ color: palette.subtext, marginTop: 6 }}>
          Upgrade to a Business tier to open a shop, manage listings, and broadcast products.
        </Text>

        <KISButton title="Upgrade to Business" onPress={onUpgrade ?? (() => {})} style={{ marginTop: 10 }} />

        <View style={{ marginTop: 14, gap: 6 }}>
          <Text style={{ color: palette.text, fontWeight: '900' }}>What you gain</Text>
          {MARKET_DIFFERENTIATORS.map((feature) => (
            <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
              • {feature}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  const TabPills = () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {MARKET_TABS.map((tab) => {
        const active = activeMarketTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveMarketTab(tab.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: active ? palette.primary : palette.divider,
              backgroundColor: active ? palette.primarySoft : palette.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KISIcon name={tab.icon as any} size={14} color={active ? palette.primaryStrong : palette.subtext} />
            <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900' }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const Card = ({ children }: { children: any }) => (
    <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 14, backgroundColor: palette.surface, gap: 10 }}>
      {children}
    </View>
  );

  const Hero = () => (
    <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 20, padding: 14, backgroundColor: palette.chrome }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Market Studio</Text>
      <Text style={{ color: palette.subtext, marginTop: 6 }}>
        Shops, products, drops, and lessons — all integrated with broadcasts.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <Pressable
          onPress={() => {
            loadMarket();
            loadMarketplaceFeed();
          }}
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900' }}>Refresh</Text>
        </Pressable>

        <Pressable
          onPress={handleGoLiveDrop}
          style={{
            borderWidth: 2,
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Go Live Drop</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Feature set', MARKET_PLATFORM_FEATURES.join('\n• '))}
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.subtext, fontWeight: '900' }}>Platform features</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={{ color: palette.subtext, marginTop: 10 }}>Loading studio data…</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 16, padding: 12, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Shops</Text>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>{shops.length}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{shopLimit === null ? 'Unlimited' : shopUsage}</Text>
          </View>
          <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 16, padding: 12, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Products</Text>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>{products.length}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{productLimit === null ? 'Unlimited' : productUsage}</Text>
          </View>
          <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 16, padding: 12, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Insights</Text>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>{hasAnalyticsAccess ? 'On' : 'Off'}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{isMarketPro ? 'Market Pro' : 'Standard'}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderFeedTab = () => (
    <Card>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Marketplace feed</Text>
        <Text style={{ color: palette.subtext }}>
          Browse verified listings. Subscribe for credit alerts, join shops for exclusive drops.
        </Text>
      </View>

      {marketplaceLoading ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Skeleton height={110} radius={16} />
          <Skeleton height={110} radius={16} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {marketplaceProducts.slice(0, 4).map((product) => (
            <View
              key={product.id}
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 12,
                backgroundColor: palette.surface,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      backgroundColor: palette.surface,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      backgroundColor: palette.surfaceElevated,
                    }}
                  />
                )}

                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>{product.name}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {product.price} {product.currency}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Shop: {product.shop_name ?? 'Independent'} · Stock: {product.stock_qty ?? 0}
                  </Text>
                </View>

                <View style={{ borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>TREND</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <KISButton title="Subscribe" size="sm" onPress={() => handleProductSubscribe(product.id)} />
                <KISButton title="Join shop" size="sm" variant="secondary" onPress={() => handleJoinShop(product.shop)} />
                <KISButton title="Save" size="sm" variant="secondary" onPress={() => Alert.alert('Saved', 'Wishlist hook ready.')} />
              </View>

              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                All transactions settle in credits. Keep wallets funded so checkout is instant.
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const renderDropsTab = () => (
    <Card>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Drops (Live + Scheduled)</Text>
      <Text style={{ color: palette.subtext }}>
        Launch limited-time product drops, schedule countdowns, and broadcast them live.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <Pressable
          onPress={handleGoLiveDrop}
          style={{
            borderWidth: 2,
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Go Live Drop</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Schedule', 'Schedule drop UI hook ready.')}
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900' }}>Schedule Drop</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 10, gap: 6 }}>
        {[
          'LIVE badge + viewer count',
          'Countdown timer',
          'Limited stock bar',
          'Drop replay + broadcast link',
          '“Buy while watching” cart',
        ].map((t) => (
          <Text key={t} style={{ color: palette.subtext, fontSize: 12 }}>
            • {t}
          </Text>
        ))}
      </View>
    </Card>
  );

  const renderShopTab = () => (
    <Card>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Shops</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Create, update, or remove stores. Broadcast products and run drops.
      </Text>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <KISButton title={shopImagePreview ? 'Update shop image' : 'Choose shop image'} size="sm" onPress={pickShopImage} />
        {shopImagePreview ? (
          <Image source={{ uri: shopImagePreview }} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: palette.surface }} />
        ) : (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Image recommended</Text>
        )}
      </View>

      {shops.length === 0 ? (
        <Text style={{ color: palette.subtext, marginTop: 10 }}>You don't have a shop yet.</Text>
      ) : (
        <View style={{ gap: 10, marginTop: 10 }}>
          {shops.map((shop) => {
            const isActive = activeShop && shop.id === activeShop.id;
            return (
              <View
                key={shop.id}
                style={{
                  borderWidth: 2,
                  borderColor: isActive ? palette.primary : palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: isActive ? palette.primarySoft : palette.surface,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  {shop.image_url ? (
                    <Image source={{ uri: shop.image_url }} style={{ width: 52, height: 52, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: palette.surfaceElevated }} />
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '900' }}>{shop.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{shop.description}</Text>
                  </View>

                  <View style={{ borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>VERIFIED</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <KISButton title="Select" size="sm" onPress={() => setActiveShopId(shop.id)} />
                  <KISButton title="Edit" size="sm" variant="secondary" onPress={() => handleShopEdit(shop)} />
                  {isShopOwnedByUser(shop.owner) && (
                    <KISButton
                      title="Delete"
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        Alert.alert('Delete shop', 'Remove this shop and all its listings?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => handleDeleteShop(shop.id, shop.owner),
                          },
                        ])
                      }
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
        Shop limit: {shopLimit === null ? 'Unlimited' : shopUsage}
      </Text>

      <View style={{ marginTop: 12, gap: 10 }}>
        <KISTextInput
          label={isEditingShop ? 'Update store name' : 'Store name'}
          value={shopForm.name}
          onChangeText={(t) => setShopForm((prev) => ({ ...prev, name: t }))}
        />
        <KISTextInput
          label="Description"
          value={shopForm.description}
          onChangeText={(t) => setShopForm((prev) => ({ ...prev, description: t }))}
          multiline
          style={{ minHeight: 80 }}
        />
        <KISTextInput
          label="Employee slots"
          value={shopForm.employeeSlots}
          onChangeText={(t) => setShopForm((prev) => ({ ...prev, employeeSlots: t.replace(/[^0-9]/g, '') }))}
          keyboardType="numeric"
        />

        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <KISButton title={isEditingShop ? 'Update shop' : 'Create shop'} onPress={handleShopSubmit} disabled={!isEditingShop && !canCreateShop} />
          {isEditingShop && <KISButton title="Cancel" variant="secondary" size="sm" onPress={cancelShopEdit} />}
        </View>

        {!isEditingShop && shopLimit !== null && !canCreateShop && (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Reach your shop limit ({shopLimit}). Upgrade to Business Pro for unlimited stores.
          </Text>
        )}
      </View>
    </Card>
  );

  const renderProductTab = () => (
    <Card>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Products</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Add or update listings with just the essentials: name, price, stock, and story.
      </Text>

      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Product limit: {productLimit === null ? 'Unlimited' : productUsage}
      </Text>

      <View style={{ marginTop: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <KISButton
            title={productImagePreview ? 'Change image' : isEditingProduct ? 'Upload image' : 'Add image'}
            size="sm"
            onPress={pickProductImage}
          />
          {productImagePreview ? (
            <Image source={{ uri: productImagePreview }} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: palette.surface }} />
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Image required</Text>
          )}
        </View>

        <KISTextInput
          label={isEditingProduct ? 'Edit product name' : 'Product name'}
          value={productForm.name}
          onChangeText={(t) => setProductForm((prev) => ({ ...prev, name: t }))}
        />

        <KISTextInput
          label="Price"
          value={productForm.price}
          onChangeText={(t) => setProductForm((prev) => ({ ...prev, price: t }))}
          keyboardType="numeric"
        />
        <KISTextInput
          label="Currency"
          value={productForm.currency}
          onChangeText={(t) => setProductForm((prev) => ({ ...prev, currency: t }))}
        />

        <KISTextInput
          label="Stock"
          value={productForm.stock}
          onChangeText={(t) => setProductForm((prev) => ({ ...prev, stock: t }))}
          keyboardType="numeric"
        />

        <KISTextInput
          label="Description"
          value={productForm.description}
          onChangeText={(t) => setProductForm((prev) => ({ ...prev, description: t }))}
          multiline
          style={{ minHeight: 80 }}
        />

        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <KISButton
            title={isEditingProduct ? 'Update product' : 'Add product'}
            onPress={handleProductSubmit}
            disabled={!isEditingProduct && !canAddProduct}
          />
          {isEditingProduct && <KISButton title="Cancel" variant="secondary" size="sm" onPress={cancelProductEdit} />}
        </View>

        {!isEditingProduct && productLimit !== null && !canAddProduct && (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            You've maxed {productLimit} items for this shop. Upgrade to Business Pro for a larger catalog.
          </Text>
        )}
      </View>

      <View style={{ marginTop: 14, gap: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Manage listings</Text>

        {productsForActiveShop.length === 0 ? (
          <Text style={{ color: palette.subtext }}>Add items to see them here.</Text>
        ) : (
          productsForActiveShop.map((product) => (
            <View
              key={product.id}
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 12,
                gap: 8,
                backgroundColor: palette.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>{product.name}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {product.price} {product.currency} · Stock: {product.stock_qty ?? 0}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <KISButton title="Edit" size="sm" variant="secondary" onPress={() => handleProductEdit(product)} />
                  <KISButton
                    title="Delete"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      Alert.alert('Delete product', 'Remove this listing and stop broadcasting it?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteProduct(product.id) },
                      ])
                    }
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <KISButton title="Broadcast" size="sm" onPress={() => handleBroadcastProduct(product.id)} />
                <KISButton title="Schedule" size="sm" variant="secondary" onPress={() => Alert.alert('Schedule', 'Drop scheduling hook ready.')} />
                <KISButton title="Pin" size="sm" variant="secondary" onPress={() => Alert.alert('Pinned', 'Pin hook ready.')} />
              </View>
            </View>
          ))
        )}
      </View>
    </Card>
  );

  const renderAnalyticsTab = () => (
    <Card>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Market intelligence</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        {hasAnalyticsAccess ? 'Analytics are active; insights reflect your tier.' : 'Upgrade to Business Pro to unlock Market Pro intelligence.'}
      </Text>

      <View style={{ gap: 6, marginTop: 10 }}>
        {MARKET_ANALYTICS_FEATURES.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>

      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Power features</Text>
        {MARKET_POWER_FEATURES.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>

      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>Studio differentiators</Text>
        {MARKET_DIFFERENTIATORS.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>

      {!isMarketPro && (
        <KISButton title="Unlock Market Pro" onPress={onUpgrade ?? (() => {})} style={{ marginTop: 12 }} />
      )}
    </Card>
  );

  const renderLessonsTab = () => (
    <Card>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Lessons + Market</Text>
      <Text style={{ color: palette.subtext }}>
        Bundle products with lessons, promote kits, and run live classrooms with drop-integrated carts.
      </Text>

      <View style={{ marginTop: 10, gap: 6 }}>
        {[
          'Lesson-linked product kits (starter packs)',
          'Premium lessons with shop membership gating',
          'Live lesson broadcasts with chat and replays',
          'Analytics: enrollments + credit conversion',
          'Broadcast a lesson as a featured drop',
        ].map((t) => (
          <Text key={t} style={{ color: palette.subtext, fontSize: 12 }}>
            • {t}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => Alert.alert('Lesson studio', 'Lesson creation flow coming next.')}
          style={{ borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Create Lesson</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Attach kit', 'Attach product kit hook ready.')}
          style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text style={{ color: palette.text, fontWeight: '900' }}>Attach Kit</Text>
        </Pressable>
      </View>
    </Card>
  );

  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      <Hero />
      <TabPills />

      {activeMarketTab === 'feed' && renderFeedTab()}
      {activeMarketTab === 'drops' && renderDropsTab()}
      {activeMarketTab === 'shops' && renderShopTab()}
      {activeMarketTab === 'products' && renderProductTab()}
      {activeMarketTab === 'analytics' && renderAnalyticsTab()}
      {activeMarketTab === 'lessons' && renderLessonsTab()}
    </View>
  );
}
