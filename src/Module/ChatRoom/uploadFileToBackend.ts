// src/screens/chat/uploadFileToBackend.ts
import RNFS from 'react-native-fs';
import { API_BASE_URL } from '@/network';
import { stripFileScheme } from './chatMediaStorage';
import {
  getMediaSafetyMessage,
  isMediaSafetyBlocked,
  isMediaSafetyPendingReview,
  normalizeUploadContext,
  type MediaSafetyPayload,
} from '@/services/mediaSafety';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import {
  getAccessTokenForRequest,
  refreshAccessToken,
} from '@/security/tokenRefresh';
import { APP_ENV } from '@/env';
import ImageResizer from 'react-native-image-resizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_UPLOAD_BYTES = 2_147_483_647;
const uploadEnv = APP_ENV as typeof APP_ENV & {
  KIS_CHAT_UPLOAD_MAX_BYTES?: string;
  KIS_UPLOAD_MAX_BYTES?: string;
  CHAT_UPLOAD_MAX_BYTES?: string;
  UPLOAD_MAX_BYTES?: string;
};
const MAX_UPLOAD_BYTES = Number(
  uploadEnv.KIS_CHAT_UPLOAD_MAX_BYTES ??
    uploadEnv.KIS_UPLOAD_MAX_BYTES ??
    uploadEnv.CHAT_UPLOAD_MAX_BYTES ??
    uploadEnv.UPLOAD_MAX_BYTES,
) || DEFAULT_MAX_UPLOAD_BYTES;
const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
const IMAGE_UPLOAD_QUALITY = 82;

// Only requests against the Nest chat backend get the direct-to-S3
// presigned-PUT handshake (`/uploads/initiate` + `/uploads/:id/confirm`,
// see backend/Nestjs/src/uploads/upload-intent.service.ts). Requests against
// Django (voice messages, stickers — anywhere callers omit `baseUrl` and
// fall back to API_BASE_URL) keep going through the legacy multipart proxy:
// Django's generic signed-upload handshake (apps/media/upload_intent.py)
// only has attach handlers for profile_avatar/profile_cover today, not
// arbitrary chat contexts, and its multipart endpoint additionally runs
// AI content-safety scanning on the bytes it receives — something a
// direct-to-S3 upload can't do since the server never sees the bytes.
const isNestChatBackend = (baseUrl: string) =>
  /kis-nest-backend|chat\.kingdomimpactventures|:4000/.test(baseUrl);

const formatUploadBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
};

export class VerificationFailedError extends Error {
  readonly _verificationFailed = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'VerificationFailedError';
  }
}

export function isVerificationFailedError(err: unknown): err is VerificationFailedError {
  return err instanceof VerificationFailedError || (err as any)?._verificationFailed === true;
}
export type AttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

const isCompressibleImage = (file: { name?: string; type?: string | null }) => {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type.includes('gif') || name.endsWith('.gif')) return false;
  if (type.startsWith('image/')) return true;
  // Picker often omits `type` for Photos-library assets (esp. HEIC
  // originals) — fall back to the filename so those still get forced
  // through the JPEG re-encode below instead of uploading raw HEIC bytes
  // mislabeled with a .jpg name/mime.
  if (!type) return /\.(jpe?g|png|heic|heif|webp|bmp|tiff?)$/.test(name);
  return false;
};

const withJpegExtension = (name: string) => {
  const clean = name || `image_${Date.now()}`;
  return clean.replace(/\.[^.]+$/, '') + '.jpg';
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

const inferUploadMime = (name?: string, type?: string | null) => {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized && normalized !== 'application/octet-stream' && normalized !== 'audio/*') {
    return normalized;
  }
  const ext = String(name || '')
    .toLowerCase()
    .split('?')[0]
    .split('#')[0]
    .match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && MIME_BY_EXTENSION[ext]) || normalized || 'application/octet-stream';
};

