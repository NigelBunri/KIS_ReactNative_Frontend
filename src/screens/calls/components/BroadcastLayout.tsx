// src/screens/calls/components/BroadcastLayout.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';

type Props = {
  participants: CallParticipant[];
  viewerCount: number;
  isRecording: boolean;
  availableHeight: number;
  activeSpeakerId?: string | null;
  liveStartedAt?: string | null;
  onPressParticipant?: (userId: string) => void;
};

const CO_HOST_H = 90;
const AUDIENCE_STRIP_H = 56;

export default function BroadcastLayout({
  participants,
  viewerCount,
  isRecording,
  availableHeight,
  activeSpeakerId,
  onPressParticipant,
}: Props) {
  const { width: screenW } = useWindowDimensions();

  const hosts = participants.filter(p => p.role === 'host' || p.role === 'co-host');
  const speakers = participants.filter(p => p.role === 'speaker');
  const audience = participants.filter(p => p.role === 'audience');

  const primaryHost = hosts.find(h => h.role === 'host') ?? hosts[0] ?? null;
  const coHosts = hosts.filter(h => h !== primaryHost);

  const mainH = availableHeight - (speakers.length ? CO_HOST_H : 0) - AUDIENCE_STRIP_H - 120;

  return (
    <View style={styles.container}>
      {/* LIVE indicator */}
      <View style={styles.topBar}>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.viewerCount}>👁 {viewerCount.toLocaleString()}</Text>
        {isRecording && (
          <View style={styles.recChip}>
            <View style={[styles.liveDot, { backgroundColor: '#E52B2B' }]} />
            <Text style={[styles.liveText, { color: '#E52B2B' }]}>REC</Text>
          </View>
        )}
      </View>

      {/* Primary host — big */}
      {primaryHost && (
        <ParticipantTile
          participant={primaryHost}
          width={screenW}
          height={Math.max(160, mainH)}
          isSpeaker={primaryHost.userId === activeSpeakerId}
          cornerRadius={0}
          showName
        />
      )}

      {/* Co-hosts / invited speakers */}
      {(coHosts.length + speakers.length) > 0 && (
        <View style={styles.coHostsSection}>
          <Text style={styles.coHostLabel}>On stage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coHostRow}>
            {[...coHosts, ...speakers].map(p => (
              <ParticipantTile
                key={p.userId}
                participant={p}
                width={CO_HOST_H * 0.75}
                height={CO_HOST_H - 8}
                isSpeaker={p.userId === activeSpeakerId}
                cornerRadius={12}
                showName
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Audience raised-hand strip */}
      {audience.filter(a => a.handRaised).length > 0 && (
        <View style={styles.handsSection}>
          <Text style={styles.coHostLabel}>✋ Raised hands</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coHostRow}>
            {audience.filter(a => a.handRaised).map(p => (
              <View key={p.userId} style={styles.audienceChip}>
                <Text style={styles.audienceText} numberOfLines={1}>{p.displayName}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Audience count */}
      {audience.length > 0 && (
        <View style={styles.audienceCountBar}>
          <Text style={styles.audienceCountText}>
            {audience.length.toLocaleString()} audience members
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(229,43,43,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E52B2B',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  viewerCount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  recChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229,43,43,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(229,43,43,0.4)',
  },
  coHostsSection: { backgroundColor: '#111128', paddingVertical: 6, paddingHorizontal: 10 },
  coHostLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4 },
  coHostRow: { gap: 8, paddingBottom: 2 },
  handsSection: { backgroundColor: 'rgba(251,191,36,0.1)', paddingVertical: 6, paddingHorizontal: 10 },
  audienceChip: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
  },
  audienceText: { color: '#FBF24E', fontSize: 12, fontWeight: '600' },
  audienceCountBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  audienceCountText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
