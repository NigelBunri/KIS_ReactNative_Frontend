import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';

const IN_APP_NOTIFICATIONS_KEY = 'kis_in_app_notifications_v1';
const AVAILABILITY_REMINDERS_KEY = 'kis_availability_reminders_v1';

export const IN_APP_NOTIFICATIONS_UPDATED_EVENT = 'inAppNotifications.updated';

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  kind: 'availability_reminder' | 'backend';
  institutionId?: string;
  dateKey?: string;
  time?: string;
};

type AvailabilityReminder = {
  id: string;
  institutionId: string;
  dateKey: string;
  time: string;
  fireAtIso: string;
  firedAt?: string;
};

let runtimeStarted = false;
let runtimeTimer: ReturnType<typeof setInterval> | null = null;

const toDateOnlyIso = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseReminderDate = (dateKey: string, time: string) => {
  const [y, m, d] = String(dateKey || '').split('-').map((part) => Number(part));
  const [hh, mm] = String(time || '').split(':').map((part) => Number(part));
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const parsed = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const emitUpdated = (unreadCount?: number) => {
  DeviceEventEmitter.emit(IN_APP_NOTIFICATIONS_UPDATED_EVENT, { unreadCount });
};

const pushNotification = async (item: InAppNotification) => {
  const list = await readJson<InAppNotification[]>(IN_APP_NOTIFICATIONS_KEY, []);
  const next = [item, ...list].slice(0, 300);
  await writeJson(IN_APP_NOTIFICATIONS_KEY, next);
  emitUpdated();
};

const isLocalNotification = (id: string) => String(id || '').startsWith('availability:');

const toBackendNotification = (raw: any): InAppNotification | null => {
  const id = String(raw?.id || '').trim();
  if (!id) return null;
  const createdAt = raw?.created_at || raw?.createdAt || new Date().toISOString();
  const readAt = raw?.read_at || raw?.readAt || (raw?.is_read ? new Date().toISOString() : null);
  return {
    id,
    title: String(raw?.title || 'Notification'),
    body: String(raw?.body || ''),
    createdAt: String(createdAt),
    readAt: readAt ? String(readAt) : null,
    kind: 'backend',
  };
};

const fetchBackendNotifications = async (): Promise<InAppNotification[]> => {
  const res = await getRequest(ROUTES.notifications.notifications, { forceNetwork: true });
  if (!res?.success) return [];
  const payload = res?.data?.results ?? res?.data ?? [];
  const list = Array.isArray(payload) ? payload : [];
  return list.map(toBackendNotification).filter(Boolean) as InAppNotification[];
};

export const fetchInAppNotifications = async (): Promise<InAppNotification[]> => {
  const [localList, backendList] = await Promise.all([
    readJson<InAppNotification[]>(IN_APP_NOTIFICATIONS_KEY, []),
    fetchBackendNotifications(),
  ]);

  const dedup = new Map<string, InAppNotification>();
  backendList.forEach((item) => dedup.set(item.id, item));
  localList.forEach((item) => {
    if (!dedup.has(item.id)) dedup.set(item.id, item);
  });

  return Array.from(dedup.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const fetchUnreadInAppNotificationsCount = async (): Promise<number> => {
  const list = await fetchInAppNotifications();
  return list.filter((item) => !item.readAt).length;
};

export const markInAppNotificationAsRead = async (notificationId: string) => {
  if (!isLocalNotification(notificationId)) {
    const res = await postRequest(`${ROUTES.notifications.notifications}${notificationId}/mark_read/`, {});
    if (!res?.success) throw new Error(res?.message || 'Unable to mark notification as read.');
    emitUpdated();
    return;
  }

  const list = await readJson<InAppNotification[]>(IN_APP_NOTIFICATIONS_KEY, []);
  let changed = false;
  const next = list.map((item) => {
    if (item.id !== notificationId || item.readAt) return item;
    changed = true;
    return { ...item, readAt: new Date().toISOString() };
  });
  if (!changed) return;
  await writeJson(IN_APP_NOTIFICATIONS_KEY, next);
  emitUpdated();
};

export const deleteInAppNotification = async (notificationId: string) => {
  if (!isLocalNotification(notificationId)) {
    const res = await deleteRequest(`${ROUTES.notifications.notifications}${notificationId}/`);
    if (!res?.success) {
      throw new Error(res?.message || 'Unable to delete notification.');
    }
  }

  const list = await readJson<InAppNotification[]>(IN_APP_NOTIFICATIONS_KEY, []);
  const next = list.filter((item) => item.id !== notificationId);
  if (next.length !== list.length) {
    await writeJson(IN_APP_NOTIFICATIONS_KEY, next);
  }
  emitUpdated();
};

export const upsertAvailabilityReminders = async (
  institutionId: string,
  calendar_times: Record<string, string>,
) => {
  const existing = await readJson<AvailabilityReminder[]>(AVAILABILITY_REMINDERS_KEY, []);
  const keepOther = existing.filter((item) => item.institutionId !== institutionId);

  const nextForInstitution: AvailabilityReminder[] = Object.entries(calendar_times)
    .map(([dateKey, time]) => {
      const fireAt = parseReminderDate(dateKey, time);
      if (!fireAt) return null;
      return {
        id: `${institutionId}:${dateKey}:${time}`,
        institutionId,
        dateKey,
        time,
        fireAtIso: fireAt.toISOString(),
      };
    })
    .filter(Boolean) as AvailabilityReminder[];

  await writeJson(AVAILABILITY_REMINDERS_KEY, [...keepOther, ...nextForInstitution]);
};

export const runInAppNotificationTick = async () => {
  const now = Date.now();
  const reminders = await readJson<AvailabilityReminder[]>(AVAILABILITY_REMINDERS_KEY, []);
  if (!reminders.length) return;

  let changed = false;
  const nextReminders = [...reminders];

  for (let i = 0; i < nextReminders.length; i += 1) {
    const reminder = nextReminders[i];
    if (reminder.firedAt) continue;
    const fireAtMs = new Date(reminder.fireAtIso).getTime();
    if (!Number.isFinite(fireAtMs) || fireAtMs > now) continue;

    changed = true;
    nextReminders[i] = { ...reminder, firedAt: new Date().toISOString() };
    await pushNotification({
      id: `availability:${reminder.id}:${now}`,
      title: 'Consultation schedule reminder',
      body: `Scheduled time reached for ${reminder.dateKey} at ${reminder.time}.`,
      createdAt: new Date().toISOString(),
      readAt: null,
      kind: 'availability_reminder',
      institutionId: reminder.institutionId,
      dateKey: reminder.dateKey,
      time: reminder.time,
    });
  }

  const today = toDateOnlyIso(new Date());
  const pruned = nextReminders.filter((item) => {
    if (!item.firedAt) return true;
    return item.dateKey >= today;
  });

  if (changed || pruned.length !== reminders.length) {
    await writeJson(AVAILABILITY_REMINDERS_KEY, pruned);
  }
};

export const startInAppNotificationRuntime = () => {
  if (runtimeStarted) return;
  runtimeStarted = true;
  runInAppNotificationTick().catch(() => undefined);
  runtimeTimer = setInterval(() => {
    runInAppNotificationTick().catch(() => undefined);
  }, 30 * 1000);
};

export const stopInAppNotificationRuntime = () => {
  runtimeStarted = false;
  if (runtimeTimer) {
    clearInterval(runtimeTimer);
    runtimeTimer = null;
  }
};
