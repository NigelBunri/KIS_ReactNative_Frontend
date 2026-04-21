import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import { normalizeCurrencyValue } from '@/utils/currency';

export type ShopCartItem = {
  id: string;
  shopId: string;
  productId: string;
  variantId?: string | null;
  name?: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
  availableColors?: string[];
  availableSizes?: string[];
  imageUrl?: string;
  selectedAttributes?: Record<string, string[]>;
  customDescription?: string;
  remoteCartId?: string;
  remoteCartItemId?: string;
  attributeLabels?: Record<string, string>;
};

export type ShopCartItemPayload = {
  shopId: string;
  shopName?: string;
  productId: string;
  variantId?: string | null;
  name?: string;
  price: number;
  quantity?: number;
  color?: string;
  size?: string;
  availableColors?: string[];
  availableSizes?: string[];
  imageUrl?: string;
  selectedAttributes?: Record<string, string[]>;
  customDescription?: string;
  remoteCartId?: string;
  remoteCartItemId?: string;
  attributeLabels?: Record<string, string>;
};

export type ShopCartStatus = 'active' | 'checked_out' | 'abandoned';

export type ShopCart = {
  shopId: string;
  shopName?: string;
  shopDescription?: string;
  shopImage?: string;
  remoteCartId?: string;
  status?: ShopCartStatus;
  items: ShopCartItem[];
};

export type ShopCartState = {
  carts: Record<string, ShopCart>;
};

export type ShopCartAddResult =
  | {
      status: 'added';
      shopId: string;
      totalItemsInShop: number;
      totalItemsAcrossCarts: number;
    }
  | { status: 'missingShop'; message?: string }
  | { status: 'error'; message?: string };

const STORAGE_KEY = '@kis:shops-cart';
const defaultState: ShopCartState = { carts: {} };

let state: ShopCartState = { ...defaultState };
const listeners = new Set<(next: ShopCartState) => void>();
let hydrationPromise: Promise<void> | null = null;
let hasHydratedState = false;

const emit = () => {
  listeners.forEach((listener) => listener(state));
};

const persistState = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage issues
  }
};

const hydrateState = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const carts: Record<string, ShopCart> = {};
    if (parsed.carts && typeof parsed.carts === 'object') {
      for (const [shopId, cart] of Object.entries(parsed.carts)) {
      if (cart && typeof cart === 'object') {
        carts[shopId] = {
          shopId,
          shopName: (cart as ShopCart).shopName,
          shopDescription: (cart as ShopCart).shopDescription,
          shopImage: (cart as ShopCart).shopImage,
          remoteCartId: (cart as ShopCart).remoteCartId,
          status: (cart as ShopCart).status,
          items: Array.isArray((cart as ShopCart).items) ? (cart as ShopCart).items : [],
        };
      }
      }
    }
    state = { carts };
    emit();
  } catch (error) {
    // ignore parsing issues
    console.warn('Failed to hydrate cart state', error);
  } finally {
    hasHydratedState = true;
  }
};

const ensureHydratedState = async () => {
  if (!hydrationPromise) {
    hydrationPromise = hydrateState();
  }
  await hydrationPromise;
};

void ensureHydratedState();

const computeTotalItems = (carts: Record<string, ShopCart>) =>
  Object.values(carts).reduce((sum, cart) => sum + cart.items.reduce((acc, item) => acc + Math.max(0, item.quantity), 0), 0);

const clampQuantity = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : 1;
};

export const getShopCartState = () => state;

export const subscribeToShopCart = (listener: (next: ShopCartState) => void) => {
  listeners.add(listener);
  listener(state);
  if (!hasHydratedState) {
    void ensureHydratedState();
  }
  return () => listeners.delete(listener);
};

const buildCartItemId = (payload: ShopCartItemPayload) =>
  `${payload.productId}-${payload.variantId ?? 'default'}`;

const resolveCartItemPrice = (value: unknown): number => {
  const normalized = normalizeCurrencyValue(value as number | string | null | undefined);
  return Number.isFinite(normalized) ? normalized : 0;
};

const buildItemFromPayload = (payload: ShopCartItemPayload): ShopCartItem => {
  const normalizedSelectedAttributes = payload.selectedAttributes
    ? Object.fromEntries(
        Object.entries(payload.selectedAttributes).map(([key, values]) => [
          key,
          Array.isArray(values)
            ? values.map((entry) => String(entry ?? '').trim()).filter(Boolean)
            : [],
        ]),
      )
    : undefined;

  return {
    id: buildCartItemId(payload),
    shopId: payload.shopId,
    productId: payload.productId,
    variantId: payload.variantId,
    name: payload.name,
    price: resolveCartItemPrice(payload.price),
    quantity: clampQuantity(payload.quantity),
    color: payload.color,
    size: payload.size,
    availableColors: payload.availableColors,
    availableSizes: payload.availableSizes,
    imageUrl: payload.imageUrl,
    selectedAttributes: normalizedSelectedAttributes,
    attributeLabels: payload.attributeLabels,
    customDescription: payload.customDescription,
    remoteCartId: payload.remoteCartId,
    remoteCartItemId: payload.remoteCartItemId,
  };
};

