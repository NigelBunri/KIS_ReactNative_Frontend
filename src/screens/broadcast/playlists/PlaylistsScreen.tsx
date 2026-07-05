import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistsState,
  refreshPlaylistsFromServer,
  subscribeToPlaylists,
  type Playlist,
} from './playlistManager';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default function PlaylistsScreen() {
  const { palette, tokens } = useKISTheme();
  const navigation = useNavigation<Nav>();
  const [playlists, setPlaylists] = useState<Playlist[]>(
    () => getPlaylistsState().playlists,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    return subscribeToPlaylists(s => setPlaylists(s.playlists));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPlaylistsFromServer();
    }, []),
  );

  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [playlists],
  );

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewName('');
    setCreating(false);
  }, [newName]);

  const handleDelete = useCallback((pl: Playlist) => {
    Alert.alert(
      `Delete "${pl.name}"?`,
      `This will permanently remove the playlist and all ${pl.items.length} item${pl.items.length === 1 ? '' : 's'} from it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePlaylist(pl.id),
        },
      ],
    );
  }, []);

  const handleOpen = useCallback(
    (pl: Playlist) => {
      navigation.navigate('PlaylistDetail', { playlistId: pl.id });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, marginTop: 25 }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="chevron-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>My Playlists</Text>
        <Pressable
          onPress={() => {
            setCreating(true);
            setTimeout(() => nameInputRef.current?.focus(), 80);
          }}
          hitSlop={12}
          style={styles.headerAction}
        >
          <KISIcon name="plus" size={22} color={palette.primaryStrong} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Create new playlist form */}
        {creating && (
          <View
            style={[
              styles.createForm,
              { backgroundColor: palette.card, borderColor: palette.primaryStrong },
            ]}
          >
            <KISIcon name="list" size={20} color={palette.primaryStrong} />
            <TextInput
              ref={nameInputRef}
              value={newName}
              onChangeText={setNewName}
              placeholder="Playlist name…"
              placeholderTextColor={palette.subtext}
              style={[styles.createInput, { color: palette.text }]}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              maxLength={60}
              autoFocus
            />
            <Pressable
              onPress={handleCreate}
              disabled={!newName.trim()}
              style={[
                styles.createConfirmBtn,
                { backgroundColor: newName.trim() ? palette.primaryStrong : palette.surface },
              ]}
            >
              <KISIcon
                name="check"
                size={16}
                color={newName.trim() ? palette.surface : palette.subtext}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setCreating(false);
                setNewName('');
              }}
              style={styles.createCancelBtn}
              hitSlop={8}
            >
              <KISIcon name="close" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {sortedPlaylists.length === 0 && !creating && (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: palette.surface, borderColor: palette.divider },
              ]}
            >
              <KISIcon name="list" size={32} color={palette.subtext} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No playlists yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>
              Create a playlist to organise broadcasts and watch them in sequence with custom loop settings.
            </Text>
            <Pressable
              onPress={() => {
                setCreating(true);
                setTimeout(() => nameInputRef.current?.focus(), 80);
              }}
              style={[
                styles.emptyCreateBtn,
                { backgroundColor: palette.primaryStrong },
              ]}
            >
              <KISIcon name="plus" size={16} color={palette.surface} />
              <Text style={[styles.emptyCreateBtnText, { color: palette.surface }]}>
                Create Playlist
              </Text>
            </Pressable>
          </View>
        )}

        {/* Playlist cards */}
        {sortedPlaylists.map(pl => (
          <Pressable
            key={pl.id}
            onPress={() => handleOpen(pl)}
            style={({ pressed }) => [
              styles.playlistCard,
              {
                backgroundColor: pressed ? palette.surface : palette.card,
                borderColor: palette.divider,
              },
            ]}
          >
            {/* Left: icon + info */}
            <View
              style={[
                styles.playlistCardIcon,
                { backgroundColor: palette.surface, borderColor: palette.divider },
              ]}
            >
              <KISIcon name="list" size={22} color={palette.primaryStrong} />
            </View>

            <View style={styles.playlistCardInfo}>
              <Text
                style={[styles.playlistCardName, { color: palette.text }]}
                numberOfLines={1}
              >
                {pl.name}
              </Text>
              <View style={styles.playlistCardMeta}>
                <Text style={[styles.playlistCardCount, { color: palette.subtext }]}>
                  {pl.items.length} {pl.items.length === 1 ? 'item' : 'items'}
                </Text>
                {pl.loopMode !== 'none' && (
                  <>
                    <Text style={[styles.metaDot, { color: palette.divider }]}>·</Text>
                    <Text style={[styles.playlistCardLoop, { color: palette.primaryStrong }]}>
                      {pl.loopMode === 'all'
                        ? 'Loop all'
                        : pl.loopMode === 'one'
                        ? 'Loop one'
                        : 'Loop selected'}
                    </Text>
                  </>
                )}
              </View>
              <Text style={[styles.playlistCardDate, { color: palette.subtext }]}>
                Updated {formatRelativeTime(pl.updatedAt)}
              </Text>
            </View>

            {/* Right: actions */}
            <View style={styles.playlistCardActions}>
              <Pressable
                onPress={() => handleDelete(pl)}
                hitSlop={10}
                style={styles.deleteBtn}
              >
                <KISIcon name="trash" size={17} color={palette.subtext} />
              </Pressable>
              <KISIcon name="chevron-right" size={18} color={palette.subtext} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 2, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  headerAction: { padding: 4 },
  scroll: {
    padding: 16,
    gap: 12,
  },
  createForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  createConfirmBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCancelBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyCreateBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  playlistCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playlistCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  playlistCardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  playlistCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playlistCardCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 13,
  },
  playlistCardLoop: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playlistCardDate: {
    fontSize: 12,
    fontWeight: '400',
  },
  playlistCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  deleteBtn: {
    padding: 4,
  },
});
