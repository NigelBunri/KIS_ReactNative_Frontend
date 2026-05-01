import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  BibleOfflineManifest,
  cacheBibleChapter,
  getBibleOfflinePriorityCodes,
  readBibleOfflineManifest,
  readCachedBibleChapter,
} from '@/services/bibleOfflineCache';
import { BIBLE_PREFERENCES_UPDATED_EVENT, readLocalBiblePreference } from '@/services/biblePreferenceStore';

export type BibleTranslation = {
  id: string;
  code: string;
  name: string;
  language?: string;
  is_public?: boolean;
  is_licensed?: boolean;
};

export type BibleBook = {
  id: string;
  code: string;
  name: string;
  testament: 'OT' | 'NT';
};

export type BibleChapter = {
  id: string;
  number: number;
  book: BibleBook;
};

export type BibleVerse = {
  id: string;
  number: number;
  text: string;
};

export type BibleAudioSegment = {
  id: string;
  verse_number: number;
  start_ms: number;
  end_ms: number;
};

export type BibleAudio = {
  id: string;
  audio_file?: string | null;
  duration_ms?: number;
  segments?: BibleAudioSegment[];
};

export type BibleReaderPayload = {
  translation?: BibleTranslation | null;
  book?: BibleBook | null;
  chapter?: BibleChapter | null;
  reference?: string;
  navigation?: {
    previous?: BibleChapter | null;
    next?: BibleChapter | null;
  };
  verses: BibleVerse[];
  audio?: BibleAudio | null;
};

export type DailyDevotional = {
  id: string;
  date: string;
  passage_ref: string;
  title: string;
  content: string;
  prayer_text: string;
  scripture_refs?: string[];
  scripture_references?: string[];
  translation_detail?: BibleTranslation | null;
  partner_name?: string;
};

export type MeditationEntry = {
  id: string;
  date?: string;
  title: string;
  content: string;
  prayer_text?: string;
  body?: string;
  content_type?: string;
  media_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  scripture_refs?: string[];
  tags?: string[];
  partner_name?: string;
};

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const normalizeDaily = (item: any): DailyDevotional | null => {
  if (!item) return null;
  return {
    id: String(item.id ?? item.date ?? 'daily'),
    date: String(item.date ?? ''),
    passage_ref:
      item.passage_ref ??
      item.reference ??
      item.scripture_ref ??
      (Array.isArray(item.scripture_references) ? item.scripture_references.join(', ') : ''),
    title: item.title ?? 'Daily Passage',
    content: item.content ?? item.exhortation ?? item.body ?? '',
    prayer_text: item.prayer_text ?? item.prayer ?? '',
    scripture_refs: item.scripture_refs,
    scripture_references: item.scripture_references,
    translation_detail: item.translation_detail ?? null,
    partner_name: item.partner_name,
  };
};

const normalizeMeditation = (item: any): MeditationEntry => ({
  id: String(item.id),
  date: item.published_at ?? item.created_at ?? item.date,
  title: item.title ?? 'Meditation',
  content: item.content ?? item.body ?? item.message ?? '',
  body: item.body,
  content_type: item.content_type,
  media_url: item.media_url ?? item.video_url ?? null,
  video_url: item.video_url ?? null,
  thumbnail_url: item.thumbnail_url ?? null,
  scripture_refs: item.scripture_refs ?? [],
  tags: item.tags ?? [],
  partner_name: item.partner_name,
});

const sortTranslationsByOfflinePriority = (
  translations: BibleTranslation[],
  offlineManifest: BibleOfflineManifest,
) => {
  const priorityCodes = getBibleOfflinePriorityCodes(offlineManifest);
  if (!priorityCodes.length) return translations;
  const priority = new Map(priorityCodes.map((code, index) => [code, index]));
  return [...translations].sort((a, b) => {
    const aPriority = priority.has(a.code) ? priority.get(a.code)! : Number.MAX_SAFE_INTEGER;
    const bPriority = priority.has(b.code) ? priority.get(b.code)! : Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return 0;
  });
};

const resolveDefaultTranslationCode = (
  translations: BibleTranslation[],
  offlineManifest: BibleOfflineManifest,
  preferredCode?: string | null,
  preferredId?: string | number | null,
) => {
  if (preferredCode && translations.some((translation) => translation.code === preferredCode)) return preferredCode;
  if (preferredId) {
    const preferred = translations.find((translation) => String(translation.id) === String(preferredId));
    if (preferred) return preferred.code;
  }
  const firstDownloaded = getBibleOfflinePriorityCodes(offlineManifest).find((code) =>
    translations.some((translation) => translation.code === code),
  );
  if (firstDownloaded) return firstDownloaded;
  const kjv =
    translations.find((translation) => translation.code === 'EN_KING_JAMES_BIBLE') ||
    translations.find(
      (translation) =>
        (translation.language || '').toLowerCase() === 'en' &&
        `${translation.name} ${translation.code}`.toUpperCase().includes('KING JAMES'),
    );
  const english = translations.find((translation) => (translation.language || '').toLowerCase() === 'en');
  return kjv?.code || english?.code || translations[0]?.code;
};

