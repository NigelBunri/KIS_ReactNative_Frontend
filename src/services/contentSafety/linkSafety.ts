/**
 * On-device link safety check — flags links to known illicit-content
 * sites before a chat message is sent, without ever contacting a server
 * or inspecting message content remotely (same privacy rationale as
 * onDeviceImageScan.ts: for chat, this on-device check is the only
 * safety layer that can ever exist).
 *
 * Unlike image/video scanning this needs no ML model and is NOT inert:
 * a static, local blocklist of known adult-content hostnames/keywords
 * is a real, working check today. Like every other check in this
 * module family it fails OPEN — a link that isn't on the list is never
 * blocked, and a malformed/unparsable URL is never blocked either, since
 * this is a deterrent layer, not the enforcement backstop.
 */

// Lowercased hostname substrings. Deliberately coarse (well-known adult
// sites + generic explicit-content keywords) rather than exhaustive —
// this catches the obvious/common case cheaply on-device; it is not a
// comprehensive threat-intel feed.
const BLOCKED_HOST_KEYWORDS = [
  'pornhub',
  'xvideos',
  'xnxx',
  'xhamster',
  'redtube',
  'youporn',
  'brazzers',
  'chaturbate',
  'livejasmin',
  'stripchat',
  'spankbang',
  'onlyfans',
  'fansly',
  'adultfriendfinder',
  'porn',
  'xxx',
  'nsfw',
  'nude',
  'hentai',
  'camgirl',
  'escort',
];

// Matches server-side/on-device wording conventions - see
// onDeviceImageScan.ts's ON_DEVICE_BLOCK_MESSAGE.
export const LINK_BLOCK_MESSAGE =
  'This link cannot be sent. KIS is a Christian, family-safe platform and does not allow links to pornographic, sexually explicit, or unsafe content.';

/** First http(s) URL found in free-form text, or null. Shares the exact
 * pattern MessageComposer.tsx already uses for its link-preview fetch. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
  return match?.[0] ?? null;
}

export function isLinkSuspicious(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return BLOCKED_HOST_KEYWORDS.some((keyword) => host.includes(keyword));
}
