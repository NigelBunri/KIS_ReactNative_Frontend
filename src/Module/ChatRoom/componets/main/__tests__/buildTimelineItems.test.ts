import { buildTimelineItems } from '../MessageList';
import type { ChatMessage } from '../../../chatTypes';

const mkMessage = (overrides: Partial<ChatMessage> & { id: string; createdAt: string }): ChatMessage => ({
  roomId: 'room-1',
  clientId: overrides.id,
  senderId: 'someone',
  fromMe: false,
  ...overrides,
});

describe('buildTimelineItems', () => {
  it('inserts exactly one joinBoundary item at the correct sorted position given mixed pre/post-join messages', () => {
    const messages: ChatMessage[] = [
      mkMessage({ id: 'm1', createdAt: '2026-01-01T00:00:00.000Z', isPreJoinHidden: true, text: '🔒 hidden' }),
      mkMessage({ id: 'm2', createdAt: '2026-01-02T00:00:00.000Z', isPreJoinHidden: true, text: '🔒 hidden' }),
      mkMessage({ id: 'm3', createdAt: '2026-01-05T00:00:00.000Z', text: 'after I joined' }),
    ];

    const items = buildTimelineItems(messages, [], '2026-01-03T00:00:00.000Z');

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'joinBoundary', createdAt: '2026-01-03T00:00:00.000Z' });
    expect(items[1]).toMatchObject({ type: 'message' });
    if (items[1].type === 'message') {
      expect(items[1].message.id).toBe('m3');
    }
  });

  it('excludes isPreJoinHidden messages from the rendered timeline entirely', () => {
    const messages: ChatMessage[] = [
      mkMessage({ id: 'm1', createdAt: '2026-01-01T00:00:00.000Z', isPreJoinHidden: true, text: '🔒 hidden' }),
      mkMessage({ id: 'm2', createdAt: '2026-01-05T00:00:00.000Z', text: 'visible' }),
    ];

    const items = buildTimelineItems(messages, [], '2026-01-03T00:00:00.000Z');

    const messageIds = items
      .filter((i) => i.type === 'message')
      .map((i) => (i.type === 'message' ? i.message.id : null));
    expect(messageIds).toEqual(['m2']);
  });

  it('is absent when all messages are post-join (nothing to draw a boundary against)', () => {
    const messages: ChatMessage[] = [
      mkMessage({ id: 'm1', createdAt: '2026-01-05T00:00:00.000Z', text: 'after' }),
      mkMessage({ id: 'm2', createdAt: '2026-01-06T00:00:00.000Z', text: 'after too' }),
    ];

    const items = buildTimelineItems(messages, [], '2026-01-03T00:00:00.000Z');

    expect(items.some((i) => i.type === 'joinBoundary')).toBe(false);
    expect(items).toHaveLength(2);
  });

  it('is absent when myJoinedAt is unset (regression: screens without the new fetch keep working)', () => {
    const messages: ChatMessage[] = [
      mkMessage({ id: 'm1', createdAt: '2026-01-01T00:00:00.000Z', text: 'a' }),
      mkMessage({ id: 'm2', createdAt: '2026-01-02T00:00:00.000Z', text: 'b' }),
    ];

    const items = buildTimelineItems(messages, [], null);

    expect(items.some((i) => i.type === 'joinBoundary')).toBe(false);
    expect(items).toHaveLength(2);
  });

  it('appears exactly once even with many pre-join messages', () => {
    const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) =>
      mkMessage({
        id: `pre-${i}`,
        createdAt: `2026-01-01T00:0${i}:00.000Z`,
        isPreJoinHidden: true,
        text: '🔒 hidden',
      }),
    );
    messages.push(mkMessage({ id: 'post-1', createdAt: '2026-01-05T00:00:00.000Z', text: 'after' }));

    const items = buildTimelineItems(messages, [], '2026-01-03T00:00:00.000Z');

    const boundaries = items.filter((i) => i.type === 'joinBoundary');
    expect(boundaries).toHaveLength(1);
    // No pre-join bubbles rendered at all - just the one boundary + the one post-join message.
    expect(items).toHaveLength(2);
  });
});
