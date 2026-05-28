import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
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
import { fetchUserClips, shareChannelClip, deleteChannelContentClip } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Clip = {
  id: string;
  title?: string;
  start_seconds: number;
  end_seconds: number;
  status: string;
  clip_url?: string;
  created_at?: string;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ClipsListScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClipsListScreen'>>();
  const { contentId } = route.params;
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchUserClips(contentId);
      setClips(rows);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => { void load(); }, [load]);

  const handleShare = useCallback(async (clip: Clip) => {
    if (clip.clip_url) {
      await Share.share({ message: clip.title || 'Check out this clip!', url: clip.clip_url });
    }
    await shareChannelClip(clip.id);
  }, []);

  const handleDelete = useCallback((clip: Clip) => {
    Alert.alert('Delete clip', 'Delete this clip permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChannelContentClip(contentId, clip.id);
          setClips(prev => prev.filter(c => c.id !== clip.id));
        },
      },
    ]);
  }, [contentId]);

  const renderClip = useCallback(({ item }: { item: Clip }) => {
    const duration = item.end_seconds - item.start_seconds;
    return (
      <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.thumbPlaceholder, { backgroundColor: palette.primarySoft }]}>
          <KISIcon name="play" size={18} color={palette.primaryStrong} />
          <Text style={[styles.durationLabel, { color: palette.primaryStrong }]}>{formatTime(duration)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.clipTitle, { color: palette.text }]} numberOfLines={2}>
            {item.title || `Clip ${formatTime(item.start_seconds)}–${formatTime(item.end_seconds)}`}
          </Text>
          <Text style={[styles.clipMeta, { color: palette.subtext }]}>
            {item.status === 'ready' ? 'Ready' : item.status}
            {item.created_at ? `  ·  ${new Date(item.created_at).toLocaleDateString()}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => handleShare(item)}
          style={[styles.shareBtn, { borderColor: palette.border }]}
        >
          <KISIcon name="share" size={16} color={palette.primaryStrong} />
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item)}
          style={[styles.shareBtn, { borderColor: palette.border, marginLeft: 6 }]}
        >
          <KISIcon name="trash" size={16} color={palette.subtext} />
        </Pressable>
      </View>
    );
  }, [palette, handleShare, handleDelete]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>My Clips</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : clips.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="play" size={36} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No clips yet</Text>
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>
            Create clips from the content detail page
          </Text>
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={item => item.id}
          renderItem={renderClip}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptyHint: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  list: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  thumbPlaceholder: {
    width: 60,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  durationLabel: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  info: { flex: 1 },
  clipTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  clipMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
