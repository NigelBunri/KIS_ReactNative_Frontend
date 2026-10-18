// src/screens/calls/components/BroadcastLayout.tsx
//
// Broadcast call layout: panelists (the people actually broadcasting —
// camera/mic on stage) render in a responsive grid that scrolls
// vertically; everyone else who joined the call (attendees who aren't
// panelists) renders in a fixed horizontal strip that never moves, even
// while the panelist grid scrolls underneath it. Same shape for both
// video and audio-only broadcasts — an audio panelist still gets a tile
// (avatar + speaking/mute state), it just never shows a camera feed.
//
// The call's CREATOR is just another participant here, not special-cased
// into the grid — whether they appear at all is purely their own
// isPanelist flag (set at call-creation time via the "I'll host off-panel"
// toggle, or changed later by any panelist-move action below), same as
// everyone else.
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
  Pressable,
  Modal,
} from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import ParticipantTile from './ParticipantTile';
import CallTimer from './CallTimer';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { computeGridColumns, computeTileCell } from '../callGridMath';
import { useIOSCallPiP } from '../hooks/useIOSCallPiP';

type Props = {
  participants: CallParticipant[];
  viewerCount: number;
  isRecording: boolean;
  activeSpeakerId?: string | null;
  liveStartedAt?: string | null;
  onPressParticipant?: (userId: string) => void;
  // kept for backwards-compat but ignored; layout uses onLayout
  availableHeight?: number;
  // See VideoGrid's identical prop - gates iOS PiP to an actually-live
  // broadcast, defaults true for callers that haven't been updated.
  callActive?: boolean;
  // Host/co-host only — when present, tapping any tile opens the owner
  // action sheet (mute, move panel/participant, promote, remove) instead
  // of just onPressParticipant. All four are optional independently so a
  // caller can offer a subset (matches ParticipantsSheet's own pattern).
  isOwner?: boolean;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  onSetParticipantPanelist?: (userId: string, isPanelist: boolean) => void;
  onPromoteParticipant?: (userId: string, role: string) => void;
};

const TOP_BAR_H     = 44;  // LIVE indicator bar
const ATTENDEE_H    = 92;  // fixed attendee strip (chips + label)
const AUDIENCE_H    = 36;  // passive-viewer count bar
const GRID_GAP       = 10;
const GRID_PADDING   = 12;
// A panelist tile's target aspect ratio (w:h) — wide enough to read as a
// "camera feed" shape even for an audio-only panelist's avatar tile, same
// ratio VideoGrid's gallery tiles already use elsewhere in this call UI.
const TILE_ASPECT = 3 / 4;

