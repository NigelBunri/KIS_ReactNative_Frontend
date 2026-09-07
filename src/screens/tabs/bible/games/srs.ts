// src/screens/tabs/bible/games/srs.ts
//
// A small, self-contained SM-2-lite scheduler (the same family of algorithm
// Anki's default scheduler descends from) for Verse Vault. Deliberately the
// "lite" version — no sub-day intervals, no learning-step fine-tuning — this
// is a Bible-verse deck reviewed at most a few times a day, not a
// high-volume language-learning deck, so day-granularity is the right level
// of complexity. Pure functions, no I/O — gameStorage.ts owns persistence.

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export type SrsCardState = {
  verseId: string;
  repetitions: number;
  easeFactor: number; // starts at 2.5, standard SM-2 default; floor 1.3
  intervalDays: number;
  dueAt: string; // ISO date string
  lastReviewedAt: string | null;
};

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

export function newCardState(verseId: string): SrsCardState {
  return {
    verseId,
    repetitions: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    dueAt: new Date().toISOString(), // new cards are due immediately
    lastReviewedAt: null,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Apply one review rating to a card, returning its next scheduled state.
 * Never mutates the input. */
export function reviewCard(card: SrsCardState, rating: SrsRating, now: Date = new Date()): SrsCardState {
  let { repetitions, easeFactor, intervalDays } = card;

  if (rating === 'again') {
    // Lapses reset the learning progress but keep some ease-factor memory —
    // a card that's been lapsed before shouldn't cost as much on repeat
    // lapses as a genuinely brand-new card would.
    repetitions = 0;
    intervalDays = 1;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
  } else {
    if (rating === 'hard') {
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
    } else if (rating === 'easy') {
      easeFactor = easeFactor + 0.15;
    }
    // 'good' leaves easeFactor unchanged — the SM-2 baseline case.

    if (repetitions === 0) {
      intervalDays = rating === 'hard' ? 1 : 1;
    } else if (repetitions === 1) {
      intervalDays = rating === 'hard' ? 3 : 6;
    } else {
      const multiplier = rating === 'hard' ? Math.max(1.2, easeFactor - 0.3) : rating === 'easy' ? easeFactor * 1.3 : easeFactor;
      intervalDays = Math.max(1, Math.round(intervalDays * multiplier));
    }
    repetitions += 1;
  }

  return {
    verseId: card.verseId,
    repetitions,
    easeFactor,
    intervalDays,
    dueAt: addDays(now, intervalDays).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export function isDue(card: SrsCardState, now: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

/** Cards due now, soonest-due first, so a review session always works
 * through the most overdue material first. */
export function dueCards(cards: SrsCardState[], now: Date = new Date()): SrsCardState[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