const prepareUploadFile = async (file: {
  uri: string;
  name: string;
  type: string | null;
  size?: number | null;
  durationMs?: number | null;
}) => {
  if (!isCompressibleImage(file)) return file;

  try {
    const resized = await ImageResizer.createResizedImage(
      file.uri,
      IMAGE_UPLOAD_MAX_DIMENSION,
      IMAGE_UPLOAD_MAX_DIMENSION,
      'JPEG',
      IMAGE_UPLOAD_QUALITY,
      0,
    );
    const uri = (resized as any)?.uri ?? (resized as any)?.path;
    if (!uri) return file;
    return {
      ...file,
      uri,
      name: withJpegExtension(file.name || `image_${Date.now()}`),
      type: 'image/jpeg',
      size: typeof (resized as any)?.size === 'number' ? (resized as any).size : file.size,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[uploadFileToBackend] image compression failed; uploading original', {
        name: file.name,
        type: file.type,
        size: file.size,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return file;
  }
};

export type AttachmentMeta = {
  id: string;
  url: string;
  publicUrl?: string;
  downloadUrl?: string;
  displayUrl?: string;
  assetId?: string;
  mediaAssetId?: string;
  mediaAssetRef?: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  private?: boolean;
  scanStatus?: 'pending' | 'passed' | 'failed' | 'not_configured' | string;
  quarantined?: boolean;
  requiresReview?: boolean;
  safetyScanId?: string;
  safety?: MediaSafetyPayload;
  safetyMessage?: string | null;
  width?: number;
  height?: number;
  durationMs?: number;
  durationSeconds?: number;
  videoCategory?: string;
  localUri?: string;
  localPath?: string;
  localUploadKey?: string;
  // Unmodified server attachment JSON — an escape hatch for callers that
  // need server-specific fields this normalized shape doesn't carry (e.g.
  // broadcast video's video_url/thumbnail_url/type/pipeline from Django's
  // process-video-upload webhook — see uploadBroadcastVideo.ts).
  raw?: Record<string, unknown>;
};

// Extracts a safe, user-facing message from a JSON error body — shared by
// both the multipart-proxy path and the signed-URL path so error handling
// stays consistent regardless of which backend rejected the upload.
const safeErrorMessage = (responseText: string, fallback: string): string => {
  try {
    const parsed = JSON.parse(responseText || '{}');
    const detail = parsed?.detail ?? parsed?.message ?? parsed?.error;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && typeof detail[0] === 'string') return detail[0];
    if (detail && typeof detail === 'object') {
      const first = Object.values(detail).flat().find((value) => typeof value === 'string');
      if (typeof first === 'string') return first;
    }
  } catch {
    // Keep the fallback; do not expose raw backend/storage responses.
  }
  return fallback;
};

const isAuthUploadError = (err: any) => {
  const status = Number(err?.status ?? 0);
  const message = String(err?.message ?? '').toLowerCase();
  return status === 401 || status === 403 || message.includes('token') || message.includes('unauthorized');
};

// One authenticated JSON POST, with the same silent-refresh-then-retry-once
// behavior the old single-request multipart flow had — now shared by both
// the initiate and confirm steps of the signed-URL flow.
async function authedJsonPost(
  url: string,
  body: Record<string, unknown>,
  firstToken: string,
  deviceId?: string,
): Promise<any> {
  const attempt = (token: string) =>
    new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (deviceId) xhr.setRequestHeader('X-Device-Id', deviceId);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || '{}'));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(
          Object.assign(new Error(safeErrorMessage(xhr.responseText, 'Upload failed. Please retry.')), {
            status: xhr.status,
            responseText: xhr.responseText,
          }),
        );
      };
      xhr.onerror = () =>
        reject(new Error('Upload failed. Please check your connection and try again.'));
      xhr.ontimeout = () =>
        reject(new Error('Upload timed out. Please retry on a stronger connection.'));
      xhr.send(JSON.stringify(body));
    });

  try {
    return await attempt(firstToken);
  } catch (err) {
    if (!isAuthUploadError(err)) throw err;
    const refreshedToken = await refreshAccessToken(firstToken);
    if (!refreshedToken) throw err;
    return attempt(refreshedToken);
  }
}

