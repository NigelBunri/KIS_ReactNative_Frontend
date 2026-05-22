// src/screens/calls/components/CallControls.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import type { CallSession } from '@/services/calls/callTypes';
import { REACTION_EMOJIS, isGroupCall, hasVideo } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';

type ControlAction =
  | 'mute'
  | 'video'
  | 'speaker'
  | 'flip'
  | 'end'
  | 'chat'
  | 'participants'
  | 'raise-hand'
  | 'reactions'
  | 'layout'
  | 'screen-share';

type Props = {
  session: CallSession;
  onAction: (action: ControlAction) => void;
  onSendReaction: (emoji: string) => void;
  showReactionPicker: boolean;
  onToggleReactionPicker: () => void;
  unreadChat: number;
};

type ControlBtn = {
  id: ControlAction;
  icon: string;
  label: string;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  hidden?: boolean;
};

export default function CallControls({
  session,
  onAction,
  onSendReaction,
  showReactionPicker,
  onToggleReactionPicker,
  unreadChat,
}: Props) {
  const isGroup = isGroupCall(session.callType);
  const withVideo = hasVideo(session.callType);
  const isBroadcast = session.callType === 'broadcast';
  const localParticipant = session.participants.find(p => p.isLocal);
  const isAudienceOnly = isBroadcast && localParticipant?.role === 'audience';
  const handRaised = !!session.raisedHands.includes(session.localUserId);

  const allButtons: ControlBtn[] = [
    { id: 'mute', icon: session.isMuted ? 'mic-off' : 'mic', label: session.isMuted ? 'Unmute' : 'Mute', active: !session.isMuted },
    { id: 'video', icon: session.isVideoEnabled ? 'video' : 'video-off', label: session.isVideoEnabled ? 'Camera' : 'No cam', active: session.isVideoEnabled, hidden: !withVideo || isAudienceOnly },
    { id: 'flip', icon: 'refresh-cw', label: 'Flip', hidden: !withVideo || !session.isVideoEnabled || isAudienceOnly },
    { id: 'speaker', icon: session.isSpeakerOn ? 'volume-2' : 'volume-x', label: session.isSpeakerOn ? 'Speaker' : 'Earpiece', active: session.isSpeakerOn },
    { id: 'raise-hand', icon: 'hand', label: handRaised ? 'Lower hand' : 'Raise hand', active: handRaised, hidden: !isGroup },
    { id: 'reactions', icon: 'smile', label: 'React' },
    { id: 'chat', icon: 'message-square', label: 'Chat', badge: unreadChat },
    { id: 'participants', icon: 'users', label: `People (${session.participants.length})`, hidden: !isGroup },
    { id: 'layout', icon: 'grid', label: 'Layout', hidden: !isGroup },
    { id: 'screen-share', icon: 'monitor', label: 'Share', active: session.isScreenSharing, hidden: isBroadcast && isAudienceOnly },
  ];
  const buttons = allButtons.filter(b => !b.hidden);

  return (
    <View style={styles.container}>
      {/* Reaction emoji picker */}
      {showReactionPicker && (
        <View style={styles.reactionPicker}>
          {REACTION_EMOJIS.map(emoji => (
            <Pressable
              key={emoji}
              onPress={() => { onSendReaction(emoji); onToggleReactionPicker(); }}
              style={styles.reactionBtn}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Controls row: scrollable device buttons + always-visible end call */}
      <View style={styles.controlsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.scrollView}
        >
          {buttons.map(btn => (
            <ControlButton
              key={btn.id}
              btn={btn}
              onPress={() => btn.id === 'reactions' ? onToggleReactionPicker() : onAction(btn.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.endSeparator} />

        {/* End call — always visible on the right, never scrolled away */}
        <Pressable
          onPress={() => onAction('end')}
          style={styles.endBtn}
          android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false, radius: 34 }}
        >
          <KISIcon name="phone-off" size={24} color="#fff" />
          <Text style={styles.endLabel}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ControlButton({ btn, onPress }: { btn: ControlBtn; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        btn.active && styles.btnActive,
        pressed && styles.btnPressed,
      ]}
    >
      <View>
        <KISIcon
          name={btn.icon}
          size={22}
          color={btn.active ? '#0D0D1A' : 'rgba(255,255,255,0.9)'}
        />
        {(btn.badge ?? 0) > 0 && (
          <View style={styles.badgeDot}>
            <Text style={styles.badgeText}>{btn.badge! > 9 ? '9+' : btn.badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.btnLabel, btn.active && styles.btnLabelActive]}>
        {btn.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(13,13,26,0.96)',
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: { flex: 1 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  btn: {
    width: 62,
    height: 68,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  btnActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  btnPressed: { opacity: 0.7 },
  btnLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  btnLabelActive: { color: '#0D0D1A' },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#E52B2B',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  endSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  endBtn: {
    backgroundColor: '#E52B2B',
    borderRadius: 50,
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginHorizontal: 12,
    shadowColor: '#E52B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  endLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reactionPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  reactionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 26 },
});