export default function BroadcastLayout({
  participants,
  viewerCount,
  isRecording,
  activeSpeakerId,
  liveStartedAt,
  onPressParticipant,
  callActive = true,
  isOwner = false,
  onMuteParticipant,
  onRemoveParticipant,
  onSetParticipantPanelist,
  onPromoteParticipant,
}: Props) {
  const { palette } = useKISTheme();
  const styles = useBroadcastStyles(palette);

  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [actionTarget, setActionTarget] = useState<CallParticipant | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0)  setContainerW(Math.floor(width));
    if (height > 0) setContainerH(Math.floor(height));
  }, []);

  const panelists = participants.filter(p => p.isPanelist);
  const attendees  = participants.filter(p => !p.isPanelist);

  // iOS PiP target: the first panelist with their camera on — "what's
  // prominent on screen right now" for a broadcast, same reasoning
  // VideoGrid/the old main-stage concept used.
  const pipParticipant = panelists.find(p => !!p.stream && !p.isVideoOff) ?? null;
  const pipRef = useIOSCallPiP(callActive && !!pipParticipant);

  const gridAreaH = Math.max(
    120,
    containerH - TOP_BAR_H - (attendees.length > 0 ? ATTENDEE_H : 0) - AUDIENCE_H,
  );
  const gridCols = Math.max(1, computeGridColumns(Math.max(panelists.length, 1), containerW, gridAreaH));
  const tileW = gridCols > 0
    ? Math.floor((containerW - GRID_PADDING * 2 - GRID_GAP * (gridCols - 1)) / gridCols)
    : containerW;
  const tileH = Math.round(tileW / TILE_ASPECT);
  const panelistRows: CallParticipant[][] = [];
  for (let i = 0; i < panelists.length; i += gridCols) {
    panelistRows.push(panelists.slice(i, i + gridCols));
  }

  const handleTilePress = useCallback((participant: CallParticipant) => {
    if (isOwner && (onMuteParticipant || onRemoveParticipant || onSetParticipantPanelist || onPromoteParticipant)) {
      setActionTarget(participant);
    } else {
      onPressParticipant?.(participant.userId);
    }
  }, [isOwner, onMuteParticipant, onRemoveParticipant, onSetParticipantPanelist, onPromoteParticipant, onPressParticipant]);

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

      <View style={{ flex: 1, paddingTop: TOP_BAR_H }}>

        {/* Panelist grid — the actual broadcast panel, scrolls vertically.
            Rendered FIRST (behind, z-order-wise, nothing special needed —
            flex column order) so the attendee strip below visually sits
            "on top of"/after it, per spec: panelists scroll underneath a
            fixed attendee row. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: GRID_PADDING, gap: GRID_GAP }}
          showsVerticalScrollIndicator={false}
        >
          {panelists.length === 0 ? (
            <View style={styles.emptyPanel}>
              <KISIcon name="radio" size={28} color={palette.subtext} />
              <Text style={[styles.emptyPanelText, { color: palette.subtext }]}>
                No panelists on stage yet
              </Text>
            </View>
          ) : (
            panelistRows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: GRID_GAP }}>
                {row.map(p => (
                  <ParticipantTile
                    key={p.userId}
                    participant={p}
                    width={tileW}
                    height={tileH}
                    isSpeaker={p.userId === activeSpeakerId}
                    cornerRadius={14}
                    showName
                    onPress={() => handleTilePress(p)}
                    isPipSource={p.userId === pipParticipant?.userId}
                    pipRef={pipRef}
                  />
                ))}
                {/* Pad the last row so tiles don't stretch to fill a
                    partial row — keeps every tile the same size regardless
                    of position. */}
                {row.length < gridCols &&
                  Array.from({ length: gridCols - row.length }).map((_, i) => (
                    <View key={`pad-${i}`} style={{ width: tileW, height: tileH }} />
                  ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* Attendee strip — fixed, horizontal scroll. Everyone on the call
            who isn't a panelist (both video and audio broadcasts get the
            same chip shape; there's no camera feed to show here either
            way, just presence + mute/hand state). */}
        {attendees.length > 0 && (
          <View style={[styles.attendeeSection, { height: ATTENDEE_H, backgroundColor: `${palette.royalInk}F2`, borderTopColor: `${palette.gold}26` }]}>
            <Text style={styles.sectionLabel}>
              {attendees.length.toLocaleString()} in the call
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attendeeRow}
            >
              {attendees.map(p => (
                <Pressable key={p.userId} onPress={() => handleTilePress(p)} style={[styles.attendeeChip, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
                  <View style={[styles.attendeeAvatar, { backgroundColor: palette.goldDeep }]}>
                    <Text style={[styles.attendeeInitial, { color: palette.ivory }]}>
                      {(p.displayName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.attendeeName, { color: palette.text }]} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  {p.handRaised && <Text style={styles.attendeeHand}>✋</Text>}
                  {p.isMuted && <KISIcon name="mic-off" size={12} color={palette.danger} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Passive-viewer count (never joined as a real call participant —
          see CallSession.viewerCount's own doc comment) */}
      <View style={[styles.audienceBar, { height: AUDIENCE_H }]}>
        <Text style={[styles.audienceText, { color: palette.subtext }]}>
          {viewerCount > 0
            ? `${viewerCount.toLocaleString()} watching`
            : 'No viewers yet'}
        </Text>
      </View>

      {/* Owner action sheet — mute, move between panel/participants,
          promote, remove. Only reachable when isOwner and at least one
          action callback was actually provided (handleTilePress already
          gates on this), so a non-host tap always falls through to
          onPressParticipant/pin instead. */}
      <Modal
        visible={!!actionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <Pressable style={styles.actionBackdrop} onPress={() => setActionTarget(null)}>
          <Pressable style={[styles.actionSheet, { backgroundColor: palette.card }]} onPress={() => {}}>
            <Text style={[styles.actionTitle, { color: palette.text }]} numberOfLines={1}>
              {actionTarget?.displayName}
            </Text>
            {onMuteParticipant && actionTarget && (
              <ActionRow
                icon={actionTarget.isMuted ? 'mic' : 'mic-off'}
                label={actionTarget.isMuted ? 'Unmute' : 'Mute'}
                palette={palette}
                onPress={() => { onMuteParticipant(actionTarget.userId); setActionTarget(null); }}
              />
            )}
            {onSetParticipantPanelist && actionTarget && (
              <ActionRow
                icon={actionTarget.isPanelist ? 'arrow-down-left' : 'arrow-up-right'}
                label={actionTarget.isPanelist ? 'Move to participants' : 'Move to panel'}
                palette={palette}
                onPress={() => { onSetParticipantPanelist(actionTarget.userId, !actionTarget.isPanelist); setActionTarget(null); }}
              />
            )}
            {onPromoteParticipant && actionTarget && actionTarget.role !== 'co-host' && (
              <ActionRow
                icon="star"
                label="Make co-host"
                palette={palette}
                onPress={() => { onPromoteParticipant(actionTarget.userId, 'co-host'); setActionTarget(null); }}
              />
            )}
            {onRemoveParticipant && actionTarget && (
              <ActionRow
                icon="user-minus"
                label="Remove from call"
                palette={palette}
                danger
                onPress={() => { onRemoveParticipant(actionTarget.userId); setActionTarget(null); }}
              />
            )}
            <ActionRow
              icon="close"
              label="Cancel"
              palette={palette}
              onPress={() => setActionTarget(null)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionRow({ icon, label, palette, onPress, danger }: {
  icon: string;
  label: string;
  palette: any;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 4,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <KISIcon name={icon} size={18} color={danger ? palette.danger : palette.text} />
      <Text style={{ color: danger ? palette.danger : palette.text, fontSize: 15, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
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
    emptyPanel: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 60,
    },
    emptyPanelText: { fontSize: 13, fontWeight: '600' },
    attendeeSection: {
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 6,
      borderTopWidth: 1,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: palette.subtext,
      marginBottom: 4,
    },
    attendeeRow: { gap: 8, paddingBottom: 2, alignItems: 'center' },
    attendeeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: 160,
    },
    attendeeAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attendeeInitial: { fontSize: 11, fontWeight: '800' },
    attendeeName: { fontSize: 12, fontWeight: '600', maxWidth: 90 },
    attendeeHand: { fontSize: 12 },
    audienceBar: {
      paddingHorizontal: 14,
      justifyContent: 'center',
      backgroundColor: `${palette.royalInk}80`,
    },
    audienceText: { fontSize: 12 },
    actionBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    actionSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    actionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  }), [palette]);
}