export const addToShopCart = async (payload: ShopCartItemPayload): Promise<ShopCartAddResult> => {
  if (!payload || !payload.shopId) {
    return { status: 'missingShop' };
  }
  try {
    const shopId = payload.shopId;
    const nextCarts: Record<string, ShopCart> = { ...state.carts };
    const existingCart: ShopCart = nextCarts[shopId]
      ? { ...nextCarts[shopId], items: [...nextCarts[shopId].items] }
      : {
          shopId,
          shopName: payload.shopName,
          items: [],
          status: 'active',
        };
    existingCart.status = 'active';
    const normalizedItem = buildItemFromPayload(payload);
    const existingIndex = existingCart.items.findIndex((entry) => entry.id === normalizedItem.id);
    let updatedItem: ShopCartItem;
    if (existingIndex >= 0) {
      const existing = existingCart.items[existingIndex];
      const merged = {
        ...existing,
        quantity: normalizedItem.quantity,
        color: normalizedItem.color ?? existing.color,
        size: normalizedItem.size ?? existing.size,
        availableColors: normalizedItem.availableColors ?? existing.availableColors,
        availableSizes: normalizedItem.availableSizes ?? existing.availableSizes,
        imageUrl: normalizedItem.imageUrl ?? existing.imageUrl,
        price: normalizedItem.price > 0 ? normalizedItem.price : existing.price,
        name: normalizedItem.name ?? existing.name,
        selectedAttributes:
          normalizedItem.selectedAttributes ?? existing.selectedAttributes,
        customDescription: normalizedItem.customDescription ?? existing.customDescription,
      };
      existingCart.items[existingIndex] = merged;
      updatedItem = merged;
    } else {
      existingCart.items.push(normalizedItem);
      updatedItem = normalizedItem;
    }
    if (payload.shopName) {
      existingCart.shopName = payload.shopName;
    }
    nextCarts[shopId] = existingCart;
    state = { carts: nextCarts };
    await persistState();
    emit();
    void syncCartItemWithBackend(shopId, updatedItem);
    return {
      status: 'added',
      shopId,
      totalItemsInShop: existingCart.items.reduce((sum, entry) => sum + Math.max(0, entry.quantity), 0),
      totalItemsAcrossCarts: computeTotalItems(nextCarts),
    };
  } catch (error: any) {
    return { status: 'error', message: error?.message ?? 'Unable to update cart.' };
  }
};

export const updateShopCartItem = async (
  shopId: string,
  itemId: string,
  changes: Partial<Pick<ShopCartItem, 'price' | 'quantity' | 'size' | 'color' | 'name'>>,
): Promise<ShopCartItem | null> => {
  const nextCarts: Record<string, ShopCart> = { ...state.carts };
  const targetCart = nextCarts[shopId];
  if (!targetCart) return null;
  const updatedCart = { ...targetCart, items: [...targetCart.items] };
  const itemIndex = updatedCart.items.findIndex((entry) => entry.id === itemId);
  if (itemIndex < 0) return null;
  const existing = updatedCart.items[itemIndex];
  const removingItem = changes.quantity !== undefined && changes.quantity <= 0;
  const remoteCartId = updatedCart.remoteCartId ?? targetCart.remoteCartId;
  const remoteItemId = existing.remoteCartItemId;
    if (removingItem) {
      updatedCart.items.splice(itemIndex, 1);
    } else {
      updatedCart.items[itemIndex] = {
        ...existing,
        price: typeof changes.price === 'number' ? changes.price : existing.price,
        quantity:
          changes.quantity !== undefined ? clampQuantity(changes.quantity) : existing.quantity,
        size: changes.size !== undefined ? changes.size : existing.size,
        color: changes.color !== undefined ? changes.color : existing.color,
        name: changes.name ?? existing.name,
      };
    }
  if (!updatedCart.items.length) {
    delete nextCarts[shopId];
  } else {
    nextCarts[shopId] = updatedCart;
  }
  state = { carts: nextCarts };
  await persistState();
  emit();
  if (removingItem) {
    void deleteRemoteCartItem(remoteItemId);
    if (!nextCarts[shopId] && remoteCartId) {
      void deleteRemoteCart(remoteCartId);
    }
    return null;
  }
  const updatedItem = nextCarts[shopId]?.items[itemIndex] ?? null;
  if (updatedItem) {
    void syncCartItemWithBackend(shopId, updatedItem);
  }
  return updatedItem;
};

