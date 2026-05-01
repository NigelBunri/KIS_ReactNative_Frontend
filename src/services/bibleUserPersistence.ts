import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BibleTranslation, BibleVerse } from '@/screens/tabs/bible/useBibleData';

const EVENTS_KEY = 'kis.bible.local.reading_events.v1';
const HIGHLIGHTS_KEY = 'kis.bible.local.highlights.v1';
const NOTES_KEY = 'kis.bible.local.notes.v1';
const BOOKMARKS_KEY = 'kis.bible.local.bookmarks.v1';

export type LocalBibleEvent = {
  id: string;
  translation?: string | number | null;
  passage_ref: string;
  verse_refs?: string[];
  chapter_refs?: string[];
  start_at: string;
  end_at?: string | null;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  reminder_offsets: number[];
  reminder_channels: string[];
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  source?: string;
  sync_status?: 'synced' | 'local_pending';
  created_at?: string;
  updated_at?: string;
};

export type LocalBibleLibraryItem = {
  id: string;
  verse: string;
  verse_ref: string;
  verse_text: string;
  translation?: string;
  color?: string;
  text?: string;
  created_at: string;
  updated_at?: string;
  sync_status?: 'synced' | 'local_pending';
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
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

const normalizeServerList = <T extends { id: string | number }>(items: T[]): T[] =>
  items.map((item) => ({ ...item, id: String(item.id) }));

export const readLocalBibleEvents = () => readJson<LocalBibleEvent[]>(EVENTS_KEY, []);

export const upsertLocalBibleEvent = async (event: LocalBibleEvent) => {
  const list = await readLocalBibleEvents();
  const normalized = { ...event, id: String(event.id), updated_at: nowIso() };
  const next = [normalized, ...list.filter((item) => String(item.id) !== normalized.id)];
  await writeJson(EVENTS_KEY, next.slice(0, 500));
  return normalized;
};

export const deleteLocalBibleEvent = async (eventId: string | number) => {
  const list = await readLocalBibleEvents();
  await writeJson(
    EVENTS_KEY,
    list.filter((item) => String(item.id) !== String(eventId)),
  );
};

export const mergeBibleEventsWithLocal = async <T extends LocalBibleEvent>(
  serverItems: T[],
  dateFrom: string,
  dateTo: string,
): Promise<LocalBibleEvent[]> => {
  const localItems = await readLocalBibleEvents();
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59`).getTime();
  const scopedLocal = localItems.filter((item) => {
    const time = new Date(item.start_at).getTime();
    return Number.isFinite(time) && time >= fromTime && time <= toTime;
  });
  const merged = new Map<string, LocalBibleEvent>();
  normalizeServerList(serverItems).forEach((item) => merged.set(String(item.id), { ...item, sync_status: 'synced' }));
  scopedLocal.forEach((item) => {
    if (!merged.has(String(item.id))) merged.set(String(item.id), item);
  });
  return Array.from(merged.values()).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
};

export const buildLocalBibleEvent = (input: {
  serverEvent?: any;
  translation?: BibleTranslation | string;
  passageRef: string;
  verseRefs?: string[];
  chapterRefs?: string[];
  startAt: string;
  endAt?: string | null;
  recurrence?: LocalBibleEvent['recurrence'];
  reminderOffsets?: number[];
  reminderChannels?: string[];
  status?: LocalBibleEvent['status'];
  source?: string;
  pending?: boolean;
}): LocalBibleEvent => {
  const server = input.serverEvent || {};
  const translationCode = typeof input.translation === 'string' ? input.translation : input.translation?.code;
  return {
    id: String(server.id ?? `local:${Date.now()}:${Math.random().toString(36).slice(2)}`),
    translation: server.translation ?? translationCode ?? null,
    passage_ref: server.passage_ref ?? input.passageRef,
    verse_refs: server.verse_refs ?? input.verseRefs ?? [],
    chapter_refs: server.chapter_refs ?? input.chapterRefs ?? [],
    start_at: server.start_at ?? input.startAt,
    end_at: server.end_at ?? input.endAt ?? null,
    recurrence: server.recurrence ?? input.recurrence ?? 'none',
    reminder_offsets: server.reminder_offsets ?? input.reminderOffsets ?? [],
    reminder_channels: server.reminder_channels ?? input.reminderChannels ?? [],
    status: server.status ?? input.status ?? 'scheduled',
    source: server.source ?? input.source ?? 'reader',
    sync_status: input.pending ? 'local_pending' : 'synced',
    created_at: server.created_at ?? nowIso(),
    updated_at: server.updated_at ?? nowIso(),
  };
};

const readLibrary = (key: string) => readJson<LocalBibleLibraryItem[]>(key, []);

const upsertLibraryItem = async (key: string, item: LocalBibleLibraryItem) => {
  const list = await readLibrary(key);
  const next = [item, ...list.filter((entry) => String(entry.id) !== String(item.id))];
  await writeJson(key, next.slice(0, 1000));
  return item;
};

export const buildLocalLibraryItem = (input: {
  serverItem?: any;
  verse: BibleVerse;
  reference: string;
  translationCode?: string;
  color?: string;
  text?: string;
  pending?: boolean;
}): LocalBibleLibraryItem => {
  const server = input.serverItem || {};
  return {
    id: String(server.id ?? `local:${Date.now()}:${Math.random().toString(36).slice(2)}`),
    verse: String(server.verse ?? input.verse.id),
    verse_ref: server.verse_ref ?? `${input.reference.split(':')[0]}:${input.verse.number}`,
    verse_text: server.verse_text ?? input.verse.text,
    translation: server.translation ?? input.translationCode,
    color: server.color ?? input.color,
    text: server.text ?? input.text,
    created_at: server.created_at ?? nowIso(),
    updated_at: server.updated_at ?? nowIso(),
    sync_status: input.pending ? 'local_pending' : 'synced',
  };
};

export const upsertLocalBibleHighlight = (item: LocalBibleLibraryItem) => upsertLibraryItem(HIGHLIGHTS_KEY, item);
export const upsertLocalBibleNote = (item: LocalBibleLibraryItem) => upsertLibraryItem(NOTES_KEY, item);
export const upsertLocalBibleBookmark = (item: LocalBibleLibraryItem) => upsertLibraryItem(BOOKMARKS_KEY, item);

export const mergeBibleLibraryWithLocal = async (input: {
  highlights: LocalBibleLibraryItem[];
  notes: LocalBibleLibraryItem[];
  bookmarks: LocalBibleLibraryItem[];
  translationCode?: string;
  color?: string | null;
  noteQuery?: string;
}) => {
  const [localHighlights, localNotes, localBookmarks] = await Promise.all([
    readLibrary(HIGHLIGHTS_KEY),
    readLibrary(NOTES_KEY),
    readLibrary(BOOKMARKS_KEY),
  ]);
  const filterItem = (item: LocalBibleLibraryItem) => {
    if (input.translationCode && item.translation && item.translation !== input.translationCode) return false;
    return true;
  };
  const filterHighlight = (item: LocalBibleLibraryItem) => {
    if (!filterItem(item)) return false;
    if (input.color && String(item.color).toLowerCase() !== String(input.color).toLowerCase()) return false;
    return true;
  };
  const filterNote = (item: LocalBibleLibraryItem) => {
    if (!filterItem(item)) return false;
    if (input.noteQuery && !String(item.text || '').toLowerCase().includes(input.noteQuery.toLowerCase())) return false;
    return true;
  };
  const merge = (server: LocalBibleLibraryItem[], local: LocalBibleLibraryItem[], predicate: (item: LocalBibleLibraryItem) => boolean) => {
    const merged = new Map<string, LocalBibleLibraryItem>();
    server.map((item) => ({ ...item, id: String(item.id), sync_status: 'synced' as const })).forEach((item) => merged.set(item.id, item));
    local.filter(predicate).forEach((item) => {
      if (!merged.has(item.id)) merged.set(item.id, item);
    });
    return Array.from(merged.values()).sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  };
  return {
    highlights: merge(input.highlights, localHighlights, filterHighlight),
    notes: merge(input.notes, localNotes, filterNote),
    bookmarks: merge(input.bookmarks, localBookmarks, filterItem),
  };
};
