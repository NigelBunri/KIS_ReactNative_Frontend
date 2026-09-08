// src/services/uploadChannelContentVideo.ts
//
// Uploads a video and attaches it to a channel's ChannelContent library,
// which queues the real kisvideo transcode pipeline server-side. Mirrors
// uploadStatusMedia.ts/uploadMarketplaceMedia.ts's three-step handshake
// (initiate -> PUT to S3 -> confirm) and reuses the same upload-id
// resolution/validation logic every other upload surface uses
// (src/network/uploadIntentContract.ts) - a storage key is never used as
// the confirm id here either.
//
// This is NOT built on uploadFileToBackend.ts (src/Module/ChatRoom) even
// though that file also has a "signed URL" path - that path is gated by
// isNestChatBackend(baseUrl) and hardcodes Nest's own /uploads/initiate
// route, neither of which matches Django's generic
// POST /api/v1/media/uploads/initiate/ this uses instead (apps/media/
// upload_intent.py, context=channel_content_video - see
// apps/media/views.py's MediaUploadInitiateView, confirmed live against
// the real endpoint from the website's already-verified-in-production
// creator-studio upload flow). Reusing the chat function here would have
// silently 404'd on the initiate call.
//
// Unlike status/marketplace media, a channel video needs a ChannelContent
// row to attach to first (POST .../channels/{channelId}/contents/), and
// the confirmed upload's storageKey (never its uploadId) is what gets
// attached via POST .../channel-contents/{contentId}/assets/ - that call
// is what actually queues the kisvideo transcode job server-side (see
// apps.broadcasts.views.ChannelContentAssetUploadView on the backend).
// Content is created as a draft and stays a draft through processing -
// callers own polling channel-contents/{id}/ for the attached asset's
// processing_status until it reaches ready/failed, and the separate
// explicit publish call (POST .../channel-contents/{id}/publish/) once
// the creator is ready - this function only gets the video from the
// device onto a draft, it never publishes anything itself.

import RNFS from 'react-native-fs';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const S3_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export type ChannelVideoUploadStatus =
  | 'creating'
  | 'initiating'
  | 'uploading'
  | 'confirming'
  | 'attaching'
  | 'done';
export type ChannelVideoUploadProgress = { status: ChannelVideoUploadStatus; progress: number };

export type ChannelVideoUploadResult = {
  contentId: string;
  assetId: string;
  processingStatus: string;
};

type PickedFile = { uri: string; name?: string | null; type?: string | null; size?: number | null };

// Some pickers (e.g. a hand-built recorder output object) never carry a
// size field - without this, size_bytes would be sent as 0 and the
// backend's initiate validation (size_bytes must be > 0) would reject
// the upload. Same fallback uploadStatusMedia.ts uses for audio statuses.
async function resolveFileSize(uri: string, declaredSize?: number | null): Promise<number> {
  if (declaredSize && declaredSize > 0) return declaredSize;
  try {
    const stat = await RNFS.stat(uri.replace(/^file:\/\//, ''));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

// XHR (not fetch) so progress is observable via xhr.upload.onprogress, and
// so an AbortSignal can actually cancel an in-flight upload - same pattern
// as uploadStatusMedia.ts/uploadMarketplaceMedia.ts.
function uploadBytesToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; type: string },
  headers: Record<string, unknown>,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.timeout = S3_UPLOAD_TIMEOUT_MS;
    Object.entries(headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, String(value));
    });
    // No Authorization header - the presigned URL query string is the only
    // credential S3 sees, never the app's Django bearer token.
    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' }));
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (__DEV__) {
        console.error('[uploadChannelContentVideo] S3 PUT rejected', {
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 300),
        });
      }
      reject(new Error('Upload to storage failed. Please try again.'));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Upload failed. Please check your connection and try again.'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('Upload timed out. Please try again on a stronger connection.'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' }));
    };
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(0.99, Math.max(0, event.loaded / event.total)));
      };
    }
    xhr.send({ uri: file.uri, type: file.type, name: 'upload' } as any);
  });
}

/**
 * Creates a draft ChannelContent row, uploads a video to it, and attaches
 * it as the content's video asset - which queues the real kisvideo
 * transcode job server-side. Throws on any failure; the caller owns
 * retry (just call this again - it creates a fresh draft each time, so a
 * retry after a failed attach should reuse the returned contentId via a
 * direct call to the assets endpoint rather than calling this function
 * again, to avoid orphaning duplicate drafts) and duplicate-tap
 * prevention (disable the upload control while a call is in flight).
 */
export async function uploadChannelContentVideo(opts: {
  channelId: string;
  title: string;
  textPlain?: string;
  file: PickedFile;
  onProgress?: (update: ChannelVideoUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<ChannelVideoUploadResult> {
  const { channelId, title, textPlain, file, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  onProgress?.({ status: 'creating', progress: 0 });
  const createRes = await postRequest(
    ROUTES.broadcasts.channelContents(channelId),
    { title, text_plain: textPlain || '', content_type: 'video' },
    { errorMessage: 'Unable to create draft.' },
  );
  if (!createRes?.success) {
    throw new Error(createRes?.message || 'Unable to create draft.');
  }
  const contentId = String(createRes.data?.id);
  throwIfAborted();

  const size = await resolveFileSize(file.uri, file.size);
  const mimeType = file.type || 'video/mp4';
  const name = file.name || `video_${Date.now()}.mp4`;

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    { context: 'channel_content_video', filename: name, content_type: mimeType, size_bytes: size },
    { errorMessage: 'Unable to start upload.' },
  );
  if (!initiateRes?.success) {
    throw new Error(initiateRes?.message || 'Unable to start upload.');
  }
  const { uploadId, uploadUrl, headers, storageKey } = resolveUploadIntent(initiateRes.data);
  if (!storageKey) {
    throw new Error('Upload did not return a storage location.');
  }
  throwIfAborted();

  onProgress?.({ status: 'uploading', progress: 0 });
  await uploadBytesToPresignedUrl(
    uploadUrl,
    { uri: file.uri, type: mimeType },
    headers || { 'Content-Type': mimeType },
    (ratio) => onProgress?.({ status: 'uploading', progress: ratio }),
    signal,
  );
  throwIfAborted();

  onProgress?.({ status: 'confirming', progress: 1 });
  const confirmRes = await postRequest(
    `${API_BASE_URL}${buildDjangoMediaConfirmPath(uploadId)}`,
    {},
    { errorMessage: 'Unable to confirm upload.' },
  );
  if (!confirmRes?.success) {
    throw new Error(confirmRes?.message || 'Unable to confirm upload.');
  }
  throwIfAborted();

  onProgress?.({ status: 'attaching', progress: 1 });
  const assetRes = await postRequest(
    ROUTES.broadcasts.channelContentAssets(contentId),
    { asset_type: 'video', storage_path: storageKey, mime_type: mimeType },
    { errorMessage: 'Unable to attach video.' },
  );
  if (!assetRes?.success) {
    throw new Error(assetRes?.message || 'Unable to attach video.');
  }

  onProgress?.({ status: 'done', progress: 1 });
  return {
    contentId,
    assetId: String(assetRes.data?.id),
    processingStatus: String(assetRes.data?.processing_status || 'queued'),
  };
}
