// src/screens/broadcast/channels/components/SubscribeBellButton.tsx
//
// Subscribe button + notification bell for a channel.
//
// State machine:
//   unsubscribed          → tap Subscribe   → subscribed + bell=all
//   subscribed + bell=all → tap bell        → subscribed + bell=mentions
//   subscribed + bell=mentions → tap bell   → subscribed + bell=off
//   subscribed + bell=off      → tap bell   → subscribed + bell=all
//   subscribed                 → tap button → unsubscribed (bell hidden)
//
// Both actions persist to the backend with optimistic updates + rollback.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { toggleChannelSubscription } from '@/screens/broadcast/channels/hooks/useChannelsData';

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifLevel = 'all' | 'mentions' | 'off';

type Props = {
  channelId?:          string;
  initialSubscribed?:  boolean;
  initialNotifLevel?:  NotifLevel;
  compact?:            boolean;
  onSubscribeChange?:  (subscribed: boolean) => void;
};

// ── Bell icon per notification level ─────────────────────────────────────────

const BELL_ICON: Record<NotifLevel, string> = {
  all:      'bell',
  mentions: 'bell',
  off:      'bell-off',
};

const NOTIF_CYCLE: NotifLevel[] = ['all', 'mentions', 'off'];

function nextLevel(current: NotifLevel): NotifLevel {
  const i = NOTIF_CYCLE.indexOf(current);
  return NOTIF_CYCLE[(i + 1) % NOTIF_CYCLE.length];
}

const NOTIF_LABEL: Record<NotifLevel, string> = {
  all:      'All notifications',
  mentions: 'Mentions only',
  off:      'Notifications off',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubscribeBellButton({
  channelId,
  initialSubscribed = false,
  initialNotifLevel = 'all',
  compact = false,
  onSubscribeChange,
}: Props) {
  const { palette } = useKISTheme();

  const [subscribed,    setSubscribed]    = useState(initialSubscribed);
  const [notifLevel,    setNotifLevel]    = useState<NotifLevel>(
    initialSubscribed ? initialNotifLevel : 'all',
  );
  const [subPending,    setSubPending]    = useState(false);
  const [bellPending,   setBellPending]   = useState(false);

  // Keep ref in sync so callbacks always see latest values
  const subscribedRef   = useRef(subscribed);
  const notifLevelRef   = useRef(notifLevel);
  useEffect(() => { subscribedRef.current   = subscribed; }, [subscribed]);
  useEffect(() => { notifLevelRef.current   = notifLevel; }, [notifLevel]);

  // ── Subscribe / unsubscribe ─────────────────────────────────────────────────

  const handleSubscribe = useCallback(async () => {
    if (!channelId || subPending) return;
    const next = !subscribedRef.current;

    // Optimistic
    setSubscribed(next);
    if (!next) setNotifLevel('all'); // reset bell on unsub
    onSubscribeChange?.(next);
    setSubPending(true);

    try {
      const res = await toggleChannelSubscription(channelId, next);
      if (!res?.success) {
        // Rollback
        setSubscribed(!next);
        onSubscribeChange?.(!next);
        Alert.alert('Subscription update failed', res?.message || 'Please try again.');
      }
    } finally {
      setSubPending(false);
    }
  }, [channelId, subPending, onSubscribeChange]);

  // ── Notification preference ─────────────────────────────────────────────────

  const handleBell = useCallback(async () => {
    if (!channelId || !subscribedRef.current || bellPending) return;
    const next = nextLevel(notifLevelRef.current);

    // Optimistic
    setNotifLevel(next);
    setBellPending(true);

    try {
      const res = await postRequest(
        ROUTES.broadcasts.channelNotificationPreference(channelId),
        { notification_level: next },
        { errorMessage: '' },
      );
      if (!res?.success) {
        // Rollback
        setNotifLevel(notifLevelRef.current);
        Alert.alert('Could not update notifications', 'Please try again.');
      }
    } finally {
      setBellPending(false);
    }
  }, [channelId, bellPending]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const bellColor = notifLevel === 'off'
    ? palette.subtext
    : notifLevel === 'mentions'
      ? '#F59E0B'
      : palette.primaryStrong;

  return (
    <View style={styles.row}>
      {/* Subscribe button */}
      <Pressable
        onPress={handleSubscribe}
        disabled={subPending}
        style={[
          styles.subscribe,
          compact && styles.subscribeCompact,
          {
            backgroundColor: subscribed ? palette.surfaceElevated : palette.text,
            opacity: subPending ? 0.7 : 1,
          },
        ]}
      >
        {subPending ? (
          <ActivityIndicator
            size="small"
            color={subscribed ? palette.text : palette.surface}
          />
        ) : (
          <Text
            style={{
              color:      subscribed ? palette.text : palette.surface,
              fontWeight: '900',
              fontSize:   compact ? 11 : 13,
            }}
          >
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </Text>
        )}
      </Pressable>

      {/* Bell button (only when subscribed) */}
      {subscribed && (
        <Pressable
          onPress={handleBell}
          disabled={bellPending}
          style={[
            styles.bell,
            compact && styles.bellCompact,
            {
              borderColor:     palette.border,
              backgroundColor: notifLevel !== 'off' ? `${bellColor}18` : palette.surface,
              opacity:         bellPending ? 0.6 : 1,
            },
          ]}
          accessibilityLabel={NOTIF_LABEL[notifLevel]}
        >
          {bellPending ? (
            <ActivityIndicator size="small" color={bellColor} />
          ) : (
            <KISIcon
              name={BELL_ICON[notifLevel]}
              size={compact ? 15 : 18}
              color={bellColor}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  subscribe: {
    minHeight:       38,
    borderRadius:    8,
    paddingHorizontal: 18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  subscribeCompact: {
    minHeight:       34,
    paddingHorizontal: 13,
  },
  bell: {
    width:          38,
    height:         38,
    borderRadius:   19,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bellCompact: {
    width:    32,
    height:   32,
    borderRadius: 16,
  },
});
