// src/components/calls/CallMiniBadge.tsx
// Floating mini-pip shown when a call is active but the user minimised the
// full-screen call UI by pressing "↓". Tapping it restores the call screen.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { useSocket } from '@/SocketProvider';
import { callTypeIcon } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  /** Called when the badge is tapped — parent should restore the full call UI */
  onRestore: () => void;
};

export default function CallMiniBadge({ onRestore }: Props) {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const { activeCall, leaveCall } = useSocket();

  const slideAnim = useRef(new Animated.Value(-80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isLive =
    activeCall &&
    activeCall.state !== 'ended' &&
    activeCall.state !== 'missed' &&
    activeCall.state !== 'incoming' &&
    activeCall.state !== 'lobby';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isLive ? 0 : -80,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }, [isLive]);

  // Pulse the green dot to signal the call is live
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive]);

  if (!activeCall) return null;

  const participantCount = activeCall.participants.filter(p => !p.isLocal).length;
  const icon = callTypeIcon(activeCall.callType);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          top: topInset + 4,
          backgroundColor: palette.royalInk,
          borderColor: `${palette.success}80`,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onRestore}
        style={styles.left}
        accessibilityLabel="Return to call"
        accessibilityRole="button"
      >
        {/* Live dot */}
        <Animated.View
          style={[
            styles.liveDot,
            { backgroundColor: palette.success, transform: [{ scale: pulseAnim }] },
          ]}
        />
        <KISIcon name={icon} size={15} color={palette.success} />
        <Text style={[styles.title, { color: palette.ivory }]} numberOfLines={1}>
          {activeCall.title}
        </Text>
        {participantCount > 0 && (
          <Text style={[styles.count, { color: palette.subtext }]}>
            · {participantCount + 1} in call
          </Text>
        )}
      </Pressable>

      {/* End button */}
      <Pressable
        onPress={() => leaveCall?.()}
        style={[styles.endBtn, { backgroundColor: palette.danger }]}
        accessibilityLabel="Leave call"
        hitSlop={6}
      >
        <KISIcon name="phone-off" size={14} color={palette.ivory} />
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
    zIndex: 9999,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  count: { fontSize: 12, fontWeight: '500' },
  endBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
