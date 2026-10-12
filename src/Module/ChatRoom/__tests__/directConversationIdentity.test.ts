// Regression coverage for the real root cause of "both call participants
// see the same name": directConversationName()/directConversationAvatar()
// had a self-exclusion check that only ran when `participant.user` arrived
// as a nested OBJECT. ParticipantWire's own type allows `.user` to be a
// bare id (`UserWire | number | string | null`) — when it was, the
// self-check was skipped entirely and the function fell through to an
// unguarded `participant.display_name`/`avatar_url` fallback, which could
// return the CURRENT USER'S OWN name/avatar as "the conversation partner".
// Since a conversation's participants array is identical no matter who
// requests it, whichever participant happened to be first in the array got
// shown to EVERY viewer — including that participant themselves — which is
// exactly how two different users could end up seeing the same name.
//
// This chat.name/avatar value flows directly into call initiation
// (ChatRoomPage.tsx passes `chat.name` as the call's `title`), so this is
// the upstream source of the call-identity bug, not just a chat-list
// cosmetic issue.

import { directConversationName, directConversationAvatar } from '../messagesUtils';

describe('directConversationName — self-exclusion', () => {
  it('returns the OTHER participant\'s name when both have proper nested user objects', () => {
    const participants = [
      { user: { id: 'me', display_name: 'Me Myself' } },
      { user: { id: 'them', display_name: 'The Other Person' } },
    ];
    expect(directConversationName(participants, 'me')).toBe('The Other Person');
  });

  it('never returns the current user\'s own name even when they are first in the array', () => {
    const participants = [
      { user: { id: 'me', display_name: 'Me Myself' } },
      { user: { id: 'them', display_name: 'The Other Person' } },
    ];
    // Same array, viewed by "them" this time — must flip to the opposite name.
    expect(directConversationName(participants, 'them')).toBe('Me Myself');
  });

  it('THE BUG: excludes self even when `.user` is a bare id, not a nested object', () => {
    // This is the exact shape that broke: no nested `user` object, so the
    // old code's self-check (which lived inside `if (u && typeof u ===
    // 'object')`) never ran, and execution fell straight through to the
    // unguarded `display_name` fallback for whichever participant was
    // first — even if that was the viewer themselves.
    const participants = [
      { user: 'me', display_name: 'Me Myself' },
      { user: 'them', display_name: 'The Other Person' },
    ];
    expect(directConversationName(participants, 'me')).toBe('The Other Person');
    expect(directConversationName(participants, 'them')).toBe('Me Myself');
  });

  it('both viewers of the SAME conversation record see opposite names, never the same one', () => {
    const participants = [
      { user: 'user-a', display_name: 'Alice' },
      { user: 'user-b', display_name: 'Bob' },
    ];
    const asAlice = directConversationName(participants, 'user-a');
    const asBob = directConversationName(participants, 'user-b');
    expect(asAlice).toBe('Bob');
    expect(asBob).toBe('Alice');
    expect(asAlice).not.toBe(asBob);
  });

  it('falls back to participant-row id only as an absolute last resort, still never self by name', () => {
    const participants = [
      { user: 'me', id: 'row-1' },
      { user: 'them', id: 'row-2' },
    ];
    expect(directConversationName(participants, 'me')).toBe('row-2');
  });

  it('legacy plain string[] participants still resolve correctly (no user-wire shape at all)', () => {
    expect(directConversationName(['user-a', 'user-b'], 'user-a')).toBe('user-b');
    expect(directConversationName(['user-a', 'user-b'], 'user-b')).toBe('user-a');
  });
});

describe('directConversationAvatar — self-exclusion', () => {
  it('never returns the current user\'s own avatar when `.user` is a bare id', () => {
    const participants = [
      { user: 'me', avatar_url: 'https://example.com/me.jpg' },
      { user: 'them', avatar_url: 'https://example.com/them.jpg' },
    ];
    expect(directConversationAvatar(participants, 'me')).toBe('https://example.com/them.jpg');
    expect(directConversationAvatar(participants, 'them')).toBe('https://example.com/me.jpg');
  });

  it('prefers the nested user.profile avatar when available', () => {
    const participants = [
      { user: { id: 'me', profile: { avatar_url: 'https://example.com/me.jpg' } } },
      { user: { id: 'them', profile: { avatar_url: 'https://example.com/them.jpg' } } },
    ];
    expect(directConversationAvatar(participants, 'me')).toBe('https://example.com/them.jpg');
  });
});
