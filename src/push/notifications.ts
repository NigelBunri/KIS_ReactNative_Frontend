import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { routeNotification } from './notificationRouter';
import { InAppNotificationToastRef } from './InAppNotificationToast';

const registerPushToken = async (payload: {
  pushToken?: string | null;
  apnsToken?: string | null;
}) => {
  const pushToken = payload.pushToken || '';
  if (!pushToken) return;
  const deviceId = (await AsyncStorage.getItem('device_id')) || 'unknown-device';
  const platform = (await AsyncStorage.getItem('device_platform')) || '';
  await postRequest(
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
      await registerPushToken({ pushToken: fcmToken, apnsToken });
    } catch {}

    // Background message handler — must be registered before the app goes to the
    // background, so we keep the existing stub (no UI possible in the background).
    if (typeof setBackgroundMessageHandler === 'function') {
      setBackgroundMessageHandler(messaging, async (remoteMessage: any) => {
        if (__DEV__) console.log('[push] background message', remoteMessage?.messageId ?? remoteMessage);
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
