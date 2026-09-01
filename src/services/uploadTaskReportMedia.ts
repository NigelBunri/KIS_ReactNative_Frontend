// src/services/uploadTaskReportMedia.ts
//
// Upload helper for a task report attachment (any file type — video,
// audio, pdf, doc, image, zip, ...). Same three-step handshake as
// src/services/uploadTestimonyMedia.ts (initiate -> PUT to S3 -> confirm)
// but with no compression/transcoding step: report files are evidence of
// work done, so they're sent through byte-for-byte.
//
// Unlike testimony/status media, this context DOES have a pre-existing
// target to authorize against (the task itself), so `target_id` is passed
// at initiate time — apps/media/upload_intent.py stamps it straight onto
// the confirmed MediaAsset, and apps/tasks/media_hooks.py's access
// authorizer reads it back to check channel membership on every fetch.
// Callers pass the resulting `mediaId` as one of `asset_ids` on
// POST /api/v1/tasks/:taskId/submit/ (TaskSubmitSerializer.asset_ids) —
// never the storage key.

import RNFS from 'react-native-fs';
import { postRequest } from '@/network/post';
import { API_BASE_URL } from '@/network';
import ROUTES from '@/network';
import { buildDjangoMediaConfirmPath, resolveUploadIntent } from '@/network/uploadIntentContract';

const S3_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000; // reports can be large video files

export type TaskReportMediaMeta = {
  mediaId: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type TaskReportUploadStatus = 'initiating' | 'uploading' | 'confirming' | 'done';
export type TaskReportUploadProgress = { status: TaskReportUploadStatus; progress: number };

type PickedFile = { uri: string; name?: string | null; type?: string | null; size?: number | null };
type PreparedFile = { uri: string; name: string; type: string; size: number };

async function resolveFileSize(uri: string, declaredSize?: number | null): Promise<number> {
  if (declaredSize && declaredSize > 0) return declaredSize;
  try {
    const stat = await RNFS.stat(uri.replace(/^file:\/\//, ''));
    return Number(stat?.size) || 0;
  } catch {
    return 0;
  }
}

async function prepareFile(file: PickedFile): Promise<PreparedFile> {
  const size = await resolveFileSize(file.uri, file.size);
  return {
    uri: file.uri,
    name: file.name || `report_${Date.now()}`,
    type: file.type || 'application/octet-stream',
    size,
  };
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
        console.error('[uploadTaskReportMedia] S3 PUT rejected', {
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
 * Uploads a task report attachment and returns a confirmed, stable
 * `mediaId` - never a storage key, never a raw file. Callers pass that
 * mediaId in `asset_ids` on the task submit request. Throws on any
 * failure; the caller owns retry (just call this again) and duplicate-tap
 * prevention (disable the submit control while a call is in flight).
 */
export async function uploadTaskReportMedia(opts: {
  file: PickedFile;
  taskId: string;
  onProgress?: (update: TaskReportUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<TaskReportMediaMeta> {
  const { file, taskId, onProgress, signal } = opts;

  const throwIfAborted = () => {
    if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
  };

  const prepared = await prepareFile(file);
  throwIfAborted();

  onProgress?.({ status: 'initiating', progress: 0 });
  const initiateRes = await postRequest(
    ROUTES.mediaUploads.initiate,
    {
      context: 'task_report',
      filename: prepared.name,
      content_type: prepared.type,
      size_bytes: prepared.size,
      target_id: taskId,
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
