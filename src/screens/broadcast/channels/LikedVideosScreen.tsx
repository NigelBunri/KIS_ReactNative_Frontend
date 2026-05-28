import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { resolveBackendAssetUrl } from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { API_BASE_URL } from '@/network/config';

type LikedItem = {
  id: string;
  title?: string;
  thumbnail_url?: string;
  text_plain_preview?: string;
  channel?: { display_name?: string; handle?: string };
  reacted_at?: string;
  created_at?: string;
};

function timeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ago`;
  return 'Just now';
}

export default function LikedVideosScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<LikedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(
        `${API_BASE_URL}/api/v1/broadcasts/channel-contents/my-reactions/`,
        { errorMessage: '' },
      );
      const rows = res?.data?.results ?? res?.data ?? [];
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <KISIcon name="heart" size={18} color={palette.primaryStrong} />
        <Text style={[styles.headerTitle, { color: palette.text }]}>Liked Videos</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="heart" size={40} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No liked videos yet</Text>
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>Videos you like will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const thumbUrl = resolveBackendAssetUrl(item.thumbnail_url || '');
            const label = item.title || item.text_plain_preview || 'Untitled';
            const channelLabel = item.channel?.display_name ?? (item.channel?.handle ? `@${item.channel.handle}` : 'KIS Channel');
            return (
              <Pressable
                style={[styles.row, { borderBottomColor: palette.border }]}
                onPress={() => navigation.navigate('ChannelContentDetail', { contentId: item.id })}
              >
                <View style={styles.thumbWrap}>
                  {thumbUrl ? (
                    <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: palette.primarySoft ?? '#3d2b00', alignItems: 'center', justifyContent: 'center' }]}>
                      <KISIcon name="play" size={18} color={palette.primaryStrong} />
                    </View>
                  )}
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{label}</Text>
                  <Text style={[styles.channel, { color: palette.subtext }]} numberOfLines={1}>{channelLabel}</Text>
                  <Text style={[styles.date, { color: palette.subtext }]}>{timeAgo(item.reacted_at ?? item.created_at)}</Text>
                </View>
                <KISIcon name="chevron-right" size={16} color={palette.border} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { marginRight: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyHint: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  thumbWrap: {},
  thumb: { width: 110, height: 70, borderRadius: 6, overflow: 'hidden' },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  channel: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  date: { marginTop: 2, fontSize: 11, fontWeight: '600' },
});
