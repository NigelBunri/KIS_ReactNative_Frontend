import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'LegalAid'>;

type Provider = {
  id: string;
  name: string;
  specialty: string;
  city: string;
  country: string;
  is_pro_bono: boolean;
  phone?: string;
  email?: string;
};

export default function LegalAidScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState('All');
  const [specialtyFilter, setSpecialtyFilter] = useState('All');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.legalAid)
        .then((res: any) => {
          if (!active) return;
          setProviders(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setProviders([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const countries = [
    'All',
    ...Array.from(new Set(providers.map((p) => p.country).filter(Boolean))),
  ];
  const specialties = [
    'All',
    ...Array.from(new Set(providers.map((p) => p.specialty).filter(Boolean))),
  ];

  const filtered = providers.filter((p) => {
    const matchCountry =
      countryFilter === 'All' || p.country === countryFilter;
    const matchSpecialty =
      specialtyFilter === 'All' || p.specialty === specialtyFilter;
    return matchCountry && matchSpecialty;
  });

  function handleContact(provider: Provider) {
    const options: { text: string; onPress: () => void }[] = [];
    if (provider.phone) {
      options.push({
        text: `Call: ${provider.phone}`,
        onPress: () => Linking.openURL(`tel:${provider.phone}`),
      });
    }
    if (provider.email) {
      options.push({
        text: `Email: ${provider.email}`,
        onPress: () => Linking.openURL(`mailto:${provider.email}`),
      });
    }
    if (options.length === 0) {
      Alert.alert('No contact info available');
      return;
    }
    Alert.alert(
      `Contact ${provider.name}`,
      undefined,
      [
        ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      {/* Country Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {countries.map((c) => (
          <TouchableOpacity
            key={c}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  countryFilter === c ? palette.primary : palette.surface,
                borderColor:
                  countryFilter === c ? palette.primary : palette.divider,
              },
            ]}
            onPress={() => setCountryFilter(c)}
          >
            <Text
              style={[
                styles.chipText,
                { color: countryFilter === c ? palette.ivory : palette.subtext },
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Specialty Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {specialties.map((s) => (
          <TouchableOpacity
            key={s}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  specialtyFilter === s ? palette.primaryStrong : palette.surface,
                borderColor:
                  specialtyFilter === s ? palette.primaryStrong : palette.divider,
              },
            ]}
            onPress={() => setSpecialtyFilter(s)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    specialtyFilter === s ? palette.ivory : palette.subtext,
                },
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 12,
          paddingBottom: 80,
        }}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="briefcase-outline" size={52} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No legal aid providers found
            </Text>
          </View>
        ) : (
          filtered.map((provider) => (
            <View
              key={provider.id}
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  marginBottom: layout.cardGap,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderInfo}>
                  <Text style={[styles.providerName, { color: palette.text }]}>
                    {provider.name}
                  </Text>
                  <Text
                    style={[styles.specialty, { color: palette.subtext }]}
                  >
                    {provider.specialty}
                  </Text>
                  <Text style={[styles.location, { color: palette.subtext }]}>
                    <KISIcon
                      name="location-outline"
                      size={12}
                      color={palette.subtext}
                    />{' '}
                    {provider.city}, {provider.country}
                  </Text>
                </View>
                {provider.is_pro_bono && (
                  <View
                    style={[
                      styles.proBonoBadge,
                      { backgroundColor: palette.gold },
                    ]}
                  >
                    <Text
                      style={[styles.proBonoBadgeText, { color: palette.bg }]}
                    >
                      Pro Bono
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={[
                  styles.contactBtn,
                  { borderColor: palette.primary, backgroundColor: palette.primarySoft },
                ]}
                onPress={() => handleContact(provider)}
              >
                <KISIcon name="call-outline" size={16} color={palette.primary} />
                <Text style={[styles.contactBtnText, { color: palette.primary }]}>
                  Contact
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterBar: {
    borderBottomWidth: 1,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 3,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  specialty: {
    fontSize: 13,
  },
  location: {
    fontSize: 12,
  },
  proBonoBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  proBonoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    minHeight: 44,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
