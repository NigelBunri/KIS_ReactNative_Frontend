// src/screens/calls/components/VoiceCallGrid.tsx
//
// Dedicated tile-grid layout for true group voice calls (session.callType
// === 'voice-group'). Distinct from VideoGrid's `isAudioOnly` branch, which
// is the network-degraded fallback for a VIDEO call whose adaptive layer
// disabled video — that branch intentionally shows only one large avatar to
// save bandwidth/CPU. A real voice call has no video to ever recover, so it
// gets its own always-multi-participant layout: profile photo/initials
// avatars, names, an animated speaking ring, mute state, and network
// quality, paginated the same way the video gallery is.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import PaginatedTileGrid from './PaginatedTileGrid';
import NetworkQualityBars from './NetworkQualityBars';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participants: CallParticipant[];
  activeSpeakerId?: string | null;
};

// Vertical space reserved below each circular avatar for name + status.
const STATUS_ROW_H = 40;
const MIN_AVATAR = 56;
const MAX_AVATAR = 120;

export default function VoiceCallGrid({ participants, activeSpeakerId }: Props) {
  const { palette } = useKISTheme();
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0) setContainerW(Math.floor(width));
    if (height > 0) setContainerH(Math.floor(height));
  }, []);

  const ready = containerW > 0 && containerH > 0;

  return (
    <View style={[styles.fill, { backgroundColor: palette.royalInk }]} onLayout={onLayout}>
      {ready && (
        <PaginatedTileGrid
          items={participants}
          containerW={containerW}
          containerH={containerH}
          keyExtractor={p => p.userId}
          renderTile={(p, cellW, cellH) => {
            const avatarSize = Math.round(
              Math.max(MIN_AVATAR, Math.min(MAX_AVATAR, Math.min(cellW, cellH - STATUS_ROW_H))),
            );
            const isSpeaking = p.userId === activeSpeakerId || p.isSpeaking;
            return (
              <View style={{ width: cellW, height: cellH, alignItems: 'center', justifyContent: 'center' }}>
                <ParticipantTile
                  participant={p}
                  width={avatarSize}
                  height={avatarSize}
                  shape="circle"
                  isAudioOnly
                  showName={false}
                  isSpeaker={isSpeaking}
                />
                <View style={styles.statusRow}>
                  <Text style={[styles.name, { color: palette.ivory }]} numberOfLines={1}>
                    {p.isLocal ? 'You' : p.displayName}
                  </Text>
                  <View style={styles.statusIcons}>
                    {p.handRaised && <Text style={styles.handEmoji}>✋</Text>}
                    {p.isMuted ? (
                      <KISIcon name="mic-off" size={12} color={palette.danger} />
                    ) : (
                      <KISIcon name="mic" size={12} color={isSpeaking ? palette.success : palette.subtext} />
                    )}
                    <NetworkQualityBars quality={p.networkQuality} size={11} />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  statusRow: {
    marginTop: 8,
    alignItems: 'center',
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  name: { fontSize: 13, fontWeight: '600', maxWidth: 110 },
  statusIcons: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handEmoji: { fontSize: 13 },
});
