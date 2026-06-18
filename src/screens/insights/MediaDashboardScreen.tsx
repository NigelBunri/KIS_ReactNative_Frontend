import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type MediaAsset = {
  id: string;
  name?: string;
  file_type?: string;
  media_type?: string;
  file_size?: number;
  created_at?: string;
};

type MediaStats = {
  total: number;
  storageUsedBytes: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  otherCount: number;
};

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getMediaTypeLabel = (asset: MediaAsset): string => {
  const t = (asset.media_type ?? asset.file_type ?? '').toLowerCase();
  if (t.includes('image')) return 'image';
  if (t.includes('video')) return 'video';
  if (t.includes('audio')) return 'audio';
  return 'file';
};

export default function MediaDashboardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.mediaAssets.assets, {
        errorMessage: 'Unable to load media assets.',
      });
      const items: MediaAsset[] = res.data?.results ?? res.data ?? [];
      setAssets(items.slice(0, 30));

      const total = res.data?.count ?? items.length;
      const storageUsedBytes = items.reduce((s, a) => s + (a.file_size ?? 0), 0);
      const imageCount = items.filter((a) => getMediaTypeLabel(a) === 'image').length;
      const videoCount = items.filter((a) => getMediaTypeLabel(a) === 'video').length;
      const audioCount = items.filter((a) => getMediaTypeLabel(a) === 'audio').length;
      const otherCount = items.filter((a) => getMediaTypeLabel(a) === 'file').length;

      setStats({ total, storageUsedBytes, imageCount, videoCount, audioCount, otherCount });
    } catch (e: any) {
      setError(e?.message || 'Unable to load media assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: 'Total Files', value: String(stats.total) },
        { label: 'Storage Used', value: formatBytes(stats.storageUsedBytes) },
        { label: 'Images', value: String(stats.imageCount) },
        { label: 'Videos', value: String(stats.videoCount) },
        { label: 'Audio', value: String(stats.audioCount) },
        { label: 'Other', value: String(stats.otherCount) },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.title, { color: palette.text }]}>Media</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Asset ingestion, storage usage, and file type breakdown.
        </Text>
      </View>

      {loading && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={load}
            style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />
          }
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter }]}
        >
          {statCards.length > 0 && (
            <View style={styles.statsGrid}>
              {statCards.map((card) => (
                <View
                  key={card.label}
                  style={[
                    styles.statCard,
                    { backgroundColor: palette.surface, borderColor: palette.divider },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: palette.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {card.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.subtext }]}>{card.label}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent Uploads</Text>

          {assets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: palette.subtext }}>No media files found.</Text>
            </View>
          ) : (
            assets.map((asset) => {
              const kind = getMediaTypeLabel(asset);
              const kindColors: Record<string, string> = {
                image: palette.success,
                video: palette.primary,
                audio: palette.gold,
                file: palette.subtext,
              };
              return (
                <View
                  key={String(asset.id)}
                  style={[
                    styles.card,
                    { backgroundColor: palette.card, borderColor: palette.divider },
                  ]}
                >
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.kindDot,
                        { backgroundColor: kindColors[kind] ?? palette.subtext },
                      ]}
                    />
                    <Text
                      style={[styles.cardTitle, { color: palette.text, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {asset.name || `media-${asset.id}`}
                    </Text>
                    {asset.file_size ? (
                      <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                        {formatBytes(asset.file_size)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.cardSub, { color: palette.subtext }]}>
                    {kind}
                    {asset.created_at
                      ? ` • ${new Date(asset.created_at).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  scrollContent: { padding: 16, gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardMeta: { fontSize: 12 },
  cardSub: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  empty: { paddingVertical: 24, alignItems: 'center' },
});
