// src/services/uploadChannelBrandingImage.ts
//
// Uploads a channel's logo (avatar) or cover (banner) image and attaches it
// directly to that channel. Mirrors uploadChannelContentVideo.ts's three-step
// handshake (initiate -> PUT to S3 -> confirm) against Django's generic
// POST /api/v1/media/uploads/initiate/ (apps/media/upload_intent.py,
// context='channel_avatar'|'channel_banner') — NOT uploadFileToBackend.ts
// (src/Module/ChatRoom), which hardcodes Nest's chat-only /uploads/initiate
// route and would 404 against this endpoint.
//
// Unlike channel_content_video (confirm-only, attached separately), these
// two contexts auto-attach at CONFIRM time on the backend — the confirm
// call itself returns the updated channel with its new avatar_url/
// banner_url already set, so there is no separate "attach" request here.
// `target_id` (the channel id) is sent at initiate time specifically
// because, unlike a user's one profile, a user may own several channels.

import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { resolveUploadIntent } from '@/network/uploadIntentContract';
import { ON_DEVICE_BLOCK_MESSAGE, scanImageUriOnDevice } from '@/services/contentSafety/onDeviceImageScan';
import type { BroadcastChannelDetail } from '@/screens/broadcast/channels/api/channels.types';
import { normalizeChannel } from '@/screens/broadcast/channels/hooks/useChannelsData';

const S3_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 85;

export type ChannelBrandingImageKind = 'avatar' | 'banner';
export type ChannelBrandingUploadStatus =
  | 'compressing'
  | 'initiating'
  | 'uploading'
  | 'confirming'
  | 'done';
export type ChannelBrandingUploadProgress = { status: ChannelBrandingUploadStatus; progress: number };

type PickedFile = { uri: string; name?: string | null; type?: string | null; size?: number | null };
type PreparedImage = { uri: string; name: string; type: string; size: number };

const withJpegExtension = (name: string) => (name || `image_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg';

// Re-encodes to JPEG on-device before anything leaves the phone — same
// rationale as profileImageUpload.ts's compressProfileImage: sidesteps
// HEIC decoding differences across image stacks and keeps every channel
// branding upload to one predictable content type/size ceiling.
async function compressBrandingImage(file: PickedFile): Promise<PreparedImage> {
  const resized = await ImageResizer.createResizedImage(
    file.uri,
    IMAGE_MAX_DIMENSION,
    IMAGE_MAX_DIMENSION,
    'JPEG',
    IMAGE_JPEG_QUALITY,
    0,
  );
  const uri = (resized as any)?.uri ?? (resized as any)?.path;
  if (!uri) {
    throw new Error('Unable to prepare this image. Please try a different photo.');
  }
  // CONFIRMED ROOT CAUSE of "upload failed" on real devices (reproduced
  // against production: the backend's confirm step rejected the upload
  // with "Uploaded file size does not match what was declared"): react-
  // native-image-resizer's own reported `size` is unreliable on some
  // platforms/versions (it can reflect a stale or pre-resize value
  // instead of the actual output file), but was only distrusted here when
  // it came back as exactly 0. A non-zero-but-wrong size still gets sent
  // to /uploads/initiate as size_bytes, and the backend later compares
  // THAT declared number against the real S3 object's actual size at
  // confirm time (apps/media/upload_intent.py's 0.5x-2x tolerance check) -
  // a resizer size that's merely inaccurate (not just missing) fails that
  // check exactly like this. Always stat the real file on disk instead of
  // ever trusting the resizer's self-reported size.
  const stat = await RNFS.stat(uri.replace(/^file:\/\//, '')).catch(() => null);
  const size = stat ? Number((stat as any).size) || 0 : 0;
  if (size <= 0) {
    throw new Error('Unable to prepare this image. Please try a different photo.');
  }
  return { uri, name: withJpegExtension(file.name || 'image.jpg'), type: 'image/jpeg', size };
}

function uploadBytesToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; type: string },
  headers: Record<string, unknown>,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.timeout = S3_UPLOAD_TIMEOUT_MS;
    Object.entries(headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, String(value));
    });
    // No Authorization header — the presigned URL's query string is the
    // only credential S3 sees, never the app's Django bearer token.
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (__DEV__) {
        console.error('[uploadChannelBrandingImage] S3 PUT rejected', {
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 300),
        });
      }
      reject(new Error('Image upload to storage failed. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Image upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Image upload timed out. Please try again on a stronger connection.'));
    if (xhr.upload) {
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(0.99, Math.max(0, event.loaded / event.total)));
      };
    }
    xhr.send({ uri: file.uri, type: file.type, name: 'upload' } as any);
  });
}

export async function uploadChannelBrandingImage(opts: {
  channelId: string;
  kind: ChannelBrandingImageKind;
  file: PickedFile;
  onProgress?: (update: ChannelBrandingUploadProgress) => void;
}): Promise<BroadcastChannelDetail> {
  const { channelId, kind, file, onProgress } = opts;

  // On-device content-safety pre-send check, before any network call —
  // same rationale as uploadFileToBackend.ts/uploadChannelContentVideo.ts:
  // fails safe to "clean" if no model is bundled, never blocks a send that
  // would otherwise have worked.
  const verdict = await scanImageUriOnDevice(file.uri);
  if (verdict.flagged) {
    throw new Error(ON_DEVICE_BLOCK_MESSAGE);
  }

  onProgress?.({ status: 'compressing', progress: 0 });
  const prepared = await compressBrandingImage(file);

  onProgress?.({ status: 'initiating', progress: 0 });
  const context = kind === 'banner' ? 'channel_banner' : 'channel_avatar';
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    { context, target_id: channelId, filename: prepared.name, content_type: prepared.type, size_bytes: prepared.size },
    { errorMessage: 'Unable to start image upload.' },
  );
  if (!initiateRes?.success) {
    throw new Error(initiateRes?.message || 'Unable to start image upload.');
  }
  const { uploadId, uploadUrl, headers } = resolveUploadIntent(initiateRes.data);

  onProgress?.({ status: 'uploading', progress: 0 });
  await uploadBytesToPresignedUrl(
    uploadUrl,
    { uri: prepared.uri, type: prepared.type },
    headers || { 'Content-Type': prepared.type },
    ratio => onProgress?.({ status: 'uploading', progress: ratio }),
  );

  onProgress?.({ status: 'confirming', progress: 1 });
  const confirmRes = await postRequest(
    ROUTES.mediaUploads.confirm(uploadId),
    {},
    { errorMessage: 'Unable to confirm image upload.' },
  );
  if (!confirmRes?.success) {
    throw new Error(confirmRes?.message || 'Unable to confirm image upload.');
  }

  onProgress?.({ status: 'done', progress: 1 });
  return normalizeChannel(confirmRes.data?.channel) as BroadcastChannelDetail;
}
