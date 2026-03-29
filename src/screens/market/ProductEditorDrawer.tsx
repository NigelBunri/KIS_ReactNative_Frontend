import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import { marketLayout, marketStyles } from './market.styles';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { KIS_COIN_CODE, KIS_COIN_LABEL, KIS_TO_USD_RATE } from '@/screens/market/market.constants';

type CategoryOption = {
  id: string;
  name?: string;
  category_type?: 'product' | 'service' | 'both';
};

const DEFAULT_PRODUCT_FORM = {
  name: '',
  price: '',
  stock: '',
  description: '',
  featuredImage: '',
  categoryId: '',
};

type ProductEditorDrawerProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  shop?: any;
  product?: any | null;
  categories?: CategoryOption[];
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: typeof DEFAULT_PRODUCT_FORM & { shopId?: any; id?: any; draft?: boolean; images?: PickedImage[] }) => void;
};

type PickedImage = { uri: string; name: string; type: string };

const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
  if (!asset?.uri) return null;
  const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
  const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
  return { uri: asset.uri, name, type: asset.type || 'image/jpeg' };
};

const sanitizeDecimalInput = (value: string) => value.replace(/[^0-9.]/g, '');
const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');

export default function ProductEditorDrawer({
  visible,
  mode,
  shop,
  product,
  categories,
  loading,
  onClose,
  onSave,
}: ProductEditorDrawerProps) {
  const { palette } = useKISTheme();
  const slide = useRef(new Animated.Value(marketLayout.drawerWidth)).current;
  const [form, setForm] = useState(DEFAULT_PRODUCT_FORM);
  const [galleryImages, setGalleryImages] = useState<PickedImage[]>([]);
  const availableProductCategories = useMemo(
    () => (categories ?? []).filter((category) => category.category_type !== 'service'),
    [categories],
  );
  const selectedCategory = useMemo(
    () => availableProductCategories.find((category) => category.id === form.categoryId) ?? null,
    [availableProductCategories, form.categoryId],
  );

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
      const existingImages = Array.isArray(product.images) ? product.images : [];
      const normalizedImages = existingImages
        .map((img, index) => {
          const uri = img?.image_url || img?.url || img?.uri || '';
          if (!uri) return null;
          return {
            uri,
            name: img?.name || `existing-${index}.jpg`,
            type: 'image/jpeg',
          };
        })
        .filter((item): item is PickedImage => Boolean(item));
      setForm({
        name: product.name ?? '',
        price: String(product.price ?? ''),
        stock: String(product.stock_qty ?? product.stock ?? ''),
        description: product.description ?? '',
        featuredImage:
          product.featured_image ??
          normalizedImages[0]?.uri ??
          product.image_url ??
          '',
        categoryId: product.category?.id ?? product.category_id ?? '',
      });
      setGalleryImages(normalizedImages);
    } else {
      setForm(DEFAULT_PRODUCT_FORM);
      setGalleryImages([]);
    }
  }, [visible, mode, product]);

  const updateField = (changes: Partial<typeof DEFAULT_PRODUCT_FORM>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  };

  const handleSaveDraft = () => {
    onSave({ ...form, shopId: shop?.id, id: product?.id, draft: true });
  };

  const handlePublish = () => {
    onSave({ ...form, shopId: shop?.id, id: product?.id, images: galleryImages });
  };

  const formatUsd = useCallback(
    (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? (parsed * KIS_TO_USD_RATE).toFixed(2) : '0.00';
    },
    [],
  );

  const handleAddProductImages = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 20, quality: 0.8 });
      const assets = result.assets ?? [];
      const picks = assets
        .filter((asset): asset is Asset => Boolean(asset?.uri))
        .map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `product-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        }));
      if (picks.length) {
        setGalleryImages((prev) => {
          const seen = new Set(prev.map((img) => img.uri));
          const additions = picks.filter((item) => !seen.has(item.uri));
          if (!form.featuredImage && additions[0]) {
            updateField({ featuredImage: additions[0].uri });
          }
          return [...prev, ...additions];
        });
      }
    } catch (error) {
      console.error('Product images pick failed', error);
    }
  }, [form.featuredImage, updateField]);

  const handlePickProductImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      const picked = buildPickedImage(result.assets?.[0], 'product_featured');
      if (picked) {
        updateField({ featuredImage: picked.uri });
        setGalleryImages((prev) => {
          const seen = new Set(prev.map((img) => img.uri));
          if (seen.has(picked.uri)) return prev;
          return [...prev, picked];
        });
      }
    } catch (error) {
      console.error('Product image pick failed', error);
    }
  };

  const handleRemoveProductImage = useCallback(
    (uri: string) => {
      setGalleryImages((prev) => {
        const remaining = prev.filter((img) => img.uri !== uri);
        if (form.featuredImage === uri) {
          updateField({ featuredImage: remaining[0]?.uri ?? '' });
        }
        return remaining;
      });
    },
    [form.featuredImage, updateField],
  );

  if (!visible) {
    return null;
  }

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
                Keep entries concise so people can publish faster.
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
                Name, price, stock, and a short description are enough to launch a listing.
              </Text>
              <KISTextInput label="Product name" value={form.name} onChangeText={(value) => updateField({ name: value })} />
              <KISTextInput
                label="Price"
                value={form.price}
                onChangeText={(value) => updateField({ price: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 25, marginBottom: 6 }}>
                  Equivalent USD value: ${formatUsd(form.price)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  1 {KIS_COIN_CODE} = ${KIS_TO_USD_RATE} USD (fixed — cannot change)
                </Text>
              </View>
              <KISTextInput
                label="Stock"
                value={form.stock}
                onChangeText={(value) => updateField({ stock: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Description"
                value={form.description}
                onChangeText={(value) => updateField({ description: value })}
                multiline
                style={{ minHeight: 80 }}
              />
              <View style={{ marginTop: 25 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  Select a category
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {availableProductCategories.map((category) => {
                    const isActive = category.id === form.categoryId;
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => updateField({ categoryId: category.id })}
                        style={{
                          borderWidth: 1,
                          borderColor: isActive ? palette.primary : palette.divider,
                          backgroundColor: isActive ? `${palette.primary}22` : palette.surface,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? palette.primaryStrong : palette.text,
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                        >
                          {category.name ?? 'Category'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!availableProductCategories.length && (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Add categories from your shop settings to tag this product.
                    </Text>
                  )}
                </View>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                  Selected: {selectedCategory?.name ?? 'None'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <KISButton
                  title={form.featuredImage ? 'Change image' : 'Upload image'}
                  size="sm"
                  onPress={handlePickProductImage}
                />
                {form.featuredImage ? (
                  <Image
                    source={{ uri: form.featuredImage }}
                    style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: palette.surface }}
                  />
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Image helps shoppers trust it.</Text>
                )}
              </View>
              <View style={{ marginTop: 10, gap: 6 }}>
                {galleryImages.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {galleryImages.map((image) => (
                      <View
                        key={image.uri}
                        style={{ width: 58, height: 58, borderRadius: 16, overflow: 'hidden', position: 'relative' }}
                      >
                        <Image
                          source={{ uri: image.uri }}
                          style={{ width: '100%', height: '100%', backgroundColor: palette.surface }}
                        />
                        <Pressable
                          onPress={() => handleRemoveProductImage(image.uri)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: palette.surfaceElevated,
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
                  title={galleryImages.length ? 'Add another image' : 'Add gallery image'}
                  size="sm"
                  onPress={handleAddProductImages}
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
                  size='sm'
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}
