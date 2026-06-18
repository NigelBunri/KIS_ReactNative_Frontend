// src/screens/calls/components/VideoGrid.tsx
import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import type { CallParticipant, CallLayout } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participants: CallParticipant[];
  layout: CallLayout;
  pinnedUserId?: string | null;
  activeSpeakerId?: string | null;
  isAudioOnly?: boolean;
  availableHeight: number;
  onPinParticipant: (userId: string | null) => void;
};

const GAP = 4;
const CONTROLS_H = 120;
const MINI_ROW_H = 100;

export default function VideoGrid({
  participants,
  layout,
  pinnedUserId,
  activeSpeakerId,
  isAudioOnly,
  availableHeight,
  onPinParticipant,
}: Props) {
  const { palette } = useKISTheme();
  const { width: screenW } = useWindowDimensions();
  const contentH = availableHeight - CONTROLS_H;

  const { pinned, rest } = useMemo(() => {
    const effectivePinned =
      pinnedUserId ?? activeSpeakerId ?? participants[0]?.userId ?? null;
    const p = participants.find(x => x.userId === effectivePinned) ?? null;
    const r = participants.filter(x => x.userId !== effectivePinned);
    return { pinned: p, rest: r };
  }, [participants, pinnedUserId, activeSpeakerId]);

  // ── Speaker layout ───────────────────────────────────────────────────────────
  if (layout === 'speaker' && participants.length > 1) {
    const mainH = pinned ? contentH - MINI_ROW_H - GAP : contentH;
    return (
      <View style={[styles.container, { backgroundColor: palette.royalInk }]}>
        {pinned && (
          <ParticipantTile
            participant={pinned}
            width={screenW}
            height={mainH}
            isPinned={!!pinnedUserId && pinnedUserId === pinned.userId}
            isSpeaker={pinned.userId === activeSpeakerId}
            isAudioOnly={isAudioOnly}
            cornerRadius={0}
            onLongPress={() => onPinParticipant(null)}
          />
        )}
        {/* Thumbnail row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbRow}
          style={{ height: MINI_ROW_H, backgroundColor: palette.royalInk }}
        >
          {rest.map(p => (
            <ParticipantTile
              key={p.userId}
              participant={p}
              width={MINI_ROW_H * 0.75}
              height={MINI_ROW_H - 8}
              isSpeaker={p.userId === activeSpeakerId}
              isAudioOnly={isAudioOnly}
              cornerRadius={12}
              onPress={() => onPinParticipant(p.userId)}
              showName
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Gallery layout ───────────────────────────────────────────────────────────
  const cols = participants.length <= 2 ? 1 : participants.length <= 4 ? 2 : 3;
  const rows = Math.ceil(participants.length / cols);
  const tileW = (screenW - GAP * (cols - 1)) / cols;
  const tileH = Math.min((contentH - GAP * (rows - 1)) / rows, tileW * 1.4);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.royalInk }]}
      contentContainerStyle={[styles.gallery, { paddingBottom: 4 }]}
      showsVerticalScrollIndicator={false}
    >
      {chunkBy(participants, cols).map((row, ri) => (
        <View key={ri} style={[styles.row, { gap: GAP }]}>
          {row.map(p => (
            <ParticipantTile
              key={p.userId}
              participant={p}
              width={tileW}
              height={tileH}
              isPinned={pinnedUserId === p.userId}
              isSpeaker={p.userId === activeSpeakerId}
              isAudioOnly={isAudioOnly}
              cornerRadius={14}
              onPress={() => onPinParticipant(p.userId === pinnedUserId ? null : p.userId)}
              showName
            />
          ))}
          {/* Fill empty cells in last row */}
          {row.length < cols &&
            Array.from({ length: cols - row.length }).map((_, fi) => (
              <View key={`fill-${fi}`} style={{ width: tileW, height: tileH }} />
            ))}
        </View>
      ))}
    </ScrollView>
  );
}

function chunkBy<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gallery: { gap: GAP, paddingHorizontal: 0 },
  row: { flexDirection: 'row' },
  thumbRow: { paddingHorizontal: 8, alignItems: 'center', gap: GAP },
});
