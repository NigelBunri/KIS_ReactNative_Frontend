import { DeviceEventEmitter } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import { Chat } from '@/Module/ChatRoom/messagesUtils';
import {
  fetchInAppNotifications,
  IN_APP_NOTIFICATIONS_UPDATED_EVENT,
  InAppNotification,
} from '@/services/inAppNotificationService';
import { readLocalBibleEvents } from '@/services/bibleUserPersistence';

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

const unreadFromConversation = (chat: Chat) => clampCount(chat.unreadCount ?? 0);


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

const isPartnerConversation = (chat: Chat) => {
  const kind = String(chat.kind ?? '').toLowerCase();
  const name = String(chat.name ?? chat.title ?? '').toLowerCase();
  return (
    kind.includes('partner') ||
    name.includes('partner') ||
    Boolean((chat as any).partnerId ?? (chat as any).partner_id)
  );
};

const isBroadcastNotification = (item: InAppNotification) => {
  const haystack = `${item.kind ?? ''} ${item.title ?? ''} ${item.body ?? ''}`.toLowerCase();
  return [
    'broadcast',
    'channel',
    'course',
    'lesson',
    'product',
    'market',
    'shop',
    'event',
    'education',
    'health',
    'institution',
  ].some((token) => haystack.includes(token));
};

const isBibleNotification = (item: InAppNotification) => {
  const haystack = `${item.kind ?? ''} ${item.title ?? ''} ${item.body ?? ''}`.toLowerCase();
  return haystack.includes('bible') || haystack.includes('reading reminder') || haystack.includes('meditation');
};

const countMissedBibleSchedules = async () => {
  const events = await readLocalBibleEvents();
  const now = Date.now();
  return events.filter((event) => {
    if (event.status === 'missed') return true;
    if (event.status !== 'scheduled') return false;
    const startsAt = event.start_at ? new Date(event.start_at).getTime() : NaN;
    return Number.isFinite(startsAt) && startsAt < now;
  }).length;
};

export const fetchMainTabBadgeCounts = async (currentUserId?: string | null): Promise<MainTabBadgeCounts> => {
  const backendCounts = await fetchBackendMainTabBadgeCounts().catch(() => null);
  if (backendCounts) return backendCounts;

  // fetchUnreadInAppNotificationsCount() previously ran alongside
  // fetchInAppNotifications() here, but it calls fetchInAppNotifications()
  // internally — every fallback-triggered badge refresh was hitting
  // /notifications/ twice in parallel for the same data. The unread count
  // is just the unread subset of the list we already fetch below.
  const [notifications, conversations, missedBibleSchedules] = await Promise.all([
    fetchInAppNotifications().catch(() => []),
    fetchConversationsForCurrentUser([], currentUserId ?? undefined, true).catch(() => []),
    countMissedBibleSchedules().catch(() => 0),
  ]);

  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const profileUnread = unreadNotifications.length;
  const bibleUnread = unreadNotifications.filter(isBibleNotification).length + missedBibleSchedules;
  const broadcastUnread = unreadNotifications.filter(isBroadcastNotification).length;

  const partnersUnread = conversations
    .filter(isPartnerConversation)
    .reduce((sum, chat) => sum + unreadFromConversation(chat), 0);

  const isCommentRoom = (chat: Chat) => {
    const kind = String((chat as any).kind ?? '').toLowerCase();
    return kind === 'post' || kind === 'thread';
  };

  const messageUnread = conversations
    .filter((chat) => !isPartnerConversation(chat) && !isCommentRoom(chat))
    .reduce((sum, chat) => sum + unreadFromConversation(chat), 0);

  return {
    Partners: clampCount(partnersUnread),
    Bible: clampCount(bibleUnread),
    Messages: clampCount(messageUnread),
    Broadcast: clampCount(broadcastUnread),
    Profile: clampCount(profileUnread),
  };
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
