import React, { useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelContent } from '@/screens/broadcast/channels/api/channels.types';

type Props = {
  contents: BroadcastChannelContent[];
  legacyFeeds: any[];
  onCreate: () => void;
  onToggleBroadcast?: (content: BroadcastChannelContent, nextState: boolean) => void | Promise<void>;
  broadcastingId?: string | null;
  onUpdateTags?: (contentId: string, tags: string[]) => void;
};

const statusLabel = (value?: string) => String(value || 'draft').replace(/_/g, ' ').toUpperCase();

export default function ChannelContentManager({ contents, legacyFeeds, onCreate, onToggleBroadcast, broadcastingId, onUpdateTags }: Props) {
  const { palette } = useKISTheme();
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});

  const handleAddTag = useCallback((contentId: string) => {
    const text = (tagInput[contentId] || '').trim().replace(/,+$/, '');
    if (!text) return;
    const newTags = [...(tagsMap[contentId] || [])];
    text.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
      if (!newTags.includes(t)) newTags.push(t);
    });
    setTagsMap(prev => ({ ...prev, [contentId]: newTags }));
    setTagInput(prev => ({ ...prev, [contentId]: '' }));
    onUpdateTags?.(contentId, newTags);
  }, [tagInput, tagsMap, onUpdateTags]);

  const handleRemoveTag = useCallback((contentId: string, tag: string) => {
    const newTags = (tagsMap[contentId] || []).filter(t => t !== tag);
    setTagsMap(prev => ({ ...prev, [contentId]: newTags }));
    onUpdateTags?.(contentId, newTags);
  }, [tagsMap, onUpdateTags]);

  const rows = useMemo(() => {
    if (contents.length) return contents;
    return legacyFeeds.map(feed => ({
      id: String(feed.id),
      title: feed.title || 'Untitled feed item',
      content_type: feed.media_type || 'text',
      status: feed.is_broadcast ? 'published' : 'draft',
      visibility: feed.is_broadcast ? 'public' : 'private',
      text_plain_preview: feed.summary || '',
      is_broadcast: Boolean(feed.is_broadcast),
      broadcast_id: feed.broadcast_id || '',
      engagement_counts: {},
    })) as BroadcastChannelContent[];
  }, [contents, legacyFeeds]);

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Content manager</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>Drafts, scheduled posts, published uploads, and archived items.</Text>
        </View>
        <Pressable onPress={onCreate} style={[styles.createButton, { backgroundColor: palette.text }]}> 
          <KISIcon name="add" size={16} color={palette.surface} />
          <Text style={[styles.createText, { color: palette.surface }]}>Create</Text>
        </Pressable>
      </View>
      {rows.length ? rows.slice(0, 6).map(item => {
        const isBroadcast = Boolean(item.is_broadcast || item.broadcast_id);
        const isBusy = broadcastingId === item.id;
        const canToggle = Boolean(onToggleBroadcast && contents.length);
        return (
          <View key={item.id} style={[styles.itemBlock, { borderColor: palette.border }]}>
            <View style={styles.row}>
              <View style={[styles.typeIcon, { backgroundColor: palette.primarySoft }]}>
                <KISIcon name={String(item.content_type).includes('video') ? 'video' : item.content_type === 'audio' ? 'audio' : item.content_type === 'document' ? 'file' : 'edit'} size={16} color={palette.primaryStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTitleLine}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{item.title || item.text_plain_preview || 'Untitled channel content'}</Text>
                  {isBroadcast ? <Text style={[styles.liveChip, { color: palette.primaryStrong, borderColor: palette.primary }]}>BROADCAST</Text> : null}
                </View>
                <Text numberOfLines={1} style={[styles.rowMeta, { color: palette.subtext }]}>{String(item.content_type || 'post').replace(/_/g, ' ')} · {statusLabel(item.status)} · {item.visibility || 'private'}</Text>
              </View>
              {canToggle ? (
                <Pressable
                  disabled={isBusy}
                  onPress={() => onToggleBroadcast?.(item, !isBroadcast)}
                  style={[styles.broadcastButton, { borderColor: isBroadcast ? palette.error || '#B42318' : palette.primary, opacity: isBusy ? 0.7 : 1 }]}
                >
                  {isBusy ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
                  <Text style={[styles.broadcastText, { color: isBroadcast ? palette.error || '#B42318' : palette.primaryStrong }]}>{isBroadcast ? 'Stop' : 'Broadcast'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setExpandedTags(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <KISIcon name="chevron-down" size={14} color={palette.subtext} />
              </Pressable>
            </View>
            {expandedTags[item.id] && (
              <View style={styles.tagsSection}>
                <View style={styles.tagsList}>
                  {(tagsMap[item.id] || []).map(tag => (
                    <View key={tag} style={[styles.tagPill, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
                      <Text style={[styles.tagText, { color: palette.primaryStrong }]}>{tag}</Text>
                      <Pressable onPress={() => handleRemoveTag(item.id, tag)} hitSlop={6}>
                        <KISIcon name="close" size={10} color={palette.primaryStrong} />
                      </Pressable>
                    </View>
                  ))}
                  <TextInput
                    value={tagInput[item.id] || ''}
                    placeholder="Add tag…"
                    placeholderTextColor={palette.subtext}
                    style={[styles.tagInput, { color: palette.text, borderColor: palette.border }]}
                    returnKeyType="done"
                    onSubmitEditing={() => handleAddTag(item.id)}
                    onChangeText={text => {
                      setTagInput(prev => ({ ...prev, [item.id]: text }));
                      if (text.endsWith(',')) {
                        handleAddTag(item.id);
                      }
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      }) : (
        <View style={[styles.empty, { borderColor: palette.border }]}> 
          <Text style={[styles.rowTitle, { color: palette.text }]}>No channel content yet</Text>
          <Text style={[styles.rowMeta, { color: palette.subtext }]}>Use Create to publish into the new normalized channel library.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  createButton: { minHeight: 36, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  createText: { fontSize: 12, fontWeight: '900' },
  row: { borderTopWidth: 1, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { flex: 1, fontSize: 13, fontWeight: '900' },
  rowMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  liveChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '900' },
  broadcastButton: { minHeight: 34, minWidth: 76, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  broadcastText: { fontSize: 11, fontWeight: '900' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 14 },
  itemBlock: { borderTopWidth: 0 },
  tagsSection: { paddingBottom: 10, paddingHorizontal: 4 },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '700' },
  tagInput: { minWidth: 90, flex: 1, borderBottomWidth: 1, paddingVertical: 4, paddingHorizontal: 6, fontSize: 12, fontWeight: '600' },
});
