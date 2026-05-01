import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter } from 'react-native';

import type { BibleReaderPayload, BibleTranslation } from '@/screens/tabs/bible/useBibleData';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

const CHAPTER_PREFIX = 'kis.bible.offline.chapter.v1';
const MANIFEST_KEY = 'kis.bible.offline.manifest.v1';
const DOWNLOAD_JOBS_KEY = 'kis.bible.offline.download_jobs.v1';

export const BIBLE_OFFLINE_DOWNLOADS_UPDATED_EVENT = 'bibleOfflineDownloads.updated';

export type BibleOfflineManifestEntry = {
  code: string;
  name: string;
  language?: string;
  downloadedAt: string;
  chapterCount: number;
};

export type BibleOfflineManifest = Record<string, BibleOfflineManifestEntry>;

export type BibleOfflineDownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export type BibleOfflineDownloadChapter = {
  bookCode: string;
  bookName: string;
  chapterNumber: number;
};

export type BibleOfflineDownloadJob = {
  translation: BibleTranslation;
  status: BibleOfflineDownloadStatus;
  totalChapters: number;
  completedChapters: number;
  completedKeys: string[];
  currentLabel?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  pausedAt?: string;
};

export const bibleOfflineChapterKey = (translationCode: string, bookCode: string, chapterNumber: number) =>
  `${CHAPTER_PREFIX}:${translationCode}:${bookCode}:${chapterNumber}`;

