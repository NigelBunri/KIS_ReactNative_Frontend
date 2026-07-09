import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CoWorkingSpaces'>;

type Space = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  amenities?: string[];
  price_per_day?: number;
  currency?: string;
  website?: string;
  contact_email?: string;
  description?: string;
};

export default function CoWorkingScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [cityFilter, setCityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const fetchSpaces = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityFilter.trim()) params.set('city', cityFilter.trim());
      if (countryFilter.trim()) params.set('country', countryFilter.trim());
      const res = await getRequest(`${ROUTES.business.coworking}?${params.toString()}`);
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setSpaces(Array.isArray(list) ? list : []);
    } catch {
      setSpaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cityFilter, countryFilter]);

  useFocusEffect(useCallback(() => { fetchSpaces(); }, [fetchSpaces]));

  const openWebsite = (url?: string) => {
    if (!url) return;
    const prefixed = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(prefixed).catch(() => Alert.alert('Cannot open link', prefixed));
  };

  const openEmail = (email?: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => Alert.alert('Cannot open email client'));
  };

  const renderSpace = ({ item }: { item: Space }) => {
    const shownAmenities = (item.amenities ?? []).slice(0, 3);
    const extraCount = (item.amenities?.length ?? 0) - 3;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.spaceIcon, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="business-outline" size={22} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.spaceName}>{item.name}</Text>
            {item.city || item.country ? (
              <View style={styles.locationRow}>
                <KISIcon name="location-outline" size={13} color={palette.subtext} />
                <Text style={styles.locationText}>
                  {[item.city, item.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}
          </View>
          {item.price_per_day != null ? (
            <Text style={[styles.price, { color: palette.primaryStrong }]}>
              {item.currency ?? 'USD'} {item.price_per_day.toLocaleString()}/day
            </Text>
          ) : null}
        </View>

        {shownAmenities.length > 0 ? (
          <View style={styles.amenitiesRow}>
            {shownAmenities.map(a => (
              <View key={a} style={[styles.amenityChip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <Text style={[styles.amenityText, { color: palette.subtext }]}>{a}</Text>
              </View>
            ))}
            {extraCount > 0 ? (
              <View style={[styles.amenityChip, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                <Text style={[styles.amenityText, { color: palette.subtext }]}>+{extraCount} more</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {item.website ? (
            <Pressable
              style={[styles.actionBtn, { borderColor: palette.primary }]}
              onPress={() => openWebsite(item.website)}
              hitSlop={6}
            >
              <KISIcon name="globe-outline" size={15} color={palette.primary} />
              <Text style={[styles.actionBtnText, { color: palette.primary }]}>Website</Text>
            </Pressable>
          ) : null}
          {item.contact_email ? (
            <Pressable
              style={[styles.actionBtn, { borderColor: palette.divider }]}
              onPress={() => openEmail(item.contact_email)}
              hitSlop={6}
            >
              <KISIcon name="mail-outline" size={15} color={palette.subtext} />
              <Text style={[styles.actionBtnText, { color: palette.subtext }]}>Contact</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Co-Working Spaces</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={spaces}
        keyExtractor={item => item.id}
        renderItem={renderSpace}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchSpaces(true)} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.filtersSection}>
            <View style={styles.filterField}>
              <KISIcon name="location-outline" size={16} color={palette.subtext} />
              <TextInput
                style={styles.filterInput}
                placeholder="City..."
                placeholderTextColor={palette.subtext}
                value={cityFilter}
                onChangeText={setCityFilter}
                returnKeyType="search"
                onSubmitEditing={() => fetchSpaces()}
              />
            </View>
            <View style={styles.filterField}>
              <KISIcon name="earth-outline" size={16} color={palette.subtext} />
              <TextInput
                style={styles.filterInput}
                placeholder="Country..."
                placeholderTextColor={palette.subtext}
                value={countryFilter}
                onChangeText={setCountryFilter}
                returnKeyType="search"
                onSubmitEditing={() => fetchSpaces()}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <KISIcon name="business-outline" size={48} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No co-working spaces found</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtn: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    list: { paddingHorizontal: sp, paddingBottom: 80, paddingTop: 4 },
    filtersSection: { gap: 8, paddingVertical: 12 },
    filterField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    },
    filterInput: { flex: 1, fontSize: 14, color: palette.text },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    spaceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    spaceName: { fontSize: 15, fontWeight: '700', color: palette.text, marginBottom: 3 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { fontSize: 13, color: palette.subtext },
    price: { fontSize: 14, fontWeight: '700' },
    amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    amenityChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    amenityText: { fontSize: 12, fontWeight: '500' },
    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.5,
      minHeight: 44,
    },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: '500' },
  });
}
