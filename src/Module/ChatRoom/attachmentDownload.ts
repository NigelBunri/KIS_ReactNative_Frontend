// src/Module/ChatRoom/attachmentDownload.ts
//
// Single entry point for turning a message attachment's stable id into an
// authorized, fetchable URL. Replaces trusting a client-held `url`/`key`
// directly — the backend re-checks conversation membership, expiry,
// view-once consumption and quarantine state on every call and hands back
// a short-lived link (a fresh S3 presigned GET, or an authenticated local
// stream path) instead of a permanent one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '@/security/authStorage';
import { NEST_API_BASE_URL } from '@/network';

export type AttachmentDownloadErrorKind =
  | 'unauthorized' // 401 — no/expired session
  | 'forbidden' // 403 — not a conversation member, or quarantined
  | 'not_found' // 404 — unknown attachment / object missing from storage
  | 'expired' // 410 — TTL passed or view-once already consumed
  | 'bad_request'
  | 'network'
  | 'unknown';

export class AttachmentDownloadError extends Error {
  kind: AttachmentDownloadErrorKind;
  status?: number;

  constructor(kind: AttachmentDownloadErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AttachmentDownloadError';
    this.kind = kind;
    this.status = status;
  }
}

export type ResolvedAttachmentDownload = {
  attachmentId: string;
  downloadUrl: string;
  expiresInSeconds: number;
  originalName: string;
  mimeType: string;
  size: number;
};

const kindForStatus = (status: number): AttachmentDownloadErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 410) return 'expired';
  if (status === 400) return 'bad_request';
  return 'unknown';
};

/**
 * Calls GET /uploads/:attachmentId/download-url on the Nest chat backend.
 * Throws AttachmentDownloadError with a typed `kind` on any non-2xx
 * response so callers can render the right UI state (expired, forbidden,
 * retry, ...) instead of a generic failure.
 */
export const requestAttachmentDownloadUrl = async (
  attachmentId: string,
  options?: { retriedAfterRefresh?: boolean },
): Promise<ResolvedAttachmentDownload> => {
  if (!attachmentId) {
    throw new AttachmentDownloadError('bad_request', 'attachmentId is required');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new AttachmentDownloadError('unauthorized', 'Not signed in');
  }
  const deviceId = await AsyncStorage.getItem('device_id');

  const base = NEST_API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/uploads/${encodeURIComponent(attachmentId)}/download-url`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
      },
    });
  } catch (error) {
    throw new AttachmentDownloadError(
      'network',
      error instanceof Error ? error.message : 'Network request failed',
    );
  }

  if (!response.ok) {
    // A stale/expired access token surfaces as 401 here even though the
    // user is otherwise signed in — refresh once and retry, mirroring the
    // retry-once behaviour uploadFileToBackend.ts already uses for uploads.
    if (response.status === 401 && !options?.retriedAfterRefresh) {
      return requestAttachmentDownloadUrl(attachmentId, { retriedAfterRefresh: true });
    }
    let bodyMessage: string | undefined;
    try {
      const body = await response.json();
      bodyMessage = typeof body?.message === 'string' ? body.message : undefined;
    } catch {
      /* non-JSON error body — ignore */
    }
    throw new AttachmentDownloadError(
      kindForStatus(response.status),
      bodyMessage || `Download authorization failed (${response.status})`,
      response.status,
    );
  }

  const data = await response.json();
  if (!data?.downloadUrl) {
    throw new AttachmentDownloadError('unknown', 'Server did not return a download URL');
  }
  return {
    attachmentId: String(data.attachmentId ?? attachmentId),
    downloadUrl: String(data.downloadUrl),
    expiresInSeconds: Number(data.expiresInSeconds ?? 300),
    originalName: String(data.originalName ?? ''),
    mimeType: String(data.mimeType ?? 'application/octet-stream'),
    size: Number(data.size ?? 0),
  };
};
