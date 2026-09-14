const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockGetItem(...args),
    setItem: (...args: any[]) => mockSetItem(...args),
    removeItem: (...args: any[]) => mockRemoveItem(...args),
  },
}));

import { getCachedTranslation, setCachedTranslation, clearCachedTranslation } from '../translationCache';

describe('translationCache', () => {
  beforeEach(() => jest.clearAllMocks());

  it('round-trips a stored value through get/set (same shape)', async () => {
    let stored: string | undefined;
    mockSetItem.mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    });
    mockGetItem.mockImplementation(() => Promise.resolve(stored));

    await setCachedTranslation('msg-1', 'en', { translatedText: 'Hello', sourceLanguageCode: 'fr' });
    const result = await getCachedTranslation('msg-1', 'en');
    expect(result).toEqual({ translatedText: 'Hello', sourceLanguageCode: 'fr' });
  });

  it('returns null on a cache miss', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(getCachedTranslation('msg-1', 'en')).resolves.toBeNull();
  });

  it('returns null instead of throwing on corrupt cached JSON', async () => {
    mockGetItem.mockResolvedValue('{not json');
    await expect(getCachedTranslation('msg-1', 'en')).resolves.toBeNull();
  });

  it('is a no-op for missing messageId/targetLanguageCode', async () => {
    await getCachedTranslation('', 'en');
    await setCachedTranslation('msg-1', '', { translatedText: 'x', sourceLanguageCode: 'en' });
    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('skips writing translations longer than the cacheable-size ceiling', async () => {
    const huge = 'a'.repeat(9_000);
    await setCachedTranslation('msg-1', 'en', { translatedText: huge, sourceLanguageCode: 'fr' });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('swallows a native storage write failure rather than throwing (best-effort cache)', async () => {
    mockSetItem.mockRejectedValue(new Error('Keychain write failed'));
    await expect(
      setCachedTranslation('msg-1', 'en', { translatedText: 'Hello', sourceLanguageCode: 'fr' }),
    ).resolves.toBeUndefined();
  });

  it('clearCachedTranslation swallows errors too', async () => {
    mockRemoveItem.mockRejectedValue(new Error('boom'));
    await expect(clearCachedTranslation('msg-1', 'en')).resolves.toBeUndefined();
  });
});
