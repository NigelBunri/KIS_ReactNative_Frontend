// src/services/uploadTestimonyMedia.ts
//
// Upload helper for a testimony's optional video/file attachment. Mirrors
// src/services/uploadStatusMedia.ts's three-step handshake (initiate -> PUT
// to S3 -> confirm) and reuses the exact same upload-id resolution logic
// every other upload surface uses (src/network/uploadIntentContract.ts) —
// a storage key is never used as the confirm id here either.
//
// No pre-existing target to authorize against (same as status media), so
// this calls the generic POST /api/v1/media/uploads/initiate/ directly with
// context=testimony_media — see apps/media/upload_intent.py +
// apps/testimony/media.py on the backend. Callers pass the resulting
// `mediaId` as `resource_attachment: { media_id: mediaId }` on
// POST/PATCH /testimonies/ (UserTestimonySerializer) — never the storage key.

import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 85;
const S3_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export type TestimonyMediaMeta = {
  mediaId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type TestimonyUploadStatus = 'compressing' | 'initiating' | 'uploading' | 'confirming' | 'done';
export type TestimonyUploadProgress = { status: TestimonyUploadStatus; progress: number };

type PickedFile = { uri: string; name?: string | null; type?: string | null; size?: number | null };
type PreparedFile = { uri: string; name: string; type: string; size: number };

const isCompressibleImage = (type?: string | null) => {
  const t = String(type || '').toLowerCase();
  return t.startsWith('image/') && !t.includes('gif');
};

const withJpegExtension = (name: string) => (name || `testimony_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg';

async function resolveFileSize(uri: string, declaredSize?: number | null): Promise<number> {
  if (declaredSize && declaredSize > 0) return declaredSize;
  try {
    const stat = await RNFS.stat(uri.replace(/^file:\/\//, ''));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

// Images get resized/re-encoded on-device same as every other image upload
// surface; video/PDF/doc attachments pass through untouched — no
// compression/transcoding pipeline exists for those in this codebase.
async function prepareFile(file: PickedFile): Promise<PreparedFile> {
  if (!isCompressibleImage(file.type)) {
    const size = await resolveFileSize(file.uri, file.size);
    return {
      uri: file.uri,
      name: file.name || `testimony_${Date.now()}`,
      type: file.type || 'application/octet-stream',
      size,
    };
  }
  const resized = await ImageResizer.createResizedImage(
    file.uri, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, 'JPEG', JPEG_QUALITY, 0,
  );
  const uri = (resized as any)?.uri ?? (resized as any)?.path;
  const size = Number((resized as any)?.size) || 0;
  if (!uri || size <= 0) {
    throw new Error('Unable to prepare this image. Please try a different photo.');
  }
  return { uri, name: withJpegExtension(file.name || ''), type: 'image/jpeg', size };
}

// XHR (not fetch) so progress is observable via xhr.upload.onprogress, and
// so an AbortSignal can actually cancel an in-flight upload.
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
        console.error('[uploadTestimonyMedia] S3 PUT rejected', {
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
 * Uploads a testimony's video/file attachment and returns a confirmed,
 * stable `mediaId` — never a storage key, never a raw file. Callers pass
 * that mediaId as `resource_attachment: { media_id: mediaId }` on the
 * testimony create/update request. Throws on any failure; the caller owns
 * retry (just call this again) and duplicate-tap prevention (disable the
 * submit control while a call is in flight).
 */
export async function uploadTestimonyMedia(opts: {
  file: PickedFile;
  onProgress?: (update: TestimonyUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<TestimonyMediaMeta> {
  const { file, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  onProgress?.({ status: 'compressing', progress: 0 });
  const prepared = await prepareFile(file);
  throwIfAborted();

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    {
      context: 'testimony_media',
      filename: prepared.name,
      content_type: prepared.type,
      size_bytes: prepared.size,
    },
    { errorMessage: 'Unable to start upload.' },
  );
  if (!initiateRes?.success) {
    throw new Error(initiateRes?.message || 'Unable to start upload.');
  }
  const { uploadId, uploadUrl, headers } = resolveUploadIntent(initiateRes.data);
  throwIfAborted();

  onProgress?.({ status: 'uploading', progress: 0 });
  await uploadBytesToPresignedUrl(
    uploadUrl,
    { uri: prepared.uri, type: prepared.type },
    headers || { 'Content-Type': prepared.type },
    (ratio) => onProgress?.({ status: 'uploading', progress: ratio }),
    signal,
  );

  onProgress?.({ status: 'confirming', progress: 1 });
  const confirmRes = await postRequest(
    `${API_BASE_URL}${buildDjangoMediaConfirmPath(uploadId)}`,
    {},
    { errorMessage: 'Unable to confirm upload.' },
  );
  if (!confirmRes?.success) {
    throw new Error(confirmRes?.message || 'Unable to confirm upload.');
  }

  onProgress?.({ status: 'done', progress: 1 });
  const data = confirmRes.data || {};
  return {
    mediaId: String(data.mediaId ?? data.upload_id ?? uploadId),
    originalName: String(data.originalName ?? prepared.name),
    mimeType: String(data.mimeType ?? prepared.type),
    size: Number(data.size ?? prepared.size),
  };
}
