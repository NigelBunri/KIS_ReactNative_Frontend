import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { NEST_API_BASE_URL } from '@/network/config';
import { routeNotification } from './notificationRouter';
import { InAppNotificationToastRef } from './InAppNotificationToast';

const PENDING_PUSH_TOKEN_KEY = 'KIS_PENDING_PUSH_TOKEN';

const registerPushToken = async (payload: {
  pushToken?: string | null;
  apnsToken?: string | null;
}) => {
  const pushToken = payload.pushToken || '';
  if (!pushToken) return;
  const deviceId = (await AsyncStorage.getItem('device_id')) || 'unknown-device';
  const platform = (await AsyncStorage.getItem('device_platform')) || '';
  try {
    const res = await postRequest(
      ROUTES.notifications.deviceTokenRegister,
      {
        device_id: deviceId,
        platform,
        push_token: pushToken,
        token_type: 'fcm',
        apns_token: payload.apnsToken || '',
        metadata: { source: 'react-native-firebase' },
      },
      { errorMessage: 'Unable to register push token.' },
    );
    if (res?.success) {
      await AsyncStorage.removeItem(PENDING_PUSH_TOKEN_KEY).catch(() => {});
    } else {
      await AsyncStorage.setItem(
        PENDING_PUSH_TOKEN_KEY,
        JSON.stringify({ pushToken, apnsToken: payload.apnsToken || '', timestamp: Date.now() }),
      ).catch(() => {});
    }

    // Also register with NestJS chat service (uses different field names)
    postRequest(
      `${NEST_API_BASE_URL}/notifications/tokens/register`,
      { token: pushToken, platform: platform || 'android', deviceId: deviceId },
    ).catch(() => { /* Non-fatal — chat push degrades gracefully */ });
  } catch {
    await AsyncStorage.setItem(
      PENDING_PUSH_TOKEN_KEY,
      JSON.stringify({ pushToken, apnsToken: payload.apnsToken || '', timestamp: Date.now() }),
    ).catch(() => {});
  }
};

const retryPendingPushToken = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PUSH_TOKEN_KEY);
    if (!raw) return;
    const pending: { pushToken: string; apnsToken: string; timestamp: number } = JSON.parse(raw);
    if (!pending?.pushToken) {
      await AsyncStorage.removeItem(PENDING_PUSH_TOKEN_KEY).catch(() => {});
      return;
    }
    await registerPushToken({ pushToken: pending.pushToken, apnsToken: pending.apnsToken });
  } catch { /* silent */ }
};

/** Resolve the raw navigation object from either a plain nav or a React ref. */
function resolveNav(nav?: any): any {
  if (!nav) return null;
  // React.createRef / useRef shape.
  if (typeof nav === 'object' && 'current' in nav) return nav.current;
  return nav;
}

