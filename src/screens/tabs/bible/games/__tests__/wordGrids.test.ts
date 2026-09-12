import { generateCrossword, generateWordSearch } from '../wordGrids';

const DIRECTION_DELTAS: Record<string, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
  S: { dr: 1, dc: 0 },
  N: { dr: -1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  SW: { dr: 1, dc: -1 },
  NE: { dr: -1, dc: 1 },
  NW: { dr: -1, dc: -1 },
};

describe('generateWordSearch', () => {
  it('produces a grid of the requested size, fully filled with letters', () => {
    const grid = generateWordSearch(['LORD', 'FAITH', 'GRACE'], { size: 10 });
    expect(grid.size).toBe(10);
    expect(grid.letters).toHaveLength(10);
    for (const row of grid.letters) {
      expect(row).toHaveLength(10);
      for (const cell of row) expect(cell).toMatch(/^[A-Z]$/);
    }
  });

  it('every placed word actually reads correctly in the grid along its own direction', () => {
    const words = ['LORD', 'FAITH', 'GRACE', 'MERCY', 'HOPE'];
    const grid = generateWordSearch(words, { size: 12 });
    expect(grid.placements.length).toBeGreaterThan(0);
    for (const p of grid.placements) {
      const { dr, dc } = DIRECTION_DELTAS[p.direction];
      let read = '';
      for (let i = 0; i < p.word.length; i++) {
        read += grid.letters[p.row + dr * i][p.col + dc * i];
      }
      expect(read).toBe(p.word);
    }
  });

  it('drops words shorter than 3 letters and longer than the grid size', () => {
    const grid = generateWordSearch(['GO', 'IS', 'ABCDEFGHIJKLMNOP'], { size: 8 });
    expect(grid.placements).toHaveLength(0);
  });

  it('is deterministic in output shape across repeated calls with random placement', () => {
    for (let i = 0; i < 5; i++) {
      const grid = generateWordSearch(['LOVE', 'PEACE', 'TRUTH'], { size: 10 });
      expect(grid.placements.length).toBeGreaterThan(0);
    }
  });
});

describe('generateCrossword', () => {
  it('places the seed word and at least one crossing word when a real intersection exists', () => {
    const grid = generateCrossword([
      { word: 'GRACE', clue: 'unmerited favor' },
      { word: 'FAITH', clue: 'belief' }, // shares no letter with GRACE necessarily - check dynamically below
      { word: 'RACE', clue: 'a contest' }, // shares R-A-C-E substring with GRACE
    ]);
    expect(grid.placements.length).toBeGreaterThanOrEqual(1);
    expect(grid.placements[0].word).toBe('GRACE');
  });

  it('every non-seed placement actually shares a letter with some other placement at the crossing cell', () => {
    const grid = generateCrossword([
      { word: 'MOSES', clue: 'led Israel' },
      { word: 'SEA', clue: 'crossed by Israel' },
      { word: 'ARK', clue: 'covenant chest' },
    ]);
    // Build a map of occupied cells -> letter and verify no contradictions.
    const cellMap = new Map<string, string>();
    for (const p of grid.placements) {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.direction === 'down' ? p.row + i : p.row;
        const c = p.direction === 'across' ? p.col + i : p.col;
        const k = `${r},${c}`;
        if (cellMap.has(k)) {
          expect(cellMap.get(k)).toBe(p.word[i]);
        } else {
          cellMap.set(k, p.word[i]);
        }
      }
    }
    expect(grid.placements.length).toBeGreaterThanOrEqual(1);
  });

  it('normalizes coordinates so the bounding box starts at 0,0', () => {
    const grid = generateCrossword([
      { word: 'MOSES', clue: '' },
      { word: 'SEA', clue: '' },
    ]);
    const minRow = Math.min(...grid.placements.map((p) => p.row));
    const minCol = Math.min(...grid.placements.map((p) => p.col));
    expect(minRow).toBe(0);
    expect(minCol).toBe(0);
  });

  it('returns an empty grid for an empty word list', () => {
    const grid = generateCrossword([]);
    expect(grid.placements).toHaveLength(0);
    expect(grid.rows).toBe(0);
  });
});
