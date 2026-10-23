// src/screens/broadcast/channels/studio/ChannelPlaylistsManager.tsx
//
// Full playlist CRUD for a channel - create, rename, edit description,
// change visibility, delete, add/remove content, and reorder. Previously
// the Playlists tab only ever showed a read-only title list ("Playlist
// creation and reorder UI is prepared for the playlist API; no public
// playlists are available yet") even though the channel-level playlist API
// (apps/broadcasts/views.py's BroadcastPlaylist* views) already supported
// create/add-item/remove-item/reorder - only rename/edit-description/
// change-visibility/delete were genuinely missing backend endpoints
// (added alongside this file - BroadcastPlaylistDetailView).
//
// Reordering uses up/down buttons rather than a drag gesture - no
// drag-and-drop library exists anywhere else in this app yet, and adding
// one is a bigger, separate decision than this feature needs.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import type { BroadcastChannelContent, BroadcastChannelPlaylist } from '@/screens/broadcast/channels/api/channels.types';
import {
  type ChannelPlaylistItemRow,
  addChannelPlaylistItem,
  createChannelPlaylist,
  deleteChannelPlaylist,
  fetchChannelContents,
  fetchChannelPlaylistItems,
  fetchChannelPlaylists,
  removeChannelPlaylistItem,
  reorderChannelPlaylistItems,
  updateChannelPlaylist,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = { channelId: string };

const VISIBILITY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'public', label: 'Public' },
  { id: 'unlisted', label: 'Unlisted' },
  { id: 'private', label: 'Private' },
];

export default function ChannelPlaylistsManager({ channelId }: Props) {
  const { palette } = useKISTheme();
  const { bodyFontSize } = useResponsiveLayout();

  const [playlists, setPlaylists] = useState<BroadcastChannelPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newVisibility, setNewVisibility] = useState('public');
  const [createError, setCreateError] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChannelPlaylists(channelId);
      setPlaylists(rows);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      setCreateError('Give your playlist a name.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createChannelPlaylist(channelId, { title, visibility: newVisibility });
      setNewTitle('');
      setNewVisibility('public');
      setCreateVisible(false);
      await loadPlaylists();
    } catch (err: any) {
      setCreateError(err?.message || 'Unable to create playlist.');
    } finally {
      setCreating(false);
    }
  }, [channelId, newTitle, newVisibility, loadPlaylists]);

  if (loading && !playlists.length) {
    return (
      <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', paddingVertical: 24 }]}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.panel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text, fontSize: bodyFontSize + 3 }]}>Playlists</Text>
            <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
              Group your content so viewers can watch in order.
            </Text>
          </View>
          <KISButton title={createVisible ? 'Cancel' : '+ New playlist'} size="sm" variant={createVisible ? 'outline' : 'primary'} onPress={() => setCreateVisible(v => !v)} />
        </View>

        {createVisible ? (
          <View style={[styles.createCard, { borderColor: palette.border }]}>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Playlist name"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
            />
            <View style={styles.chipRow}>
              {VISIBILITY_OPTIONS.map(opt => (
                <KISButton
                  key={opt.id}
                  title={opt.label}
                  size="xs"
                  variant={newVisibility === opt.id ? 'primary' : 'outline'}
                  onPress={() => setNewVisibility(opt.id)}
                />
              ))}
            </View>
            {createError ? <Text style={[styles.errorText, { color: palette.danger }]}>{createError}</Text> : null}
            <KISButton title={creating ? 'Creating…' : 'Create playlist'} onPress={handleCreate} disabled={creating} loading={creating} />
          </View>
        ) : null}

        {!playlists.length ? (
          <Text style={[styles.emptyText, { color: palette.subtext, fontSize: bodyFontSize - 1 }]}>
            No playlists yet. Create one to start grouping your content.
          </Text>
        ) : (
          playlists.map(playlist => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              channelId={channelId}
              expanded={expandedId === playlist.id}
              onToggle={() => setExpandedId(cur => (cur === playlist.id ? null : playlist.id))}
              onChanged={loadPlaylists}
              onDeleted={() => {
                setExpandedId(cur => (cur === playlist.id ? null : cur));
                void loadPlaylists();
              }}
            />
          ))
        )}
      </View>
    </View>
  );
}

