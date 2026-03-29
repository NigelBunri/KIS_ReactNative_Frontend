import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import {
  MarketProduct,
  MarketProductCategory,
  MarketShop,
} from '@/screens/broadcast/market/api/market.types';
import { KIS_COIN_CODE, KIS_COIN_LABEL, KIS_TO_USD_RATE } from '@/screens/market/market.constants';

type PickedImage = { uri: string; name: string; type: string };

type CategoryType = 'product' | 'service' | 'both';

type CategoryFormState = {
  name: string;
  type: CategoryType;
};

const CATEGORY_TYPES: CategoryType[] = ['product', 'service', 'both'];
const CATEGORY_LABELS: Record<CategoryType, string> = {
  product: 'Product',
  service: 'Service',
  both: 'Product + Service',
};

const DEFAULT_PRODUCT_FORM = {
  name: '',
  price: '',
  description: '',
  stock_qty: '0',
  categoryId: '',
};

const normalizeList = (payload: any) => {
  const source = payload?.data ?? payload ?? {};
  const list = source?.results ?? source;
  return Array.isArray(list) ? list : [];
};

const sanitizeDecimalInput = (value: string) => value.replace(/[^0-9.]/g, '');
const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');

const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
  if (!asset?.uri) return null;
  const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
  const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
  return { uri: asset.uri, name, type: asset.type || 'image/jpeg' };
};

const toUploadFile = (picked: PickedImage) => ({ uri: picked.uri, name: picked.name, type: picked.type });

type Props = {
  ownerId?: string | null;
};

