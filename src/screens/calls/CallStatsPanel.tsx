// src/screens/calls/CallStatsPanel.tsx
// Real, live WebRTC call-quality diagnostics (feature K) — every value here
// is read directly from webRTCService.getDetailedStats() (itself sourced
// from RTCPeerConnection.getStats() via parseStatsReport), never invented
// or hardcoded. This is distinct from CallDiagnosticsModal.tsx, which is a
// signaling/push-notification pipeline debug tool, not a media-quality
// panel — there was no real media-stats UI anywhere in the app before this.
//
// Reachable by tapping the network-quality indicator in ActiveCallScreen's
// header during an active call.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { webRTCService, type DetailedPeerStats } from '@/services/calls/webRTCService';
import { sfuService } from '@/services/calls/sfuService';
import type { CallParticipant } from '@/services/calls/callTypes';

const POLL_MS = 2000;

function fmt(value: number | null, unit: string, digits = 0): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}${unit}`;
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { palette } = useKISTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: warn ? palette.danger : palette.text }]}>{value}</Text>
    </View>
  );
}

function PeerCard({ participant, stats }: { participant: CallParticipant; stats: DetailedPeerStats | undefined }) {
  const { palette } = useKISTheme();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{participant.displayName}</Text>
      {!stats ? (
        <Text style={[styles.rowValue, { color: palette.subtext }]}>Waiting for first stats sample…</Text>
      ) : (
        <>
          <Row label="Round-trip time" value={fmt(stats.rttMs, ' ms')} warn={stats.rttMs > 250} />
          <Row label="Packet loss" value={`${stats.packetsLost}`} warn={stats.packetsLost > 10} />
          <Row label="Jitter" value={fmt(stats.jitterMs, ' ms', 1)} />
          <Row label="Bitrate out" value={fmt(stats.bitrateOutKbps, ' kbps')} />
          <Row label="Bitrate in" value={fmt(stats.bitrateInKbps, ' kbps')} />
          {(stats.videoWidth || stats.videoHeight) && (
            <Row label="Resolution" value={`${stats.videoWidth ?? '—'}×${stats.videoHeight ?? '—'}`} />
          )}
          {stats.fps !== null && <Row label="Frame rate" value={fmt(stats.fps, ' fps', 0)} />}
          <Row label="Connection type" value={stats.candidateType ?? '—'} />
          <Row label="ICE state" value={stats.iceConnectionState ?? '—'} warn={stats.iceConnectionState === 'failed' || stats.iceConnectionState === 'disconnected'} />
          <Row label="Codec" value={stats.codec ?? '—'} />
          <Row label="Network quality" value={`${stats.networkQuality}/4`} warn={stats.networkQuality <= 2} />
        </>
      )}
    </View>
  );
}

export default function CallStatsPanel({
  visible,
  onClose,
  participants,
}: {
  visible: boolean;
  onClose: () => void;
  participants: CallParticipant[];
}) {
  const { palette } = useKISTheme();
  const [statsByPeer, setStatsByPeer] = useState<Record<string, DetailedPeerStats>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      setStatsByPeer(webRTCService.getDetailedStats());
      setTick(t => t + 1);
    };
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [visible]);

  const remote = participants.filter(p => !p.isLocal);
  const usingSfu = sfuService.isJoined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Call Diagnostics</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ color: palette.primary, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Media path</Text>
            <Row label="Mode" value={usingSfu ? 'SFU (group relay)' : 'Peer-to-peer'} />
            {usingSfu && (
              <Text style={[styles.note, { color: palette.subtext }]}>
                This call has upgraded to the SFU — per-peer media stats below reflect this device's own send/receive legs through react-native-webrtc; mediasoup producer/consumer-level stats aren't exposed yet.
              </Text>
            )}
          </View>

          {remote.length === 0 ? (
            <Text style={[styles.rowValue, { color: palette.subtext, marginTop: 12 }]}>
              No remote participants to measure yet.
            </Text>
          ) : (
            remote.map(p => (
              <PeerCard key={p.userId} participant={p} stats={statsByPeer[p.userId]} />
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 11, marginTop: 6, lineHeight: 15 },
});