// Direct-to-S3 handshake: initiate -> PUT bytes to the presigned URL ->
// confirm. Mirrors src/screens/tabs/profile/profileImageUpload.ts, which
// does the same three-step dance against Django's profile-image endpoints.
async function uploadViaSignedUrl(params: {
  baseUrl: string;
  uploadFile: { uri: string; name: string; type: string | null; size?: number | null };
  uploadContext: string;
  conversationId?: string;
  clientId?: string;
  durationSeconds?: number;
  firstToken: string;
  deviceId?: string;
  onStatus?: (status: 'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed') => void;
  onProgress?: (progress: number) => void;
  // broadcast_video context only — passed straight through to Nest's
  // /uploads/:id/confirm, which forwards them to Django's post-confirm
  // video-processing webhook (see upload-intent.service.ts on the Nest
  // side). Ignored server-side for every other context.
  confirmExtra?: { title?: string; description?: string; channelId?: string; thumbnailAttachmentId?: string };
}): Promise<any> {
  const {
    baseUrl,
    uploadFile,
    uploadContext,
    conversationId,
    clientId,
    durationSeconds,
    firstToken,
    deviceId,
    onStatus,
    onProgress,
    confirmExtra,
  } = params;
  const contentType = inferUploadMime(uploadFile.name, uploadFile.type);

  onStatus?.('verifying');
  const initiateRes = await authedJsonPost(
    `${baseUrl}/uploads/initiate`,
    {
      filename: uploadFile.name || 'file',
      content_type: contentType,
      size_bytes: uploadFile.size || 0,
      context: uploadContext,
      conversationId,
      clientId,
    },
    firstToken,
    deviceId,
  );

  // Never derive the confirm id from the S3 storage key — see
  // uploadIntentContract.ts for why (a key contains '/', which cannot
  // survive as a single REST path segment even URL-encoded, causing the
  // exact "Cannot POST /uploads/<key>/confirm" 404 this flow used to hit).
  // This one shared path is used for every file kind — video, image, PDF,
  // document — so the fix (and its guard) applies to all of them equally.
  const { uploadId, uploadUrl, headers: requiredHeaders, storageKey } = resolveUploadIntent(initiateRes);

  if (__DEV__) {
    console.log('[uploadFileToBackend] initiate resolved', {
      uploadId,
      storageKey,
      mimeType: contentType,
      size: uploadFile.size,
      confirmPath: buildConfirmPath(uploadId),
    });
  }

  // Re-check right before the actual native read (buildRequest/RCTNetworking
  // opens the file here). The caller's own pre-flight check happens before
  // the token-refresh + /uploads/initiate round-trip above, which can be a
  // multi-second gap for a large video — re-verifying here closes that
  // window as tightly as possible.
  if (uploadFile.uri?.startsWith('file://')) {
    const stillExists = await RNFS.exists(stripFileScheme(uploadFile.uri)).catch(() => false);
    if (!stillExists) {
      onStatus?.('failed');
      throw new Error('This file is no longer available on your device. Please pick it again and resend.');
    }
  }

  onStatus?.('uploading');
  onProgress?.(0);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    Object.entries(requiredHeaders || { 'Content-Type': contentType }).forEach(([key, value]) => {
      xhr.setRequestHeader(key, String(value));
    });
    // No Authorization header — the presigned URL is the only credential
    // sent to storage, never the app's Django/Nest bearer token.
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (__DEV__) {
        console.error('[uploadFileToBackend] presigned PUT rejected', {
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 300),
        });
      }
      reject(new Error('File upload to storage failed. Please try again.'));
    };
    xhr.onerror = () =>
      reject(new Error('Upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () =>
      reject(new Error('Upload timed out. Please retry on a stronger connection.'));
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const ratio = event.total ? event.loaded / event.total : 0;
        onProgress?.(Math.min(0.98, Math.max(0, ratio)));
      };
    }
    xhr.send({ uri: uploadFile.uri, type: contentType, name: 'upload' } as any);
  });

  const confirmBody: Record<string, unknown> = {
    ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
    ...(confirmExtra?.title ? { title: confirmExtra.title } : {}),
    ...(confirmExtra?.description ? { description: confirmExtra.description } : {}),
    ...(confirmExtra?.channelId ? { channelId: confirmExtra.channelId } : {}),
    ...(confirmExtra?.thumbnailAttachmentId ? { thumbnailAttachmentId: confirmExtra.thumbnailAttachmentId } : {}),
  };
  const confirmRes = await authedJsonPost(
    `${baseUrl}${buildConfirmPath(uploadId)}`,
    confirmBody,
    firstToken,
    deviceId,
  );
  return confirmRes;
}

