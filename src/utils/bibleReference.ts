// src/utils/bibleReference.ts
//
// Single source of truth for detecting and parsing Bible references typed
// as plain text (e.g. "Mark 13:23" or "Mark 13:23-30") so a chat message
// can turn them into a tappable link, and so the Bible screen can build the
// same canonical reference string when sharing a verse/chapter into a chat.
//
// Book names/codes mirror src/data/bibleLocalData.ts (kept as a separate,
// dependency-light list here so this module can be imported from anywhere
// — including the chat bundle — without pulling in the bundled KJV JSON).

import { BOOK_CHAPTER_COUNTS } from '@/data/bibleLocalData';

export type BibleBookName = { name: string; code: string };

export const BIBLE_BOOK_NAMES: BibleBookName[] = [
  { name: 'Genesis', code: 'GENESIS' },
  { name: 'Exodus', code: 'EXODUS' },
  { name: 'Leviticus', code: 'LEVITICUS' },
  { name: 'Numbers', code: 'NUMBERS' },
  { name: 'Deuteronomy', code: 'DEUTERONOMY' },
  { name: 'Joshua', code: 'JOSHUA' },
  { name: 'Judges', code: 'JUDGES' },
  { name: 'Ruth', code: 'RUTH' },
  { name: '1 Samuel', code: '1_SAMUEL' },
  { name: '2 Samuel', code: '2_SAMUEL' },
  { name: '1 Kings', code: '1_KINGS' },
  { name: '2 Kings', code: '2_KINGS' },
  { name: '1 Chronicles', code: '1_CHRONICLES' },
  { name: '2 Chronicles', code: '2_CHRONICLES' },
  { name: 'Ezra', code: 'EZRA' },
  { name: 'Nehemiah', code: 'NEHEMIAH' },
  { name: 'Esther', code: 'ESTHER' },
  { name: 'Job', code: 'JOB' },
  { name: 'Psalms', code: 'PSALMS' },
  { name: 'Proverbs', code: 'PROVERBS' },
  { name: 'Ecclesiastes', code: 'ECCLESIASTES' },
  { name: 'Song of Solomon', code: 'SONG_OF_SOLOMON' },
  { name: 'Isaiah', code: 'ISAIAH' },
  { name: 'Jeremiah', code: 'JEREMIAH' },
  { name: 'Lamentations', code: 'LAMENTATIONS' },
  { name: 'Ezekiel', code: 'EZEKIEL' },
  { name: 'Daniel', code: 'DANIEL' },
  { name: 'Hosea', code: 'HOSEA' },
  { name: 'Joel', code: 'JOEL' },
  { name: 'Amos', code: 'AMOS' },
  { name: 'Obadiah', code: 'OBADIAH' },
  { name: 'Jonah', code: 'JONAH' },
  { name: 'Micah', code: 'MICAH' },
  { name: 'Nahum', code: 'NAHUM' },
  { name: 'Habakkuk', code: 'HABAKKUK' },
  { name: 'Zephaniah', code: 'ZEPHANIAH' },
  { name: 'Haggai', code: 'HAGGAI' },
  { name: 'Zechariah', code: 'ZECHARIAH' },
  { name: 'Malachi', code: 'MALACHI' },
  { name: 'Matthew', code: 'MATTHEW' },
  { name: 'Mark', code: 'MARK' },
  { name: 'Luke', code: 'LUKE' },
  { name: 'John', code: 'JOHN' },
  { name: 'Acts', code: 'ACTS' },
  { name: 'Romans', code: 'ROMANS' },
  { name: '1 Corinthians', code: '1_CORINTHIANS' },
  { name: '2 Corinthians', code: '2_CORINTHIANS' },
  { name: 'Galatians', code: 'GALATIANS' },
  { name: 'Ephesians', code: 'EPHESIANS' },
  { name: 'Philippians', code: 'PHILIPPIANS' },
  { name: 'Colossians', code: 'COLOSSIANS' },
  { name: '1 Thessalonians', code: '1_THESSALONIANS' },
  { name: '2 Thessalonians', code: '2_THESSALONIANS' },
  { name: '1 Timothy', code: '1_TIMOTHY' },
  { name: '2 Timothy', code: '2_TIMOTHY' },
  { name: 'Titus', code: 'TITUS' },
  { name: 'Philemon', code: 'PHILEMON' },
  { name: 'Hebrews', code: 'HEBREWS' },
  { name: 'James', code: 'JAMES' },
  { name: '1 Peter', code: '1_PETER' },
  { name: '2 Peter', code: '2_PETER' },
  { name: '1 John', code: '1_JOHN' },
  { name: '2 John', code: '2_JOHN' },
  { name: '3 John', code: '3_JOHN' },
  { name: 'Jude', code: 'JUDE' },
  { name: 'Revelation', code: 'REVELATION' },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest name first: at a given starting index the regex engine tries
// alternatives in order, so "Song of Solomon" (etc.) must be offered before
// any shorter name that could otherwise short-circuit the match early.
const BOOK_NAME_ALTERNATION = [...BIBLE_BOOK_NAMES]
  .sort((a, b) => b.name.length - a.name.length)
  .map((b) => escapeRegExp(b.name))
  .join('|');

// Matches "Mark 13:23", "Mark 13: 23", "1 Samuel 13:23-30", "Mark 13:23 - 30".
const REFERENCE_PATTERN = `\\b(${BOOK_NAME_ALTERNATION})\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*-\\s*(\\d{1,3}))?\\b`;

export const BIBLE_REFERENCE_RE = new RegExp(REFERENCE_PATTERN, 'i');
// Global + case-insensitive, for splitting a whole message into segments.
export const BIBLE_REFERENCE_SPLIT_RE = new RegExp(`(${REFERENCE_PATTERN})`, 'gi');

const BOOK_NAME_TO_CODE = new Map(BIBLE_BOOK_NAMES.map((b) => [b.name.toLowerCase(), b.code]));
const BOOK_CODE_TO_NAME = new Map(BIBLE_BOOK_NAMES.map((b) => [b.code, b.name]));

export type ParsedBibleReference = {
  raw: string;
  bookName: string;
  bookCode: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  /** Canonical "Book chapter:verseStart[-verseEnd]" string. */
  reference: string;
};

/** Parses the FIRST Bible reference found in `text`, or null if none/invalid. */
export function parseBibleReference(text: string): ParsedBibleReference | null {
  const match = text.match(BIBLE_REFERENCE_RE);
  if (!match) return null;
  return buildParsedReference(match);
}

function buildParsedReference(match: RegExpMatchArray): ParsedBibleReference | null {
  const [raw, bookName, chapterStr, verseStartStr, verseEndStr] = match;
  const bookCode = BOOK_NAME_TO_CODE.get(bookName.toLowerCase());
  if (!bookCode) return null;

  const chapter = Number(chapterStr);
  const verseStart = Number(verseStartStr);
  const verseEnd = verseEndStr ? Number(verseEndStr) : undefined;
  if (!chapter || !verseStart) return null;

  const chapterCount = BOOK_CHAPTER_COUNTS[bookCode];
  if (chapterCount && chapter > chapterCount) return null;
  if (verseEnd !== undefined && verseEnd < verseStart) return null;

  const canonicalBookName = BOOK_CODE_TO_NAME.get(bookCode) ?? bookName;
  const reference = verseEnd
    ? `${canonicalBookName} ${chapter}:${verseStart}-${verseEnd}`
    : `${canonicalBookName} ${chapter}:${verseStart}`;

  return { raw, bookName: canonicalBookName, bookCode, chapter, verseStart, verseEnd, reference };
}

/** Builds the canonical reference string for a verse or a verse range, e.g. for sharing. */
export function formatBibleReference(bookName: string, chapter: number, verseStart: number, verseEnd?: number): string {
  return verseEnd && verseEnd !== verseStart
    ? `${bookName} ${chapter}:${verseStart}-${verseEnd}`
    : `${bookName} ${chapter}:${verseStart}`;
}
