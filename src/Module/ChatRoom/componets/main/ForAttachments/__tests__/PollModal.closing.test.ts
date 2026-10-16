import { computeExpiresAtForClosingMode, isClosingTimeValid } from '../PollModal';

// Poll real-time fix (requirement 1D/1E): the quick-duration buttons and
// the future-only validation that gates the Create button.

describe('computeExpiresAtForClosingMode', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);

  it('returns null for "none"', () => {
    expect(computeExpiresAtForClosingMode('none', null, now)).toBeNull();
  });

  it('returns the custom value as-is for "custom"', () => {
    const custom = new Date(now + 10_000).toISOString();
    expect(computeExpiresAtForClosingMode('custom', custom, now)).toBe(custom);
  });

  it('returns null for "custom" when nothing has been picked yet', () => {
    expect(computeExpiresAtForClosingMode('custom', null, now)).toBeNull();
  });

  it.each([
    ['1h', 60 * 60 * 1000],
    ['6h', 6 * 60 * 60 * 1000],
    ['24h', 24 * 60 * 60 * 1000],
    ['3d', 3 * 24 * 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
  ] as const)('adds the right duration for %s', (mode, ms) => {
    expect(computeExpiresAtForClosingMode(mode, null, now)).toBe(new Date(now + ms).toISOString());
  });
});

describe('isClosingTimeValid', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);

  it('is always valid for "none"', () => {
    expect(isClosingTimeValid('none', null, now)).toBe(true);
  });

  it('is valid when the computed time is in the future', () => {
    expect(isClosingTimeValid('24h', new Date(now + 1000).toISOString(), now)).toBe(true);
  });

  it('is invalid when the computed time is in the past', () => {
    expect(isClosingTimeValid('custom', new Date(now - 1000).toISOString(), now)).toBe(false);
  });

  it('is invalid when nothing has been picked for "custom"', () => {
    expect(isClosingTimeValid('custom', null, now)).toBe(false);
  });
});
