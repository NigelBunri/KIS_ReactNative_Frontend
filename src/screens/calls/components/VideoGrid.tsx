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
  if (layout === 'speaker' && participants.length > 1) {
    // Pinned or active speaker in the main area; everyone else in the thumbnail strip.
    const effectivePinned =
      pinnedUserId ?? activeSpeakerId ?? participants[0]?.userId ?? null;
    const pinned = participants.find(p => p.userId === effectivePinned) ?? null;
    const rest   = participants.filter(p => p.userId !== effectivePinned);

    const mainH = ready ? containerH - THUMB_H - GAP : 0;

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
        {ready && pinned && (
          <ParticipantTile
            participant={pinned}
            width={containerW}
            height={mainH}
            isPinned={!!pinnedUserId && pinnedUserId === pinned.userId}
            isSpeaker={pinned.userId === activeSpeakerId}
            isAudioOnly={isAudioOnly}
            cornerRadius={0}
            onLongPress={() => onPinParticipant(null)}
          />
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
