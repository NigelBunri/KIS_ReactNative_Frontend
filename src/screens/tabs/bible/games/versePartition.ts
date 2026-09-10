// src/screens/tabs/bible/games/versePartition.ts
//
// Splits every verse in the Bible across the 30 games so that finishing all
// 30 games means having gone through every verse in the Bible (31,102 of
// them, standard KJV count) - the whole point of the games section per its
// product aim. Two-level split, both deterministic from a single stored
// seed so nothing but the seed + per-game stage progress ever needs to be
// persisted:
//
//   1. GAME level: shuffle the 66 books' order using the seed, then walk
//      that shuffled order into 30 contiguous chunks, snapped to CHAPTER
//      boundaries (a chapter is never split across two games - a book can
//      be, if it's large enough to straddle a chunk boundary). Shuffling
//      book order first - rather than re-cutting the same canonical
//      sequence with a new seed - is what makes a reshuffle produce a
//      genuinely different set of 30 game contents rather than just a few
//      verses moving at each boundary.
//   2. STAGE level: each game's own verse span is cut into exactly 10
//      roughly-equal, contiguous stages (fixed count, not fixed size - see
//      the module docstring on gameStorage.ts). Stage cuts are plain
//      verse-count slicing, not chapter-snapped - splitting a chapter
//      across two stages of the SAME game is a much smaller coherence loss
//      than splitting one across two different games, and staying
//      unsnapped here guarantees exactly 10 non-empty stages regardless of
//      how few chapters a small game bucket contains.
//
// Reads verse text from the same bundled kjv.json every other game file
// uses (via verseText.ts's getVerseText) - this module only computes WHICH
// references belong to which game/stage, never duplicates the text itself.

import { LOCAL_BIBLE_BOOKS } from '@/data/bibleLocalData';
import kjvBible from '@/assets/bible/kjv.json';

type BundledBibleJson = Record<string, Record<string, Record<string, string>>>;
const BUNDLED_KJV: BundledBibleJson = kjvBible as BundledBibleJson;

export const TOTAL_GAMES = 30;
export const STAGES_PER_GAME = 10;

export type VerseRef = {
  bookIndex: number; // 0-65, canonical (Genesis-first) order
  bookCode: string;
  bookName: string;
  chapter: number;
  verse: number;
};

export type GameStagePartition = {
  stageIndex: number; // 0-9
  verses: VerseRef[];
};

export type GamePartition = {
  gameIndex: number; // 0-29
  verseCount: number;
  stages: GameStagePartition[]; // always exactly STAGES_PER_GAME entries
};

export type FullPartition = {
  seed: string;
  games: GamePartition[]; // always exactly TOTAL_GAMES entries
  totalVerseCount: number;
};

// ─── Seeded RNG (mulberry32) ────────────────────────────────────────────────
// Math.random() isn't seedable, and the whole point of storing a seed is a
// deterministic, reproducible partition - regenerate the same seed, get the
// same 30 games back, without persisting the partition itself.

