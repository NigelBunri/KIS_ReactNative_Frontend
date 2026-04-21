import AsyncStorage from '@react-native-async-storage/async-storage';

export async function initPushHandlers() {
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

    if (
      typeof getApps !== 'function' ||
      typeof getApp !== 'function' ||
      typeof getMessaging !== 'function'
    ) {
      return;
    }

    const apps = getApps();
    if (!Array.isArray(apps) || apps.length === 0) {
      console.log('[push] firebase app not initialized; skipping messaging bootstrap');
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
    } catch {}

    try {
      const apnsToken =
        typeof getAPNSToken === 'function' ? await getAPNSToken(messaging) : null;
      if (apnsToken) {
        await AsyncStorage.setItem('apns_token', apnsToken);
      }
    } catch {}

    if (typeof setBackgroundMessageHandler === 'function') {
      setBackgroundMessageHandler(messaging, async (remoteMessage: any) => {
        console.log('[push] background message', remoteMessage?.messageId ?? remoteMessage);
      });
    }

    if (typeof onMessage === 'function') {
      onMessage(messaging, async (remoteMessage: any) => {
        console.log('[push] foreground message', remoteMessage?.messageId ?? remoteMessage);
      });
    }
  } catch (err: any) {
    console.log('[push] messaging not available:', err?.message);
  }
}
