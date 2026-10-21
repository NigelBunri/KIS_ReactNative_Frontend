import React, { useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelContent } from '@/screens/broadcast/channels/api/channels.types';
import ThumbnailPickerSheet from '@/screens/broadcast/channels/components/ThumbnailPickerSheet';

type Props = {
  contents: BroadcastChannelContent[];
  legacyFeeds: any[];
  onCreate: () => void;
  onToggleBroadcast?: (content: BroadcastChannelContent, nextState: boolean) => void | Promise<void>;
  broadcastingId?: string | null;
  onUpdateTags?: (contentId: string, tags: string[]) => void;
  // CONFIRMED ROOT CAUSE of "subscribers never get notified of new
  // content": nothing in the app ever called the publish endpoint at
  // all - content uploaded via Create stayed a draft forever. This is
  // the one action that actually fans out CHANNEL_CONTENT_PUBLISHED
  // notifications to subscribers (see apps.broadcasts.views
  // .ChannelContentPublishView / _notify_channel_subscribers).
  onPublish?: (content: BroadcastChannelContent) => void | Promise<void>;
  publishingId?: string | null;
  // Gates this post behind an active paid channel membership
  // (ChannelContent.Visibility.MEMBERS_ONLY, enforced server-side in
  // _user_can_view_content) — the member-only-posts half of the perk
  // gating the join/membership system was otherwise missing entirely.
  onToggleMembersOnly?: (content: BroadcastChannelContent, nextMembersOnly: boolean) => void | Promise<void>;
  togglingMembersOnlyId?: string | null;
};

const statusLabel = (value?: string) => String(value || 'draft').replace(/_/g, ' ').toUpperCase();

