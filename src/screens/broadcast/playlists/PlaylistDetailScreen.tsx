import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { KISVideo } from '@/Module/vieo';
import type { RootStackParamList } from '@/navigation/types';
import { isVideoAttachment } from '@/components/broadcast/attachmentPreview';
import {
  getBroadcastFeedVideoSources,
  getBroadcastFeedVideoPosterUrl,
} from '@/components/broadcast/feedVideoPlayback';
import {
  addItemToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistsState,
  movePlaylistItem,
  removeItemFromPlaylist,
  renamePlaylist,
  setPlaylistLoopMode,
  setPlaylistVisibility,
  subscribeToPlaylists,
  toggleItemSelectedForLoop,
  type LoopMode,
  type Playlist,
  type PlaylistItem,
} from './playlistManager';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'PlaylistDetail'>;

const LOOP_MODES: { id: LoopMode; label: string; description: string }[] = [
  { id: 'none', label: 'Off', description: 'Play through once, then stop' },
  { id: 'all', label: 'Loop All', description: 'Loop entire playlist' },
  { id: 'one', label: 'Loop One', description: 'Repeat current item' },
  { id: 'selected', label: 'Loop Selected', description: 'Loop only checked items' },
];

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getItemVideoAttachment(item: PlaylistItem['broadcastItem']): any | null {
  if (!Array.isArray(item.attachments) || item.attachments.length === 0) return null;
  return item.attachments.find(isVideoAttachment) ?? null;
}

