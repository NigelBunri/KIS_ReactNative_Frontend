// src/services/uploadMarketplaceMedia.ts
//
// The ONE upload helper every marketplace screen must use - shop logo,
// product main/gallery images, service images, complaint attachments.
// Mirrors src/screens/tabs/profile/profileImageUpload.ts's three-step
// handshake (initiate -> PUT to S3 -> confirm) and reuses the exact same
// upload-id resolution/validation logic chat and profile uploads use
// (src/network/uploadIntentContract.ts) - a storage key is never used as
// the confirm id here either.
//
// Callers attach the resulting `mediaId` to their create/update request
// (e.g. `main_image_media_id`) or to a dedicated attach endpoint
// (`POST /shops/:id/image/attach/`, etc.) - see apps/commerce/media_uploads.py
// on the backend for the full contract.

import ImageResizer from 'react-native-image-resizer';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 85;
const S3_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export type MarketplacePurpose =
  | 'shop_logo'
  | 'product_main_image'
  | 'product_gallery_image'
  | 'service_image'
  | 'service_gallery_image'
  | 'complaint_attachment';

export type MarketplaceUploadTarget = {
  shopId?: string;
  productId?: string;
  serviceId?: string;
  orderId?: string;
};

export type MarketplaceMediaMeta = {
  mediaId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type MarketplaceUploadStatus = 'compressing' | 'initiating' | 'uploading' | 'confirming' | 'done';
export type MarketplaceUploadProgress = { status: MarketplaceUploadStatus; progress: number };

type PickedFile = { uri: string; name: string; type: string | null; size?: number | null };
type PreparedFile = { uri: string; name: string; type: string; size: number };

const isCompressibleImage = (type?: string | null) => {
  const t = String(type || '').toLowerCase();
  return t.startsWith('image/') && !t.includes('gif');
};

const withJpegExtension = (name: string) => (name || `upload_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg';

// Resize + re-encode to JPEG on-device before it ever leaves the phone -
// same rationale as profileImageUpload.ts's compressProfileImage: sidesteps
// HEIC decoding differences and keeps upload size predictable. Non-image
// files (a complaint's PDF receipt, for instance) pass through untouched.
async function prepareFile(file: PickedFile): Promise<PreparedFile> {
  if (!isCompressibleImage(file.type)) {
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
        console.error('[uploadMarketplaceMedia] S3 PUT rejected', {
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
 * Uploads a file for a marketplace purpose and returns a confirmed,
 * stable `mediaId` - never a storage key, never a raw file. Callers pass
 * that mediaId to their create/update request (`*_media_id` fields) or to
 * the matching `/attach/` endpoint. Throws on any failure; the caller owns
 * retry (just call this again) and duplicate-tap prevention (disable the
 * submit control while a call is in flight).
 */
export async function uploadMarketplaceMedia(opts: {
  purpose: MarketplacePurpose;
  file: PickedFile;
  target?: MarketplaceUploadTarget;
  onProgress?: (update: MarketplaceUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<MarketplaceMediaMeta> {
  const { purpose, file, target, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  onProgress?.({ status: 'compressing', progress: 0 });
  const prepared = await prepareFile(file);
  throwIfAborted();

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.commerce.uploadsInitiate,
    {
      purpose,
      filename: prepared.name,
      contentType: prepared.type,
      sizeBytes: prepared.size,
      shopId: target?.shopId,
      productId: target?.productId,
      serviceId: target?.serviceId,
      orderId: target?.orderId,
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
