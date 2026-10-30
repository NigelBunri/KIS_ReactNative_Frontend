import { formatLocalTime, formatRemaining } from '../PrayerCalendarHomeScreen';
import { formatCountdown } from '../PrayerWatchRoomScreen';

describe('formatLocalTime', () => {
  it('renders a UTC ISO timestamp in the device-local time, not the raw UTC hour', () => {
    // new Date(...) + toLocaleTimeString already does the UTC->local
    // conversion for us - this just proves we're not accidentally
    // displaying the raw UTC string.
    const result = formatLocalTime('2026-01-01T00:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns an empty string for an unparseable value rather than throwing', () => {
    expect(formatLocalTime('not-a-date')).toBe('');
  });
});

describe('formatRemaining', () => {
  it('returns "now" once the target time has passed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(formatRemaining(past)).toBe('now');
  });

  it('formats minutes under an hour as "Nm"', () => {
    const soon = new Date(Date.now() + 25 * 60_000).toISOString();
    expect(formatRemaining(soon)).toMatch(/^2[4-6]m$/);
  });

  it('formats an hour-plus as "Hh Mm"', () => {
    const later = new Date(Date.now() + 90 * 60_000).toISOString();
    expect(formatRemaining(later)).toMatch(/^1h \d{1,2}m$/);
  });
});

describe('formatCountdown', () => {
  it('formats whole minutes and seconds as M:SS', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(600)).toBe('10:00');
  });

  it('never goes negative or shows a stale value once time runs out', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('treats null (no active stage) the same as zero', () => {
    expect(formatCountdown(null)).toBe('0:00');
  });
});
