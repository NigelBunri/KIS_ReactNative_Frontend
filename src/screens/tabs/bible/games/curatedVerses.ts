// src/screens/tabs/bible/games/curatedVerses.ts
//
// A hand-picked set of well-known, game-friendly verses — short enough for
// fill-in-the-blank/word-reconstruction, famous enough that "who said this /
// which book is this from" trivia has a fair chance of being answerable, and
// spanning both testaments. Deliberately NOT "every verse in the Bible" —
// genealogies, legal codes, and 40-word run-on sentences make terrible game
// material regardless of how well-built the game engine is.
//
// Only references are hardcoded here; the actual verse text is always read
// live from the bundled kjv.json (see verseText.ts) so there's a single
// source of truth for wording and no risk of a transcription slip in this
// file silently drifting from what the Read tab shows for the same verse.

export type CuratedVerseRef = {
  id: string;
  bookCode: string; // matches LOCAL_BIBLE_BOOKS[].code in @/data/bibleLocalData
  bookName: string; // display name, also the key into kjv.json
  chapter: number;
  verse: number;
  reference: string; // e.g. "John 3:16"
  // For trivia's "who said this" question type — omitted where the speaker
  // is ambiguous/narrator, in which case that question type is simply
  // skipped for this verse (see scriptureTrivia.ts).
  speaker?: string;
};

const V = (
  id: string,
  bookCode: string,
  bookName: string,
  chapter: number,
  verse: number,
  speaker?: string,
): CuratedVerseRef => ({
  id,
  bookCode,
  bookName,
  chapter,
  verse,
  reference: `${bookName} ${chapter}:${verse}`,
  speaker,
});

