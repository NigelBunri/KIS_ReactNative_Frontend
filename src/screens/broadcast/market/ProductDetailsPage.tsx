import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  KIS_COIN_CODE,
  KIS_TO_USD_RATE,
} from '@/screens/market/market.constants';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import {
  addToShopCart,
  buildCartProductIndex,
  cartHasProduct,
  cartHasProductVariant,
  CartProductVariantIndex,
  getShopCartState,
  refreshShopCartFromBackend,
  refreshShopCartForShop,
  ShopCartAddResult,
  ShopCartItemPayload,
  subscribeToShopCart,
} from '@/screens/market/cart/shopCartManager';
import { incrementProductViewCount } from '@/utils/productViewCounts';
import {
  collectProductImageUris,
  resolveProductImageUri,
} from '@/utils/productImages';

const normalizeListInput = (value?: string[] | string | null) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

type VariantRecord = {
  id?: string;
  size?: string;
  color?: string;
  sku?: string;
  price?: string | number;
  stock_qty?: number;
  image_url?: string | null;
};

type ShopReference = string | { id?: string; name?: string };

type CatalogCategory = {
  id?: string | number;
  name?: string;
};

type ProductAttributes = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

type ProductDetail = {
  id?: string | number;
  shop?: ShopReference;
  shop_id?: string;
  shop_name?: string;
  name?: string;
  description?: string;
  price?: number | string;
  sale_price?: number | string;
  compare_at_price?: number | string;
  currency?: string;
  stock_qty?: number;
  requires_shipping?: boolean;
  pickup_available?: boolean;
  allow_backorder?: boolean;
  inventory_type?: string;
  category?: { name?: string };
  catalog_categories?: CatalogCategory[];
  condition?: string;
  fit?: string;
  size_guide?: string;
  available_sizes?: string[] | string | null;
  available_colors?: string[] | string | null;
  variants?: VariantRecord[];
  images?: (
    | string
    | { image_url?: string | null; image_file?: string | null }
  )[];
  featured_image?: string | null;
  image_url?: string | null;
  low_stock_threshold?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  weight?: number | string | null;
  attributes?: ProductAttributes | null;
};

const formatAttributeLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .replace(/^./, char => char.toUpperCase());

const resolveProductShopId = (product: ProductDetail | null): string => {
  if (!product) return '';
  const { shop } = product;

  if (shop) {
    if (typeof shop === 'string') {
      const trimmed = shop.trim();
      if (trimmed) return trimmed;
    } else if (typeof shop === 'object' && shop?.id) {
      const trimmed = String(shop.id).trim();
      if (trimmed) return trimmed;
    }
  }

  if (typeof product.shop_id === 'string') {
    const trimmedId = product.shop_id.trim();
    if (trimmedId) return trimmedId;
  }

  return '';
};

const resolveProductShopLabel = (product: ProductDetail | null): string => {
  if (!product) return 'this shop';
  if (product.shop_name) return product.shop_name;

  const shop = product.shop;
  if (shop && typeof shop === 'object' && shop.name) {
    return shop.name;
  }

  return 'this shop';
};

type ProductDetailRoute = RouteProp<RootStackParamList, 'ProductDetail'>;
type ProductDetailNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ProductDetail'
>;