export async function uploadFileToBackend(opts: {
  file: { uri: string; name: string; type: string | null; size?: number | null; durationMs?: number | null };
  authToken?: string | null;
  deviceId?: string;
  baseUrl?: string; // e.g. https://your-api.com
  onProgress?: (progress: number) => void;
  onStatus?: (status: 'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed') => void;
  conversationId?: string;
  clientId?: string;
  metadata?: Record<string, string | number>;
  context?: string;
  // broadcast_video context only — see uploadViaSignedUrl's confirmExtra.
  confirmExtra?: { title?: string; description?: string; channelId?: string; thumbnailAttachmentId?: string };
}): Promise<AttachmentMeta> {
  const {
    file,
    authToken,
    baseUrl: providedBaseUrl,
    onProgress,
    onStatus,
    conversationId,
    clientId,
    metadata: optsMetadata,
    confirmExtra,
  } = opts;
  const baseUrl = providedBaseUrl ?? API_BASE_URL;
  const resolvedDeviceId = opts.deviceId || (await AsyncStorage.getItem('device_id')) || undefined;
  const fileSize = typeof file.size === 'number' ? file.size : 0;
  if (fileSize > MAX_UPLOAD_BYTES) {
    onStatus?.('failed');
    throw new Error(
      `This file is ${formatUploadBytes(fileSize)}, but the current upload limit is ${formatUploadBytes(MAX_UPLOAD_BYTES)}.`,
    );
  }
  const originalFile = file;
  const uploadFile = await prepareUploadFile(file);

  // Verify the local file is actually still there right before building the
  // request. Without this, a file that vanished after staging (copy silently
  // didn't materialize, or its source got cleaned up) surfaces as a cryptic
  // native "no such file" crash deep inside RCTNetworking instead of a clean,
  // catchable error the chat UI can show a retry state for.
  if (uploadFile.uri?.startsWith('file://')) {
    const localPath = stripFileScheme(uploadFile.uri);
    const stillExists = await RNFS.exists(localPath).catch(() => false);
    if (!stillExists) {
      onStatus?.('failed');
      throw new Error('This file is no longer available on your device. Please pick it again and resend.');
    }
  }

  const uploadContext = normalizeUploadContext(opts.context || 'chat');
  const durationSecondsFromFile =
    typeof uploadFile.durationMs === 'number' && Number.isFinite(uploadFile.durationMs)
      ? Math.round(uploadFile.durationMs / 1000)
      : undefined;
  const metadata = { ...(optsMetadata ?? {}) };
  if (
    durationSecondsFromFile !== undefined &&
    metadata.duration_seconds == null &&
    metadata.durationSeconds == null
  ) {
    metadata.duration_seconds = durationSecondsFromFile;
  }
  const durationSeconds =
    typeof metadata.duration_seconds === 'number'
      ? metadata.duration_seconds
      : typeof metadata.durationSeconds === 'number'
        ? metadata.durationSeconds
        : undefined;

  const useSignedUrlFlow = isNestChatBackend(baseUrl);
  const uploadBackendName = useSignedUrlFlow ? 'Nest' : 'Django';

  console.log('[uploadFileToBackend] start', {
    baseUrl,
    backend: uploadBackendName,
    flow: useSignedUrlFlow ? 'signed-url' : 'multipart-proxy',
    context: uploadContext,
    fileName: uploadFile.name,
    fileType: inferUploadMime(uploadFile.name, uploadFile.type),
    fileSize,
    hasDeviceId: Boolean(resolvedDeviceId),
  });

  const firstToken =
    (await getAccessTokenForRequest().catch(() => null)) ||
    authToken ||
    null;
  if (!firstToken) {
    console.error('[uploadFileToBackend] no access token available; upload never sent', {
      baseUrl,
      context: uploadContext,
    });
    onStatus?.('failed');
    throw new Error('Authentication token missing. Please reconnect and try again.');
  }

  let json: any;
  try {
    if (useSignedUrlFlow) {
      json = await uploadViaSignedUrl({
        baseUrl,
        uploadFile,
        uploadContext,
        conversationId,
        clientId,
        durationSeconds,
        firstToken,
        deviceId: resolvedDeviceId,
        onStatus,
        onProgress,
        confirmExtra,
      });
    } else {
      json = await uploadViaMultipartProxy({
        baseUrl,
        uploadFile,
        uploadContext,
        conversationId,
        clientId,
        metadata,
        resolvedDeviceId,
        firstToken,
        onStatus,
        onProgress,
      });
    }
  } catch (err) {
    console.error('[uploadFileToBackend] upload attempt failed', {
      baseUrl,
      context: uploadContext,
      error: err instanceof Error ? err.message : String(err),
      status: (err as any)?.status,
    });
    onStatus?.('failed');
    throw err;
  }

  onProgress?.(1);
  const attachment = json?.attachment ?? json;
  const safety = attachment.safety as MediaSafetyPayload | undefined;

  console.log('[uploadFileToBackend] upload accepted by server', {
    baseUrl,
    context: uploadContext,
    assetId: attachment?.assetId ?? attachment?.mediaAssetId ?? attachment?.id,
    scanStatus: attachment?.scanStatus ?? safety?.status,
    quarantined: attachment?.quarantined ?? safety?.quarantined,
    hasDisplayUrl: Boolean(attachment?.displayUrl ?? attachment?.url ?? attachment?.publicUrl),
  });

  if (FEATURE_FLAGS.MEDIA_VERIFICATION_ENABLED) {
    // 'not_configured' means the AI scan is disabled on this server — the file
    // was never checked, so it is not condemned. Never block on not_configured.
    if (isMediaSafetyBlocked(safety)) {
      const msg = getMediaSafetyMessage(safety) || 'This upload cannot be accepted on KIS.';
      console.error('[uploadFileToBackend] media safety blocked upload', { baseUrl, context: uploadContext, safety });
      onStatus?.('verification_failed');
      throw new VerificationFailedError(msg);
    }
    if (
      ['chat', 'dm', 'group', 'partner', 'status'].includes(uploadContext) &&
      isMediaSafetyPendingReview(safety)
    ) {
      const msg = getMediaSafetyMessage(safety) || 'Your upload is being checked before it can be sent.';
      console.warn('[uploadFileToBackend] media safety pending review; blocking for this context', {
        baseUrl,
        context: uploadContext,
        safety,
      });
      onStatus?.('verification_failed');
      throw new VerificationFailedError(msg);
    }
  }

  onStatus?.('done');
  const resolvedDurationSeconds =
    typeof attachment.duration_seconds === 'number'
      ? attachment.duration_seconds
      : typeof attachment.durationSeconds === 'number'
        ? attachment.durationSeconds
        : attachment.durationMs
          ? Math.round(attachment.durationMs / 1000)
          : undefined;
  const kind = (attachment.kind as string | undefined) ?? 'other';
  const displayUrl =
    attachment.displayUrl ??
    attachment.url ??
    attachment.downloadUrl ??
    attachment.publicUrl ??
    attachment.uri ??
    '';
  return {
    id: attachment.id ?? attachment.key ?? attachment.assetId ?? attachment.mediaAssetId,
    url: displayUrl,
    publicUrl: attachment.publicUrl,
    downloadUrl: attachment.downloadUrl,
    displayUrl,
    assetId: attachment.assetId,
    mediaAssetId: attachment.mediaAssetId,
    mediaAssetRef: attachment.mediaAssetRef,
    originalName: originalFile.name ?? attachment.originalName ?? attachment.name ?? uploadFile.name,
    mimeType: attachment.mimeType ?? attachment.mime ?? inferUploadMime(uploadFile.name, uploadFile.type ?? originalFile.type),
    size: attachment.size ?? uploadFile.size ?? originalFile.size ?? 0,
    kind: kind as AttachmentKind,
    private: attachment.private,
    scanStatus: attachment.scanStatus,
    quarantined: attachment.quarantined,
    requiresReview: attachment.requiresReview,
    safetyScanId: attachment.safetyScanId,
    safety,
    safetyMessage: getMediaSafetyMessage(safety),
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.durationMs,
    durationSeconds: resolvedDurationSeconds,
    videoCategory:
      attachment.video_category ??
      (kind === 'short_video' ? 'shorts' : kind === 'video' || kind === 'long_video' ? 'videos' : undefined),
    localUri: originalFile.uri,
    localPath: originalFile.uri?.startsWith('file://') ? stripFileScheme(originalFile.uri) : undefined,
    localUploadKey: `${originalFile.uri}:${originalFile.name}:${originalFile.type ?? ''}`,
    raw: attachment,
  } as AttachmentMeta;
}

