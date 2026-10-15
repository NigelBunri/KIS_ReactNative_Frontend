import {
  getMaxTilesPerPage,
  computeGridColumns,
  paginateParticipants,
  clampPageIndex,
  computeTileCell,
  resolveMainStageParticipants,
  resolveBroadcastMainStage,
} from '../callGridMath';

describe('getMaxTilesPerPage', () => {
  it('returns the configured cap per device class/orientation', () => {
    expect(getMaxTilesPerPage('compactPhone', false)).toBe(4);
    expect(getMaxTilesPerPage('compactPhone', true)).toBe(6);
    expect(getMaxTilesPerPage('phone', false)).toBe(6);
    expect(getMaxTilesPerPage('phone', true)).toBe(9);
    expect(getMaxTilesPerPage('tablet', false)).toBe(9);
    expect(getMaxTilesPerPage('tablet', true)).toBe(12);
    expect(getMaxTilesPerPage('largeTablet', false)).toBe(12);
    expect(getMaxTilesPerPage('largeTablet', true)).toBe(16);
    expect(getMaxTilesPerPage('watch', false)).toBe(1);
  });
});

describe('computeGridColumns', () => {
  it('handles the single-tile case', () => {
    expect(computeGridColumns(1, 400, 800)).toBe(1);
  });
  it('uses 2 columns up to 4 tiles in a portrait (tall) container', () => {
    expect(computeGridColumns(4, 400, 800)).toBe(2);
  });
  it('uses 3 columns for 5-9 tiles in a portrait container', () => {
    expect(computeGridColumns(9, 400, 800)).toBe(3);
  });
  it('uses 4 columns beyond 9 tiles', () => {
    expect(computeGridColumns(12, 400, 800)).toBe(4);
  });
  it('bumps columns up by one in a wide landscape container', () => {
    expect(computeGridColumns(4, 800, 400)).toBe(3);
  });
  it('never returns more columns than there are tiles', () => {
    expect(computeGridColumns(2, 1200, 400)).toBe(2);
  });
});

