import AsyncStorage from '@react-native-async-storage/async-storage';

export async function initPushHandlers() {
  try {
    // Optional dependency: only runs if Firebase messaging is installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/messaging');
    const getMessaging = mod?.default ?? mod;
    if (typeof getMessaging !== 'function') return;
    const messaging = getMessaging();

    try {
      await messaging.requestPermission?.();
    } catch {}

    try {
      const fcmToken = await messaging.getToken?.();
      if (fcmToken) {
        await AsyncStorage.setItem('fcm_token', fcmToken);
        await AsyncStorage.setItem('push_token', fcmToken);
      }
    } catch {}

    try {
      const apnsToken = await messaging.getAPNSToken?.();
      if (apnsToken) {
        await AsyncStorage.setItem('apns_token', apnsToken);
      }
    } catch {}

    if (typeof messaging.setBackgroundMessageHandler === 'function') {
      messaging.setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('[push] background message', remoteMessage?.messageId ?? remoteMessage);
      });
    }

    if (typeof messaging.onMessage === 'function') {
      messaging.onMessage(async (remoteMessage: any) => {
        console.log('[push] foreground message', remoteMessage?.messageId ?? remoteMessage);
      });
    }
  } catch (err: any) {
    console.log('[push] messaging not available:', err?.message);
  }
}
