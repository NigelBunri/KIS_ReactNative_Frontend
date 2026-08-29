import { AppState, DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { NEST_API_BASE_URL } from '@/network/config';
import { routeNotification } from './notificationRouter';
import { InAppNotificationToastRef } from './InAppNotificationToast';
import { displayIncomingCall } from '@/services/calls/callKitService';
import { ensureDeviceId } from '@/security/e2ee';

const PENDING_PUSH_TOKEN_KEY = 'KIS_PENDING_PUSH_TOKEN';

// TEMPORARY diagnostic helper — piggybacks on the tokens/register endpoint
// (unvalidated token field) to report where push init actually exits, since
// this RN version's console output isn't visible to us on-device. Remove
// once the FCM-token root cause is confirmed fixed.
const reportDiag = async (reason: string) => {
  try {
    const diagDeviceId = `${await ensureDeviceId()}_diag`;
    await postRequest(
      `${NEST_API_BASE_URL}/notifications/tokens/register`,
      { token: `DIAG:${reason}:${Date.now()}`, platform: Platform.OS, deviceId: diagDeviceId },
    ).catch(() => {});
  } catch {}
};

const registerPushToken = async (payload: {
  pushToken?: string | null;
  apnsToken?: string | null;
}) => {
  const pushToken = payload.pushToken || '';
  if (!pushToken) return;
  const deviceId = await ensureDeviceId();
  // Was read from an AsyncStorage key ('device_platform') that nothing in
  // the app ever writes — every registration silently sent an empty
  // platform to Django, and Nest's own fallback ('android') was wrong for
  // every iOS device. Platform.OS is the actual, always-correct source.
  const platform = Platform.OS;
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

// Background/killed FCM message handler. Exported so index.js can register
// it synchronously at JS entry — Android only spins up a headless JS
// instance to run a background handler that was registered *before* the
// message arrived; a handler attached later, inside initPushHandlers()
// (which only runs once App.tsx mounts), never gets that chance when the
// app process was fully killed rather than merely backgrounded. This is
// also why call pushes (data-only, so delivery depends entirely on this
// handler running) were silently dropped while regular message pushes
// (which carry a `notification` block the OS displays natively, no JS
// required) kept working — see initPushHandlers() below for that split.
//
// FCM shows `notification`-keyed messages automatically via the OS. For
// data-only messages we persist them to AsyncStorage so the app can
// surface them on next foreground resume.
export const handleBackgroundPushMessage = async (remoteMessage: any) => {
  try {
    const data = remoteMessage?.data ?? {};
    const title: string = data?.title ?? remoteMessage?.notification?.title ?? '';
    const body: string = data?.body ?? remoteMessage?.notification?.body ?? '';

    // Incoming calls: show the native CallKit/ConnectionService ringing
    // UI directly instead of queueing a regular notification — the
    // call UI *is* the notification here, matching WhatsApp. Uses the
    // same callId as the CallKeep UUID that the socket-path
    // (SocketProvider.tsx) uses, so there's no duplicate/conflicting
    // entry once the app wakes and the real call.offer event arrives.
    if (data?.type === 'incoming_call' && data?.callId) {
      displayIncomingCall({
        callUUID: String(data.callId),
        callerName: String(data.callerName ?? data.fromDisplayName ?? title ?? 'Incoming call'),
        callType: (data.callType as any) ?? 'voice',
      });
      return;
    }

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
};

// Registers handleBackgroundPushMessage as early as possible (called from
// index.js, before App.tsx mounts). Safe to call even if Firebase's native
// module isn't ready yet on a stale/mismatched build — mirrors the same
// require()-inside-try/catch defensive pattern initPushHandlers() uses.
export function registerBackgroundPushHandler(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appMod = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingMod = require('@react-native-firebase/messaging');
    const getApp = appMod?.getApp;
    const getMessaging = messagingMod?.getMessaging;
    const setBackgroundMessageHandler = messagingMod?.setBackgroundMessageHandler;
    if (typeof getApp !== 'function' || typeof getMessaging !== 'function' || typeof setBackgroundMessageHandler !== 'function') {
      return;
    }
    const messaging = getMessaging(getApp());
    setBackgroundMessageHandler(messaging, handleBackgroundPushMessage);
  } catch { /* silent — retried once initPushHandlers() runs from App.tsx */ }
}

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

// iOS PushKit VoIP token — a SEPARATE token from the FCM/APNs token above.
// Only NestJS needs it (calls are entirely its domain); Django never sends
// call pushes, so there's no reason to dual-write this one to Django.
const registerVoipPushToken = async (voipToken: string) => {
  if (!voipToken) return;
  const deviceId = await ensureDeviceId();
  try {
    await postRequest(
      `${NEST_API_BASE_URL}/notifications/tokens/register`,
      { token: voipToken, platform: 'ios', tokenType: 'voip', deviceId },
    );
  } catch { /* Non-fatal — falls back to FCM-only call push. */ }
};

/**
 * Deactivates this installation's push registrations on both backends —
 * call before clearing local session state on logout or account deletion.
 * Was previously missing entirely: neither backend was ever told a device
 * signed out, so a stale token kept receiving pushes for that account
 * indefinitely (and, before the Nest-side upsert fix, could even collide
 * with a *different* account logging into the same device afterward).
 *
 * Best-effort and non-blocking by design — logout must not fail or hang
 * because a push-unregister call timed out.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const [deviceId, pushToken] = await Promise.all([
      AsyncStorage.getItem('device_id'),
      AsyncStorage.getItem('push_token'),
    ]);
    if (!deviceId && !pushToken) return;

    await Promise.all([
      postRequest(
        ROUTES.notifications.deviceTokenUnregister,
        { device_id: deviceId || undefined, push_token: pushToken || undefined },
      ).catch(() => {}),
      postRequest(
        `${NEST_API_BASE_URL}/notifications/tokens/unregister`,
        { token: pushToken || undefined, deviceId: deviceId || undefined },
      ).catch(() => {}),
    ]);
  } catch { /* Best-effort — local session cleanup proceeds regardless. */ }
}

