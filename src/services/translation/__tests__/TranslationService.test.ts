import { NativeModules } from 'react-native';

const mockIsAvailable = jest.fn();
const mockIdentifyLanguage = jest.fn();
const mockGetModelStatus = jest.fn();
const mockDownloadModel = jest.fn();
const mockDeleteModel = jest.fn();
const mockGetDownloadedModels = jest.fn();
const mockTranslate = jest.fn();

(NativeModules as any).KISTranslationModule = {
  isAvailable: (...args: any[]) => mockIsAvailable(...args),
  identifyLanguage: (...args: any[]) => mockIdentifyLanguage(...args),
  getModelStatus: (...args: any[]) => mockGetModelStatus(...args),
  downloadModel: (...args: any[]) => mockDownloadModel(...args),
  deleteModel: (...args: any[]) => mockDeleteModel(...args),
  getDownloadedModels: (...args: any[]) => mockGetDownloadedModels(...args),
  translate: (...args: any[]) => mockTranslate(...args),
};

import TranslationService from '../TranslationService';

describe('TranslationService.isSupported', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the native module result', async () => {
    mockIsAvailable.mockResolvedValue(true);
    await expect(TranslationService.isSupported()).resolves.toBe(true);
  });

  it('returns false instead of throwing when the native call rejects', async () => {
    mockIsAvailable.mockRejectedValue(new Error('boom'));
    await expect(TranslationService.isSupported()).resolves.toBe(false);
  });
});

describe('TranslationService.detectLanguage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes a BCP-47 tag down to its ISO 639-1 primary subtag', async () => {
    mockIdentifyLanguage.mockResolvedValue({ languageCode: 'en-US', confidence: 0.9 });
    const result = await TranslationService.detectLanguage('Hello there');
    expect(result).toEqual({ languageCode: 'en', confidence: 0.9 });
  });

  it('returns null for empty/whitespace-only text without calling the native module', async () => {
    const result = await TranslationService.detectLanguage('   ');
    expect(result).toBeNull();
    expect(mockIdentifyLanguage).not.toHaveBeenCalled();
  });

  it('returns null when the native module reports "und" (undetermined)', async () => {
    mockIdentifyLanguage.mockResolvedValue({ languageCode: 'und', confidence: 0 });
    await expect(TranslationService.detectLanguage('??')).resolves.toBeNull();
  });

  it('returns null instead of throwing on native failure', async () => {
    mockIdentifyLanguage.mockRejectedValue(new Error('boom'));
    await expect(TranslationService.detectLanguage('hi')).resolves.toBeNull();
  });
});

describe('TranslationService.getModelStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes normalized codes through and returns a known status verbatim', async () => {
    mockGetModelStatus.mockResolvedValue('downloaded');
    const result = await TranslationService.getModelStatus('FR-fr', 'en-US');
    expect(mockGetModelStatus).toHaveBeenCalledWith('fr', 'en');
    expect(result).toBe('downloaded');
  });

  it('maps an unrecognized native response to "unknown"', async () => {
    mockGetModelStatus.mockResolvedValue('something-unexpected');
    await expect(TranslationService.getModelStatus('fr', 'en')).resolves.toBe('unknown');
  });
});

describe('TranslationService.downloadModel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves when the native module reports success', async () => {
    mockDownloadModel.mockResolvedValue(true);
    await expect(TranslationService.downloadModel('fr', 'en')).resolves.toBeUndefined();
  });

  it('throws a plain Error when the native module reports failure', async () => {
    mockDownloadModel.mockResolvedValue(false);
    await expect(TranslationService.downloadModel('fr', 'en')).rejects.toThrow();
  });
});

describe('TranslationService.deleteModel / getDownloadedModels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deleteModel swallows native errors rather than throwing', async () => {
    mockDeleteModel.mockRejectedValue(new Error('not supported on this platform'));
    await expect(TranslationService.deleteModel('fr', 'en')).resolves.toBeUndefined();
  });

  it('getDownloadedModels normalizes codes and never throws', async () => {
    mockGetDownloadedModels.mockResolvedValue(['en-US', 'FR']);
    await expect(TranslationService.getDownloadedModels()).resolves.toEqual(['en', 'fr']);

    mockGetDownloadedModels.mockRejectedValue(new Error('boom'));
    await expect(TranslationService.getDownloadedModels()).resolves.toEqual([]);
  });
});

describe('TranslationService.translate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('detects the source language when not provided, then translates', async () => {
    mockIdentifyLanguage.mockResolvedValue({ languageCode: 'fr', confidence: 1 });
    mockTranslate.mockResolvedValue('Hello');
    const result = await TranslationService.translate({ text: 'Bonjour', targetLanguageCode: 'en' });
    expect(mockTranslate).toHaveBeenCalledWith('Bonjour', 'fr', 'en');
    expect(result).toEqual({ translatedText: 'Hello', sourceLanguageCode: 'fr', targetLanguageCode: 'en' });
  });

  it('skips detection and native translate entirely when source === target', async () => {
    const result = await TranslationService.translate({
      text: 'Hello',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'en',
    });
    expect(mockIdentifyLanguage).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(result).toEqual({ translatedText: 'Hello', sourceLanguageCode: 'en', targetLanguageCode: 'en' });
  });

  it('rejects when there is no text to translate', async () => {
    await expect(
      TranslationService.translate({ text: '   ', targetLanguageCode: 'en' }),
    ).rejects.toThrow('There is no text to translate.');
  });

  it('rejects when the source language cannot be detected', async () => {
    mockIdentifyLanguage.mockResolvedValue(null);
    await expect(
      TranslationService.translate({ text: 'xyz', targetLanguageCode: 'en' }),
    ).rejects.toThrow("Couldn't detect the message's language.");
  });

  it('rejects when the native module returns empty text', async () => {
    mockTranslate.mockResolvedValue('');
    await expect(
      TranslationService.translate({ text: 'Bonjour', sourceLanguageCode: 'fr', targetLanguageCode: 'en' }),
    ).rejects.toThrow('Translation returned no text.');
  });
});
