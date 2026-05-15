import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

export type NotificationUrgencyLabel =
  | 'spiritual'
  | 'health'
  | 'learning'
  | 'commerce'
  | 'social'
  | 'trust'
  | 'general'
  | string;

export type NotificationAttentionSummary = {
  unread_count: number;
  urgent_now: number;
  by_priority: Array<{ priority: string; count: number }>;
  by_source: Array<{ context_data__badge_source?: string; count: number }>;
  by_urgency: Array<{ context_data__urgency_label?: NotificationUrgencyLabel; count: number }>;
  preferences?: NotificationAttentionPreferences;
};

export type NotificationAttentionPreferences = {
  quiet_hours?: { start?: string; end?: string; timezone?: string };
  digest?: { frequency?: string; time?: string; enabled?: boolean };
  source_rules?: Array<{
    id?: string;
    source: string;
    enabled: boolean;
    priority?: string;
    channels?: string[];
    schedule?: Record<string, unknown>;
  }>;
  child_youth_safe_defaults?: boolean;
};

export type NotificationAttentionPreferencesPayload = {
  quiet_hours?: Record<string, unknown>;
  digest?: Record<string, unknown>;
  source?: string;
  source_enabled?: boolean;
  source_priority?: string;
  source_channels?: string[];
};

export const fetchNotificationAttentionSummary = () =>
  getRequest(ROUTES.notifications.attentionSummary, {
    errorMessage: 'Unable to load notification attention summary.',
  });

export const fetchNotificationAttentionPreferences = () =>
  getRequest(ROUTES.notifications.attentionPreferences, {
    errorMessage: 'Unable to load notification preferences.',
  });

export const saveNotificationAttentionPreferences = (payload: NotificationAttentionPreferencesPayload) =>
  postRequest(ROUTES.notifications.attentionPreferences, payload, {
    errorMessage: 'Unable to save notification preferences.',
  });

export const searchNotifications = (params: {
  q?: string;
  source?: string;
  urgency?: NotificationUrgencyLabel;
  priority?: string;
  unread?: boolean;
}) =>
  getRequest(ROUTES.notifications.notifications, {
    params: {
      q: params.q,
      source: params.source,
      urgency: params.urgency,
      priority: params.priority,
      unread: params.unread === undefined ? undefined : params.unread ? '1' : '0',
    },
    errorMessage: 'Unable to search notifications.',
  });

