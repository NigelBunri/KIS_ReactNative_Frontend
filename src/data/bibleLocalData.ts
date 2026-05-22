// src/data/bibleLocalData.ts
//
// Static fallback data so the Bible screen is usable even when the backend
// is cold-starting (Render free tier sleeps after 15 min inactivity).
//
// IDs are prefixed "local_" so the app can tell them apart from real server
// IDs — once the API responds the real data replaces these.

import type { BibleBook, BibleTranslation } from '@/screens/tabs/bible/useBibleData';

export const LOCAL_KJV_TRANSLATION: BibleTranslation = {
  id:        'local_kjv',
  code:      'EN_KING_JAMES_BIBLE',
  name:      'King James Bible',
  language:  'en',
  is_public: true,
};

// Chapter counts per book — used when the chapters API is unreachable so the
// chapter picker still works while the server wakes up.
export const BOOK_CHAPTER_COUNTS: Record<string, number> = {
  GENESIS: 50, EXODUS: 40, LEVITICUS: 27, NUMBERS: 36, DEUTERONOMY: 34,
  JOSHUA: 24, JUDGES: 21, RUTH: 4, '1_SAMUEL': 31, '2_SAMUEL': 24,
  '1_KINGS': 22, '2_KINGS': 25, '1_CHRONICLES': 29, '2_CHRONICLES': 36,
  EZRA: 10, NEHEMIAH: 13, ESTHER: 10, JOB: 42, PSALMS: 150,
  PROVERBS: 31, ECCLESIASTES: 12, SONG_OF_SOLOMON: 8, ISAIAH: 66,
  JEREMIAH: 52, LAMENTATIONS: 5, EZEKIEL: 48, DANIEL: 12, HOSEA: 14,
  JOEL: 3, AMOS: 9, OBADIAH: 1, JONAH: 4, MICAH: 7, NAHUM: 3,
  HABAKKUK: 3, ZEPHANIAH: 3, HAGGAI: 2, ZECHARIAH: 14, MALACHI: 4,
  MATTHEW: 28, MARK: 16, LUKE: 24, JOHN: 21, ACTS: 28,
  ROMANS: 16, '1_CORINTHIANS': 16, '2_CORINTHIANS': 13, GALATIANS: 6,
  EPHESIANS: 6, PHILIPPIANS: 4, COLOSSIANS: 4, '1_THESSALONIANS': 5,
  '2_THESSALONIANS': 3, '1_TIMOTHY': 6, '2_TIMOTHY': 4, TITUS: 3,
  PHILEMON: 1, HEBREWS: 13, JAMES: 5, '1_PETER': 5, '2_PETER': 3,
  '1_JOHN': 5, '2_JOHN': 1, '3_JOHN': 1, JUDE: 1, REVELATION: 22,
};

