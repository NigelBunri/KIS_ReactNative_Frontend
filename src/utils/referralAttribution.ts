// Clipboard-based referral-code attribution: the "existing clipboard/
// manual-code fallback" mechanism for install attribution. A deep link
// clicked before the app is installed loses its token entirely across the
// App/Play Store install boundary (no Universal Links/App Links pass
// through an install) - the website's OpenInApp component (attributionCode
// prop) writes the referral code to the clipboard immediately before
// sending a not-yet-installed visitor to the store, so the freshly
// installed app can recover it here on first launch, no native
// install-referrer dependency required on either platform.
//
// Deliberately permissive: 6-10 uppercase alphanumeric characters, not
// hardcoded to today's exact 8-char length (apps.referrals.models.
// _CODE_LENGTH) - a resilience margin against a future length change on
// the backend, not a security boundary (an unknown code is simply a no-op
// at registration, per apps.referrals.services.register_referral).
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,10}$/;
const REFERRAL_LINK_PATTERN = /\/join\/referral\/([A-Za-z0-9]{6,10})(?:[/?#]|$)/;

export function extractReferralCode(clipboardText: string | null | undefined): string | null {
  const trimmed = (clipboardText || '').trim();
  if (!trimmed) return null;

  const linkMatch = trimmed.match(REFERRAL_LINK_PATTERN);
  if (linkMatch) return linkMatch[1].toUpperCase();

  const bare = trimmed.toUpperCase();
  if (REFERRAL_CODE_PATTERN.test(bare)) return bare;

  return null;
}

export async function readReferralCodeFromClipboard(): Promise<string | null> {
  try {
    // Lazy import: this module is pulled in by RegisterScreen on every
    // app cold start via the auth flow, but the clipboard native module
    // is only ever actually touched here, once, at first registration.
    const Clipboard = require('@react-native-clipboard/clipboard').default;
    const text: string = await Clipboard.getString();
    return extractReferralCode(text);
  } catch {
    // Clipboard access can fail (permission prompts on some Android
    // versions, no clipboard content, simulator quirks) - this is a
    // best-effort attribution aid, never a required step for registration.
    return null;
  }
}
