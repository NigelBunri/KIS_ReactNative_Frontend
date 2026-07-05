import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { deleteRequest } from '@/network/delete';
import { useKISTheme } from '@/theme/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaAsset = {
  id: string;
  name?: string;
  file_type?: string;
  media_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  created_at?: string;
  url?: string;
  thumbnail_url?: string;
  mime_type?: string;
};

type SafetyScan = {
  id?: string;
  status?: string;
  is_safe?: boolean;
  score?: number;
  scanned_at?: string;
  labels?: string[];
};

type FilterType = 'All' | 'Image' | 'Video' | 'Audio' | 'Document';
const FILTERS: FilterType[] = ['All', 'Image', 'Video', 'Audio', 'Document'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes?: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getAssetKind = (asset: MediaAsset): FilterType => {
  const t = (asset.media_type ?? asset.file_type ?? asset.mime_type ?? '').toLowerCase();
  if (t.includes('image')) return 'Image';
  if (t.includes('video')) return 'Video';
  if (t.includes('audio')) return 'Audio';
  return 'Document';
};

const buildKindColors = (p: any): Record<FilterType, string> => ({
  All: p.subtext,
  Image: p.success,
  Video: p.primaryStrong,
  Audio: p.gold,
  Document: p.primary,
});

const KIND_ICONS: Record<FilterType, string> = {
  All: '■',
  Image: '🖼',
  Video: '🎬',
  Audio: '🎵',
  Document: '📄',
};

const buildSafetyColors = (p: any): Record<string, string> => ({
  safe: p.success,
  unsafe: p.danger,
  pending: p.gold,
  unknown: p.subtext,
});

// ─── Asset Thumbnail ──────────────────────────────────────────────────────────

function AssetThumbnail({
  asset,
  size,
  palette,
}: {
  asset: MediaAsset;
  size: number;
  palette: any;
}) {
  const KIND_COLORS = buildKindColors(palette);
  const kind = getAssetKind(asset);
  const hasImage = kind === 'Image' && (asset.thumbnail_url ?? asset.url);

  if (hasImage) {
    return (
      <Image
        source={{ uri: asset.thumbnail_url ?? asset.url }}
        style={{ width: size, height: size, borderRadius: 8 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor: KIND_COLORS[kind] + '22',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.4 }}>{KIND_ICONS[kind]}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MediaAssetManagerScreen() {
  const { palette } = useKISTheme();
  const KIND_COLORS = buildKindColors(palette);
  const SAFETY_COLORS = buildSafetyColors(palette);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('All');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [safetyScan, setSafetyScan] = useState<SafetyScan | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.mediaAssets.assets, {
        errorMessage: 'Unable to load media assets.',
      });
      setAssets(res.data?.results ?? res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load media assets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (asset: MediaAsset) => {
    setSelected(asset);
    setSafetyScan(null);
    setSafetyLoading(true);
    try {
      const res = await getRequest(ROUTES.mediaAssets.safetyScan(asset.id), {
        errorMessage: 'Unable to load safety scan.',
      });
      setSafetyScan(res.data ?? null);
    } catch {
      setSafetyScan(null);
    } finally {
      setSafetyLoading(false);
    }
  }, []);

  const confirmDelete = useCallback((asset: MediaAsset) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete "${asset.name ?? asset.id}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRequest(ROUTES.mediaAssets.asset(asset.id), {
                errorMessage: 'Failed to delete asset.',
              });
              setAssets(prev => prev.filter(a => a.id !== asset.id));
              if (selected?.id === asset.id) setSelected(null);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete asset.');
            }
          },
        },
      ],
    );
  }, [selected]);

  const handleUpload = useCallback(async () => {
    launchImageLibrary(
      { mediaType: 'mixed', quality: 0.9 },
      async response => {
        if (response.didCancel || !response.assets?.length) return;
        const file = response.assets[0];
        if (!file.uri) return;

        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: file.uri,
            name: file.fileName ?? 'upload',
            type: file.type ?? 'application/octet-stream',
          } as any);
          if (file.fileName) formData.append('name', file.fileName);

          const { getAccessToken } = await import('@/security/authStorage');
          const token = await getAccessToken();
          const res = await fetch(ROUTES.mediaAssets.assets, {
            method: 'POST',
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              Accept: 'application/json',
            },
            body: formData,
          });

          if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(err || `Upload failed (${res.status})`);
          }

          Alert.alert('Uploaded', 'Media asset uploaded successfully.');
          load();
        } catch (e: any) {
          Alert.alert('Upload Error', e?.message ?? 'Failed to upload file.');
        } finally {
          setUploading(false);
        }
      },
    );
  }, [load]);

  const filtered =
    filter === 'All' ? assets : assets.filter(a => getAssetKind(a) === filter);

  const useGridLayout = filter === 'All' || filter === 'Image' || filter === 'Video';
  const GRID_COLS = 2;
  const CELL_GAP = 10;

  // Pair items for grid
  const gridRows: MediaAsset[][] = [];
  if (useGridLayout) {
    for (let i = 0; i < filtered.length; i += GRID_COLS) {
      gridRows.push(filtered.slice(i, i + GRID_COLS));
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Media Assets</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Media Assets</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}>
            <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Media Assets</Text>
        <Text style={[styles.screenSubtitle, { color: palette.subtext }]}>
          {assets.length} file{assets.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? palette.primaryStrong : palette.surface,
                  borderColor: active ? palette.primaryStrong : palette.divider,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? palette.onPrimary : palette.subtext },
                ]}
              >
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Asset list / grid */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: palette.subtext }}>No {filter === 'All' ? '' : filter} assets found.</Text>
        </View>
      ) : useGridLayout ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
          }
          contentContainerStyle={styles.gridContent}
        >
          {gridRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.gridRow}>
              {row.map(asset => (
                <Pressable
                  key={asset.id}
                  onPress={() => openDetail(asset)}
                  onLongPress={() => confirmDelete(asset)}
                  style={[styles.gridCell, { backgroundColor: palette.card, borderColor: palette.divider }]}
                >
                  <AssetThumbnail asset={asset} size={120} palette={palette} />
                  <Text style={[styles.gridCellName, { color: palette.text }]} numberOfLines={2}>
                    {asset.name ?? `asset-${asset.id}`}
                  </Text>
                  <Text style={[styles.gridCellMeta, { color: palette.subtext }]}>
                    {formatBytes(asset.file_size)}
                  </Text>
                </Pressable>
              ))}
              {/* Pad last row if odd count */}
              {row.length < GRID_COLS && (
                <View style={{ flex: 1, margin: CELL_GAP / 2 }} />
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No assets yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
          }
          renderItem={({ item }) => {
            const kind = getAssetKind(item);
            return (
              <Pressable
                onPress={() => openDetail(item)}
                onLongPress={() => confirmDelete(item)}
                style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.divider }]}
              >
                <AssetThumbnail asset={item} size={48} palette={palette} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.listCardName, { color: palette.text }]} numberOfLines={1}>
                    {item.name ?? `asset-${item.id}`}
                  </Text>
                  <Text style={[styles.listCardMeta, { color: palette.subtext }]}>
                    {kind} • {formatBytes(item.file_size)}
                    {item.created_at ? ` • ${new Date(item.created_at).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={8}
                  style={styles.deleteIcon}
                >
                  <Text style={{ color: palette.danger, fontSize: 18 }}>×</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {/* FAB – Upload */}
      <Pressable
        onPress={handleUpload}
        disabled={uploading}
        style={[styles.fab, { backgroundColor: palette.primaryStrong, shadowColor: palette.royalInk }]}
      >
        {uploading
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={[styles.fabText, { color: palette.onPrimary }]}>Upload</Text>
        }
      </Pressable>

      {/* Asset Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]} numberOfLines={1}>
              {selected?.name ?? `Asset ${selected?.id}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => { setSelected(null); if (selected) confirmDelete(selected); }}
                hitSlop={8}
              >
                <Text style={{ color: palette.danger, fontWeight: '700', fontSize: 15 }}>Delete</Text>
              </Pressable>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {selected ? (
              <>
                {/* Full preview for images */}
                {getAssetKind(selected) === 'Image' && (selected.url ?? selected.thumbnail_url) ? (
                  <Image
                    source={{ uri: selected.url ?? selected.thumbnail_url }}
                    style={[styles.previewImage, { backgroundColor: palette.royalInk }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.previewPlaceholder, { backgroundColor: KIND_COLORS[getAssetKind(selected)] + '22' }]}>
                    <Text style={{ fontSize: 48 }}>{KIND_ICONS[getAssetKind(selected)]}</Text>
                    <Text style={{ color: palette.subtext, marginTop: 8 }}>{getAssetKind(selected)}</Text>
                  </View>
                )}

                <DetailRow label="Name" value={selected.name} palette={palette} />
                <DetailRow label="Size" value={formatBytes(selected.file_size)} palette={palette} />
                <DetailRow
                  label="Dimensions"
                  value={selected.width && selected.height ? `${selected.width} × ${selected.height}` : undefined}
                  palette={palette}
                />
                <DetailRow label="Type" value={selected.mime_type ?? selected.file_type ?? selected.media_type} palette={palette} />
                <DetailRow
                  label="Uploaded"
                  value={selected.created_at ? new Date(selected.created_at).toLocaleString() : undefined}
                  palette={palette}
                />

                {/* Safety scan */}
                <View style={[styles.safetyBox, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                  <Text style={[styles.sectionLabel, { color: palette.text }]}>Safety Scan</Text>
                  {safetyLoading ? (
                    <ActivityIndicator size="small" color={palette.primaryStrong} style={{ marginTop: 8 }} />
                  ) : safetyScan ? (
                    <>
                      <View style={styles.safetyRow}>
                        <Text style={{ color: palette.subtext, fontSize: 13 }}>Status:</Text>
                        <View
                          style={[
                            styles.safetyBadge,
                            {
                              backgroundColor:
                                (SAFETY_COLORS[safetyScan.status?.toLowerCase() ?? 'unknown'] ?? palette.subtext) + '22',
                              borderColor:
                                SAFETY_COLORS[safetyScan.status?.toLowerCase() ?? 'unknown'] ?? palette.subtext,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: SAFETY_COLORS[safetyScan.status?.toLowerCase() ?? 'unknown'] ?? palette.subtext,
                            }}
                          >
                            {safetyScan.is_safe === true
                              ? 'Safe'
                              : safetyScan.is_safe === false
                              ? 'Unsafe'
                              : (safetyScan.status ?? 'Unknown')}
                          </Text>
                        </View>
                      </View>
                      {safetyScan.score !== undefined ? (
                        <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                          Score: {safetyScan.score}
                        </Text>
                      ) : null}
                      {safetyScan.labels && safetyScan.labels.length > 0 ? (
                        <View style={[styles.capsRow, { marginTop: 6 }]}>
                          {safetyScan.labels.map((lbl, i) => (
                            <View key={i} style={[styles.capChip, { backgroundColor: palette.bg, marginTop: 25, borderColor: palette.divider }]}>
                              <Text style={{ fontSize: 11, color: palette.subtext }}>{lbl}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
                      No scan data available.
                    </Text>
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Shared helper ────────────────────────────────────────────────────────────

function DetailRow({ label, value, palette }: { label: string; value?: string; palette: any }) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, { borderBottomColor: palette.divider }]}>
      <Text style={[styles.detailLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  screenSubtitle: { fontSize: 13 },

  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  // Grid
  gridContent: { padding: 12, paddingBottom: 100 },
  gridRow: { flexDirection: 'row' },
  gridCell: {
    flex: 1,
    margin: 5,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  gridCellName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  gridCellMeta: { fontSize: 11, textAlign: 'center' },

  // List
  listContent: { padding: 12, gap: 10, paddingBottom: 100 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  listCardName: { fontSize: 14, fontWeight: '600' },
  listCardMeta: { fontSize: 12 },
  deleteIcon: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 90,
    alignItems: 'center',
  },
  fabText: { fontWeight: '700', fontSize: 14 },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  modalContent: { padding: 20, gap: 12, paddingBottom: 40 },

  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  previewPlaceholder: {
    height: 160,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', minWidth: 80 },
  detailValue: { fontSize: 13, flex: 1, textAlign: 'right' },

  safetyBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    gap: 4,
  },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },

  sectionLabel: { fontSize: 15, fontWeight: '700' },

  capsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
});