export const LOCAL_BIBLE_BOOKS: BibleBook[] = [
  // ── Old Testament ────────────────────────────────────────────────────────
  { id: 'local_1',  code: 'GENESIS',          name: 'Genesis',          testament: 'OT' },
  { id: 'local_2',  code: 'EXODUS',           name: 'Exodus',           testament: 'OT' },
  { id: 'local_3',  code: 'LEVITICUS',        name: 'Leviticus',        testament: 'OT' },
  { id: 'local_4',  code: 'NUMBERS',          name: 'Numbers',          testament: 'OT' },
  { id: 'local_5',  code: 'DEUTERONOMY',      name: 'Deuteronomy',      testament: 'OT' },
  { id: 'local_6',  code: 'JOSHUA',           name: 'Joshua',           testament: 'OT' },
  { id: 'local_7',  code: 'JUDGES',           name: 'Judges',           testament: 'OT' },
  { id: 'local_8',  code: 'RUTH',             name: 'Ruth',             testament: 'OT' },
  { id: 'local_9',  code: '1_SAMUEL',         name: '1 Samuel',         testament: 'OT' },
  { id: 'local_10', code: '2_SAMUEL',         name: '2 Samuel',         testament: 'OT' },
  { id: 'local_11', code: '1_KINGS',          name: '1 Kings',          testament: 'OT' },
  { id: 'local_12', code: '2_KINGS',          name: '2 Kings',          testament: 'OT' },
  { id: 'local_13', code: '1_CHRONICLES',     name: '1 Chronicles',     testament: 'OT' },
  { id: 'local_14', code: '2_CHRONICLES',     name: '2 Chronicles',     testament: 'OT' },
  { id: 'local_15', code: 'EZRA',             name: 'Ezra',             testament: 'OT' },
  { id: 'local_16', code: 'NEHEMIAH',         name: 'Nehemiah',         testament: 'OT' },
  { id: 'local_17', code: 'ESTHER',           name: 'Esther',           testament: 'OT' },
  { id: 'local_18', code: 'JOB',              name: 'Job',              testament: 'OT' },
  { id: 'local_19', code: 'PSALMS',           name: 'Psalms',           testament: 'OT' },
  { id: 'local_20', code: 'PROVERBS',         name: 'Proverbs',         testament: 'OT' },
  { id: 'local_21', code: 'ECCLESIASTES',     name: 'Ecclesiastes',     testament: 'OT' },
  { id: 'local_22', code: 'SONG_OF_SOLOMON',  name: 'Song of Solomon',  testament: 'OT' },
  { id: 'local_23', code: 'ISAIAH',           name: 'Isaiah',           testament: 'OT' },
  { id: 'local_24', code: 'JEREMIAH',         name: 'Jeremiah',         testament: 'OT' },
  { id: 'local_25', code: 'LAMENTATIONS',     name: 'Lamentations',     testament: 'OT' },
  { id: 'local_26', code: 'EZEKIEL',          name: 'Ezekiel',          testament: 'OT' },
  { id: 'local_27', code: 'DANIEL',           name: 'Daniel',           testament: 'OT' },
  { id: 'local_28', code: 'HOSEA',            name: 'Hosea',            testament: 'OT' },
  { id: 'local_29', code: 'JOEL',             name: 'Joel',             testament: 'OT' },
  { id: 'local_30', code: 'AMOS',             name: 'Amos',             testament: 'OT' },
  { id: 'local_31', code: 'OBADIAH',          name: 'Obadiah',          testament: 'OT' },
  { id: 'local_32', code: 'JONAH',            name: 'Jonah',            testament: 'OT' },
  { id: 'local_33', code: 'MICAH',            name: 'Micah',            testament: 'OT' },
  { id: 'local_34', code: 'NAHUM',            name: 'Nahum',            testament: 'OT' },
  { id: 'local_35', code: 'HABAKKUK',         name: 'Habakkuk',         testament: 'OT' },
  { id: 'local_36', code: 'ZEPHANIAH',        name: 'Zephaniah',        testament: 'OT' },
  { id: 'local_37', code: 'HAGGAI',           name: 'Haggai',           testament: 'OT' },
  { id: 'local_38', code: 'ZECHARIAH',        name: 'Zechariah',        testament: 'OT' },
  { id: 'local_39', code: 'MALACHI',          name: 'Malachi',          testament: 'OT' },
  // ── New Testament ─────────────────────────────────────────────────────────
  { id: 'local_40', code: 'MATTHEW',          name: 'Matthew',          testament: 'NT' },
  { id: 'local_41', code: 'MARK',             name: 'Mark',             testament: 'NT' },
  { id: 'local_42', code: 'LUKE',             name: 'Luke',             testament: 'NT' },
  { id: 'local_43', code: 'JOHN',             name: 'John',             testament: 'NT' },
  { id: 'local_44', code: 'ACTS',             name: 'Acts',             testament: 'NT' },
  { id: 'local_45', code: 'ROMANS',           name: 'Romans',           testament: 'NT' },
  { id: 'local_46', code: '1_CORINTHIANS',    name: '1 Corinthians',    testament: 'NT' },
  { id: 'local_47', code: '2_CORINTHIANS',    name: '2 Corinthians',    testament: 'NT' },
  { id: 'local_48', code: 'GALATIANS',        name: 'Galatians',        testament: 'NT' },
  { id: 'local_49', code: 'EPHESIANS',        name: 'Ephesians',        testament: 'NT' },
  { id: 'local_50', code: 'PHILIPPIANS',      name: 'Philippians',      testament: 'NT' },
  { id: 'local_51', code: 'COLOSSIANS',       name: 'Colossians',       testament: 'NT' },
  { id: 'local_52', code: '1_THESSALONIANS',  name: '1 Thessalonians',  testament: 'NT' },
  { id: 'local_53', code: '2_THESSALONIANS',  name: '2 Thessalonians',  testament: 'NT' },
  { id: 'local_54', code: '1_TIMOTHY',        name: '1 Timothy',        testament: 'NT' },
  { id: 'local_55', code: '2_TIMOTHY',        name: '2 Timothy',        testament: 'NT' },
  { id: 'local_56', code: 'TITUS',            name: 'Titus',            testament: 'NT' },
  { id: 'local_57', code: 'PHILEMON',         name: 'Philemon',         testament: 'NT' },
  { id: 'local_58', code: 'HEBREWS',          name: 'Hebrews',          testament: 'NT' },
  { id: 'local_59', code: 'JAMES',            name: 'James',            testament: 'NT' },
  { id: 'local_60', code: '1_PETER',          name: '1 Peter',          testament: 'NT' },
  { id: 'local_61', code: '2_PETER',          name: '2 Peter',          testament: 'NT' },
  { id: 'local_62', code: '1_JOHN',           name: '1 John',           testament: 'NT' },
  { id: 'local_63', code: '2_JOHN',           name: '2 John',           testament: 'NT' },
  { id: 'local_64', code: '3_JOHN',           name: '3 John',           testament: 'NT' },
  { id: 'local_65', code: 'JUDE',             name: 'Jude',             testament: 'NT' },
  { id: 'local_66', code: 'REVELATION',       name: 'Revelation',       testament: 'NT' },
];

/** Build a chapters array from the local count table — used when the server is unreachable. */
export function localChaptersForBook(bookCode: string): Array<{ id: string; number: number }> {
  const count = BOOK_CHAPTER_COUNTS[bookCode] ?? 0;
  return Array.from({ length: count }, (_, i) => ({
    id:     `local_ch_${bookCode}_${i + 1}`,
    number: i + 1,
  }));
}

/** True if `id` came from local fallback data, not the real API. */
export const isLocalId = (id: string) => String(id).startsWith('local_');
