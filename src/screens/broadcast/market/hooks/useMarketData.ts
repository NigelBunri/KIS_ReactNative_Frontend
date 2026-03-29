import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { patchRequest } from '@/network/patch';

import {
  MARKET_FEED_ENDPOINT,
  MARKET_PRODUCTS_ENDPOINT,
  MARKET_SHOPS_ENDPOINT,
  MARKET_JOIN_SHOP_ENDPOINT,
  MARKET_SUBSCRIBE_PRODUCT_ENDPOINT,
  MARKET_BROADCAST_PRODUCT_ENDPOINT,
} from '@/screens/broadcast/market/api/market.endpoints';

import {
  MarketHomePayload,
  MarketProduct,
  MarketShop,
  normalizeHome,
  normalizeList,
} from '@/screens/broadcast/market/api/market.types';

type Params = {
  ownerId?: string | null;
  q?: string;
};

export default function useMarketData({ ownerId = null, q = '' }: Params) {
  const [home, setHome] = useState<MarketHomePayload>({
    featured_drop: null,
    trending_products: [],
    popular_shops: [],
    drops: [],
  });

  const [myShops, setMyShops] = useState<MarketShop[]>([]);
  const [myProducts, setMyProducts] = useState<MarketProduct[]>([]);
  const [loadingHome, setLoadingHome] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);

  const mountedRef = useRef(true);

  const feedQuery = useMemo(() => {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return `${MARKET_FEED_ENDPOINT}${qs}`;
  }, [q]);

  const loadHome = useCallback(async (forceNetwork = false) => {
    setLoadingHome(true);
    const res = await getRequest(feedQuery, { errorMessage: 'Unable to load market.' });
    const payload = normalizeHome(res?.data ?? res);
    if (!mountedRef.current) return;
    setHome(payload);
    setLoadingHome(false);
  }, [feedQuery]);

  const fetchShops = useCallback(
    async (params?: Record<string, string>) => {
      const response = await getRequest(MARKET_SHOPS_ENDPOINT, {
        params,
        errorMessage: 'Unable to load shops.',
      });
      return normalizeList<MarketShop>(response);
    },
    [],
  );

  const fetchProducts = useCallback(
    async (params?: Record<string, string>) => {
      const response = await getRequest(MARKET_PRODUCTS_ENDPOINT, {
        params,
        errorMessage: 'Unable to load products.',
      });
      return normalizeList<MarketProduct>(response);
    },
    [],
  );

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const ownerParams = ownerId ? { owner: ownerId } : undefined;
      let shops = await fetchShops(ownerParams);
      let products = await fetchProducts(ownerParams);

      if (ownerParams && !shops.length) {
        shops = await fetchShops();
        products = await fetchProducts();
      }

      if (!mountedRef.current) return;
      setMyShops(shops);
      setMyProducts(products);
    } catch (error: any) {
      console.warn('Unable to load market owner data:', error?.message ?? error);
      if (!mountedRef.current) return;
      setMyShops([]);
      setMyProducts([]);
    } finally {
      if (!mountedRef.current) return;
      setLoadingMine(false);
    }
  }, [fetchProducts, fetchShops, ownerId]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadHome(), loadMine()]);
  }, [loadHome, loadMine]);

  const joinShop = useCallback(async (shopId: string) => {
    const res = await postRequest(MARKET_JOIN_SHOP_ENDPOINT(shopId), {}, { errorMessage: 'Unable to join shop.' });
    if (res?.success === false) return { ok: false };
    DeviceEventEmitter.emit('broadcast.refresh');
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const subscribeProduct = useCallback(async (productId: string) => {
    const res = await postRequest(MARKET_SUBSCRIBE_PRODUCT_ENDPOINT(productId), {}, { errorMessage: 'Unable to subscribe.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const broadcastProduct = useCallback(async (productId: string) => {
    const res = await postRequest(MARKET_BROADCAST_PRODUCT_ENDPOINT(productId), {}, { errorMessage: 'Unable to broadcast product.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, [reloadAll]);

  const unpublishProduct = useCallback(async (productId: string) => {
    const res = await deleteRequest(MARKET_BROADCAST_PRODUCT_ENDPOINT(productId), { errorMessage: 'Unable to remove broadcast.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, [reloadAll]);

  const deleteShop = useCallback(async (shopId: string) => {
    const res = await deleteRequest(`${MARKET_SHOPS_ENDPOINT}${shopId}/`, { errorMessage: 'Unable to delete shop.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const deleteProduct = useCallback(async (productId: string) => {
    const res = await deleteRequest(`${MARKET_PRODUCTS_ENDPOINT}${productId}/`, { errorMessage: 'Unable to delete product.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const updateShop = useCallback(async (shopId: string, form: FormData) => {
    const res = await patchRequest(`${MARKET_SHOPS_ENDPOINT}${shopId}/`, form, { errorMessage: 'Unable to update shop.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const createShop = useCallback(async (form: FormData) => {
    const res = await postRequest(MARKET_SHOPS_ENDPOINT, form, { errorMessage: 'Unable to create shop.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const updateProduct = useCallback(async (productId: string, form: FormData) => {
    const res = await patchRequest(`${MARKET_PRODUCTS_ENDPOINT}${productId}/`, form, { errorMessage: 'Unable to update product.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  const createProduct = useCallback(async (form: FormData) => {
    const res = await postRequest(MARKET_PRODUCTS_ENDPOINT, form, { errorMessage: 'Unable to add product.' });
    if (res?.success === false) return { ok: false };
    await reloadAll();
    return { ok: true };
  }, [reloadAll]);

  useEffect(() => {
    mountedRef.current = true;
    loadHome();
    loadMine();
    return () => { mountedRef.current = false; };
  }, [loadHome, loadMine]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      loadHome();
      loadMine();
    });
    return () => sub.remove();
  }, [loadHome, loadMine]);

  return {
    home,
    myShops,
    myProducts,
    loadingHome,
    loadingMine,
    reloadAll,

    joinShop,
    subscribeProduct,
    broadcastProduct,
    unpublishProduct,

    deleteShop,
    deleteProduct,
    createShop,
    updateShop,
    createProduct,
    updateProduct,
  };
}
