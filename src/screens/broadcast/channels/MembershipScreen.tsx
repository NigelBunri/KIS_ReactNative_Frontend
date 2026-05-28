import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Tier = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  perks: string[];
  is_joined: boolean;
};

export default function MembershipScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Membership'>>();
  const { channelId, channelName } = route.params;

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.broadcasts.channelMembershipTiers(channelId), { errorMessage: '' });
      setTiers(Array.isArray(res) ? res : res?.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  const formatPrice = (cents: number, currency: string) => {
    if (cents === 0) return 'Free';
    return `${currency} ${(cents / 100).toFixed(2)}/mo`;
  };

  const handleJoin = useCallback(async (tier: Tier) => {
    if (tier.is_joined) {
      Alert.alert('Cancel membership', `Cancel your ${tier.title} membership?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel membership', style: 'destructive',
          onPress: async () => {
            setJoining(tier.id);
            await postRequest(
              ROUTES.broadcasts.channelMembership(channelId),
              { tier_id: tier.id, _method: 'DELETE' },
              { errorMessage: 'Could not cancel.' }
            ).catch(() => {});
            await load();
            setJoining(null);
          },
        },
      ]);
      return;
    }
    setJoining(tier.id);
    const res = await postRequest(
      ROUTES.broadcasts.channelMembership(channelId),
      { tier_id: tier.id },
      { errorMessage: 'Could not join.' }
    ).catch(() => null);
    if (res) {
      Alert.alert('Joined!', `You are now a ${tier.title} member.`);
      await load();
    }
    setJoining(null);
  }, [channelId, load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>
          {channelName ? `${channelName} · ` : ''}Memberships
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : tiers.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="people" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No membership tiers yet</Text>
        </View>
      ) : (
        <FlatList
          data={tiers}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: item.is_joined ? palette.primary : palette.divider }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.tierTitle, { color: palette.text }]}>{item.title}</Text>
                <Text style={[styles.tierPrice, { color: palette.primaryStrong }]}>
                  {formatPrice(item.price_cents, item.currency)}
                </Text>
              </View>
              {item.description ? (
                <Text style={[styles.tierDesc, { color: palette.subtext }]}>{item.description}</Text>
              ) : null}
              {item.perks?.length > 0 && (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {item.perks.map((perk, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <KISIcon name="check" size={12} color={palette.primaryStrong} />
                      <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '600' }}>{perk}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Pressable
                onPress={() => handleJoin(item)}
                disabled={joining === item.id}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: item.is_joined ? palette.surface : palette.primary,
                    borderColor: item.is_joined ? palette.border : palette.primary,
                  },
                ]}
              >
                {joining === item.id ? (
                  <ActivityIndicator color={item.is_joined ? palette.text : '#fff'} size="small" />
                ) : (
                  <Text style={{ color: item.is_joined ? palette.text : '#fff', fontWeight: '900' }}>
                    {item.is_joined ? 'Joined ✓' : 'Join'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  backBtn: { padding: 2 },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  card: {
    borderRadius: 16, borderWidth: 2, padding: 16, gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierTitle: { fontSize: 16, fontWeight: '900' },
  tierPrice: { fontSize: 14, fontWeight: '800' },
  tierDesc: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  joinBtn: {
    marginTop: 14, borderRadius: 24, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1,
  },
});
