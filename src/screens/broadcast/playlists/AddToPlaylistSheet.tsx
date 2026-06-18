import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import {
  addItemToPlaylist,
  createPlaylistAndAdd,
  getPlaylistsState,
  subscribeToPlaylists,
  type Playlist,
  type PlaylistFeedItem,
} from './playlistManager';

type Props = {
  item: PlaylistFeedItem | null;
  visible: boolean;
  onClose: () => void;
};

export default function AddToPlaylistSheet({ item, visible, onClose }: Props) {
  const { palette, tokens } = useKISTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [playlists, setPlaylists] = useState<Playlist[]>(
    () => getPlaylistsState().playlists,
  );
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    return subscribeToPlaylists(s => setPlaylists(s.playlists));
  }, []);

  useEffect(() => {
    if (visible) {
      setCreatingNew(false);
      setNewName('');
      setJustAdded({});
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const alreadyInPlaylist = useCallback(
    (pl: Playlist): boolean => {
      if (!item) return false;
      return pl.items.some(it => it.broadcastId === item.id);
    },
    [item],
  );

  const handleAdd = useCallback(
    (playlistId: string) => {
      if (!item) return;
      addItemToPlaylist(playlistId, item);
      setJustAdded(prev => ({ ...prev, [playlistId]: true }));
    },
    [item],
  );

  const handleCreateAndAdd = useCallback(async () => {
    if (!item || !newName.trim()) return;
    setCreating(true);
    try {
      const { playlist } = createPlaylistAndAdd(newName.trim(), item);
      setJustAdded(prev => ({ ...prev, [playlist.id]: true }));
      setNewName('');
      setCreatingNew(false);
    } finally {
      setCreating(false);
    }
  }, [item, newName]);

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [playlists],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: palette.backdrop }]} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.card,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: palette.divider }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Add to Playlist
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <KISIcon name="close" size={20} color={palette.subtext} />
            </Pressable>
          </View>

          {/* Item preview */}
          {item ? (
            <View
              style={[
                styles.itemPreview,
                { backgroundColor: palette.surface, borderColor: palette.divider },
              ]}
            >
              <KISIcon name="bookmark" size={14} color={palette.primaryStrong} />
              <Text
                style={[styles.itemPreviewText, { color: palette.subtext }]}
                numberOfLines={1}
              >
                {item.title || item.text_plain || 'Untitled broadcast'}
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={{ maxHeight: 340 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Create new playlist row */}
            {creatingNew ? (
              <View
                style={[
                  styles.newPlaylistForm,
                  { borderColor: palette.primaryStrong },
                ]}
              >
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Playlist name…"
                  placeholderTextColor={palette.subtext}
                  style={[styles.newNameInput, { color: palette.text }]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                  maxLength={60}
                />
                <View style={styles.newPlaylistActions}>
                  <Pressable
                    onPress={() => {
                      setCreatingNew(false);
                      setNewName('');
                    }}
                    style={styles.cancelBtn}
                  >
                    <Text style={[styles.cancelBtnText, { color: palette.subtext }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateAndAdd}
                    disabled={!newName.trim() || creating}
                    style={[
                      styles.createBtn,
                      {
                        backgroundColor:
                          newName.trim() ? palette.primaryStrong : palette.surface,
                        borderColor: palette.primaryStrong,
                      },
                    ]}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color={palette.surface} />
                    ) : (
                      <Text
                        style={[
                          styles.createBtnText,
                          { color: newName.trim() ? palette.surface : palette.subtext },
                        ]}
                      >
                        Create & Add
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setCreatingNew(true)}
                style={({ pressed }) => [
                  styles.newPlaylistRow,
                  {
                    backgroundColor: pressed
                      ? palette.surface
                      : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.newPlaylistIcon,
                    { backgroundColor: palette.primaryStrong + '20', borderColor: palette.primaryStrong + '50' },
                  ]}
                >
                  <KISIcon name="plus" size={16} color={palette.primaryStrong} />
                </View>
                <Text style={[styles.newPlaylistLabel, { color: palette.primaryStrong }]}>
                  Create new playlist
                </Text>
              </Pressable>
            )}

            {/* Separator */}
            {sortedPlaylists.length > 0 && (
              <View style={[styles.separator, { backgroundColor: palette.divider }]} />
            )}

            {/* Existing playlists */}
            {sortedPlaylists.length === 0 ? (
              <Text style={[styles.emptyHint, { color: palette.subtext }]}>
                No playlists yet. Create one above.
              </Text>
            ) : (
              sortedPlaylists.map(pl => {
                const inList = alreadyInPlaylist(pl) || Boolean(justAdded[pl.id]);
                return (
                  <Pressable
                    key={pl.id}
                    onPress={() => !inList && handleAdd(pl.id)}
                    style={({ pressed }) => [
                      styles.playlistRow,
                      { backgroundColor: pressed && !inList ? palette.surface : 'transparent' },
                    ]}
                  >
                    <View style={styles.playlistRowLeft}>
                      <View
                        style={[
                          styles.playlistIcon,
                          { backgroundColor: palette.surface, borderColor: palette.divider },
                        ]}
                      >
                        <KISIcon name="list" size={16} color={palette.subtext} />
                      </View>
                      <View style={styles.playlistInfo}>
                        <Text
                          style={[styles.playlistName, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {pl.name}
                        </Text>
                        <Text style={[styles.playlistCount, { color: palette.subtext }]}>
                          {pl.items.length} {pl.items.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    </View>
                    {inList ? (
                      <View
                        style={[
                          styles.addedBadge,
                          { backgroundColor: palette.success + '20', borderColor: palette.success + '60' },
                        ]}
                      >
                        <KISIcon name="check" size={12} color={palette.success} />
                        <Text style={[styles.addedText, { color: palette.success }]}>
                          Added
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.addBtn,
                          { backgroundColor: palette.primaryStrong + '18', borderColor: palette.primaryStrong + '55' },
                        ]}
                      >
                        <KISIcon name="add" size={14} color={palette.primaryStrong} />
                        <Text style={[styles.addBtnText, { color: palette.primaryStrong }]}>
                          Add
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    minHeight: 200,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  closeBtn: {
    padding: 4,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemPreviewText: {
    fontSize: 13,
    flex: 1,
    fontWeight: '600',
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  newPlaylistIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPlaylistLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  newPlaylistForm: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    gap: 10,
  },
  newNameInput: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
  },
  newPlaylistActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  playlistRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playlistName: {
    fontSize: 15,
    fontWeight: '700',
  },
  playlistCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  addedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
