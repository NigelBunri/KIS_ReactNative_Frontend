import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ImagePlacementsReview'>;

type Placement = {
  number: number;
  chapter_stable_id: string;
  chapter_title: string;
  block_id: string;
  extraction_status: string;
  source_page: number | null;
  caption: string;
  alt_text: string;
  nearby_text: string;
  width: number;
  height: number;
  asset_id: string | null;
};

export default function ImagePlacementsReviewScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    const res: any = await getRequest(ROUTES.books.imagePlacements(id));
    const list: Placement[] = res?.success && Array.isArray(res.data) ? res.data : [];
    setPlacements(list);
    const assetIds = Array.from(new Set(list.map((p) => p.asset_id).filter(Boolean))) as string[];
    const results = await Promise.all(assetIds.map(async (aid) => {
      const r: any = await getRequest(ROUTES.books.imageDownload(aid)).catch(() => null);
      return [aid, r?.success ? r.data?.url : null] as const;
    }));
    const next: Record<string, string> = {};
    for (const [aid, url] of results) if (url) next[aid] = url;
    setPreviewUrls(next);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { fetchPlacements(); }, [fetchPlacements]));

  const handleUpload = async (blockId: string) => {
    try {
      const results = await DocumentPicker.pick({ type: [DocumentPicker.types.images] });
      const file = results[0];
      setUploadingBlockId(blockId);
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name || 'image.jpg', type: file.type || 'image/jpeg' } as any);
      const res: any = await postRequest(ROUTES.books.imagePlacementUpload(id, blockId), form);
      setUploadingBlockId(null);
      if (res?.success) {
        await fetchPlacements();
      } else {
        Alert.alert('Upload failed', res?.message || 'That file could not be used as an image.');
      }
    } catch (error: any) {
      setUploadingBlockId(null);
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Upload failed', error?.message ?? 'Could not select an image.');
    }
  };

  const resolvedCount = placements.filter((p) => p.extraction_status === 'extracted').length;

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', padding: sp, gap: 10 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 },
    summary: { paddingHorizontal: sp, paddingBottom: 8, fontSize: 13, color: palette.subtext },
    content: { padding: sp, gap: 14 },
    card: { backgroundColor: palette.card, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: palette.divider },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { fontWeight: '700', color: palette.text, flex: 1 },
    cardMeta: { fontSize: 11, color: palette.subtext },
    preview: { width: '100%', height: 180, borderRadius: 10, backgroundColor: palette.divider },
    missing: {
      width: '100%', height: 140, borderRadius: 10, borderWidth: 1, borderColor: palette.divider,
      borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    missingText: { fontSize: 12, color: palette.subtext },
    nearbyText: { fontSize: 12, color: palette.subtext, fontStyle: 'italic' },
    statusBadge: { fontSize: 11, fontWeight: '700' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { padding: sp * 2, alignItems: 'center' },
    emptyText: { fontSize: 13, color: palette.subtext, textAlign: 'center' },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={palette.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back">
          <KISIcon name="back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Review Images</Text>
      </View>
      {placements.length > 0 && (
        <Text style={styles.summary}>{resolvedCount} of {placements.length} image(s) resolved</Text>
      )}

      {placements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No images were detected in this manuscript.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {placements.map((p) => {
            const resolved = p.extraction_status === 'extracted';
            const url = p.asset_id ? previewUrls[p.asset_id] : null;
            return (
              <View key={p.block_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Image {p.number}</Text>
                  <Text style={[styles.statusBadge, { color: resolved ? palette.primary : '#B23B3B' }]}>
                    {resolved ? 'Resolved' : 'Needs an image'}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {p.chapter_title}{p.source_page ? ` · page ${p.source_page} (approximate position)` : ''}
                </Text>
                {!!p.nearby_text && <Text style={styles.nearbyText} numberOfLines={2}>"{p.nearby_text}"</Text>}
                {url ? (
                  <Image source={{ uri: url }} style={[styles.preview, { aspectRatio: p.width && p.height ? p.width / p.height : 16 / 10 }]} resizeMode="contain" />
                ) : (
                  <View style={styles.missing}>
                    <KISIcon name="book" size={24} color={palette.subtext} />
                    <Text style={styles.missingText}>No image yet</Text>
                  </View>
                )}
                <KISButton
                  title={resolved ? 'Replace image' : 'Upload image'}
                  variant={resolved ? 'outline' : 'primary'}
                  loading={uploadingBlockId === p.block_id}
                  onPress={() => handleUpload(p.block_id)}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
