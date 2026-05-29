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

  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name || 'file',
    type: file.type || 'application/octet-stream',
  } as any);
  const uploadContext = normalizeUploadContext(opts.context || 'chat');
  form.append('context', uploadContext);

  onStatus?.('verifying');
  onProgress?.(0);

  const params = new URLSearchParams();
  if (conversationId) params.set('conversationId', conversationId);
  if (clientId) params.set('clientId', clientId);
  if (opts.deviceId) params.set('device_id', opts.deviceId);
  params.set('context', uploadContext);
  const durationSecondsFromFile =
    typeof file.durationMs === 'number' && Number.isFinite(file.durationMs)
      ? Math.round(file.durationMs / 1000)
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

  let json: any;
  try {
    json = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      if (opts.deviceId) {
        xhr.setRequestHeader('X-Device-Id', opts.deviceId);
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
        reject(new Error(safeMessage));
      };

      xhr.onerror = () => {
        reject(new Error('Upload failed: network error'));
      };

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const ratio = event.total ? event.loaded / event.total : 0;
          onProgress?.(Math.min(1, Math.max(0, ratio)));
        };
      }

      xhr.send(form as any);
    });
  } catch (err) {
    onStatus?.('failed');
    throw err;
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
    originalName: attachment.originalName ?? attachment.name ?? file.name,
    mimeType: attachment.mimeType ?? attachment.mime ?? file.type ?? 'application/octet-stream',
    size: attachment.size ?? file.size ?? 0,
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
  } as AttachmentMeta;
}
