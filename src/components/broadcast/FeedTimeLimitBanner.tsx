// src/components/broadcast/FeedTimeLimitBanner.tsx
//
// UI for the server-authoritative daily feed time limit (see
// useResponsibleFeedLimit / apps/accounts/responsible_feed.py on the
// backend). Two pieces: a low-key warning banner once time is running low,
// and a full block shown once the limit is actually reached — the feed API
// itself already returns an empty page at that point, this just explains
// why instead of leaving the user looking at a silently-empty feed.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { FeedLimitStatus } from '@/hooks/useResponsibleFeedLimit';

const WARNING_THRESHOLD_SECONDS = 10 * 60;

const formatRemaining = (seconds: number): string => {
  const mins = Math.max(0, Math.ceil(seconds / 60));
  if (mins < 1) return 'less than a minute';
  if (mins === 1) return '1 minute';
  return `${mins} minutes`;
};

export function FeedTimeLimitBanner({ status }: { status: FeedLimitStatus | null }) {
  const { palette } = useKISTheme();
  if (!status || status.limitReached || status.secondsRemaining > WARNING_THRESHOLD_SECONDS) {
    return null;
  }
  return (
    <View style={[styles.banner, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
      <Text style={[styles.bannerText, { color: palette.subtext }]}>
        {formatRemaining(status.secondsRemaining)} left of today's browsing time
      </Text>
    </View>
  );
}

export function FeedTimeLimitBlock({
  status,
  onGoBack,
}: {
  status: FeedLimitStatus | null;
  onGoBack?: () => void;
}) {
  const { palette } = useKISTheme();
  if (!status?.limitReached) return null;
  return (
    <View style={styles.blockContainer}>
      <Text style={[styles.blockTitle, { color: palette.text }]}>
        You've reached today's browsing limit
      </Text>
      <Text style={[styles.blockBody, { color: palette.subtext }]}>
        This limit resets at midnight. Messaging, calls, your profile and settings all still work normally.
      </Text>
      {onGoBack ? (
        <Pressable
          onPress={onGoBack}
          style={[styles.blockButton, { backgroundColor: palette.gold }]}
        >
          <Text style={styles.blockButtonText}>Back</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  blockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  blockTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  blockBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  blockButton: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  blockButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1400',
  },
});
