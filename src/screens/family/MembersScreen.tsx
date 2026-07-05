import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
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

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyMembers'>;

type FamilyMember = {
  id: string;
  display_name: string;
  role: string;
  birth_date?: string;
  is_minor?: boolean;
  initials?: string;
};

function computeAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const ROLE_COLORS: Record<string, string> = {};

export default function MembersScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.members)
        .then((res: any) => {
          if (!active) return;
          const data = Array.isArray(res) ? res : res?.results ?? [];
          setMembers(data);
        })
        .catch(() => setMembers([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleAddMember() {
    try {
      const res: any = await postRequest(ROUTES.family.accountJoin, { generate_invite: true });
      const code: string = res?.data?.invite_code ?? res?.invite_code ?? res?.code ?? '';
      if (code) {
        Clipboard.setString(code);
        Alert.alert('Invite Code Copied', `Share this code with your family member:\n\n${code}`);
      } else {
        Alert.alert('Error', 'Could not generate invite code. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to generate invite code. Check your connection.');
    }
  }

  const gutter = layout.pageGutter;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 80 }}
        ListHeaderComponent={
          <Text style={[styles.heading, { color: palette.text }]}>Family Members</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <KISIcon name="people-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No members yet</Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: palette.divider }]} />
        )}
        renderItem={({ item }) => {
          const age = computeAge(item.birth_date);
          const initials = item.initials ?? (item.display_name?.[0] ?? '?').toUpperCase();
          return (
            <View style={[styles.memberRow, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={[styles.avatar, { backgroundColor: palette.primaryStrong }]}>
                <Text style={[styles.avatarText, { color: palette.ivory }]}>{initials}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: palette.text }]}>{item.display_name}</Text>
                <View style={styles.meta}>
                  <View style={[styles.roleBadge, { backgroundColor: palette.primarySoft }]}>
                    <Text style={[styles.roleText, { color: palette.primary }]}>
                      {item.role ?? 'Member'}
                    </Text>
                  </View>
                  {age !== null && (
                    <Text style={[styles.age, { color: palette.subtext }]}>{age} yrs</Text>
                  )}
                </View>
              </View>
              {item.is_minor && (
                <TouchableOpacity
                  style={[styles.controlsBtn, { borderColor: palette.gold }]}
                  onPress={() =>
                    navigation.navigate('ParentalControls', { memberId: item.id })
                  }
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={[styles.controlsBtnText, { color: palette.gold }]}>Controls</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={handleAddMember}
        activeOpacity={0.85}
      >
        <KISIcon name="person-add-outline" size={24} color={palette.bg} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: 12, fontWeight: '600' },
  age: { fontSize: 13 },
  controlsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBtnText: { fontSize: 13, fontWeight: '600' },
  separator: { height: 1, marginVertical: 2 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});
