import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TalentDiscover'>;

const INDUSTRIES = [
  'All Industries',
  'Technology',
  'Healthcare',
  'Education',
  'Finance',
  'Ministry',
  'Media',
  'Other',
];

type Profile = {
  id: string;
  user_id?: string;
  display_name?: string;
  headline?: string | null;
  industry?: string | null;
  open_to_work?: boolean;
};

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
};

export default function TalentDiscoverScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [search, setSearch] = useState('');
  const [openToWorkOnly, setOpenToWorkOnly] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pendingConnections, setPendingConnections] = useState<Set<string>>(new Set());

  const fetchProfiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (openToWorkOnly) params.set('open_to_work', 'true');
      if (selectedIndustry !== 'All Industries') params.set('industry', selectedIndustry);
      if (route.params?.partnerId) params.set('partner_id', route.params.partnerId);
      const url = `${ROUTES.profiles.discover}?${params.toString()}`;
      const res = await getRequest(url, { errorMessage: 'Unable to load profiles.' });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setProfiles(Array.isArray(list) ? list : []);
    } catch {
      setProfiles([]);
      setFetchError('Unable to load profiles. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, openToWorkOnly, selectedIndustry, route.params?.partnerId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const showIndustryPicker = () => {
    Alert.alert(
      'Select Industry',
      undefined,
      INDUSTRIES.map((industry) => ({
        text: industry,
        onPress: () => setSelectedIndustry(industry),
      })),
    );
  };

  const handleConnect = useCallback(async (profile: Profile) => {
    const userId = profile.user_id ?? profile.id;
    setActionLoadingId(userId);
    try {
      await postRequest(ROUTES.connections.list, { user_id: userId });
      setPendingConnections(prev => new Set(prev).add(userId));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleViewProfile = useCallback((profile: Profile) => {
    const userId = profile.user_id ?? profile.id;
    navigation.navigate('ViewProfile', {
      userId,
      displayName: profile.display_name,
    });
  }, [navigation]);

  const renderProfile = ({ item }: { item: Profile }) => {
    const userId = item.user_id ?? item.id;
    const name = item.display_name ?? 'Unknown';
    const initials = getInitials(name);
    const isLoading = actionLoadingId === userId;
    const isPending = pendingConnections.has(userId);
    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
                {name}
              </Text>
              {item.open_to_work ? (
                <View style={[styles.openBadge, { backgroundColor: palette.successSoft }]}>
                  <Text style={[styles.openBadgeText, { color: palette.success }]}>Open to Work</Text>
                </View>
              ) : null}
            </View>
            {item.headline ? (
              <Text style={[styles.headline, { color: palette.subtext }]} numberOfLines={2}>
                {item.headline}
              </Text>
            ) : null}
            {item.industry ? (
              <Text style={[styles.industry, { color: palette.subtext }]}>{item.industry}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => handleViewProfile(item)}
          >
            <Text style={[styles.actionBtnText, { color: palette.text }]}>View Profile</Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionBtn,
              {
                backgroundColor: isPending ? palette.surface : palette.primary,
                borderColor: palette.border,
              },
            ]}
            onPress={() => !isPending && handleConnect(item)}
            disabled={isLoading || isPending}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.onPrimary} />
            ) : (
              <Text style={[styles.actionBtnText, { color: isPending ? palette.subtext : palette.onPrimary }]}>
                {isPending ? 'Pending' : 'Connect'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Find Talent</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={renderProfile}
        contentContainerStyle={{ paddingHorizontal: responsive.pageGutter, paddingBottom: 32, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchProfiles(true)} />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.searchRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <KISIcon name="search" size={18} color={palette.subtext} />
              <TextInput
                style={[styles.searchInput, { color: palette.text }]}
                placeholder="Search by name or skill..."
                placeholderTextColor={palette.subtext}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
            </View>
            <View style={styles.filtersRow}>
              <Pressable
                style={[styles.industryPicker, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={showIndustryPicker}
              >
                <Text style={[styles.industryPickerText, { color: palette.text }]}>{selectedIndustry}</Text>
                <KISIcon name="arrow-left" size={14} color={palette.subtext} style={{ transform: [{ rotate: '-90deg' }] }} />
              </Pressable>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: palette.text }]}>Open to Work</Text>
                <Switch
                  value={openToWorkOnly}
                  onValueChange={setOpenToWorkOnly}
                  trackColor={{ true: palette.primary }}
                  thumbColor={openToWorkOnly ? palette.primaryStrong : palette.subtext}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : fetchError ? (
            <View style={styles.emptyState}>
              <KISIcon name="wifi-off" size={40} color={palette.danger} />
              <Text style={[styles.emptyText, { color: palette.danger }]}>{fetchError}</Text>
              <Pressable
                onPress={() => fetchProfiles()}
                style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.primary }}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '700', fontSize: 14 }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <KISIcon name="search" size={40} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No profiles found</Text>
            </View>
          )
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  industryPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  industryPickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headline: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  industry: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnText: {
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
    fontWeight: '500',
  },
});
