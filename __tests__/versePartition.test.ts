import {
  buildPartitionForSeed,
  getTotalVerseCount,
  STAGES_PER_GAME,
  TOTAL_GAMES,
  type VerseRef,
} from '@/screens/tabs/bible/games/versePartition';

function refKey(ref: VerseRef): string {
  return `${ref.bookName}|${ref.chapter}|${ref.verse}`;
}

describe('versePartition', () => {
  it('the bundled Bible has the standard KJV verse count', () => {
    expect(getTotalVerseCount()).toBe(31102);
  });

  it('produces exactly 30 games, each with exactly 10 stages', () => {
    const partition = buildPartitionForSeed('test-seed-a');
    expect(partition.games).toHaveLength(TOTAL_GAMES);
    for (const game of partition.games) {
      expect(game.stages).toHaveLength(STAGES_PER_GAME);
    }
  });

  it('every stage has at least one verse', () => {
    const partition = buildPartitionForSeed('test-seed-a');
    for (const game of partition.games) {
      for (const stage of game.stages) {
        expect(stage.verses.length).toBeGreaterThan(0);
      }
    }
  });

  it('every verse in the Bible appears in exactly one game/stage - no gaps, no duplicates', () => {
    const partition = buildPartitionForSeed('test-seed-a');
    const seen = new Map<string, number>();
    let totalAcrossPartition = 0;
    for (const game of partition.games) {
      for (const stage of game.stages) {
        for (const verse of stage.verses) {
          const key = refKey(verse);
          seen.set(key, (seen.get(key) ?? 0) + 1);
          totalAcrossPartition += 1;
        }
      }
    }
    expect(totalAcrossPartition).toBe(31102);
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
    expect(duplicates).toEqual([]);
  });

  it('a game never carries verses from more chapters worth of content than its own bucket - i.e. within one game, each chapter present is fully present, never split across two different games', () => {
    const partition = buildPartitionForSeed('test-seed-a');
    // Build chapter -> set of games it appears in.
    const chapterToGames = new Map<string, Set<number>>();
    partition.games.forEach((game) => {
      game.stages.forEach((stage) => {
        stage.verses.forEach((verse) => {
          const chKey = `${verse.bookName}|${verse.chapter}`;
          const set = chapterToGames.get(chKey) ?? new Set<number>();
          set.add(game.gameIndex);
          chapterToGames.set(chKey, set);
        });
      });
    });
    const splitChapters = [...chapterToGames.entries()].filter(([, games]) => games.size > 1);
    expect(splitChapters).toEqual([]);
  });

  it('is deterministic - the same seed always produces the same partition', () => {
    const a = buildPartitionForSeed('same-seed');
    const b = buildPartitionForSeed('same-seed');
    expect(a.games.map((g) => g.verseCount)).toEqual(b.games.map((g) => g.verseCount));
    expect(refKey(a.games[0].stages[0].verses[0])).toBe(refKey(b.games[0].stages[0].verses[0]));
  });

  it('different seeds produce a genuinely different partition, not just boundary jitter', () => {
    const a = buildPartitionForSeed('seed-one');
    const b = buildPartitionForSeed('seed-two');
    // Compare which book opens game 0 under each seed - shuffling book
    // order first (not just re-cutting the canonical sequence) means this
    // should differ far more often than not across arbitrary seed pairs.
    const firstBookA = a.games[0].stages[0].verses[0].bookName;
    const firstBookB = b.games[0].stages[0].verses[0].bookName;
    expect(firstBookA).not.toBe(firstBookB);
  });

  it('game bucket sizes are roughly even (within a generous tolerance for chapter-snapping)', () => {
    const partition = buildPartitionForSeed('test-seed-a');
    const target = 31102 / TOTAL_GAMES;
    for (const game of partition.games) {
      // Chapter-snapping means real sizes vary - the largest chapter in the
      // Bible (Psalm 119, 176 verses) bounds how far off-target a single
      // chunk can land relative to the ~1037-verse target.
      expect(game.verseCount).toBeGreaterThan(target * 0.5);
      expect(game.verseCount).toBeLessThan(target * 1.5);
    }
  });
});
