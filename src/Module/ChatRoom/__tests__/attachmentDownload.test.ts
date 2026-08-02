jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('device-123'),
}));

jest.mock('@/security/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('token-abc'),
}));

jest.mock('@/network', () => ({
  NEST_API_BASE_URL: 'https://kis-nest-backend.onrender.com',
}));

import { AttachmentDownloadError, requestAttachmentDownloadUrl } from '../attachmentDownload';
import { getAccessToken } from '@/security/authStorage';

const jsonResponse = (status: number, body: any) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('requestAttachmentDownloadUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessToken as jest.Mock).mockResolvedValue('token-abc');
  });

  it('requests by attachment id and returns the normalized result', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        attachmentId: 'att-1',
        downloadUrl: 'https://s3.example.com/signed?sig=xyz',
        expiresInSeconds: 300,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }),
    );
    // @ts-expect-error test override
    global.fetch = fetchMock;

    const result = await requestAttachmentDownloadUrl('att-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://kis-nest-backend.onrender.com/uploads/att-1/download-url',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
      }),
    );
    expect(result.downloadUrl).toBe('https://s3.example.com/signed?sig=xyz');
    expect(result.originalName).toBe('photo.jpg');
  });

  it('URL-encodes the attachment id', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { downloadUrl: 'https://x/y' }));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await requestAttachmentDownloadUrl('weird id/with slash');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('weird id/with slash'));
  });

  it('maps 403 to a forbidden AttachmentDownloadError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(403, { message: 'no access' }));

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
    });
  });

  it('maps 404 to a not_found AttachmentDownloadError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {}));

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toMatchObject({ kind: 'not_found', status: 404 });
  });

  it('maps 410 to an expired AttachmentDownloadError', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(410, {}));

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toMatchObject({ kind: 'expired', status: 410 });
  });

  it('retries once after a 401, then surfaces unauthorized if it persists', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401, {}));
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('wraps network failures as a network-kind error', async () => {
    // @ts-expect-error test override
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws immediately without a network call when signed out', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const fetchMock = jest.fn();
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await expect(requestAttachmentDownloadUrl('att-1')).rejects.toBeInstanceOf(AttachmentDownloadError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing attachmentId without a network call', async () => {
    const fetchMock = jest.fn();
    // @ts-expect-error test override
    global.fetch = fetchMock;

    await expect(requestAttachmentDownloadUrl('')).rejects.toMatchObject({ kind: 'bad_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
