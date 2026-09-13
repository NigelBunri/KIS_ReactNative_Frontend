import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { IN_APP_NOTIFICATIONS_UPDATED_EVENT } from '@/services/inAppNotificationService';

export type MainTabBadgeRoute = 'Partners' | 'Bible' | 'Messages' | 'Broadcast' | 'Profile';
export type MainTabBadgeCounts = Record<MainTabBadgeRoute, number>;

export const MAIN_TAB_BADGES_UPDATED_EVENT = 'mainTabBadges.updated';
export const MAIN_TAB_BADGES_REALTIME_EVENT = 'main_tab_badges.updated';
export const MAIN_TAB_BADGE_REFRESH_EVENTS = [
  IN_APP_NOTIFICATIONS_UPDATED_EVENT,
  'conversation.refresh',
  'conversation.created',
  'conversation.updated',
  'conversation.read',
  'community.refresh',
  'message.status',
  'chat.message',
  'chat.message_receipt',
  'chat.edit',
  'chat.delete',
  'broadcast.refresh',
  'broadcast.created',
  'broadcast.updated',
  'chat.message.global',
  'channel.refresh',
  'channel.subscription.updated',
  'channel.content.created',
  'channel.content.updated',
  'bible.readingEvents.updated',
  'bible.schedule.updated',
  'bible.meditations.updated',
  'partner.open',
  'partner.refresh',
  'partner.message',
  MAIN_TAB_BADGES_UPDATED_EVENT,
  MAIN_TAB_BADGES_REALTIME_EVENT,
] as const;

export const emptyMainTabBadgeCounts = (): MainTabBadgeCounts => ({
  Partners: 0,
  Bible: 0,
  Messages: 0,
  Broadcast: 0,
  Profile: 0,
});

const clampCount = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.min(999, Math.floor(num)) : 0;
};

const toBackendCounts = (payload: any): MainTabBadgeCounts | null => {
  const raw = payload?.counts ?? payload?.data?.counts ?? null;
  if (!raw || typeof raw !== 'object') return null;
  return {
    Partners: clampCount(raw.Partners ?? raw.partners),
    Bible: clampCount(raw.Bible ?? raw.bible),
    Messages: clampCount(raw.Messages ?? raw.messages),
    Broadcast: clampCount(raw.Broadcast ?? raw.broadcast),
    Profile: clampCount(raw.Profile ?? raw.profile),
  };
};

const fetchBackendMainTabBadgeCounts = async (): Promise<MainTabBadgeCounts | null> => {
  const url = ROUTES.notifications?.mainTabBadgeCounts;
  if (!url) return null;
  const res = await getRequest(url, { forceNetwork: true });
  if (!res?.success) return null;
  return toBackendCounts(res.data ?? res);
};

// Last known-good counts, so a failed refresh degrades to "unchanged"
// instead of a second, independently-computed number. This used to be a
// full client-side recomputation from fetchInAppNotifications() +
// fetchConversationsForCurrentUser() + local Bible events — but that was a
// second formula for the same tab badges that had already drifted from the
// backend's (get_main_tab_badge_counts in Django): no partner_notification_
// unread equivalent, no comment-room-broadcast unread logic, and a narrower
// Bible keyword match than the backend's. Two formulas for one number can
// only ever be kept in sync by accident, and a wrong-but-plausible number is
// worse than a stale-but-previously-correct one, since nothing told the user
// which kind of number they were looking at. In-memory first (cheap, covers
// the common case of a mid-session network blip); AsyncStorage as a second
// layer only consulted when nothing's been fetched yet this session, so a
// cold start with a flaky first request still shows the last real counts
// from before the app was closed rather than an empty tab bar.
const LAST_GOOD_COUNTS_STORAGE_KEY = 'KIS_MAIN_TAB_BADGE_COUNTS_LAST_GOOD_V1';
let lastGoodCountsInMemory: MainTabBadgeCounts | null = null;

const persistLastGoodCounts = (counts: MainTabBadgeCounts) => {
  lastGoodCountsInMemory = counts;
  // Fire-and-forget: this is a best-effort cache, not something worth
  // blocking or failing a badge refresh over.
  AsyncStorage.setItem(LAST_GOOD_COUNTS_STORAGE_KEY, JSON.stringify(counts)).catch(() => undefined);
};

const loadPersistedLastGoodCounts = async (): Promise<MainTabBadgeCounts | null> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_GOOD_COUNTS_STORAGE_KEY);
    if (!raw) return null;
    return toBackendCounts({ counts: JSON.parse(raw) });
  } catch {
    return null;
  }
};

export const fetchMainTabBadgeCounts = async (_currentUserId?: string | null): Promise<MainTabBadgeCounts> => {
  const backendCounts = await fetchBackendMainTabBadgeCounts().catch(() => null);
  if (backendCounts) {
    persistLastGoodCounts(backendCounts);
    return backendCounts;
  }

  if (lastGoodCountsInMemory) return lastGoodCountsInMemory;

  const persisted = await loadPersistedLastGoodCounts();
  if (persisted) {
    lastGoodCountsInMemory = persisted;
    return persisted;
  }

  return emptyMainTabBadgeCounts();
};

export const emitMainTabBadgeRefresh = (reason?: string) => {
  DeviceEventEmitter.emit(MAIN_TAB_BADGES_UPDATED_EVENT, { reason });
};

export const markMainTabNotificationSourceRead = async (payload: {
  source?: MainTabBadgeRoute | 'education' | 'health' | 'market' | string;
  targetType?: string;
  targetId?: string | number | null;
  types?: string[];
}) => {
  const url = ROUTES.notifications?.markSourceRead;
  if (!url) return { updated: 0 };
  const body = {
    source: payload.source ? String(payload.source).toLowerCase() : undefined,
    target_type: payload.targetType,
    target_id: payload.targetId ? String(payload.targetId) : undefined,
    types: payload.types,
  };
  const res = await postRequest(url, body, { errorMessage: 'Unable to update notification read state.' });
  if (res?.success) emitMainTabBadgeRefresh('source_mark_read');
  return res?.data ?? res ?? { updated: 0 };
};

export const bindMainTabBadgeSourceEvents = (refresh: () => void) => {
  const subs = MAIN_TAB_BADGE_REFRESH_EVENTS.map((eventName) =>
    DeviceEventEmitter.addListener(eventName, refresh),
  );
  return () => subs.forEach((sub) => sub.remove());
};
