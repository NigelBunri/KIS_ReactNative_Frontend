import {
  clampDurationMinutes,
  evaluateNewCallSubmit,
  formatDuration,
  mergeDateAndTime,
} from '../scheduleCallSheetHelpers';

describe('clampDurationMinutes', () => {
  it('clamps below the 5 minute minimum', () => {
    expect(clampDurationMinutes(1)).toBe(5);
    expect(clampDurationMinutes(0)).toBe(5);
    expect(clampDurationMinutes(-30)).toBe(5);
  });

  it('clamps above the 24 hour maximum', () => {
    expect(clampDurationMinutes(1441)).toBe(1440);
    expect(clampDurationMinutes(10_000)).toBe(1440);
  });

  it('passes through an in-range value unchanged', () => {
    expect(clampDurationMinutes(45)).toBe(45);
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(5)).toBe('5 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats whole-hour durations without minutes', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats mixed hour+minute durations', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('caps the 24 hour maximum at "24h" rather than "24h 0m"', () => {
    expect(formatDuration(1440)).toBe('24h');
  });
});

describe('mergeDateAndTime', () => {
  it('takes the day from date and the hour/minute from time', () => {
    const date = new Date('2026-03-05T00:00:00');
    const time = new Date('2020-01-01T14:30:00');
    const merged = mergeDateAndTime(date, time);
    expect(merged.getFullYear()).toBe(2026);
    expect(merged.getMonth()).toBe(2); // March
    expect(merged.getDate()).toBe(5);
    expect(merged.getHours()).toBe(14);
    expect(merged.getMinutes()).toBe(30);
  });
});

describe('evaluateNewCallSubmit', () => {
  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 3_600_000);

  it('requires at least 1 panelist for a broadcast', () => {
    const result = evaluateNewCallSubmit({
      callType: 'broadcast', panelistCount: 0, isScheduled: false, scheduledFor: future,
    });
    expect(result.needsPanelists).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it('allows a broadcast with 1 panelist', () => {
    const result = evaluateNewCallSubmit({
      callType: 'broadcast', panelistCount: 1, isScheduled: false, scheduledFor: future,
    });
    expect(result.needsPanelists).toBe(false);
    expect(result.canSubmit).toBe(true);
  });

  it('never requires panelists for a non-broadcast call type', () => {
    const result = evaluateNewCallSubmit({
      callType: 'voice', panelistCount: 0, isScheduled: false, scheduledFor: future,
    });
    expect(result.needsPanelists).toBe(false);
    expect(result.canSubmit).toBe(true);
  });

  it('blocks submit when scheduled for a time in the past', () => {
    const result = evaluateNewCallSubmit({
      callType: 'voice', panelistCount: 0, isScheduled: true, scheduledFor: past,
    });
    expect(result.scheduleInPast).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it('allows submit when scheduled for a future time', () => {
    const result = evaluateNewCallSubmit({
      callType: 'voice', panelistCount: 0, isScheduled: true, scheduledFor: future,
    });
    expect(result.scheduleInPast).toBe(false);
    expect(result.canSubmit).toBe(true);
  });

  it('ignores scheduledFor entirely when isScheduled is false, even if it is in the past', () => {
    const result = evaluateNewCallSubmit({
      callType: 'voice', panelistCount: 0, isScheduled: false, scheduledFor: past,
    });
    expect(result.scheduleInPast).toBe(false);
    expect(result.canSubmit).toBe(true);
  });

  it('requires BOTH panelists and a future time for a scheduled broadcast', () => {
    const result = evaluateNewCallSubmit({
      callType: 'broadcast', panelistCount: 0, isScheduled: true, scheduledFor: past,
    });
    expect(result.needsPanelists).toBe(true);
    expect(result.scheduleInPast).toBe(true);
    expect(result.canSubmit).toBe(false);
  });
});