export const removeShopCartItem = async (shopId: string, itemId: string): Promise<boolean> => {
  const nextCarts: Record<string, ShopCart> = { ...state.carts };
  const targetCart = nextCarts[shopId];
  if (!targetCart) return false;
  const updatedCart = { ...targetCart, items: [...targetCart.items] };
  const itemIndex = updatedCart.items.findIndex((entry) => entry.id === itemId);
  if (itemIndex < 0) return false;
  const remoteItemId = updatedCart.items[itemIndex]?.remoteCartItemId;
  const remoteCartId = updatedCart.remoteCartId ?? targetCart.remoteCartId;
  updatedCart.items.splice(itemIndex, 1);
  if (!updatedCart.items.length) {
    delete nextCarts[shopId];
  } else {
    nextCarts[shopId] = updatedCart;
  }
  state = { carts: nextCarts };
  await persistState();
  emit();
  void deleteRemoteCartItem(remoteItemId);
  if (!nextCarts[shopId] && remoteCartId) {
    void deleteRemoteCart(remoteCartId);
  }
  return true;
};

export const deleteShopCart = async (shopId: string): Promise<boolean> => {
  const existingCart = state.carts[shopId];
  if (!existingCart) return false;
  if (existingCart.remoteCartId) {
    const remoteDeleted = await deleteRemoteCart(existingCart.remoteCartId);
    if (!remoteDeleted) {
      return false;
    }
  }
  const nextCarts: Record<string, ShopCart> = { ...state.carts };
  delete nextCarts[shopId];
  state = { carts: nextCarts };
  await persistState();
  emit();
  return true;
};

export const clearShopCart = async () => {
  const remoteCartIds = Object.values(state.carts)
    .map((cart) => cart.remoteCartId)
    .filter(Boolean) as string[];
  state = { ...defaultState };
  await persistState();
  emit();
  remoteCartIds.forEach((id) => {
    void deleteRemoteCart(id);
  });
};

export const getShopCartTotals = () => ({
  totalItems: computeTotalItems(state.carts),
  totalShops: Object.keys(state.carts).length,
});

const normalizeVariantKey = (variantId?: string | null) => {
  if (!variantId) {
    return 'default';
  }
  const trimmed = String(variantId).trim();
  return trimmed ? trimmed : 'default';
};

export type CartProductVariantIndex = Record<string, Set<string>>;

export const buildCartProductIndex = (state: ShopCartState): CartProductVariantIndex => {
  const index: CartProductVariantIndex = {};
  Object.values(state.carts).forEach((cart) => {
    cart.items.forEach((item) => {
      if (!item.productId) return;
      const key = normalizeVariantKey(item.variantId);
      if (!index[item.productId]) {
        index[item.productId] = new Set();
      }
      index[item.productId].add(key);
    });
  });
  return index;
};

export const cartHasProduct = (index: CartProductVariantIndex, productId?: string) => {
  if (!productId) {
    return false;
  }
  const entry = index[productId];
  return Boolean(entry && entry.size > 0);
};

export const cartHasProductVariant = (
  index: CartProductVariantIndex,
  productId?: string,
  variantId?: string | null,
) => {
  if (!productId) {
    return false;
  }
  const entry = index[productId];
  if (!entry) {
    return false;
  }
  return entry.has(normalizeVariantKey(variantId));
};

const buildVariantSnapshot = (item: Pick<ShopCartItem, 'size' | 'color'>) => ({
  size: item.size ?? '',
  color: item.color ?? '',
});

const buildVariantLabel = (item: ShopCartItem) => {
  if (item.variantId) return item.variantId;
  const parts = [];
  if (item.size) parts.push(`size:${item.size}`);
  if (item.color) parts.push(`color:${item.color}`);
  return parts.join('; ') || '';
};

const buildCartItemPayload = (cartId: string, item: ShopCartItem) => ({
  cart: cartId,
  product: item.productId,
  variant: buildVariantLabel(item),
  variant_snapshot: buildVariantSnapshot(item),
  quantity: item.quantity,
  price_snapshot: resolveCartItemPrice(item.price),
  selected_attributes: item.selectedAttributes ?? {},
  custom_description: item.customDescription ?? '',
});