// Legacy multipart proxy — unchanged behavior, still used for every
// non-Nest target (Django's UploadFileView, which runs AI content-safety
// scanning on the bytes it receives).
async function uploadViaMultipartProxy(params: {
  baseUrl: string;
  uploadFile: { uri: string; name: string; type: string | null; size?: number | null; durationMs?: number | null };
  uploadContext: string;
  conversationId?: string;
  clientId?: string;
  metadata: Record<string, string | number>;
  resolvedDeviceId?: string;
  firstToken: string;
  onStatus?: (status: 'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed') => void;
  onProgress?: (progress: number) => void;
}): Promise<any> {
  const { baseUrl, uploadFile, uploadContext, conversationId, clientId, metadata, resolvedDeviceId, firstToken, onStatus, onProgress } =
    params;

  const form = new FormData();
  form.append('file', {
    uri: uploadFile.uri,
    name: uploadFile.name || 'file',
    type: inferUploadMime(uploadFile.name, uploadFile.type),
  } as any);
  form.append('context', uploadContext);

  onStatus?.('verifying');
  onProgress?.(0);

  const params_ = new URLSearchParams();
  if (conversationId) params_.set('conversationId', conversationId);
  if (clientId) params_.set('clientId', clientId);
  if (resolvedDeviceId) params_.set('device_id', resolvedDeviceId);
  params_.set('context', uploadContext);
  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params_.set(key, String(value));
  });
  const url = params_.toString() ? `${baseUrl}/uploads/file?${params_.toString()}` : `${baseUrl}/uploads/file`;

  const uploadOnce = async (token: string) => {
    // Re-check right before the actual native read (buildRequest/RCTNetworking
    // opens the file when xhr.send(form) runs below). The caller's own
    // pre-flight check happened earlier, before this function was even
    // reached — re-verifying here closes that window as tightly as possible.
    if (uploadFile.uri?.startsWith('file://')) {
      const stillExists = await RNFS.exists(stripFileScheme(uploadFile.uri)).catch(() => false);
      if (!stillExists) {
        onStatus?.('failed');
        throw new Error('This file is no longer available on your device. Please pick it again and resend.');
      }
    }

    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (resolvedDeviceId) {
        xhr.setRequestHeader('X-Device-Id', resolvedDeviceId);
      }

      xhr.onload = () => {
        console.log('[uploadFileToBackend] response', {
          url,
          status: xhr.status,
          bodyPreview: String(xhr.responseText || '').slice(0, 500),
        });
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            console.error('[uploadFileToBackend] failed to parse success response', {
              url,
              status: xhr.status,
              error: err instanceof Error ? err.message : String(err),
            });
            reject(err);
          }
          return;
        }
        const safeMessage = safeErrorMessage(xhr.responseText, 'Upload failed. Please retry.');
        console.error('[uploadFileToBackend] server rejected upload', {
          url,
          status: xhr.status,
          safeMessage,
        });
        reject(Object.assign(new Error(safeMessage), { status: xhr.status, responseText: xhr.responseText }));
      };

      xhr.onerror = () => {
        const diagnostic = { status: xhr.status, readyState: xhr.readyState, responseURL: xhr.responseURL, uploadedUri: uploadFile.uri };
        console.error('[uploadFileToBackend] xhr network error (request never reached the server, or the response never came back)', { url, ...diagnostic });
        reject(Object.assign(new Error(`Upload failed after upload reached the server. Please retry; if it repeats, check the backend logs for /uploads/file.`), { status: xhr.status, diagnostic }));
      };

      xhr.ontimeout = () => {
        console.error('[uploadFileToBackend] xhr timeout', { url, timeoutMs: UPLOAD_TIMEOUT_MS });
        reject(new Error('Upload failed: the network was too slow and timed out. Please retry on a stronger connection.'));
      };

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          onStatus?.('uploading');
          const ratio = event.total ? event.loaded / event.total : 0;
          onProgress?.(Math.min(0.98, Math.max(0, ratio)));
        };
      }

      xhr.send(form as any);
    });
  };

  try {
    return await uploadOnce(firstToken);
  } catch (err) {
    if (!isAuthUploadError(err)) throw err;
    const refreshedToken = await refreshAccessToken(firstToken);
    if (!refreshedToken) throw err;
    return uploadOnce(refreshedToken);
  }
}
