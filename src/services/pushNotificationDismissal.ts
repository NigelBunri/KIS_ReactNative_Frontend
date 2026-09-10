// src/services/pushNotificationDismissal.ts
//
// Dismisses OS-tray push notifications for a conversation once the user has
// actually read it in-app - the real gap behind "I read the message in the
// app without tapping the notification, and the notification is still
// sitting there." Message pushes are FCM `notification`-keyed payloads the
// OS displays automatically (see notifications.ts's own comment on this);
// nothing in this app could previously reach back into the OS notification
// tray to cancel one at all - @notifee/react-native is the first dependency
// that can.
//
// No backend or display-pipeline change was needed to make this work:
// notifee's getDisplayedNotifications()/cancelDisplayedNotification() work
// at the OS level (NotificationManager.getActiveNotifications() on Android,
// UNUserNotificationCenter.getDeliveredNotifications() on iOS) - they see
// and can cancel EVERY notification currently shown for this app, including
// ones FCM's own SDK auto-displayed, not just ones notifee itself created.
// conversationId already rides along in every message push's data payload
// (notifyNewMessage/notifyIncomingCall/notifyMissedCall in
// notifications.service.ts) - this just reads it back and matches.

// Optional-dependency require-in-try/catch, matching the rest of src/push/'s
// convention for native modules - also keeps a static import of a native
// module out of the Jest module graph, which would otherwise throw at
// import time in the test environment (no native side to initialize there).
async function getNotifee(): Promise<any | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@notifee/react-native');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

function matchesConversation(data: Record<string, any> | undefined, conversationId: string): boolean {
  if (!data) return false;
  const candidate = data.conversationId ?? data.conversation_id;
  return candidate != null && String(candidate) === String(conversationId);
}

/** Cancels every currently-displayed OS notification whose payload belongs
 * to this conversation. Call after the user reads a conversation in-app
 * (chat opened, or a read receipt fires) regardless of whether they got
 * there by tapping the notification itself. Best-effort: a failed dismiss
 * just leaves the tray notification sitting there, not a functional break,
 * so every failure mode here is swallowed rather than surfaced. */
export async function dismissNotificationsForConversation(conversationId: string): Promise<void> {
  if (!conversationId) return;
  try {
    const notifee = await getNotifee();
    if (!notifee?.getDisplayedNotifications || !notifee?.cancelDisplayedNotification) return;
    const displayed = await notifee.getDisplayedNotifications();
    const matches = (displayed ?? []).filter((entry: any) =>
      matchesConversation(entry?.notification?.data, conversationId),
    );
    await Promise.all(
      matches.map((entry: any) => notifee.cancelDisplayedNotification(entry.id).catch(() => {})),
    );
  } catch {
    /* best-effort */
  }
}

/** Cancels every currently-displayed OS notification for this app outright.
 * Used sparingly (logout) since it can't distinguish read from unread. */
export async function dismissAllNotifications(): Promise<void> {
  try {
    const notifee = await getNotifee();
    if (!notifee?.cancelAllNotifications) return;
    await notifee.cancelAllNotifications();
  } catch {
    /* best-effort */
  }
}
