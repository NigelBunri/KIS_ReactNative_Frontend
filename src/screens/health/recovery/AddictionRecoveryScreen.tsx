import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddictionRecovery'>;

type RecoveryGroup = {
  id: string;
  name: string;
  facilitator: string;
  schedule: string;
  addiction_type: string;
  is_anonymous: boolean;
  member_count: number;
};

const ADDICTION_TYPES = ['All', 'Alcohol', 'Substances', 'Gambling', 'Technology', 'Food', 'Other'];

export default function AddictionRecoveryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [groups, setGroups] = useState<RecoveryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [anonymousMap, setAnonymousMap] = useState<Record<string, boolean>>({});

  const fetchGroups = useCallback(async (type?: string) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (type && type !== 'All') params.addiction_type = type;
    const res = await getRequest(ROUTES.healthExtended.recoveryGroups, { params });
    if (res.success) {
      setGroups(Array.isArray(res.data?.results ?? res.data) ? (res.data?.results ?? res.data) : []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchGroups(selectedType); }, [fetchGroups, selectedType]));

  const handleTypeChange = (t: string) => {
    setSelectedType(t);
    fetchGroups(t);
  };

  const handleJoin = async (group: RecoveryGroup) => {
    setJoiningId(group.id);
    const isAnon = anonymousMap[group.id] ?? false;
    const res = await postRequest(ROUTES.healthExtended.recoveryGroupJoin(group.id), {
      is_anonymous: isAnon,
    });
    setJoiningId(null);
    if (res.success) {
      Alert.alert('Joined!', `You have joined "${group.name}".`);
    } else {
      Alert.alert('Error', res.message || 'Failed to join group.');
    }
  };

  const toggleAnonymous = (id: string) => {
    setAnonymousMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const styles = makeStyles(palette, sp);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Addiction Recovery</Text>
        <Text style={styles.headerSub}>Find support groups and start your journey</Text>
      </LinearGradient>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ADDICTION_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterTab, selectedType === t && styles.filterTabActive]}
            onPress={() => handleTypeChange(t)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={[styles.filterTabText, selectedType === t && styles.filterTabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={[styles.list, { paddingBottom: 80 }]}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No groups found for this category.</Text>
          }
          renderItem={({ item: group }) => (
            <View style={styles.groupCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {group.is_anonymous && (
                    <View style={styles.anonBadge}>
                      <KISIcon name="shield" size={12} color={palette.primary} />
                      <Text style={styles.anonText}>Anonymous</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.typeBadge, { backgroundColor: palette.primarySoft }]}>
                  <Text style={[styles.typeText, { color: palette.primary }]}>{group.addiction_type}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <KISIcon name="person" size={14} color={palette.subtext} />
                <Text style={styles.detailText}>Facilitator: {group.facilitator}</Text>
              </View>
              <View style={styles.detailRow}>
                <KISIcon name="calendar" size={14} color={palette.subtext} />
                <Text style={styles.detailText}>{group.schedule}</Text>
              </View>
              <View style={styles.detailRow}>
                <KISIcon name="people" size={14} color={palette.subtext} />
                <Text style={styles.detailText}>{group.member_count} members</Text>
              </View>

              <View style={styles.joinRow}>
                <View style={styles.anonToggle}>
                  <Text style={styles.anonToggleLabel}>Join anonymously</Text>
                  <Switch
                    value={anonymousMap[group.id] ?? false}
                    onValueChange={() => toggleAnonymous(group.id)}
                    trackColor={{ false: palette.divider, true: palette.primarySoft }}
                    thumbColor={anonymousMap[group.id] ? palette.primary : palette.subtext}
                  />
                </View>
                <KISButton
                  title={joiningId === group.id ? 'Joining...' : 'Join Group'}
                  variant="primary"
                  size="sm"
                  loading={joiningId === group.id}
                  onPress={() => handleJoin(group)}
                />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any, sp: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingHorizontal: sp,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: palette.ivory },
    headerSub: { fontSize: 13, color: palette.ivory, opacity: 0.8, marginTop: 2 },
    filterRow: {
      paddingHorizontal: sp,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    filterTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    filterTabActive: {
      backgroundColor: palette.primarySoft,
      borderColor: palette.primary,
    },
    filterTabText: { fontSize: 13, color: palette.subtext },
    filterTabTextActive: { color: palette.primary, fontWeight: '600' },
    list: { paddingHorizontal: sp, paddingTop: 12, gap: 14 },
    emptyText: { color: palette.subtext, textAlign: 'center', marginTop: 40, fontSize: 14 },
    groupCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.divider,
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardHeaderInfo: { flex: 1, gap: 4 },
    groupName: { fontSize: 16, fontWeight: '600', color: palette.text },
    anonBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    anonText: { fontSize: 11, color: palette.primary },
    typeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    typeText: { fontSize: 11, fontWeight: '600' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 13, color: palette.subtext },
    joinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: palette.divider,
    },
    anonToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    anonToggleLabel: { fontSize: 12, color: palette.subtext },
  });
}