/**
 * Re-associates whatever push/VoIP tokens this install already holds with
 * the CURRENTLY signed-in user — call this right after login completes.
 *
 * initPushHandlers() only ever registers tokens once, in a mount-time
 * effect that runs before any user is necessarily signed in. That's fine
 * for a fresh install's first login, but if a user logs out and a
 * DIFFERENT user logs into the same app session (no restart in between),
 * that one-time effect never re-fires — so the new user's login never
 * re-POSTs the token, and the backend keeps associating this device's
 * token with the PREVIOUS account until the FCM SDK happens to rotate the
 * token on its own (unpredictable, can be days). Both backends key
 * registration on the caller's authenticated user_id (see
 * DeviceTokensService.upsert in Nest, NotificationDeviceTokenViewSet in
 * Django), so re-POSTing on every login — not just once per app process —
 * is what actually reassigns a shared/reused device to its new owner.
 * Reads the already-known tokens back out of storage rather than
 * re-requesting permission or hitting Firebase again.
 */
export async function reregisterPushTokensForCurrentUser(): Promise<void> {
  try {
    const [fcmToken, apnsToken] = await Promise.all([
      AsyncStorage.getItem('fcm_token'),
      AsyncStorage.getItem('apns_token'),
    ]);
    if (fcmToken) {
      await registerPushToken({ pushToken: fcmToken, apnsToken });
    }
  } catch { /* silent — next token refresh or app restart will retry */ }

  if (Platform.OS === 'ios') {
    try {
      const VoipTokenModule = NativeModules?.VoipTokenModule;
      const voipToken = await VoipTokenModule?.getVoipToken?.();
      if (voipToken) await registerVoipPushToken(voipToken);
    } catch { /* Native module not present, or no VoIP token yet — no-op. */ }
  }
}

