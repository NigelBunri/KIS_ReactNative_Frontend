// src/Module/ChatRoom/uploadIntentContract.ts
//
// The contract for POST /uploads/initiate's response, and the one place
// that decides what gets sent to POST /uploads/:id/confirm.
//
// Root cause this exists to prevent recurring: a storage key is always
// date-prefixed ("2026-08-02/<uuid>-name.mp4") and therefore always
// contains '/'. A value containing '/' cannot survive as a single REST
// path segment — even URL-encoded as %2F, Fastify's router does not decode
// it back to '/' for route matching, so building the confirm URL from a
// key 404s with "Cannot POST /uploads/<key>/confirm" before the request
// ever reaches application code. This is not file-type-specific: every
// upload through the signed-URL flow (image, video, audio, document) goes
// through this exact same extraction logic, so a wrong field pick here
// breaks all of them identically, not just video.

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
 * raw POST /uploads/initiate response, for use in the confirm step.
 *
 * Deliberately does NOT fall back to storageKey/key/objectKey/uploadUrl/
 * filename for the id — any of those would silently reintroduce the
 * "Cannot POST /uploads/<key>/confirm" bug. Throws InvalidUploadIntentError
 * before any network call if the response doesn't carry a usable id.
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

export const buildConfirmPath = (uploadId: string) => `/uploads/${encodeURIComponent(uploadId)}/confirm`;
