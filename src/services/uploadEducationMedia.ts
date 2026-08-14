// src/services/uploadEducationMedia.ts
//
// The ONE upload helper Education screens must use — institution logo,
// program/course/lesson/class/material/assessment/event cover images, and
// material resource attachments (documents/video/audio/images). Mirrors
// src/services/uploadMarketplaceMedia.ts's three-step handshake
// (initiate -> PUT to S3 -> confirm) and reuses the exact same upload-id
// resolution/validation logic every other upload surface uses
// (src/network/uploadIntentContract.ts) — a storage key is never used as
// the confirm id here either.
//
// Callers attach the resulting `mediaId` as an attachment object
// (`{ media_id: mediaId }`) on the relevant field — `logo_attachment` for
// institution branding, `cover_image_attachment` for module cover images,
// `resource_attachment` for material files — see
// apps/broadcasts/education_media.py on the backend for the full contract.
// The backend re-resolves and safety-scans the media server-side; it never
// trusts a client-supplied url/mime/quarantine flag.

import ImageResizer from 'react-native-image-resizer';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 85;
const S3_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export type EducationUploadContext =
  | 'education_institution_logo'
  | 'education_module_cover_image'
  | 'education_material';

export type EducationMediaMeta = {
  mediaId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type EducationUploadStatus = 'compressing' | 'initiating' | 'uploading' | 'confirming' | 'done';
export type EducationUploadProgress = { status: EducationUploadStatus; progress: number };

type PickedFile = { uri: string; name: string; type: string | null; size?: number | null };
type PreparedFile = { uri: string; name: string; type: string; size: number };

const isCompressibleImage = (type?: string | null) => {
  const t = String(type || '').toLowerCase();
  return t.startsWith('image/') && !t.includes('gif');
};

const withJpegExtension = (name: string) => (name || `upload_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg';

// Only cover-image/logo contexts are compressed on-device — a material
// resource (PDF, video, audio) must reach S3 byte-for-byte.
async function prepareFile(file: PickedFile, context: EducationUploadContext): Promise<PreparedFile> {
  const shouldCompress = context !== 'education_material' && isCompressibleImage(file.type);
  if (!shouldCompress) {
    return {
      uri: file.uri,
      name: file.name || `upload_${Date.now()}`,
      type: file.type || 'application/octet-stream',
      size: file.size || 0,
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
  return { uri, name: withJpegExtension(file.name), type: 'image/jpeg', size };
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
    // No Authorization header — the presigned URL query string is the only
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
        console.error('[uploadEducationMedia] S3 PUT rejected', {
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
 * Uploads a file for an education purpose and returns a confirmed, stable
 * `mediaId` — never a storage key, never a raw file. Callers pass that
 * mediaId as `{ media_id: mediaId }` on the relevant attachment field.
 * Throws on any failure; the caller owns retry (just call this again) and
 * duplicate-tap prevention (disable the submit control while a call is in
 * flight). `institutionId` is required for every context except
 * education_institution_logo uploaded while creating a brand-new
 * institution (no id exists yet).
 */
export async function uploadEducationMedia(opts: {
  context: EducationUploadContext;
  file: PickedFile;
  institutionId?: string;
  onProgress?: (update: EducationUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<EducationMediaMeta> {
  const { context, file, institutionId, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  onProgress?.({ status: 'compressing', progress: 0 });
  const prepared = await prepareFile(file, context);
  throwIfAborted();

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.broadcasts.educationUploadsInitiate,
    {
      context,
      filename: prepared.name,
      contentType: prepared.type,
      sizeBytes: prepared.size,
      institutionId,
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
