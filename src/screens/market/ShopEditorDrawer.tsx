import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import type { MarketFormState } from '@/screens/tabs/profile-screen/types';
import { marketStyles } from './market.styles';
import { Asset, launchImageLibrary } from 'react-native-image-picker';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';

type ShopEditorDrawerProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  marketForm: MarketFormState;
  loading?: boolean;
  onChangeField: (changes: Partial<MarketFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  activeShop?: any | null;
  canDeleteShop?: boolean;
};

type ShopImageUpload = {
  uri: string;
  name: string;
  type: string;
};

type ShopCategorySummary = {
  id: string;
  name?: string;
  category_type?: 'product' | 'service' | 'both';
};

export default function ShopEditorDrawer({
  visible,
  mode,
  marketForm,
  loading,
  onChangeField,
  onClose,
  onSave,
  onDelete,
  activeShop,
  canDeleteShop,
}: ShopEditorDrawerProps) {
  const { palette } = useKISTheme();
  const shopId = marketForm.id ?? activeShop?.id ?? null;
  const canManageCategories = Boolean(shopId);
  const [shopCategories, setShopCategories] = useState<ShopCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [productCategoryName, setProductCategoryName] = useState('');
  const [serviceCategoryName, setServiceCategoryName] = useState('');
  const [savingProductCategory, setSavingProductCategory] = useState(false);
  const [savingServiceCategory, setSavingServiceCategory] = useState(false);

  const normalizeCategoryList = (payload: any): ShopCategorySummary[] => {
    const source = payload?.data ?? payload ?? {};
    const results = source?.results ?? source;
    return Array.isArray(results) ? results : [];
  };

  const fetchCategories = useCallback(async () => {
    if (!shopId) {
      setShopCategories([]);
      return;
    }
    setCategoriesLoading(true);
    try {
      const res = await getRequest(ROUTES.commerce.productCategories, {
        params: { shop: shopId },
        errorMessage: 'Unable to load categories.',
      });
      if (!res.success) {
        throw new Error(res.message);
      }
      setShopCategories(normalizeCategoryList(res.data));
    } catch (error: any) {
      Alert.alert('Categories', error?.message || 'Unable to load categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (!shopId) {
      setShopCategories([]);
      return;
    }
    fetchCategories();
  }, [visible, shopId, fetchCategories]);

  useEffect(() => {
    setProductCategoryName('');
    setServiceCategoryName('');
  }, [shopId]);

  const productCategories = useMemo(
    () => shopCategories.filter((category) => category.category_type !== 'service'),
    [shopCategories],
  );
  const serviceCategories = useMemo(
    () => shopCategories.filter((category) => category.category_type !== 'product'),
    [shopCategories],
  );

  const handleCreateCategory = useCallback(
    async (type: 'product' | 'service') => {
      if (!shopId) {
        Alert.alert('Categories', 'Save the shop to manage categories.');
        return;
      }
      const name = (type === 'product' ? productCategoryName : serviceCategoryName).trim();
      if (!name) {
        Alert.alert('Categories', 'Provide a category name.');
        return;
      }
      const setSaving = type === 'product' ? setSavingProductCategory : setSavingServiceCategory;
      setSaving(true);
      try {
        const res = await postRequest(
          ROUTES.commerce.productCategories,
          { shop: shopId, name, category_type: type },
          { errorMessage: 'Unable to add category.' },
        );
        if (!res.success) {
          throw new Error(res.message);
        }
        await fetchCategories();
        Alert.alert('Categories', 'Category saved.');
        if (type === 'product') {
          setProductCategoryName('');
        } else {
          setServiceCategoryName('');
        }
      } catch (error: any) {
        Alert.alert('Categories', error?.message || 'Unable to add category.');
      } finally {
        setSaving(false);
      }
    },
    [fetchCategories, productCategoryName, serviceCategoryName, shopId],
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      if (!categoryId) return;
      try {
        const res = await deleteRequest(ROUTES.commerce.productCategoryDetail(categoryId), {
          errorMessage: 'Unable to delete category.',
        });
        if (!res.success) {
          throw new Error(res.message);
        }
        await fetchCategories();
        Alert.alert('Categories', 'Category removed.');
      } catch (error: any) {
        Alert.alert('Categories', error?.message || 'Unable to delete category.');
      }
    },
    [fetchCategories],
  );

  const handlePickShopImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (uri) {
        const mime = asset?.type ?? 'image/jpeg';
        const extension = mime.split('/')[1] || 'jpg';
        const name = asset?.fileName || `shop-${Date.now()}.${extension}`;
        const file: ShopImageUpload = { uri, name, type: mime };
        onChangeField({ featuredImage: uri, featuredImageFile: file });
      }
    } catch (error) {
      console.error('Failed to pick shop image', error);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable style={marketStyles.drawerOverlay} onPress={onClose} />
      <View
        style={[
          marketStyles.drawerContainer,
          { backgroundColor: palette.surface },
        ]}
      >
        <View style={[marketStyles.drawerContent, { backgroundColor: palette.card }]}>
          <View style={[marketStyles.drawerHeader, { borderBottomColor: palette.divider }]}>
            <View>
              <Text style={[marketStyles.drawerTitle, { color: palette.text }]}>
                {mode === 'edit' ? 'Edit shop' : 'Create shop'}
              </Text>
              <Text style={[marketStyles.drawerSubtitle, { color: palette.subtext }]}>
                Keep it short: name, description, employee slots, and image
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
            nestedScrollEnabled
            scrollEventThrottle={16}
          >
            <View style={marketStyles.drawerSection}>
              <View style={marketStyles.drawerSectionHeader}>
                <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>
                  Shop details
                </Text>
              </View>
              <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext }]}>
                What the shop is called, how it feels, and who can staff it.
              </Text>
              <KISTextInput
                label="Shop name"
                value={marketForm.name}
                onChangeText={(value) => onChangeField({ name: value })}
              />
              <KISTextInput
                label="Description"
                value={marketForm.description}
                onChangeText={(value) => onChangeField({ description: value })}
                multiline
              />
              <KISTextInput
                label="Employee slots"
                value={marketForm.employeeSlots}
                onChangeText={(value) =>
                  onChangeField({ employeeSlots: value.replace(/[^0-9]/g, '') })
                }
                keyboardType="numeric"
              />
              <KISButton
                title={marketForm.featuredImage ? 'Change shop image' : 'Upload shop image'}
                onPress={handlePickShopImage}
              />
              {console.log('shop form view: ', marketForm)}
              {marketForm.featuredImage ? (
                <Image
                  source={{ uri: marketForm.featuredImage }}
                  style={{
                    width: '100%',
                    height: 140,
                    borderRadius: 14,
                    marginTop: 8,
                    backgroundColor: palette.surface,
                  }}
                />
              ) : (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
                  Adding an image helps shoppers trust your storefront.
                </Text>
              )}
            </View>
            <View style={marketStyles.drawerSection}>
              <View style={marketStyles.drawerSectionHeader}>
                <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>
                  Product categories
                </Text>
              </View>
              <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext }]}>
                Organize product listings by shop-specific categories. Add them here and pick one when adding inventory.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {productCategories.map((category) => (
                  <View
                    key={category.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: palette.divider,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: palette.surface,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                      {category.name || 'Unnamed'}
                    </Text>
                    <Pressable onPress={() => handleDeleteCategory(category.id)} style={{ padding: 4 }}>
                      <KISIcon name="trash" size={14} color={palette.error ?? '#E53935'} />
                    </Pressable>
                  </View>
                ))}
                {!categoriesLoading && productCategories.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No product categories yet.</Text>
                ) : null}
              </View>
              {categoriesLoading ? (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                  Loading categories…
                </Text>
              ) : null}
              {canManageCategories ? (
                <>
                  <KISTextInput
                    label="Category name"
                    value={productCategoryName}
                    onChangeText={setProductCategoryName}
                  />
                  <KISButton
                    title="Create product category"
                    size="sm"
                    onPress={() => handleCreateCategory('product')}
                    loading={savingProductCategory}
                    disabled={savingProductCategory || !productCategoryName.trim()}
                  />
                </>
              ) : (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                  Save or open the shop first to manage categories.
                </Text>
              )}
            </View>
            <View style={marketStyles.drawerSection}>
              <View style={marketStyles.drawerSectionHeader}>
                <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>
                  Service categories
                </Text>
              </View>
              <Text style={[marketStyles.drawerSectionHelper, { color: palette.subtext }]}>
                Create categories that describe the kinds of services you offer so bookings stay structured.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {serviceCategories.map((category) => (
                  <View
                    key={category.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: palette.divider,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: palette.surface,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                      {category.name || 'Unnamed'}
                    </Text>
                    <Pressable onPress={() => handleDeleteCategory(category.id)} style={{ padding: 4 }}>
                      <KISIcon name="trash" size={14} color={palette.error ?? '#E53935'} />
                    </Pressable>
                  </View>
                ))}
                {!categoriesLoading && serviceCategories.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>No service categories yet.</Text>
                ) : null}
              </View>
              {categoriesLoading ? (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                  Loading categories…
                </Text>
              ) : null}
              {canManageCategories ? (
                <>
                  <KISTextInput
                    label="Category name"
                    value={serviceCategoryName}
                    onChangeText={setServiceCategoryName}
                  />
                  <KISButton
                    title="Create service category"
                    size="sm"
                    onPress={() => handleCreateCategory('service')}
                    loading={savingServiceCategory}
                    disabled={savingServiceCategory || !serviceCategoryName.trim()}
                  />
                </>
              ) : (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                  Save or open the shop first to manage categories.
                </Text>
              )}
            </View>
            <View
              style={[
                marketStyles.drawerFooter,
                { borderTopColor: palette.divider, marginTop: 12, paddingTop: 12 },
              ]}
            >
              <View style={marketStyles.drawerFooterActions}>
                <KISButton title="Cancel" variant="outline" size="sm" onPress={onClose} />
                {mode === 'edit' && onDelete && canDeleteShop ? (
                  <KISButton
                    title="Delete shop"
                    variant="danger"
                    size="sm"
                    onPress={onDelete}
                  />
                ) : null}
              </View>
              <View style={marketStyles.drawerFooterActions}>
                <KISButton
                  title="Save draft"
                  variant="secondary"
                  size="sm"
                  onPress={onSave}
                  disabled={loading}
                />
                <KISButton
                  title={mode === 'edit' ? 'Save changes' : 'Publish shop'}
                  onPress={onSave}
                   disabled={loading}
                   size='sm'
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </>
  );
}