export default function MarketProductsPage({ ownerId = null }: Props) {
  const { palette } = useKISTheme();
  const {
    myShops,
    myProducts,
    loadingMine,
    reloadAll,
    createProduct,
    updateProduct,
    deleteProduct,
    broadcastProduct,
    unpublishProduct,
  } = useMarketData({ ownerId, q: '' });

  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MarketProduct | null>(null);
  const [productImages, setProductImages] = useState<PickedImage[]>([]);
  const [form, setForm] = useState({ ...DEFAULT_PRODUCT_FORM });
  const [shopCategories, setShopCategories] = useState<Record<string, MarketProductCategory[]>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({ name: '', type: 'product' });
  const [categorySaving, setCategorySaving] = useState(false);

  const activeShop: MarketShop | null = useMemo(() => {
    if (!myShops.length) return null;
    if (!activeShopId) return myShops[0] ?? null;
    return myShops.find((shop) => shop.id === activeShopId) ?? myShops[0] ?? null;
  }, [myShops, activeShopId]);

  const categoriesForActiveShop = useMemo(() => {
    if (!activeShop?.id) return [];
    return shopCategories[String(activeShop.id)] ?? [];
  }, [activeShop?.id, shopCategories]);

  const selectedCategory = useMemo(
    () => categoriesForActiveShop.find((category) => category.id === form.categoryId) ?? null,
    [categoriesForActiveShop, form.categoryId],
  );

  const productsForActiveShop = useMemo(() => {
    if (!activeShop) return [];
    return myProducts.filter((p) => String(p.shop) === String(activeShop.id));
  }, [myProducts, activeShop]);

  const broadcastedProducts = useMemo(() => {
    return productsForActiveShop.filter((product) => {
      return Boolean(
        product?.is_broadcasted ||
        product?.isBroadcasted ||
        product?.broadcast_item_id ||
        product?.broadcast_id,
      );
    });
  }, [productsForActiveShop]);

  const formatBroadcastPriceLabel = (product: MarketProduct) => {
    const priceValue = product.price !== undefined && product.price !== null ? String(product.price) : '';
    if (!priceValue) return '';
    const currency = (product.currency ?? KIS_COIN_CODE).trim();
    return `Price ${currency} ${priceValue}`;
  };

  const loadCategories = useCallback(async (shopId: string) => {
    setCategoriesLoading(true);
    try {
      const res = await getRequest(`${ROUTES.commerce.productCategories}?shop=${shopId}`, {
        errorMessage: 'Unable to load categories.',
      });
      const next = normalizeList(res);
      setShopCategories((prev) => ({ ...prev, [shopId]: next }));
    } catch (error: any) {
      Alert.alert('Categories', error?.message || 'Unable to load categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeShop?.id) return;
    loadCategories(activeShop.id);
  }, [activeShop?.id, loadCategories]);

  useEffect(() => {
    if (editing) return;
    if (!form.categoryId && categoriesForActiveShop.length) {
      setForm((prev) => ({ ...prev, categoryId: categoriesForActiveShop[0].id }));
    }
  }, [categoriesForActiveShop, editing, form.categoryId]);

  useEffect(() => {
    if (!activeShop || !activeShop.id) return;
    if (!activeShopId) {
      setActiveShopId(String(activeShop.id));
    }
  }, [activeShop, activeShopId]);

  const reset = useCallback(() => {
    setEditing(null);
    setProductImages([]);
    setForm({ ...DEFAULT_PRODUCT_FORM });
  }, []);

  const priceInUsd = useMemo(() => {
    const parsed = Number(form.price);
    return Number.isFinite(parsed) ? (parsed * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  }, [form.price]);

  const pickImages = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 5 });
    if (result.didCancel) return;
    const assets = result.assets ?? [];
    const picked = assets
      .map((asset, index) => buildPickedImage(asset, `product_${Date.now()}_${index}`))
      .filter((item): item is PickedImage => item !== null);
    if (!picked.length) return;
    setProductImages(picked);
  }, []);

  const beginEdit = useCallback(
    (product: MarketProduct) => {
      const targetShopId = product.shop ?? activeShop?.id ?? null;
      setEditing(product);
      setActiveShopId(targetShopId ? String(targetShopId) : null);
      setProductImages([]);
      setForm({
        name: product.name ?? '',
        price:
          product.price !== undefined && product.price !== null ? String(product.price) : '',
        description: product.description ?? '',
        stock_qty: String(product.stock_qty ?? 0),
        categoryId: product.category?.id ?? '',
      });
    },
    [activeShop?.id],
  );

  const handleCreateCategory = useCallback(async () => {
    if (!activeShop?.id) {
      Alert.alert('Categories', 'Create or select a shop before adding categories.');
      return;
    }
    const name = categoryForm.name.trim();
    if (!name) {
      Alert.alert('Categories', 'Provide a name for the category.');
      return;
    }
    setCategorySaving(true);
    try {
      const res = await postRequest(
        ROUTES.commerce.productCategories,
        {
          shop: activeShop.id,
          name,
          category_type: categoryForm.type,
        },
        { errorMessage: 'Unable to add category.' },
      );
      if (!res?.success) {
        Alert.alert('Categories', res?.message || 'Unable to add category.');
        return;
      }
      const created = res.data ?? {};
      const createdId = created?.id ?? '';
      await loadCategories(activeShop.id);
      setCategoryForm((prev) => ({ ...prev, name: '' }));
      if (createdId) {
        setForm((prev) => ({ ...prev, categoryId: createdId }));
      }
      Alert.alert('Categories', 'Category added.');
    } catch (error: any) {
      Alert.alert('Categories', error?.message || 'Unable to add category.');
    } finally {
      setCategorySaving(false);
    }
  }, [activeShop?.id, categoryForm.name, categoryForm.type, loadCategories]);

  const submit = useCallback(async () => {
    const trimmedName = form.name.trim();
    const trimmedPrice = form.price.trim();
    if (!trimmedName || !trimmedPrice) {
      Alert.alert('Market', 'Product name and price are required.');
      return;
    }
    const shopId = editing?.shop ?? activeShop?.id;
    if (!shopId) {
      Alert.alert('Market', 'Create a shop before adding products.');
      return;
    }
    if (!editing && productImages.length === 0) {
      Alert.alert('Market', 'Product image is required.');
      return;
    }
    const formData = new FormData();
    formData.append('shop', String(shopId));
    formData.append('sku', `${shopId}-${Date.now()}`);
    formData.append('name', trimmedName);
    formData.append('slug', trimmedName.toLowerCase().replace(/\s+/g, '-'));
    formData.append('description', form.description.trim());
    formData.append('price', trimmedPrice);
    formData.append('currency', KIS_COIN_CODE);
    const stockQty = Math.max(0, Number(form.stock_qty || 0));
    formData.append('stock_qty', String(Number.isFinite(stockQty) ? Math.floor(stockQty) : 0));
    if (form.categoryId) {
      formData.append('category_id', form.categoryId);
    }

    const selectedFiles = productImages;
    if (selectedFiles.length) {
      if (editing) {
        selectedFiles.forEach((file) => {
          formData.append('images', toUploadFile(file) as any);
        });
      } else {
        const [primary, ...rest] = selectedFiles;
        if (primary) {
          formData.append('image_file', toUploadFile(primary) as any);
          rest.forEach((file) => formData.append('images', toUploadFile(file) as any));
        }
      }
    }

    const response = editing?.id ? await updateProduct(editing.id, formData) : await createProduct(formData);
    if (response?.ok) {
      reset();
      await reloadAll();
    }
  }, [form, productImages, editing, activeShop?.id, createProduct, updateProduct, reloadAll, reset]);

  const stagedImageUrls = useMemo(() => {
    const urls = [...productImages.map((img) => img.uri)];
    (editing?.images ?? []).forEach((img) => {
      if (img.image_url) urls.push(img.image_url);
    });
    if (!urls.length && editing?.image_url) {
      urls.push(editing.image_url);
    }
    return urls;
  }, [productImages, editing]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12, paddingTop: 12 }}>
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Products</Text>
            <Text
              onPress={reloadAll}
              style={{ color: palette.subtext, fontWeight: '900' }}
              suppressHighlighting
            >
              {loadingMine ? 'Loading…' : 'Refresh'}
            </Text>
          </View>

          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
            Active shop: {activeShop?.name ?? 'None'}
          </Text>

          <View
            style={{
              borderWidth: 2,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 18,
              padding: 12,
              gap: 10,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 15 }}>Broadcast</Text>
            {broadcastedProducts.length ? (
              <View style={{ gap: 10 }}>
                {broadcastedProducts.map((product) => (
                  <MarketProductCard
                    key={`broadcast-${product.id}`}
                    title={product.name ?? 'Product'}
                    subtitle={product.description ?? product.category?.name ?? ''}
                    priceLabel={formatBroadcastPriceLabel(product)}
                    coverUrl={product.image_url ?? null}
                    badgeText="BROADCAST"
                    ctaLabel="Remove broadcast"
                    onCTA={async () => {
                      const res = await unpublishProduct(product.id);
                      if (res?.ok) {
                        Alert.alert('Broadcast', 'Product removed from broadcasts.');
                      } else {
                        Alert.alert('Broadcast', 'Unable to remove broadcast.');
                      }
                    }}
                    onPress={() => {}}
                  />
                ))}
              </View>
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Broadcasted products appear here once you publish them from the shop dashboard.
              </Text>
            )}
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>Categories</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {categoriesForActiveShop.map((category) => {
                  const isActive = category.id === form.categoryId;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setForm((prev) => ({ ...prev, categoryId: category.id }))}
                      style={{
                        borderWidth: 2,
                        borderColor: isActive ? palette.primary : palette.divider,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: isActive ? palette.primarySoft : palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? palette.primaryStrong : palette.text,
                          fontWeight: '900',
                          fontSize: 12,
                        }}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {!categoriesLoading && categoriesForActiveShop.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No categories yet.</Text>
                ) : null}
              </View>
              {categoriesLoading && (
                <Text style={{ color: palette.subtext, fontSize: 12 }}>Loading categories…</Text>
              )}
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Selected: {selectedCategory?.name ?? 'None'}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>Add a category</Text>
              <KISTextInput
                label="Category name"
                value={categoryForm.name}
                onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, name: value }))}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORY_TYPES.map((type) => {
                  const active = categoryForm.type === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setCategoryForm((prev) => ({ ...prev, type }))}
                      style={{
                        borderWidth: 1,
                        borderColor: active ? palette.primary : palette.divider,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? palette.primarySoft : palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? palette.primaryStrong : palette.text,
                          fontWeight: '900',
                          fontSize: 12,
                        }}
                      >
                        {CATEGORY_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <KISButton
                title="Create category"
                size="sm"
                onPress={handleCreateCategory}
                disabled={!activeShop?.id || !categoryForm.name.trim() || categorySaving}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <KISButton title="Select product images" size="sm" onPress={pickImages} />
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {stagedImageUrls.length ? `${stagedImageUrls.length} image${stagedImageUrls.length === 1 ? '' : 's'} ready` : 'Image required'}
            </Text>
          </View>

          {stagedImageUrls.length ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {stagedImageUrls.slice(0, 4).map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: palette.surface }}
                />
              ))}
              {stagedImageUrls.length > 4 && (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: palette.divider,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.surfaceElevated,
                  }}
                >
                  <Text style={{ color: palette.subtext, fontWeight: '900' }}>+{stagedImageUrls.length - 4}</Text>
                </View>
              )}
            </View>
          ) : null}

          <KISTextInput label="Product name" value={form.name} onChangeText={(t) => setForm((prev) => ({ ...prev, name: t }))} />
          <KISTextInput
            label="Price"
            value={form.price}
            onChangeText={(t) => setForm((prev) => ({ ...prev, price: sanitizeDecimalInput(t) }))}
            keyboardType="decimal-pad"
          />
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Approximate USD value: ${priceInUsd}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              1 {KIS_COIN_CODE} = ${KIS_TO_USD_RATE} USD (fixed)
            </Text>
          </View>
          <KISTextInput
            label="Stock"
            value={form.stock_qty}
            onChangeText={(t) => setForm((prev) => ({ ...prev, stock_qty: sanitizeIntegerInput(t) }))}
            keyboardType="number-pad"
          />
          <KISTextInput
            label="Description"
            value={form.description}
            onChangeText={(t) => setForm((prev) => ({ ...prev, description: t }))}
            multiline
            style={{ minHeight: 80 }}
          />

          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <KISButton
              title={editing ? 'Update product' : 'Add product'}
              onPress={submit}
            />
            {editing ? <KISButton title="Cancel" variant="secondary" size="sm" onPress={reset} /> : null}
          </View>

          {!editing && productsForActiveShop.length !== 0 && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              You can organize listings with categories per shop. Add or select one above.
            </Text>
          )}
        </View>

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Manage listings</Text>

          {!productsForActiveShop.length ? (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>No products for this shop yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {productsForActiveShop.map((product) => {
                const listingImages = (product.images ?? [])
                  .map((img) => img.image_url)
                  .filter((uri): uri is string => Boolean(uri));
                if (!listingImages.length && product.image_url) {
                  listingImages.push(product.image_url);
                }
                return (
                  <View
                    key={product.id}
                    style={{
                      borderWidth: 2,
                      borderColor: palette.divider,
                      backgroundColor: palette.surface,
                      borderRadius: 18,
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '900' }}>{product.name}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>
                          {product.price ?? ''} {product.currency ?? ''} · Stock: {product.stock_qty ?? 0}
                        </Text>
                        {product.category?.name ? (
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>
                            Category: {product.category.name}
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        <KISButton title="Edit" size="sm" variant="secondary" onPress={() => beginEdit(product)} />
                        <KISButton
                          title="Delete"
                          size="sm"
                          variant="secondary"
                          onPress={() =>
                            Alert.alert('Delete product', 'Remove this listing?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteProduct(product.id); } },
                            ])
                          }
                        />
                      </View>
                    </View>

                    {listingImages.length ? (
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {listingImages.slice(0, 3).map((uri, index) => (
                          <Image
                            key={`${product.id}-thumb-${index}`}
                            source={{ uri }}
                            style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: palette.surface }}
                          />
                        ))}
                        {listingImages.length > 3 && (
                          <View
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              borderWidth: 2,
                              borderColor: palette.divider,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: palette.surfaceElevated,
                            }}
                          >
                            <Text style={{ color: palette.subtext, fontWeight: '900' }}>+{listingImages.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      <KISButton
                        title="Broadcast"
                        size="sm"
                        onPress={async () => {
                          const r = await broadcastProduct(product.id);
                          if (r.ok) Alert.alert('Broadcast', 'Product added to broadcast.');
                        }}
                      />
                      <KISButton title="Schedule" size="sm" variant="secondary" onPress={() => Alert.alert('Schedule', 'Drop scheduling hook ready.')} />
                      <KISButton title="Pin" size="sm" variant="secondary" onPress={() => Alert.alert('Pinned', 'Pin hook ready.')} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
