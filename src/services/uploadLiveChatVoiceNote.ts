// src/services/uploadLiveChatVoiceNote.ts
//
// Upload helper for a live-chat voice note. Mirrors
// src/services/uploadTestimonyMedia.ts's three-step handshake (initiate ->
// PUT to S3 -> confirm) and reuses the exact same upload-id resolution
// logic every other upload surface uses (src/network/uploadIntentContract.ts)
// - a storage key is never used as the confirm id here either. No
// compression step (audio, not an image).
//
// Backend: apps/media/upload_intent.py's "live_chat_voice_note" context
// (key_prefix "broadcast_videos/live_chat_voice", max 5MB default) - see
// apps/broadcasts/views.py's ChannelLiveStreamChatHistoryView.post()
// VOICE_NOTE branch, which resolves the confirmed intent via
// resolve_confirmed_intent(expected_context="live_chat_voice_note").
// Callers pass the resulting `mediaId` as `media_id` in that POST body.

import RNFS from 'react-native-fs';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const S3_UPLOAD_TIMEOUT_MS = 2 * 60 * 1000; // voice notes are short - 2 min is generous

async function resolveFileSize(uri: string): Promise<number> {
  try {
    const stat = await RNFS.stat(uri.replace(/^file:\/\//, ''));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

function uploadBytesToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; type: string },
  headers: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.timeout = S3_UPLOAD_TIMEOUT_MS;
    Object.entries(headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, String(value));
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (__DEV__) {
        console.error('[uploadLiveChatVoiceNote] S3 PUT rejected', {
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 300),
        });
      }
      reject(new Error('Upload to storage failed. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.send({ uri: file.uri, type: file.type, name: 'voice_note.m4a' } as any);
  });
}

/**
 * Uploads a recorded voice note (HoldToLockComposer's onSendVoice payload)
 * and returns a confirmed, stable `mediaId` - never a storage key, never
 * a raw file. Caller passes that mediaId + durationSeconds as
 * message_type=voice_note&media_id=...&duration_seconds=... on
 * POST .../live-streams/:id/chat/. Throws on any failure.
 */
export async function uploadLiveChatVoiceNote(opts: {
  uri: string;
  durationMs: number;
}): Promise<{ mediaId: string; durationSeconds: number }> {
  const { uri, durationMs } = opts;
  const size = await resolveFileSize(uri);
  const type = 'audio/m4a';

  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    {
      context: 'live_chat_voice_note',
      filename: `voice_note_${Date.now()}.m4a`,
      content_type: type,
      size_bytes: size,
    },
    { errorMessage: 'Unable to start upload.' },
  );
  if (!initiateRes?.success) {
    throw new Error(initiateRes?.message || 'Unable to start upload.');
  }
  const { uploadId, uploadUrl, headers } = resolveUploadIntent(initiateRes.data);

  await uploadBytesToPresignedUrl(uploadUrl, { uri, type }, headers || { 'Content-Type': type });

  const confirmRes = await postRequest(
    `${API_BASE_URL}${buildDjangoMediaConfirmPath(uploadId)}`,
    {},
    { errorMessage: 'Unable to confirm upload.' },
  );
  if (!confirmRes?.success) {
    throw new Error(confirmRes?.message || 'Unable to confirm upload.');
  }

  const data = confirmRes.data || {};
  return {
    mediaId: String(data.mediaId ?? data.upload_id ?? uploadId),
    durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
  };
}
