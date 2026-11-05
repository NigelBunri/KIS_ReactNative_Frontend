import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';
import type { BibleTranslation, BibleVerse } from '@/screens/tabs/bible/useBibleData';

const EVENTS_KEY = 'kis.bible.local.reading_events.v1';
const HIGHLIGHTS_KEY = 'kis.bible.local.highlights.v1';
const NOTES_KEY = 'kis.bible.local.notes.v1';
const BOOKMARKS_KEY = 'kis.bible.local.bookmarks.v1';

const scopedKey = async (baseKey: string) => {
  const userId = await getCurrentAuthUserId().catch(() => null);
  return userId ? `${baseKey}:${userId}` : baseKey;
};

export const BIBLE_READING_EVENTS_UPDATED_EVENT = 'bible.readingEvents.updated';

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
  // The exact verse/chapter ids the original create call used - stored so a
  // 'local_pending' placeholder (its POST appeared to fail) can be safely
  // replayed later with the identical payload, instead of only ever being
  // reconciled by guessing from passage_ref/start_at (see
  // isSameLocalReading below for why that guess alone isn't reliable).
  raw_verse_ids?: string[];
  raw_chapter_id?: string | null;
  // How many times a replay POST for this placeholder has already failed -
  // caps retries so a permanently-broken placeholder (e.g. the server
  // rejects it outright) doesn't get hammered on every planner refresh.
  retry_count?: number;
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
    const raw = await AsyncStorage.getItem(await scopedKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(await scopedKey(key), JSON.stringify(value));
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
  DeviceEventEmitter.emit(BIBLE_READING_EVENTS_UPDATED_EVENT, {
    action: 'upsert',
    eventId: normalized.id,
  });
  return normalized;
};

export const deleteLocalBibleEvent = async (eventId: string | number) => {
  const list = await readLocalBibleEvents();
  await writeJson(
    EVENTS_KEY,
    list.filter((item) => String(item.id) !== String(eventId)),
  );
  DeviceEventEmitter.emit(BIBLE_READING_EVENTS_UPDATED_EVENT, {
    action: 'delete',
    eventId: String(eventId),
  });
};

const normalizePassageRef = (value: unknown) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Previously this required passage_ref and start_at to match as EXACT
// strings. That's brittle: the server can return/store a slightly
// different serialization of the same moment (different timezone-offset
// formatting, truncated seconds, trailing "Z") or the same reference with
// different whitespace/case, and a single byte of difference meant the
// match silently failed FOREVER - the local placeholder never got
// reconciled and stayed as a visible duplicate. Compare on meaning
// instead: the reference normalized for whitespace/case, and the instant
// in time within a tolerance window (a few minutes covers any formatting
// drift without being loose enough to match a genuinely different
// reading scheduled nearby).
const START_AT_MATCH_TOLERANCE_MS = 5 * 60 * 1000;
export const isSameLocalReading = (
  a: { passage_ref: unknown; start_at: unknown },
  b: { passage_ref: unknown; start_at: unknown },
): boolean => {
  if (normalizePassageRef(a.passage_ref) !== normalizePassageRef(b.passage_ref)) return false;
  const aTime = new Date(String(a.start_at)).getTime();
  const bTime = new Date(String(b.start_at)).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= START_AT_MATCH_TOLERANCE_MS;
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
  const normalizedServer = normalizeServerList(serverItems);
  const merged = new Map<string, LocalBibleEvent>();
  normalizedServer.forEach((item) => merged.set(String(item.id), { ...item, sync_status: 'synced' }));

  // A 'local_pending' item is a placeholder created when its create POST
  // (see createEvent() in BiblePlansPanel.tsx) *appeared* to fail - but that
  // can just as easily mean the request actually reached the server and
  // only the response was lost (timeout, connection dropped after the
  // server already wrote the row), not that nothing was ever created. If a
  // server event matching the same reading has since shown up, that's what
  // happened: the local placeholder is a stale duplicate of a real synced
  // event, not a second real reading, so evict it here rather than let it
  // merge in as its own entry. Without this the same reading (e.g.
  // "Genesis 1-3") would keep appearing twice, permanently, since nothing
  // else ever reconciles or clears these placeholders. See
  // isSameLocalReading for why this is a tolerant match, not exact.
  const staleLocalIds: string[] = [];
  scopedLocal.forEach((item) => {
    if (merged.has(String(item.id))) return;
    const supersededByServer =
      item.sync_status === 'local_pending' &&
      normalizedServer.some((serverItem) => isSameLocalReading(serverItem, item));
    if (supersededByServer) {
      staleLocalIds.push(item.id);
      return;
    }
    merged.set(String(item.id), item);
  });
  if (staleLocalIds.length) {
    await Promise.all(staleLocalIds.map((id) => deleteLocalBibleEvent(id)));
  }

  return Array.from(merged.values()).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
};

