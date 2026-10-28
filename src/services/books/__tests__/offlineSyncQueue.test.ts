const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
}));

jest.mock('@/network/put', () => ({ putData: jest.fn() }));
jest.mock('@/network/post', () => ({ postRequest: jest.fn() }));
jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    books: {
      progress: (id: string) => `/books/${id}/progress/`,
      chapterHighlights: (id: string, stableId: string) => `/books/${id}/chapters/${stableId}/highlights/`,
      chapterBookmarkToggle: (id: string, stableId: string) => `/books/${id}/chapters/${stableId}/bookmark/`,
    },
  },
}));

import {
  enqueuePendingAction,
  pendingActionsForBook,
  flushPendingBookSyncQueue,
  clearPendingActionsForBook,
} from '../offlineSyncQueue';
import { putData } from '@/network/put';
import { postRequest } from '@/network/post';

describe('offlineSyncQueue', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    jest.clearAllMocks();
  });

  it('enqueues a progress action and lists it for its book', async () => {
    await enqueuePendingAction({
      type: 'progress',
      bookId: 'book-1',
      payload: { chapter_stable_id: 'c1', block_index: 0, percent_complete: 0.5, is_completed: false },
    });
    const pending = await pendingActionsForBook('book-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('progress');
  });

  it('does not lose a highlight queued while offline — it survives until flushed', async () => {
    await enqueuePendingAction({
      type: 'highlight',
      bookId: 'book-1',
      chapterStableId: 'c1',
      payload: { block_id: 'b1', start_offset: 0, end_offset: 10, color: 'yellow', note: '' },
    });
    const pendingBeforeFlush = await pendingActionsForBook('book-1');
    expect(pendingBeforeFlush).toHaveLength(1);
  });

  it('flush removes only successfully-synced actions, keeps failed ones queued', async () => {
    (putData as jest.Mock).mockResolvedValueOnce({ success: true });
    (postRequest as jest.Mock).mockResolvedValueOnce({ success: false, message: 'still offline' });

    await enqueuePendingAction({
      type: 'progress',
      bookId: 'book-1',
      payload: { chapter_stable_id: 'c1', block_index: 0, percent_complete: 1, is_completed: true },
    });
    await enqueuePendingAction({
      type: 'highlight',
      bookId: 'book-1',
      chapterStableId: 'c1',
      payload: { block_id: 'b1', start_offset: 0, end_offset: 5, color: 'green', note: '' },
    });

    const result = await flushPendingBookSyncQueue();
    expect(result.flushed).toBe(1);
    expect(result.remaining).toBe(1);

    const stillPending = await pendingActionsForBook('book-1');
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].type).toBe('highlight');
  });

  it('a network exception during flush leaves the action queued, not lost', async () => {
    (putData as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    await enqueuePendingAction({
      type: 'progress',
      bookId: 'book-2',
      payload: { chapter_stable_id: 'c1', block_index: 0, percent_complete: 0.2, is_completed: false },
    });
    const result = await flushPendingBookSyncQueue();
    expect(result.flushed).toBe(0);
    expect(result.remaining).toBe(1);
  });

  it('does not lose a bookmark toggle queued while offline, and flushes it', async () => {
    (postRequest as jest.Mock).mockResolvedValueOnce({ success: true, data: { bookmarked: true } });
    await enqueuePendingAction({ type: 'bookmark', bookId: 'book-1', chapterStableId: 'c1' });
    expect(await pendingActionsForBook('book-1')).toHaveLength(1);

    const result = await flushPendingBookSyncQueue();
    expect(result.flushed).toBe(1);
    expect(postRequest).toHaveBeenCalledWith('/books/book-1/chapters/c1/bookmark/', {});
    expect(await pendingActionsForBook('book-1')).toHaveLength(0);
  });

  it('two overlapping flush calls apply a queued bookmark toggle only once, never double-flips it', async () => {
    let resolveFirst: (v: any) => void;
    const firstCallPromise = new Promise((resolve) => { resolveFirst = resolve; });
    (postRequest as jest.Mock).mockImplementationOnce(() => firstCallPromise);

    await enqueuePendingAction({ type: 'bookmark', bookId: 'book-1', chapterStableId: 'c1' });

    // Fire two flushes "concurrently" (same event-loop tick), exactly like
    // the NetInfo listener and a screen-focus refresh landing together.
    const flushA = flushPendingBookSyncQueue();
    const flushB = flushPendingBookSyncQueue();

    resolveFirst!({ success: true, data: { bookmarked: true } });
    await Promise.all([flushA, flushB]);

    // Only the first call's single network request should have fired —
    // the second flush call shared the same in-flight promise rather
    // than independently re-reading the queue and re-toggling.
    expect(postRequest).toHaveBeenCalledTimes(1);
  });

  it('clearPendingActionsForBook only clears the named book', async () => {
    await enqueuePendingAction({
      type: 'progress', bookId: 'book-1',
      payload: { chapter_stable_id: 'c1', block_index: 0, percent_complete: 1, is_completed: true },
    });
    await enqueuePendingAction({
      type: 'progress', bookId: 'book-2',
      payload: { chapter_stable_id: 'c1', block_index: 0, percent_complete: 1, is_completed: true },
    });
    await clearPendingActionsForBook('book-1');
    expect(await pendingActionsForBook('book-1')).toHaveLength(0);
    expect(await pendingActionsForBook('book-2')).toHaveLength(1);
  });
});
