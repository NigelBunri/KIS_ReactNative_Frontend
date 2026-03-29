// src/screens/chat/uploadFileToBackend.ts
import { API_BASE_URL } from '@/network';
export type AttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export type AttachmentMeta = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
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
  onStatus?: (status: 'uploading' | 'done' | 'failed') => void;
  conversationId?: string;
  clientId?: string;
  metadata?: Record<string, string | number>;
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

  onStatus?.('uploading');
  onProgress?.(0);

  const params = new URLSearchParams();
  if (conversationId) params.set('conversationId', conversationId);
  if (clientId) params.set('clientId', clientId);
  if (opts.deviceId) params.set('device_id', opts.deviceId);
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
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
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
  onStatus?.('done');
  const attachment = json?.attachment ?? json;
  const durationSeconds =
    typeof attachment.duration_seconds === 'number'
      ? attachment.duration_seconds
      : typeof attachment.durationSeconds === 'number'
        ? attachment.durationSeconds
        : attachment.durationMs
          ? Math.round(attachment.durationMs / 1000)
          : undefined;
  const kind = (attachment.kind as string | undefined) ?? 'other';
  return {
    id: attachment.id ?? attachment.key,
    url: attachment.url,
    originalName: attachment.originalName ?? attachment.name ?? file.name,
    mimeType: attachment.mimeType ?? attachment.mime ?? file.type ?? 'application/octet-stream',
    size: attachment.size ?? file.size ?? 0,
    kind,
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.durationMs,
    durationSeconds,
    videoCategory:
      attachment.video_category ??
      (kind === 'short_video' ? 'shorts' : kind === 'video' || kind === 'long_video' ? 'videos' : undefined),
  } as AttachmentMeta;
}
