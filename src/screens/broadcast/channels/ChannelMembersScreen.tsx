import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { fetchChannelSubscribers } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Subscriber = {
  id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  subscribed_at?: string;
};

function initialsFor(name?: string): string {
  return String(name || 'KIS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || 'KS';
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

export default function ChannelMembersScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChannelMembersScreen'>>();
  const { channelId, channelName } = route.params;

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChannelSubscribers(channelId);
      setSubscribers(rows);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>
          {channelName ? `${channelName} · ` : ''}Members{!loading ? ` (${subscribers.length})` : ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : subscribers.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="people" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No subscribers yet</Text>
        </View>
      ) : (
        <FlatList
          data={subscribers}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
              <View style={[styles.avatar, { backgroundColor: palette.primarySoft }]}>
                <Text style={[styles.avatarText, { color: palette.primaryStrong }]}>
                  {initialsFor(item.display_name || item.username)}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                  {item.display_name || item.username || 'KIS user'}
                </Text>
                {item.username ? (
                  <Text style={[styles.username, { color: palette.subtext }]}>@{item.username}</Text>
                ) : null}
                {item.subscribed_at ? (
                  <Text style={[styles.meta, { color: palette.subtext }]}>
                    Subscriber since {formatDate(item.subscribed_at)}
                  </Text>
                ) : null}
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 2 },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '900' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '800' },
  username: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
