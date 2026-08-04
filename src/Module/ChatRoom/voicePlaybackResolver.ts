// src/Module/ChatRoom/voicePlaybackResolver.ts
//
// Refreshes an expired/expiring voice-note playback URL via
// GET /chat/messages/:messageId/voice/playback-url (Nest's
// VoicePlaybackService — see backend/Nestjs/src/chat/features/messages).
// One module-level cache + in-flight-request dedup shared by every
// MessageBubble instance, so replaying the same note twice, or two bubbles
// racing to resolve the same message, never fires two network requests.
//
// Deliberately in-memory only (a plain Map, not AsyncStorage) — a signed
// playback URL is short-lived by design and must never be treated as
// permanent data; see chatTypes.ts's VoiceAttachment for the field that
// actually IS permanent (mediaAssetId).

import { NEST_API_BASE_URL } from '@/network';
import { getAccessToken } from '@/security/authStorage';

export type ResolvedVoiceUrl = { url: string; expiresAt: string };

export type VoicePlaybackErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'unavailable';

export class VoicePlaybackError extends Error {
  readonly kind: VoicePlaybackErrorKind;
  constructor(kind: VoicePlaybackErrorKind, message: string) {
    super(message);
    this.name = 'VoicePlaybackError';
    this.kind = kind;
  }
}

// Refresh this long before the server-reported expiry actually hits, so a
// slow network/decode doesn't start playback on a URL that expires mid-play.
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

const cache = new Map<string, ResolvedVoiceUrl>();
const inFlight = new Map<string, Promise<ResolvedVoiceUrl>>();

function isFresh(entry: ResolvedVoiceUrl | undefined): entry is ResolvedVoiceUrl {
  if (!entry) return false;
  const expiresAtMs = new Date(entry.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return false;
  return expiresAtMs - EXPIRY_SAFETY_MARGIN_MS > Date.now();
}

/** Non-blocking check — never triggers a network call. */
export function cachedVoicePlaybackUrl(messageId: string): ResolvedVoiceUrl | null {
  const entry = cache.get(messageId);
  return isFresh(entry) ? entry : null;
}

/**
 * Seeds the cache from a value the message itself already carries (e.g. the
 * sender's own just-uploaded url, or a value echoed back from the server
 * with urlExpiresAt) — so a fresh send doesn't need a round-trip just to
 * play back what was just recorded.
 */
export function primeVoicePlaybackCache(messageId: string, resolved: ResolvedVoiceUrl): void {
  if (!messageId || !resolved?.url || !resolved?.expiresAt) return;
  cache.set(messageId, resolved);
}

export function clearVoicePlaybackCache(messageId: string): void {
  cache.delete(messageId);
  inFlight.delete(messageId);
}

/**
 * Resolves a fresh playback URL, deduplicating concurrent callers for the
 * same messageId and reusing an unexpired cached value. Pass `force: true`
 * after a playback failure that might mean the cached URL is stale (e.g.
 * player error immediately after starting) to bypass the cache once.
 */
export async function resolveFreshVoicePlaybackUrl(
  messageId: string,
  opts: { force?: boolean } = {},
): Promise<ResolvedVoiceUrl> {
  if (!messageId) {
    throw new VoicePlaybackError('not_found', 'This voice message is no longer available.');
  }

  if (!opts.force) {
    const cached = cache.get(messageId);
    if (isFresh(cached)) return cached;
  }

  const pending = inFlight.get(messageId);
  if (pending) return pending;

  const promise = (async (): Promise<ResolvedVoiceUrl> => {
    const token = await getAccessToken();
    if (!token) {
      throw new VoicePlaybackError('unauthorized', 'You need to be signed in to play this voice message.');
    }

    let response: Response;
    try {
      response = await fetch(
        `${NEST_API_BASE_URL}/chat/messages/${encodeURIComponent(messageId)}/voice/playback-url`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch {
      throw new VoicePlaybackError('network', 'Could not reach the server. Check your connection and try again.');
    }

    if (response.status === 401) {
      throw new VoicePlaybackError('unauthorized', 'Your session expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new VoicePlaybackError('forbidden', 'You do not have access to this voice message.');
    }
    if (response.status === 404) {
      throw new VoicePlaybackError('not_found', 'This voice message is no longer available.');
    }
    if (!response.ok) {
      throw new VoicePlaybackError('unavailable', 'Unable to load this voice message. Please try again.');
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new VoicePlaybackError('unavailable', 'Unable to load this voice message. Please try again.');
    }

    const resolved: ResolvedVoiceUrl = { url: String(json?.url ?? ''), expiresAt: String(json?.expiresAt ?? '') };
    if (!resolved.url) {
      throw new VoicePlaybackError('unavailable', 'Unable to load this voice message. Please try again.');
    }

    cache.set(messageId, resolved);
    return resolved;
  })();

  inFlight.set(messageId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(messageId);
  }
}

/** User-facing text for a failed resolution/playback attempt. Pure and
 * exported so it's unit-testable without mounting MessageBubble. */
export function describeVoicePlaybackError(error: unknown): string {
  if (error instanceof VoicePlaybackError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'Please sign in again to play this voice message.';
      case 'forbidden':
        return 'You do not have access to this voice message.';
      case 'not_found':
        return 'This voice message is no longer available.';
      case 'network':
        return 'Check your connection and try again.';
      default:
        return 'Unable to play this voice message. Please try again.';
    }
  }
  return 'Unable to play this voice message. Please try again.';
}
