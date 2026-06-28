// src/screens/calls/components/BroadcastLayout.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import CallTimer from './CallTimer';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participants: CallParticipant[];
  viewerCount: number;
  isRecording: boolean;
  activeSpeakerId?: string | null;
  liveStartedAt?: string | null;
  onPressParticipant?: (userId: string) => void;
  // kept for backwards-compat but ignored; layout uses onLayout
  availableHeight?: number;
};

const TOP_BAR_H   = 44;   // LIVE indicator bar
const CO_HOST_H   = 96;   // on-stage horizontal strip
const HANDS_H     = 56;   // raised-hands strip
const AUDIENCE_H  = 36;   // audience count bar

export default function BroadcastLayout({
  participants,
  viewerCount,
  isRecording,
  activeSpeakerId,
  liveStartedAt,
  onPressParticipant,
}: Props) {
  const { palette } = useKISTheme();
  const styles = useBroadcastStyles(palette);

  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0)  setContainerW(Math.floor(width));
    if (height > 0) setContainerH(Math.floor(height));
  }, []);

  const hosts    = participants.filter(p => p.role === 'host' || p.role === 'co-host');
  const speakers = participants.filter(p => p.role === 'speaker');
  const audience = participants.filter(p => p.role === 'audience');
  const raisedHands = audience.filter(a => a.handRaised);

  const primaryHost = hosts.find(h => h.role === 'host') ?? hosts[0] ?? null;
  const coHosts     = hosts.filter(h => h !== primaryHost);
  const onStage     = [...coHosts, ...speakers];

  // Main host tile height = total container minus every section below it.
  const mainH = Math.max(
    80,
    containerH
      - TOP_BAR_H
      - (onStage.length > 0 ? CO_HOST_H : 0)
      - (raisedHands.length > 0 ? HANDS_H : 0)
      - AUDIENCE_H,
  );

  return (
    <View
      style={[styles.container, { backgroundColor: palette.royalInk }]}
      onLayout={onLayout}
    >
      {/* LIVE / viewer / timer bar */}
      <View style={styles.topBar}>
        <View style={[styles.liveChip, { borderColor: palette.danger }]}>
          <View style={[styles.dot, { backgroundColor: palette.ivory }]} />
          <Text style={[styles.chipText, { color: palette.ivory }]}>LIVE</Text>
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
          <View style={[styles.recChip, { borderColor: `${palette.danger}66` }]}>
            <View style={[styles.dot, { backgroundColor: palette.danger }]} />
            <Text style={[styles.chipText, { color: palette.danger }]}>REC</Text>
          </View>
        )}
      </View>

      {/* Primary host — fills remaining height */}
      {primaryHost && containerW > 0 && (
        <ParticipantTile
          participant={primaryHost}
          width={containerW}
          height={mainH}
          isSpeaker={primaryHost.userId === activeSpeakerId}
          cornerRadius={0}
          showName
        />
      )}

      {/* On-stage co-hosts + speakers */}
      {onStage.length > 0 && (
        <View style={[styles.stageSection, { backgroundColor: palette.royalInk, height: CO_HOST_H }]}>
          <Text style={styles.sectionLabel}>On stage</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stageRow}
          >
            {onStage.map(p => (
              <ParticipantTile
                key={p.userId}
                participant={p}
                width={Math.round(CO_HOST_H * 0.72)}
                height={CO_HOST_H - 16}
                isSpeaker={p.userId === activeSpeakerId}
                cornerRadius={12}
                showName
                onPress={() => onPressParticipant?.(p.userId)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Raised-hand strip */}
      {raisedHands.length > 0 && (
        <View style={[styles.handsSection, { height: HANDS_H }]}>
          <Text style={styles.sectionLabel}>✋ Raised hands</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
            {raisedHands.map(p => (
              <View key={p.userId} style={[styles.handChip, { borderColor: `${palette.gold}66`, backgroundColor: `${palette.gold}33` }]}>
                <Text style={[styles.handChipText, { color: palette.gold }]} numberOfLines={1}>
                  {p.displayName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Audience count */}
      <View style={[styles.audienceBar, { height: AUDIENCE_H }]}>
        <Text style={[styles.audienceText, { color: palette.subtext }]}>
          {audience.length > 0
            ? `${audience.length.toLocaleString()} audience member${audience.length !== 1 ? 's' : ''}`
            : 'No audience yet'}
        </Text>
      </View>
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
      height: TOP_BAR_H,
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
    recChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${palette.danger}26`,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
    viewerCount: { fontSize: 13, fontWeight: '600', color: palette.ivory },
    stageSection: { paddingHorizontal: 10, paddingVertical: 6 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: palette.subtext,
      marginBottom: 4,
    },
    stageRow: { gap: 8, paddingBottom: 2, alignItems: 'center' },
    handsSection: {
      backgroundColor: `${palette.gold}1A`,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    handChip: {
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
    },
    handChipText: { fontSize: 12, fontWeight: '600' },
    audienceBar: {
      paddingHorizontal: 14,
      justifyContent: 'center',
      backgroundColor: `${palette.royalInk}80`,
    },
    audienceText: { fontSize: 12 },
  }), [palette]);
}
