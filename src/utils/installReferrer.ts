// src/utils/installReferrer.ts
// Android-only: reads the Google Play Install Referrer
// (android/.../InstallReferrerModule.kt) — the tamper-resistant
// counterpart to extractReferralCode's clipboard-based fallback
// (referralAttribution.ts). Google Play itself remembers the `referrer`
// query param used to reach the store listing (appended by the website's
// OpenInApp component only when it has an attribution code to carry) and
// hands it back here, once, shortly after first launch — unlike the
// clipboard value, this cannot be forged by whoever is installing the app.
//
// iOS has no equivalent native API; the clipboard mechanism in
// referralAttribution.ts is iOS's real attribution path, not a fallback
// for something better there.
import { NativeModules, Platform } from 'react-native';

// Mirrors `ref_code=<CODE>` as appended by OpenInApp.tsx
// (website repo) to the Play Store URL — the referrer string can also
// carry other UTM-style params (&utm_source=... etc.) ahead of or after
// this one, so this matches it anywhere in the string rather than
// requiring it to be the only param.
const REFERRER_CODE_PATTERN = /(?:^|[&?])ref_code=([A-Za-z0-9%]{1,32})/;

export function extractReferralCodeFromInstallReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const match = referrer.match(REFERRER_CODE_PATTERN);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]).toUpperCase();
    return /^[A-Z0-9]{6,10}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

// Each call opens and tears down its own InstallReferrerClient connection
// (see InstallReferrerModule.kt) — cheap enough to call more than once,
// but callers should still treat this as a once-per-install read and
// persist/consume the result immediately, same "clear after consumption"
// discipline as pendingCallPayload.ts elsewhere in this app, rather than
// re-querying Play on every app open.
export async function readReferralCodeFromInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const native = NativeModules.KISInstallReferrerModule;
  if (!native?.getInstallReferrer) {
    // Native binary hasn't been rebuilt with this module yet, or running
    // on an emulator/device with no Play Store — a best-effort attribution
    // aid, never a required step for registration.
    return null;
  }
  try {
    const referrer: string | null = await native.getInstallReferrer();
    return extractReferralCodeFromInstallReferrer(referrer);
  } catch {
    return null;
  }
}
