// src/services/scheduledMessages.ts
//
// Thin REST client for ScheduledMessagesController (Nest). Used by the
// dedicated Scheduled Messages screen, which lists pending items across
// every conversation — unlike scheduling itself (useChatMessaging's
// scheduleTextMessage), which needs a specific chat room's E2EE context,
// managing an already-scheduled item is just plain CRUD against the
// server, which is always the authoritative source (never local state).

import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';

export type ScheduledMessageStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export type ScheduledMessageView = {
  id: string;
  conversationId: string;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  attempts: number;
  lastError?: string;
  sentMessageId?: string;
  createdAt: string;
  preview: {
    kind?: string;
    text?: string;
    hasAttachment?: boolean;
  };
};

export type ScheduledMessagesPage = {
  items: ScheduledMessageView[];
  nextCursor: string | null;
};

export async function fetchScheduledMessages(args: {
  limit?: number;
  cursor?: string | null;
}): Promise<ScheduledMessagesPage> {
  const params: Record<string, string> = {};
  if (args.limit) params.limit = String(args.limit);
  if (args.cursor) params.cursor = args.cursor;

  const res = await getRequest(ROUTES.scheduledMessages.list, { params, errorMessage: '' });
  const body = res?.data ?? {};
  const items = Array.isArray(body?.data) ? body.data : [];
  return { items, nextCursor: body?.nextCursor ?? null };
}

export async function cancelScheduledMessage(id: string): Promise<{ ok: boolean; error?: string; status?: ScheduledMessageStatus }> {
  const res = await deleteRequest(ROUTES.scheduledMessages.cancel(id), { errorMessage: '' });
  const body = res?.data ?? {};
  if (body?.ok === false) return { ok: false, error: body.error, status: body.status };
  if (!res?.success) return { ok: false, error: res?.message || 'Could not cancel' };
  return { ok: true };
}

export async function rescheduleScheduledMessage(
  id: string,
  args: { scheduledAt?: string; text?: string },
): Promise<{ ok: boolean; error?: string; status?: ScheduledMessageStatus; data?: ScheduledMessageView }> {
  const body: Record<string, any> = {};
  if (args.scheduledAt) body.scheduledAt = args.scheduledAt;
  if (typeof args.text === 'string') body.payload = { kind: 'text', text: args.text };

  const res = await patchRequest(ROUTES.scheduledMessages.update(id), body, { errorMessage: '' });
  const resBody = res?.data ?? {};
  if (resBody?.ok === false) return { ok: false, error: resBody.error, status: resBody.status };
  if (!res?.success) return { ok: false, error: res?.message || 'Could not reschedule' };
  return { ok: true, data: resBody?.data };
}
