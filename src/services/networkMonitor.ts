// src/services/networkMonitor.ts
import NetInfo from '@react-native-community/netinfo';

export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch {
    // Fallback: assume offline if we can't determine
    return false;
  }
};