function PlaylistRow({
  playlist,
  channelId,
  expanded,
  onToggle,
  onChanged,
  onDeleted,
}: {
  playlist: BroadcastChannelPlaylist;
  channelId: string;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { palette } = useKISTheme();
  const { bodyFontSize } = useResponsiveLayout();

  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || '');
  const [visibility, setVisibility] = useState(playlist.visibility || 'public');
  const [savingMeta, setSavingMeta] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [items, setItems] = useState<ChannelPlaylistItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const [addPickerVisible, setAddPickerVisible] = useState(false);
  const [addableContent, setAddableContent] = useState<BroadcastChannelContent[]>([]);
  const [loadingAddable, setLoadingAddable] = useState(false);
  const [addingContentId, setAddingContentId] = useState<string | null>(null);

  useEffect(() => {
    setTitle(playlist.title);
    setDescription(playlist.description || '');
    setVisibility(playlist.visibility || 'public');
  }, [playlist.id, playlist.title, playlist.description, playlist.visibility]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const { items: rows } = await fetchChannelPlaylistItems(playlist.id);
      setItems(rows);
    } finally {
      setLoadingItems(false);
    }
  }, [playlist.id]);

  useEffect(() => {
    if (expanded) void loadItems();
  }, [expanded, loadItems]);

  const dirty = title.trim() !== playlist.title || description.trim() !== (playlist.description || '') || visibility !== (playlist.visibility || 'public');

  const handleSaveMeta = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMetaError('Playlist name is required.');
      return;
    }
    setSavingMeta(true);
    setMetaError(null);
    try {
      const updated = await updateChannelPlaylist(playlist.id, { title: trimmedTitle, description: description.trim(), visibility });
      if (!updated) throw new Error('Unable to save changes.');
      onChanged();
    } catch (err: any) {
      setMetaError(err?.message || 'Unable to save changes.');
    } finally {
      setSavingMeta(false);
    }
  }, [playlist.id, title, description, visibility, onChanged]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete this playlist?',
      `"${playlist.title}" will be removed. The videos and posts inside it are not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ok = await deleteChannelPlaylist(playlist.id);
              if (ok) onDeleted();
              else Alert.alert('Unable to delete', 'Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [playlist.id, playlist.title, onDeleted]);

  const handleRemoveItem = useCallback(async (contentId: string) => {
    setBusyItemId(contentId);
    try {
      const ok = await removeChannelPlaylistItem(playlist.id, contentId);
      if (ok) await loadItems();
      else Alert.alert('Unable to remove', 'Please try again.');
    } finally {
      setBusyItemId(null);
    }
  }, [playlist.id, loadItems]);

  const handleMove = useCallback(async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setItems(reordered);
    setBusyItemId(moved.itemId);
    try {
      const ok = await reorderChannelPlaylistItems(playlist.id, reordered.map(row => row.itemId));
      if (!ok) {
        Alert.alert('Unable to reorder', 'Please try again.');
        await loadItems();
      }
    } finally {
      setBusyItemId(null);
    }
  }, [items, playlist.id, loadItems]);

  const openAddPicker = useCallback(async () => {
    setAddPickerVisible(true);
    setLoadingAddable(true);
    try {
      const { contents } = await fetchChannelContents(channelId, { limit: 50 });
      const existingIds = new Set(items.map(row => row.content.id));
      setAddableContent(contents.filter(c => !existingIds.has(c.id)));
    } finally {
      setLoadingAddable(false);
    }
  }, [channelId, items]);

  const handleAddContent = useCallback(async (contentId: string) => {
    setAddingContentId(contentId);
    try {
      const ok = await addChannelPlaylistItem(playlist.id, contentId);
      if (ok) {
        await loadItems();
        setAddableContent(prev => prev.filter(c => c.id !== contentId));
      } else {
        Alert.alert('Unable to add', 'Please try again.');
      }
    } finally {
      setAddingContentId(null);
    }
  }, [playlist.id, loadItems]);

  return (
    <View style={[styles.playlistCard, { borderColor: palette.border }]}>
      <Pressable onPress={onToggle} style={styles.playlistHeaderRow} accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${playlist.title}`}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.playlistTitle, { color: palette.text, fontSize: bodyFontSize }]} numberOfLines={1}>{playlist.title}</Text>
          <Text style={[styles.playlistMeta, { color: palette.subtext, fontSize: bodyFontSize - 3 }]}>
            {(playlist.visibility || 'public').replace(/^./, c => c.toUpperCase())}
            {playlist.description ? ` · ${playlist.description}` : ''}
          </Text>
        </View>
        <KISIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.subtext} />
      </Pressable>

      {expanded ? (
        <View style={styles.playlistBody}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Playlist name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={palette.subtext}
            multiline
            style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
          />
          <View style={styles.chipRow}>
            {VISIBILITY_OPTIONS.map(opt => (
              <KISButton key={opt.id} title={opt.label} size="xs" variant={visibility === opt.id ? 'primary' : 'outline'} onPress={() => setVisibility(opt.id)} />
            ))}
          </View>
          {metaError ? <Text style={[styles.errorText, { color: palette.danger }]}>{metaError}</Text> : null}
          <View style={styles.actionRow}>
            <KISButton title={savingMeta ? 'Saving…' : 'Save changes'} size="sm" onPress={handleSaveMeta} disabled={savingMeta || !dirty} loading={savingMeta} style={{ flex: 1 }} />
            <KISButton
              title={deleting ? 'Deleting…' : 'Delete'}
              size="sm"
              variant="danger"
              onPress={handleDelete}
              disabled={deleting}
              loading={deleting}
              left={!deleting ? <KISIcon name="trash" size={14} color={palette.onPrimary ?? '#fff'} /> : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <Text style={[styles.sectionLabel, { color: palette.text, fontSize: bodyFontSize - 1 }]}>Content in this playlist</Text>
          {loadingItems ? (
            <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 8 }} />
          ) : items.length ? (
            items.map((row, index) => (
              <View key={row.itemId} style={[styles.itemRow, { borderColor: palette.border }]}>
                <Text style={[styles.itemTitle, { color: palette.text, fontSize: bodyFontSize - 1 }]} numberOfLines={1}>
                  {row.content.title || 'Untitled'}
                </Text>
                <View style={styles.itemActions}>
                  <Pressable onPress={() => handleMove(index, -1)} disabled={index === 0 || busyItemId === row.itemId} accessibilityLabel="Move up" style={styles.itemIconButton}>
                    <KISIcon name="chevron-up" size={16} color={index === 0 ? palette.border : palette.subtext} />
                  </Pressable>
                  <Pressable onPress={() => handleMove(index, 1)} disabled={index === items.length - 1 || busyItemId === row.itemId} accessibilityLabel="Move down" style={styles.itemIconButton}>
                    <KISIcon name="chevron-down" size={16} color={index === items.length - 1 ? palette.border : palette.subtext} />
                  </Pressable>
                  {busyItemId === row.content.id ? (
                    <ActivityIndicator size="small" color={palette.primaryStrong} />
                  ) : (
                    <Pressable onPress={() => handleRemoveItem(row.content.id)} accessibilityLabel={`Remove ${row.content.title} from playlist`} style={styles.itemIconButton}>
                      <KISIcon name="close" size={16} color={palette.danger} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: palette.subtext, fontSize: bodyFontSize - 2 }]}>Nothing in this playlist yet.</Text>
          )}

          {addPickerVisible ? (
            <View style={[styles.addPicker, { borderColor: palette.border }]}>
              {loadingAddable ? (
                <ActivityIndicator color={palette.primaryStrong} style={{ marginVertical: 8 }} />
              ) : addableContent.length ? (
                addableContent.map(content => (
                  <View key={content.id} style={[styles.itemRow, { borderColor: palette.border }]}>
                    <Text style={[styles.itemTitle, { color: palette.text, fontSize: bodyFontSize - 1 }]} numberOfLines={1}>{content.title || 'Untitled'}</Text>
                    {addingContentId === content.id ? (
                      <ActivityIndicator size="small" color={palette.primaryStrong} />
                    ) : (
                      <Pressable onPress={() => handleAddContent(content.id)} accessibilityLabel={`Add ${content.title} to playlist`} style={styles.itemIconButton}>
                        <KISIcon name="add" size={18} color={palette.primaryStrong} />
                      </Pressable>
                    )}
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: palette.subtext, fontSize: bodyFontSize - 2 }]}>Everything you've published is already in this playlist.</Text>
              )}
              <KISButton title="Done" size="xs" variant="ghost" onPress={() => setAddPickerVisible(false)} />
            </View>
          ) : (
            <KISButton title="+ Add content" size="sm" variant="outline" onPress={openAddPicker} style={{ marginTop: 8 }} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontWeight: '900' },
  subtitle: { marginTop: 3, lineHeight: 16, fontWeight: '700' },
  createCard: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 8 },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontWeight: '700' },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  errorText: { fontWeight: '800', fontSize: 12 },
  emptyText: { fontWeight: '600', paddingVertical: 6 },
  playlistCard: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  playlistHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  playlistTitle: { fontWeight: '800' },
  playlistMeta: { marginTop: 2, fontWeight: '600' },
  playlistBody: { padding: 12, paddingTop: 0, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  divider: { height: 1, marginVertical: 6 },
  sectionLabel: { fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1 },
  itemTitle: { flex: 1, fontWeight: '700' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemIconButton: { padding: 6 },
  addPicker: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 8, gap: 4 },
});
