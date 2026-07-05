import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'DiasporaCommunities'>;

type Community = {
  id: string;
  name: string;
  country_of_origin: string;
  host_country: string;
  member_count: number;
  is_member?: boolean;
};

export default function DiasporaScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState('All');
  const [joining, setJoining] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.diaspora)
        .then((res: any) => {
          if (!active) return;
          setCommunities(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setCommunities([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const origins = [
    'All',
    ...Array.from(
      new Set(communities.map((c) => c.country_of_origin).filter(Boolean)),
    ),
  ];

  const filtered =
    originFilter === 'All'
      ? communities
      : communities.filter((c) => c.country_of_origin === originFilter);

  async function handleJoin(id: string) {
    setJoining(id);
    try {
      await postRequest(ROUTES.government.diasporaJoin(id), {});
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, is_member: true, member_count: c.member_count + 1 }
            : c,
        ),
      );
    } catch {
      Alert.alert('Error', 'Could not join community. Please try again.');
    } finally {
      setJoining(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      {/* Origin Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {origins.map((o) => (
          <TouchableOpacity
            key={o}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  originFilter === o ? palette.primary : palette.surface,
                borderColor:
                  originFilter === o ? palette.primary : palette.divider,
              },
            ]}
            onPress={() => setOriginFilter(o)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: originFilter === o ? palette.ivory : palette.subtext,
                },
              ]}
            >
              {o}
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
            <KISIcon name="globe-outline" size={52} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No communities found
            </Text>
          </View>
        ) : (
          filtered.map((community) => (
            <View
              key={community.id}
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  marginBottom: layout.cardGap,
                },
              ]}
            >
              <View style={styles.cardRow}>
                {/* Flag Placeholder */}
                <View
                  style={[
                    styles.flagPlaceholder,
                    { backgroundColor: palette.primarySoft },
                  ]}
                >
                  <KISIcon name="flag-outline" size={22} color={palette.primary} />
                </View>

                <View style={styles.cardInfo}>
                  <Text style={[styles.communityName, { color: palette.text }]}>
                    {community.name}
                  </Text>
                  <View style={styles.badgesRow}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: palette.primarySoft },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: palette.primary }]}>
                        {community.country_of_origin}
                      </Text>
                    </View>
                    <Text
                      style={[styles.hostCountry, { color: palette.subtext }]}
                    >
                      in {community.host_country}
                    </Text>
                  </View>
                  <Text style={[styles.memberCount, { color: palette.subtext }]}>
                    <KISIcon
                      name="people-outline"
                      size={12}
                      color={palette.subtext}
                    />{' '}
                    {community.member_count.toLocaleString()} members
                  </Text>
                </View>
              </View>

              {community.is_member ? (
                <View
                  style={[
                    styles.memberBadge,
                    { backgroundColor: palette.primarySoft },
                  ]}
                >
                  <KISIcon
                    name="checkmark-circle-outline"
                    size={14}
                    color={palette.primary}
                  />
                  <Text style={[styles.memberBadgeText, { color: palette.primary }]}>
                    Member
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.75}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  style={[
                    styles.joinBtn,
                    { borderColor: palette.primary, backgroundColor: palette.primarySoft },
                  ]}
                  onPress={() => handleJoin(community.id)}
                  disabled={joining === community.id}
                >
                  <Text
                    style={[styles.joinBtnText, { color: palette.primary }]}
                  >
                    {joining === community.id ? 'Joining…' : 'Join'}
                  </Text>
                </TouchableOpacity>
              )}
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
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flagPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 5,
  },
  communityName: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hostCountry: {
    fontSize: 12,
  },
  memberCount: {
    fontSize: 12,
  },
  joinBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  memberBadgeText: {
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
