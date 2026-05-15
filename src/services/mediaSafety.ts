export type MediaSafetyStatus =
  | 'pending_review'
  | 'passed'
  | 'blocked'
  | 'failed'
  | 'not_configured'
  | string;

export type MediaSafetyPayload = {
  status?: MediaSafetyStatus;
  quarantined?: boolean;
  requiresReview?: boolean;
  message?: string;
  policyVersion?: string;
};

export const KIS_UPLOAD_REVIEW_MESSAGE =
  'Your upload is being checked for KIS family-safety standards before it is made visible.';

export const KIS_UPLOAD_BLOCKED_MESSAGE =
  'This upload cannot be accepted on KIS. KIS is a Christian, family-safe platform and does not allow pornographic, sexually explicit, exploitative, or unsafe media anywhere.';

export const normalizeUploadContext = (value?: string | null) =>
  String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_') || 'general';

export const getMediaSafetyMessage = (payload?: MediaSafetyPayload | null) => {
  if (!payload) return null;
  if (payload.status === 'blocked') return payload.message || KIS_UPLOAD_BLOCKED_MESSAGE;
  if (payload.quarantined || payload.requiresReview || payload.status === 'pending_review') {
    return payload.message || KIS_UPLOAD_REVIEW_MESSAGE;
  }
  return payload.message || null;
};

export const isMediaSafetyBlocked = (payload?: MediaSafetyPayload | null) =>
  payload?.status === 'blocked';

export const isMediaSafetyPendingReview = (payload?: MediaSafetyPayload | null) =>
  Boolean(payload?.quarantined || payload?.requiresReview || payload?.status === 'pending_review');
