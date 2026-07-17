import ROUTES from '../src/network';
import { postRequest } from '@/network/post';
import ImageResizer from 'react-native-image-resizer';
import { uploadProfileImage } from '../src/screens/tabs/profile/profileImageUpload';

jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));
jest.mock('react-native-image-resizer', () => ({
  createResizedImage: jest.fn(),
}));

const mockedPostRequest = postRequest as jest.MockedFunction<typeof postRequest>;
const mockedCreateResizedImage = ImageResizer.createResizedImage as jest.MockedFunction<
  typeof ImageResizer.createResizedImage
>;

type FakeXhrOutcome = 'success' | 'server-error' | 'network-error' | 'timeout';

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];
  static nextOutcome: FakeXhrOutcome = 'success';
  static nextStatus = 200;

  method = '';
  url = '';
  timeout = 0;
  status = 0;
  responseText = '';
  headers: Record<string, string> = {};
  upload: { onprogress: ((event: any) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  sentBody: any;

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: any) {
    this.sentBody = body;
    const outcome = FakeXMLHttpRequest.nextOutcome;
    // Simulate one progress tick before settling, like a real upload.
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    if (outcome === 'timeout') {
      this.ontimeout?.();
      return;
    }
    if (outcome === 'network-error') {
      this.onerror?.();
      return;
    }
    this.status = outcome === 'server-error' ? 403 : FakeXMLHttpRequest.nextStatus;
    this.responseText = outcome === 'server-error' ? '<Error>AccessDenied</Error>' : '';
    this.onload?.();
  }
}

describe('profileImageUpload.uploadProfileImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FakeXMLHttpRequest.instances = [];
    FakeXMLHttpRequest.nextOutcome = 'success';
    FakeXMLHttpRequest.nextStatus = 200;
    (global as any).XMLHttpRequest = FakeXMLHttpRequest;

    mockedCreateResizedImage.mockResolvedValue({
      uri: 'file:///tmp/resized.jpg',
      path: 'file:///tmp/resized.jpg',
      size: 123456,
      name: 'resized.jpg',
      width: 1024,
      height: 1024,
    } as any);
  });

  const pickedFile = { uri: 'file:///tmp/original.heic', name: 'IMG_0001.heic', type: 'image/heic' };

  it('compresses, initiates, PUTs with only the required headers, and confirms', async () => {
    mockedPostRequest.mockImplementation(async (url: string) => {
      if (url === ROUTES.mediaUploads.profileImageInitiate) {
        return {
          success: true,
          data: {
            upload_id: 'upload-1',
            upload_url: 'https://bucket.s3.amazonaws.com/private/profile-images/u1/x.jpg?X-Amz-Signature=abc',
            object_key: 'private/profile-images/u1/x.jpg',
            expires_in: 600,
            required_headers: { 'Content-Type': 'image/jpeg' },
          },
          message: '',
        } as any;
      }
      if (url === ROUTES.mediaUploads.confirm('upload-1')) {
        return {
          success: true,
          data: { upload_id: 'upload-1', status: 'confirmed', profile: { avatar_url: 'https://cdn/x.jpg' } },
          message: '',
        } as any;
      }
      throw new Error(`Unexpected postRequest call: ${url}`);
    });

    const progressUpdates: any[] = [];
    const result = await uploadProfileImage('avatar', pickedFile, update => progressUpdates.push(update));

    // HEIC input was resized/re-encoded to JPEG before upload.
    expect(mockedCreateResizedImage).toHaveBeenCalledWith(
      pickedFile.uri,
      1024,
      1024,
      'JPEG',
      85,
      0,
    );

    expect(mockedPostRequest).toHaveBeenCalledWith(
      ROUTES.mediaUploads.profileImageInitiate,
      expect.objectContaining({ content_type: 'image/jpeg', size_bytes: 123456, kind: 'avatar' }),
      expect.any(Object),
    );

    const xhr = FakeXMLHttpRequest.instances[0];
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toContain('X-Amz-Signature');
    // Only the server-issued required headers were sent to S3 — critically,
    // no Authorization header (the Django bearer token must never reach S3).
    expect(xhr.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    expect(xhr.headers.Authorization).toBeUndefined();

    expect(mockedPostRequest).toHaveBeenCalledWith(
      ROUTES.mediaUploads.confirm('upload-1'),
      { upload_id: 'upload-1' },
      expect.any(Object),
    );

    expect(result.status).toBe('confirmed');
    expect(progressUpdates.map(u => u.status)).toEqual([
      'compressing',
      'initiating',
      'uploading',
      'uploading',
      'confirming',
      'done',
    ]);
  });

  it('rejects when S3 responds with a non-2xx status, without ever confirming', async () => {
    FakeXMLHttpRequest.nextOutcome = 'server-error';
    mockedPostRequest.mockImplementation(async (url: string) => {
      if (url === ROUTES.mediaUploads.profileImageInitiate) {
        return {
          success: true,
          data: {
            upload_id: 'upload-2',
            upload_url: 'https://bucket.s3.amazonaws.com/x.jpg?sig=abc',
            required_headers: { 'Content-Type': 'image/jpeg' },
          },
          message: '',
        } as any;
      }
      throw new Error(`Unexpected postRequest call: ${url}`);
    });

    await expect(uploadProfileImage('avatar', pickedFile)).rejects.toThrow(
      'Image upload to storage failed. Please try again.',
    );
    expect(mockedPostRequest).not.toHaveBeenCalledWith(
      ROUTES.mediaUploads.confirm('upload-2'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('surfaces the initiate endpoint error message without attempting an upload', async () => {
    mockedPostRequest.mockResolvedValueOnce({
      success: false,
      message: 'This file type is not allowed.',
      data: {},
    } as any);

    await expect(uploadProfileImage('avatar', pickedFile)).rejects.toThrow(
      'This file type is not allowed.',
    );
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);
  });
});
