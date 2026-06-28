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
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyHub'>;

type FamilyMember = {
  id: string;
  display_name: string;
  initials?: string;
};

type FamilyAccount = {
  id: string;
  name: string;
  invite_code: string;
  members: FamilyMember[];
  member_count: number;
};

const SECTION_CARDS: {
  label: string;
  icon: string;
  route: keyof RootStackParamList;
  routeParams?: object;
}[] = [
  { label: 'Events', icon: 'calendar-outline', route: 'FamilyCalendar' },
  { label: 'Prayer', icon: 'heart-outline', route: 'FamilyPrayer' },
  { label: 'Photos', icon: 'images-outline', route: 'FamilyAlbum' },
  { label: 'Notice Board', icon: 'megaphone-outline', route: 'FamilyNoticeBoard' },
  { label: 'Milestones', icon: 'ribbon-outline', route: 'FamilyMilestones' },
  { label: 'Time Capsules', icon: 'time-outline', route: 'FamilyTimeCapsules' },
  { label: 'Grief Support', icon: 'hand-left-outline', route: 'GriefSupport' },
  { label: 'Family Tree', icon: 'git-network-outline', route: 'FamilyTree', routeParams: {} },
];

export default function FamilyHubScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [family, setFamily] = useState<FamilyAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.accounts)
        .then((res: any) => {
          if (!active) return;
          const data = Array.isArray(res) ? res[0] : res?.results?.[0] ?? res;
          setFamily(data ?? null);
        })
        .catch(() => setFamily(null))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const gutter = layout.pageGutter;
  const cardSize = (layout.width - gutter * 2 - 12) / 2;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (!family) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <View style={styles.emptyState}>
          <KISIcon name="people-outline" size={64} color={palette.subtext} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No Family Yet</Text>
          <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>
            Create a family group or join one with an invite code.
          </Text>
          <View style={styles.emptyActions}>
            <KISButton
              title="Create Family"
              onPress={() => navigation.navigate('FamilySetup')}
              style={{ marginBottom: 12 }}
            />
            <KISButton
              title="Join Family"
              variant="outline"
              onPress={() => navigation.navigate('FamilySetup')}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const visibleMembers = family.members?.slice(0, 5) ?? [];
  const overflow = (family.member_count ?? 0) - 5;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Header */}
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingHorizontal: gutter }]}
        >
          <Text style={[styles.familyName, { color: palette.ivory }]}>{family.name}</Text>
          <View style={[styles.inviteChip, { backgroundColor: palette.primarySoft }]}>
            <KISIcon name="key-outline" size={14} color={palette.gold} />
            <Text style={[styles.inviteCode, { color: palette.gold }]}>
              {family.invite_code}
            </Text>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => Alert.alert('Invite Code', family.invite_code)}
            >
              <KISIcon name="copy-outline" size={14} color={palette.gold} />
            </TouchableOpacity>
          </View>

          {/* Member avatars */}
          <View style={styles.avatarRow}>
            {visibleMembers.map((m) => (
              <View key={m.id} style={[styles.avatar, { backgroundColor: palette.primaryStrong }]}>
                <Text style={[styles.avatarInitials, { color: palette.ivory }]}>
                  {m.initials ?? (m.display_name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            ))}
            {overflow > 0 && (
              <View style={[styles.avatar, { backgroundColor: palette.surface }]}>
                <Text style={[styles.avatarInitials, { color: palette.text }]}>+{overflow}</Text>
              </View>
            )}
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => navigation.navigate('FamilyMembers')}
            >
              <View style={[styles.avatar, { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.gold }]}>
                <KISIcon name="people-outline" size={16} color={palette.gold} />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Section grid */}
        <View style={[styles.grid, { padding: gutter }]}>
          {SECTION_CARDS.map((card) => (
            <TouchableOpacity
              key={card.label}
              activeOpacity={0.8}
              style={[
                styles.sectionCard,
                {
                  width: cardSize,
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                },
              ]}
              onPress={() => {
                if (card.route === 'FamilyTree') {
                  navigation.navigate('FamilyTree', { familyId: family.id });
                } else {
                  (navigation.navigate as any)(card.route);
                }
              }}
            >
              <KISIcon name={card.icon as any} size={28} color={palette.gold} />
              <Text style={[styles.sectionLabel, { color: palette.text }]}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingTop: 24,
    paddingBottom: 28,
  },
  familyName: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  inviteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 90,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyActions: {
    width: '100%',
  },
});
