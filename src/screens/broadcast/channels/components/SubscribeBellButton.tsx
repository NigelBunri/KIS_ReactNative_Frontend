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
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
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

  // Matches YouTube's own bell glyph per level: a solid/filled bell once
  // it's been "rung" (All), the default hollow outline for Personalized,
  // and a slashed bell once "unrung" (None) - distinguishing level by
  // glyph shape, not just tint, so it reads correctly for colorblind users
  // and at a glance without needing to compare against another channel.
  const bellIconName = notifLevel === 'none' ? 'bell-off' : 'bell';
  const bellFocused = notifLevel === 'all';
  const bellColor = notifLevel === 'none'
    ? palette.subtext
    : notifLevel === 'personalized'
      ? palette.gold
      : palette.primaryStrong;

  return (
    <View style={styles.row}>
      {/* Subscribe button - KISButton, same pill-shaped component every
          other primary action in the app uses (see src/constants/
          KISButton.tsx). 'danger' while unsubscribed matches YouTube's own
          red Subscribe CTA exactly; once subscribed it switches to
          'secondary' (neutral/outlined), the same treatment the Updates
          channel Follow button already uses for its "on" state. This used
          to be a hand-rolled Pressable styled with palette.text, which
          wasn't red in either light or dark mode and didn't match this or
          any other button's pill shape/sizing. */}
      <KISButton
        variant={subscribed ? 'secondary' : 'danger'}
        size="xs"
        title={subscribed ? 'Subscribed' : 'Subscribe'}
        loading={subPending}
        disabled={subPending}
        onPress={handleSubscribe}
        accessibilityLabel={subscribed ? 'Unsubscribe from channel' : 'Subscribe to channel'}
        style={compact ? styles.subscribeCompactOverride : styles.subscribeOverride}
        textStyle={compact ? styles.subscribeCompactText : styles.subscribeText}
      />

      {/* Bell button (only when subscribed) */}
      {subscribed && (
        <Pressable
          onPress={handleBell}
          disabled={bellPending}
          style={[
            compact ? styles.bellCompact : styles.bell,
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
              name={bellIconName}
              focused={bellFocused}
              size={compact ? 13 : 14}
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
  // Overrides on top of KISButton's own 'xs' size - still a real
  // KISButton (pill shape, variant colors, loading/disabled states), just
  // trimmed well below 'xs' so it doesn't dominate a header row shared
  // with other buttons (ChannelHomePage's Join button, etc).
  subscribeOverride: {
    minHeight:         28,
    paddingHorizontal: 12,
  },
  subscribeCompactOverride: {
    minHeight:         24,
    paddingHorizontal: 10,
  },
  subscribeText: {
    fontSize: 12,
  },
  subscribeCompactText: {
    fontSize: 11,
  },
  bell: {
    width:          28,
    height:         28,
    borderRadius:   14,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bellCompact: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
