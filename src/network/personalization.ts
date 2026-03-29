import ROUTES from './index';
import { postRequest } from './post';

export type FeedType = 'broadcast' | 'community' | 'partner';

export type FeedEventPayload = {
  feedType: FeedType;
  event: string;
  targetId?: string;
  weight?: number;
  durationMs?: number;
  metadata?: Record<string, any> | null;
};

export const logFeedEvent = async (payload: FeedEventPayload) => {
  try {
    const body = {
      feed_type: payload.feedType,
      event: payload.event,
      target_id: payload.targetId,
      weight: payload.weight,
      duration_ms: payload.durationMs,
      metadata: payload.metadata,
    };
    const res = await postRequest(ROUTES.personalization.events, body, {
      errorMessage: '',
    });
    if (!res.success) {
      console.warn('[personalization] logFeedEvent failed', res.message);
    }
  } catch (error) {
    console.warn('[personalization] logFeedEvent failed', error);
  }
};