export default function PlaylistDetailScreen() {
  const { palette, tokens } = useKISTheme();
  const { width: windowWidth } = useWindowDimensions();
  const videoHeight = Math.round(windowWidth * (9 / 16));
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { playlistId, startIndex, autoPlay } = route.params;

  const [playlist, setPlaylist] = useState<Playlist | null>(() => {
    return getPlaylistsState().playlists.find(p => p.id === playlistId) ?? null;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(startIndex ?? -1);
  const [isPlaying, setIsPlaying] = useState(Boolean(autoPlay));
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<TextInput>(null);
  const [shuffledItems, setShuffledItems] = useState<PlaylistItem[] | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [visibility, setVisibility] = useState<string>((playlist as any)?.visibility || 'public');

  useEffect(() => {
    return subscribeToPlaylists(s => {
      const found = s.playlists.find(p => p.id === playlistId) ?? null;
      setPlaylist(found);
    });
  }, [playlistId]);

  // Derive active items for the current loop mode
  const activeItems = useMemo<PlaylistItem[]>(() => {
    if (!playlist) return [];
    if (playlist.loopMode === 'selected') {
      const sel = playlist.items.filter(it => it.selectedForLoop);
      return sel.length > 0 ? sel : playlist.items;
    }
    return playlist.items;
  }, [playlist]);

  const currentItem = useMemo<PlaylistItem | null>(() => {
    if (currentIndex < 0 || !playlist) return null;
    return playlist.items[currentIndex] ?? null;
  }, [currentIndex, playlist]);

  const currentVideoAttachment = useMemo(
    () => (currentItem ? getItemVideoAttachment(currentItem.broadcastItem) : null),
    [currentItem],
  );

  const videoSources = useMemo(
    () =>
      currentVideoAttachment
        ? getBroadcastFeedVideoSources(currentVideoAttachment)
        : [],
    [currentVideoAttachment],
  );

  const posterUrl = useMemo(
    () =>
      currentVideoAttachment
        ? getBroadcastFeedVideoPosterUrl(currentVideoAttachment)
        : null,
    [currentVideoAttachment],
  );

  const activeVideoSource = videoSources[0] ?? null;

  // Advance to next item honoring loop mode
  const handleVideoEnd = useCallback(() => {
    if (!playlist) return;
    const mode = playlist.loopMode;

    if (mode === 'one') {
      // VideoPlayer handles it via loop prop; this shouldn't be called
      return;
    }

    const pool =
      mode === 'selected'
        ? playlist.items
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => it.selectedForLoop)
            .map(({ idx }) => idx)
        : playlist.items.map((_, idx) => idx);

    if (pool.length === 0) {
      setIsPlaying(false);
      return;
    }

    const currentPoolPos = pool.indexOf(currentIndex);
    const nextPoolPos = currentPoolPos + 1;

    if (nextPoolPos < pool.length) {
      setCurrentIndex(pool[nextPoolPos]);
      setIsPlaying(true);
    } else if (mode === 'all' || mode === 'selected') {
      // Loop back to start of pool
      setCurrentIndex(pool[0]);
      setIsPlaying(true);
    } else {
      // mode === 'none': end of list, stop
      setIsPlaying(false);
    }
  }, [playlist, currentIndex]);

  const handlePlayItem = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const handlePlayAll = useCallback(() => {
    if (!playlist || playlist.items.length === 0) return;
    const pool =
      playlist.loopMode === 'selected'
        ? playlist.items.findIndex(it => it.selectedForLoop)
        : 0;
    setCurrentIndex(pool >= 0 ? pool : 0);
    setIsPlaying(true);
  }, [playlist]);

  const handlePrev = useCallback(() => {
    if (!playlist) return;
    const pool =
      playlist.loopMode === 'selected'
        ? playlist.items
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => it.selectedForLoop)
            .map(({ idx }) => idx)
        : playlist.items.map((_, idx) => idx);
    if (pool.length === 0) return;
    const pos = pool.indexOf(currentIndex);
    const prev = pos <= 0 ? pool[pool.length - 1] : pool[pos - 1];
    setCurrentIndex(prev);
    setIsPlaying(true);
  }, [playlist, currentIndex]);

  const handleNext = useCallback(() => {
    handleVideoEnd();
  }, [handleVideoEnd]);

  const handleLoopModeChange = useCallback(
    (mode: LoopMode) => {
      setPlaylistLoopMode(playlistId, mode);
    },
    [playlistId],
  );

  const handleToggleSelected = useCallback(
    (itemId: string) => {
      toggleItemSelectedForLoop(playlistId, itemId);
    },
    [playlistId],
  );

  const handleMoveItem = useCallback(
    (atIndex: number, direction: 'up' | 'down') => {
      movePlaylistItem(playlistId, atIndex, direction);
    },
    [playlistId],
  );

  const handleRemoveItem = useCallback(
    (itemId: string, atIndex: number) => {
      Alert.alert('Remove from playlist', 'Remove this item from the playlist?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeItemFromPlaylist(playlistId, itemId);
            if (currentIndex === atIndex) {
              setCurrentIndex(-1);
              setIsPlaying(false);
            } else if (currentIndex > atIndex) {
              setCurrentIndex(prev => prev - 1);
            }
          },
        },
      ]);
    },
    [playlistId, currentIndex],
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      `Delete "${playlist?.name}"?`,
      'This will permanently remove this playlist.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(playlistId);
            navigation.goBack();
          },
        },
      ],
    );
  }, [playlist, playlistId, navigation]);

  const startRename = useCallback(() => {
    setNameInput(playlist?.name ?? '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 60);
  }, [playlist]);

  const commitRename = useCallback(() => {
    if (nameInput.trim()) renamePlaylist(playlistId, nameInput.trim());
    setEditingName(false);
  }, [nameInput, playlistId]);

  const items = isShuffled && shuffledItems ? shuffledItems : (playlist?.items ?? []);

  const handleShuffle = useCallback(() => {
    if (!playlist) return;
    if (isShuffled) {
      setIsShuffled(false);
      setShuffledItems(null);
    } else {
      const arr = [...playlist.items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setShuffledItems(arr);
      setIsShuffled(true);
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [isShuffled, playlist]);

  const handleSaveToWatchLater = useCallback(async () => {
    if (!playlist) return;
    const allPlaylists = getPlaylistsState().playlists;
    let watchLater = allPlaylists.find(p => p.name === 'Watch Later');
    if (!watchLater) {
      watchLater = createPlaylist('Watch Later');
    }
    // Add all items from this playlist to Watch Later
    let added = 0;
    for (const item of items) {
      const result = addItemToPlaylist(watchLater.id, item.broadcastItem);
      if (result === 'added') added++;
    }
    Alert.alert('Watch Later', added > 0 ? `Added ${added} item${added === 1 ? '' : 's'} to Watch Later` : 'All items are already in Watch Later');
  }, [playlist, items]);

  const handleChangeVisibility = useCallback(() => {
    if (!playlist) return;
    Alert.alert('Visibility', 'Set playlist visibility', [
      {
        text: 'Public',
        onPress: () => {
          setVisibility('public');
          setPlaylistVisibility(playlist.id, 'public');
        },
      },
      {
        text: 'Unlisted',
        onPress: () => {
          setVisibility('unlisted');
          setPlaylistVisibility(playlist.id, 'unlisted');
        },
      },
      {
        text: 'Private',
        onPress: () => {
          setVisibility('private');
          setPlaylistVisibility(playlist.id, 'private');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [playlist]);

  const loopMode = playlist?.loopMode ?? 'none';

  if (!playlist) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: palette.subtext }]}>
            Playlist not found.
          </Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: palette.primaryStrong }]}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg, }]} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBack}>
          <KISIcon name="chevron-left" size={22} color={palette.text} />
        </Pressable>

        {editingName ? (
          <TextInput
            ref={nameInputRef}
            value={nameInput}
            onChangeText={setNameInput}
            style={[styles.nameInput, { color: palette.text, borderBottomColor: palette.primaryStrong }]}
            returnKeyType="done"
            onSubmitEditing={commitRename}
            onBlur={commitRename}
            maxLength={60}
          />
        ) : (
          <Pressable style={styles.nameRow} onPress={startRename}>
            <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
              {playlist.name}
            </Text>
            <KISIcon name="add" size={15} color={palette.subtext} />
          </Pressable>
        )}

        <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerDelete}>
          <KISIcon name="trash" size={18} color={palette.subtext} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Player area ── */}
        <View style={[styles.playerSection, { backgroundColor: palette.card, borderBottomColor: palette.divider }]}>
          {currentItem && activeVideoSource ? (
            <KISVideo
              key={`${currentItem.id}-${currentIndex}`}
              sourceUrl={activeVideoSource.url}
              poster={posterUrl ?? undefined}
              autoPlay={isPlaying}
              loop={loopMode === 'one'}
              allowFullScreen
              onEnd={handleVideoEnd}
              containerStyle={[styles.videoContainer, { height: videoHeight }]}
            />
          ) : currentItem ? (
            // Non-video item: show a card
            <View
              style={[
                styles.noVideoCard,
                { backgroundColor: palette.surface, borderColor: palette.divider },
              ]}
            >
              <KISIcon name="list" size={28} color={palette.subtext} />
              <Text style={[styles.noVideoTitle, { color: palette.text }]} numberOfLines={2}>
                {currentItem.broadcastItem.title ||
                  currentItem.broadcastItem.text_plain ||
                  'Untitled'}
              </Text>
              <Text style={[styles.noVideoSub, { color: palette.subtext }]}>
                No video in this item
              </Text>
            </View>
          ) : (
            // Nothing selected
            <View style={styles.playerPlaceholder}>
              <KISIcon name="play" size={40} color={palette.divider} />
              <Text style={[styles.playerPlaceholderText, { color: palette.subtext }]}>
                {items.length === 0
                  ? 'Add items from the Feeds to start'
                  : 'Tap an item below or press Play All'}
              </Text>
            </View>
          )}

          {/* Playback controls */}
          {items.length > 0 && (
            <View style={styles.controls}>
              <Pressable
                onPress={handlePrev}
                disabled={currentIndex < 0}
                hitSlop={10}
                style={[
                  styles.controlBtn,
                  { backgroundColor: palette.surface, borderColor: palette.divider },
                  currentIndex < 0 && styles.controlDisabled,
                ]}
              >
                <KISIcon
                  name="arrow-left"
                  size={18}
                  color={currentIndex >= 0 ? palette.text : palette.subtext}
                />
              </Pressable>

              <Pressable
                onPress={handlePlayAll}
                style={[styles.playAllBtn, { backgroundColor: palette.primaryStrong }]}
              >
                <KISIcon name="play" size={18} color={palette.surface} />
                <Text style={[styles.playAllText, { color: palette.surface }]}>
                  Play All
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShuffle}
                hitSlop={10}
                style={[
                  styles.controlBtn,
                  { backgroundColor: isShuffled ? palette.primaryStrong : palette.surface, borderColor: isShuffled ? palette.primaryStrong : palette.divider },
                ]}
              >
                <KISIcon name="refresh" size={18} color={isShuffled ? palette.surface : palette.text} />
              </Pressable>

              <Pressable
                onPress={handleNext}
                disabled={currentIndex < 0}
                hitSlop={10}
                style={[
                  styles.controlBtn,
                  { backgroundColor: palette.surface, borderColor: palette.divider },
                  currentIndex < 0 && styles.controlDisabled,
                ]}
              >
                <KISIcon
                  name="chevron-right"
                  size={18}
                  color={currentIndex >= 0 ? palette.text : palette.subtext}
                />
              </Pressable>
            </View>
          )}

          {/* Current item label */}
          {currentItem && (
            <Text style={[styles.nowPlayingLabel, { color: palette.subtext }]} numberOfLines={1}>
              Now playing: {currentItem.broadcastItem.title || currentItem.broadcastItem.text_plain || 'Untitled'}
            </Text>
          )}
        </View>

        {/* ── Loop mode selector ── */}
        <View style={[styles.loopSection, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Loop Mode</Text>
          <View style={styles.loopModes}>
            {LOOP_MODES.map(mode => {
              const active = loopMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => handleLoopModeChange(mode.id)}
                  style={[
                    styles.loopBtn,
                    {
                      backgroundColor: active ? palette.primaryStrong : palette.surface,
                      borderColor: active ? palette.primaryStrong : palette.divider,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.loopBtnText,
                      { color: active ? palette.surface : palette.text },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loopMode === 'selected' && (
            <Text style={[styles.loopHint, { color: palette.subtext }]}>
              Check the items you want to loop below.
              {items.filter(it => it.selectedForLoop).length === 0
                ? ' No items selected — all items will play.'
                : ` ${items.filter(it => it.selectedForLoop).length} item${items.filter(it => it.selectedForLoop).length === 1 ? '' : 's'} selected.`}
            </Text>
          )}
        </View>

        {/* ── Items list ── */}
        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
              {items.length} {items.length === 1 ? 'Item' : 'Items'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Pressable
                onPress={handleChangeVisibility}
                style={[styles.visibilityPill, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <KISIcon name="lock" size={12} color={palette.subtext} />
                <Text style={[styles.visibilityLabel, { color: palette.subtext }]}>
                  {visibility.charAt(0).toUpperCase() + visibility.slice(1)}
                </Text>
              </Pressable>
              {items.length > 0 && (
                <Pressable
                  onPress={handleSaveToWatchLater}
                  style={[styles.visibilityPill, { borderColor: palette.divider, backgroundColor: palette.surface }]}
                >
                  <KISIcon name="bookmark" size={12} color={palette.primaryStrong} />
                  <Text style={[styles.visibilityLabel, { color: palette.primaryStrong }]}>Watch Later</Text>
                </Pressable>
              )}
            </View>
          </View>

          {items.length === 0 && (
            <View style={[styles.emptyItems, { borderColor: palette.divider }]}>
              <KISIcon name="add" size={24} color={palette.subtext} />
              <Text style={[styles.emptyItemsText, { color: palette.subtext }]}>
                Long-press any broadcast in the Feeds and choose "Add to playlist" to populate this playlist.
              </Text>
            </View>
          )}

          {items.map((it, idx) => {
            const isActive = idx === currentIndex;
            const videoAtt = getItemVideoAttachment(it.broadcastItem);
            const hasVideo = Boolean(videoAtt);
            const dur = it.broadcastItem.video_duration_seconds;
            const authorName =
              it.broadcastItem.author?.display_name ||
              it.broadcastItem.source?.name ||
              'Unknown';

            return (
              <Pressable
                key={it.id}
                onPress={() => handlePlayItem(idx)}
                style={({ pressed }) => [
                  styles.itemRow,
                  {
                    backgroundColor: isActive
                      ? palette.primaryStrong + '14'
                      : pressed
                      ? palette.surface
                      : 'transparent',
                    borderColor: isActive ? palette.primaryStrong + '55' : palette.divider,
                  },
                ]}
              >
                {/* Selection checkbox — only visible in 'selected' mode */}
                {loopMode === 'selected' && (
                  <Pressable
                    onPress={() => handleToggleSelected(it.id)}
                    hitSlop={10}
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: it.selectedForLoop
                          ? palette.primaryStrong
                          : palette.surface,
                        borderColor: it.selectedForLoop
                          ? palette.primaryStrong
                          : palette.divider,
                      },
                    ]}
                  >
                    {it.selectedForLoop && (
                      <KISIcon name="check" size={11} color={palette.surface} />
                    )}
                  </Pressable>
                )}

                {/* Index + play state */}
                <View
                  style={[
                    styles.itemIndex,
                    {
                      backgroundColor: isActive ? palette.primaryStrong : palette.surface,
                      borderColor: isActive ? palette.primaryStrong : palette.divider,
                    },
                  ]}
                >
                  {isActive && isPlaying ? (
                    <KISIcon name="pause" size={13} color={palette.surface} />
                  ) : (
                    <Text
                      style={[
                        styles.itemIndexText,
                        { color: isActive ? palette.surface : palette.subtext },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                {/* Info */}
                <View style={styles.itemInfo}>
                  <Text
                    style={[
                      styles.itemTitle,
                      {
                        color: isActive ? palette.primaryStrong : palette.text,
                        fontWeight: isActive ? '800' : '600',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {it.broadcastItem.title ||
                      it.broadcastItem.text_plain ||
                      'Untitled broadcast'}
                  </Text>
                  <View style={styles.itemMeta}>
                    {hasVideo && (
                      <KISIcon name="play" size={10} color={palette.subtext} />
                    )}
                    <Text style={[styles.itemMetaText, { color: palette.subtext }]}>
                      {authorName}
                      {dur ? `  ·  ${formatDuration(dur)}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Reorder buttons */}
                <View style={styles.reorderBtns}>
                  <Pressable
                    onPress={() => handleMoveItem(idx, 'up')}
                    disabled={idx === 0}
                    hitSlop={8}
                    style={[styles.reorderBtn, { opacity: idx === 0 ? 0.25 : 1 }]}
                  >
                    <Text style={[styles.reorderArrow, { color: palette.subtext }]}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleMoveItem(idx, 'down')}
                    disabled={idx === items.length - 1}
                    hitSlop={8}
                    style={[styles.reorderBtn, { opacity: idx === items.length - 1 ? 0.25 : 1 }]}
                  >
                    <Text style={[styles.reorderArrow, { color: palette.subtext }]}>↓</Text>
                  </Pressable>
                </View>

                {/* Remove button */}
                <Pressable
                  onPress={() => handleRemoveItem(it.id, idx)}
                  hitSlop={10}
                  style={styles.removeBtn}
                >
                  <KISIcon name="close" size={16} color={palette.subtext} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ─── Header ───────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerBack: { padding: 2, flexShrink: 0 },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    letterSpacing: 0.1,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    borderBottomWidth: 2,
    paddingBottom: 2,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  headerDelete: { padding: 4, flexShrink: 0 },

  // ─── Player ───────────────────────────────────
  playerSection: {
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  videoContainer: {
    height: 224,
    borderRadius: 0,
  },
  noVideoCard: {
    height: 180,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  noVideoTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  noVideoSub: {
    fontSize: 13,
  },
  playerPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  playerPlaceholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: {
    opacity: 0.35,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  playAllText: {
    fontSize: 15,
    fontWeight: '800',
  },
  nowPlayingLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // ─── Loop mode ────────────────────────────────
  loopSection: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loopModes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  loopBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loopHint: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // ─── Items list ───────────────────────────────
  itemsSection: {
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 4,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emptyItems: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyItemsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemIndex: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemIndexText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    fontSize: 12,
    fontWeight: '400',
  },
  reorderBtns: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    flexShrink: 0,
  },
  reorderBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  reorderArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 4,
    flexShrink: 0,
  },

  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  visibilityLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ─── Not found ────────────────────────────────
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
  },
  backLink: { padding: 8 },
  backLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
