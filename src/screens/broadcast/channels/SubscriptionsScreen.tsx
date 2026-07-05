import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import type { BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { fetchSubscribedChannels, toggleChannelSubscription } from '@/screens/broadcast/channels/hooks/useChannelsData';

const compactNumber = (n?: number) => {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

function ChannelRow({ channel, onPress, onToggle }: {
  channel: BroadcastChannelSummary;
  onPress: () => void;
  onToggle: () => void;
}) {
  const { palette } = useKISTheme();
  const avatarUrl = channel.avatar_url ? resolveBackendAssetUrl(channel.avatar_url) : '';
  const initials = String(channel.display_name || channel.handle || 'KC')
    .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'KC';

  return (
    <Pressable style={[styles.row, { borderBottomColor: palette.border }]} onPress={onPress}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.primarySoft }]}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 16 }}>{initials}</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{channel.display_name || 'KIS Channel'}</Text>
          {channel.is_verified && <KISIcon name="check" size={13} color={palette.primaryStrong} />}
        </View>
        <Text style={[styles.handle, { color: palette.subtext }]}>@{channel.handle} · {compactNumber(channel.subscriber_count)} subscribers</Text>
      </View>
      <Pressable
        onPress={onToggle}
        style={[
          styles.subBtn,
          {
            backgroundColor: channel.is_subscribed ? palette.surface : palette.primaryStrong,
            borderColor: channel.is_subscribed ? palette.border : palette.primaryStrong,
          },
        ]}
        hitSlop={8}
      >
        <Text style={{ color: channel.is_subscribed ? palette.subtext : palette.onPrimary, fontWeight: '900', fontSize: 12 }}>
          {channel.is_subscribed ? 'Subscribed' : 'Subscribe'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export default function SubscriptionsScreen() {
  const { palette } = useKISTheme();
  const { pageGutter } = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [channels, setChannels] = useState<BroadcastChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const rows = await fetchSubscribedChannels();
      setChannels(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = useCallback((channel: BroadcastChannelSummary) => {
    const nowSub = !channel.is_subscribed;
    setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, is_subscribed: nowSub } : c));
    void toggleChannelSubscription(channel.id, nowSub);
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border, paddingHorizontal: pageGutter }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <KISIcon name="people" size={18} color={palette.primaryStrong} />
        <Text style={[styles.headerTitle, { color: palette.text }]}>Subscriptions</Text>
        <Text style={[styles.headerCount, { color: palette.subtext }]}>{channels.length}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="people" size={48} color={palette.border} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No subscriptions yet</Text>
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>Channels you subscribe to will appear here</Text>
          <Pressable
            onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Broadcast', params: { focusTab: 'channels' } })}
            style={[styles.browseBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '900' }}>Browse channels</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primaryStrong} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No subscriptions yet
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              onPress={() => navigation.navigate('ChannelHome', { channelId: item.id, channel: item })}
              onToggle={() => handleToggle(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  headerCount: { fontSize: 14, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyHint: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  browseBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '900' },
  handle: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  subBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
