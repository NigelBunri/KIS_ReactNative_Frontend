import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import { marketLayout, marketStyles } from './market.styles';
import CategoryPickerModal from './CategoryPickerModal';
import { useCatalogCategories } from './useCatalogCategories';
import {
  KIS_COIN_CODE,
  KIS_TO_USD_RATE,
  CATEGORY_SELECTION_LIMIT,
} from '@/screens/market/market.constants';

const PRODUCT_CATEGORY_TYPES = new Set(['product', 'both']);

const INVENTORY_TYPE_OPTIONS = [
  { key: 'PHYSICAL', label: 'Physical' },
  { key: 'DIGITAL', label: 'Digital' },
  { key: 'SERVICE', label: 'Service' },
] as const;

type ProductToggleField = 'is_active' | 'is_featured';

const PRODUCT_TOGGLE_OPTIONS: { field: ProductToggleField; label: string }[] = [
  { field: 'is_active', label: 'Active listing' },
  { field: 'is_featured', label: 'Featured' },
];

type AttributeType = 'text' | 'number' | 'list';

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

type AttributeEntry = {
  id: string;
  label: string;
  type: AttributeType;
  value: string;
  listItems: string[];
  listInput: string;
};

type VariantOption = {
  id: string;
  key: string;
  value: string;
};

type VariantEntry = {
  id: string;
  name: string;
  sku: string;
  price: string;
  sale_price: string;
  stock_qty: string;
  is_active: boolean;
  options: VariantOption[];
};

type ProductFormState = {
  name: string;
  sku: string;
  slug: string;
  description: string;
  price: string;
  sale_price: string;
  currency: string;
  inventory_type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  stock_qty: string;
  low_stock_threshold: string;
  is_active: boolean;
  is_featured: boolean;
  requires_shipping: boolean;
  categoryIds: string[];
};

type ExistingCategory = {
  id: string;
  name?: string;
  category_type?: string;
};

type ExistingProductImage = {
  image_url?: string;
  url?: string;
  uri?: string;
  name?: string;
  alt_text?: string;
};

type ExistingVariant = {
  id?: string;
  name?: string;
  sku?: string;
  price?: number | string | null;
  sale_price?: number | string | null;
  stock_qty?: number | string | null;
  is_active?: boolean;
  options?: Record<string, string>;
};

type ExistingProduct = {
  id?: string | number;
  name?: string;
  sku?: string;
  slug?: string;
  description?: string;
  price?: number | string | null;
  sale_price?: number | string | null;
  currency?: string;
  inventory_type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  stock_qty?: number | string | null;
  low_stock_threshold?: number | string | null;
  is_active?: boolean;
  is_featured?: boolean;
  requires_shipping?: boolean;
  main_image_url?: string;
  main_image?: string;
  gallery_images?: ExistingProductImage[];
  images?: ExistingProductImage[];
  attributes?: Record<string, unknown>;
  variants?: ExistingVariant[] | string;
  catalog_categories?: ExistingCategory[];
};

type ProductEditorPayload = {
  id?: string | number;
  shop_id?: string | number;
  name: string;
  sku: string;
  slug: string;
  description: string;
  price: string;
  sale_price: string | null;
  currency: string;
  inventory_type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  stock_qty: string;
  low_stock_threshold: string | null;
  is_active: boolean;
  is_featured: boolean;
  requires_shipping: boolean;
  catalog_category_ids: string[];
  attributes: Record<string, unknown>;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number | string;
    sale_price: number | string | null;
    stock_qty: number | string;
    is_active: boolean;
    options: Record<string, string>;
  }>;
  main_image?: PickedImage | null;
  gallery_images?: PickedImage[];
  draft?: boolean;
};

type ProductEditorDrawerProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  shop?: { id?: string | number } | null;
  product?: ExistingProduct | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: ProductEditorPayload) => void;
};

