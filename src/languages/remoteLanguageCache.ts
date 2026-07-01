import RNFS from 'react-native-fs';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KIS_DOCUMENT_ROOT } from '@/storage/permanentMediaStorage';

export type TranslationDictionary = Record<string, string>;

const LANGUAGES_DIR = `${KIS_DOCUMENT_ROOT}/Languages`;

const cachedFilePath = (code: string) => `${LANGUAGES_DIR}/${code}.json`;

export const readCachedLanguageFile = async (code: string): Promise<TranslationDictionary | null> => {
  try {
    const exists = await RNFS.exists(cachedFilePath(code));
    if (!exists) return null;
    const raw = await RNFS.readFile(cachedFilePath(code), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCachedLanguageFile = async (code: string, dictionary: TranslationDictionary): Promise<void> => {
  try {
    await RNFS.mkdir(LANGUAGES_DIR).catch(() => {});
    await RNFS.writeFile(cachedFilePath(code), JSON.stringify(dictionary), 'utf8');
  } catch {
    // Non-fatal — the dictionary is still usable in-memory for this session.
  }
};

export const downloadLanguageFile = async (code: string): Promise<TranslationDictionary | null> => {
  const res = await getRequest(ROUTES.localization.languageFile(code), {
    errorMessage: '',
  });
  if (!res?.success || !res.data || typeof res.data !== 'object') return null;
  await writeCachedLanguageFile(code, res.data);
  return res.data as TranslationDictionary;
};

export const loadLanguageDictionary = async (code: string): Promise<TranslationDictionary | null> => {
  const cached = await readCachedLanguageFile(code);
  if (cached) return cached;
  return downloadLanguageFile(code);
};
