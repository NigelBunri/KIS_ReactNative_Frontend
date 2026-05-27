// src/screens/calls/components/CallControls.tsx
import React from 'react';
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

// Per-call-type accent colours — each type feels distinct yet royal
const ACCENT: Record<string, string> = {
  voice: '#C9A227',        // classic gold
  video: '#8B5CF6',        // violet
  'voice-group': '#3B82F6', // sapphire
  'video-group': '#06B6D4', // cyan
  broadcast: '#EC4899',    // rose
};

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
  overrideAccent?: string;
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
  const accent = ACCENT[session.callType] ?? '#C9A227';

  const allButtons: ControlBtn[] = [
    {
      id: 'mute',
      icon: session.isMuted ? 'mic-off' : 'mic',
      label: session.isMuted ? 'Unmute' : 'Mute',
      active: !session.isMuted,
      danger: session.isMuted,
    },
    {
      id: 'video',
      icon: session.isVideoEnabled ? 'video' : 'video-off',
      label: session.isVideoEnabled ? 'Camera' : 'No cam',
      active: session.isVideoEnabled,
      danger: !session.isVideoEnabled,
      hidden: !withVideo || isAudienceOnly,
    },
    {
      id: 'flip',
      icon: 'flip-camera',
      label: 'Flip',
      hidden: !withVideo || !session.isVideoEnabled || isAudienceOnly,
    },
    {
      id: 'speaker',
      icon: session.isSpeakerOn ? 'volume-2' : 'volume-mute',
      label: session.isSpeakerOn ? 'Speaker' : 'Earpiece',
      active: session.isSpeakerOn,
    },
    {
      id: 'raise-hand',
      icon: 'raise-hand',
      label: handRaised ? 'Lower' : 'Hand',
      active: handRaised,
      overrideAccent: '#F59E0B',
      hidden: !isGroup,
    },
    {
      id: 'reactions',
      icon: 'smile',
      label: 'React',
      active: showReactionPicker,
    },
    {
      id: 'chat',
      icon: 'message-square',
      label: 'Chat',
      badge: unreadChat,
    },
    {
      id: 'participants',
      icon: 'users',
      label: 'People',
      badge: session.participants.length > 1 ? session.participants.length : 0,
      hidden: !isGroup,
    },
    {
      id: 'layout',
      icon: 'grid',
      label: 'Layout',
      hidden: !isGroup,
    },
    {
      id: 'screen-share',
      icon: 'screen-share',
      label: session.isScreenSharing ? 'Sharing' : 'Share',
      active: session.isScreenSharing,
      overrideAccent: '#22C55E',
      hidden: isBroadcast && isAudienceOnly,
    },
  ];

  const buttons = allButtons.filter(b => !b.hidden);

  return (
    <View style={styles.container}>
      {/* Gold accent pip — indicates call type by colour */}
      <View style={[styles.accentPip, { backgroundColor: accent }]} />

      {/* Reaction emoji tray — slides in above controls */}
      {showReactionPicker && (
        <View style={styles.reactionTray}>
          {REACTION_EMOJIS.map(emoji => (
            <Pressable
              key={emoji}
              onPress={() => { onSendReaction(emoji); onToggleReactionPicker(); }}
              style={({ pressed }) => [styles.reactionBtn, pressed && { opacity: 0.65, transform: [{ scale: 0.9 }] }]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Main controls row */}
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {buttons.map(btn => (
            <CallButton
              key={btn.id}
              btn={btn}
              accent={btn.overrideAccent ?? accent}
              onPress={() =>
                btn.id === 'reactions' ? onToggleReactionPicker() : onAction(btn.id)
              }
            />
          ))}
        </ScrollView>

        <View style={styles.divider} />

        {/* End call — always pinned to the right, never scrolled away */}
        <Pressable
          onPress={() => onAction('end')}
          style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.95 }] }]}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false, radius: 32 }}
        >
          <KISIcon name="phone-off" size={26} color="#fff" />
          <Text style={styles.endLabel}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CallButton({
  btn,
  accent,
  onPress,
}: {
  btn: ControlBtn;
  accent: string;
  onPress: () => void;
}) {
  const isActive = !!btn.active;
  const isDanger = !!btn.danger && !isActive;

  const bgColor = isActive
    ? accent
    : isDanger
    ? 'rgba(220,38,38,0.16)'
    : 'rgba(255,255,255,0.08)';

  const borderColor = isActive
    ? accent + 'AA'
    : isDanger
    ? 'rgba(220,38,38,0.3)'
    : 'rgba(255,255,255,0.08)';

  const iconColor = isActive ? '#080814' : isDanger ? '#F87171' : 'rgba(255,255,255,0.88)';
  const labelColor = isActive ? '#080814' : isDanger ? '#F87171' : 'rgba(255,255,255,0.65)';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bgColor, borderColor },
        pressed && styles.btnPressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <KISIcon name={btn.icon} size={23} color={iconColor} />
        {(btn.badge ?? 0) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{btn.badge! > 9 ? '9+' : btn.badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.btnLabel, { color: labelColor }, isActive && styles.btnLabelActive]}>
        {btn.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8,8,20,0.97)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  accentPip: {
    width: 44,
    height: 3,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
    opacity: 0.85,
  },
  reactionTray: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  reactionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reactionEmoji: { fontSize: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    alignItems: 'center',
  },
  btn: {
    width: 65,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderWidth: 1,
  },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  iconWrap: { position: 'relative' },
  btnLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.15,
  },
  btnLabelActive: { fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#080814',
  },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  endBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 22,
    width: 65,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 14,
  },
  endLabel: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
});