const DEFAULT_PRODUCT_FORM: ProductFormState = {
  name: '',
  sku: '',
  slug: '',
  description: '',
  price: '',
  sale_price: '',
  currency: KIS_COIN_CODE,
  inventory_type: 'PHYSICAL',
  stock_qty: '',
  low_stock_threshold: '',
  is_active: true,
  is_featured: false,
  requires_shipping: true,
  categoryIds: [],
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createAttributeEntry = (): AttributeEntry => ({
  id: createId(),
  label: '',
  type: 'text',
  value: '',
  listItems: [],
  listInput: '',
});

const createVariantEntry = (): VariantEntry => ({
  id: createId(),
  name: '',
  sku: '',
  price: '',
  sale_price: '',
  stock_qty: '',
  is_active: true,
  options: [],
});

const createVariantOption = (): VariantOption => ({
  id: createId(),
  key: '',
  value: '',
});

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  sku: string;
  price: string;
  stock: string;
  image: string;
};

export const sanitizeDecimalInput = (value: string) => value.replace(/[^0-9.]/g, '');
export const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');

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

const collectCategoryIds = (categories: ExistingCategory[] | undefined, allowedTypes: Set<string>) =>
  (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      id: category?.id,
      type: String(category?.category_type ?? 'product').toLowerCase(),
    }))
    .filter((entry) => entry.id && allowedTypes.has(entry.type))
    .map((entry) => String(entry.id))
    .slice(0, CATEGORY_SELECTION_LIMIT);

const normalizeListValue = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
};

export const normalizeListInput = (value?: string[] | string | null) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeVariant = (raw: Record<string, unknown>): ProductVariant => ({
  id: String(raw?.id ?? '').trim(),
  size: String(raw?.size ?? raw?.size_value ?? '').trim(),
  color: String(raw?.color ?? raw?.colour ?? '').trim(),
  sku: String(raw?.sku ?? '').trim(),
  price: String(raw?.price ?? raw?.price_amount ?? '').trim(),
  stock: String(raw?.stock ?? raw?.stock_qty ?? '').trim(),
  image: String(raw?.image ?? raw?.image_url ?? '').trim(),
});

const convertAttributesFromProduct = (raw: Record<string, unknown> | undefined): AttributeEntry[] => {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([key, value]) => {
    const isList = Array.isArray(value);
    return {
      id: createId(),
      label: key,
      type: isList ? 'list' : typeof value === 'number' ? 'number' : 'text',
      value: isList ? '' : String(value ?? ''),
      listItems: isList ? normalizeListValue(value) : [],
      listInput: '',
    };
  });
};

