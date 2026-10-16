import { isEventTimeRangeValid } from '../EventModal';

// Event date/time fix (requirement 2B): the calendar/time pickers replace
// manual text entry, but the same-day-must-be-later / multi-day-allowed
// rule has to keep working exactly as before, and match the server's own
// independent re-check (assertValidEventPayload in messages.service.ts).

describe('isEventTimeRangeValid', () => {
  it('is false when either side is missing', () => {
    expect(isEventTimeRangeValid(null, '2026-01-01T10:00:00.000Z')).toBe(false);
    expect(isEventTimeRangeValid('2026-01-01T09:00:00.000Z', null)).toBe(false);
  });

  it('is false when either side is not a parseable date', () => {
    expect(isEventTimeRangeValid('not-a-date', '2026-01-01T10:00:00.000Z')).toBe(false);
  });

  it('is false for a same-day event whose end is before its start', () => {
    expect(
      isEventTimeRangeValid('2026-01-01T15:00:00.000Z', '2026-01-01T10:00:00.000Z'),
    ).toBe(false);
  });

  it('is true for a same-day event whose end is after its start', () => {
    expect(
      isEventTimeRangeValid('2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z'),
    ).toBe(true);
  });

  it('is true for a multi-day event (end on a later calendar date)', () => {
    expect(
      isEventTimeRangeValid('2026-01-01T09:00:00.000Z', '2026-01-04T09:00:00.000Z'),
    ).toBe(true);
  });
});
