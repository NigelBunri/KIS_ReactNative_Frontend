import { newCardState, reviewCard, isDue, dueCards } from '../srs';

describe('srs (SM-2-lite scheduler)', () => {
  it('a new card is due immediately', () => {
    const card = newCardState('v1');
    expect(isDue(card)).toBe(true);
    expect(card.repetitions).toBe(0);
  });

  it('a "good" review on a new card schedules a 1-day interval', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const card = newCardState('v1');
    const next = reviewCard(card, 'good', now);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(new Date(next.dueAt).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('a second consecutive "good" review schedules a 6-day interval (SM-2 baseline)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const card = newCardState('v1');
    const afterFirst = reviewCard(card, 'good', now);
    const afterSecond = reviewCard(afterFirst, 'good', now);
    expect(afterSecond.repetitions).toBe(2);
    expect(afterSecond.intervalDays).toBe(6);
  });

  it('"again" resets repetitions and ease factor, schedules a 1-day interval', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    let card = newCardState('v1');
    card = reviewCard(card, 'good', now);
    card = reviewCard(card, 'good', now);
    expect(card.repetitions).toBe(2);

    const lapsed = reviewCard(card, 'again', now);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.easeFactor).toBeLessThan(card.easeFactor);
  });

  it('ease factor never drops below the 1.3 floor even after repeated lapses', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    let card = newCardState('v1');
    for (let i = 0; i < 20; i++) {
      card = reviewCard(card, 'again', now);
    }
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('"easy" grows the interval faster than "good" from the same starting state', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const base = reviewCard(newCardState('v1'), 'good', now); // repetitions=1, interval=1
    const base2 = reviewCard(base, 'good', now); // repetitions=2, interval=6

    const viaGood = reviewCard(base2, 'good', now);
    const viaEasy = reviewCard(base2, 'easy', now);
    expect(viaEasy.intervalDays).toBeGreaterThan(viaGood.intervalDays);
  });

  it('dueCards filters to only due cards and sorts soonest-due first', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const overdue = { ...newCardState('overdue'), dueAt: '2026-01-05T00:00:00.000Z' };
    const dueToday = { ...newCardState('today'), dueAt: '2026-01-10T00:00:00.000Z' };
    const notYetDue = { ...newCardState('future'), dueAt: '2026-02-01T00:00:00.000Z' };

    const result = dueCards([notYetDue, dueToday, overdue], now);
    expect(result.map((c) => c.verseId)).toEqual(['overdue', 'today']);
  });
});
