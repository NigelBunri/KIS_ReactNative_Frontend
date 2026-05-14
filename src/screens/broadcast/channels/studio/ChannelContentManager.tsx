import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelContent } from '@/screens/broadcast/channels/api/channels.types';

type Props = {
  contents: BroadcastChannelContent[];
  legacyFeeds: any[];
  onCreate: () => void;
  onToggleBroadcast?: (content: BroadcastChannelContent, nextState: boolean) => void | Promise<void>;
  broadcastingId?: string | null;
};

const statusLabel = (value?: string) => String(value || 'draft').replace(/_/g, ' ').toUpperCase();

export default function ChannelContentManager({ contents, legacyFeeds, onCreate, onToggleBroadcast, broadcastingId }: Props) {
  const { palette } = useKISTheme();
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
          <View key={item.id} style={[styles.row, { borderColor: palette.border }]}> 
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
});
