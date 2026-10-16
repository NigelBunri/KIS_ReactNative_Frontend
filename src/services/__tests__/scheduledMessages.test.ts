jest.mock('@/network/get', () => ({ getRequest: jest.fn() }));
jest.mock('@/network/patch', () => ({ patchRequest: jest.fn() }));
jest.mock('@/network/delete', () => ({ deleteRequest: jest.fn() }));
jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    scheduledMessages: {
      list: 'https://api.example.com/chat/scheduled-messages',
      create: 'https://api.example.com/chat/scheduled-messages',
      update: (id: string) => `https://api.example.com/chat/scheduled-messages/${id}`,
      cancel: (id: string) => `https://api.example.com/chat/scheduled-messages/${id}`,
    },
  },
}));

import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import {
  cancelScheduledMessage,
  fetchScheduledMessages,
  rescheduleScheduledMessage,
} from '../scheduledMessages';

describe('fetchScheduledMessages', () => {
  it('returns items and nextCursor from the {ok,data,nextCursor} response shape', async () => {
    (getRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { ok: true, data: [{ id: '1' }, { id: '2' }], nextCursor: 'abc' },
    });

    const page = await fetchScheduledMessages({ limit: 10 });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('abc');
    expect(getRequest).toHaveBeenCalledWith(
      'https://api.example.com/chat/scheduled-messages',
      { params: { limit: '10' }, errorMessage: '' },
    );
  });

  it('returns an empty page when the request fails outright', async () => {
    (getRequest as jest.Mock).mockResolvedValue({ success: false });
    const page = await fetchScheduledMessages({});
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe('cancelScheduledMessage', () => {
  it('reports success when the server confirms cancellation', async () => {
    (deleteRequest as jest.Mock).mockResolvedValue({ success: true, data: { ok: true, status: 'cancelled' } });
    const result = await cancelScheduledMessage('m1');
    expect(result).toEqual({ ok: true });
  });

  it('surfaces the real status instead of claiming success when the server refuses', async () => {
    (deleteRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { ok: false, error: 'Cannot cancel — this message is already sent', status: 'sent' },
    });
    const result = await cancelScheduledMessage('m1');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('sent');
  });

  it('reports failure when the HTTP call itself fails', async () => {
    (deleteRequest as jest.Mock).mockResolvedValue({ success: false, message: 'Network error' });
    const result = await cancelScheduledMessage('m1');
    expect(result).toEqual({ ok: false, error: 'Network error' });
  });
});

describe('rescheduleScheduledMessage', () => {
  it('sends scheduledAt and payload fields only when provided', async () => {
    (patchRequest as jest.Mock).mockResolvedValue({ success: true, data: { ok: true, data: { id: 'm1' } } });

    await rescheduleScheduledMessage('m1', { scheduledAt: '2026-01-01T00:00:00.000Z' });

    expect(patchRequest).toHaveBeenCalledWith(
      'https://api.example.com/chat/scheduled-messages/m1',
      { scheduledAt: '2026-01-01T00:00:00.000Z' },
      { errorMessage: '' },
    );
  });

  it('surfaces the already-processing status instead of a generic failure', async () => {
    (patchRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { ok: false, error: 'Cannot edit — this message is already processing', status: 'processing' },
    });
    const result = await rescheduleScheduledMessage('m1', { text: 'edited' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('processing');
  });
});
