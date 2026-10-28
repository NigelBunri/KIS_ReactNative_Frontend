// A small, durable queue for reading-progress updates and highlights
// created while offline (or while any single write request transiently
// fails) — so BookReaderScreen never silently discards one of these the
// way a bare `.catch(() => {})` would. Each entry survives an app
// restart (AsyncStorage-backed) and is retried the next time
// flushPendingBookSyncQueue() is called — BookReaderScreen does this on
// NetInfo reconnect and on screen focus.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { putData } from '@/network/put';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';

const QUEUE_KEY = 'kis.offline_books.sync_queue.v1';

export type PendingProgressAction = {
  id: string;
  type: 'progress';
  bookId: string;
  payload: { chapter_stable_id: string; block_index: number; percent_complete: number; is_completed: boolean };
  createdAt: string;
};

export type PendingHighlightAction = {
  id: string;
  type: 'highlight';
  bookId: string;
  chapterStableId: string;
  payload: { block_id: string; start_offset: number; end_offset: number; color: string; note: string };
  createdAt: string;
};

// Unlike progress (a plain upsert) or a highlight (idempotent on its own
// unique constraint — see apps.books.services.create_highlight), a
// bookmark TOGGLE is not naturally idempotent: replaying it twice flips
// the state back off. This is safe here only because
// flushPendingBookSyncQueue serializes itself (see isFlushing below) —
// each queued toggle is applied at most once, ever.
export type PendingBookmarkAction = {
  id: string;
  type: 'bookmark';
  bookId: string;
  chapterStableId: string;
  createdAt: string;
};

// Edits a highlight that already exists server-side (color/comment) —
// never the anchor itself (see apps.books.services.update_highlight).
// `localHighlightId` is informational only (for the caller's optimistic
// local state); `serverHighlightId` is what the PATCH actually targets,
// and is absent only for the (rare) case of editing a highlight that was
// itself still a queued, not-yet-synced local-only highlight — in that
// case the caller mutates the still-queued PendingHighlightAction's
// payload directly instead of enqueuing a separate update (see
// BookReaderScreen's confirmHighlightEdit).
export type PendingHighlightUpdateAction = {
  id: string;
  type: 'highlight_update';
  bookId: string;
  serverHighlightId: string;
  payload: { color?: string; note?: string };
  createdAt: string;
};

export type PendingAction = PendingProgressAction | PendingHighlightAction | PendingBookmarkAction | PendingHighlightUpdateAction;

// Omit<Union, K> does not distribute over a discriminated union (keyof a
// union only yields the keys common to every member), which silently
// erased member-specific fields like `chapterStableId` — this input
// type is written out explicitly as its own union instead so callers
// keep full type-checking per action `type`.
export type PendingActionInput =
  | { type: 'progress'; bookId: string; payload: PendingProgressAction['payload'] }
  | { type: 'highlight'; bookId: string; chapterStableId: string; payload: PendingHighlightAction['payload'] }
  | { type: 'bookmark'; bookId: string; chapterStableId: string }
  | { type: 'highlight_update'; bookId: string; serverHighlightId: string; payload: PendingHighlightUpdateAction['payload'] };

async function readQueue(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueuePendingAction(action: PendingActionInput): Promise<PendingAction> {
  const full = { ...action, id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString() } as PendingAction;
  const queue = await readQueue();
  queue.push(full);
  await writeQueue(queue);
  return full;
}

export async function pendingActionsForBook(bookId: string): Promise<PendingAction[]> {
  return (await readQueue()).filter((a) => a.bookId === bookId);
}

async function executeAction(action: PendingAction): Promise<boolean> {
  if (action.type === 'progress') {
    const res: any = await putData(ROUTES.books.progress(action.bookId), action.payload).catch(() => null);
    return !!res?.success;
  }
  if (action.type === 'bookmark') {
    const res: any = await postRequest(
      ROUTES.books.chapterBookmarkToggle(action.bookId, action.chapterStableId), {},
    ).catch(() => null);
    return !!res?.success;
  }
  if (action.type === 'highlight_update') {
    const res: any = await patchRequest(
      ROUTES.books.highlightDetail(action.serverHighlightId), action.payload,
    ).catch(() => null);
    return !!res?.success;
  }
  const res: any = await postRequest(
    ROUTES.books.chapterHighlights(action.bookId, action.chapterStableId),
    action.payload,
  ).catch(() => null);
  return !!res?.success;
}

// Serializes flushPendingBookSyncQueue — without this, two overlapping
// callers (e.g. the NetInfo reconnect listener and a screen-focus
// refresh firing within the same tick) could both read the queue before
// either writes it back, executing the SAME queued bookmark toggle
// twice and flipping it back off. Progress/highlight actions are
// naturally idempotent and wouldn't care, but bookmark isn't, so every
// caller shares one in-flight promise instead of running concurrently.
let inFlightFlush: Promise<{ flushed: number; remaining: number }> | null = null;

/** Retries every queued action in creation order; removes only the ones
 * that actually succeed, so a transient failure mid-flush leaves the
 * rest queued for next time rather than being dropped. */
export async function flushPendingBookSyncQueue(): Promise<{ flushed: number; remaining: number }> {
  if (inFlightFlush) return inFlightFlush;
  inFlightFlush = (async () => {
    try {
      const queue = await readQueue();
      if (queue.length === 0) return { flushed: 0, remaining: 0 };

      const stillPending: PendingAction[] = [];
      let flushed = 0;
      for (const action of queue) {
        const ok = await executeAction(action);
        if (ok) flushed += 1;
        else stillPending.push(action);
      }
      await writeQueue(stillPending);
      return { flushed, remaining: stillPending.length };
    } finally {
      inFlightFlush = null;
    }
  })();
  return inFlightFlush;
}

export async function clearPendingActionsForBook(bookId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((a) => a.bookId !== bookId));
}
