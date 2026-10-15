// src/screens/calls/components/VideoGrid.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import type { CallParticipant, CallLayout } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import PaginatedTileGrid from './PaginatedTileGrid';
import { resolveMainStageParticipants, computeGridColumns, computeTileCell } from '../callGridMath';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participants: CallParticipant[];
  layout: CallLayout;
  pinnedUserId?: string | null;
  activeSpeakerId?: string | null;
  isAudioOnly?: boolean;
  onPinParticipant: (userId: string | null) => void;
  // availableHeight kept for backwards-compat but ignored; sizing is done via onLayout
  availableHeight?: number;
};

const GAP = 4;
const THUMB_H = 96; // height of the thumbnail strip in speaker layout

export default function VideoGrid({
  participants,
  layout,
  pinnedUserId,
  activeSpeakerId,
  isAudioOnly = false,
  onPinParticipant,
}: Props) {
  const { palette } = useKISTheme();
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Only update when the measurement is non-zero to avoid a flicker frame
    if (width > 0) setContainerW(Math.floor(width));
    if (height > 0) setContainerH(Math.floor(height));
  }, []);

  const ready = containerW > 0 && containerH > 0;

  // ── "Nobody has their camera on" nudge ──────────────────────────────────────
  // Shown in video-group calls when ALL remote participants have video off.
  const allCamerasOff =
    !isAudioOnly &&
    participants.every(p => p.isVideoOff || !p.stream);

  // ── Audio-only mode: show only the active speaker to save CPU/bandwidth ─────
  // When the adaptive network layer has disabled video, render a single large
  // avatar tile instead of the full grid.
  if (isAudioOnly) {
    const speaker =
      participants.find(p => p.userId === activeSpeakerId) ??
      participants.find(p => !p.isLocal) ??
      participants[0];

    return (
      <View
        style={[styles.fill, { backgroundColor: palette.royalInk, alignItems: 'center', justifyContent: 'center' }]}
        onLayout={onLayout}
      >
        {ready && speaker && (
          <ParticipantTile
            participant={speaker}
            width={Math.min(containerW, containerH * 0.7)}
            height={Math.min(containerW, containerH * 0.7)}
            isSpeaker
            isAudioOnly
            cornerRadius={Math.min(containerW, containerH * 0.35)}
            showName
          />
        )}
      </View>
    );
  }

  // ── Speaker layout ──────────────────────────────────────────────────────────
  // A screen share forces this layout regardless of the current `layout`
  // mode — a presentation must always be prominent, not hidden behind a
  // gallery-mode toggle. resolveMainStageParticipants also makes the
  // sharer win over a manually pinned/active-speaker participant (a user
  // pinning someone else mid-share must not un-share the presentation from
  // main view); with no active share it falls back to the exact
  // single-pinned-participant selection this branch always used.
  const anySharing = participants.some(p => p.isScreenSharing);
  if ((layout === 'speaker' || anySharing) && participants.length > 1) {
    const mainStage = resolveMainStageParticipants(participants, { pinnedUserId, activeSpeakerId });
    const mainStageIds = new Set(mainStage.map(p => p.userId));
    const rest = participants.filter(p => !mainStageIds.has(p.userId));

    const mainH = ready ? containerH - THUMB_H - GAP : 0;
    const mainCols = computeGridColumns(mainStage.length, containerW, mainH);
    const mainRows = Math.ceil(mainStage.length / Math.max(mainCols, 1));
    const mainCell = computeTileCell(containerW, mainH, mainCols, mainRows, GAP);
    const mainRowChunks: CallParticipant[][] = [];
    for (let i = 0; i < mainStage.length; i += mainCols) {
      mainRowChunks.push(mainStage.slice(i, i + mainCols));
    }

    return (
      <View
        style={[styles.fill, { backgroundColor: palette.royalInk }]}
        onLayout={onLayout}
      >
        {allCamerasOff && (
          <View style={[styles.noCamBanner, { backgroundColor: `${palette.royalInk}CC` }]}>
            <Text style={[styles.noCamText, { color: palette.subtext }]}>
              📷 Everyone's camera is off
            </Text>
          </View>
        )}
        {ready && mainStage.length > 0 && (
          <View style={{ width: containerW, height: mainH, justifyContent: 'center' }}>
            {mainRowChunks.map((row, ri) => (
              <View
                key={ri}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: GAP,
                  marginBottom: ri < mainRowChunks.length - 1 ? GAP : 0,
                }}
              >
                {row.map(p => (
                  <ParticipantTile
                    key={p.userId}
                    participant={p}
                    width={mainStage.length === 1 ? containerW : mainCell.width}
                    height={mainStage.length === 1 ? mainH : mainCell.height}
                    isPinned={pinnedUserId === p.userId}
                    isSpeaker={p.userId === activeSpeakerId}
                    isAudioOnly={isAudioOnly}
                    cornerRadius={mainStage.length === 1 ? 0 : 12}
                    showName
                    onLongPress={() => onPinParticipant(null)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Thumbnail strip — horizontal scroll is intentional here */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: THUMB_H, backgroundColor: palette.royalInk }}
          contentContainerStyle={styles.thumbContent}
        >
          {rest.map(p => (
            <ParticipantTile
              key={p.userId}
              participant={p}
              width={Math.round(THUMB_H * 0.72)}
              height={THUMB_H - 8}
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

  // ── Gallery layout ──────────────────────────────────────────────────────────
  // Real horizontal pagination (via PaginatedTileGrid) rather than an
  // infinite vertical scroll, so large groups stay legible and navigable —
  // page size is screen-size-aware (see getMaxTilesPerPage).
  return (
    <View
      style={[styles.fill, { backgroundColor: palette.royalInk }]}
      onLayout={onLayout}
    >
      {allCamerasOff && (
        <View style={[styles.noCamBanner, { backgroundColor: `${palette.royalInk}CC` }]}>
          <Text style={[styles.noCamText, { color: palette.subtext }]}>
            📷 Everyone's camera is off
          </Text>
        </View>
      )}
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
              isPinned={pinnedUserId === p.userId}
              isSpeaker={p.userId === activeSpeakerId}
              isAudioOnly={isAudioOnly}
              cornerRadius={12}
              onPress={() => onPinParticipant(p.userId === pinnedUserId ? null : p.userId)}
              showName
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  thumbContent: { paddingHorizontal: 8, alignItems: 'center', gap: GAP },
  noCamBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 6,
    zIndex: 5,
  },
  noCamText: { fontSize: 12, fontWeight: '600' },
});
