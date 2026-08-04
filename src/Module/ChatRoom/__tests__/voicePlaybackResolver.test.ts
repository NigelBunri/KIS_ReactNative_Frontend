jest.mock('@/network', () => ({
  NEST_API_BASE_URL: 'https://kis-nest-backend.onrender.com',
}));

jest.mock('@/security/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('token-abc'),
}));

import {
  cachedVoicePlaybackUrl,
  clearVoicePlaybackCache,
  primeVoicePlaybackCache,
  resolveFreshVoicePlaybackUrl,
  VoicePlaybackError,
} from '../voicePlaybackResolver';
import { getAccessToken } from '@/security/authStorage';

const jsonResponse = (status: number, body: any) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const NEAR_EXPIRY = new Date(Date.now() + 5_000).toISOString(); // inside the 30s safety margin

describe('voicePlaybackResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessToken as jest.Mock).mockResolvedValue('token-abc');
    clearVoicePlaybackCache('msg-1');
    clearVoicePlaybackCache('msg-2');
  });

  it('requests the correct Nest endpoint with a bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { url: 'https://s3/x', expiresAt: FUTURE }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await resolveFreshVoicePlaybackUrl('msg-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://kis-nest-backend.onrender.com/chat/messages/msg-1/voice/playback-url',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
  });

  it('reuses a fresh cached url without a network call', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { url: 'https://s3/x', expiresAt: FUTURE }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const first = await resolveFreshVoicePlaybackUrl('msg-1');
    const second = await resolveFreshVoicePlaybackUrl('msg-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(cachedVoicePlaybackUrl('msg-1')).toEqual(first);
  });

  it('refreshes when the cached url is within the expiry safety margin', async () => {
    primeVoicePlaybackCache('msg-1', { url: 'https://s3/stale', expiresAt: NEAR_EXPIRY });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { url: 'https://s3/fresh', expiresAt: FUTURE }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const result = await resolveFreshVoicePlaybackUrl('msg-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://s3/fresh');
  });

  it('deduplicates simultaneous requests for the same message', async () => {
    let resolveFetch: (v: Response) => void;
    const fetchMock = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const p1 = resolveFreshVoicePlaybackUrl('msg-1');
    const p2 = resolveFreshVoicePlaybackUrl('msg-1');

    resolveFetch!(jsonResponse(200, { url: 'https://s3/x', expiresAt: FUTURE }));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('does NOT deduplicate requests for different messages', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { url: 'https://s3/a', expiresAt: FUTURE }))
      .mockResolvedValueOnce(jsonResponse(200, { url: 'https://s3/b', expiresAt: FUTURE }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const [a, b] = await Promise.all([resolveFreshVoicePlaybackUrl('msg-1'), resolveFreshVoicePlaybackUrl('msg-2')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a.url).toBe('https://s3/a');
    expect(b.url).toBe('https://s3/b');
  });

  it('force bypasses a fresh cache entry (used after a playback failure)', async () => {
    primeVoicePlaybackCache('msg-1', { url: 'https://s3/old', expiresAt: FUTURE });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { url: 'https://s3/new', expiresAt: FUTURE }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const result = await resolveFreshVoicePlaybackUrl('msg-1', { force: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://s3/new');
  });

  it('maps 401 to an unauthorized VoicePlaybackError and does not cache', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));

    await expect(resolveFreshVoicePlaybackUrl('msg-1')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(cachedVoicePlaybackUrl('msg-1')).toBeNull();
  });

  it('maps 403 to a forbidden VoicePlaybackError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(403, {}));

    await expect(resolveFreshVoicePlaybackUrl('msg-1')).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('maps 404 to a not_found VoicePlaybackError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {}));

    await expect(resolveFreshVoicePlaybackUrl('msg-1')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('maps a network failure to a network-kind VoicePlaybackError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(resolveFreshVoicePlaybackUrl('msg-1')).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws unauthorized without a network call when signed out', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const fetchMock = jest.fn();
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await expect(resolveFreshVoicePlaybackUrl('msg-1')).rejects.toBeInstanceOf(VoicePlaybackError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty messageId without a network call', async () => {
    const fetchMock = jest.fn();
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await expect(resolveFreshVoicePlaybackUrl('')).rejects.toMatchObject({ kind: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
