// src/screens/tabs/bible/games/wordGrids.ts
//
// Pure grid-construction for Word Search and Verse Crossword. Both take a
// pool of words drawn from whatever verses the partition assigned a stage
// (never a curated word list - same "works on any random slice of the
// Bible" bar every partition-driven game holds itself to) and lay them out
// deterministically-by-construction: Word Search places longest-first with
// backtracking-free random placement attempts, Crossword builds outward
// from a seed word so every later word is GUARANTEED to intersect an
// already-placed one before it's added - there's no "unsolvable puzzle"
// failure mode for either, only "fewer words fit than we hoped," handled by
// simply placing as many as fit (same graceful-degradation precedent as
// WordWeaveGame.tsx and VerseJigsawGame.tsx).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomLetter(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

// ─── Word Search ────────────────────────────────────────────────────────────

export type WordSearchDirection = 'E' | 'W' | 'S' | 'N' | 'SE' | 'SW' | 'NE' | 'NW';

const DIRECTION_DELTAS: Record<WordSearchDirection, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
  S: { dr: 1, dc: 0 },
  N: { dr: -1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  SW: { dr: 1, dc: -1 },
  NE: { dr: -1, dc: 1 },
  NW: { dr: -1, dc: -1 },
};

export type WordSearchPlacement = { word: string; row: number; col: number; direction: WordSearchDirection };

export type WordSearchGrid = {
  size: number;
  letters: string[][];
  placements: WordSearchPlacement[];
};

/** Places as many of `words` as fit into a size x size grid (longest words
 * first, since they're hardest to fit and should get first choice of
 * position), then fills every remaining empty cell with a random letter.
 * Words shorter than 3 letters are dropped - too easy to place by accident
 * and too easy to spot as noise, not a real find. */
export function generateWordSearch(words: string[], opts?: { size?: number; allowDiagonal?: boolean }): WordSearchGrid {
  const size = opts?.size ?? 10;
  const allowDiagonal = opts?.allowDiagonal ?? true;
  const directions: WordSearchDirection[] = allowDiagonal
    ? ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW']
    : ['E', 'W', 'S', 'N'];

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  const uniqueWords = Array.from(new Set(words.map((w) => w.toUpperCase()))).filter(
    (w) => w.length >= 3 && w.length <= size,
  );
  const sorted = [...uniqueWords].sort((a, b) => b.length - a.length);

  const placements: WordSearchPlacement[] = [];

  const canPlace = (word: string, row: number, col: number, dir: WordSearchDirection): boolean => {
    const { dr, dc } = DIRECTION_DELTAS[dir];
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const existing = grid[r][c];
      if (existing !== null && existing !== word[i]) return false;
    }
    return true;
  };

  const place = (word: string, row: number, col: number, dir: WordSearchDirection) => {
    const { dr, dc } = DIRECTION_DELTAS[dir];
    for (let i = 0; i < word.length; i++) {
      grid[row + dr * i][col + dc * i] = word[i];
    }
    placements.push({ word, row, col, direction: dir });
  };

  const ATTEMPTS_PER_WORD = 60;
  for (const word of sorted) {
    let placed = false;
    for (let attempt = 0; attempt < ATTEMPTS_PER_WORD && !placed; attempt++) {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      if (canPlace(word, row, col, dir)) {
        place(word, row, col, dir);
        placed = true;
      }
    }
  }

  const letters: string[][] = grid.map((row) => row.map((cell) => cell ?? randomLetter()));
  return { size, letters, placements };
}

// ─── Verse Crossword ────────────────────────────────────────────────────────

export type CrosswordDirection = 'across' | 'down';

export type CrosswordPlacement = {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: CrosswordDirection;
};

export type CrosswordGrid = {
  rows: number;
  cols: number;
  placements: CrosswordPlacement[];
};

type PendingEntry = { word: string; clue: string };

