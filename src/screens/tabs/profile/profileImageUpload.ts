// src/screens/tabs/profile/profileImageUpload.ts
//
// Direct-to-S3 presigned-PUT upload for the profile avatar/cover image.
// Mirrors the three-step handshake implemented on the backend
// (apps/media/upload_intent.py): initiate -> PUT bytes to S3 -> confirm.
//
// The S3 PUT deliberately bypasses the app's network/* request wrappers
// (postRequest/patchRequest/putRequest) because those always attach the
// Django bearer token — the presigned URL must be the only credential sent
// to S3, never the app's Authorization header.
import ImageResizer from 'react-native-image-resizer';

import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { PickedImage } from './profile.types';

const AVATAR_MAX_DIMENSION = 1024;
const AVATAR_JPEG_QUALITY = 85;
const S3_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export type ProfileImageUploadStatus =
  | 'compressing'
  | 'initiating'
  | 'uploading'
  | 'confirming'
  | 'done';

export type ProfileImageUploadProgress = {
  status: ProfileImageUploadStatus;
  progress: number; // 0..1
};

type PreparedImage = { uri: string; name: string; type: string; size: number };

const withJpegExtension = (name: string) =>
  (name || `image_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg';

// Resize + re-encode to JPEG on-device before it ever leaves the phone.
// Converting HEIC/HEIF to JPEG here (rather than trusting the backend to
// handle it) sidesteps HEIC decoding differences across image stacks, and
// keeps every profile-image upload to a single, predictable content type.
// `mode` defaults to 'contain', which preserves aspect ratio.
async function compressProfileImage(file: PickedImage): Promise<PreparedImage> {
  const resized = await ImageResizer.createResizedImage(
    file.uri,
    AVATAR_MAX_DIMENSION,
    AVATAR_MAX_DIMENSION,
    'JPEG',
    AVATAR_JPEG_QUALITY,
    0,
  );
  const uri = resized?.uri ?? resized?.path;
  const size = Number(resized?.size) || 0;
  if (!uri || size <= 0) {
    throw new Error('Unable to prepare this image. Please try a different photo.');
  }
  return { uri, name: withJpegExtension(file.name), type: 'image/jpeg', size };
}

// XHR (not fetch) so upload progress is observable via xhr.upload.onprogress
// — mirrors the existing chat-upload precedent
// (src/Module/ChatRoom/uploadFileToBackend.ts). Sending `{ uri, type, name }`
// as the body lets React Native stream the file from disk natively instead
// of reading it into a JS string/array buffer first.
function uploadBytesToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; type: string },
  requiredHeaders: Record<string, string>,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.timeout = S3_UPLOAD_TIMEOUT_MS;
    Object.entries(requiredHeaders || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    // No Authorization header, and no header beyond what the server signed
    // — S3 authenticates this request via the presigned query string alone.

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (__DEV__) {
        // Never log the presigned URL itself in production; this branch is
        // dev-only and still avoids printing the query string.
        console.error('[profileImageUpload] S3 PUT rejected', {
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 300),
        });
      }
      reject(new Error('Image upload to storage failed. Please try again.'));
    };
    xhr.onerror = () =>
      reject(new Error('Image upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () =>
      reject(new Error('Image upload timed out. Please try again on a stronger connection.'));
    if (xhr.upload) {
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(0.99, Math.max(0, event.loaded / event.total)));
      };
    }
    xhr.send({ uri: file.uri, type: file.type, name: 'upload' } as any);
  });
}

export type ConfirmedProfileImage = {
  upload_id: string;
  status: string;
  profile: Record<string, any>;
};

export async function uploadProfileImage(
  kind: 'avatar' | 'cover',
  file: PickedImage,
  onProgress?: (update: ProfileImageUploadProgress) => void,
): Promise<ConfirmedProfileImage> {
  onProgress?.({ status: 'compressing', progress: 0 });
  const prepared = await compressProfileImage(file);

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.profileImageInitiate,
    {
      filename: prepared.name,
      content_type: prepared.type,
      size_bytes: prepared.size,
      kind,
    },
    { errorMessage: 'Unable to start image upload.' },
  );
  if (!initiateRes?.success) {
    throw new Error(initiateRes?.message || 'Unable to start image upload.');
  }
  const { upload_id, upload_url, required_headers } = initiateRes.data || {};
  if (!upload_id || !upload_url) {
    throw new Error('Unable to start image upload.');
  }

  onProgress?.({ status: 'uploading', progress: 0 });
  await uploadBytesToPresignedUrl(
    upload_url,
    { uri: prepared.uri, type: prepared.type },
    required_headers || { 'Content-Type': prepared.type },
    ratio => onProgress?.({ status: 'uploading', progress: ratio }),
  );

  onProgress?.({ status: 'confirming', progress: 1 });
  const confirmRes = await postRequest(
    ROUTES.mediaUploads.confirm(upload_id),
    { upload_id },
    { errorMessage: 'Unable to confirm image upload.' },
  );
  if (!confirmRes?.success) {
    throw new Error(confirmRes?.message || 'Unable to confirm image upload.');
  }

  onProgress?.({ status: 'done', progress: 1 });
  return confirmRes.data as ConfirmedProfileImage;
}
