import { NativeModules, Platform } from 'react-native';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

const { KISSimInfoModule } = NativeModules;

/**
 * Best-effort read of this device's own SIM phone number. Android only —
 * iOS has no API for an app to read its own device's number, so this always
 * resolves null there. Even on Android, many carriers/OEMs don't expose it,
 * so a null result means "unknown", never "no SIM" or "verification failed".
 */
export async function getSimPhoneNumber(): Promise<string | null> {
  if (Platform.OS !== 'android' || !KISSimInfoModule?.getSimPhoneNumber) {
    return null;
  }
  try {
    const permission =
      Platform.Version >= 26
        ? PERMISSIONS.ANDROID.READ_PHONE_NUMBERS
        : PERMISSIONS.ANDROID.READ_PHONE_STATE;

    let permissionStatus = await check(permission);
    if (permissionStatus !== RESULTS.GRANTED) {
      permissionStatus = await request(permission);
    }
    if (permissionStatus !== RESULTS.GRANTED) return null;

    const number = await KISSimInfoModule.getSimPhoneNumber();
    return typeof number === 'string' && number.trim() ? number.trim() : null;
  } catch {
    return null;
  }
}
