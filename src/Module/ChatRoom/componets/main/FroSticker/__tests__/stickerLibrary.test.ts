jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
});

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
}));

jest.mock('@/network/get', () => ({ getRequest: jest.fn() }));
jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));
jest.mock('@/network/delete', () => ({ deleteRequest: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import {
  fetchStickerLibraryPage,
  createSticker,
  saveStickerToLibrary,
  removeStickerLibraryEntry,
  resolveStickerImageUrl,
  ensureLocalStickerFile,
  cacheLocalStickerFile,
} from '../stickerLibrary';

const rawEntry = (overrides: any = {}) => ({
  id: 'entry-1',
  added_at: '2026-01-01T00:00:00.000Z',
  is_mine: true,
  sticker: {
    id: 'sticker-1',
    owner_id: 'user-1',
    asset_id: 'asset-1',
    caption_text: 'Amen',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  ...overrides,
});

describe('fetchStickerLibraryPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps the server response (snake_case) into StickerLibraryEntry objects', async () => {
    (getRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { results: [rawEntry()], meta: { page: 1, total_pages: 2, total: 40 } },
    });

    const result = await fetchStickerLibraryPage('created', 1);

    expect(result.entries).toEqual([
      {
        id: 'entry-1',
        addedAt: '2026-01-01T00:00:00.000Z',
        isMine: true,
        sticker: {
          id: 'sticker-1',
          ownerId: 'user-1',
          assetId: 'asset-1',
          captionText: 'Amen',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2);
    expect(result.total).toBe(40);
  });

  it('caches page 1 results to AsyncStorage, but not later pages', async () => {
    (getRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { results: [rawEntry()], meta: { page: 1, total_pages: 1, total: 1 } },
    });

    await fetchStickerLibraryPage('created', 1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    (AsyncStorage.setItem as jest.Mock).mockClear();
    await fetchStickerLibraryPage('created', 2);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('createSticker / saveStickerToLibrary / removeStickerLibraryEntry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('createSticker posts assetId + captionText and returns the mapped entry', async () => {
    (postRequest as jest.Mock).mockResolvedValue({ success: true, data: rawEntry() });

    const entry = await createSticker('asset-1', 'Amen');

    expect(postRequest).toHaveBeenCalledWith(
      expect.stringContaining('/stickers/'),
      { assetId: 'asset-1', captionText: 'Amen' },
    );
    expect(entry.sticker.id).toBe('sticker-1');
  });

  it('createSticker throws with the server message on failure', async () => {
    (postRequest as jest.Mock).mockResolvedValue({ success: false, message: 'You can only create a sticker from your own upload.' });

    await expect(createSticker('asset-1')).rejects.toThrow(
      'You can only create a sticker from your own upload.',
    );
  });

  it('saveStickerToLibrary posts to the save endpoint for the given sticker id', async () => {
    (postRequest as jest.Mock).mockResolvedValue({ success: true, data: rawEntry({ is_mine: false }) });

    const entry = await saveStickerToLibrary('sticker-1');

    expect(postRequest).toHaveBeenCalledWith(expect.stringContaining('/stickers/sticker-1/save/'), {});
    expect(entry.isMine).toBe(false);
  });

  it('removeStickerLibraryEntry throws on failure and resolves on success', async () => {
    (deleteRequest as jest.Mock).mockResolvedValueOnce({ success: false, message: 'Sticker library entry not found.' });
    await expect(removeStickerLibraryEntry('entry-1')).rejects.toThrow('Sticker library entry not found.');

    (deleteRequest as jest.Mock).mockResolvedValueOnce({ success: true });
    await expect(removeStickerLibraryEntry('entry-1')).resolves.toBeUndefined();
  });
});

describe('resolveStickerImageUrl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves and caches the signed URL, only hitting the network once for concurrent callers', async () => {
    (getRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { url: 'https://s3.example.com/sticker-1.png', expiresInSeconds: 900 },
    });

    const [a, b] = await Promise.all([
      resolveStickerImageUrl('asset-1'),
      resolveStickerImageUrl('asset-1'),
    ]);

    expect(a).toBe('https://s3.example.com/sticker-1.png');
    expect(b).toBe(a);
    expect(getRequest).toHaveBeenCalledTimes(1);

    // A second, later call reuses the still-fresh cached entry.
    await resolveStickerImageUrl('asset-1');
    expect(getRequest).toHaveBeenCalledTimes(1);
  });

  it('throws when the server has no usable url', async () => {
    (getRequest as jest.Mock).mockResolvedValue({ success: true, data: {} });
    await expect(resolveStickerImageUrl('asset-missing')).rejects.toThrow(
      'This sticker is no longer available.',
    );
  });
});

describe('ensureLocalStickerFile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reuses an already-cached local file without downloading again', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    await cacheLocalStickerFile('sticker-2', 'file:///cache/stickers/sticker-2.png');

    const uri = await ensureLocalStickerFile('sticker-2', 'asset-2');

    expect(uri).toBe('file:///cache/stickers/sticker-2.png');
    expect(RNFS.downloadFile).not.toHaveBeenCalled();
  });

  it('downloads from the resolved signed URL when there is no usable local copy', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (getRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { url: 'https://s3.example.com/sticker-3.png', expiresInSeconds: 900 },
    });

    const uri = await ensureLocalStickerFile('sticker-3', 'asset-3');

    expect(RNFS.downloadFile).toHaveBeenCalledWith({
      fromUrl: 'https://s3.example.com/sticker-3.png',
      toFile: '/cache/stickers/sticker-3.png',
    });
    expect(uri).toBe('file:///cache/stickers/sticker-3.png');
  });
});