/**
 * Reads the VoIP token captured natively by AppDelegate.swift's
 * PKPushRegistryDelegate (via the VoipTokenModule bridge) and registers it,
 * then keeps it in sync on rotation. iOS-only — Android has no PushKit
 * equivalent (calls there ring via a high-priority FCM data message instead).
 */
const initVoipPushToken = () => {
  if (Platform.OS !== 'ios') return;
  try {
    const VoipTokenModule = NativeModules?.VoipTokenModule;
    if (!VoipTokenModule?.getVoipToken) return;

    VoipTokenModule.getVoipToken()
      .then((token: string | null) => {
        if (token) void registerVoipPushToken(token);
      })
      .catch(() => {});

    DeviceEventEmitter.addListener('KIS_VoIP_Token_Updated', (token: string) => {
      if (token) void registerVoipPushToken(token);
    });
  } catch { /* Native module not present in this build — no-op. */ }
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
    // Use the modular API to avoid deprecated namespaced calls. Import from
    // the package root, NOT a deep path like '<pkg>/lib/modular' — that path
    // predates @react-native-firebase's move to a strict package.json
    // "exports" map (v24+), which only allows the root entry point. Every
    // v26+ package re-exports the full modular API from its root already, so
    // the deep path isn't needed; it just throws "Cannot find module".
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appMod = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingMod = require('@react-native-firebase/messaging');

    const getApps = appMod?.getApps;
    const getApp = appMod?.getApp;
    const getMessaging = messagingMod?.getMessaging;
    const getToken = messagingMod?.getToken;
    const getAPNSToken = messagingMod?.getAPNSToken;
    const registerDeviceForRemoteMessages = messagingMod?.registerDeviceForRemoteMessages;
    const setBackgroundMessageHandler = messagingMod?.setBackgroundMessageHandler;
    const onMessage = messagingMod?.onMessage;
    const onNotificationOpenedApp = messagingMod?.onNotificationOpenedApp;
    const getInitialNotification = messagingMod?.getInitialNotification;
    const onTokenRefresh = messagingMod?.onTokenRefresh;

    if (
      typeof getApps !== 'function' ||
      typeof getApp !== 'function' ||
      typeof getMessaging !== 'function'
    ) {
      await reportDiag('modular-exports-missing');
      return;
    }

    const apps = getApps();
    if (!Array.isArray(apps) || apps.length === 0) {
      await reportDiag('no-firebase-app-registered');
      return;
    }

    const messaging = getMessaging(getApp());

    // Pulled out so it can be retried later (see the AppState listener
    // below), not just once at cold start. Deliberately does NOT call
    // requestPermission() itself — NotificationPermissionModal owns asking
    // for permission (with context, only on explicit user tap) so this
    // doesn't race a second, unexplained system dialog against it. This
    // just tries to fetch a token assuming permission may or may not be
    // granted yet; getToken()/getAPNSToken() fail harmlessly if it isn't,
    // and the AppState retry below picks it up once the user grants it
    // (via the modal or Settings) without needing a relaunch. Previously
    // this whole block was a bare catch{} with no logging — a device with
    // permission denied would register a VoIP token fine (PushKit doesn't
    // need notification authorization) but silently never get an FCM
    // token, with zero visibility into why.
    const attemptFcmTokenAcquisition = async (): Promise<boolean> => {
      try {
        // requestPermission() (removed above) used to also silently trigger
        // iOS's UIApplication.registerForRemoteNotifications() as a side
        // effect — that's a separate step from notification *authorization*
        // and is what actually gets an APNs device token assigned, which
        // FCM's getToken() needs to exchange for an FCM token. Asking for
        // authorization via react-native-permissions instead (in the modal)
        // has no knowledge of Firebase and never triggers this, so without
        // calling it explicitly here, getToken() would keep returning
        // nothing forever even with permission fully granted. Safe/idempotent
        // to call unconditionally — a no-op on Android and on repeat calls.
        if (typeof registerDeviceForRemoteMessages === 'function') {
          await registerDeviceForRemoteMessages(messaging);
        }

        // Registering doesn't mean the APNs device token has arrived yet —
        // that's a genuinely async round trip to Apple's servers (delivered
        // natively via didRegisterForRemoteNotificationsWithDeviceToken),
        // easily still in flight for a few seconds right after registering.
        // Poll briefly instead of giving up on the first null, so a single
        // attempt succeeds without needing the user to background/foreground
        // the app repeatedly to "get lucky" on the timing.
        let fcmToken: string | null = null;
        let apnsToken: string | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          fcmToken = typeof getToken === 'function' ? await getToken(messaging) : null;
          apnsToken =
            typeof getAPNSToken === 'function' ? await getAPNSToken(messaging) : null;
          if (fcmToken) break;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!fcmToken) {
          await reportDiag('no-token-after-retries');
          return false;
        }

        await AsyncStorage.setItem('fcm_token', fcmToken);
        await AsyncStorage.setItem('push_token', fcmToken);
        if (apnsToken) {
          await AsyncStorage.setItem('apns_token', apnsToken);
        }
        await retryPendingPushToken();
        await registerPushToken({ pushToken: fcmToken, apnsToken });
        await reportDiag('success');
        return true;
      } catch (e: any) {
        await reportDiag(`threw:${String(e?.message ?? e ?? 'unknown').slice(0, 150)}`);
        return false;
      }
    };

    const gotToken = await attemptFcmTokenAcquisition();

    // Self-heal without requiring a full app relaunch: the most common way
    // a user resolves "notification permission denied" is backgrounding
    // the app, granting it in Settings, then returning — retry then.
    if (!gotToken) {
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        AsyncStorage.getItem('fcm_token').then((existing) => {
          if (existing) {
            sub.remove();
            return;
          }
          attemptFcmTokenAcquisition().then((ok) => {
            if (ok) sub.remove();
          });
        });
      });
    }

    // PushKit VoIP token init is intentionally OUTSIDE the FCM try block above.
    // getToken() can legitimately throw here — iOS FCM requires an APNs token
    // to already be attached to FIRMessaging (see RNFBMessagingModule's
    // getToken), which arrives asynchronously from Apple and can easily still
    // be in flight this early in app launch. That's an FCM-only race; VoIP/
    // PushKit has nothing to do with Firebase and must not be skipped because
    // of it.
    initVoipPushToken();

    // A rotated FCM token was previously only ever picked up on the next
    // cold start (only getToken() at mount was read) — mid-session
    // rotation left both backends holding a dead token until the app
    // happened to restart. This keeps them in sync immediately.
    if (typeof onTokenRefresh === 'function') {
      onTokenRefresh(messaging, async (newToken: string) => {
        if (!newToken) return;
        try {
          await AsyncStorage.setItem('fcm_token', newToken);
          await AsyncStorage.setItem('push_token', newToken);
          const apnsToken =
            typeof getAPNSToken === 'function' ? await getAPNSToken(messaging) : null;
          await registerPushToken({ pushToken: newToken, apnsToken });
        } catch { /* silent — retryPendingPushToken picks it up next launch */ }
      });
    }

    // Background/killed message handler is registered eagerly at JS entry
    // (index.js, via registerBackgroundPushHandler()) so Android can invoke
    // it from a headless JS context even when the app process was fully
    // killed — a handler attached only here, inside initPushHandlers(),
    // would exist only after the app has already booted once and mounted
    // App.tsx, which is exactly the "backgrounded but still alive" case,
    // not the "killed" case. Re-registering here too is harmless (RNFB just
    // replaces the same handler reference) and keeps this path working
    // identically to before for the already-alive case.
    if (typeof setBackgroundMessageHandler === 'function') {
      setBackgroundMessageHandler(messaging, handleBackgroundPushMessage);
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
    await reportDiag(`outer-catch:${String(err?.message ?? err ?? 'unknown').slice(0, 150)}`);
  }
}