export const readBibleOfflineManifest = async (): Promise<BibleOfflineManifest> => {
  const raw = await AsyncStorage.getItem(MANIFEST_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const nowIso = () => new Date().toISOString();

const emitDownloadUpdate = () => {
  DeviceEventEmitter.emit(BIBLE_OFFLINE_DOWNLOADS_UPDATED_EVENT);
};

export const readBibleOfflineDownloadJobs = async (): Promise<Record<string, BibleOfflineDownloadJob>> =>
  readJson<Record<string, BibleOfflineDownloadJob>>(DOWNLOAD_JOBS_KEY, {});

const writeBibleOfflineDownloadJobs = async (jobs: Record<string, BibleOfflineDownloadJob>) => {
  await writeJson(DOWNLOAD_JOBS_KEY, jobs);
  emitDownloadUpdate();
};

const upsertBibleOfflineDownloadJob = async (
  translationCode: string,
  updater: (job?: BibleOfflineDownloadJob) => BibleOfflineDownloadJob,
) => {
  const jobs = await readBibleOfflineDownloadJobs();
  jobs[translationCode] = updater(jobs[translationCode]);
  await writeBibleOfflineDownloadJobs(jobs);
  return jobs[translationCode];
};

export const writeBibleOfflineManifestEntry = async (
  translation: BibleTranslation,
  chapterCount: number,
): Promise<BibleOfflineManifest> => {
  const manifest = await readBibleOfflineManifest();
  const existing = manifest[translation.code];
  const next = {
    ...manifest,
    [translation.code]: {
      code: translation.code,
      name: translation.name,
      language: translation.language,
      downloadedAt: existing?.downloadedAt || new Date().toISOString(),
      chapterCount,
    },
  };
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(next));
  return next;
};

export const getBibleOfflinePriorityCodes = (manifest: BibleOfflineManifest): string[] =>
  Object.values(manifest)
    .sort((a, b) => {
      const aTime = new Date(a.downloadedAt).getTime();
      const bTime = new Date(b.downloadedAt).getTime();
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    })
    .map((entry) => entry.code);

export const cacheBibleChapter = async (
  translationCode: string,
  bookCode: string,
  chapterNumber: number,
  payload: BibleReaderPayload,
) => {
  await AsyncStorage.setItem(
    bibleOfflineChapterKey(translationCode, bookCode, chapterNumber),
    JSON.stringify({ ...payload, cached_at: new Date().toISOString() }),
  );
};

export const hasCachedBibleChapter = async (
  translationCode: string,
  bookCode: string,
  chapterNumber: number,
) => Boolean(await AsyncStorage.getItem(bibleOfflineChapterKey(translationCode, bookCode, chapterNumber)));

export const readCachedBibleChapter = async (
  translationCode?: string,
  bookCode?: string,
  chapterNumber?: number,
): Promise<BibleReaderPayload | null> => {
  if (!translationCode || !bookCode || !chapterNumber) return null;
  const raw = await AsyncStorage.getItem(bibleOfflineChapterKey(translationCode, bookCode, chapterNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const pauseBibleOfflineDownload = async (translationCode: string) => {
  await upsertBibleOfflineDownloadJob(translationCode, (job) => {
    if (!job) throw new Error('Download job not found.');
    return {
      ...job,
      status: 'paused',
      pausedAt: nowIso(),
      updatedAt: nowIso(),
      currentLabel: job.currentLabel || 'Paused',
    };
  });
};

export const resumeBibleOfflineDownload = async (
  translation: BibleTranslation,
  books: Array<{ id: string; code: string; name: string }>,
) => {
  await upsertBibleOfflineDownloadJob(translation.code, (job) => ({
    translation,
    status: 'queued',
    totalChapters: job?.totalChapters || 0,
    completedChapters: job?.completedChapters || 0,
    completedKeys: job?.completedKeys || [],
    currentLabel: 'Queued to resume',
    createdAt: job?.createdAt || nowIso(),
    updatedAt: nowIso(),
  }));
  runBibleOfflineDownloadQueue(books).catch(() => undefined);
};

export const enqueueBibleOfflineDownload = async (
  translation: BibleTranslation,
  books: Array<{ id: string; code: string; name: string }>,
) => {
  await upsertBibleOfflineDownloadJob(translation.code, (job) => ({
    translation,
    status: job?.status === 'completed' ? 'completed' : 'queued',
    totalChapters: job?.totalChapters || 0,
    completedChapters: job?.completedChapters || 0,
    completedKeys: job?.completedKeys || [],
    currentLabel: job?.status === 'completed' ? 'Offline ready' : 'Queued for offline download',
    createdAt: job?.createdAt || nowIso(),
    updatedAt: nowIso(),
  }));
  runBibleOfflineDownloadQueue(books).catch(() => undefined);
};

let queueRunning = false;

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const buildChapterList = async (
  books: Array<{ id: string; code: string; name: string }>,
): Promise<BibleOfflineDownloadChapter[]> => {
  const chapters: BibleOfflineDownloadChapter[] = [];
  for (const book of books) {
    const chapterRes = await getRequest(`${ROUTES.bible.chapters}?book=${book.id}`, {
      errorMessage: 'Unable to load chapters for offline download.',
    });
    const bookChapters = listFromResponse(chapterRes?.data);
    bookChapters.forEach((chapter) => {
      chapters.push({
        bookCode: book.code,
        bookName: book.name,
        chapterNumber: Number(chapter.number),
      });
    });
  }
  return chapters.filter((chapter) => Number.isFinite(chapter.chapterNumber));
};

export const runBibleOfflineDownloadQueue = async (
  books: Array<{ id: string; code: string; name: string }>,
) => {
  if (queueRunning || !books.length) return;
  queueRunning = true;
  try {
    let jobs = await readBibleOfflineDownloadJobs();
    const runnable = () =>
      Object.values(jobs).filter((job) => job.status === 'queued' || job.status === 'downloading');

    while (runnable().length) {
      const job = runnable()[0];
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || netState.isInternetReachable === false) {
        await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
          ...(current || job),
          status: 'paused',
          pausedAt: nowIso(),
          updatedAt: nowIso(),
          currentLabel: 'Paused until internet is available',
          error: 'Internet connection is offline.',
        }));
        jobs = await readBibleOfflineDownloadJobs();
        continue;
      }

      const chapters = await buildChapterList(books);
      const completedSet = new Set(job.completedKeys || []);
      await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
        ...(current || job),
        status: 'downloading',
        totalChapters: chapters.length,
        completedChapters: completedSet.size,
        updatedAt: nowIso(),
        error: '',
      }));

      for (const chapter of chapters) {
        const latest = (await readBibleOfflineDownloadJobs())[job.translation.code];
        if (!latest || latest.status === 'paused') break;
        const chapterKey = `${chapter.bookCode}:${chapter.chapterNumber}`;
        if (completedSet.has(chapterKey)) continue;
        if (await hasCachedBibleChapter(job.translation.code, chapter.bookCode, chapter.chapterNumber)) {
          completedSet.add(chapterKey);
          await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
            ...(current || latest),
            completedKeys: Array.from(completedSet),
            completedChapters: completedSet.size,
            totalChapters: chapters.length,
            updatedAt: nowIso(),
          }));
          continue;
        }

        const label = `${job.translation.name}: ${chapter.bookName} ${chapter.chapterNumber}`;
        await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
          ...(current || latest),
          status: 'downloading',
          currentLabel: label,
          totalChapters: chapters.length,
          completedChapters: completedSet.size,
          updatedAt: nowIso(),
        }));

        const res = await getRequest(ROUTES.bible.reader, {
          params: {
            translation: job.translation.code,
            book: chapter.bookCode,
            chapter: chapter.chapterNumber,
          },
          forceNetwork: true,
          errorMessage: 'Unable to download Bible chapter.',
        });
        if (!res?.success || !res.data) {
          await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
            ...(current || latest),
            status: 'paused',
            pausedAt: nowIso(),
            updatedAt: nowIso(),
            currentLabel: 'Paused. Resume when internet is stable.',
            error: res?.message || 'Unable to download Bible chapter.',
          }));
          break;
        }
        await cacheBibleChapter(job.translation.code, chapter.bookCode, chapter.chapterNumber, res.data);
        completedSet.add(chapterKey);
        await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
          ...(current || latest),
          completedKeys: Array.from(completedSet),
          completedChapters: completedSet.size,
          totalChapters: chapters.length,
          updatedAt: nowIso(),
        }));
      }

      const latest = (await readBibleOfflineDownloadJobs())[job.translation.code];
      if (latest?.status === 'downloading' && latest.completedChapters >= latest.totalChapters && latest.totalChapters > 0) {
        const manifest = await writeBibleOfflineManifestEntry(job.translation, latest.completedChapters);
        await upsertBibleOfflineDownloadJob(job.translation.code, (current) => ({
          ...(current || latest),
          status: 'completed',
          completedChapters: latest.completedChapters,
          totalChapters: latest.totalChapters,
          currentLabel: 'Offline ready',
          error: '',
          updatedAt: nowIso(),
        }));
        void manifest;
      }
      jobs = await readBibleOfflineDownloadJobs();
    }
  } finally {
    queueRunning = false;
  }
};

export const resumePausedBibleDownloadsWhenOnline = async (
  books: Array<{ id: string; code: string; name: string }>,
) => {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected || netState.isInternetReachable === false) return;
  const jobs = await readBibleOfflineDownloadJobs();
  let changed = false;
  Object.entries(jobs).forEach(([code, job]) => {
    if (job.status === 'paused' && job.error === 'Internet connection is offline.') {
      jobs[code] = { ...job, status: 'queued', currentLabel: 'Queued to resume', updatedAt: nowIso() };
      changed = true;
    }
  });
  if (changed) await writeBibleOfflineDownloadJobs(jobs);
  runBibleOfflineDownloadQueue(books).catch(() => undefined);
};
