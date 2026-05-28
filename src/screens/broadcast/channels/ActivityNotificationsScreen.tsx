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
import { fetchChannelActivity } from '@/screens/broadcast/channels/hooks/useChannelsData';

type ActivityItem = {
  id: string;
  event_type: string;
  actor_display?: string;
  target_type?: string;
  created_at?: string;
};

function timeAgo(isoString?: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function eventIcon(eventType: string): string {
  if (eventType.includes('subscribe')) return 'people';
  if (eventType.includes('react') || eventType.includes('like')) return 'heart';
  if (eventType.includes('comment')) return 'comment';
  if (eventType.includes('share')) return 'share';
  if (eventType.includes('view')) return 'play';
  if (eventType.includes('live')) return 'broadcast';
  return 'bell';
}

function eventLabel(eventType: string): string {
  return String(eventType)
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

export default function ActivityNotificationsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActivityNotifications'>>();
  const { channelId, channelName } = route.params;

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChannelActivity(channelId);
      setItems(rows);
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
          Activity{channelName ? ` · ${channelName}` : ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="bell" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No activity yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
              <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft }]}>
                <KISIcon name={eventIcon(item.event_type)} size={16} color={palette.primaryStrong} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.eventLabel, { color: palette.text }]} numberOfLines={1}>
                  {eventLabel(item.event_type)}
                </Text>
                {item.actor_display ? (
                  <Text style={[styles.actor, { color: palette.subtext }]} numberOfLines={1}>
                    {item.actor_display}
                    {item.target_type ? ` · ${item.target_type}` : ''}
                  </Text>
                ) : null}
                <Text style={[styles.time, { color: palette.subtext }]}>{timeAgo(item.created_at)}</Text>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1, gap: 3 },
  eventLabel: { fontSize: 14, fontWeight: '800' },
  actor: { fontSize: 12, fontWeight: '600' },
  time: { fontSize: 11, fontWeight: '600' },
});