function hashSeedString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seedNum: number): () => number {
  let a = seedNum;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A fresh random seed for a reshuffle - human-inspectable, not that it
 * matters, just easier to eyeball in logs/AsyncStorage than a raw number. */
export function generateSeed(): string {
  return `bible-games-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// ─── Canonical verse list + chapter blocks ─────────────────────────────────

type ChapterBlock = {
  bookIndex: number;
  bookCode: string;
  bookName: string;
  chapter: number;
  verses: VerseRef[];
};

let cachedChapterBlocks: ChapterBlock[] | null = null;

/** Every chapter in the Bible, in canonical order, each carrying its own
 * verses - built once and cached (kjv.json is ~4.6MB; no reason to re-walk
 * it on every partition computation). */
function getAllChapterBlocksInCanonicalOrder(): ChapterBlock[] {
  if (cachedChapterBlocks) return cachedChapterBlocks;
  const blocks: ChapterBlock[] = [];
  LOCAL_BIBLE_BOOKS.forEach((book, bookIndex) => {
    const chapters = BUNDLED_KJV[book.name];
    if (!chapters) return;
    const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b);
    for (const chapter of chapterNums) {
      const verseMap = chapters[String(chapter)];
      const verseNums = Object.keys(verseMap).map(Number).sort((a, b) => a - b);
      const verses: VerseRef[] = verseNums.map((verse) => ({
        bookIndex,
        bookCode: book.code,
        bookName: book.name,
        chapter,
        verse,
      }));
      blocks.push({ bookIndex, bookCode: book.code, bookName: book.name, chapter, verses });
    }
  });
  cachedChapterBlocks = blocks;
  return blocks;
}

/** Total verses in the bundled Bible - computed once from the real data
 * rather than hardcoded, so this is honest even if the bundled translation
 * ever changes. Expected to be 31,102 for KJV. */
export function getTotalVerseCount(): number {
  return getAllChapterBlocksInCanonicalOrder().reduce((sum, block) => sum + block.verses.length, 0);
}

// ─── Greedy contiguous chunking ─────────────────────────────────────────────
// Shared by both the game-level (chapter-snapped) and stage-level (verse-
// snapped) splits: walk an ordered list of "atomic" pieces (chapters, or
// individual verses) into `count` buckets, each targeting an equal share of
// the total - never splitting a piece, always producing exactly `count`
// buckets. Each piece is placed by where its MIDPOINT falls along the
// cumulative running total, not by a single-step "did we overshoot"
// rollover - a step-based rollover can only ever advance the bucket index
// by one per piece, so one oversized piece (a long chapter) can leave a
// later bucket completely empty while an earlier one balloons to 2x target;
// midpoint placement jumps directly to the correct bucket regardless of how
// large any single piece is, so every bucket that geometrically deserves
// content gets some.

function chunkBySize<T>(items: T[], sizeOf: (item: T) => number, count: number): T[][] {
  const total = items.reduce((sum, item) => sum + sizeOf(item), 0);
  const target = total / count;
  const buckets: T[][] = Array.from({ length: count }, () => []);
  let cumulative = 0;
  for (const item of items) {
    const size = sizeOf(item);
    const midpoint = cumulative + size / 2;
    const bucketIndex = target > 0 ? Math.min(count - 1, Math.floor(midpoint / target)) : 0;
    buckets[bucketIndex].push(item);
    cumulative += size;
  }
  return buckets;
}

// ─── Public: build the full 30-game / 10-stage-each partition ─────────────

export function buildPartitionForSeed(seed: string): FullPartition {
  const rng = mulberry32(hashSeedString(seed));
  const chapterBlocks = getAllChapterBlocksInCanonicalOrder();
  const totalVerseCount = chapterBlocks.reduce((sum, block) => sum + block.verses.length, 0);

  // Shuffle BOOK order, then re-flatten chapter blocks following that
  // shuffled book order (chapters within a book stay in their own natural
  // 1..N order - only which book comes before which is randomized).
  const shuffledBookIndexes = shuffleWithRng(
    LOCAL_BIBLE_BOOKS.map((_, i) => i),
    rng,
  );
  const blocksByBook = new Map<number, ChapterBlock[]>();
  for (const block of chapterBlocks) {
    const list = blocksByBook.get(block.bookIndex) ?? [];
    list.push(block);
    blocksByBook.set(block.bookIndex, list);
  }
  const shuffledChapterBlocks: ChapterBlock[] = shuffledBookIndexes.flatMap(
    (bookIndex) => blocksByBook.get(bookIndex) ?? [],
  );

  const gameChapterBuckets = chunkBySize(shuffledChapterBlocks, (block) => block.verses.length, TOTAL_GAMES);

  const games: GamePartition[] = gameChapterBuckets.map((blocksInGame, gameIndex) => {
    const versesInGame = blocksInGame.flatMap((block) => block.verses);
    const stageVerseBuckets = chunkBySize(versesInGame, () => 1, STAGES_PER_GAME);
    const stages: GameStagePartition[] = stageVerseBuckets.map((verses, stageIndex) => ({
      stageIndex,
      verses,
    }));
    return { gameIndex, verseCount: versesInGame.length, stages };
  });

  return { seed, games, totalVerseCount };
}

let cachedPartition: { seed: string; partition: FullPartition } | null = null;

/** Memoized per-seed - the partition is pure/deterministic, no reason to
 * recompute it on every render while the seed hasn't changed. */
export function getPartitionForSeed(seed: string): FullPartition {
  if (cachedPartition && cachedPartition.seed === seed) return cachedPartition.partition;
  const partition = buildPartitionForSeed(seed);
  cachedPartition = { seed, partition };
  return partition;
}