const setRemoteRefsForItem = async (
  shopId: string,
  itemId: string,
  refs: { remoteCartId?: string; remoteCartItemId?: string | null },
) => {
  if (!refs.remoteCartId && !refs.remoteCartItemId) {
    return;
  }
  const cart = state.carts[shopId];
  if (!cart) {
    return;
  }
  const itemIndex = cart.items.findIndex((entry) => entry.id === itemId);
  if (itemIndex < 0) {
    return;
  }
  const nextCart: ShopCart = { ...cart, items: [...cart.items] };
  const targetItem = nextCart.items[itemIndex];
  const updatedItem: ShopCartItem = {
    ...targetItem,
    remoteCartItemId: refs.remoteCartItemId ?? targetItem.remoteCartItemId,
    remoteCartId: refs.remoteCartId ?? targetItem.remoteCartId,
  };
  nextCart.items[itemIndex] = updatedItem;
  if (refs.remoteCartId) {
    nextCart.remoteCartId = refs.remoteCartId;
  }
  const nextCarts = { ...state.carts, [shopId]: nextCart };
  state = { carts: nextCarts };
  await persistState();
  emit();
};

const fetchActiveCartById = async (cartId?: string | null) => {
  if (!cartId) return null;
  try {
    const response = await getRequest(ROUTES.commerce.cart(cartId), {
      forceNetwork: true,
    });
    if (response?.success && response.data?.id && response.data?.status === 'active') {
      return String(response.data.id);
    }
  } catch (error) {
    console.warn('Unable to resolve remote cart by id', error);
  }
  return null;
};

const fetchCurrentActiveCart = async (shopId: string) => {
  if (!shopId) return null;
  const response = await getRequest(ROUTES.commerce.cartCurrent, {
    params: { shop_id: shopId },
    forceNetwork: true,
  });
  if (response?.success && response.data?.id && response.data?.status === 'active') {
    return String(response.data.id);
  }
  return null;
};

const ensureRemoteCart = async (shopId: string, existingRemoteCartId?: string | null) => {
  if (!shopId) return null;
  const existingActiveCart = await fetchActiveCartById(existingRemoteCartId);
  if (existingActiveCart) {
    return existingActiveCart;
  }
  try {
    const currentCartId = await fetchCurrentActiveCart(shopId);
    if (currentCartId) {
      return currentCartId;
    }
    const created = await postRequest(ROUTES.commerce.carts, { shop: shopId });
    if (created?.success && created.data?.id) {
      return String(created.data.id);
    }
    const detail =
      typeof created?.data?.detail === 'string'
        ? created.data.detail
        : typeof created?.message === 'string'
        ? created.message
        : '';
    if (detail.toLowerCase().includes('active cart already exists')) {
      const fallbackCartId = await fetchCurrentActiveCart(shopId);
      if (fallbackCartId) {
        return fallbackCartId;
      }
    }
    if (Number(created?.status) === 400 || Number(created?.status) === 409) {
      const fallbackCartId = await fetchCurrentActiveCart(shopId);
      if (fallbackCartId) {
        return fallbackCartId;
      }
    }
  } catch (error) {
    console.warn('Unable to resolve remote cart', error);
  }
  return null;
};

const syncCartItemWithBackend = async (shopId: string, item: ShopCartItem) => {
  if (!shopId) return null;
  try {
    const existingCart = state.carts[shopId];
    const cartId = await ensureRemoteCart(
      shopId,
      existingCart?.remoteCartId ?? item.remoteCartId,
    );
    if (!cartId) {
      return null;
    }
    const payload = buildCartItemPayload(cartId, item);
    const response = item.remoteCartItemId
      ? await patchRequest(ROUTES.commerce.cartItem(item.remoteCartItemId), payload)
      : await postRequest(ROUTES.commerce.cartItems, payload);
    if (!response?.success) {
      return null;
    }
    const remoteCartId = response.data?.cart ? String(response.data.cart) : cartId;
    const remoteCartItemId = response.data?.id ? String(response.data.id) : item.remoteCartItemId;
    await setRemoteRefsForItem(shopId, item.id, {
      remoteCartId,
      remoteCartItemId,
    });
    return { remoteCartId, remoteCartItemId };
  } catch (error) {
    console.warn('Failed to sync cart item to backend', error);
    return null;
  }
};

const deleteRemoteCartItem = async (remoteItemId?: string | null) => {
  if (!remoteItemId) return;
  try {
    await deleteRequest(ROUTES.commerce.cartItem(remoteItemId));
  } catch (error) {
    console.warn('Failed to delete remote cart item', error);
  }
};

