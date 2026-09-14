import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockIsSupported = jest.fn();
const mockDetectLanguage = jest.fn();
const mockGetModelStatus = jest.fn();
const mockDownloadModel = jest.fn();
const mockTranslate = jest.fn();

jest.mock('@/services/translation/TranslationService', () => ({
  __esModule: true,
  default: {
    isSupported: (...args: any[]) => mockIsSupported(...args),
    detectLanguage: (...args: any[]) => mockDetectLanguage(...args),
    getModelStatus: (...args: any[]) => mockGetModelStatus(...args),
    downloadModel: (...args: any[]) => mockDownloadModel(...args),
    translate: (...args: any[]) => mockTranslate(...args),
  },
}));

const mockGetCachedTranslation = jest.fn();
const mockSetCachedTranslation = jest.fn();
jest.mock('@/services/translation/translationCache', () => ({
  getCachedTranslation: (...args: any[]) => mockGetCachedTranslation(...args),
  setCachedTranslation: (...args: any[]) => mockSetCachedTranslation(...args),
}));

import { useMessageTranslation, type UseMessageTranslationResult } from '../useMessageTranslation';

function Reader({
  messageId,
  text,
  targetLanguageCode,
  onRead,
}: {
  messageId: string;
  text: string;
  targetLanguageCode: string;
  onRead: (v: UseMessageTranslationResult) => void;
}) {
  onRead(useMessageTranslation({ messageId, text, targetLanguageCode }));
  return null;
}

async function renderHookOnce(props: { messageId: string; text: string; targetLanguageCode: string }) {
  let latest!: UseMessageTranslationResult;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Reader {...props} onRead={(v) => { latest = v; }} />,
    );
  });
  return {
    get current() { return latest; },
    rerender: async (next: typeof props) => {
      await act(async () => {
        renderer.update(<Reader {...next} onRead={(v) => { latest = v; }} />);
      });
    },
  };
}

describe('useMessageTranslation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupported.mockResolvedValue(true);
    mockGetCachedTranslation.mockResolvedValue(null);
  });

  it('starts idle and hidden, doing nothing until translate() is called', async () => {
    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    expect(hook.current.phase).toBe('idle');
    expect(hook.current.visible).toBe(false);
    expect(mockIsSupported).not.toHaveBeenCalled();
  });

  it('translates end-to-end when the model is already downloaded', async () => {
    mockDetectLanguage.mockResolvedValue({ languageCode: 'fr', confidence: 1 });
    mockGetModelStatus.mockResolvedValue('downloaded');
    mockTranslate.mockResolvedValue({ translatedText: 'Hello', sourceLanguageCode: 'fr', targetLanguageCode: 'en' });

    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });

    expect(hook.current.phase).toBe('idle');
    expect(hook.current.visible).toBe(true);
    expect(hook.current.translatedText).toBe('Hello');
    expect(hook.current.sourceLanguageCode).toBe('fr');
    expect(mockSetCachedTranslation).toHaveBeenCalledWith('m1', 'en', {
      translatedText: 'Hello',
      sourceLanguageCode: 'fr',
    });
  });

  it('serves a cached translation without calling detectLanguage/translate at all', async () => {
    mockGetCachedTranslation.mockResolvedValue({ translatedText: 'Cached hello', sourceLanguageCode: 'fr' });

    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });

    expect(hook.current.translatedText).toBe('Cached hello');
    expect(hook.current.visible).toBe(true);
    expect(mockDetectLanguage).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('moves to needs_download when the model pair is missing, then translates after confirmDownload()', async () => {
    mockDetectLanguage.mockResolvedValue({ languageCode: 'fr', confidence: 1 });
    mockGetModelStatus.mockResolvedValueOnce('not_downloaded').mockResolvedValue('downloaded');
    mockDownloadModel.mockResolvedValue(undefined);
    mockTranslate.mockResolvedValue({ translatedText: 'Hello', sourceLanguageCode: 'fr', targetLanguageCode: 'en' });

    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });

    expect(hook.current.phase).toBe('needs_download');
    expect(hook.current.neededModelLabel).toMatch(/French/i);
    expect(mockTranslate).not.toHaveBeenCalled();

    await act(async () => { await hook.current.confirmDownload(); });

    expect(mockDownloadModel).toHaveBeenCalledWith('fr', 'en');
    expect(hook.current.phase).toBe('idle');
    expect(hook.current.translatedText).toBe('Hello');
  });

  it('reports an error state when the device does not support on-device translation', async () => {
    mockIsSupported.mockResolvedValue(false);
    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });

    expect(hook.current.phase).toBe('error');
    expect(hook.current.errorMessage).toMatch(/available/i);
  });

  it('reports an error rather than translating when the message is already in the target language', async () => {
    mockDetectLanguage.mockResolvedValue({ languageCode: 'en', confidence: 1 });
    const hook = await renderHookOnce({ messageId: 'm1', text: 'Hello there', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });

    expect(hook.current.phase).toBe('error');
    expect(mockGetModelStatus).not.toHaveBeenCalled();
  });

  it('toggleOriginal flips visibility without re-fetching anything', async () => {
    mockDetectLanguage.mockResolvedValue({ languageCode: 'fr', confidence: 1 });
    mockGetModelStatus.mockResolvedValue('downloaded');
    mockTranslate.mockResolvedValue({ translatedText: 'Hello', sourceLanguageCode: 'fr', targetLanguageCode: 'en' });

    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });
    expect(hook.current.visible).toBe(true);

    act(() => { hook.current.toggleOriginal(); });
    expect(hook.current.visible).toBe(false);
    expect(hook.current.translatedText).toBe('Hello'); // not discarded

    act(() => { hook.current.toggleOriginal(); });
    expect(hook.current.visible).toBe(true);
    expect(mockTranslate).toHaveBeenCalledTimes(1); // never re-fetched
  });

  it('resets all state when the message id changes (row recycling)', async () => {
    mockDetectLanguage.mockResolvedValue({ languageCode: 'fr', confidence: 1 });
    mockGetModelStatus.mockResolvedValue('downloaded');
    mockTranslate.mockResolvedValue({ translatedText: 'Hello', sourceLanguageCode: 'fr', targetLanguageCode: 'en' });

    const hook = await renderHookOnce({ messageId: 'm1', text: 'Bonjour', targetLanguageCode: 'en' });
    await act(async () => { await hook.current.translate(); });
    expect(hook.current.visible).toBe(true);

    await hook.rerender({ messageId: 'm2', text: 'Guten Tag', targetLanguageCode: 'en' });
    expect(hook.current.visible).toBe(false);
    expect(hook.current.translatedText).toBeNull();
    expect(hook.current.phase).toBe('idle');
  });
});
