// src/services/backgroundCallHandler.ts
// Firebase background message handler for incoming calls when app is in background/killed.
// Register this via messaging().setBackgroundMessageHandler() in index.js.
//
// Note: @notifee/react-native is not installed in this project.
// We use an AsyncStorage-based approach: store the pending call payload so that
// when the app opens and the socket connects, the call.offer event arrives naturally
// and is handled by SocketProvider. The stored entry is cleared on connect.

import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: This runs in a headless JS task — no React hooks.
export async function handleBackgroundCallMessage(message: any) {
  const data = message?.data ?? {};
  if (data.type !== 'incoming_call') return;
  // Store the pending call notification with a timestamp so SocketProvider can
  // check if it is still recent (within 60 seconds) when the app opens.
  await AsyncStorage.setItem(
    'kis.pending_call_notification',
    JSON.stringify({ ...data, timestamp: Date.now() }),
  );
}
