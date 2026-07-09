import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyAlbum'>;

type Photo = {
  id: string;
  url?: string;
  thumb_url?: string;
};

type Album = {
  id: string;
  name: string;
  cover_url?: string;
  photo_count: number;
  photos?: Photo[];
};

export default function FamilyAlbumScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.albums)
        .then((res: any) => {
          if (!active) return;
          setAlbums(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setAlbums([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const gutter = layout.pageGutter;
  const colGap = 10;
  const cardSize = (layout.width - gutter * 2 - colGap) / 2;

  async function handleCreateAlbum() {
    if (!newName.trim()) {
      Alert.alert('Album name is required');
      return;
    }
    setSaving(true);
    try {
      const created = await postRequest(ROUTES.family.albums, { name: newName.trim() }) as Album;
      setAlbums((prev) => [...prev, { ...created, photo_count: 0 }]);
      setShowCreate(false);
      setNewName('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create album');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  // Photo grid view
  if (selectedAlbum) {
    const photos = selectedAlbum.photos ?? [];
    const photoSize = (layout.width - gutter * 2 - 6) / 3;
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <View style={[styles.albumHeader, { paddingHorizontal: gutter }]}>
          <TouchableOpacity onPress={() => setSelectedAlbum(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.albumTitle, { color: palette.text }]}>{selectedAlbum.name}</Text>
          <Text style={[styles.photoCount, { color: palette.subtext }]}>
            {selectedAlbum.photo_count} photos
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 80 }}>
          <View style={styles.photoGrid}>
            {photos.length === 0 ? (
              <View style={[styles.emptyAlbum, { borderColor: palette.divider }]}>
                <KISIcon name="images-outline" size={40} color={palette.subtext} />
                <Text style={[styles.emptyAlbumText, { color: palette.subtext }]}>No photos yet</Text>
              </View>
            ) : (
              photos.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.photoThumb,
                    {
                      width: photoSize,
                      height: photoSize,
                      backgroundColor: palette.surface,
                      borderColor: palette.divider,
                    },
                  ]}
                >
                  <KISIcon name="image-outline" size={24} color={palette.subtext} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: colGap }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80, gap: colGap }}
        ListHeaderComponent={
          <Text style={[styles.screenTitle, { color: palette.text }]}>Family Albums</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <KISIcon name="images-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No albums yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.albumCard,
              { width: cardSize, backgroundColor: palette.card, borderColor: palette.divider },
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedAlbum(item)}
          >
            <View style={[styles.albumCover, { backgroundColor: palette.surface, width: cardSize, height: cardSize }]}>
              <KISIcon name="images-outline" size={32} color={palette.subtext} />
            </View>
            <View style={styles.albumMeta}>
              <Text style={[styles.albumName, { color: palette.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.albumCount, { color: palette.subtext }]}>
                {item.photo_count} photos
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* New Album FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      {/* Create Album Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>New Album</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
              placeholder="Album name"
              placeholderTextColor={palette.subtext}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <KISButton title="Cancel" variant="ghost" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
              <KISButton
                title={saving ? 'Creating…' : 'Create'}
                onPress={handleCreateAlbum}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  albumCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  albumCover: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumMeta: { padding: 10 },
  albumName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  albumCount: { fontSize: 12 },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  albumTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  photoCount: { fontSize: 13 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  photoThumb: {
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  emptyAlbum: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 60,
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    width: '100%',
  },
  emptyAlbumText: { fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
