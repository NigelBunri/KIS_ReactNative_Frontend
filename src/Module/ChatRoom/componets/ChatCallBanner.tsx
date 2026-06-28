// src/Module/ChatRoom/componets/ChatCallBanner.tsx
// Sticky banner shown below the chat header when there is an active call in
// this conversation. Shows call type, how many people are in it, elapsed time,
// and gives members a one-tap way to join or return to the call.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { callTypeLabel, callTypeIcon, formatDuration } from '@/services/calls/callTypes';
import type { CallType } from '@/services/calls/callTypes';

export type ActiveCallInfo = {
  callId: string;
  conversationId: string;
  callType: CallType;
  startedAt: string;
  participantCount: number;
  title?: string | null;
};

type Props = {
  call: ActiveCallInfo;
  /** True when the local user is already IN this call (just minimised it). */
  isLocal: boolean;
  onJoin: () => void;
  onReturn: () => void;
};

function useCallDuration(startedAt: string): string {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setSecs(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return formatDuration(secs);
}

export default function ChatCallBanner({ call, isLocal, onJoin, onReturn }: Props) {
  const { palette } = useKISTheme();
  const slideAnim = useRef(new Animated.Value(-56)).current;
  const duration = useCallDuration(call.startedAt);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, []);

  const icon = callTypeIcon(call.callType);
  const label = callTypeLabel(call.callType);
  const count = call.participantCount;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: `${palette.success}18`,
          borderBottomColor: `${palette.success}30`,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Pulsing green dot */}
      <PulseDot color={palette.success} />

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <KISIcon name={icon} size={13} color={palette.success} />
          <Text style={[styles.titleText, { color: palette.text }]}>
            {call.title || label}
          </Text>
          <Text style={[styles.meta, { color: palette.subtext }]}>
            · {count} in call · {duration}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          {isLocal ? 'You are in this call' : 'Tap to join'}
        </Text>
      </View>

      {/* Action button */}
      <Pressable
        onPress={isLocal ? onReturn : onJoin}
        style={[styles.joinBtn, { backgroundColor: palette.success }]}
        accessibilityLabel={isLocal ? 'Return to call' : 'Join call'}
      >
        <Text style={[styles.joinText, { color: palette.ivory }]}>
          {isLocal ? 'Return' : 'Join'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color, transform: [{ scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  info: { flex: 1, gap: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  titleText: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 12 },
  subtitle: { fontSize: 11 },
  joinBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexShrink: 0,
  },
  joinText: { fontSize: 13, fontWeight: '800' },
});