const deleteRemoteCart = async (remoteCartId?: string | null) => {
  if (!remoteCartId) return true;
  try {
    const response = await deleteRequest(ROUTES.commerce.cart(remoteCartId));
    if (response?.success || response?.status === 404) {
      return true;
    }
    console.warn('Failed to delete remote cart', response?.message || response);
    return false;
  } catch (error) {
    console.warn('Failed to delete remote cart', error);
    return false;
  }
};

const mapRemoteCartItem = (shopId: string, cartId: string, item: any): ShopCartItem => ({
  id: `${item.product ?? 'unknown'}-${item.variant || 'default'}`,
  shopId,
  productId: String(item.product ?? ''),
  variantId: item.variant || null,
  name: item.product_name ?? undefined,
  price: resolveCartItemPrice(
    item.price_snapshot ??
      item.unit_price ??
      item.product_price ??
      item.price,
  ) || (Number.isFinite(Number(item.unit_price_cents)) ? Number(item.unit_price_cents) / 100 : 0),
  quantity: Number(item.quantity ?? 0),
  size: item.size || undefined,
  color: item.color || undefined,
  imageUrl: item.product_image ?? undefined,
  selectedAttributes: item.selected_attributes ?? undefined,
  customDescription: item.custom_description || undefined,
  remoteCartId: cartId,
  remoteCartItemId: item.id ? String(item.id) : undefined,
});

const mapRemoteCartToLocal = (remote: any): ShopCart | null => {
  if (!remote || !remote.shop) return null;
  const shopId = String(remote.shop);
  const cartId = remote.id ? String(remote.id) : '';
  const items: ShopCartItem[] = Array.isArray(remote.items)
    ? remote.items.map((item: any) => mapRemoteCartItem(shopId, cartId, item))
    : [];
  return {
    shopId,
    shopName: remote.shop_info?.name,
    shopDescription: remote.shop_info?.description,
    shopImage: remote.shop_info?.image_url ?? remote.shop_info?.image ?? remote.shop_info?.logo,
    remoteCartId: cartId || undefined,
    status: (remote.status ?? 'active') as ShopCartStatus,
    items,
  };
};

const mergeCartItems = (existingItems: ShopCartItem[] = [], incomingItems: ShopCartItem[] = []) => {
  if (incomingItems.length > 0) {
    return incomingItems;
  }
  if (existingItems.length > 0) {
    return existingItems;
  }
  return incomingItems;
};

const upsertLocalCart = async (cart: ShopCart) => {
  const existingCart = state.carts[cart.shopId];
  const nextCarts = {
    ...state.carts,
    [cart.shopId]: {
      ...existingCart,
      ...cart,
      items: mergeCartItems(existingCart?.items, cart.items),
      status: cart.status ?? state.carts[cart.shopId]?.status ?? 'active',
      shopName: cart.shopName ?? existingCart?.shopName,
      shopDescription: cart.shopDescription ?? existingCart?.shopDescription,
      shopImage: cart.shopImage ?? existingCart?.shopImage,
      remoteCartId: cart.remoteCartId ?? existingCart?.remoteCartId,
    },
  };
  state = { carts: nextCarts };
  await persistState();
  emit();
};

export const refreshShopCartFromBackend = async () => {
  try {
    await ensureHydratedState();
    const response = await getRequest(ROUTES.commerce.carts, {
      forceNetwork: true,
    });
    if (!response?.success) return;
    const payload = response.data;
    const cartsData = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.results)
      ? payload.results
      : [];
    for (const entry of cartsData) {
      const localCart = mapRemoteCartToLocal(entry);
      if (!localCart) continue;
      await upsertLocalCart(localCart);
    }
  } catch (error) {
    console.warn('Failed to refresh carts from backend', error);
  }
};

export const refreshShopCartForShop = async (shopId?: string) => {
  if (!shopId) return;
  try {
    await ensureHydratedState();
    const response = await getRequest(ROUTES.commerce.cartCurrent, {
      forceNetwork: true,
      params: { shop_id: shopId },
    });
    if (!response?.success || !response.data) return;
    const localCart = mapRemoteCartToLocal(response.data);
    if (!localCart) return;
    await upsertLocalCart(localCart);
  } catch (error) {
    console.warn('Failed to refresh shop cart', shopId, error);
  }
};

export const setShopCartStatus = async (shopId: string, status: ShopCartStatus) => {
  const nextCarts: Record<string, ShopCart> = { ...state.carts };
  const targetCart = nextCarts[shopId];
  if (!targetCart) return false;
  nextCarts[shopId] = { ...targetCart, status };
  state = { carts: nextCarts };
  await persistState();
  emit();
  return true;
};
