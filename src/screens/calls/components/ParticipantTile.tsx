// src/screens/calls/components/ParticipantTile.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
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
  // 'circle' forces a perfectly round tile (cornerRadius is ignored) and
  // swaps the static speaking border for an animated pulsing ring — used by
  // voice-call avatar tiles. Corner badges (network/pin/hand) are skipped in
  // this shape since the circle mask would clip them; callers render that
  // status themselves outside the tile instead.
  shape?: 'rounded' | 'circle';
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
  shape = 'rounded',
}: Props) {
  const { palette } = useKISTheme();
  const showVideo = !isAudioOnly && !participant.isVideoOff && participant.stream && RTCView;
  const isSpeakingNow = isSpeaker || participant.isSpeaking;

  // Animated pulsing ring for circular (voice-call) tiles, in place of the
  // plain static border used by rounded/video tiles. Loops only while
  // actually speaking; resets to a stable resting state otherwise so it
  // never gets stuck mid-pulse when speaking stops.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (shape !== 'circle') return;
    if (!isSpeakingNow) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shape, isSpeakingNow, pulseAnim]);
  // CallParticipant.avatarUrl has existed on the type since this screen was
  // first built, but nothing in the calling UI ever actually rendered it —
  // every tile (video-off, audio-only, voice calls) fell back to colored
  // initials even for a participant with a real profile photo. Tracks its
  // own load failure so a broken/expired URL falls back to initials rather
  // than an empty gap — `showVideo` already wins when a live video frame is
  // available, so this only ever matters when there's no stream to show.
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [participant.avatarUrl]);
  const showAvatarPhoto = !showVideo && !!participant.avatarUrl && !avatarLoadFailed;
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
    speakRing: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2.5,
      borderColor: palette.success,
    },
  }), [palette]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress || onLongPress ? 'button' : undefined}
      accessibilityLabel={
        onPress || onLongPress
          ? `${participant.isLocal ? 'You' : participant.displayName}${isPinned ? ', pinned' : ''}`
          : undefined
      }
      style={[
        styles.tile,
        {
          width,
          height,
          borderRadius: shape === 'circle' ? width / 2 : cornerRadius,
          borderWidth: shape === 'circle' ? 0 : isSpeakingNow ? 2.5 : 0,
          borderColor: palette.success,
        },
      ]}
    >
      {/* Video stream, then a real profile photo, then colored initials —
          in that priority order. Nothing in this call UI rendered
          avatarUrl before this, even though it's been on CallParticipant
          since this screen was first built; every tile without a live
          video frame fell back to initials regardless of whether the
          participant has a real profile photo. */}
      {showVideo && RTCView ? (
        <RTCView
          streamURL={participant.stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={participant.isLocal}
          zOrder={participant.isLocal ? 0 : 1}
        />
      ) : showAvatarPhoto ? (
        <Image
          source={{ uri: participant.avatarUrl! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setAvatarLoadFailed(true)}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={[styles.initials, { fontSize: Math.max(16, width * 0.2) }]}>
            {initials(participant.displayName)}
          </Text>
        </View>
      )}

      {/* Top-left badges — skipped for circle tiles: the round mask would
          clip a square-corner badge, and VoiceCallGrid renders this status
          itself below the avatar instead. */}
      {shape !== 'circle' && (
        <View style={styles.topLeft}>
          <NetworkQualityBars quality={participant.networkQuality} size={14} />
        </View>
      )}

      {/* Top-right: pin indicator */}
      {shape !== 'circle' && isPinned && (
        <View style={styles.topRight}>
          <View style={styles.badge}>
            <KISIcon name="pin" size={10} color={palette.ivory} />
          </View>
        </View>
      )}

      {/* Raise hand */}
      {shape !== 'circle' && participant.handRaised && (
        <View style={styles.handBadge}>
          <Text style={styles.handEmoji}>✋</Text>
        </View>
      )}

      {/* Animated pulsing speaking ring (circle tiles only, while speaking) */}
      {shape === 'circle' && isSpeakingNow && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.speakRing,
            {
              borderRadius: width / 2,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
            },
          ]}
        />
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
