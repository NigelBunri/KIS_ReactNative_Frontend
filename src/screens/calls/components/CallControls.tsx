// src/screens/calls/components/CallControls.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CallSession } from '@/services/calls/callTypes';
import { REACTION_EMOJIS, isGroupCall, hasVideo } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

// Per-call-type accent builder — all values resolved from palette tokens.
// voice-group → palette.info (sky blue), broadcast → palette.danger (vivid red).
const buildAccent = (p: any): Record<string, string> => ({
  voice: p.primary,
  video: p.primaryStrong,
  'voice-group': p.info,
  'video-group': p.info,
  broadcast: p.danger,
});

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
  | 'screen-share'
  | 'noise-cancel'
  | 'invite-link'
  | 'captions'
  | 'virtual-bg'
  | 'record'
  | 'polls'
  | 'qa'
  | 'breakout'
  | 'rtmp'
  | 'whiteboard';

type Props = {
  session: CallSession;
  onAction: (action: ControlAction) => void;
  onSendReaction: (emoji: string) => void;
  showReactionPicker: boolean;
  onToggleReactionPicker: () => void;
  unreadChat: number;
  hasInviteLink?: boolean;
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
  hasInviteLink = false,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const ACCENT = buildAccent(palette);
  const isGroup = isGroupCall(session.callType);
  const withVideo = hasVideo(session.callType);
  const isBroadcast = session.callType === 'broadcast';
  const localParticipant = session.participants.find(p => p.isLocal);
  const isAudienceOnly = isBroadcast && localParticipant?.role === 'audience';
  const isHostOrCoHost = localParticipant?.role === 'host' || localParticipant?.role === 'co-host';
  const handRaised = !!session.raisedHands.includes(session.localUserId);
  const accent = ACCENT[session.callType] ?? palette.primary;

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
      overrideAccent: palette.gold,
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
      overrideAccent: palette.success,
      hidden: isBroadcast && isAudienceOnly,
    },
    {
      id: 'noise-cancel',
      icon: 'mic',
      label: session.isNoiseCancellationOn !== false ? 'Noise off' : 'Noise on',
      active: session.isNoiseCancellationOn !== false,
      overrideAccent: palette.info,
    },
    {
      id: 'invite-link',
      icon: 'link',
      label: 'Invite',
      hidden: !hasInviteLink,
      overrideAccent: palette.gold,
    },
    {
      id: 'captions',
      icon: 'captions',
      label: session.captionsEnabled ? 'Captions on' : 'Captions',
      active: !!session.captionsEnabled,
      overrideAccent: palette.info,
    },
    {
      id: 'virtual-bg',
      icon: 'image',
      label: 'Background',
      active: !!session.virtualBgEnabled,
      hidden: !withVideo || isAudienceOnly,
    },
    {
      id: 'polls',
      icon: 'bar-chart',
      label: 'Polls',
      badge: (session.polls ?? []).filter(p => !p.closed).length,
      hidden: !isGroup,
    },
    {
      id: 'qa',
      icon: 'help-circle',
      label: 'Q&A',
      badge: (session.qaQueue ?? []).filter(q => !q.answered).length,
      hidden: !isGroup,
    },
    {
      id: 'breakout',
      icon: 'grid',
      label: 'Breakout',
      active: (session.breakoutRooms ?? []).length > 0,
      hidden: !isGroup || (!isHostOrCoHost && (session.breakoutRooms ?? []).length === 0),
      overrideAccent: palette.primaryStrong,
    },
    {
      id: 'record',
      icon: 'stop-circle',
      label: session.recordingState === 'recording' ? 'Stop rec' : 'Record',
      active: session.recordingState === 'recording',
      danger: session.recordingState === 'recording',
      hidden: !(isBroadcast && isHostOrCoHost),
    },
    {
      id: 'rtmp',
      icon: 'radio',
      label: session.rtmpActive ? 'Live' : 'Stream',
      active: !!session.rtmpActive,
      danger: !!session.rtmpActive,
      hidden: !(isBroadcast && isHostOrCoHost),
    },
    {
      id: 'whiteboard',
      icon: 'edit-2',
      label: session.whiteboardEnabled ? 'Board on' : 'Board',
      active: !!session.whiteboardEnabled,
      overrideAccent: '#A78BFA',
      hidden: !isGroup,
    },
  ];

  const buttons = allButtons.filter(b => !b.hidden);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: `${palette.royalInk}F7`,
      paddingBottom: Math.max(insets.bottom, 12),
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
      backgroundColor: palette.danger,
      borderRadius: 10,
      minWidth: 17,
      height: 17,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: palette.royalInk,
    },
    badgeTxt: { color: palette.ivory, fontSize: 9, fontWeight: '900' },
    divider: {
      width: StyleSheet.hairlineWidth,
      height: 52,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    endBtn: {
      backgroundColor: palette.danger,
      borderRadius: 22,
      width: 65,
      height: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginHorizontal: 12,
      shadowColor: palette.danger,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 14,
    },
    endLabel: { color: palette.ivory, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  }), [palette, insets.bottom]);

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
              palette={palette}
              styles={styles}
            />
          ))}
        </ScrollView>

        <View style={styles.divider} />

        {/* End call — always pinned to the right, never scrolled away */}
        <Pressable
          onPress={() => onAction('end')}
          accessibilityLabel="End call"
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.95 }] }]}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false, radius: 32 }}
        >
          <KISIcon name="phone-off" size={26} color={palette.ivory} />
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
  palette,
  styles,
}: {
  btn: ControlBtn;
  accent: string;
  onPress: () => void;
  palette: any;
  styles: any;
}) {
  const isActive = !!btn.active;
  const isDanger = !!btn.danger && !isActive;

  const bgColor = isActive
    ? accent
    : isDanger
    ? `${palette.danger}29`
    : 'rgba(255,255,255,0.08)';

  const borderColor = isActive
    ? accent + 'AA'
    : isDanger
    ? `${palette.danger}4D`
    : 'rgba(255,255,255,0.08)';

  const iconColor = isActive ? palette.royalInk : isDanger ? palette.danger : 'rgba(255,255,255,0.88)';
  const labelColor = isActive ? palette.royalInk : isDanger ? palette.danger : 'rgba(255,255,255,0.65)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={btn.label}
      accessibilityRole="button"
      hitSlop={10}
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
