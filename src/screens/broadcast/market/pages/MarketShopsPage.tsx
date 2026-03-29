import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import { MarketShop } from '@/screens/broadcast/market/api/market.types';

type PickedImage = { uri: string; name: string; type: string };

type Props = {
  ownerId?: string | null;
  canUseMarket?: boolean;
  onUpgrade?: () => void;
};

const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
  if (!asset?.uri) return null;
  const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
  const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
  return { uri: asset.uri, name, type: asset.type || 'image/jpeg' };
};

const normalizeEmployeeSlots = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return '1';
  }
  return String(Math.floor(parsed));
};

export default function MarketShopsPage({ ownerId = null, canUseMarket = false, onUpgrade }: Props) {
  const { palette } = useKISTheme();
  const { myShops, loadingMine, createShop, updateShop, deleteShop, reloadAll } = useMarketData({
    ownerId,
    q: '',
  });
  const normalizedOwnerId = useMemo(() => {
    return ownerId ? String(ownerId) : null;
  }, [ownerId]);
  const isShopOwnedByUser = useCallback(
    (shopOwner?: string | null) => {
      if (!normalizedOwnerId || !shopOwner) {
        return false;
      }
      return normalizedOwnerId === String(shopOwner);
    },
    [normalizedOwnerId],
  );
  const handleDeleteShop = useCallback(
    async (shopId: string, shopOwner?: string | null) => {
      if (!shopId) return;
      if (!isShopOwnedByUser(shopOwner)) {
        Alert.alert('Delete shop', 'Only the shop owner can delete this shop.');
        return;
      }
      await deleteShop(shopId);
    },
    [deleteShop, isShopOwnedByUser],
  );

  const [editing, setEditing] = useState<MarketShop | null>(null);
  const [shopImage, setShopImage] = useState<PickedImage | null>(null);
  const [shopImagePreview, setShopImagePreview] = useState<string>('');

  const [form, setForm] = useState({ name: '', description: '', employeeSlots: '1' });

  const reset = () => {
    setEditing(null);
    setShopImage(null);
    setShopImagePreview('');
    setForm({ name: '', description: '', employeeSlots: '1' });
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'shop');
    if (!picked) return;
    setShopImage(picked);
    setShopImagePreview(asset?.uri || '');
  };

  const beginEdit = (s: MarketShop) => {
    setEditing(s);
    setForm({
      name: s.name ?? '',
      description: s.description ?? '',
      employeeSlots: String(s.employee_slots ?? 1),
    });
    setShopImagePreview(s.image_url ?? '');
    setShopImage(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Market', 'Shop name is required.');
      return;
    }

    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('employee_slots', normalizeEmployeeSlots(form.employeeSlots));
    fd.append('description', form.description.trim());

    if (shopImage) {
      fd.append('image_file', { uri: shopImage.uri, name: shopImage.name, type: shopImage.type } as any);
    }

    if (editing?.id) {
      const r = await updateShop(editing.id, fd);
      if (r.ok) {
        reset();
        await reloadAll();
      }
      return;
    }

    const r = await createShop(fd);
    if (r.ok) {
      reset();
      await reloadAll();
    }
  };

  if (!canUseMarket) {
    return (
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 22, padding: 12, backgroundColor: palette.card, gap: 10 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Marketplace studio</Text>
          <Text style={{ color: palette.subtext, fontWeight: '700' }}>
            Upgrade to a Business tier to open a shop, manage listings, and broadcast products.
          </Text>

          <Pressable
            onPress={onUpgrade}
            style={{ borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Upgrade</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12, paddingTop: 12 }}>
        <View style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 22, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Shops</Text>
            <Text onPress={reloadAll} style={{ color: palette.subtext, fontWeight: '900' }} suppressHighlighting>
              {loadingMine ? 'Loading…' : 'Refresh'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <KISButton title={shopImagePreview ? 'Update shop image' : 'Choose shop image'} size="sm" onPress={pickImage} />
            {shopImagePreview ? (
              <Image source={{ uri: shopImagePreview }} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: palette.surface }} />
            ) : (
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>Image recommended</Text>
            )}
          </View>

          <KISTextInput
            label={editing ? 'Update store name' : 'Store name'}
            value={form.name}
            onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
          />
          <KISTextInput
            label="Description"
            value={form.description}
            onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
            multiline
            style={{ minHeight: 80 }}
          />
          <KISTextInput
            label="Employee slots"
            value={form.employeeSlots}
            onChangeText={(t) => setForm((p) => ({ ...p, employeeSlots: t.replace(/[^0-9]/g, '') }))}
            keyboardType="numeric"
          />

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <KISButton title={editing ? 'Update shop' : 'Create shop'} onPress={submit} />
            {editing ? <KISButton title="Cancel" variant="secondary" size="sm" onPress={reset} /> : null}
          </View>
        </View>

        <View style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 22, padding: 12, gap: 10 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Your shops</Text>

          {!myShops.length ? (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>You don’t have a shop yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {myShops.map((s) => {
                const isOwner = isShopOwnedByUser(s.owner);
                return (
                  <View
                    key={s.id}
                    style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.surface, borderRadius: 18, padding: 12, gap: 8 }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '900' }}>{s.name ?? 'Shop'}</Text>
                    {s.description ? (
                      <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>{s.description}</Text>
                    ) : null}
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>
                      Employee slots: {s.employee_slots ?? 1}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      <KISButton title="Edit" size="sm" variant="secondary" onPress={() => beginEdit(s)} />
                      {isOwner && (
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
                                onPress: () => handleDeleteShop(s.id, s.owner),
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
        </View>
      </View>
    </ScrollView>
  );
}