export default function ChannelContentManager({ contents, legacyFeeds, onCreate, onToggleBroadcast, broadcastingId, onUpdateTags, onPublish, publishingId, onToggleMembersOnly, togglingMembersOnlyId }: Props) {
  const { palette } = useKISTheme();
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [thumbnailTarget, setThumbnailTarget] = useState<BroadcastChannelContent | null>(null);

  const getTags = useCallback((item: BroadcastChannelContent) => {
    if (tagsMap[item.id] !== undefined) return tagsMap[item.id];
    return item.tags || [];
  }, [tagsMap]);

  const handleAddTag = useCallback((item: BroadcastChannelContent) => {
    const contentId = item.id;
    const text = (tagInput[contentId] || '').trim().replace(/,+$/, '');
    if (!text) return;
    const newTags = [...getTags(item)];
    text.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
      if (!newTags.includes(t)) newTags.push(t);
    });
    setTagsMap(prev => ({ ...prev, [contentId]: newTags }));
    setTagInput(prev => ({ ...prev, [contentId]: '' }));
    onUpdateTags?.(contentId, newTags);
  }, [tagInput, getTags, onUpdateTags]);

  const handleRemoveTag = useCallback((item: BroadcastChannelContent, tag: string) => {
    const newTags = getTags(item).filter(t => t !== tag);
    setTagsMap(prev => ({ ...prev, [item.id]: newTags }));
    onUpdateTags?.(item.id, newTags);
  }, [getTags, onUpdateTags]);

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Content manager</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>Drafts, scheduled posts, published uploads, and archived items.</Text>
        </View>
        <KISButton
          variant="primary"
          size="sm"
          title="Create"
          left={<KISIcon name="add" size={16} color={palette.onGold} />}
          onPress={onCreate}
        />
      </View>
      {rows.length ? rows.slice(0, 6).map(item => {
        const isBroadcast = Boolean(item.is_broadcast || item.broadcast_id);
        const isBusy = broadcastingId === item.id;
        const canToggle = Boolean(onToggleBroadcast && contents.length);
        const isDraft = String(item.status || 'draft').toLowerCase() === 'draft';
        const isPublishing = publishingId === item.id;
        const canPublish = Boolean(onPublish && contents.length && isDraft);
        const isMembersOnly = String(item.visibility || '').toLowerCase() === 'members_only';
        const isTogglingMembersOnly = togglingMembersOnlyId === item.id;
        const canToggleMembersOnly = Boolean(onToggleMembersOnly && contents.length);
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
              {canPublish ? (
                <KISButton
                  variant="secondary"
                  size="xs"
                  title="Publish"
                  loading={isPublishing}
                  disabled={isPublishing}
                  onPress={() => onPublish?.(item)}
                  accessibilityLabel={`Publish "${item.title || 'this content'}"`}
                />
              ) : null}
              {canToggle ? (
                <KISButton
                  variant={isBroadcast ? 'danger' : 'secondary'}
                  size="xs"
                  title={isBroadcast ? 'Stop' : 'Broadcast'}
                  loading={isBusy}
                  disabled={isBusy}
                  onPress={() => onToggleBroadcast?.(item, !isBroadcast)}
                />
              ) : null}
              <Pressable
                onPress={() => setExpandedTags(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                hitSlop={15}
                style={styles.chevronButton}
                accessibilityRole="button"
                accessibilityLabel={expandedTags[item.id] ? 'Collapse tags and thumbnail options' : 'Expand tags and thumbnail options'}
              >
                <KISIcon name="chevron-down" size={14} color={palette.subtext} />
              </Pressable>
            </View>
            {expandedTags[item.id] && (
              <View style={styles.tagsSection}>
                <View style={styles.inlineActionsRow}>
                  <Pressable
                    onPress={() => setThumbnailTarget(item)}
                    style={[styles.thumbnailButton, { borderColor: palette.border }]}
                  >
                    <KISIcon name="image" size={13} color={palette.subtext} />
                    <Text style={[styles.thumbnailButtonText, { color: palette.subtext }]}>Change thumbnail</Text>
                  </Pressable>
                  {canToggleMembersOnly && (
                    <Pressable
                      disabled={isTogglingMembersOnly}
                      onPress={() => onToggleMembersOnly?.(item, !isMembersOnly)}
                      style={[
                        styles.thumbnailButton,
                        { borderColor: isMembersOnly ? palette.gold : palette.border, opacity: isTogglingMembersOnly ? 0.6 : 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={isMembersOnly ? 'Make this post public' : 'Make this post members-only'}
                    >
                      {isTogglingMembersOnly ? (
                        <ActivityIndicator size="small" color={palette.gold} />
                      ) : (
                        <KISIcon name="lock" size={13} color={isMembersOnly ? palette.gold : palette.subtext} />
                      )}
                      <Text style={[styles.thumbnailButtonText, { color: isMembersOnly ? palette.gold : palette.subtext }]}>
                        {isMembersOnly ? 'Members only' : 'Make members-only'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.tagsList}>
                  {getTags(item).map(tag => (
                    <View key={tag} style={[styles.tagPill, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
                      <Text style={[styles.tagText, { color: palette.primaryStrong }]}>{tag}</Text>
                      <Pressable
                        onPress={() => handleRemoveTag(item, tag)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove tag: ${tag}`}
                      >
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
                    onSubmitEditing={() => handleAddTag(item)}
                    onChangeText={text => {
                      setTagInput(prev => ({ ...prev, [item.id]: text }));
                      if (text.endsWith(',')) {
                        handleAddTag(item);
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
      {thumbnailTarget && (
        <ThumbnailPickerSheet
          visible={Boolean(thumbnailTarget)}
          contentId={thumbnailTarget.id}
          currentThumbnailUrl={thumbnailTarget.thumbnail_url}
          onClose={() => setThumbnailTarget(null)}
          onUpdated={(url) => {
            // Optimistically update the thumbnail_url in the local tagsMap-adjacent
            // state so the UI reflects the change immediately without a full refetch.
            setThumbnailTarget(prev =>
              prev ? { ...prev, thumbnail_url: url } : null,
            );
          }}
        />
      )}
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  row: { borderTopWidth: 1, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chevronButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { flex: 1, fontSize: 13, fontWeight: '900' },
  rowMeta: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  liveChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '900' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 14 },
  itemBlock: { borderTopWidth: 0 },
  tagsSection: { paddingBottom: 10, paddingHorizontal: 4 },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '700' },
  tagInput: { minWidth: 90, flex: 1, borderBottomWidth: 1, paddingVertical: 4, paddingHorizontal: 6, fontSize: 12, fontWeight: '600' },
  inlineActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  thumbnailButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, alignSelf: 'flex-start' },
  thumbnailButtonText: { fontSize: 12, fontWeight: '700' },
});
