import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type AddressListNavigation = NativeStackNavigationProp<RootStackParamList, 'Addresses'>;

export type DeliveryAddress = {
  id: string;
  label?: string;
  recipient_name: string;
  recipient_phone: string;
  country: string;
  state?: string;
  city?: string;
  district?: string;
  street_address: string;
  apartment?: string;
  postal_code?: string;
  delivery_instructions?: string;
  is_default: boolean;
};

const EMPTY_FORM = {
  label: '', recipient_name: '', recipient_phone: '', country: '', state: '',
  city: '', street_address: '', apartment: '', postal_code: '', delivery_instructions: '',
};

export default function AddressListPage() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const navigation = useNavigation<AddressListNavigation>();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await getRequest(ROUTES.commerce.addresses, {
      errorMessage: 'Unable to load your addresses.',
    });
    if (response.success) {
      const payload = response.data;
      setAddresses(Array.isArray(payload) ? payload : payload?.results ?? []);
    } else {
      setError(response.message ?? 'Unable to load your addresses.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAddForm = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const openEditForm = useCallback((address: DeliveryAddress) => {
    setEditingId(address.id);
    setForm({
      label: address.label ?? '', recipient_name: address.recipient_name,
      recipient_phone: address.recipient_phone, country: address.country,
      state: address.state ?? '', city: address.city ?? '', street_address: address.street_address,
      apartment: address.apartment ?? '', postal_code: address.postal_code ?? '',
      delivery_instructions: address.delivery_instructions ?? '',
    });
    setFormVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.recipient_name.trim() || !form.recipient_phone.trim() || !form.country.trim() || !form.street_address.trim()) {
      Alert.alert('Missing details', 'Recipient name, phone, country, and street address are required.');
      return;
    }
    setSaving(true);
    const body = { ...form, country: form.country.trim().toUpperCase() };
    const response = editingId
      ? await patchRequest(ROUTES.commerce.address(editingId), body, { errorMessage: 'Unable to update address.' })
      : await postRequest(ROUTES.commerce.addresses, body, { errorMessage: 'Unable to save address.' });
    setSaving(false);
    if (!response.success) {
      Alert.alert('Address', response.message || 'Unable to save address.');
      return;
    }
    setFormVisible(false);
    await load();
  }, [form, editingId, load]);

  const handleDelete = useCallback(async (address: DeliveryAddress) => {
    setBusyId(address.id);
    const response = await deleteRequest(ROUTES.commerce.address(address.id), { errorMessage: 'Unable to delete address.' });
    setBusyId(null);
    if (!response.success) {
      Alert.alert('Address', response.message || 'Unable to delete address.');
      return;
    }
    await load();
  }, [load]);

  const handleSetDefault = useCallback(async (address: DeliveryAddress) => {
    setBusyId(address.id);
    const response = await postRequest(ROUTES.commerce.addressSetDefault(address.id), {}, { errorMessage: 'Unable to set default address.' });
    setBusyId(null);
    if (!response.success) {
      Alert.alert('Address', response.message || 'Unable to set default address.');
      return;
    }
    await load();
  }, [load]);

  const renderItem = ({ item }: { item: DeliveryAddress }) => (
    <View style={[styles.card, { borderColor: palette.surfaceDark, backgroundColor: palette.surfaceElevated }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
          {item.label ? `${item.label} · ` : ''}{item.recipient_name}
        </Text>
        {item.is_default ? (
          <View style={[styles.defaultBadge, { borderColor: palette.primaryLight }]}>
            <Text style={[styles.defaultBadgeText, { color: palette.primaryStrong }]}>Default</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.meta, { color: palette.subtext }]}>{item.recipient_phone}</Text>
      <Text style={[styles.meta, { color: palette.subtext }]} numberOfLines={2}>
        {[item.street_address, item.apartment, item.city, item.state, item.country].filter(Boolean).join(', ')}
      </Text>
      <View style={styles.cardFooter}>
        {!item.is_default ? (
          <KISButton title="Set default" size="xs" variant="ghost" onPress={() => handleSetDefault(item)} disabled={busyId === item.id} />
        ) : null}
        <KISButton title="Edit" size="xs" variant="ghost" onPress={() => openEditForm(item)} disabled={busyId === item.id} />
        <KISButton
          title={busyId === item.id ? 'Removing…' : 'Remove'}
          size="xs" variant="ghost" loading={busyId === item.id}
          onPress={() => handleDelete(item)} disabled={Boolean(busyId)}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
      <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <KISIcon name="arrow-left" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Delivery addresses</Text>
        <KISButton title="Add" size="sm" variant="primary" onPress={openAddForm} />
      </View>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={palette.primaryStrong} /></View>
      ) : error ? (
        <View style={styles.loader}><Text style={{ color: palette.danger }}>{error}</Text></View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 32) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.loader}>
              <Text style={{ color: palette.subtext }}>No saved addresses yet. Add one to start checking out with delivery.</Text>
            </View>
          )}
        />
      )}

      <Modal visible={formVisible} animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
          <View style={[styles.header, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Pressable onPress={() => setFormVisible(false)} style={styles.backButton}>
              <KISIcon name="close" size={18} color={palette.text} />
            </Pressable>
            <Text style={[styles.title, { color: palette.text }]}>{editingId ? 'Edit address' : 'Add address'}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.formScroll}>
            {([
              ['label', 'Label (e.g. Home, Work)'],
              ['recipient_name', 'Recipient name *'],
              ['recipient_phone', 'Recipient phone *'],
              ['country', 'Country code (e.g. NG, US) *'],
              ['state', 'State / Province'],
              ['city', 'City'],
              ['street_address', 'Street address *'],
              ['apartment', 'Apartment / Unit'],
              ['postal_code', 'Postal code'],
              ['delivery_instructions', 'Delivery instructions'],
            ] as const).map(([key, placeholder]) => (
              <TextInput
                key={key}
                style={[styles.input, { borderColor: palette.divider, color: palette.text, backgroundColor: palette.surface }]}
                placeholder={placeholder}
                placeholderTextColor={palette.subtext}
                value={(form as any)[key]}
                onChangeText={text => setForm(prev => ({ ...prev, [key]: text }))}
                autoCapitalize={key === 'country' ? 'characters' : 'sentences'}
              />
            ))}
            <KISButton
              title={saving ? 'Saving…' : 'Save address'}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={{ marginTop: 16 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderWidth: 1, borderRadius: 24, padding: 16, margin: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  backButton: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { borderWidth: 0, borderRadius: 14, padding: 14, marginBottom: 12, gap: 4, elevation: 2, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  loader: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  formScroll: { padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 14 },
});