export const CURATED_VERSES: CuratedVerseRef[] = [
  // ── Old Testament ─────────────────────────────────────────────────────────
  V('gen_1_1', 'GENESIS', 'Genesis', 1, 1, 'the narrator'),
  V('gen_1_27', 'GENESIS', 'Genesis', 1, 27, 'the narrator'),
  V('exo_20_3', 'EXODUS', 'Exodus', 20, 3, 'God'),
  V('deu_6_5', 'DEUTERONOMY', 'Deuteronomy', 6, 5, 'Moses'),
  V('jos_1_9', 'JOSHUA', 'Joshua', 1, 9, 'God'),
  V('psa_23_1', 'Psalms', 'Psalms', 23, 1, 'David'),
  V('psa_46_1', 'Psalms', 'Psalms', 46, 1, 'the psalmist'),
  V('psa_119_105', 'Psalms', 'Psalms', 119, 105, 'the psalmist'),
  V('pro_3_5', 'PROVERBS', 'Proverbs', 3, 5, 'Solomon'),
  V('pro_22_6', 'PROVERBS', 'Proverbs', 22, 6, 'Solomon'),
  V('isa_9_6', 'ISAIAH', 'Isaiah', 9, 6, 'Isaiah'),
  V('isa_40_31', 'ISAIAH', 'Isaiah', 40, 31, 'Isaiah'),
  V('isa_41_10', 'ISAIAH', 'Isaiah', 41, 10, 'God'),
  V('jer_29_11', 'JEREMIAH', 'Jeremiah', 29, 11, 'God'),
  V('jer_33_3', 'JEREMIAH', 'Jeremiah', 33, 3, 'God'),
  V('lam_3_22', 'LAMENTATIONS', 'Lamentations', 3, 22, 'Jeremiah'),
  V('mic_6_8', 'MICAH', 'Micah', 6, 8, 'Micah'),
  V('hab_2_4', 'HABAKKUK', 'Habakkuk', 2, 4, 'God'),

  // ── Gospels ───────────────────────────────────────────────────────────────
  V('mat_5_16', 'MATTHEW', 'Matthew', 5, 16, 'Jesus'),
  V('mat_6_33', 'MATTHEW', 'Matthew', 6, 33, 'Jesus'),
  V('mat_11_28', 'MATTHEW', 'Matthew', 11, 28, 'Jesus'),
  V('mat_28_19', 'MATTHEW', 'Matthew', 28, 19, 'Jesus'),
  V('mrk_12_30', 'MARK', 'Mark', 12, 30, 'Jesus'),
  V('luk_2_11', 'LUKE', 'Luke', 2, 11, 'an angel'),
  V('luk_6_31', 'LUKE', 'Luke', 6, 31, 'Jesus'),
  V('jhn_1_1', 'JOHN', 'John', 1, 1, 'John'),
  V('jhn_3_16', 'JOHN', 'John', 3, 16, 'Jesus'),
  V('jhn_8_12', 'JOHN', 'John', 8, 12, 'Jesus'),
  V('jhn_11_25', 'JOHN', 'John', 11, 25, 'Jesus'),
  V('jhn_13_34', 'JOHN', 'John', 13, 34, 'Jesus'),
  V('jhn_14_6', 'JOHN', 'John', 14, 6, 'Jesus'),
  V('jhn_16_33', 'JOHN', 'John', 16, 33, 'Jesus'),

  // ── Acts / Epistles ───────────────────────────────────────────────────────
  V('act_1_8', 'ACTS', 'Acts', 1, 8, 'Jesus'),
  V('act_4_12', 'ACTS', 'Acts', 4, 12, 'Peter'),
  V('rom_3_23', 'ROMANS', 'Romans', 3, 23, 'Paul'),
  V('rom_5_8', 'ROMANS', 'Romans', 5, 8, 'Paul'),
  V('rom_6_23', 'ROMANS', 'Romans', 6, 23, 'Paul'),
  V('rom_8_28', 'ROMANS', 'Romans', 8, 28, 'Paul'),
  V('rom_8_38', 'ROMANS', 'Romans', 8, 38, 'Paul'),
  V('rom_10_9', 'ROMANS', 'Romans', 10, 9, 'Paul'),
  V('rom_12_2', 'ROMANS', 'Romans', 12, 2, 'Paul'),
  V('1co_10_13', '1_CORINTHIANS', '1 Corinthians', 10, 13, 'Paul'),
  V('1co_13_4', '1_CORINTHIANS', '1 Corinthians', 13, 4, 'Paul'),
  V('1co_13_13', '1_CORINTHIANS', '1 Corinthians', 13, 13, 'Paul'),
  V('1co_15_57', '1_CORINTHIANS', '1 Corinthians', 15, 57, 'Paul'),
  V('2co_5_17', '2_CORINTHIANS', '2 Corinthians', 5, 17, 'Paul'),
  V('2co_5_7', '2_CORINTHIANS', '2 Corinthians', 5, 7, 'Paul'),
  V('gal_2_20', 'GALATIANS', 'Galatians', 2, 20, 'Paul'),
  V('gal_5_22', 'GALATIANS', 'Galatians', 5, 22, 'Paul'),
  V('eph_2_8', 'EPHESIANS', 'Ephesians', 2, 8, 'Paul'),
  V('eph_6_11', 'EPHESIANS', 'Ephesians', 6, 11, 'Paul'),
  V('phl_1_6', 'PHILIPPIANS', 'Philippians', 1, 6, 'Paul'),
  V('phl_4_6', 'PHILIPPIANS', 'Philippians', 4, 6, 'Paul'),
  V('phl_4_13', 'PHILIPPIANS', 'Philippians', 4, 13, 'Paul'),
  V('col_3_23', 'COLOSSIANS', 'Colossians', 3, 23, 'Paul'),
  V('1th_5_16', '1_THESSALONIANS', '1 Thessalonians', 5, 16, 'Paul'),
  V('1ti_4_12', '1_TIMOTHY', '1 Timothy', 4, 12, 'Paul'),
  V('2ti_1_7', '2_TIMOTHY', '2 Timothy', 1, 7, 'Paul'),
  V('heb_11_1', 'HEBREWS', 'Hebrews', 11, 1, 'the author of Hebrews'),
  V('heb_12_1', 'HEBREWS', 'Hebrews', 12, 1, 'the author of Hebrews'),
  V('jas_1_2', 'JAMES', 'James', 1, 2, 'James'),
  V('jas_1_17', 'JAMES', 'James', 1, 17, 'James'),
  V('1pe_5_7', '1_PETER', '1 Peter', 5, 7, 'Peter'),
  V('1jn_1_9', '1_JOHN', '1 John', 1, 9, 'John'),
  V('1jn_4_19', '1_JOHN', '1 John', 4, 19, 'John'),
  V('rev_3_20', 'REVELATION', 'Revelation', 3, 20, 'Jesus'),
  V('rev_21_4', 'REVELATION', 'Revelation', 21, 4, 'an angel'),
];

export function randomCuratedVerse(exclude?: Set<string>): CuratedVerseRef {
  const pool = exclude ? CURATED_VERSES.filter((v) => !exclude.has(v.id)) : CURATED_VERSES;
  const source = pool.length ? pool : CURATED_VERSES;
  return source[Math.floor(Math.random() * source.length)];
}

export function shuffledCuratedVerses(count: number): CuratedVerseRef[] {
  const copy = [...CURATED_VERSES];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}
