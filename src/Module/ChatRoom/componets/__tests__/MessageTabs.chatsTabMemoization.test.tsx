// Regression coverage for the chat-list jank fix: ChatsTab's normalizedChats
// previously re-ran normalizeConversation() for EVERY conversation on every
// `conversations` array reference change (which happens on every incoming
// message, even for an unrelated conversation), allocating a brand-new Chat
// object for every row every time. Since ChatRow is wrapped in React.memo
// and receives that Chat object as its `item` prop, this meant every row in
// the list re-rendered on every socket tick, not just the one row whose data
// actually changed - the dominant cause of the reported chat-list jank/
// flicker. This test renders the real FlatList and asserts that an
// UNRELATED conversation's list-item object keeps the exact same reference
// across a `conversations` update that only changes one OTHER conversation -
// the property React.memo needs to correctly skip re-rendering it.
jest.mock('@/theme/useTheme', () => ({
  useKISTheme: () => ({ palette: {} }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList } from 'react-native';
import { ChatsTab } from '../MessageTabs';

function makeConversation(id: string, lastAt: string) {
  return {
    id,
    type: 'direct',
    title: `Chat ${id}`,
    participants: [{ id: 'me' }, { id: `other-${id}` }],
    last_message_at: lastAt,
    last_message_preview: `hello from ${id}`,
    unread_count: 0,
  };
}

describe('ChatsTab normalizedChats memoization', () => {
  const activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(async () => {
    while (activeRenderers.length) {
      const r = activeRenderers.pop()!;
      await ReactTestRenderer.act(async () => {
        r.unmount();
      });
    }
  });

  it('keeps an unrelated conversation item referentially stable when only one other conversation updates', async () => {
    const conv1v1 = makeConversation('conv-1', '2026-01-01T00:00:00.000Z');
    const conv2v1 = makeConversation('conv-2', '2026-01-01T00:00:01.000Z');

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ChatsTab
          conversations={[conv1v1, conv2v1]}
          filters={[]}
          activeQuick={new Set()}
          search=""
          currentUserId="me"
          onOpenChat={() => {}}
        />,
      );
    });
    activeRenderers.push(renderer);

    const dataAfterFirstRender = renderer.root.findByType(FlatList as any).props.data;
    const conv1ItemFirst = dataAfterFirstRender.find((item: any) => item.id === 'conv-1');
    expect(conv1ItemFirst).toBeTruthy();

    // Simulate an incoming message updating ONLY conv-2 - this is exactly
    // MessagesScreen.tsx's own setConversations((prev) => prev.map(...))
    // pattern: a brand-new top-level array, but conv1v1's own object
    // reference is reused unchanged (the real upstream behavior this fix
    // depends on).
    const conv2v2 = { ...conv2v1, last_message_preview: 'a new message just arrived' };
    await ReactTestRenderer.act(async () => {
      renderer.update(
        <ChatsTab
          conversations={[conv1v1, conv2v2]}
          filters={[]}
          activeQuick={new Set()}
          search=""
          currentUserId="me"
          onOpenChat={() => {}}
        />,
      );
    });

    const dataAfterSecondRender = renderer.root.findByType(FlatList as any).props.data;
    const conv1ItemSecond = dataAfterSecondRender.find((item: any) => item.id === 'conv-1');

    // The actual regression guard: conv-1 never changed, so its normalized
    // Chat object must be the EXACT SAME reference both times - the
    // precondition React.memo(ChatRow) needs to skip re-rendering it.
    expect(conv1ItemSecond).toBe(conv1ItemFirst);

    const conv2ItemSecond = dataAfterSecondRender.find((item: any) => item.id === 'conv-2');
    expect(conv2ItemSecond.lastMessage).toContain('a new message just arrived');
  });
});
