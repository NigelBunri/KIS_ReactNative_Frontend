// src/screens/calls/components/VoiceCallGrid.tsx
//
// Dedicated tile-grid layout for true group voice calls (session.callType
// === 'voice-group'). Distinct from VideoGrid's `isAudioOnly` branch, which
// is the network-degraded fallback for a VIDEO call whose adaptive layer
// disabled video — that branch intentionally shows only one large avatar to
// save bandwidth/CPU. A real voice call has no video to ever recover, so it
// gets its own always-multi-participant layout: the same rectangular,
// luxuriously-framed card every video tile uses (profile photo/initials
// centered, name, speaking ring, mute state, network quality all living
// inside one box — see ParticipantTile), paginated the same way the video
// gallery is, and auto-sized by participant count via PaginatedTileGrid.
import React, { useCallback, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import PaginatedTileGrid from './PaginatedTileGrid';
import { useKISTheme } from '@/theme/useTheme';
import { buildModerationProps, buildViewerPrefs, type ParticipantControls } from './participantControls';

type Props = {
  participants: CallParticipant[];
  activeSpeakerId?: string | null;
  controls: ParticipantControls;
};

export default function VoiceCallGrid({ participants, activeSpeakerId, controls }: Props) {
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
          renderTile={(p, cellW, cellH) => (
            <ParticipantTile
              participant={p}
              width={cellW}
              height={cellH}
              isAudioOnly
              isSpeaker={p.userId === activeSpeakerId || p.isSpeaking}
              showName
              cornerRadius={16}
              onToggleChrome={controls.onToggleChrome}
              viewerPrefs={buildViewerPrefs(controls, p)}
              moderation={buildModerationProps(controls, p)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