const parseVariantsValue = (raw: ExistingProduct['variants']): ExistingVariant[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const convertVariantsFromProduct = (raw: ExistingProduct['variants']): VariantEntry[] => {
  const normalized = parseVariantsValue(raw);
  return normalized.map((variant) => ({
    id: String(variant?.id ?? createId()),
    name: String(variant?.name ?? ''),
    sku: String(variant?.sku ?? ''),
    price: variant?.price != null ? String(variant.price) : '',
    sale_price: variant?.sale_price != null ? String(variant.sale_price) : '',
    stock_qty: variant?.stock_qty != null ? String(variant.stock_qty) : '',
    is_active: variant?.is_active ?? true,
    options: Object.entries(variant?.options ?? {}).map(([key, value]) => ({
      id: createId(),
      key,
      value: String(value ?? ''),
    })),
  }));
};

export default function ProductEditorDrawer({
  visible,
  mode,
  shop,
  product,
  loading = false,
  onClose,
  onSave,
}: ProductEditorDrawerProps) {
  const { palette } = useKISTheme();
  const slide = useRef(new Animated.Value(marketLayout.drawerWidth)).current;

  const [form, setForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [attributeEntries, setAttributeEntries] = useState<AttributeEntry[]>([]);
  const [variantEntries, setVariantEntries] = useState<VariantEntry[]>([]);
  const [productCategoryModalVisible, setProductCategoryModalVisible] = useState(false);

  const [mainImage, setMainImage] = useState<PickedImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<PickedImage[]>([]);

  const { categories: catalogCategories, loading: catalogLoading } = useCatalogCategories('product');

  const productCatalogCategories = useMemo(
    () => (Array.isArray(catalogCategories) ? catalogCategories : []).filter(
      (category: ExistingCategory) => category.category_type !== 'service',
    ),
    [catalogCategories],
  );

  const selectedProductCategories = useMemo(
    () => productCatalogCategories.filter((category: ExistingCategory) => form.categoryIds.includes(String(category.id))),
    [productCatalogCategories, form.categoryIds],
  );

  const chipStyle = (active: boolean) => ({
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? palette.primaryStrong : palette.divider,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: active ? `${palette.primary}15` : palette.surface,
  });

  const chipTextStyle = (active: boolean) => ({
    color: active ? palette.primaryStrong : palette.text,
    fontWeight: '600' as const,
  });

  const updateField = useCallback((changes: Partial<ProductFormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  const toggleBooleanField = (field: ProductToggleField) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const buildAttributesPayload = useCallback((): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    attributeEntries.forEach((entry) => {
      const key = entry.label.trim();
      if (!key) return;

      if (entry.type === 'list') {
        payload[key] = [...entry.listItems];
        return;
      }

      if (entry.type === 'number') {
        const numeric = Number(entry.value);
        payload[key] = Number.isFinite(numeric) ? numeric : entry.value;
        return;
      }

      payload[key] = entry.value;
    });

    return payload;
  }, [attributeEntries]);

  const buildVariantsPayload = useCallback(() => {
    return variantEntries
      .filter((entry) => entry.name.trim() || entry.sku.trim())
      .map((entry) => ({
        id: entry.id,
        name: entry.name.trim(),
        sku: entry.sku.trim(),
        price: Number(entry.price || 0),
        sale_price: entry.sale_price.trim() ? Number(entry.sale_price) : null,
        stock_qty: Number(entry.stock_qty || 0),
        is_active: entry.is_active,
        options: entry.options.reduce<Record<string, string>>((acc, option) => {
          const key = option.key.trim();
          const value = option.value.trim();
          if (key) acc[key] = value;
          return acc;
        }, {}),
      }));
  }, [variantEntries]);

  const formatUsd = useCallback((value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? (parsed * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : marketLayout.drawerWidth,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (!visible) return;

    if (mode === 'edit' && product) {
      const gallerySource = Array.isArray(product.gallery_images)
        ? product.gallery_images
        : Array.isArray(product.images)
          ? product.images
          : [];

      const normalizedGallery = gallerySource
        .map((img, index) => {
          const uri = img?.image_url || img?.url || img?.uri || '';
          if (!uri) return null;
          return {
            uri,
            name: img?.name || `gallery-${index + 1}.jpg`,
            type: 'image/jpeg',
          };
        })
        .filter((item): item is PickedImage => Boolean(item));

      const mainImageUri =
        product.main_image_url ||
        product.main_image ||
        normalizedGallery[0]?.uri ||
        '';

      setForm({
        name: product.name ?? '',
        sku: product.sku ?? '',
        slug: product.slug ?? '',
        description: product.description ?? '',
        price: product.price != null ? String(product.price) : '',
        sale_price: product.sale_price != null ? String(product.sale_price) : '',
        currency: product.currency ?? KIS_COIN_CODE,
        inventory_type: product.inventory_type ?? 'PHYSICAL',
        stock_qty: product.stock_qty != null ? String(product.stock_qty) : '',
        low_stock_threshold:
          product.low_stock_threshold != null ? String(product.low_stock_threshold) : '',
        is_active: product.is_active ?? true,
        is_featured: product.is_featured ?? false,
        requires_shipping: product.requires_shipping ?? true,
        categoryIds: collectCategoryIds(product.catalog_categories, PRODUCT_CATEGORY_TYPES),
      });

      setMainImage(
        mainImageUri
          ? {
              uri: mainImageUri,
              name: 'main-image.jpg',
              type: 'image/jpeg',
            }
          : null,
      );

      setGalleryImages(normalizedGallery);
      setAttributeEntries(convertAttributesFromProduct(product.attributes));
      setVariantEntries(convertVariantsFromProduct(product.variants));
    } else {
      setForm(DEFAULT_PRODUCT_FORM);
      setMainImage(null);
      setGalleryImages([]);
      setAttributeEntries([]);
      setVariantEntries([]);
    }
  }, [visible, mode, product]);

  useEffect(() => {
    if (form.inventory_type === 'DIGITAL' || form.inventory_type === 'SERVICE') {
      if (form.requires_shipping) {
        updateField({ requires_shipping: false });
      }
    }
  }, [form.inventory_type, form.requires_shipping, updateField]);

  const updateAttributeEntry = (id: string, changes: Partial<AttributeEntry>) => {
    setAttributeEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  };

  const removeAttributeEntry = (id: string) => {
    setAttributeEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addAttributeListItem = (id: string) => {
    setAttributeEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const value = entry.listInput.trim();
        if (!value) return entry;
        if (entry.listItems.includes(value)) {
          return { ...entry, listInput: '' };
        }
        return {
          ...entry,
          listItems: [...entry.listItems, value],
          listInput: '',
        };
      }),
    );
  };

  const updateVariantEntry = (id: string, changes: Partial<VariantEntry>) => {
    setVariantEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  };

  const removeVariantEntry = (id: string) => {
    setVariantEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addVariant = () => {
    setVariantEntries((prev) => [...prev, createVariantEntry()]);
  };

  const addVariantOption = (variantId: string) => {
    setVariantEntries((prev) =>
      prev.map((entry) =>
        entry.id === variantId
          ? { ...entry, options: [...entry.options, createVariantOption()] }
          : entry,
      ),
    );
  };

  const updateVariantOption = (
    variantId: string,
    optionId: string,
    changes: Partial<VariantOption>,
  ) => {
    setVariantEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== variantId) return entry;
        return {
          ...entry,
          options: entry.options.map((option) =>
            option.id === optionId ? { ...option, ...changes } : option,
          ),
        };
      }),
    );
  };

  const removeVariantOption = (variantId: string, optionId: string) => {
    setVariantEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== variantId) return entry;
        return {
          ...entry,
          options: entry.options.filter((option) => option.id !== optionId),
        };
      }),
    );
  };

  const handleProductCategorySelect = (categoryId: string) => {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(categoryId);
      if (exists) {
        return { ...prev, categoryIds: prev.categoryIds.filter((id) => id !== categoryId) };
      }
      if (prev.categoryIds.length >= CATEGORY_SELECTION_LIMIT) {
        return prev;
      }
      return { ...prev, categoryIds: [...prev.categoryIds, categoryId] };
    });
  };

  const handlePickMainImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
      const picked = buildPickedImage(result.assets?.[0], 'product_main');
      if (!picked) return;
      setMainImage(picked);
    } catch (error) {
      console.error('Main product image pick failed', error);
    }
  };

  const handleAddGalleryImages = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 20, quality: 0.8 });
      const assets = result.assets ?? [];

      const picks = assets
        .map((asset, index) => buildPickedImage(asset, `product_gallery_${index + 1}`))
        .filter((item): item is PickedImage => Boolean(item));

      if (!picks.length) return;

      setGalleryImages((prev) => {
        const seen = new Set(prev.map((img) => img.uri));
        const additions = picks.filter((img) => !seen.has(img.uri));
        return [...prev, ...additions];
      });
    } catch (error) {
      console.error('Gallery images pick failed', error);
    }
  };

  const handleRemoveGalleryImage = (uri: string) => {
    setGalleryImages((prev) => prev.filter((img) => img.uri !== uri));
  };

  const buildSavePayload = (draft: boolean): ProductEditorPayload => {
    return {
      id: product?.id,
      shop_id: shop?.id,
      name: form.name.trim(),
      sku: form.sku.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      price: form.price.trim(),
      sale_price: form.sale_price.trim() ? form.sale_price.trim() : null,
      currency: form.currency.trim() || KIS_COIN_CODE,
      inventory_type: form.inventory_type,
      stock_qty: form.stock_qty.trim() || '0',
      low_stock_threshold: form.low_stock_threshold.trim()
        ? form.low_stock_threshold.trim()
        : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      requires_shipping: form.inventory_type === 'PHYSICAL' ? form.requires_shipping : false,
      catalog_category_ids: form.categoryIds.filter(Boolean).slice(0, CATEGORY_SELECTION_LIMIT),
      attributes: buildAttributesPayload(),
      variants: buildVariantsPayload(),
      main_image: mainImage,
      gallery_images: galleryImages,
      draft,
    };
  };

  const handleSaveDraft = () => {
    onSave(buildSavePayload(true));
  };

  const handlePublish = () => {
    onSave(buildSavePayload(false));
  };

  const renderAttributesSection = () => {
    const typeOptions: AttributeType[] = ['text', 'number', 'list'];

    return (
      <View style={[marketStyles.drawerSection, { marginTop: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>Attributes</Text>
          <KISButton
            title="Add attribute"
            size="xs"
            variant="secondary"
            onPress={() => setAttributeEntries((prev) => [...prev, createAttributeEntry()])}
          />
        </View>

        <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext, marginTop: 4 }]}>
          Use attributes for descriptive product metadata like material, brand, fit, or warranty.
        </Text>

        {attributeEntries.length === 0 ? (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
            No attributes added yet.
          </Text>
        ) : (
          attributeEntries.map((entry) => {
            const isList = entry.type === 'list';

            return (
              <View
                key={entry.id}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 12,
                  backgroundColor: palette.surface,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>
                    {entry.label || 'Untitled attribute'}
                  </Text>
                  <Pressable onPress={() => removeAttributeEntry(entry.id)} style={{ padding: 4 }}>
                    <KISIcon name="close" size={16} color={palette.error ?? '#E53935'} />
                  </Pressable>
                </View>

                <KISTextInput
                  label="Attribute name"
                  value={entry.label}
                  onChangeText={(value) => updateAttributeEntry(entry.id, { label: value })}
                  style={{ marginTop: 8 }}
                />

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {typeOptions.map((typeOption) => {
                    const active = entry.type === typeOption;
                    return (
                      <Pressable
                        key={typeOption}
                        onPress={() => updateAttributeEntry(entry.id, { type: typeOption })}
                        style={[chipStyle(active), { paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 }]}
                      >
                        <Text style={chipTextStyle(active)}>
                          {typeOption === 'text' ? 'Text' : typeOption === 'number' ? 'Number' : 'List'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {isList ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <KISTextInput
                        label="List item"
                        value={entry.listInput}
                        onChangeText={(value) => updateAttributeEntry(entry.id, { listInput: value })}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <KISButton
                        title="Add"
                        size="xs"
                        variant="secondary"
                        onPress={() => addAttributeListItem(entry.id)}
                      />
                    </View>

                    {entry.listItems.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                        {entry.listItems.map((item) => (
                          <View
                            key={`${entry.id}-${item}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: palette.divider,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              marginRight: 6,
                              marginBottom: 6,
                            }}
                          >
                            <Text style={{ color: palette.text, marginRight: 4 }}>{item}</Text>
                            <Pressable
                              onPress={() =>
                                updateAttributeEntry(entry.id, {
                                  listItems: entry.listItems.filter((listItem) => listItem !== item),
                                })
                              }
                              style={{ padding: 2 }}
                            >
                              <KISIcon name="close" size={12} color={palette.error ?? '#E53935'} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <KISTextInput
                    label={entry.type === 'number' ? 'Value (number)' : 'Value (text)'}
                    value={entry.value}
                    onChangeText={(value) =>
                      updateAttributeEntry(entry.id, {
                        value: entry.type === 'number' ? sanitizeDecimalInput(value) : value,
                      })
                    }
                    keyboardType={entry.type === 'number' ? 'numeric' : 'default'}
                    style={{ marginTop: 8 }}
                  />
                )}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderVariantsSection = () => {
    return (
      <View style={[marketStyles.drawerSection, { marginTop: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>Variants</Text>
          <KISButton title="Add variant" size="xs" variant="secondary" onPress={addVariant} />
        </View>

        <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext, marginTop: 4 }]}>
          Use variants for sellable options with their own SKU, price, stock, and option values.
        </Text>

        {variantEntries.length === 0 ? (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
            No variants added yet.
          </Text>
        ) : (
          variantEntries.map((variant) => (
            <View
              key={variant.id}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 14,
                padding: 12,
                marginTop: 12,
                backgroundColor: palette.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>
                  {variant.name || variant.sku || 'Untitled variant'}
                </Text>
                <Pressable onPress={() => removeVariantEntry(variant.id)} style={{ padding: 4 }}>
                  <KISIcon name="close" size={16} color={palette.error ?? '#E53935'} />
                </Pressable>
              </View>

              <KISTextInput
                label="Variant name"
                value={variant.name}
                onChangeText={(value) => updateVariantEntry(variant.id, { name: value })}
                style={{ marginTop: 8 }}
              />

              <KISTextInput
                label="Variant SKU"
                value={variant.sku}
                onChangeText={(value) => updateVariantEntry(variant.id, { sku: value })}
              />

              <KISTextInput
                label="Variant price"
                value={variant.price}
                onChangeText={(value) => updateVariantEntry(variant.id, { price: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />

              <KISTextInput
                label="Variant sale price"
                value={variant.sale_price}
                onChangeText={(value) =>
                  updateVariantEntry(variant.id, { sale_price: sanitizeDecimalInput(value) })
                }
                keyboardType="numeric"
              />

              <KISTextInput
                label="Variant stock"
                value={variant.stock_qty}
                onChangeText={(value) => updateVariantEntry(variant.id, { stock_qty: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />

              <View style={{ marginTop: 10, marginBottom: 6 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
                  Variant active
                </Text>
                <Pressable
                  onPress={() => updateVariantEntry(variant.id, { is_active: !variant.is_active })}
                  style={[chipStyle(variant.is_active), { alignSelf: 'flex-start', marginTop: 8 }]}
                >
                  <Text style={chipTextStyle(variant.is_active)}>
                    {variant.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>Variant options</Text>
                  <KISButton
                    title="Add option"
                    size="xs"
                    variant="secondary"
                    onPress={() => addVariantOption(variant.id)}
                  />
                </View>

                {variant.options.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
                    No option pairs yet. Example: color = Red, size = M
                  </Text>
                ) : (
                  variant.options.map((option) => (
                    <View
                      key={option.id}
                      style={{
                        borderWidth: 1,
                        borderColor: palette.divider,
                        borderRadius: 12,
                        padding: 10,
                        marginTop: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: palette.text, fontWeight: '600' }}>Option</Text>
                        <Pressable
                          onPress={() => removeVariantOption(variant.id, option.id)}
                          style={{ padding: 4 }}
                        >
                          <KISIcon name="close" size={14} color={palette.error ?? '#E53935'} />
                        </Pressable>
                      </View>

                      <KISTextInput
                        label="Option name"
                        value={option.key}
                        onChangeText={(value) => updateVariantOption(variant.id, option.id, { key: value })}
                        style={{ marginTop: 8 }}
                      />

                      <KISTextInput
                        label="Option value"
                        value={option.value}
                        onChangeText={(value) => updateVariantOption(variant.id, option.id, { value })}
                      />
                    </View>
                  ))
                )}
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <>
      <Pressable style={marketStyles.drawerOverlay} onPress={onClose} />

      <Animated.View
        style={[
          marketStyles.drawerContainer,
          { transform: [{ translateX: slide }], backgroundColor: palette.surface },
        ]}
      >
        <View style={[marketStyles.drawerContent, { backgroundColor: palette.card }]}>
          <View style={[marketStyles.drawerHeader, { borderBottomColor: palette.divider }]}>
            <View>
              <Text style={[marketStyles.drawerTitle, { color: palette.text }]}>
                {mode === 'edit' ? 'Edit product' : 'Add product'}
              </Text>
              <Text style={[marketStyles.drawerSubtitle, { color: palette.subtext }]}>
                Fill in product details, images, attributes, and structured variants.
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <KISIcon name="close" size={22} color={palette.subtext} />
            </Pressable>
          </View>

          <ScrollView
            style={marketStyles.drawerScroll}
            contentContainerStyle={[marketStyles.drawerBody, { paddingBottom: 0 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={marketStyles.drawerSection}>
              <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>
                Product details
              </Text>
              <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext }]}>
                Name, SKU, price, stock, media, and categories should mirror your backend product model.
              </Text>

              <KISTextInput
                label="Product name"
                value={form.name}
                onChangeText={(value) => updateField({ name: value })}
              />

              <KISTextInput
                label="SKU"
                value={form.sku}
                onChangeText={(value) => updateField({ sku: value })}
              />

              <KISTextInput
                label="Slug"
                value={form.slug}
                onChangeText={(value) => updateField({ slug: value })}
              />

              <KISTextInput
                label="Price"
                value={form.price}
                onChangeText={(value) => updateField({ price: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />

              <KISTextInput
                label="Sale price"
                value={form.sale_price}
                onChangeText={(value) => updateField({ sale_price: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />

              <KISTextInput
                label="Currency"
                value={form.currency}
                onChangeText={(value) => updateField({ currency: value.toUpperCase() })}
              />

              <View style={{ marginTop: 6 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 25, marginBottom: 6 }}>
                  Equivalent USD value: ${formatUsd(form.price)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  1 {KIS_COIN_CODE} = ${KIS_TO_USD_RATE} USD
                </Text>
              </View>

              <KISTextInput
                label="Stock quantity"
                value={form.stock_qty}
                onChangeText={(value) => updateField({ stock_qty: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />

              <KISTextInput
                label="Low stock threshold"
                value={form.low_stock_threshold}
                onChangeText={(value) => updateField({ low_stock_threshold: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
                  Inventory type
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {INVENTORY_TYPE_OPTIONS.map((option) => {
                    const active = form.inventory_type === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => updateField({ inventory_type: option.key })}
                        style={chipStyle(active)}
                      >
                        <Text style={chipTextStyle(active)}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <KISTextInput
                label="Description"
                value={form.description}
                onChangeText={(value) => updateField({ description: value })}
                multiline
                style={{ minHeight: 80 }}
              />

              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
                  Listing settings
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {PRODUCT_TOGGLE_OPTIONS.map((option) => {
                    const active = Boolean(form[option.field]);
                    return (
                      <Pressable
                        key={option.field}
                        onPress={() => toggleBooleanField(option.field)}
                        style={chipStyle(active)}
                      >
                        <Text style={chipTextStyle(active)}>{option.label}</Text>
                        <Text style={{ color: active ? palette.primaryStrong : palette.subtext, fontSize: 10 }}>
                          {active ? 'On' : 'Off'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                }}
              >
                <Text style={{ color: palette.subtext, fontSize: 14 }}>Requires shipping</Text>
                <Switch
                  value={form.requires_shipping}
                  disabled={form.inventory_type !== 'PHYSICAL'}
                  onValueChange={(value) => updateField({ requires_shipping: value })}
                  trackColor={{ false: palette.divider, true: palette.primary }}
                  thumbColor={palette.surface}
                />
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                  Main image
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <KISButton
                    title={mainImage ? 'Change main image' : 'Upload main image'}
                    size="sm"
                    onPress={handlePickMainImage}
                  />
                  {mainImage ? (
                    <Image
                      source={{ uri: mainImage.uri }}
                      style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: palette.surface }}
                    />
                  ) : (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Add one primary image for the listing.
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                  Gallery images
                </Text>

                {galleryImages.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {galleryImages.map((image) => (
                      <View
                        key={image.uri}
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          overflow: 'hidden',
                          position: 'relative',
                          marginRight: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Image
                          source={{ uri: image.uri }}
                          style={{ width: '100%', height: '100%', backgroundColor: palette.surface }}
                        />
                        <Pressable
                          onPress={() => handleRemoveGalleryImage(image.uri)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: palette.surface,
                            borderRadius: 12,
                            padding: 2,
                          }}
                        >
                          <KISIcon name="close" size={12} color={palette.error ?? '#E53935'} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No gallery images yet.</Text>
                )}

                <KISButton
                  title={galleryImages.length ? 'Add more gallery images' : 'Add gallery images'}
                  size="sm"
                  onPress={handleAddGalleryImages}
                  style={{ marginTop: 8 }}
                />
              </View>

              {renderAttributesSection()}
              {renderVariantsSection()}

              <View style={{ marginTop: 25 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  Product categories
                </Text>

                {productCatalogCategories.length > 0 ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {selectedProductCategories.map((category: ExistingCategory) => (
                        <View
                          key={String(category.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: palette.divider,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            backgroundColor: palette.surface,
                            marginRight: 8,
                            marginBottom: 8,
                          }}
                        >
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600', marginRight: 6 }}>
                            {category.name || 'Category'}
                          </Text>
                          <Pressable onPress={() => handleProductCategorySelect(String(category.id))} style={{ padding: 4 }}>
                            <KISIcon name="close" size={12} color={palette.error ?? '#E53935'} />
                          </Pressable>
                        </View>
                      ))}

                      {selectedProductCategories.length === 0 ? (
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>No categories added yet.</Text>
                      ) : null}
                    </View>

                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                      {form.categoryIds.length}/{CATEGORY_SELECTION_LIMIT} selected
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
                    {catalogLoading ? 'Loading product categories…' : 'No product categories available yet.'}
                  </Text>
                )}

                <KISButton
                  title="Add product categories"
                  size="sm"
                  variant="secondary"
                  onPress={() => setProductCategoryModalVisible(true)}
                  disabled={catalogLoading || !productCatalogCategories.length}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>

            <View
              style={[
                marketStyles.drawerFooter,
                { borderTopColor: palette.divider, marginTop: 12, paddingTop: 12 },
              ]}
            >
              <View style={marketStyles.drawerFooterActions}>
                <KISButton title="Cancel" variant="outline" size="sm" onPress={onClose} />
              </View>

              <View style={marketStyles.drawerFooterActions}>
                <KISButton
                  title="Save draft"
                  variant="secondary"
                  size="sm"
                  onPress={handleSaveDraft}
                  disabled={loading}
                />
                <KISButton
                  title={mode === 'edit' ? 'Save changes' : 'Publish product'}
                  onPress={handlePublish}
                  loading={loading}
                  size="sm"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      <CategoryPickerModal
        visible={productCategoryModalVisible}
        title="Pick product categories"
        description="Select up to five product categories for this listing."
        categories={productCatalogCategories}
        selectedIds={form.categoryIds}
        selectionLimit={CATEGORY_SELECTION_LIMIT}
        onSelect={(categoryId: string) => handleProductCategorySelect(categoryId)}
        onClose={() => setProductCategoryModalVisible(false)}
      />
    </>
  );
}
