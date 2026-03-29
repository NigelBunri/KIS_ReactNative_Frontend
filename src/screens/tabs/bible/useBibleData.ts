import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type BibleTranslation = {
  id: string;
  code: string;
  name: string;
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
};

export type MeditationEntry = {
  id: string;
  date: string;
  title: string;
  content: string;
  prayer_text?: string;
};

export function useBibleData() {
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [reader, setReader] = useState<BibleReaderPayload | null>(null);
  const [devotionals, setDevotionals] = useState<DailyDevotional[]>([]);
  const [meditations, setMeditations] = useState<MeditationEntry[]>([]);
  const [loadingReader, setLoadingReader] = useState(false);

  const loadTranslations = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.translations, {
      errorMessage: 'Unable to load translations.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setTranslations(Array.isArray(payload) ? payload : []);
  }, []);

  const loadBooks = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.books, {
      errorMessage: 'Unable to load books.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setBooks(Array.isArray(payload) ? payload : []);
  }, []);

  const loadReader = useCallback(async (translation?: string, book?: string, chapter?: number) => {
    setLoadingReader(true);
    const query = new URLSearchParams();
    if (translation) query.append('translation', translation);
    if (book) query.append('book', book);
    if (chapter) query.append('chapter', String(chapter));
    const res = await getRequest(`${ROUTES.bible.reader}?${query.toString()}`, {
      errorMessage: 'Unable to load passage.',
    });
    if (res?.success) setReader(res.data);
    setLoadingReader(false);
  }, []);

  const loadDevotionals = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.daily, {
      errorMessage: 'Unable to load daily devotionals.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setDevotionals(Array.isArray(payload) ? payload : []);
  }, []);

  const loadMeditations = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.meditations, {
      errorMessage: 'Unable to load meditations.',
    });
    const payload = res?.data?.results ?? res?.data ?? [];
    setMeditations(Array.isArray(payload) ? payload : []);
  }, []);

  useEffect(() => {
    loadTranslations();
    loadBooks();
    loadDevotionals();
    loadMeditations();
  }, [loadTranslations, loadBooks, loadDevotionals, loadMeditations]);

  const defaultTranslation = useMemo(() => translations[0]?.code, [translations]);
  const defaultBook = useMemo(() => books[0]?.code, [books]);

  useEffect(() => {
    if (defaultTranslation && defaultBook) {
      loadReader(defaultTranslation, defaultBook, 1);
    }
  }, [defaultTranslation, defaultBook, loadReader]);

  return {
    translations,
    books,
    reader,
    devotionals,
    meditations,
    loadingReader,
    loadReader,
  };
}
