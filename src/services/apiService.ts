// src/services/apiService.ts
type HeadersInit = Record<string, string>;

// Default headers that apply when we're sending JSON
const defaultJsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

/**
 * Merge headers, but only apply default JSON headers if we're not
 * sending FormData. For FormData, Content-Type must be omitted so
 * fetch can set the correct multipart boundary.
 */
const withHeaders = (headers: HeadersInit | undefined, isFormData: boolean) => {
  const base: HeadersInit = isFormData ? {} : defaultJsonHeaders;
  return {
    ...base,
    ...(headers ?? {}),
  };
};

/**
 * Robust FormData detection for React Native
 */
const isFormDataLike = (body: any): boolean => {
  return (
    typeof FormData !== 'undefined' &&
    (body instanceof FormData ||
      (body &&
        typeof body === 'object' &&
        typeof (body as any).append === 'function' &&
        Array.isArray((body as any)._parts)))
  );
};

const assertSecureRequestUrl = (url: string): void => {
  if (__DEV__) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Blocked request: invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Blocked insecure request in production build');
  }
};

const REQUEST_TIMEOUT_MS = 45_000;
// FormData bodies (media attachments — photos, video, audio, documents)
// routinely take well over 45s to upload on an ordinary mobile connection,
// not just a stalled one. Using the same short timeout as a small JSON
// payload made large-but-healthy uploads abort mid-transfer, which the
// post/patch retry logic then retried 2 more times against the identical
// slow connection — the compounding cause of broadcast-item creation
// appearing to "hang" for minutes before finally failing.
const UPLOAD_TIMEOUT_MS = 120_000;

const safeFetch = (url: string, init: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS) => {
  assertSecureRequestUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

const apiService = {
  get: (url: string, headers?: HeadersInit) =>
    safeFetch(url, {
      method: 'GET',
      // GET has no body, so treat as JSON-style headers (no body anyway)
      headers: withHeaders(headers, false),
    }),

  post: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return safeFetch(url, {
      method: 'POST',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    }, isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  },

  put: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return safeFetch(url, {
      method: 'PUT',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    }, isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  },

  patch: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return safeFetch(url, {
      method: 'PATCH',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    }, isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  },

  delete: (url: string, headers?: HeadersInit) =>
    safeFetch(url, {
      method: 'DELETE',
      headers: withHeaders(headers, false),
    }),
};

export default apiService;
