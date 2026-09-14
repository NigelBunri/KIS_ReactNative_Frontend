import { shouldStopPaginationAtJoinBoundary } from '../ChatRoomPage';

describe('shouldStopPaginationAtJoinBoundary', () => {
  it('stops once the oldest loaded message is at or before myJoinedAt', () => {
    expect(
      shouldStopPaginationAtJoinBoundary('2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z'),
    ).toBe(true);
  });

  it('stops on an exact timestamp match (boundary equality)', () => {
    expect(
      shouldStopPaginationAtJoinBoundary('2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z'),
    ).toBe(true);
  });

  it('does not stop while the oldest loaded message is still after myJoinedAt', () => {
    expect(
      shouldStopPaginationAtJoinBoundary('2026-01-05T00:00:00.000Z', '2026-01-03T00:00:00.000Z'),
    ).toBe(false);
  });

  it('never stops when myJoinedAt is unset (regression: conversations without the new fetch keep paginating as before)', () => {
    expect(shouldStopPaginationAtJoinBoundary('2026-01-01T00:00:00.000Z', null)).toBe(false);
    expect(shouldStopPaginationAtJoinBoundary('2026-01-01T00:00:00.000Z', undefined)).toBe(false);
  });

  it('does not stop when there is no oldest loaded message yet', () => {
    expect(shouldStopPaginationAtJoinBoundary(null, '2026-01-03T00:00:00.000Z')).toBe(false);
    expect(shouldStopPaginationAtJoinBoundary(undefined, '2026-01-03T00:00:00.000Z')).toBe(false);
  });
});