/** Builds outward from the first (longest) entry, placing every later word
 * so it crosses an already-placed one at a shared letter - guaranteed
 * solvable-by-construction, never a disconnected or overlapping-but-wrong
 * grid. Stops once every entry has been tried; an entry with no crossing
 * letter available against anything already placed is simply skipped
 * (fewer words filled in that round, not a broken grid). */
export function generateCrossword(entries: PendingEntry[], opts?: { maxWords?: number }): CrosswordGrid {
  const maxWords = opts?.maxWords ?? 6;
  const candidates = entries
    .map((e) => ({ word: e.word.toUpperCase(), clue: e.clue }))
    .filter((e) => e.word.length >= 3)
    .sort((a, b) => b.word.length - a.word.length)
    .slice(0, Math.max(maxWords * 3, maxWords)); // extra headroom since not all will find a crossing

  if (candidates.length === 0) return { rows: 0, cols: 0, placements: [] };

  // Unbounded working coordinate space (can go negative) - normalized to a
  // 0-based bounding box at the end.
  const cellLetterAt = new Map<string, string>();
  const key = (r: number, c: number) => `${r},${c}`;

  const placements: CrosswordPlacement[] = [];

  const canPlaceAt = (word: string, row: number, col: number, dir: CrosswordDirection): boolean => {
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'down' ? row + i : row;
      const c = dir === 'across' ? col + i : col;
      const existing = cellLetterAt.get(key(r, c));
      if (existing !== undefined && existing !== word[i]) return false;
    }
    return true;
  };

  const commit = (word: string, clue: string, row: number, col: number, dir: CrosswordDirection) => {
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'down' ? row + i : row;
      const c = dir === 'across' ? col + i : col;
      cellLetterAt.set(key(r, c), word[i]);
    }
    placements.push({ word, clue, row, col, direction: dir });
  };

  // Seed word, placed across at the origin.
  const seed = candidates[0];
  commit(seed.word, seed.clue, 0, 0, 'across');

  for (const entry of candidates.slice(1)) {
    if (placements.length >= maxWords) break;
    if (placements.some((p) => p.word === entry.word)) continue; // skip exact duplicates

    let bestPlacement: { row: number; col: number; direction: CrosswordDirection } | null = null;

    outer: for (const existing of placements) {
      for (let i = 0; i < entry.word.length && !bestPlacement; i++) {
        for (let j = 0; j < existing.word.length; j++) {
          if (entry.word[i] !== existing.word[j]) continue;
          const crossDir: CrosswordDirection = existing.direction === 'across' ? 'down' : 'across';
          const crossR = existing.direction === 'across' ? existing.row : existing.row + j;
          const crossC = existing.direction === 'across' ? existing.col + j : existing.col;
          const row = crossDir === 'down' ? crossR - i : crossR;
          const col = crossDir === 'across' ? crossC - i : crossC;
          if (canPlaceAt(entry.word, row, col, crossDir)) {
            bestPlacement = { row, col, direction: crossDir };
            break outer;
          }
        }
      }
    }

    if (bestPlacement) {
      commit(entry.word, entry.clue, bestPlacement.row, bestPlacement.col, bestPlacement.direction);
    }
  }

  const rowsAll = placements.flatMap((p) =>
    p.direction === 'down' ? Array.from({ length: p.word.length }, (_, i) => p.row + i) : [p.row],
  );
  const colsAll = placements.flatMap((p) =>
    p.direction === 'across' ? Array.from({ length: p.word.length }, (_, i) => p.col + i) : [p.col],
  );
  const minRow = Math.min(...rowsAll);
  const minCol = Math.min(...colsAll);
  const maxRow = Math.max(...rowsAll);
  const maxCol = Math.max(...colsAll);

  const normalized = placements.map((p) => ({ ...p, row: p.row - minRow, col: p.col - minCol }));
  return { rows: maxRow - minRow + 1, cols: maxCol - minCol + 1, placements: normalized };
}
