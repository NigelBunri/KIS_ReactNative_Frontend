jest.mock('@/network/config', () => ({ NEST_API_BASE_URL: 'https://nest.example.com' }));

import ROUTES from '@/network';

// Regression test: every one of these routes previously pointed at
// `${NEST_API_BASE_URL}/api/v1/calls/...`, but Nest's CallsController is
// `@Controller('calls')` — mounted at `/calls`, not `/api/v1/calls`. Only
// `history` "worked" (200/401 instead of 404), because app.controller.ts
// had a dead stub sitting at exactly that wrong path returning fake-empty
// data — every other route here was a flat 404. This silently broke ICE/
// TURN credentials, server-side call history (so a fresh install/login
// never saw past calls), scheduled calls, the active-call banner, and
// invite-link joining, all at once. Locking in the correct path shape so
// a future edit can't reintroduce the mismatch unnoticed.
describe('ROUTES.calls — must match CallsController\'s real mount path (/calls, not /api/v1/calls)', () => {
  const BASE = 'https://nest.example.com';

  it('iceServers', () => {
    expect(ROUTES.calls.iceServers).toBe(`${BASE}/calls/ice-servers`);
  });

  it('history', () => {
    expect(ROUTES.calls.history).toBe(`${BASE}/calls/history`);
  });

  it('missedCount', () => {
    expect(ROUTES.calls.missedCount).toBe(`${BASE}/calls/missed-count`);
  });

  it('standalone', () => {
    expect(ROUTES.calls.standalone).toBe(`${BASE}/calls/standalone`);
  });

  it('scheduled', () => {
    expect(ROUTES.calls.scheduled).toBe(`${BASE}/calls/scheduled`);
  });

  it('inviteLink', () => {
    expect(ROUTES.calls.inviteLink).toBe(`${BASE}/calls/invite-link`);
  });

  it('joinByToken', () => {
    expect(ROUTES.calls.joinByToken('tok-1')).toBe(`${BASE}/calls/join/tok-1`);
  });

  it('active', () => {
    expect(ROUTES.calls.active('conv-1')).toBe(`${BASE}/calls/active?conversationId=conv-1`);
  });

  it('forConversation', () => {
    expect(ROUTES.calls.forConversation('conv-1', 10)).toBe(`${BASE}/calls/conversation?conversationId=conv-1&limit=10`);
  });

  it('none of them accidentally reintroduce the /api/v1/calls prefix', () => {
    const urls = [
      ROUTES.calls.iceServers,
      ROUTES.calls.history,
      ROUTES.calls.missedCount,
      ROUTES.calls.standalone,
      ROUTES.calls.scheduled,
      ROUTES.calls.inviteLink,
      ROUTES.calls.joinByToken('t'),
      ROUTES.calls.active('c'),
      ROUTES.calls.forConversation('c'),
    ];
    for (const url of urls) {
      expect(url).not.toContain('/api/v1/calls');
    }
  });
});
