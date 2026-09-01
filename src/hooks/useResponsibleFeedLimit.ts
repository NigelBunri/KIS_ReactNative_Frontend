import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

// Roughly matches the backend's own heartbeat cadence guidance
// (apps/accounts/responsible_feed.py: "roughly every 15-30s while the
// passive feed screen is actively on-screen").
const HEARTBEAT_INTERVAL_MS = 20000;

export type FeedLimitStatus = {
  secondsConsumed: number;
  limitSeconds: number;
  secondsRemaining: number;
  limitReached: boolean;
};

const normalizeStatus = (data: any): FeedLimitStatus | null => {
  if (!data || typeof data !== 'object') return null;
  const limitSeconds = Number(data.limit_seconds);
  if (!Number.isFinite(limitSeconds)) return null;
  return {
    secondsConsumed: Number(data.seconds_consumed) || 0,
    limitSeconds,
    secondsRemaining: Number(data.seconds_remaining) || 0,
    limitReached: Boolean(data.limit_reached),
  };
};

/**
 * Tracks the server-authoritative daily feed time limit while `active` is
 * true (i.e. the feed screen is focused and in the foreground). Sends a
 * heartbeat on an interval — the server computes elapsed time from its own
 * clock, this hook doesn't report any duration itself.
 */
export const useResponsibleFeedLimit = (active: boolean) => {
  const [status, setStatus] = useState<FeedLimitStatus | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await getRequest(ROUTES.engagement.feedStatus, {
        errorMessage: 'Unable to load feed usage status.',
      });
      const next = normalizeStatus(res?.data);
      if (next) setStatus(next);
    } catch {
      // Non-fatal — the feed itself already enforces the limit
      // server-side; this hook is only for showing the user where they
      // stand ahead of time.
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await postRequest(ROUTES.engagement.feedHeartbeat, {}, {
        errorMessage: 'Unable to record feed usage.',
      });
      const next = normalizeStatus(res?.data);
      if (next) setStatus(next);
    } catch {
      // Non-fatal, see refreshStatus.
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!active) return undefined;

    sendHeartbeat();
    const interval = setInterval(() => {
      if (activeRef.current && AppState.currentState === 'active') {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [active, sendHeartbeat]);

  return { status, refreshStatus };
};

export default useResponsibleFeedLimit;
