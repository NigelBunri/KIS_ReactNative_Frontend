import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';

type DownloadItem = {
  name: string;
  path: string;
  size: number;
  mtime: Date;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  return hrs > 0 ? `${hrs}h ago` : 'Just now';
}

export default function DownloadsScreen() {
  const { palette } = useKISTheme();
  const { pageGutter, minTouchTarget, bodyFontSize, labelFontSize, headerTitleSize } = useResponsiveLayout();
  const navigation = useNavigation();
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dir = `${RNFS.DocumentDirectoryPath}/kis-downloads`;
      const exists = await RNFS.exists(dir);
      if (!exists) { setItems([]); return; }
      const files = await RNFS.readDir(dir);
      const mapped: DownloadItem[] = files.map(f => ({
        name: f.name,
        path: f.path,
        size: Number(f.size),
        mtime: f.mtime ?? new Date(),
      }));
      setItems(mapped.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // downloadContent is exposed for programmatic use from ChannelContentDetailPage.
  // This screen is a viewer of already-downloaded local files; new downloads are
  // initiated from the content detail page's Download action button.
  const handleDelete = useCallback((item: DownloadItem) => {
    Alert.alert('Delete download', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await RNFS.unlink(item.path);
          setItems(prev => prev.filter(i => i.path !== item.path));
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border, paddingHorizontal: pageGutter }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <KISIcon name="download" size={18} color={palette.primaryStrong} />
        <Text style={[styles.headerTitle, { color: palette.text, fontSize: headerTitleSize * 0.7 }]}>Downloads</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <KISIcon name="download" size={40} color={palette.border} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No downloads yet</Text>
          <Text style={[styles.emptyHint, { color: palette.subtext }]}>Tap Download on any video to save it here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.path}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No downloads yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: pageGutter }]}>
              <View style={[styles.iconWrap, { backgroundColor: palette.primarySoft }]}>
                <KISIcon name="file" size={18} color={palette.primaryStrong} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: palette.text, fontSize: bodyFontSize }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: palette.subtext, fontSize: labelFontSize }]}>
                  {formatSize(item.size)} · {timeAgo(item.mtime)}
                </Text>
              </View>
              <Pressable
                onPress={() => handleDelete(item)}
                hitSlop={12}
                style={{ minWidth: minTouchTarget, minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <KISIcon name="close" size={18} color={palette.danger} />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '800' },
  emptyHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '800' },
  meta: { marginTop: 2, fontSize: 11, fontWeight: '600' },
  comingSoon: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderTopWidth: 1 },
});
