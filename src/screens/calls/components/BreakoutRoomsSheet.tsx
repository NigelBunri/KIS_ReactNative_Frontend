// src/screens/calls/components/BreakoutRoomsSheet.tsx
// Breakout room management for the host + participant assignment.

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { BreakoutRoom, CallParticipant } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  visible: boolean;
  onClose: () => void;
  isHost: boolean;
  participants: CallParticipant[];
  breakoutRooms: BreakoutRoom[];
  myBreakoutRoomId: string | null;
  onCreateRooms: (rooms: { name: string; userIds: string[] }[]) => void;
  onReturnToMain: () => void;
  onCloseRooms: () => void;
};

export default function BreakoutRoomsSheet({
  visible, onClose, isHost, participants, breakoutRooms, myBreakoutRoomId,
  onCreateRooms, onReturnToMain, onCloseRooms,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [mounted, setMounted] = useState(visible);
  const [numRooms, setNumRooms] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // userId → roomId

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  const draft = Array.from({ length: numRooms }, (_, i) => ({
    name: `Room ${i + 1}`,
    roomId: `draft_${i}`,
  }));

  const assignParticipant = (userId: string, roomId: string) => {
    setAssignments(prev => ({ ...prev, [userId]: roomId }));
  };

  const handleCreate = () => {
    const rooms = draft.map(d => ({
      name: d.name,
      userIds: participants
        .filter(p => !p.isLocal && assignments[p.userId] === d.roomId)
        .map(p => p.userId),
    }));
    onCreateRooms(rooms);
    setAssignments({});
  };

  const remoteParticipants = participants.filter(p => !p.isLocal);

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Breakout rooms</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <KISIcon name="close" size={20} color={palette.subtext} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 16, padding: 14, paddingBottom: Math.max(insets.bottom, 16) }}>

        {/* Participant banner — show which room they're in */}
        {!isHost && myBreakoutRoomId && (
          <View style={[styles.myRoomBanner, { backgroundColor: `${palette.gold}1A`, borderColor: `${palette.gold}40` }]}>
            <KISIcon name="people" size={15} color={palette.gold} />
            <Text style={[styles.myRoomText, { color: palette.gold }]}>
              You're in {breakoutRooms.find(r => r.roomId === myBreakoutRoomId)?.name ?? 'a breakout room'}
            </Text>
            <Pressable onPress={onReturnToMain} style={[styles.returnBtn, { backgroundColor: palette.gold }]}>
              <Text style={[styles.returnText, { color: palette.royalInk }]}>Return to main</Text>
            </Pressable>
          </View>
        )}

        {/* Existing rooms */}
        {breakoutRooms.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Active rooms ({breakoutRooms.length})</Text>
            {breakoutRooms.map(room => {
              const members = remoteParticipants.filter(p => room.userIds.includes(p.userId));
              return (
                <View key={room.roomId} style={[styles.roomCard, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
                  <View style={styles.roomHeader}>
                    <KISIcon name="people" size={15} color={palette.subtext} />
                    <Text style={[styles.roomName, { color: palette.ivory }]}>{room.name}</Text>
                    <Text style={[styles.roomCount, { color: palette.subtext }]}>{members.length} people</Text>
                  </View>
                  <Text style={[styles.roomMembers, { color: palette.subtext }]} numberOfLines={2}>
                    {members.map(p => p.displayName).join(', ') || 'Empty'}
                  </Text>
                </View>
              );
            })}
            {isHost && (
              <Pressable onPress={onCloseRooms} style={[styles.closeAllBtn, { borderColor: palette.danger }]}>
                <Text style={[styles.closeAllText, { color: palette.danger }]}>Close all rooms</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Create rooms (host, no active rooms) */}
        {isHost && breakoutRooms.length === 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Create breakout rooms</Text>

            <View style={styles.numRow}>
              <Text style={[styles.numLabel, { color: palette.ivory }]}>Number of rooms</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pressable onPress={() => setNumRooms(n => Math.max(2, n - 1))} style={[styles.numBtn, { borderColor: palette.inputBorder }]}>
                  <Text style={[styles.numBtnText, { color: palette.ivory }]}>−</Text>
                </Pressable>
                <Text style={[styles.numValue, { color: palette.gold }]}>{numRooms}</Text>
                <Pressable onPress={() => setNumRooms(n => Math.min(8, n + 1))} style={[styles.numBtn, { borderColor: palette.inputBorder }]}>
                  <Text style={[styles.numBtnText, { color: palette.ivory }]}>+</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Assign participants</Text>
            {remoteParticipants.map(p => (
              <View key={p.userId} style={[styles.assignRow, { borderColor: palette.inputBorder }]}>
                <Text style={[styles.participantName, { color: palette.ivory }]} numberOfLines={1}>{p.displayName}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {draft.map(r => {
                      const selected = assignments[p.userId] === r.roomId;
                      return (
                        <Pressable
                          key={r.roomId}
                          onPress={() => assignParticipant(p.userId, r.roomId)}
                          style={[styles.roomPill, { backgroundColor: selected ? `${palette.gold}26` : 'transparent', borderColor: selected ? palette.gold : palette.inputBorder }]}
                        >
                          <Text style={[styles.roomPillText, { color: selected ? palette.gold : palette.subtext }]}>{r.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ))}

            <Pressable onPress={handleCreate} style={[styles.openBtn, { backgroundColor: palette.gold }]}>
              <Text style={[styles.openText, { color: palette.royalInk }]}>Open rooms</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, zIndex: 50,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  myRoomBanner: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  myRoomText: { flex: 1, fontSize: 14, fontWeight: '700' },
  returnBtn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  returnText: { fontSize: 12, fontWeight: '900' },
  roomCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomName: { flex: 1, fontSize: 14, fontWeight: '800' },
  roomCount: { fontSize: 12 },
  roomMembers: { fontSize: 12 },
  closeAllBtn: { borderWidth: 1, borderRadius: 18, alignItems: 'center', paddingVertical: 12 },
  closeAllText: { fontSize: 14, fontWeight: '800' },
  numRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numLabel: { fontSize: 15, fontWeight: '600' },
  numBtn: { width: 36, height: 36, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numBtnText: { fontSize: 18, fontWeight: '700' },
  numValue: { fontSize: 18, fontWeight: '900', minWidth: 24, textAlign: 'center' },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  participantName: { width: 100, fontSize: 13, fontWeight: '600' },
  roomPill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  roomPillText: { fontSize: 12, fontWeight: '700' },
  openBtn: { borderRadius: 28, alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  openText: { fontSize: 15, fontWeight: '900' },
});
