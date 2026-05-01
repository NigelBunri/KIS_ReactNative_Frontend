import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import KISTextInput from '@/constants/KISTextInput';
import type { MarketFormState } from '@/screens/tabs/profile-screen/types';
import { marketStyles } from './market.styles';
import { launchImageLibrary } from 'react-native-image-picker';

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

export default function ShopEditorDrawer({
  visible,
  mode,
  marketForm,
  loading,
  onChangeField,
  onClose,
  onSave,
  onDelete,
  canDeleteShop,
}: ShopEditorDrawerProps) {
  const { palette } = useKISTheme();
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
        <View
          style={[
            marketStyles.drawerContent,
            { backgroundColor: palette.card },
          ]}
        >
          <View
            style={[
              marketStyles.drawerHeader,
              { borderBottomColor: palette.divider },
            ]}
          >
            <View>
              <Text style={[marketStyles.drawerTitle, { color: palette.text }]}>
                {mode === 'edit' ? 'Edit shop' : 'Create shop'}
              </Text>
              <Text
                style={[
                  marketStyles.drawerSubtitle,
                  { color: palette.subtext },
                ]}
              >
                Keep it short: name, description, employee slots, and image
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <KISIcon name="close" size={22} color={palette.subtext} />
            </Pressable>
          </View>

          <ScrollView
            style={marketStyles.drawerScroll}
            contentContainerStyle={[
              marketStyles.drawerBody,
              { paddingBottom: 0 },
            ]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEventThrottle={16}
          >
            <View style={marketStyles.drawerSection}>
              <View style={marketStyles.drawerSectionHeader}>
                <Text
                  style={[
                    marketStyles.drawerSectionTitle,
                    { color: palette.text },
                  ]}
                >
                  Shop details
                </Text>
              </View>
              <Text
                style={[
                  marketStyles.drawerSectionHelper,
                  { color: palette.subtext },
                ]}
              >
                What the shop is called, how it feels, and who can staff it.
              </Text>
              <KISTextInput
                label="Shop name"
                value={marketForm.name}
                onChangeText={value => onChangeField({ name: value })}
              />
              <KISTextInput
                label="Description"
                value={marketForm.description}
                onChangeText={value => onChangeField({ description: value })}
                multiline
              />
              <KISTextInput
                label="Employee slots"
                value={marketForm.employeeSlots}
                onChangeText={value =>
                  onChangeField({ employeeSlots: value.replace(/[^0-9]/g, '') })
                }
                keyboardType="numeric"
              />
              <KISButton
                title={
                  marketForm.featuredImage
                    ? 'Change shop image'
                    : 'Upload shop image'
                }
                onPress={handlePickShopImage}
              />
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
                <Text
                  style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}
                >
                  Adding an image helps shoppers trust your storefront.
                </Text>
              )}
            </View>
            <View
              style={[
                marketStyles.drawerFooter,
                {
                  borderTopColor: palette.divider,
                  marginTop: 12,
                  paddingTop: 12,
                },
              ]}
            >
              <View style={marketStyles.drawerFooterActions}>
                <KISButton
                  title="Cancel"
                  variant="outline"
                  size="sm"
                  onPress={onClose}
                />
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
                  size="sm"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </>
  );
}
