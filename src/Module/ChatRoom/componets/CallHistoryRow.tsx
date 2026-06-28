// src/Module/ChatRoom/componets/CallHistoryRow.tsx
// Renders a past call as a timeline row inside the chat message list —
// similar to how WhatsApp and Telegram show "Voice call · 12:45" in the thread.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { callTypeLabel, callTypeIcon, formatDuration } from '@/services/calls/callTypes';
import type { CallType } from '@/services/calls/callTypes';

export type CallHistoryEntry = {
  callId: string;
  conversationId: string;
  callType: CallType;
  status: 'ongoing' | 'completed' | 'cancelled' | 'missed' | 'active' | 'ringing' | 'pending' | 'busy' | 'declined' | 'ended';
  startedAt: string;
  endedAt?: string | null;
  duration?: number | null;      // seconds
  participantCount?: number;
  createdBy: string;
  title?: string | null;
};

type Props = {
  entry: CallHistoryEntry;
  currentUserId: string;
  onCallBack?: (entry: CallHistoryEntry) => void;
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 7) return new Date(iso).toLocaleDateString();
  if (days > 1) return `${days} days ago`;
  if (days === 1) return 'Yesterday';
  if (hours > 1) return `${hours}h ago`;
  if (mins > 1) return `${mins}m ago`;
  return 'Just now';
}

export default function CallHistoryRow({ entry, currentUserId, onCallBack }: Props) {
  const { palette } = useKISTheme();

  const isMissed = entry.status === 'missed';
  const isOngoing = entry.status === 'active' || entry.status === 'ongoing' || entry.status === 'ringing';
  const isInitiated = entry.createdBy === currentUserId;
  const statusLabel: Record<CallHistoryEntry['status'], string> = {
    active: 'Ongoing',
    ongoing: 'Ongoing',
    ringing: 'Ringing',
    pending: 'Scheduled',
    completed: 'Completed',
    ended: 'Completed',
    cancelled: 'Cancelled',
    missed: 'Missed',
    busy: 'Busy',
    declined: 'Declined',
  };
  const icon = callTypeIcon(entry.callType);
  const label = callTypeLabel(entry.callType);
  const time = entry.startedAt ? formatRelativeTime(entry.startedAt) : '';
  const durationStr = entry.duration != null ? formatDuration(entry.duration) : null;

  // Colours
  const accentColor = isMissed ? palette.danger : isOngoing ? palette.success : palette.subtext;
  const iconBg = isMissed ? `${palette.danger}15` : isOngoing ? `${palette.success}15` : palette.surface;
  const iconColor = isMissed ? palette.danger : isOngoing ? palette.success : palette.subtext;

  // Direction arrow for missed/outgoing
  const directionIcon = isMissed
    ? 'arrow-down-left'
    : isInitiated
    ? 'arrow-up-right'
    : 'arrow-down-left';

  return (
    <View style={[styles.row, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <KISIcon name={icon} size={18} color={iconColor} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <KISIcon name={directionIcon} size={12} color={accentColor} />
          <Text style={[styles.label, { color: isMissed ? palette.danger : palette.text }]}>
            {entry.title || label}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: palette.subtext }]}>{time}</Text>
          {durationStr && (
            <>
              <Text style={[styles.meta, { color: palette.subtext }]}>·</Text>
              <Text style={[styles.meta, { color: palette.subtext }]}>{durationStr}</Text>
            </>
          )}
          {(entry.participantCount ?? 0) > 2 && (
            <>
              <Text style={[styles.meta, { color: palette.subtext }]}>·</Text>
              <Text style={[styles.meta, { color: palette.subtext }]}>
                {entry.participantCount} people
              </Text>
            </>
          )}
          <>
            <Text style={[styles.meta, { color: palette.subtext }]}>·</Text>
            <Text style={[styles.meta, { color: isMissed ? palette.danger : isOngoing ? palette.success : palette.subtext }]}>
              {statusLabel[entry.status]}
            </Text>
          </>
        </View>
      </View>

      {/* Call back button */}
      {onCallBack && !isOngoing && entry.status !== 'pending' && (
        <Pressable
          onPress={() => onCallBack(entry)}
          style={({ pressed }) => [
            styles.callbackBtn,
            { borderColor: palette.inputBorder },
            pressed && { opacity: 0.65 },
          ]}
          hitSlop={8}
          accessibilityLabel="Call back"
        >
          <KISIcon
            name={entry.callType === 'video' || entry.callType === 'video-group' ? 'video' : 'phone'}
            size={15}
            color={palette.primary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 3,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  callbackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