export default function ProductDetailsPage() {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const navigation = useNavigation<ProductDetailNavigation>();
  const route = useRoute<ProductDetailRoute>();
  const detailProductId = route.params?.productId;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [, setCartSynced] = useState(false);
  const [selectedAttributeOptions, setSelectedAttributeOptions] = useState<
    Record<string, string[]>
  >({});
  const [customDescription, setCustomDescription] = useState('');
  const [cartProductIndex, setCartProductIndex] =
    useState<CartProductVariantIndex>(() =>
      buildCartProductIndex(getShopCartState()),
    );
  const [cartState, setCartState] = useState(getShopCartState());

  const variants = useMemo<VariantRecord[]>(
    () =>
      (product?.variants ?? []).map(variant => ({
        ...variant,
        size: variant.size ?? '',
        color: variant.color ?? '',
        price: variant.price ?? '0',
        stock_qty: variant.stock_qty ?? 0,
      })),
    [product],
  );

  const variantMatchesSelection = useCallback(
    (variant: VariantRecord) => {
      if (
        selectedSize &&
        variant.size &&
        variant.size.trim().toLowerCase() !== selectedSize.trim().toLowerCase()
      ) {
        return false;
      }

      if (
        selectedColor &&
        variant.color &&
        variant.color.trim().toLowerCase() !==
          selectedColor.trim().toLowerCase()
      ) {
        return false;
      }

      return true;
    },
    [selectedSize, selectedColor],
  );

  const metadataSizes = useMemo(
    () => normalizeListInput(product?.available_sizes ?? []),
    [product],
  );

  const metadataColors = useMemo(
    () => normalizeListInput(product?.available_colors ?? []),
    [product],
  );

  const variantSizes = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map(variant => variant.size)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [variants],
  );

  const variantColors = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map(variant => variant.color)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [variants],
  );

  const availableSizes = useMemo<string[]>(
    () => Array.from(new Set([...metadataSizes, ...variantSizes])),
    [metadataSizes, variantSizes],
  );

  const availableColors = useMemo<string[]>(
    () => Array.from(new Set([...metadataColors, ...variantColors])),
    [metadataColors, variantColors],
  );

  const productShopId = useMemo(() => resolveProductShopId(product), [product]);
  const productShopLabel = useMemo(
    () => resolveProductShopLabel(product),
    [product],
  );

  const selectedVariant = useMemo(() => {
    return variants.find(variantMatchesSelection) ?? null;
  }, [variants, variantMatchesSelection]);

  const variantBasePrice = useMemo(() => {
    const raw = selectedVariant?.price ?? product?.price ?? 0;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }, [selectedVariant, product]);

  const salePriceValue = Number(product?.sale_price ?? NaN);
  const displayPrice = Number.isFinite(salePriceValue)
    ? salePriceValue
    : variantBasePrice;
  const showSalePrice =
    Number.isFinite(salePriceValue) && salePriceValue < variantBasePrice;

  const comparePrice = useMemo(() => {
    const raw = product?.compare_at_price ?? 0;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }, [product]);

  const variantStock = selectedVariant?.stock_qty ?? null;
  const baseStock = product?.stock_qty ?? 0;
  const effectiveStock = variantStock ?? baseStock;
  const currentProductId = product?.id ? String(product.id) : '';
  const hasVariants = variants.length > 0;
  const selectedVariantId = selectedVariant?.id ?? null;

  const variantAlreadyInCart =
    hasVariants && selectedVariantId
      ? cartHasProductVariant(
          cartProductIndex,
          currentProductId,
          selectedVariantId,
        )
      : false;

  const baseProductAlreadyInCart =
    !hasVariants && currentProductId
      ? cartHasProduct(cartProductIndex, currentProductId)
      : false;

  const isInCart =
    (hasVariants && Boolean(variantAlreadyInCart)) ||
    (!hasVariants && Boolean(baseProductAlreadyInCart));
  const showAddToCartButton = Boolean(currentProductId);
  const quantityLimit = Math.max(0, effectiveStock ?? 0);
  const activeCart = useMemo(
    () => (productShopId ? cartState.carts[productShopId] : undefined),
    [cartState, productShopId],
  );
  const matchingCartItem = useMemo(() => {
    if (!activeCart || !currentProductId) return null;
    return activeCart.items.find(item => {
      if (item.productId !== currentProductId) return false;
      if (hasVariants) {
        return (item.variantId ?? null) === (selectedVariantId ?? null);
      }
      return true;
    });
  }, [activeCart, currentProductId, hasVariants, selectedVariantId]);
  const clampQuantityValue = useCallback(
    (value: number) => {
      if (quantityLimit <= 0) return 0;
      const normalized = Math.floor(value);
      if (normalized < 1) return 1;
      if (normalized > quantityLimit) return quantityLimit;
      return normalized;
    },
    [quantityLimit],
  );

  const sizesForColor = useMemo(() => {
    if (!selectedColor) return availableSizes;
    return Array.from(
      new Set(
        variants
          .filter(variant => variant.color && variant.color === selectedColor)
          .map(variant => variant.size)
          .filter(Boolean),
      ),
    );
  }, [selectedColor, variants, availableSizes]);

  const colorsForSize = useMemo(() => {
    if (!selectedSize) return availableColors;
    return Array.from(
      new Set(
        variants
          .filter(variant => variant.size && variant.size === selectedSize)
          .map(variant => variant.color)
          .filter(Boolean),
      ),
    );
  }, [selectedSize, variants, availableColors]);

  const hasVariantSizes = availableSizes.length > 0;
  const hasVariantColors = availableColors.length > 0;

  const normalizedGallery = useMemo(() => {
    const urls = collectProductImageUris(product);
    const featured = resolveProductImageUri(
      product?.featured_image ?? product?.image_url ?? '',
    );
    if (featured && !urls.includes(featured)) {
      return [featured, ...urls];
    }
    return urls;
  }, [product]);

  const formatBooleanLabel = (value?: boolean | null): string => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Unknown';
  };

  const specEntries = useMemo(() => {
    const entries: Array<{ label: string; value: string }> = [];

    const categoryLabels = Array.isArray(product?.catalog_categories)
      ? product.catalog_categories
          .map(category => category?.name || '')
          .filter(Boolean)
      : [];

    if (categoryLabels.length) {
      entries.push({ label: 'Category', value: categoryLabels.join(', ') });
    }

    if (product?.inventory_type) {
      entries.push({ label: 'Inventory type', value: product.inventory_type });
    }

    if (product?.currency) {
      entries.push({ label: 'Currency', value: product.currency });
    }

    if (product?.price !== undefined && product?.price !== null) {
      entries.push({ label: 'Base price', value: `${product.price}` });
    }

    if (product?.sale_price !== undefined && product?.sale_price !== null) {
      entries.push({ label: 'Sale price', value: `${product.sale_price}` });
    }

    if (
      product?.compare_at_price !== undefined &&
      product?.compare_at_price !== null
    ) {
      entries.push({
        label: 'Compare price',
        value: `${product.compare_at_price}`,
      });
    }

    entries.push({
      label: 'Requires shipping',
      value: formatBooleanLabel(product?.requires_shipping),
    });
    entries.push({
      label: 'Pickup available',
      value: formatBooleanLabel(product?.pickup_available),
    });
    entries.push({
      label: 'Backorder allowed',
      value: formatBooleanLabel(product?.allow_backorder),
    });

    if (
      product?.low_stock_threshold !== undefined &&
      product?.low_stock_threshold !== null
    ) {
      entries.push({
        label: 'Low stock threshold',
        value: `${product.low_stock_threshold}`,
      });
    }

    const dims: string[] = [];
    if (product?.length !== undefined && product?.length !== null)
      dims.push(`${product.length}L`);
    if (product?.width !== undefined && product?.width !== null)
      dims.push(`${product.width}W`);
    if (product?.height !== undefined && product?.height !== null)
      dims.push(`${product.height}H`);

    if (dims.length) {
      entries.push({ label: 'Dimensions', value: dims.join(' × ') });
    }

    if (product?.weight !== undefined && product?.weight !== null) {
      entries.push({ label: 'Weight', value: `${product.weight}` });
    }

    if (availableSizes.length) {
      entries.push({
        label: 'Available sizes',
        value: availableSizes.join(', '),
      });
    }

    if (availableColors.length) {
      entries.push({
        label: 'Available colors',
        value: availableColors.join(', '),
      });
    }

    return entries;
  }, [product, availableColors, availableSizes]);

  const attributeEntries = useMemo(() => {
    const attrs = product?.attributes;
    if (!attrs || typeof attrs !== 'object') return [];

    return Object.entries(attrs)
      .map(([key, val]) => {
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          Array.isArray(val)
        )
          return null;

        const formattedValue = String(val);

        return { label: formatAttributeLabel(key), value: formattedValue };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  }, [product?.attributes]);

  const multiSelectAttributes = useMemo(() => {
    if (!product) return [];

    const skipKeys = new Set([
      'variants',
      'images',
      'gallery_images',
      'galleryImages',
      'catalog_categories',
      'catalogCategories',
    ]);

    const definitions: Array<{
      key: string;
      label: string;
      options: string[];
    }> = [];
    const seenKeys = new Set<string>();

    const addDefinition = (key: string, value: unknown) => {
      if (!key || seenKeys.has(key) || skipKeys.has(key)) return;
      if (!Array.isArray(value)) return;
      const normalized = normalizeListInput(value);
      if (!normalized.length) return;
      seenKeys.add(key);
      definitions.push({
        key,
        label: formatAttributeLabel(key),
        options: normalized,
      });
    };

    if (product.attributes && typeof product.attributes === 'object') {
      Object.entries(product.attributes).forEach(([key, val]) =>
        addDefinition(key, val),
      );
    }

    Object.entries(product).forEach(([key, val]) => {
      if (key === 'attributes') return;
      addDefinition(key, val);
    });

    return definitions;
  }, [product]);

  useEffect(() => {
    if (matchingCartItem) return;
    setSelectedAttributeOptions(prev => {
      const next: Record<string, string[]> = {};
      multiSelectAttributes.forEach(({ key, options }) => {
        const preserved = (prev[key] ?? []).filter(option =>
          options.includes(option),
        );
        if (preserved.length) {
          next[key] = preserved;
        }
      });
      return next;
    });
  }, [multiSelectAttributes, matchingCartItem]);

  useEffect(() => {
    if (normalizedGallery[0]) {
      setActiveImage(normalizedGallery[0]);
      return;
    }
    setActiveImage('');
  }, [normalizedGallery]);

  const loadProduct = useCallback(async () => {
    if (!detailProductId) {
      setError('Product not specified.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getRequest(
        `${ROUTES.commerce.products}${detailProductId}/`,
        {
          errorMessage: 'Unable to load product.',
        },
      );

      if (!response.success) {
        throw new Error(response.message || 'Unable to load product.');
      }

      setProduct(response.data as ProductDetail);
      setSelectedSize('');
      setSelectedColor('');
    } catch (fetchError: any) {
      setError(fetchError?.message ?? 'Unable to load product.');
    } finally {
      setLoading(false);
    }
  }, [detailProductId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (matchingCartItem) return;
    setQuantity(quantityLimit > 0 ? 1 : 0);
    setSelectedAttributeOptions({});
    setCustomDescription('');
  }, [product?.id, matchingCartItem, quantityLimit]);

  useEffect(() => {
    if (!matchingCartItem) return;
    setQuantity(clampQuantityValue(matchingCartItem.quantity));
    setSelectedAttributeOptions(matchingCartItem.selectedAttributes ?? {});
    setCustomDescription(matchingCartItem.customDescription ?? '');
  }, [matchingCartItem, clampQuantityValue]);

  useEffect(() => {
    if (matchingCartItem) {
      setQuantity(clampQuantityValue(matchingCartItem.quantity));
      return;
    }
    if (quantityLimit <= 0) {
      setQuantity(0);
      return;
    }
    setQuantity(prev => clampQuantityValue(prev));
  }, [matchingCartItem, quantityLimit, clampQuantityValue]);

  useEffect(() => {
    const unsubscribe = subscribeToShopCart(nextState => {
      setCartProductIndex(buildCartProductIndex(nextState));
      setCartState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshShopCartFromBackend();
  }, []);

  useEffect(() => {
    if (!productShopId) {
      setCartSynced(true);
      return;
    }
    let active = true;
    setCartSynced(false);
    const sync = async () => {
      await refreshShopCartForShop(productShopId);
      if (active) {
        setCartSynced(true);
      }
    };
    void sync();
    return () => {
      active = false;
    };
  }, [productShopId]);

  useEffect(() => {
    if (!productShopId) return;
    void refreshShopCartForShop(productShopId);
  }, [productShopId]);

  useEffect(() => {
    if (!product?.id) return;
    void incrementProductViewCount(String(product.id));
  }, [product?.id]);
  useEffect(() => {
    if (quantityLimit <= 0) {
      setQuantity(0);
      return;
    }
    setQuantity(prev => {
      if (prev < 1) return 1;
      if (prev > quantityLimit) return quantityLimit;
      return prev;
    });
  }, [quantityLimit]);

  const canDecreaseQuantity = quantity > 1;
  const canIncreaseQuantity = quantityLimit > 0 && quantity < quantityLimit;

  const handleSelectSize = (size: string) => {
    if (size === selectedSize) {
      setSelectedSize('');
      return;
    }

    if (
      selectedColor &&
      !variants.some(
        variant => variant.size === size && variant.color === selectedColor,
      )
    ) {
      setSelectedColor('');
    }

    setSelectedSize(size);
  };

  const handleSelectColor = (color: string) => {
    if (color === selectedColor) {
      setSelectedColor('');
      return;
    }

    if (
      selectedSize &&
      !variants.some(
        variant => variant.color === color && variant.size === selectedSize,
      )
    ) {
      setSelectedSize('');
    }

    setSelectedColor(color);
  };

  const changeQuantityBy = (delta: number) => {
    setQuantity(prev => {
      if (quantityLimit <= 0) return 0;
      const updated = prev + delta;
      if (updated < 1) return 1;
      if (updated > quantityLimit) return quantityLimit;
      return updated;
    });
  };

  const toggleAttributeOption = (key: string, option: string) => {
    setSelectedAttributeOptions(prev => {
      const existing = prev[key] ?? [];
      const exists = existing.includes(option);
      const next = exists
        ? existing.filter(entry => entry !== option)
        : [...existing, option];
      if (!next.length) {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      }
      return { ...prev, [key]: next };
    });
  };

  const emitCartFeedback = useCallback(
    (payload: {
      productId: string;
      variantId?: string | null;
      name?: string;
      price: number;
    }) => {
      DeviceEventEmitter.emit('cart.add', payload);
      Alert.alert('Cart', 'Product queued for cart review.');
    },
    [],
  );

  const addCurrentProductToCart =
    useCallback(async (): Promise<ShopCartAddResult> => {
      if (!product?.id || !productShopId) {
        return { status: 'missingShop' };
      }

      const payload: ShopCartItemPayload = {
        shopId: productShopId,
        shopName: productShopLabel,
        productId: String(product.id),
        variantId: selectedVariant?.id ?? null,
        name: product.name,
        price: displayPrice,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        imageUrl: activeImage || undefined,
        quantity: quantityLimit > 0 ? quantity : 0,
        selectedAttributes:
          Object.keys(selectedAttributeOptions).length > 0
            ? selectedAttributeOptions
            : undefined,
        customDescription: customDescription.trim() || undefined,
      };

      return addToShopCart(payload);
    }, [
      activeImage,
      displayPrice,
      product,
      productShopId,
      productShopLabel,
      selectedColor,
      selectedSize,
      selectedVariant?.id,
      quantity,
      quantityLimit,
      selectedAttributeOptions,
      customDescription,
    ]);

  const handleAddToCart = async () => {
    if (!product) return;

    if (variants.length > 0) {
      if (hasVariantSizes && !selectedSize) {
        Alert.alert('Select a size', 'Choose a size to continue.');
        return;
      }

      if (hasVariantColors && !selectedColor) {
        Alert.alert('Select a color', 'Choose a color to continue.');
        return;
      }

      if (!selectedVariant) {
        Alert.alert(
          'Select a variant',
          'Pick the combination that fits before adding to cart.',
        );
        return;
      }

      if ((selectedVariant.stock_qty ?? 0) <= 0) {
        Alert.alert(
          'Out of stock',
          'That variant is sold out. Choose another one.',
        );
        return;
      }
    } else if ((product.stock_qty ?? 0) <= 0) {
      Alert.alert('Out of stock', 'This product is sold out.');
      return;
    }

    if (quantityLimit <= 0) {
      Alert.alert('Out of stock', 'This product is sold out.');
      return;
    }

    if (quantity <= 0) {
      Alert.alert('Quantity', 'Select at least one item to add to cart.');
      return;
    }

    if (quantity > quantityLimit) {
      Alert.alert(
        'Quantity limit',
        `You can only add up to ${quantityLimit} units.`,
      );
      return;
    }

    if (!product.id) return;

    const eventPayload = {
      productId: String(product.id),
      variantId: selectedVariant?.id ?? null,
      name: product.name,
      price: displayPrice,
    };

    const result = await addCurrentProductToCart();

    if (result.status === 'added') {
      emitCartFeedback(eventPayload);
      return;
    }

    if (result.status === 'missingShop') {
      Alert.alert(
        'Cart',
        'Unable to determine which shop this product belongs to.',
      );
      return;
    }

    Alert.alert(
      'Cart',
      result.message ?? 'Unable to add this product to your cart right now.',
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <View
          style={[
            styles.loadingCard,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <ActivityIndicator size="large" color={palette.primaryStrong} />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>
            Loading product...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg, padding: 20 }]}>
        <View
          style={[
            styles.errorCard,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <View
            style={[styles.errorIconWrap, { backgroundColor: palette.inputBg }]}
          >
            <KISIcon name="info" size={20} color={palette.error || '#E53935'} />
          </View>
          <Text style={[styles.errorTitle, { color: palette.text }]}>
            Something went wrong
          </Text>
          <Text
            style={[styles.errorText, { color: palette.error || '#E53935' }]}
          >
            {error}
          </Text>
          <View style={styles.errorButtonWrap}>
            <KISButton title="Retry" onPress={loadProduct} />
          </View>
        </View>
      </View>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: palette.bg, borderBottomColor: palette.divider },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={[
            styles.headerIconButton,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <KISIcon name="arrow-left" size={18} color={palette.text} />
        </Pressable>

        <Text
          style={[styles.headerTitle, { color: palette.text }]}
          numberOfLines={1}
        >
          Product details
        </Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View
            style={[
              styles.galleryCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <View
              style={[
                styles.heroImageWrap,
                { backgroundColor: palette.inputBg },
              ]}
            >
              {activeImage ? (
                <Image
                  source={{ uri: activeImage }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.heroImage, styles.emptyImage]}>
                  <KISIcon name="image" size={28} color={palette.subtext} />
                  <Text
                    style={[styles.emptyImageText, { color: palette.subtext }]}
                  >
                    No product image
                  </Text>
                </View>
              )}

              {normalizedGallery.length > 1 ? (
                <View
                  style={[
                    styles.imageCountBadge,
                    { backgroundColor: palette.surface },
                  ]}
                >
                  <Text
                    style={[styles.imageCountText, { color: palette.text }]}
                  >
                    {normalizedGallery.findIndex(img => img === activeImage) +
                      1}
                    /{normalizedGallery.length}
                  </Text>
                </View>
              ) : null}
            </View>

            {normalizedGallery.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailRow}
              >
                {normalizedGallery.map((uri, index) => {
                  const isActive = activeImage === uri;
                  return (
                    <Pressable
                      key={`${uri}-${index}`}
                      onPress={() => setActiveImage(uri)}
                      style={[
                        styles.thumbnail,
                        {
                          borderColor: isActive
                            ? palette.primaryStrong
                            : palette.divider,
                          backgroundColor: palette.inputBg,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.highlightCard,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <View style={styles.titleRow}>
            <View style={styles.titleContent}>
              <Text
                style={[styles.title, { color: palette.text }]}
                numberOfLines={2}
              >
                {product.name ?? 'Untitled product'}
              </Text>

              <Text style={[styles.category, { color: palette.subtext }]}>
                {product.catalog_categories?.[0]?.name ??
                  product.inventory_type ??
                  'Product'}
              </Text>
            </View>

            {showSalePrice || comparePrice > displayPrice ? (
              <View
                style={[
                  styles.salePill,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.primaryStrong,
                  },
                ]}
              >
                <Text
                  style={[styles.saleBadge, { color: palette.primaryStrong }]}
                >
                  Sale
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.pricePanel}>
            <View style={styles.priceRow}>
              <View>
                <Text style={[styles.price, { color: palette.primaryStrong }]}>
                  {`${displayPrice.toFixed(2)} ${
                    product.currency ?? KIS_COIN_CODE
                  }`}
                </Text>
                {showSalePrice ? (
                  <Text
                    style={[styles.originalPrice, { color: palette.subtext }]}
                  >
                    {`${variantBasePrice.toFixed(2)} ${
                      product.currency ?? KIS_COIN_CODE
                    }`}
                  </Text>
                ) : null}
              </View>

              {comparePrice > displayPrice ? (
                <Text style={[styles.comparePrice, { color: palette.subtext }]}>
                  {`${comparePrice.toFixed(2)} ${
                    product.currency ?? KIS_COIN_CODE
                  }`}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.usdText, { color: palette.subtext }]}>
              ≈ ${(displayPrice * KIS_TO_USD_RATE).toFixed(2)} USD
            </Text>
          </View>

          {product.condition ? (
            <View
              style={[styles.metaCard, { backgroundColor: palette.inputBg }]}
            >
              <Text style={[styles.metaCardLabel, { color: palette.subtext }]}>
                Condition
              </Text>
              <Text style={[styles.metaCardValue, { color: palette.text }]}>
                {product.condition}
              </Text>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.divider,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  {
                    color:
                      effectiveStock > 0
                        ? palette.primaryStrong
                        : palette.error || '#E53935',
                  },
                ]}
              >
                {effectiveStock > 0
                  ? `In stock · ${effectiveStock}`
                  : 'Out of stock'}
              </Text>
            </View>

            {product.requires_shipping === false ? (
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={[styles.statusChipText, { color: palette.text }]}>
                  Pickup only
                </Text>
              </View>
            ) : null}

            {product.pickup_available ? (
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={[styles.statusChipText, { color: palette.text }]}>
                  Pickup available
                </Text>
              </View>
            ) : null}

            {product.allow_backorder ? (
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={[styles.statusChipText, { color: palette.text }]}>
                  Backorder allowed
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Description
          </Text>
          <Text style={[styles.sectionBody, { color: palette.subtext }]}>
            {product.description || 'No description yet.'}
          </Text>
        </View>

        {specEntries.length > 0 ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Product specs
            </Text>
            <View style={styles.specGrid}>
              {specEntries.map(entry => (
                <View
                  key={`${entry.label}-${entry.value}`}
                  style={[
                    styles.specCard,
                    {
                      backgroundColor: palette.inputBg,
                      borderColor: palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.specLabel, { color: palette.subtext }]}>
                    {entry.label}
                  </Text>
                  <Text
                    style={[styles.specValue, { color: palette.text }]}
                    numberOfLines={2}
                  >
                    {entry.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {attributeEntries.length > 0 ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Attributes
            </Text>
            <View style={styles.attributeList}>
              {attributeEntries.map((entry, index) => (
                <View
                  key={`${entry.label}-${entry.value}`}
                  style={[
                    styles.attributeRow,
                    {
                      borderBottomColor:
                        index === attributeEntries.length - 1
                          ? 'transparent'
                          : palette.divider,
                    },
                  ]}
                >
                  <Text
                    style={[styles.attributeLabel, { color: palette.subtext }]}
                  >
                    {entry.label}
                  </Text>
                  <Text
                    style={[styles.attributeValue, { color: palette.text }]}
                  >
                    {entry.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {product.fit || product.size_guide ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            {product.fit ? (
              <>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Fit notes
                </Text>
                <Text style={[styles.sectionBody, { color: palette.subtext }]}>
                  {product.fit}
                </Text>
              </>
            ) : null}

            {product.size_guide ? (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: palette.text, marginTop: product.fit ? 18 : 0 },
                  ]}
                >
                  Size guide
                </Text>
                <Text style={[styles.sectionBody, { color: palette.subtext }]}>
                  {product.size_guide}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        {variants.length > 0 || hasVariantSizes || hasVariantColors ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Variants
            </Text>

            {hasVariantSizes ? (
              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, { color: palette.subtext }]}>
                  Size
                </Text>
                <View style={styles.chipRow}>
                  {availableSizes.map(size => {
                    const disabled =
                      hasVariantColors && selectedColor
                        ? !sizesForColor.includes(size)
                        : false;
                    const selected = size === selectedSize;

                    return (
                      <Pressable
                        key={`size-${size}`}
                        onPress={() => {
                          if (disabled) return;
                          handleSelectSize(size);
                        }}
                        style={[
                          styles.optionChip,
                          {
                            borderColor: selected
                              ? palette.primaryStrong
                              : palette.divider,
                            backgroundColor: selected
                              ? palette.inputBg
                              : palette.surface,
                            opacity: disabled ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected
                              ? palette.primaryStrong
                              : palette.text,
                            fontWeight: selected ? '700' : '600',
                          }}
                        >
                          {size}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {hasVariantColors ? (
              <View style={styles.optionGroup}>
                <Text style={[styles.optionLabel, { color: palette.subtext }]}>
                  Color
                </Text>
                <View style={styles.chipRow}>
                  {availableColors.map(color => {
                    const disabled =
                      hasVariantSizes && selectedSize
                        ? !colorsForSize.includes(color)
                        : false;
                    const selected = color === selectedColor;

                    return (
                      <Pressable
                        key={`color-${color}`}
                        onPress={() => {
                          if (disabled) return;
                          handleSelectColor(color);
                        }}
                        style={[
                          styles.optionChip,
                          {
                            borderColor: selected
                              ? palette.primaryStrong
                              : palette.divider,
                            backgroundColor: selected
                              ? palette.inputBg
                              : palette.surface,
                            opacity: disabled ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected
                              ? palette.primaryStrong
                              : palette.text,
                            fontWeight: selected ? '700' : '600',
                          }}
                        >
                          {color}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {variants.length > 0 && selectedVariant ? (
              <View
                style={[
                  styles.variantSummary,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <View style={styles.variantSummaryLeft}>
                  <Text
                    style={[
                      styles.variantSummaryTitle,
                      { color: palette.text },
                    ]}
                  >
                    Selected variant
                  </Text>
                  <Text
                    style={[
                      styles.variantSummaryText,
                      { color: palette.subtext },
                    ]}
                  >
                    {selectedVariant.size || '—'} /{' '}
                    {selectedVariant.color || '—'}
                  </Text>
                  <Text
                    style={[
                      styles.variantSummaryMeta,
                      { color: palette.subtext },
                    ]}
                  >
                    ID: {selectedVariant.sku || selectedVariant.id || 'N/A'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.variantSummaryStock,
                    {
                      color:
                        (selectedVariant.stock_qty ?? 0) > 0
                          ? palette.primaryStrong
                          : palette.error || '#E53935',
                    },
                  ]}
                >
                  {(selectedVariant.stock_qty ?? 0) > 0
                    ? `Stock ${selectedVariant.stock_qty ?? 0}`
                    : 'Out of stock'}
                </Text>
              </View>
            ) : null}

            {variants.length > 0 && !selectedVariant ? (
              <Text style={[styles.variantHint, { color: palette.subtext }]}>
                Select a size and color to choose the right variant before
                adding to cart.
              </Text>
            ) : null}

            {variants.length > 0 ? (
              <View style={styles.variantList}>
                {variants.map(variant => {
                  const variantPrice = Number(variant.price ?? 0);
                  const highlight =
                    Boolean(selectedVariant?.id) &&
                    variant.id === selectedVariant?.id;

                  return (
                    <View
                      key={variant.id ?? `${variant.size}-${variant.color}`}
                      style={[
                        styles.variantRow,
                        {
                          borderColor: highlight
                            ? palette.primaryStrong
                            : palette.divider,
                          backgroundColor: highlight
                            ? palette.inputBg
                            : palette.surface,
                        },
                      ]}
                    >
                      <View style={styles.variantRowLeft}>
                        <Text
                          style={[
                            styles.variantRowTitle,
                            { color: palette.text },
                          ]}
                        >
                          {variant.size || '—'} / {variant.color || '—'}
                        </Text>
                        <Text
                          style={[
                            styles.variantRowMeta,
                            { color: palette.subtext },
                          ]}
                        >
                          SKU: {variant.sku || variant.id || 'N/A'}
                        </Text>
                      </View>

                      <View style={styles.variantRowRight}>
                        <Text
                          style={[
                            styles.variantRowPrice,
                            { color: palette.primaryStrong },
                          ]}
                        >
                          {`${variantPrice.toFixed(2)} ${
                            product.currency ?? KIS_COIN_CODE
                          }`}
                        </Text>
                        <Text
                          style={[
                            styles.variantRowStock,
                            { color: palette.subtext },
                          ]}
                        >
                          {`Stock ${variant.stock_qty ?? 0}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.section,
            { backgroundColor: palette.surface, borderColor: palette.divider },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Quantity
            </Text>
            <Text style={[styles.sectionCaption, { color: palette.subtext }]}>
              How many units are you ordering?
            </Text>
          </View>
          <View style={styles.quantityRow}>
            <Pressable
              onPress={() => changeQuantityBy(-1)}
              disabled={!canDecreaseQuantity}
              style={[
                styles.quantityButton,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.inputBg,
                },
                !canDecreaseQuantity && { opacity: 0.35 },
              ]}
            >
              <Text
                style={[styles.quantityButtonLabel, { color: palette.text }]}
              >
                -
              </Text>
            </Pressable>
            <View style={styles.quantityValueWrap}>
              <Text style={[styles.quantityValue, { color: palette.text }]}>
                {quantityLimit > 0 ? quantity : 0}
              </Text>
              <Text
                style={[styles.quantitySubText, { color: palette.subtext }]}
              >
                {quantityLimit > 0
                  ? `${quantityLimit} available`
                  : 'Out of stock: restock soon'}
              </Text>
            </View>
            <Pressable
              onPress={() => changeQuantityBy(1)}
              disabled={!canIncreaseQuantity}
              style={[
                styles.quantityButton,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.inputBg,
                },
                !canIncreaseQuantity && { opacity: 0.35 },
              ]}
            >
              <Text
                style={[styles.quantityButtonLabel, { color: palette.text }]}
              >
                +
              </Text>
            </Pressable>
          </View>
          <View style={styles.quantityInfoRow}>
            <Text style={[styles.quantityInfoText, { color: palette.subtext }]}>
              {quantityLimit > 0
                ? `Selected: ${quantity} · Max allowed: ${quantityLimit}`
                : 'Sold out'}
            </Text>
            <Text style={[styles.quantityInfoText, { color: palette.subtext }]}>
              Auto-limits based on inventory
            </Text>
          </View>
        </View>

        {multiSelectAttributes.length > 0 ? (
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Attributes
              </Text>
              <Text style={[styles.sectionCaption, { color: palette.subtext }]}>
                Choose or update your custom options
              </Text>
            </View>
            {multiSelectAttributes.map((attribute, attrIndex) => {
              const selection = selectedAttributeOptions[attribute.key] ?? [];
              return (
                <View
                  key={attribute.key}
                  style={attrIndex ? { marginTop: 18 } : { marginTop: 12 }}
                >
                  <Text
                    style={[
                      styles.multiSelectLabel,
                      { color: palette.subtext },
                    ]}
                  >
                    Select one or more {attribute.label}
                  </Text>
                  <View style={styles.attributeChipRow}>
                    {attribute.options.map(option => {
                      const selected = selection.includes(option);
                      return (
                        <Pressable
                          key={`${attribute.key}-${option}`}
                          onPress={() =>
                            toggleAttributeOption(attribute.key, option)
                          }
                          style={[
                            styles.attributeOptionChip,
                            {
                              borderColor: selected
                                ? palette.primaryStrong
                                : palette.divider,
                              backgroundColor: selected
                                ? palette.inputBg
                                : palette.surface,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.attributeOptionText,
                              {
                                color: selected
                                  ? palette.primaryStrong
                                  : palette.text,
                              },
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text
                    style={[styles.attributeHelper, { color: palette.subtext }]}
                  >
                    {selection.length > 0
                      ? `${selection.length} selected`
                      : `Pick one or more ${attribute.label.toLowerCase()} options.`}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {
          <View
            style={[
              styles.section,
              {
                backgroundColor: palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Special instructions / description
            </Text>
            <TextInput
              style={[
                styles.customDescriptionInput,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.inputBg,
                  color: palette.text,
                },
              ]}
              placeholder="Tell us what you want"
              placeholderTextColor={palette.subtext}
              multiline
              numberOfLines={4}
              value={customDescription}
              onChangeText={setCustomDescription}
            />
          </View>
        }

        {isInCart ? (
          <Text
            style={[styles.cartStatusText, { color: palette.primaryStrong }]}
          >
            This product is already in your cart. Add more to adjust quantity or
            customization.
          </Text>
        ) : null}

        {showAddToCartButton ? (
          <View style={styles.addToCartWrap}>
            <KISButton
              title={isInCart ? 'Update cart' : 'Add to cart'}
              onPress={handleAddToCart}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
    },
    headerIconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '800',
      marginHorizontal: 12,
    },
    headerRightPlaceholder: {
      width: 42,
      height: 42,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 34,
    },
    heroSection: {
      marginBottom: 16,
    },
    galleryCard: {
      borderRadius: 28,
      borderWidth: 1,
      padding: 12,
      shadowColor: palette.shadow ?? '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    heroImageWrap: {
      borderRadius: 22,
      overflow: 'hidden',
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: 320,
    },
    emptyImage: {
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    emptyImageText: {
      fontSize: 14,
      fontWeight: '600',
    },
    imageCountBadge: {
      position: 'absolute',
      right: 14,
      bottom: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      shadowColor: palette.shadow ?? '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 2,
    },
    imageCountText: {
      fontSize: 12,
      fontWeight: '800',
    },
    thumbnailRow: {
      paddingTop: 12,
      gap: 10,
    },
    thumbnail: {
      width: 72,
      height: 72,
      borderRadius: 18,
      borderWidth: 2,
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    highlightCard: {
      borderRadius: 28,
      borderWidth: 1,
      padding: 18,
      marginBottom: 14,
      shadowColor: palette.shadow ?? '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleContent: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
    },
    category: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    salePill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignSelf: 'flex-start',
    },
    saleBadge: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pricePanel: {
      marginTop: 18,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
    },
    price: {
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 34,
    },
    originalPrice: {
      fontSize: 15,
      fontWeight: '600',
      textDecorationLine: 'line-through',
      marginBottom: 3,
    },
    comparePrice: {
      fontSize: 15,
      fontWeight: '600',
      textDecorationLine: 'line-through',
      marginBottom: 3,
    },
    usdText: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '500',
    },
    metaCard: {
      marginTop: 16,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    metaCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    metaCardValue: {
      fontSize: 15,
      fontWeight: '700',
      marginTop: 4,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16,
    },
    statusChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    section: {
      borderRadius: 26,
      borderWidth: 1,
      padding: 18,
      marginBottom: 14,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 10,
    },
    sectionCaption: {
      fontSize: 12,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    orderActionWrap: {
      borderRadius: 26,
      borderWidth: 1,
      padding: 18,
      marginBottom: 14,
    },
    orderHeader: {
      marginBottom: 12,
    },
    orderMessage: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 10,
    },
    orderStatusText: {
      fontSize: 12,
      marginTop: 4,
    },
    sectionBody: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '500',
    },
    specGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
      marginHorizontal: -5,
    },
    specCard: {
      width: '47%',
      minWidth: 145,
      borderRadius: 18,
      borderWidth: 1,
      padding: 12,
      marginHorizontal: 5,
      marginBottom: 10,
    },
    specLabel: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    specValue: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 6,
      lineHeight: 20,
    },
    attributeList: {
      marginTop: 4,
    },
    attributeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    attributeLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingRight: 12,
    },
    attributeValue: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'right',
      lineHeight: 20,
    },
    optionGroup: {
      marginBottom: 14,
    },
    optionLabel: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionChip: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    variantSummary: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    variantSummaryLeft: {
      flex: 1,
    },
    variantSummaryTitle: {
      fontSize: 14,
      fontWeight: '800',
    },
    variantSummaryText: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    variantSummaryMeta: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 4,
    },
    variantSummaryStock: {
      fontSize: 13,
      fontWeight: '800',
    },
    variantHint: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    variantList: {
      gap: 10,
    },
    variantRow: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    variantRowLeft: {
      flex: 1,
    },
    variantRowRight: {
      alignItems: 'flex-end',
    },
    variantRowTitle: {
      fontSize: 14,
      fontWeight: '800',
    },
    variantRowMeta: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 4,
    },
    variantRowPrice: {
      fontSize: 14,
      fontWeight: '900',
    },
    variantRowStock: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    addToCartWrap: {
      marginTop: 4,
      marginBottom: 8,
    },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    quantityInfoRow: {
      marginTop: 10,
      gap: 4,
    },
    quantityInfoText: {
      fontSize: 12,
      fontWeight: '600',
    },
    quantityButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quantityButtonLabel: {
      fontSize: 24,
      fontWeight: '700',
    },
    quantityValueWrap: {
      alignItems: 'center',
    },
    quantityValue: {
      fontSize: 28,
      fontWeight: '900',
    },
    quantitySubText: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    attributeChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    attributeOptionChip: {
      borderRadius: 18,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    attributeOptionText: {
      fontSize: 13,
      fontWeight: '600',
    },
    multiSelectLabel: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 6,
    },
    attributeHelper: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    customDescriptionInput: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      fontSize: 14,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    cartSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    cartSummaryLabel: {
      fontSize: 13,
      fontWeight: '600',
      flex: 0.4,
    },
    cartSummaryValue: {
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'right',
      flex: 0.6,
    },
    cartStatusText: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 10,
      textAlign: 'center',
    },
    loadingCard: {
      minWidth: 220,
      borderRadius: 24,
      borderWidth: 1,
      paddingHorizontal: 24,
      paddingVertical: 28,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '600',
    },
    errorCard: {
      width: '100%',
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
      alignItems: 'center',
    },
    errorIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 8,
    },
    errorText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 22,
    },
    errorButtonWrap: {
      width: '100%',
      marginTop: 18,
    },
  });