export async function initPushHandlers(navigation?: any) {
  try {
    // Optional dependency: only runs if Firebase app + messaging are installed.
    // Use the modular API to avoid deprecated namespaced calls.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appMod = require('@react-native-firebase/app/lib/modular');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingMod = require('@react-native-firebase/messaging/lib/modular');

    const getApps = appMod?.getApps;
    const getApp = appMod?.getApp;
    const getMessaging = messagingMod?.getMessaging;
    const requestPermission = messagingMod?.requestPermission;
    const getToken = messagingMod?.getToken;
    const getAPNSToken = messagingMod?.getAPNSToken;
    const setBackgroundMessageHandler = messagingMod?.setBackgroundMessageHandler;
    const onMessage = messagingMod?.onMessage;
    const onNotificationOpenedApp = messagingMod?.onNotificationOpenedApp;
    const getInitialNotification = messagingMod?.getInitialNotification;

    if (
      typeof getApps !== 'function' ||
      typeof getApp !== 'function' ||
      typeof getMessaging !== 'function'
    ) {
      return;
    }

    const apps = getApps();
    if (!Array.isArray(apps) || apps.length === 0) {
      if (__DEV__) console.log('[push] firebase app not initialized; skipping messaging bootstrap');
      return;
    }

    const messaging = getMessaging(getApp());

    try {
      if (typeof requestPermission === 'function') {
        await requestPermission(messaging);
      }
    } catch {}

    try {
      const fcmToken =
        typeof getToken === 'function' ? await getToken(messaging) : null;
      if (fcmToken) {
        await AsyncStorage.setItem('fcm_token', fcmToken);
        await AsyncStorage.setItem('push_token', fcmToken);
      }
      const apnsToken =
        typeof getAPNSToken === 'function' ? await getAPNSToken(messaging) : null;
      if (apnsToken) {
        await AsyncStorage.setItem('apns_token', apnsToken);
      }
      // Retry any previously failed push token registration first
      await retryPendingPushToken();
      await registerPushToken({ pushToken: fcmToken, apnsToken });
    } catch {}

    // Background/killed message handler. FCM shows `notification`-keyed messages
    // automatically via the OS. For data-only messages we persist them to
    // AsyncStorage so the app can surface them on next foreground resume.
    if (typeof setBackgroundMessageHandler === 'function') {
      setBackgroundMessageHandler(messaging, async (remoteMessage: any) => {
        try {
          const data = remoteMessage?.data ?? {};
          const title: string = data?.title ?? remoteMessage?.notification?.title ?? '';
          const body: string = data?.body ?? remoteMessage?.notification?.body ?? '';
          if (!title && !body) return;

          // DND check — same midnight-wrap logic as the foreground handler.
          try {
            const dndEnabled = await AsyncStorage.getItem('KIS_DND_ENABLED');
            if (dndEnabled === 'true') {
              const dndFrom = (await AsyncStorage.getItem('KIS_DND_FROM')) ?? '22:00';
              const dndTo = (await AsyncStorage.getItem('KIS_DND_TO')) ?? '08:00';
              const now = new Date();
              const [fromH, fromM] = dndFrom.split(':').map(Number);
              const [toH, toM] = dndTo.split(':').map(Number);
              const nowMins = now.getHours() * 60 + now.getMinutes();
              const fromMins = fromH * 60 + fromM;
              const toMins = toH * 60 + toM;
              const inQuietWindow =
                fromMins <= toMins
                  ? nowMins >= fromMins && nowMins < toMins
                  : nowMins >= fromMins || nowMins < toMins; // wraps midnight
              if (inQuietWindow) return;
            }
          } catch { /* silent */ }

          // Per-chat sound check — if the conversation is set to 'None', skip storing.
          const convId: string = data?.conversationId ?? data?.conversation_id ?? '';
          if (convId) {
            try {
              const sound = await AsyncStorage.getItem(`KIS_NOTIF_SOUND_${convId}`);
              if (sound === 'None') return;
            } catch { /* silent */ }
          }

          // Channel notification toggles — check user's per-category preferences
          try {
            const channelKey = (() => {
              if (data.conversation_id || data.conversationId) return 'notif_messages';
              if (data.broadcast_id || data.channel_id || data.channel_content_id) return 'notif_feed';
              if (data.appointment_id || data.health_service_session_id) return 'notif_health';
              if (data.type === 'bible' || data.bible_id) return 'notif_bible';
              return null;
            })();
            if (channelKey) {
              const enabled = await AsyncStorage.getItem(channelKey);
              if (enabled === 'false') return;
            }
          } catch { /* silent */ }

          const raw = await AsyncStorage.getItem('KIS_BACKGROUND_NOTIFS').catch(() => null);
          const queue: any[] = raw ? JSON.parse(raw) : [];
          queue.push({
            messageId: remoteMessage?.messageId ?? String(Date.now()),
            title,
            body,
            data,
            receivedAt: new Date().toISOString(),
          });
          // Keep at most 20 missed notifications
          await AsyncStorage.setItem(
            'KIS_BACKGROUND_NOTIFS',
            JSON.stringify(queue.slice(-20)),
          ).catch(() => {});
        } catch { /* silent */ }
      });
    }

    // Foreground message handler — show an in-app toast banner.
    if (typeof onMessage === 'function') {
      onMessage(messaging, async (remoteMessage: any) => {
        if (__DEV__) console.log('[push] foreground message', remoteMessage?.messageId ?? remoteMessage);

        const title: string =
          remoteMessage?.notification?.title ??
          remoteMessage?.data?.title ??
          '';
        const body: string =
          remoteMessage?.notification?.body ??
          remoteMessage?.data?.body ??
          '';
        const data: Record<string, string> = remoteMessage?.data ?? {};

        // GAP 5: Do Not Disturb quiet hours check
        try {
          const dndEnabled = await AsyncStorage.getItem('KIS_DND_ENABLED');
          if (dndEnabled === 'true') {
            const dndFrom = (await AsyncStorage.getItem('KIS_DND_FROM')) ?? '22:00';
            const dndTo = (await AsyncStorage.getItem('KIS_DND_TO')) ?? '08:00';
            const now = new Date();
            const [fromH, fromM] = dndFrom.split(':').map(Number);
            const [toH, toM] = dndTo.split(':').map(Number);
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const fromMins = fromH * 60 + fromM;
            const toMins = toH * 60 + toM;
            const inQuietWindow =
              fromMins <= toMins
                ? nowMins >= fromMins && nowMins < toMins
                : nowMins >= fromMins || nowMins < toMins; // wraps midnight
            if (inQuietWindow) return;
          }
        } catch { /* silent */ }

        // GAP 6: per-chat notification sound — if 'None', skip toast
        const convId: string = data?.conversationId ?? data?.conversation_id ?? '';
        if (convId) {
          try {
            const sound = await AsyncStorage.getItem(`KIS_NOTIF_SOUND_${convId}`);
            if (sound === 'None') return;
          } catch { /* silent */ }
        }

        // Channel notification toggles — same keys as background handler
        try {
          const channelKey = (() => {
            if (data.conversation_id || data.conversationId) return 'notif_messages';
            if (data.broadcast_id || data.channel_id || data.channel_content_id) return 'notif_feed';
            if (data.appointment_id || data.health_service_session_id) return 'notif_health';
            if (data.type === 'bible' || data.bible_id) return 'notif_bible';
            return null;
          })();
          if (channelKey) {
            const enabled = await AsyncStorage.getItem(channelKey);
            if (enabled === 'false') return;
          }
        } catch { /* silent */ }

        InAppNotificationToastRef.current?.show({ title, body, data }, resolveNav(navigation));
      });
    }

    // Tap on notification while the app was in the background (not killed).
    if (typeof onNotificationOpenedApp === 'function') {
      onNotificationOpenedApp(messaging, (remoteMessage: any) => {
        if (__DEV__) console.log('[push] notification opened app', remoteMessage?.messageId ?? remoteMessage);
        const nav = resolveNav(navigation);
        if (nav && remoteMessage?.data) {
          routeNotification(remoteMessage.data, nav);
        }
      });
    }

    // Cold-start: app was killed and user tapped a notification.
    if (typeof getInitialNotification === 'function') {
      try {
        const initialMessage = await getInitialNotification(messaging);
        if (initialMessage) {
          if (__DEV__) console.log('[push] initial notification', initialMessage?.messageId ?? initialMessage);
          // Defer to give the navigator time to mount, then resolve the ref.
          if (navigation && initialMessage?.data) {
            setTimeout(() => {
              const nav = resolveNav(navigation);
              if (nav) routeNotification(initialMessage.data, nav);
            }, 300);
          }
        }
      } catch {}
    }
  } catch (err: any) {
    if (__DEV__) console.log('[push] messaging not available:', err?.message);
  }
}
