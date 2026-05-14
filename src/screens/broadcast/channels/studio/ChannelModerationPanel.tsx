import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { ChannelModerationRecord } from '@/screens/broadcast/channels/api/channels.types';
import { actionChannelModerationRecord, fetchChannelModerationQueue } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = { channelId?: string };
const ACTIONS = [
  { id: 'keep', label: 'Keep' },
  { id: 'hide', label: 'Hide' },
  { id: 'remove', label: 'Remove' },
  { id: 'restrict_comments', label: 'Restrict' },
];

export default function ChannelModerationPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [records, setRecords] = useState<ChannelModerationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      setRecords(await fetchChannelModerationQueue(channelId, 'open'));
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (recordId: string, action: string) => {
    setBusyId(recordId);
    try {
      await actionChannelModerationRecord(recordId, action, `Studio action: ${action}`);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  return (
    <View style={[styles.shell, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <View style={styles.headerRow}>
        <KISIcon name="shield" size={18} color={palette.primaryStrong} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Moderation queue</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>Review channel, content, and comment reports before they affect trust.</Text>
        </View>
        {loading ? <ActivityIndicator color={palette.primaryStrong} /> : null}
      </View>
      {records.length ? records.map(record => (
        <View key={record.id} style={[styles.record, { borderColor: palette.border }]}> 
          <Text style={[styles.recordTitle, { color: palette.text }]}>{record.content_title || record.comment_body || record.target_type}</Text>
          <Text style={[styles.recordMeta, { color: palette.subtext }]}>{record.target_type} · {record.reason || 'No reason supplied'}</Text>
          <View style={styles.actions}>
            {ACTIONS.map(action => (
              <Pressable key={action.id} disabled={busyId === record.id} onPress={() => act(record.id, action.id)} style={[styles.actionButton, { backgroundColor: action.id === 'remove' ? '#fff1f2' : palette.card, borderColor: palette.border }]}> 
                <Text style={[styles.actionText, { color: action.id === 'remove' ? '#be123c' : palette.text }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )) : (
        <View style={[styles.empty, { borderColor: palette.border, backgroundColor: palette.card }]}> 
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No open reports</Text>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>Reported content and comments will appear here for channel owners and moderators.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  record: { borderTopWidth: 1, paddingVertical: 12 },
  recordTitle: { fontSize: 13, fontWeight: '900' },
  recordMeta: { marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actionText: { fontSize: 11, fontWeight: '900' },
  empty: { borderWidth: 1, borderRadius: 8, padding: 12 },
  emptyTitle: { fontSize: 13, fontWeight: '900' },
  emptyText: { marginTop: 4, fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
