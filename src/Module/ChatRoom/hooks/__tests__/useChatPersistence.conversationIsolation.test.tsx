// Regression coverage for the CRITICAL privacy/conversation-isolation
// defect: messages from a previously open conversation briefly rendering
// inside a newly opened one. Root cause: the INITIAL LOAD effect in
// useChatPersistence.ts re-runs whenever `roomId` changes, but its entire
// body is async (AsyncStorage/file reads, decrypt hydration) - `messages`
// state was left completely untouched until the very end of that chain.
// ChatRoomPage.tsx renders directly off `messages` with no gate on
// `isLoading`, so the PREVIOUS room's messages stayed fully visible on
// screen for the entire duration of the new room's async load.
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => ({
  DeviceEventEmitter: { emit: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const mockLoadMessages = jest.fn();
const mockSaveMessages = jest.fn().mockResolvedValue(undefined);
const mockMarkRoomHasPending = jest.fn().mockResolvedValue(undefined);
const mockUnmarkRoomHasPending = jest.fn().mockResolvedValue(undefined);
const mockWithRoomStoreLock = jest.fn((...args: any[]) => (args[2] as () => Promise<any>)());

jest.mock('../../Storage/chatStorage', () => ({
  loadMessages: (...args: any[]) => mockLoadMessages(...args),
  saveMessages: (...args: any[]) => mockSaveMessages(...args),
  markRoomHasPending: (...args: any[]) => mockMarkRoomHasPending(...args),
  unmarkRoomHasPending: (...args: any[]) => mockUnmarkRoomHasPending(...args),
  withRoomStoreLock: (...args: any[]) => mockWithRoomStoreLock(...args),
}));

jest.mock('../../Storage/decryptedMessageStorage', () => ({
  hydrateDecryptedMessages: (_userId: any, messages: any[]) => Promise.resolve(messages),
}));

import { useChatPersistence, type UseChatPersistenceResult } from '../useChatPersistence';
import type { ChatMessage } from '../../chatTypes';

// Flushes the INITIAL LOAD effect's full async chain (loadMessages ->
// hydrateDecryptedMessages x2 -> setMessages) after a mocked promise
// resolves mid-test. setImmediate (a real macrotask) only runs once every
// currently-queued microtask has drained, which is a stronger guarantee
// than a fixed count of Promise.resolve() hops - that approach was
// observed to be flaky (occasionally not enough ticks) when this file ran
// alongside the rest of the suite rather than in isolation.
const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const msg = (id: string, conversationId: string): ChatMessage =>
  ({
    id,
    serverId: id,
    conversationId,
    roomId: conversationId,
    senderId: 'user-other',
    text: `message in ${conversationId}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'delivered',
  } as unknown as ChatMessage);

function Reader({
  roomId,
  currentUserId,
  onRead,
}: {
  roomId: string;
  currentUserId: string;
  onRead: (v: UseChatPersistenceResult) => void;
}) {
  onRead(useChatPersistence({ roomId, currentUserId, sendOverNetwork: undefined as any }));
  return null;
}

async function renderPersistence(props: { roomId: string; currentUserId: string }) {
  let latest!: UseChatPersistenceResult;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Reader {...props} onRead={(v) => { latest = v; }} />,
    );
  });
  return {
    get current() { return latest; },
    rerender: async (next: typeof props) => {
      ReactTestRenderer.act(() => {
        renderer.update(<Reader {...next} onRead={(v) => { latest = v; }} />);
      });
    },
  };
}

describe('useChatPersistence — conversation isolation on room switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveMessages.mockResolvedValue(undefined);
  });

  it('never leaves conversation A messages visible while conversation B is loading', async () => {
    let resolveA: (v: ChatMessage[]) => void;
    mockLoadMessages.mockImplementation((roomId: string) => {
      if (roomId === 'room-A') return Promise.resolve([msg('a1', 'room-A')]);
      if (roomId === 'room-B') {
        return new Promise<ChatMessage[]>((resolve) => { resolveA = resolve; });
      }
      return Promise.resolve([]);
    });

    const hook = await renderPersistence({ roomId: 'room-A', currentUserId: 'me' });
    expect(hook.current.messages.map((m) => m.id)).toEqual(['a1']);

    // Switch to room B - its load is deliberately held open (unresolved).
    await hook.rerender({ roomId: 'room-B', currentUserId: 'me' });

    // CRITICAL: room A's message must already be gone, synchronously,
    // even though room B's own load has not resolved yet. The bug this
    // guards against is exactly this list still containing a1 here.
    expect(hook.current.messages).toEqual([]);

    // Now let room B's load resolve - its own message should appear.
    await act(async () => {
      resolveA!([msg('b1', 'room-B')]);
      await flushMicrotasks();
    });
    expect(hook.current.messages.map((m) => m.id)).toEqual(['b1']);
  });

  it('a slow room A response that resolves AFTER switching to room B must not overwrite room B', async () => {
    // Every call to loadMessages for a given roomId (including the
    // migration-merge re-fetch of the just-left room - see
    // useChatPersistence.ts's `previousRoomId` handling, pre-existing
    // behavior unrelated to this fix) is held open until this test
    // explicitly resolves that roomId via resolveRoom() below.
    const pending: Record<string, Array<(v: ChatMessage[]) => void>> = {};
    mockLoadMessages.mockImplementation(
      (roomId: string) =>
        new Promise<ChatMessage[]>((resolve) => {
          (pending[roomId] ??= []).push(resolve);
        }),
    );
    const resolveRoom = (roomId: string, value: ChatMessage[]) => {
      (pending[roomId] ?? []).forEach((resolve) => resolve(value));
      pending[roomId] = [];
    };

    const hook = await renderPersistence({ roomId: 'room-A', currentUserId: 'me' });
    await hook.rerender({ roomId: 'room-B', currentUserId: 'me' });
    expect(hook.current.messages).toEqual([]);

    // Resolve both - including whatever order the real timing would (A's
    // own original request, and B's own migration re-fetch of A, which
    // only becomes pending once B's own load resolves) - and verify A's
    // content never ends up attributed to B regardless of that ordering.
    await act(async () => {
      for (let pass = 0; pass < 5; pass += 1) {
        resolveRoom('room-A', [msg('a1', 'room-A')]);
        resolveRoom('room-B', [msg('b1', 'room-B')]);
        await flushMicrotasks();
      }
    });
    // Only room B's own message may be visible - room A's stale/migrated
    // content must never appear attributed to conversation B.
    expect(hook.current.messages.map((m) => m.id)).toEqual(['b1']);
  });

  it('switching rapidly through three conversations ends up showing only the last one', async () => {
    const pending: Record<string, Array<(v: ChatMessage[]) => void>> = {};
    mockLoadMessages.mockImplementation(
      (roomId: string) =>
        new Promise<ChatMessage[]>((resolve) => {
          (pending[roomId] ??= []).push(resolve);
        }),
    );
    const resolveRoom = (roomId: string, value: ChatMessage[]) => {
      (pending[roomId] ?? []).forEach((resolve) => resolve(value));
      pending[roomId] = [];
    };

    const hook = await renderPersistence({ roomId: 'room-1', currentUserId: 'me' });
    await hook.rerender({ roomId: 'room-2', currentUserId: 'me' });
    await hook.rerender({ roomId: 'room-3', currentUserId: 'me' });
    expect(hook.current.messages).toEqual([]);

    // Each room's own migration step (re-fetching whatever
    // previousRoomIdRef pointed at when ITS effect started) only becomes a
    // new pending loadMessages call once that room's OWN load resolves -
    // so resolving everything currently pending has to happen over
    // several passes to catch each cascading migration fetch as it
    // appears, not just once.
    const resultByRoom: Record<string, ChatMessage[]> = {
      'room-1': [msg('r1', 'room-1')],
      'room-2': [msg('r2', 'room-2')],
      'room-3': [msg('r3', 'room-3')],
    };
    await act(async () => {
      for (let pass = 0; pass < 5; pass += 1) {
        for (const roomId of Object.keys(resultByRoom)) {
          resolveRoom(roomId, resultByRoom[roomId]);
        }
        await flushMicrotasks();
      }
    });

    expect(hook.current.messages.map((m) => m.id)).toEqual(['r3']);
  });
});
