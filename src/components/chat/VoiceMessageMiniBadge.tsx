// src/components/chat/VoiceMessageMiniBadge.tsx
// Floating badge shown whenever a voice note is playing (or paused mid-way)
// and survives navigating away from its conversation — see
// VoiceMessagePlayerContext.tsx for why this needs to exist at all. Mirrors
// CallMiniBadge.tsx's visual pattern (same floating pill, same slide-in/out
// animation) but is deliberately NOT visually identical — a different accent
// color and icon so "on a call" and "voice note playing" can never be
// confused for each other at a glance, even though both can in principle be
// visible if a call is minimised at the same time a voice note is playing.
//
// Tapping the badge reopens the source conversation via the existing
// 'chat.open' DeviceEventEmitter bridge (see AppNavigator.tsx's MainTabs —
// this is the same mechanism GlobalSearchScreen, UserProfileScreen,
// ChatInfoPage, and half a dozen other screens already use to jump into a
// specific chat from outside the chat list itself), not a bespoke navigation
// path — reusing what's already proven rather than inventing a second way to
// open a conversation.

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { useVoiceMessagePlayer } from '@/contexts/VoiceMessagePlayerContext';

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export default function VoiceMessageMiniBadge() {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const {
    messageId,
    conversationId,
    conversationTitle,
    senderName,
    playing,
    buffering,
    positionMs,
    durationMs,
    error,
    togglePlay,
    stop,
  } = useVoiceMessagePlayer();

  const slideAnim = useRef(new Animated.Value(-80)).current;
  const isVisible = !!messageId;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : -80,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }, [isVisible, slideAnim]);

  if (!messageId) return null;

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const label = senderName ? `Voice message · ${senderName}` : (conversationTitle ?? 'Voice message');

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          top: topInset + 4,
          backgroundColor: palette.royalInk,
          // Gold/primary accent, not the green "live call" success color —
          // the visual-distinctness requirement above.
          borderColor: `${palette.primary}80`,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          if (conversationId) {
            DeviceEventEmitter.emit('chat.open', {
              conversationId,
              name: conversationTitle ?? 'Chat',
            });
          }
        }}
        style={styles.left}
        accessibilityLabel="Return to conversation"
        accessibilityRole="button"
      >
        <KISIcon name="mic" size={15} color={palette.primary} />
        <View style={styles.mid}>
          <Text style={[styles.title, { color: palette.ivory }]} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.primary },
              ]}
            />
          </View>
        </View>
        {!error && (
          <Text style={[styles.time, { color: palette.subtext }]}>
            {formatTime(positionMs)}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={togglePlay}
        style={[styles.playBtn, { backgroundColor: `${palette.primary}22` }]}
        accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}
        hitSlop={6}
      >
        {buffering ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <KISIcon name={playing ? 'pause' : 'play'} size={14} color={palette.primary} />
        )}
      </Pressable>

      <Pressable
        onPress={stop}
        style={[styles.endBtn, { backgroundColor: palette.subtext + '33' }]}
        accessibilityLabel="Dismiss"
        hitSlop={6}
      >
        <KISIcon name="close" size={14} color={palette.ivory} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 26,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 14,
    zIndex: 9998,
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mid: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: 2,
  },
  time: { fontSize: 11, fontWeight: '500' },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