/**
 * Which currently-pending local placeholders are actually safe to retry
 * creating on the server right now. "Safe" specifically excludes anything
 * mergeBibleEventsWithLocal hasn't just had a chance to check against a
 * fresh server fetch for its own date - retrying one of those blindly
 * risks genuinely double-creating it server-side if the original POST had
 * in fact already succeeded. Callers must pass the post-merge result for
 * the date range they just fetched; anything that survived that merge as
 * 'local_pending' was already checked and NOT found on the server, so a
 * replay for it cannot create a second server-side row for the same
 * reading - at worst it creates the first one, late.
 */
export const pendingLocalEventsSafeToFlush = (
  mergedForFetchedRange: LocalBibleEvent[],
  maxAttempts = 3,
): LocalBibleEvent[] =>
  mergedForFetchedRange.filter(
    (item) =>
      item.sync_status === 'local_pending' &&
      Boolean(item.raw_chapter_id || (item.raw_verse_ids && item.raw_verse_ids.length)) &&
      (item.retry_count ?? 0) < maxAttempts,
  );

// Actually attempts to create the given still-unsynced local placeholders
// on the server, rather than only ever passively waiting for
// mergeBibleEventsWithLocal to notice a matching server row by luck. This
// is what makes a genuinely offline-created reading eventually become a
// single real synced event instead of a permanent local-only duplicate:
// once the retry succeeds the placeholder is deleted and replaced by the
// server's own row, so there is nothing left to (mis)match later. A
// placeholder with no raw_verse_ids/raw_chapter_id (created before this
// field existed, or from a path that never captured them) can't be
// replayed and is left for the user to remove manually via the delete
// control - see pendingLocalEventsSafeToFlush, which already excludes
// those before this ever runs.
export const flushPendingLocalBibleEvents = async (
  candidates: LocalBibleEvent[],
  createOnServer: (event: LocalBibleEvent) => Promise<{ success: boolean; data?: any }>,
): Promise<{ flushedIds: string[]; failedIds: string[] }> => {
  const flushedIds: string[] = [];
  const failedIds: string[] = [];
  for (const item of candidates) {
    let result: { success: boolean; data?: any };
    try {
      result = await createOnServer(item);
    } catch {
      result = { success: false };
    }
    if (result?.success && result.data?.id) {
      await deleteLocalBibleEvent(item.id);
      await upsertLocalBibleEvent({ ...item, id: String(result.data.id), sync_status: 'synced', retry_count: 0 });
      flushedIds.push(item.id);
    } else {
      await upsertLocalBibleEvent({ ...item, retry_count: (item.retry_count ?? 0) + 1 });
      failedIds.push(item.id);
    }
  }
  return { flushedIds, failedIds };
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
  // The exact ids the create POST used, if this came from createEvent() -
  // carried through so a pending placeholder can be replayed verbatim
  // later. Omit (or leave undefined) for events built from an update/
  // status-change, which never need to be replayed as a NEW create.
  rawVerseIds?: string[];
  rawChapterId?: string | null;
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
    raw_verse_ids: input.rawVerseIds,
    raw_chapter_id: input.rawChapterId,
  };
};

const readLibrary = (key: string) => readJson<LocalBibleLibraryItem[]>(key, []);

const upsertLibraryItem = async (key: string, item: LocalBibleLibraryItem) => {
  const list = await readLibrary(key);
  const next = [item, ...list.filter((entry) => String(entry.id) !== String(item.id))];
  await writeJson(key, next.slice(0, 1000));
  return item;
};

const deleteLibraryItem = async (key: string, id: string) => {
  const list = await readLibrary(key);
  await writeJson(key, list.filter((entry) => String(entry.id) !== String(id)));
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

export const readLocalBibleHighlights = () => readLibrary(HIGHLIGHTS_KEY);
export const readLocalBibleNotes = () => readLibrary(NOTES_KEY);
export const readLocalBibleBookmarks = () => readLibrary(BOOKMARKS_KEY);

export const deleteLocalBibleHighlight = (id: string) => deleteLibraryItem(HIGHLIGHTS_KEY, id);
export const deleteLocalBibleNote = (id: string) => deleteLibraryItem(NOTES_KEY, id);
export const deleteLocalBibleBookmark = (id: string) => deleteLibraryItem(BOOKMARKS_KEY, id);

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
