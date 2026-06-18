// src/screens/calls/components/BroadcastLayout.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import CallTimer from './CallTimer';
import { useKISTheme } from '@/theme/useTheme';

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
  liveStartedAt,
  onPressParticipant,
}: Props) {
  const { palette } = useKISTheme();
  const { width: screenW } = useWindowDimensions();
  const styles = useBroadcastStyles(palette);

  const hosts = participants.filter(p => p.role === 'host' || p.role === 'co-host');
  const speakers = participants.filter(p => p.role === 'speaker');
  const audience = participants.filter(p => p.role === 'audience');

  const primaryHost = hosts.find(h => h.role === 'host') ?? hosts[0] ?? null;
  const coHosts = hosts.filter(h => h !== primaryHost);

  const mainH = availableHeight - (speakers.length ? CO_HOST_H : 0) - AUDIENCE_STRIP_H - 120;

  return (
    <View style={[styles.container, { backgroundColor: palette.royalInk }]}>
      {/* LIVE indicator */}
      <View style={styles.topBar}>
        <View style={[styles.liveChip, { borderColor: palette.danger }]}>
          <View style={[styles.liveDot, { backgroundColor: palette.ivory }]} />
          <Text style={[styles.liveText, { color: palette.ivory }]}>LIVE</Text>
        </View>
        <Text style={styles.viewerCount}>👁 {viewerCount.toLocaleString()}</Text>
        {liveStartedAt && (
          <CallTimer
            startedAt={liveStartedAt}
            running
            color={palette.ivory}
            size={12}
            showDot={false}
          />
        )}
        {isRecording && (
          <View style={styles.recChip}>
            <View style={[styles.liveDot, { backgroundColor: palette.danger }]} />
            <Text style={[styles.liveText, { color: palette.danger }]}>REC</Text>
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
        <View style={[styles.coHostsSection, { backgroundColor: palette.royalInk }]}>
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
                <Text style={[styles.audienceText, { color: palette.gold }]} numberOfLines={1}>{p.displayName}</Text>
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

function useBroadcastStyles(palette: any) {
  return useMemo(() => StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: `${palette.royalInk}CC`,
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
      backgroundColor: `${palette.danger}2E`,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    liveText: {
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    viewerCount: { fontSize: 13, fontWeight: '600', color: palette.ivory },
    recChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${palette.danger}26`,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: `${palette.danger}66`,
    },
    coHostsSection: { paddingVertical: 6, paddingHorizontal: 10 },
    coHostLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4, color: palette.subtext },
    coHostRow: { gap: 8, paddingBottom: 2 },
    handsSection: { backgroundColor: `${palette.gold}1A`, paddingVertical: 6, paddingHorizontal: 10 },
    audienceChip: {
      backgroundColor: `${palette.gold}33`,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: `${palette.gold}66`,
    },
    audienceText: { fontSize: 12, fontWeight: '600' },
    audienceCountBar: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: `${palette.royalInk}80`,
    },
    audienceCountText: { fontSize: 12, color: palette.subtext },
  }), [palette]);
}
