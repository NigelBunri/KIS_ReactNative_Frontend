// src/network/uploadIntentContract.ts
//
// The contract for POST .../uploads/initiate's response, and the one place
// that decides what gets sent to POST .../uploads/:id/confirm. Shared by
// every backend that speaks this handshake (Nest chat uploads, Django
// marketplace/commerce uploads, Django profile-image uploads) — the shape
// is identical across all of them by design (see each backend's
// upload_intent module), so there is exactly one place in the client that
// resolves it.
//
// Root cause this exists to prevent recurring: a storage key is always
// date-prefixed ("2026-08-02/<uuid>-name.mp4") and therefore always
// contains '/'. A value containing '/' cannot survive as a single REST
// path segment — even URL-encoded as %2F, neither Fastify's nor Django's
// router decodes it back to '/' for route matching, so building the
// confirm URL from a key 404s with "Cannot POST .../uploads/<key>/confirm"
// before the request ever reaches application code. This is not
// file-type- or backend-specific: every upload through a signed-URL flow
// goes through this exact same extraction logic, so a wrong field pick
// here breaks all of them identically.

export type InitiateUploadResponse = {
  uploadId: string;
  storageKey: string;
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresInSeconds?: number;
};

export class InvalidUploadIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUploadIntentError';
  }
}

// A storage key always has a '/' (date prefix) and ends in a file
// extension; an upload intent id never does. Used as a defense-in-depth
// guard even when a caller somehow ends up with the wrong field.
const looksLikeStorageKey = (value: string) => value.includes('/') || /\.[a-z0-9]{2,8}$/i.test(value);

/**
 * Extracts and validates the upload-intent id + presigned PUT url from a
 * raw POST .../uploads/initiate response, for use in the confirm step.
 *
 * Deliberately does NOT fall back to storageKey/key/objectKey/uploadUrl/
 * filename for the id — any of those would silently reintroduce the
 * "Cannot POST .../uploads/<key>/confirm" bug. Throws
 * InvalidUploadIntentError before any network call if the response
 * doesn't carry a usable id.
 */
export function resolveUploadIntent(initiateRes: any): {
  uploadId: string;
  uploadUrl: string;
  headers?: Record<string, unknown>;
  storageKey?: string;
} {
  const uploadId: unknown =
    initiateRes?.uploadId ??
    initiateRes?.intentId ??
    initiateRes?.upload_id ??
    initiateRes?.id;

  if (!uploadId || typeof uploadId !== 'string') {
    throw new InvalidUploadIntentError('Upload initiation did not return an upload intent ID.');
  }
  if (looksLikeStorageKey(uploadId)) {
    throw new InvalidUploadIntentError(
      'Invalid upload confirmation ID: storage key received instead of upload intent ID.',
    );
  }

  const uploadUrl: unknown = initiateRes?.uploadUrl ?? initiateRes?.upload_url;
  if (!uploadUrl || typeof uploadUrl !== 'string') {
    throw new InvalidUploadIntentError('Unable to start upload.');
  }

  const headers: Record<string, unknown> | undefined = initiateRes?.headers ?? initiateRes?.required_headers;

  // Kept for metadata/debugging/cleanup only — callers must never use this
  // to build the confirm URL.
  const storageKey: string | undefined =
    initiateRes?.storageKey ?? initiateRes?.key ?? initiateRes?.objectKey ?? initiateRes?.object_key;

  return { uploadId, uploadUrl, headers, storageKey };
}

// Nest's chat backend confirm route: /uploads/:id/confirm (no prefix, no
// trailing slash). Django backends use a different prefix/trailing-slash
// convention — see buildDjangoMediaConfirmPath below.
export const buildConfirmPath = (uploadId: string) => `/uploads/${encodeURIComponent(uploadId)}/confirm`;

// Django's generic media confirm route (apps/media/urls.py):
// /api/v1/media/uploads/<uuid:upload_id>/confirm/ — shared by every Django
// upload context (profile images, marketplace media, ...); callers pass
// their own API_BASE_URL prefix.
export const buildDjangoMediaConfirmPath = (uploadId: string) =>
  `/api/v1/media/uploads/${encodeURIComponent(uploadId)}/confirm/`;
