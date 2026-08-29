// src/services/auth/restoreCredentials.ts
//
// JS side of Android's Restore Credentials feature (Google Play's
// "Zero-Tap Sign-In" quality requirement). This module only shuttles
// WebAuthn JSON between the native KISRestoreCredentialModule
// (android/app/src/main/java/com/kingdom/impact/RestoreCredentialModule.kt,
// a thin wrapper around androidx.credentials.CredentialManager) and
// Django's apps/accounts/webauthn_restore.py, which does the actual
// challenge generation and signature verification. No cryptography and no
// account-trust decisions happen here or in the native module — this file
// is pure plumbing between two things that already trust each other.
//
// Android only. iOS has no Restore Credentials equivalent (nor does Google
// Play require one there — this is an Android Play Console requirement),
// so every function here is a safe no-op on iOS.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

const { KISRestoreCredentialModule } = NativeModules;

const isSupported = () =>
  Platform.OS === 'android' &&
  !!KISRestoreCredentialModule?.saveRestoreCredential &&
  !!KISRestoreCredentialModule?.getRestoreCredential;

/**
 * Call once, right after a normal password login succeeds on the user's
 * CURRENT device. Fire-and-forget by design: if this fails for any reason
 * (no screen lock configured, Play services unavailable, network error),
 * password login has already fully succeeded and nothing about the current
 * session is affected — the user will simply need to type their password
 * again the next time they migrate to a new device, exactly as today.
 */
export async function saveRestoreCredentialAfterLogin(deviceId: string | null | undefined): Promise<void> {
  if (!isSupported()) return;
  try {
    const optionsRes = await postRequest(ROUTES.auth.restoreCredentialRegistrationOptions, {}, {
      errorMessage: 'Could not prepare restore credential.',
    });
    const state = optionsRes?.data?.state;
    const options = optionsRes?.data?.options;
    if (!optionsRes?.success || !state || !options) return;

    const requestJson = typeof options === 'string' ? options : JSON.stringify(options);
    const registrationResponseJson = await KISRestoreCredentialModule.saveRestoreCredential(requestJson);
    if (!registrationResponseJson) return;

    await postRequest(
      ROUTES.auth.restoreCredentialRegister,
      {
        state,
        credential: JSON.parse(registrationResponseJson),
        device_id: deviceId || null,
      },
      { errorMessage: 'Could not save restore credential.' },
    );
  } catch {
    // Deliberately swallowed — see function doc comment above.
  }
}

/**
 * Call once at app startup, BEFORE deciding to show the login screen (see
 * App.tsx's checkAuth — this runs only in the "no access token stored"
 * branch, since a device with an existing session has nothing to restore).
 * Returns the same {access, refresh, user} shape LoginScreen's login call
 * returns on success, so the caller can persist it identically; returns
 * null whenever there is nothing to restore (by far the most common
 * outcome — most launches are not a device migration) or anything along
 * the way fails, which the caller should treat identically to "no restore
 * credential available" and fall through to the normal login screen.
 */
export async function tryRestoreCredentialLogin(): Promise<{
  access?: string;
  refresh?: string;
  user?: any;
} | null> {
  if (!isSupported()) return null;
  try {
    const startRes = await postRequest(ROUTES.auth.restoreCredentialAuthenticationOptions, {}, {
      errorMessage: 'Could not check for a restorable session.',
    });
    const state = startRes?.data?.state;
    const options = startRes?.data?.options;
    if (!startRes?.success || !state || !options) return null;

    const authenticationJson = typeof options === 'string' ? options : JSON.stringify(options);
    const authenticationResponseJson = await KISRestoreCredentialModule.getRestoreCredential(authenticationJson);
    if (!authenticationResponseJson) return null; // no restore credential on this device — normal, not an error

    const deviceId = await AsyncStorage.getItem('device_id');
    const authRes = await postRequest(
      ROUTES.auth.restoreCredentialAuthenticate,
      {
        state,
        credential: JSON.parse(authenticationResponseJson),
        device_id: deviceId,
        device_platform: Platform.OS,
      },
      { errorMessage: 'Could not restore your session.' },
    );
    if (!authRes?.success || !authRes?.data?.access) return null;
    return authRes.data;
  } catch {
    return null;
  }
}

/** Call on explicit sign-out so a stale restore credential can't silently re-authenticate the next person to use this device. */
export async function clearRestoreCredential(): Promise<void> {
  if (!isSupported() || !KISRestoreCredentialModule?.clearRestoreCredential) return;
  try {
    await KISRestoreCredentialModule.clearRestoreCredential();
  } catch {
    // Non-fatal — sign-out itself already clears the local session either way.
  }
}
