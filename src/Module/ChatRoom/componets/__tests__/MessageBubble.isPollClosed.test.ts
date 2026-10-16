import { isPollClosed } from '../MessageBubble';

// Poll real-time fix (requirement 1D): this is the DISPLAY-only mirror of
// the server's own isPollClosed() check (messages.service.ts) - it decides
// whether to show the vote UI as closed, never the actual enforcement
// (that always happens server-side, independently, on every vote attempt).

describe('isPollClosed', () => {
  it('is false for a poll with no expiresAt and no closedAt', () => {
    expect(isPollClosed({})).toBe(false);
  });

  it('is true once closedAt is set, regardless of expiresAt', () => {
    expect(isPollClosed({ closedAt: new Date().toISOString() })).toBe(true);
  });

  it('is false while expiresAt is still in the future', () => {
    expect(isPollClosed({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
  });

  it('is true once expiresAt has passed, even if closedAt was never persisted', () => {
    expect(isPollClosed({ expiresAt: new Date(Date.now() - 60_000).toISOString() })).toBe(true);
  });
});
