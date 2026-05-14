import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BroadcastChannelLiveStream, BroadcastChannelSummary } from '@/screens/broadcast/channels/api/channels.types';
import { endLiveStream, fetchChannelLiveStreams, scheduleChannelLiveStream, startLiveStream } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = { channel: BroadcastChannelSummary; onOpenWatch?: (stream: BroadcastChannelLiveStream) => void };

const statusColor = (status: string, palette: ReturnType<typeof useKISTheme>['palette']) => {
  if (status === 'live') return '#C0262D';
  if (status === 'ended') return palette.subtext;
  return palette.primaryStrong;
};

export default function LiveControlRoom({ channel, onOpenWatch }: Props) {
  const { palette } = useKISTheme();
  const [streams, setStreams] = useState<BroadcastChannelLiveStream[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [showIngest, setShowIngest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStreams(await fetchChannelLiveStreams(channel.id));
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => streams.filter(item => item.status !== 'ended' && item.status !== 'cancelled'), [streams]);

  const handleSchedule = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const next = await scheduleChannelLiveStream(channel.id, {
        title: title.trim(),
        description: description.trim(),
        scheduled_start_at: scheduledAt.trim() || undefined,
      });
      if (next) {
        setStreams(prev => [next, ...prev]);
        setTitle('');
        setDescription('');
        setScheduledAt('');
      }
    } finally {
      setSaving(false);
    }
  }, [channel.id, description, scheduledAt, title]);

  const updateStream = useCallback((next: BroadcastChannelLiveStream | null) => {
    if (!next) return;
    setStreams(prev => prev.map(item => item.id === next.id ? next : item));
  }, []);

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Live control room</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>Schedule, test, start, end, and monitor channel live streams.</Text>
        </View>
        {loading ? <ActivityIndicator color={palette.primaryStrong} /> : <Pressable onPress={load}><KISIcon name="refresh" size={20} color={palette.primaryStrong} /></Pressable>}
      </View>

      <View style={[styles.form, { borderColor: palette.border }]}> 
        <KISTextInput label="Live title" value={title} onChangeText={setTitle} />
        <KISTextInput label="Scheduled start (ISO optional)" value={scheduledAt} onChangeText={setScheduledAt} />
        <KISTextInput label="Description" value={description} onChangeText={setDescription} multiline style={{ minHeight: 70 }} />
        <Pressable disabled={saving || !title.trim()} onPress={handleSchedule} style={[styles.primaryButton, { backgroundColor: title.trim() ? palette.text : palette.border }]}> 
          <KISIcon name="calendar" size={17} color={palette.surface} />
          <Text style={[styles.primaryText, { color: palette.surface }]}>{saving ? 'Scheduling...' : 'Schedule live'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => setShowIngest(prev => !prev)} style={[styles.toggleRow, { borderColor: palette.border }]}> 
        <KISIcon name="keypad" size={16} color={palette.primaryStrong} />
        <Text style={[styles.toggleText, { color: palette.text }]}>{showIngest ? 'Hide ingest details' : 'Show masked ingest details'}</Text>
      </Pressable>

      {upcoming.length ? upcoming.map(stream => (
        <View key={stream.id} style={[styles.streamCard, { borderColor: palette.border, backgroundColor: palette.background }]}> 
          <View style={styles.streamTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.streamTitle, { color: palette.text }]}>{stream.title}</Text>
              <Text style={[styles.streamMeta, { color: palette.subtext }]}>{stream.scheduled_start_at ? new Date(stream.scheduled_start_at).toLocaleString() : 'No schedule'} · {stream.provider || 'disabled provider'}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor(stream.status, palette)}22` }]}> 
              <Text style={[styles.statusText, { color: statusColor(stream.status, palette) }]}>{stream.status.toUpperCase()}</Text>
            </View>
          </View>
          {showIngest ? (
            <View style={[styles.ingestBox, { borderColor: palette.border }]}> 
              <Text style={[styles.ingestText, { color: palette.subtext }]}>Ingest URL: {stream.ingest_url || 'Provider disabled'}</Text>
              <Text style={[styles.ingestText, { color: palette.subtext }]}>Stream key: {stream.stream_key_available ? '••••••••••••••••' : 'Not available'}</Text>
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable onPress={() => onOpenWatch?.(stream)} style={[styles.smallButton, { borderColor: palette.border }]}> 
              <Text style={[styles.smallButtonText, { color: palette.primaryStrong }]}>Preview</Text>
            </Pressable>
            <Pressable onPress={() => stream.status === 'live' ? Alert.alert('Already live') : startLiveStream(stream.id).then(updateStream)} style={[styles.smallButton, { borderColor: palette.border }]}> 
              <Text style={[styles.smallButtonText, { color: palette.primaryStrong }]}>Start</Text>
            </Pressable>
            <Pressable onPress={() => endLiveStream(stream.id).then(updateStream)} style={[styles.smallButton, { borderColor: palette.border }]}> 
              <Text style={[styles.smallButtonText, { color: palette.primaryStrong }]}>End</Text>
            </Pressable>
          </View>
        </View>
      )) : (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>No scheduled live streams yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  form: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  primaryButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  primaryText: { fontSize: 12, fontWeight: '900' },
  toggleRow: { borderWidth: 1, borderRadius: 8, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  toggleText: { fontSize: 12, fontWeight: '900' },
  streamCard: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  streamTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  streamTitle: { fontSize: 14, fontWeight: '900' },
  streamMeta: { marginTop: 3, fontSize: 11, fontWeight: '700' },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '900' },
  ingestBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 },
  ingestText: { fontSize: 11, lineHeight: 17, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  smallButtonText: { fontSize: 11, fontWeight: '900' },
  emptyText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
