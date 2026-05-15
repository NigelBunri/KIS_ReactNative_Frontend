import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

export type ModerationOperationKind = 'flag' | 'media_safety_scan' | 'channel_moderation_record';

export type ModerationOperation = {
  id: string;
  kind: ModerationOperationKind;
  target_type: string;
  target_id: string;
  status: string;
  severity: string;
  reason: string;
  source: string;
  created_at: string;
  context?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
};

export type ModerationOperationsResponse = {
  results: ModerationOperation[];
  summary: {
    total: number;
    flags: number;
    media_safety: number;
    channels: number;
  };
};

export type ModerationOperationAction = 'approve' | 'block' | 'dismiss' | 'escalate' | 'review' | 'note';

export const fetchModerationOperationsQueue = (params?: { source?: string; limit?: number }) =>
  getRequest(ROUTES.moderation.staffOperationsQueue, {
    params,
    errorMessage: 'Unable to load moderation operations queue.',
  });

export const submitModerationOperationAction = (payload: {
  target_type: ModerationOperationKind;
  target_id: string;
  action: ModerationOperationAction;
  notes?: string;
}) =>
  postRequest(ROUTES.moderation.staffOperationAction, payload, {
    errorMessage: 'Unable to update moderation operation.',
  });