export function useBibleData() {
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [reader, setReader] = useState<BibleReaderPayload | null>(null);
  const [devotionals, setDevotionals] = useState<DailyDevotional[]>([]);
  const [meditations, setMeditations] = useState<MeditationEntry[]>([]);
  const [loadingReader, setLoadingReader] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMeditations, setLoadingMeditations] = useState(false);
  const [offlineManifest, setOfflineManifest] = useState<BibleOfflineManifest>({});
  const [offlineManifestLoaded, setOfflineManifestLoaded] = useState(false);
  const [preferredTranslationCode, setPreferredTranslationCode] = useState<string | null>(null);
  const [preferredTranslationId, setPreferredTranslationId] = useState<string | number | null>(null);

  useEffect(() => {
    Promise.all([readBibleOfflineManifest(), readLocalBiblePreference()])
      .then(([manifest, preference]) => {
        setOfflineManifest(manifest);
        setPreferredTranslationCode(preference?.default_translation_code || null);
        setPreferredTranslationId(preference?.default_translation || null);
      })
      .finally(() => setOfflineManifestLoaded(true));
    const sub = DeviceEventEmitter.addListener(BIBLE_PREFERENCES_UPDATED_EVENT, (preference: any) => {
      setPreferredTranslationCode(preference?.default_translation_code || null);
      setPreferredTranslationId(preference?.default_translation || null);
    });
    return () => sub.remove();
  }, []);

  const loadTranslations = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.translations, {
      errorMessage: 'Unable to load translations.',
    });
    setTranslations(listFromResponse(res?.data));
  }, []);

  const loadBooks = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.books, {
      errorMessage: 'Unable to load books.',
    });
    setBooks(listFromResponse(res?.data));
  }, []);

  const loadReader = useCallback(
    async (
      translation?: string,
      book?: string,
      chapter?: number,
      reference?: string,
      startVerse?: number,
      endVerse?: number,
    ) => {
    setLoadingReader(true);
    try {
      if (translation && book && chapter && !reference && !startVerse && !endVerse && offlineManifest[translation]) {
        const cached = await readCachedBibleChapter(translation, book, chapter);
        if (cached) setReader(cached);
      }

      const query = new URLSearchParams();
      if (translation) query.append('translation', translation);
      if (reference) query.append('reference', reference);
      if (book) query.append('book', book);
      if (chapter) query.append('chapter', String(chapter));
      if (startVerse) query.append('start_verse', String(startVerse));
      if (endVerse) query.append('end_verse', String(endVerse));
      const res = await getRequest(`${ROUTES.bible.reader}?${query.toString()}`, {
        errorMessage: 'Unable to load passage.',
      });
      if (res?.success) {
        setReader(res.data);
        const payload = res.data as BibleReaderPayload;
        const cacheTranslation = payload.translation?.code ?? translation;
        const cacheBook = payload.book?.code ?? book;
        const cacheChapter = payload.chapter?.number ?? chapter;
        if (cacheTranslation && cacheBook && cacheChapter && !reference && !startVerse && !endVerse) {
          await cacheBibleChapter(cacheTranslation, cacheBook, Number(cacheChapter), payload);
        }
      } else if (translation && book && chapter && !reference && !startVerse && !endVerse) {
        const cached = await readCachedBibleChapter(translation, book, chapter);
        if (cached) setReader(cached);
      }
    } finally {
      setLoadingReader(false);
    }
    },
    [offlineManifest],
  );

  const loadDevotionals = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const today = await getRequest(`${ROUTES.bible.dailyToday}?language=en`, {
        errorMessage: 'Unable to load today KCAN passage.',
      });
      const list = await getRequest(`${ROUTES.bible.dailyPassages}?language=en`, {
        errorMessage: 'Unable to load daily devotionals.',
      });
      const todayItem = today?.success ? normalizeDaily(today?.data) : null;
      const history = listFromResponse(list?.data)
        .map(normalizeDaily)
        .filter(Boolean) as DailyDevotional[];
      const next = todayItem ? [todayItem, ...history.filter((item) => item.id !== todayItem.id)] : history;
      setDevotionals(next);
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  const loadMeditations = useCallback(async () => {
    setLoadingMeditations(true);
    try {
      const res = await getRequest(`${ROUTES.bible.meditationPosts}?language=en`, {
        errorMessage: 'Unable to load meditations.',
      });
      setMeditations(listFromResponse(res?.data).map(normalizeMeditation));
    } finally {
      setLoadingMeditations(false);
    }
  }, []);

  useEffect(() => {
    loadTranslations();
    loadBooks();
    loadDevotionals();
    loadMeditations();
  }, [loadTranslations, loadBooks, loadDevotionals, loadMeditations]);

  const orderedTranslations = useMemo(
    () => sortTranslationsByOfflinePriority(translations, offlineManifest),
    [translations, offlineManifest],
  );
  const defaultTranslation = useMemo(
    () => resolveDefaultTranslationCode(translations, offlineManifest, preferredTranslationCode, preferredTranslationId),
    [translations, offlineManifest, preferredTranslationCode, preferredTranslationId],
  );
  const defaultBook = useMemo(() => books.find((book) => book.code === 'GENESIS')?.code || books[0]?.code, [books]);

  useEffect(() => {
    if (offlineManifestLoaded && defaultTranslation && defaultBook) {
      loadReader(defaultTranslation, defaultBook, 1);
    }
  }, [offlineManifestLoaded, defaultTranslation, defaultBook, loadReader]);

  return {
    translations: orderedTranslations,
    books,
    reader,
    devotionals,
    meditations,
    loadingReader,
    loadingDaily,
    loadingMeditations,
    loadReader,
  };
}
