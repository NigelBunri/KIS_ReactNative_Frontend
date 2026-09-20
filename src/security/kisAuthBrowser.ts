// Shared browser-launch helper for every KIS Auth flow (recovery, link,
// registration) — all three open the same kind of URL and need the same
// result handling, just with different purposes/screens on the other end.
//
// Uses react-native-inappbrowser-reborn's openAuth() (SFSafariViewController
// on iOS, Custom Tabs on Android) instead of Linking.openURL's full system
// browser. Two real problems that fixes:
//   1. openAuth() keeps the app process in the foreground/recent-apps list
//      for the OS's purposes, instead of fully backgrounding into a
//      separate browser app — the exact scenario that was losing the
//      in-memory expected-state ref if the JS context got reloaded.
//   2. It resolves the final redirect URL directly in JS, so a result is
//      available even if kis.app's universal link isn't verified on this
//      device yet (Linking.openURL's deep-link return depends entirely on
//      that verification succeeding).
//
// Falls back to Linking.openURL (the original mechanism, relying on the
// universal link) if InAppBrowser isn't available on this device/platform
// — the calling screen's existing deep-link handling covers that case.

import { Linking } from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

export type KisAuthOutcome =
  | { kind: 'success'; code: string; state: string }
  | { kind: 'error'; error: string; state: string }
  | { kind: 'cancelled' }
  // InAppBrowser wasn't available — caller opened the system browser via
  // Linking instead, and must rely on its existing deep-link route to
  // learn the outcome; there's nothing more to resolve here.
  | { kind: 'pending' };

function parseQueryParams(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of queryString.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
    const value = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : '';
    params[key] = value;
  }
  return params;
}

export function paramsFromUrl(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return {};
  // Strip any #fragment before parsing the query string.
  const query = url.slice(queryIndex + 1).split('#')[0];
  return parseQueryParams(query);
}

export async function launchKisAuthFlow(
  authorizeUrl: string,
  redirectUrlPrefix: string,
): Promise<KisAuthOutcome> {
  let available = false;
  try {
    available = await InAppBrowser.isAvailable();
  } catch {
    available = false;
  }

  if (available) {
    const result = await InAppBrowser.openAuth(authorizeUrl, redirectUrlPrefix, {
      ephemeralWebSession: true,
      modalEnabled: true,
      enableUrlBarHiding: true,
      showTitle: false,
    });
    if (result.type !== 'success') {
      return { kind: 'cancelled' };
    }
    const params = paramsFromUrl(result.url);
    const state = params.state ?? '';
    if (params.error) return { kind: 'error', error: params.error, state };
    if (params.code) return { kind: 'success', code: params.code, state };
    return { kind: 'cancelled' };
  }

  const canOpen = await Linking.canOpenURL(authorizeUrl);
  if (!canOpen) {
    throw new Error('Unable to open KIS Auth.');
  }
  await Linking.openURL(authorizeUrl);
  return { kind: 'pending' };
}
