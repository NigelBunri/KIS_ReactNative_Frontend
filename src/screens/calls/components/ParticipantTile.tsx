// src/screens/calls/components/ParticipantTile.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { CallParticipant } from '@/services/calls/callTypes';
import NetworkQualityBars from './NetworkQualityBars';
import { KISIcon } from '@/constants/kisIcons';
import { RTCView } from '@/services/calls/webRTCService';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  participant: CallParticipant;
  width: number;
  height: number;
  isPinned?: boolean;
  isSpeaker?: boolean;
  showName?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  isAudioOnly?: boolean;
  cornerRadius?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('');
}

// Avatar background pool — uses palette-adjacent semantic hues; updated at runtime via palette tokens where available.
const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

export default React.memo(function ParticipantTile({
  participant,
  width,
  height,
  isPinned,
  isSpeaker,
  showName = true,
  onPress,
  onLongPress,
  isAudioOnly,
  cornerRadius = 16,
}: Props) {
  const { palette } = useKISTheme();
  const showVideo = !isAudioOnly && !participant.isVideoOff && participant.stream && RTCView;
  const avatarColor = useMemo(() => {
    const idx = Math.abs(
      (participant.userId ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0),
    ) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
  }, [participant.userId]);

  const styles = useMemo(() => StyleSheet.create({
    tile: {
      overflow: 'hidden',
      backgroundColor: palette.royalInk,
    },
    avatar: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      color: palette.ivory,
      fontWeight: '800',
    },
    topLeft: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: palette.overlay,
      borderRadius: 6,
      padding: 3,
    },
    topRight: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
    badge: {
      backgroundColor: palette.overlay,
      borderRadius: 12,
      padding: 4,
    },
    handBadge: {
      position: 'absolute',
      top: 36,
      right: 8,
      backgroundColor: palette.overlay,
      borderRadius: 12,
      padding: 4,
    },
    handEmoji: { fontSize: 16 },
    nameBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.overlay,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
    },
    nameText: {
      color: palette.ivory,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    videoOffBadge: {
      position: 'absolute',
      bottom: 32,
      left: '50%',
      backgroundColor: palette.overlay,
      borderRadius: 20,
      padding: 6,
      transform: [{ translateX: -13 }],
    },
  }), [palette]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tile,
        {
          width,
          height,
          borderRadius: cornerRadius,
          borderWidth: isSpeaker || participant.isSpeaking ? 2.5 : 0,
          borderColor: palette.success,
        },
      ]}
    >
      {/* Video stream */}
      {showVideo && RTCView ? (
        <RTCView
          streamURL={participant.stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={participant.isLocal}
          zOrder={participant.isLocal ? 0 : 1}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={[styles.initials, { fontSize: Math.max(16, width * 0.2) }]}>
            {initials(participant.displayName)}
          </Text>
        </View>
      )}

      {/* Top-left badges */}
      <View style={styles.topLeft}>
        <NetworkQualityBars quality={participant.networkQuality} size={14} />
      </View>

      {/* Top-right: pin indicator */}
      {isPinned && (
        <View style={styles.topRight}>
          <View style={styles.badge}>
            <KISIcon name="pin" size={10} color={palette.ivory} />
          </View>
        </View>
      )}

      {/* Raise hand */}
      {participant.handRaised && (
        <View style={styles.handBadge}>
          <Text style={styles.handEmoji}>✋</Text>
        </View>
      )}

      {/* Bottom bar: name + mic */}
      {showName && (
        <View style={styles.nameBar}>
          <Text style={styles.nameText} numberOfLines={1}>
            {participant.isLocal ? 'You' : participant.displayName}
          </Text>
          {participant.isMuted ? (
            <KISIcon name="mic-off" size={13} color={palette.danger} />
          ) : (
            participant.isSpeaking && <KISIcon name="mic" size={13} color={palette.success} />
          )}
        </View>
      )}

      {/* Video off overlay */}
      {!showVideo && participant.isVideoOff && !isAudioOnly && (
        <View style={styles.videoOffBadge}>
          <KISIcon name="video-off" size={13} color={palette.subtext} />
        </View>
      )}
    </Pressable>
  );
});
