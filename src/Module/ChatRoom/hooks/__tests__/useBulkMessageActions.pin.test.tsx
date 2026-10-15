// Regression coverage for AND-044 ("pin indicator only visible to the
// pinner, not other participants"). Root cause: handlePinSelected used to
// flip isPinned via editMessage() — a purely local persist
// (useChatPersistence.ts's editMessage never calls the backend) — in
// addition to the real server round-trip via onPinMessage. That gave the
// pinning device an instant, fabricated "pinned" state no matter whether
// the actual network request succeeded, while every other participant only
// ever learns about a pin through the server's socket echo. This test
// locks in the fix: handlePinSelected must rely solely on onPinMessage
// (the single source of truth, matching the single-message pin path) and
// must never call editMessage for a pin toggle.

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useBulkMessageActions } from '../useBulkMessageActions';
import type { ChatMessage } from '../../chatTypes';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'conv1',
    serverId: 'srv1',
    fromMe: true,
    createdAt: new Date().toISOString(),
    kind: 'text',
    text: 'hello',
    isPinned: false,
    ...overrides,
  } as ChatMessage;
}

function Harness({
  onMounted,
  editMessage,
  onPinMessage,
  selectedMessages,
}: {
  onMounted: (api: ReturnType<typeof useBulkMessageActions>) => void;
  editMessage: jest.Mock;
  onPinMessage: jest.Mock;
  selectedMessages: ChatMessage[];
}) {
  const api = useBulkMessageActions({
    selectedIds: selectedMessages.map((m) => m.id),
    selectedMessages,
    messages: selectedMessages,
    editMessage,
    softDeleteMessage: jest.fn(),
    exitSelectionMode: jest.fn(),
    isSingleSelection: selectedMessages.length === 1,
    onPinMessage,
  });
  onMounted(api);
  return null;
}

describe('useBulkMessageActions.handlePinSelected (AND-044)', () => {
  it('never calls editMessage for a pin toggle — onPinMessage is the only source of truth', async () => {
    const editMessage = jest.fn().mockResolvedValue(undefined);
    const onPinMessage = jest.fn();
    const msg = makeMessage({ isPinned: false });

    let api: ReturnType<typeof useBulkMessageActions> | undefined;
    await act(async () => {
      ReactTestRenderer.create(
        <Harness
          onMounted={(a) => { api = a; }}
          editMessage={editMessage}
          onPinMessage={onPinMessage}
          selectedMessages={[msg]}
        />,
      );
    });

    await act(async () => {
      await api!.handlePinSelected();
    });

    expect(editMessage).not.toHaveBeenCalled();
    expect(onPinMessage).toHaveBeenCalledWith(msg, true);
  });

  it('toggles unpin correctly for an already-pinned message', async () => {
    const editMessage = jest.fn().mockResolvedValue(undefined);
    const onPinMessage = jest.fn();
    const msg = makeMessage({ isPinned: true });

    let api: ReturnType<typeof useBulkMessageActions> | undefined;
    await act(async () => {
      ReactTestRenderer.create(
        <Harness
          onMounted={(a) => { api = a; }}
          editMessage={editMessage}
          onPinMessage={onPinMessage}
          selectedMessages={[msg]}
        />,
      );
    });

    await act(async () => {
      await api!.handlePinSelected();
    });

    expect(editMessage).not.toHaveBeenCalled();
    expect(onPinMessage).toHaveBeenCalledWith(msg, false);
  });
});
