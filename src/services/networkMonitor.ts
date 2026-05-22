// src/services/networkMonitor.ts
import NetInfo from '@react-native-community/netinfo';

export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch {
    return false;
  }
};

/**
 * Subscribe to network recovery (offline → online transitions).
 * Returns an unsubscribe function.
 *
 * Usage:
 *   const unsub = onNetworkRecovery(() => flushQueue());
 *   // later:
 *   unsub();
 */
export const onNetworkRecovery = (callback: () => void): (() => void) => {
  let wasOnline = true;
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = !!(state.isConnected && state.isInternetReachable !== false);
    if (online && !wasOnline) callback();
    wasOnline = online;
  });
  return unsubscribe;
};
