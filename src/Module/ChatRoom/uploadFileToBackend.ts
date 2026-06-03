// src/screens/chat/uploadFileToBackend.ts
import { API_BASE_URL } from '@/network';
import {
  getMediaSafetyMessage,
  isMediaSafetyBlocked,
  isMediaSafetyPendingReview,
  normalizeUploadContext,
  type MediaSafetyPayload,
} from '@/services/mediaSafety';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { refreshAccessToken } from '@/security/tokenRefresh';
import ImageResizer from 'react-native-image-resizer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
const IMAGE_UPLOAD_QUALITY = 82;

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
  if (!type.startsWith('image/')) return false;
  if (type.includes('gif') || name.endsWith('.gif')) return false;
  return true;
};

const withJpegExtension = (name: string) => {
  const clean = name || `image_${Date.now()}`;
  return clean.replace(/\.[^.]+$/, '') + '.jpg';
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
  localUploadKey?: string;
};

export async function uploadFileToBackend(opts: {
  file: { uri: string; name: string; type: string | null; size?: number | null; durationMs?: number | null };
  authToken: string;
  deviceId?: string;
  baseUrl?: string; // e.g. https://your-api.com
  onProgress?: (progress: number) => void;
  onStatus?: (status: 'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed') => void;
  conversationId?: string;
  clientId?: string;
  metadata?: Record<string, string | number>;
  context?: string;
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
  } = opts;
  const baseUrl = providedBaseUrl ?? API_BASE_URL;
  const resolvedDeviceId = opts.deviceId || (await AsyncStorage.getItem('device_id')) || undefined;
  const originalFile = file;
  const uploadFile = await prepareUploadFile(file);

  const form = new FormData();
  form.append('file', {
    uri: uploadFile.uri,
    name: uploadFile.name || 'file',
    type: uploadFile.type || 'application/octet-stream',
  } as any);
  const uploadContext = normalizeUploadContext(opts.context || 'chat');
  form.append('context', uploadContext);

  onStatus?.('verifying');
  onProgress?.(0);

  const params = new URLSearchParams();
  if (conversationId) params.set('conversationId', conversationId);
  if (clientId) params.set('clientId', clientId);
  if (resolvedDeviceId) params.set('device_id', resolvedDeviceId);
  params.set('context', uploadContext);
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
  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });
  const url = params.toString()
    ? `${baseUrl}/uploads/file?${params.toString()}`
    : `${baseUrl}/uploads/file`;

  const uploadOnce = (token: string) =>
    new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (resolvedDeviceId) {
        xhr.setRequestHeader('X-Device-Id', resolvedDeviceId);
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(err);
          }
          return;
        }
        let safeMessage = 'Upload failed. Please retry.';
        try {
          const parsed = JSON.parse(xhr.responseText || '{}');
          const detail = parsed?.detail ?? parsed?.message ?? parsed?.error;
          if (typeof detail === 'string' && detail.trim()) safeMessage = detail;
          else if (Array.isArray(detail) && typeof detail[0] === 'string') safeMessage = detail[0];
          else if (detail && typeof detail === 'object') {
            const first = Object.values(detail).flat().find((value) => typeof value === 'string');
            if (typeof first === 'string') safeMessage = first;
          }
        } catch {
          // Keep the generic message; do not expose raw backend/storage responses.
        }
        reject(Object.assign(new Error(safeMessage), { status: xhr.status }));
      };

      xhr.onerror = () => {
        const diagnostic = { status: xhr.status, readyState: xhr.readyState, responseURL: xhr.responseURL, uploadedUri: uploadFile.uri, originalUri: originalFile.uri };
        if (__DEV__) console.warn('[uploadFileToBackend] xhr network error', diagnostic);
        reject(Object.assign(new Error('Upload failed after upload reached the server. Please retry; if it repeats, check the Django Render logs for /uploads/file.'), { status: xhr.status, diagnostic }));
      };

      xhr.ontimeout = () => {
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

  let json: any;
  try {
    json = await uploadOnce(authToken);
  } catch (err) {
    if ((err as any)?.status !== 401) {
      onStatus?.('failed');
      throw err;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      onStatus?.('failed');
      throw err;
    }

    try {
      json = await uploadOnce(refreshedToken);
    } catch (retryErr) {
      onStatus?.('failed');
      throw retryErr;
    }
  }

  onProgress?.(1);
  const attachment = json?.attachment ?? json;
  const safety = attachment.safety as MediaSafetyPayload | undefined;

  if (FEATURE_FLAGS.MEDIA_VERIFICATION_ENABLED) {
    const notConfigured = safety?.status === 'not_configured';
    if (isMediaSafetyBlocked(safety) || notConfigured) {
      const msg = notConfigured
        ? 'Verification failed: AI safety keys are not configured on the server.'
        : (getMediaSafetyMessage(safety) || 'This upload cannot be accepted on KIS.');
      onStatus?.('verification_failed');
      throw new VerificationFailedError(msg);
    }
    if (
      ['chat', 'dm', 'group', 'partner', 'status'].includes(uploadContext) &&
      isMediaSafetyPendingReview(safety)
    ) {
      const msg = getMediaSafetyMessage(safety) || 'Your upload is being checked before it can be sent.';
      onStatus?.('verification_failed');
      throw new VerificationFailedError(msg);
    }
  }

  onStatus?.('done');
  const durationSeconds =
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
    mimeType: attachment.mimeType ?? attachment.mime ?? uploadFile.type ?? originalFile.type ?? 'application/octet-stream',
    size: attachment.size ?? uploadFile.size ?? originalFile.size ?? 0,
    kind,
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
    durationSeconds,
    videoCategory:
      attachment.video_category ??
      (kind === 'short_video' ? 'shorts' : kind === 'video' || kind === 'long_video' ? 'videos' : undefined),
    localUri: originalFile.uri,
    localUploadKey: `${originalFile.uri}:${originalFile.name}:${originalFile.type ?? ''}`,
  } as AttachmentMeta;
}
