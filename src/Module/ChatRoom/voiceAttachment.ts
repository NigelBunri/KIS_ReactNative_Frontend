// src/Module/ChatRoom/voiceAttachment.ts
//
// The one place a VoiceAttachment (see chatTypes.ts) gets built from an
// upload result, and the one place a playback URI gets resolved from a
// VoiceAttachment — so the sender's confirmed-send construction and the
// receiver's hydration/playback resolution can never drift into using
// different field names again (the root cause this whole module exists to
// prevent: `voice.uri` vs `voice.url`, and fields silently missing from
// the backend's persisted shape).

import type { AttachmentMeta } from './uploadFileToBackend';
import type { VoiceAttachment } from './chatTypes';

/**
 * Builds the canonical VoiceAttachment from a completed upload. Used by
 * ChatRoomHandlers.tsx's handleSendVoice immediately after
 * uploadFileToBackend resolves — this is the ONLY place a confirmed voice
 * message's `voice` field is constructed, so sender and (once persisted
 * and echoed back by Nest) receiver always read the same shape.
 */
export function buildVoiceAttachment(opts: {
  attachment: AttachmentMeta | null;
  localUri: string;
  durationMs: number;
}): VoiceAttachment {
  const { attachment, localUri, durationMs } = opts;
  const url = attachment?.url || attachment?.downloadUrl || attachment?.displayUrl || undefined;
  // Voice notes now upload direct-to-S3 through Nest (see
  // ChatRoomHandlers.tsx's handleSendVoice, which passes
  // baseUrl: NEST_API_BASE_URL) — Nest's response only carries `id` (the
  // UploadIntent.attachmentId), not assetId/mediaAssetId/mediaAssetRef
  // (those were Django MediaAsset field names, kept here only so old
  // server responses/cached rows from before this change still resolve).
  // This is the PERMANENT identity — never the expiring `url` itself —
  // that voicePlaybackResolver.ts sends to Nest's
  // GET /chat/messages/:messageId/voice/playback-url to get a fresh url.
  const mediaAssetId =
    attachment?.assetId || attachment?.mediaAssetId || attachment?.mediaAssetRef || attachment?.id || undefined;

  return {
    uri: url || localUri,
    url,
    mediaAssetId,
    // Nest's own attachment id doubles as the object-key lookup handle on
    // its side (VoicePlaybackService resolves it via UploadIntent); this
    // field is otherwise only used for backward-compat display. See
    // chatTypes.ts's VoiceAttachment.
    objectKey: mediaAssetId,
    id: attachment?.id,
    mimeType: attachment?.mimeType,
    fileName: attachment?.originalName,
    fileSize: attachment?.size,
    durationMs,
  };
}

/**
 * Resolves the best available playback URI for a voice attachment,
 * checking every place a valid URL might live — including the parallel
 * `attachments[0]` entry every voice message already carries (see
 * handleSendVoice), which acts as a redundant, independently-persisted
 * copy of the same URL. Returns null (not '') when nothing usable is
 * found, so callers can distinguish "still resolving" / "genuinely
 * unavailable" from a truthy-but-empty string.
 */
export function resolveEmbeddedVoicePlaybackUri(
  voice: VoiceAttachment | null | undefined,
  fallbackAttachmentUrl?: string | null,
): string | null {
  const candidate = voice?.localUri || voice?.url || voice?.uri || fallbackAttachmentUrl || null;
  if (!candidate) return null;
  // A bare objectKey/id (no scheme, no leading slash) is not a playable URI —
  // guards against `voice.uri` degrading to a non-URL value on old/partially-
  // migrated rows. A leading `/` is accepted because Django's upload/media
  // endpoints return relative paths (see resolveBackendAssetUrl in
  // src/network/index.tsx), which the caller resolves to absolute afterward —
  // rejecting them here (as this used to) meant every relative voice URL was
  // discarded before it ever reached that resolver, permanently classifying
  // the note as "unavailable" for both sender and receiver.
  if (!/^(https?|file|content):/i.test(candidate) && !candidate.startsWith('/')) return null;
  return candidate;
}

/**
 * Distinguishes "no playable url yet because the message is still being
 * sent/uploaded" from "genuinely missing/broken" so a receiver never sees a
 * "Cannot play this" failure for a voice note that simply hasn't finished
 * sending. Pure so MessageBubble.tsx's render logic can be unit tested
 * without mounting the component (which drags in react-native-video,
 * react-native-pdf, etc.).
 */
export type VoicePlaybackReadiness = 'ready' | 'resolving' | 'unavailable';

export function classifyVoicePlaybackReadiness(
  playbackUri: string | null,
  messageStatus: string | null | undefined,
): VoicePlaybackReadiness {
  if (playbackUri) return 'ready';
  if (messageStatus === 'local_only' || messageStatus === 'pending' || messageStatus === 'sending') {
    return 'resolving';
  }
  return 'unavailable';
}
