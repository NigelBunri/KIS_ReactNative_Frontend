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
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { fetchChannelActivity } from '@/screens/broadcast/channels/hooks/useChannelsData';

type ActivityItem = {
  id: string;
  event_type: string;
  actor_display?: string;
  target_type?: string;
  target_id?: string;
  content_id?: string;
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
  const { pageGutter, minTouchTarget, bodyFontSize, labelFontSize, headerTitleSize } = useResponsiveLayout();
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
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border, paddingHorizontal: pageGutter }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={[styles.backBtn, { minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }]}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text, fontSize: headerTitleSize * 0.75 }]}>
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
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No notifications yet
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const contentId = item.content_id || (item.target_type === 'content' ? item.target_id : null);
            return (
              <Pressable
                style={[styles.row, { borderBottomColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: pageGutter }]}
                onPress={() => {
                  if (contentId) {
                    navigation.navigate('ChannelContentDetail', { contentId });
                  }
                }}
              >
                <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft }]}>
                  <KISIcon name={eventIcon(item.event_type)} size={16} color={palette.primaryStrong} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.eventLabel, { color: palette.text, fontSize: bodyFontSize }]} numberOfLines={1}>
                    {eventLabel(item.event_type)}
                  </Text>
                  {item.actor_display ? (
                    <Text style={[styles.actor, { color: palette.subtext, fontSize: labelFontSize }]} numberOfLines={1}>
                      {item.actor_display}
                      {item.target_type ? ` · ${item.target_type}` : ''}
                    </Text>
                  ) : null}
                  <Text style={[styles.time, { color: palette.subtext, fontSize: labelFontSize }]}>{timeAgo(item.created_at)}</Text>
                </View>
                {contentId ? <KISIcon name="chevron-right" size={14} color={palette.border} /> : null}
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
