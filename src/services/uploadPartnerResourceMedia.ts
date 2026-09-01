// src/services/uploadPartnerResourceMedia.ts
//
// Upload helper for a Resource Library file. Same three-step handshake
// as uploadTaskReportMedia.ts, but with no `target_id` at initiate time —
// unlike a task, which already exists when its report is submitted, the
// PartnerResource row doesn't exist until AFTER the file is confirmed
// (title + category are entered alongside the upload). The resulting
// mediaId is passed as `asset_id` on POST /resources/, and the backend
// stamps target_id onto the asset at that point instead (see
// PartnerResourceSerializer.create in apps/partners/serializers.py).
import RNFS from 'react-native-fs';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const S3_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

export type PartnerResourceMediaMeta = {
  mediaId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type ResourceUploadStatus = 'initiating' | 'uploading' | 'confirming' | 'done';
export type ResourceUploadProgress = { status: ResourceUploadStatus; progress: number };

type PickedFile = { uri: string; name?: string | null; type?: string | null; size?: number | null };

async function resolveFileSize(uri: string, declaredSize?: number | null): Promise<number> {
  if (declaredSize && declaredSize > 0) return declaredSize;
  try {
    const stat = await RNFS.stat(uri.replace(/^file:\/\//, ''));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

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

export async function uploadPartnerResourceMedia(opts: {
  file: PickedFile;
  onProgress?: (update: ResourceUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<PartnerResourceMediaMeta> {
  const { file, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  const size = await resolveFileSize(file.uri, file.size);
  const prepared = {
    uri: file.uri,
    name: file.name || `resource_${Date.now()}`,
    type: file.type || 'application/octet-stream',
    size,
  };
  throwIfAborted();

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    { context: 'partner_resource', filename: prepared.name, content_type: prepared.type, size_bytes: prepared.size },
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