describe('paginateParticipants', () => {
  it('splits evenly divisible counts into equal pages', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(paginateParticipants(items, 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
  it('gives the last page fewer items when the count is not evenly divisible', () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateParticipants(items, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('handles a single participant', () => {
    expect(paginateParticipants([1], 6)).toEqual([[1]]);
  });
  it('returns an empty array for an empty list', () => {
    expect(paginateParticipants([], 6)).toEqual([]);
  });
  it('falls back to a single page when pageSize is non-positive', () => {
    expect(paginateParticipants([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});

describe('clampPageIndex', () => {
  it('leaves an in-range page untouched', () => {
    expect(clampPageIndex(1, 3)).toBe(1);
  });
  it('clamps down to the last page when the current page no longer exists', () => {
    expect(clampPageIndex(5, 3)).toBe(2);
  });
  it('clamps negative pages up to 0', () => {
    expect(clampPageIndex(-1, 3)).toBe(0);
  });
  it('returns 0 when there are no pages at all', () => {
    expect(clampPageIndex(2, 0)).toBe(0);
  });
});

describe('computeTileCell', () => {
  it('divides the container evenly across columns/rows minus gaps', () => {
    expect(computeTileCell(300, 300, 3, 1, 0)).toEqual({ width: 100, height: 300 });
  });
  it('accounts for gap spacing between tiles', () => {
    // 3 columns, 2 gaps of 6 -> (312 - 12) / 3 = 100
    expect(computeTileCell(312, 200, 3, 1, 6)).toEqual({ width: 100, height: 200 });
  });
  it('never returns a negative size for a tiny container', () => {
    const cell = computeTileCell(10, 10, 4, 4, 8);
    expect(cell.width).toBeGreaterThanOrEqual(0);
    expect(cell.height).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveMainStageParticipants', () => {
  const a = { userId: 'a' };
  const b = { userId: 'b', isScreenSharing: true };
  const c = { userId: 'c' };

  it('falls back to the pinned participant, unchanged, when no one is sharing', () => {
    expect(resolveMainStageParticipants([a, c], { pinnedUserId: 'c' })).toEqual([c]);
  });

  it('falls back to the active speaker when nothing is pinned and no one is sharing', () => {
    expect(resolveMainStageParticipants([a, c], { activeSpeakerId: 'c' })).toEqual([c]);
  });

  it('falls back to the first participant when nothing is pinned, no active speaker, and no one is sharing', () => {
    expect(resolveMainStageParticipants([a, c], {})).toEqual([a]);
  });

  it('returns an empty array for an empty participant list', () => {
    expect(resolveMainStageParticipants([], {})).toEqual([]);
  });

  it('a screen-sharer wins over a manually pinned DIFFERENT participant', () => {
    expect(resolveMainStageParticipants([a, b, c], { pinnedUserId: 'c' })).toEqual([b]);
  });

  it('a screen-sharer wins over the active speaker too', () => {
    expect(resolveMainStageParticipants([a, b, c], { activeSpeakerId: 'a' })).toEqual([b]);
  });

  it('the sharer being ALSO the pinned/active-speaker participant still just returns them once', () => {
    expect(resolveMainStageParticipants([a, b, c], { pinnedUserId: 'b' })).toEqual([b]);
  });

  it('returns every simultaneous sharer when more than one participant is sharing', () => {
    const d = { userId: 'd', isScreenSharing: true };
    expect(resolveMainStageParticipants([a, b, c, d], {})).toEqual([b, d]);
  });

  it('falls back correctly once the sharer leaves mid-call', () => {
    const withSharer = resolveMainStageParticipants([a, b, c], { pinnedUserId: 'a' });
    expect(withSharer).toEqual([b]);
    const afterSharerLeft = resolveMainStageParticipants([a, c], { pinnedUserId: 'a' });
    expect(afterSharerLeft).toEqual([a]);
  });
});

describe('resolveBroadcastMainStage', () => {
  const host = { userId: 'host', isVideoOff: false };
  const camOn1 = { userId: 'cam1', isVideoOff: false };
  const camOn2 = { userId: 'cam2', isVideoOff: false };
  const camOn3 = { userId: 'cam3', isVideoOff: false };
  const camOff = { userId: 'camoff', isVideoOff: true };

  it('existing behavior unchanged when no one is sharing: host + camera-on, capped', () => {
    expect(resolveBroadcastMainStage(host, [camOn1, camOn2, camOn3, camOff], 3)).toEqual([
      host,
      camOn1,
      camOn2,
    ]);
  });

  it('a screen-sharing co-host/speaker is always included, even past the cap', () => {
    const sharer = { userId: 'sharer', isVideoOff: false, isScreenSharing: true };
    const result = resolveBroadcastMainStage(host, [camOn1, camOn2, camOn3, sharer], 2);
    expect(result).toContain(sharer);
    expect(result).toContain(host);
    // cap(2) expands to fit the guaranteed set (host + sharer = 2), then
    // adds no further camOnStage participants since the cap is already met.
    expect(result).toHaveLength(2);
  });

  it('multiple simultaneous sharers are all guaranteed, expanding the cap as needed', () => {
    const sharer1 = { userId: 's1', isVideoOff: false, isScreenSharing: true };
    const sharer2 = { userId: 's2', isVideoOff: false, isScreenSharing: true };
    const result = resolveBroadcastMainStage(host, [camOn1, sharer1, sharer2], 2);
    expect(result).toEqual([host, sharer1, sharer2]);
  });

  it('a screen-sharing PRIMARY HOST is not duplicated in the guaranteed set', () => {
    const sharingHost = { userId: 'host', isVideoOff: false, isScreenSharing: true };
    const result = resolveBroadcastMainStage(sharingHost, [camOn1, camOn2], 4);
    expect(result.filter(p => p.userId === 'host')).toHaveLength(1);
  });

  it('camera-off participants are never included regardless of sharing elsewhere', () => {
    const sharer = { userId: 'sharer', isVideoOff: false, isScreenSharing: true };
    const result = resolveBroadcastMainStage(host, [camOff, sharer], 4);
    expect(result).not.toContain(camOff);
  });

  it('handles no primary host (e.g. host left mid-call) gracefully', () => {
    const sharer = { userId: 'sharer', isVideoOff: false, isScreenSharing: true };
    expect(resolveBroadcastMainStage(null, [camOn1, sharer], 2)).toEqual([sharer, camOn1]);
  });

  it('falls back correctly once the sharer stops sharing mid-call', () => {
    const sharer = { userId: 'sharer', isVideoOff: false, isScreenSharing: true };
    const withShare = resolveBroadcastMainStage(host, [camOn1, sharer], 2);
    expect(withShare).toContain(sharer);
    const stoppedSharing = { ...sharer, isScreenSharing: false };
    const afterStop = resolveBroadcastMainStage(host, [camOn1, stoppedSharing], 2);
    expect(afterStop).toEqual([host, camOn1, stoppedSharing].slice(0, 2));
  });
});
