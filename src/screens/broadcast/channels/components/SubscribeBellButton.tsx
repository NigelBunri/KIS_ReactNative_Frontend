// src/screens/broadcast/channels/components/SubscribeBellButton.tsx
//
// Subscribe button + notification bell for a channel - matches YouTube's
// own subscribe+bell exactly: three notification levels (All/Personalized/
// None), Personalized is the default the moment you subscribe (same
// default BroadcastChannelSubscription.notifications uses server-side),
// and tapping the bell cycles through all three.
//
// State machine:
//   unsubscribed                 → tap Subscribe → subscribed + bell=personalized
//   subscribed + bell=all        → tap bell       → subscribed + bell=personalized
//   subscribed + bell=personalized → tap bell     → subscribed + bell=none
//   subscribed + bell=none        → tap bell      → subscribed + bell=all
//   subscribed                    → tap button    → unsubscribed (bell hidden)
//
// Both actions persist to the backend with optimistic updates + rollback.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { patchRequest } from '@/network/patch';
import { toggleChannelSubscription } from '@/screens/broadcast/channels/hooks/useChannelsData';

// ── Types ─────────────────────────────────────────────────────────────────────

// Mirrors BroadcastChannelSubscription.NotificationLevel exactly
// (apps/broadcasts/models.py) - these are also the literal values the
// PATCH body below must send, not display labels.
type NotifLevel = 'all' | 'personalized' | 'none';

type Props = {
  channelId?:          string;
  initialSubscribed?:  boolean;
  initialNotifLevel?:  NotifLevel;
  compact?:            boolean;
  onSubscribeChange?:  (subscribed: boolean) => void;
};

// ── Notification cycle ───────────────────────────────────────────────────────

// 'bell' is KISIcon's only registered bell glyph (maps to Ionicons
// notifications/notifications-outline - see constants/kisIcons.tsx) - a
// previous 'bell-off' name here didn't exist in that mapping at all and
// silently rendered nothing for the "none" state. States are distinguished
// by color/opacity instead (see bellColor below), the same way the rest
// of this component already did for "mentions" vs "all".
const NOTIF_CYCLE: NotifLevel[] = ['all', 'personalized', 'none'];

function nextLevel(current: NotifLevel): NotifLevel {
  const i = NOTIF_CYCLE.indexOf(current);
  return NOTIF_CYCLE[(i + 1) % NOTIF_CYCLE.length];
}

const NOTIF_LABEL: Record<NotifLevel, string> = {
  all:          'All notifications',
  personalized: 'Personalized',
  none:         'Notifications off',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubscribeBellButton({
  channelId,
  initialSubscribed = false,
  initialNotifLevel = 'personalized',
  compact = false,
  onSubscribeChange,
}: Props) {
  const { palette } = useKISTheme();

  const [subscribed,    setSubscribed]    = useState(initialSubscribed);
  const [notifLevel,    setNotifLevel]    = useState<NotifLevel>(
    initialSubscribed ? initialNotifLevel : 'personalized',
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
    // 'personalized' matches both BroadcastChannelSubscription's own
    // model default and what a fresh subscribe gets server-side
    // (BroadcastChannelSubscribeView.post's get_or_create defaults) -
    // also the state shown immediately after subscribing, same as
    // YouTube's own default bell state on a new subscription.
    setNotifLevel('personalized');
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
    // Captured before the optimistic update below - notifLevelRef.current
    // tracks `notifLevel` via its own effect, which re-runs (and
    // overwrites this ref to the NEW value) as soon as setNotifLevel(next)
    // below commits, well before this request's response arrives. Rolling
    // back to notifLevelRef.current at that point would just re-apply the
    // same optimistic value instead of actually undoing it.
    const previous = notifLevelRef.current;
    const next = nextLevel(previous);

    // Optimistic
    setNotifLevel(next);
    setBellPending(true);

    try {
      // PATCH, not POST: the backend (BroadcastChannelSubscriptionView,
      // the same view both channelSubscription and
      // channelNotificationPreference route to) only implements patch() -
      // a POST here 405'd unconditionally, so every bell tap silently
      // failed and rolled back regardless of which level was requested.
      // Field name must be `notifications` (what the view actually
      // reads), not `notification_level`.
      const res = await patchRequest(
        ROUTES.broadcasts.channelNotificationPreference(channelId),
        { notifications: next },
        { errorMessage: '' },
      );
      if (!res?.success) {
        setNotifLevel(previous);
        Alert.alert('Could not update notifications', 'Please try again.');
      }
    } finally {
      setBellPending(false);
    }
  }, [channelId, bellPending]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const bellColor = notifLevel === 'none'
    ? palette.subtext
    : notifLevel === 'personalized'
      ? palette.gold
      : palette.primaryStrong;

  return (
    <View style={styles.row}>
      {/* Subscribe button */}
      <Pressable
        onPress={handleSubscribe}
        disabled={subPending}
        accessibilityRole="button"
        accessibilityLabel={subscribed ? 'Unsubscribe from channel' : 'Subscribe to channel'}
        accessibilityState={{ selected: subscribed, busy: subPending }}
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
              backgroundColor: notifLevel !== 'none' ? palette.primarySoft ?? palette.primaryWeak : palette.surface,
              opacity:         bellPending ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={NOTIF_LABEL[notifLevel]}
          accessibilityHint="Cycles notification level: all, personalized, or none"
        >
          {bellPending ? (
            <ActivityIndicator size="small" color={bellColor} />
          ) : (
            <KISIcon
              name="bell"
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
    minHeight:       44,
    borderRadius:    8,
    paddingHorizontal: 18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  subscribeCompact: {
    minHeight:       44,
    paddingHorizontal: 13,
  },
  bell: {
    width:          44,
    height:         44,
    borderRadius:   22,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bellCompact: {
    width:    44,
    height:   44,
    borderRadius: 22,
  },
});
