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

// ─── Bundled verse text ────────────────────────────────────────────────────
// Included so the reader is never blank when the server is cold-starting.
// KJV is public domain — no licensing concerns.

const LOCAL_GENESIS_1_VERSES = [
  { id: 'local_v_GEN_1_1',  number: 1,  text: 'In the beginning God created the heaven and the earth.' },
  { id: 'local_v_GEN_1_2',  number: 2,  text: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.' },
  { id: 'local_v_GEN_1_3',  number: 3,  text: 'And God said, Let there be light: and there was light.' },
  { id: 'local_v_GEN_1_4',  number: 4,  text: 'And God saw the light, that it was good: and God divided the light from the darkness.' },
  { id: 'local_v_GEN_1_5',  number: 5,  text: 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.' },
  { id: 'local_v_GEN_1_6',  number: 6,  text: 'And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.' },
  { id: 'local_v_GEN_1_7',  number: 7,  text: 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so.' },
  { id: 'local_v_GEN_1_8',  number: 8,  text: 'And God called the firmament Heaven. And the evening and the morning were the second day.' },
  { id: 'local_v_GEN_1_9',  number: 9,  text: 'And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so.' },
  { id: 'local_v_GEN_1_10', number: 10, text: 'And God called the dry land Earth; and the gathering together of the waters called he Seas: and God saw that it was good.' },
  { id: 'local_v_GEN_1_11', number: 11, text: 'And God said, Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind, whose seed is in itself, upon the earth: and it was so.' },
  { id: 'local_v_GEN_1_12', number: 12, text: 'And the earth brought forth grass, and herb yielding seed after his kind, and the tree yielding fruit, whose seed was in itself, after his kind: and God saw that it was good.' },
  { id: 'local_v_GEN_1_13', number: 13, text: 'And the evening and the morning were the third day.' },
  { id: 'local_v_GEN_1_14', number: 14, text: 'And God said, Let there be lights in the firmament of the heaven to divide the day from the night; and let them be for signs, and for seasons, and for days, and years:' },
  { id: 'local_v_GEN_1_15', number: 15, text: 'And let them be for lights in the firmament of the heaven to give light upon the earth: and it was so.' },
  { id: 'local_v_GEN_1_16', number: 16, text: 'And God made two great lights; the greater light to rule the day, and the lesser light to rule the night: he made the stars also.' },
  { id: 'local_v_GEN_1_17', number: 17, text: 'And God set them in the firmament of the heaven to give light upon the earth,' },
  { id: 'local_v_GEN_1_18', number: 18, text: 'And to rule over the day and over the night, and to divide the light from the darkness: and God saw that it was good.' },
  { id: 'local_v_GEN_1_19', number: 19, text: 'And the evening and the morning were the fourth day.' },
  { id: 'local_v_GEN_1_20', number: 20, text: 'And God said, Let the waters bring forth abundantly the moving creature that hath life, and fowl that may fly above the earth in the open firmament of heaven.' },
  { id: 'local_v_GEN_1_21', number: 21, text: 'And God created great whales, and every living creature that moveth, which the waters brought forth abundantly, after their kind, and every winged fowl after his kind: and God saw that it was good.' },
  { id: 'local_v_GEN_1_22', number: 22, text: 'And God blessed them, saying, Be fruitful, and multiply, and fill the waters in the seas, and let fowl multiply in the earth.' },
  { id: 'local_v_GEN_1_23', number: 23, text: 'And the evening and the morning were the fifth day.' },
  { id: 'local_v_GEN_1_24', number: 24, text: 'And God said, Let the earth bring forth the living creature after his kind, cattle, and creeping thing, and beast of the earth after his kind: and it was so.' },
  { id: 'local_v_GEN_1_25', number: 25, text: 'And God made the beast of the earth after his kind, and cattle after their kind, and every thing that creepeth upon the earth after his kind: and God saw that it was good.' },
  { id: 'local_v_GEN_1_26', number: 26, text: 'And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth, and over every creeping thing that creepeth upon the earth.' },
  { id: 'local_v_GEN_1_27', number: 27, text: 'So God created man in his own image, in the image of God created he him; male and female created he them.' },
  { id: 'local_v_GEN_1_28', number: 28, text: 'And God blessed them, and God said unto them, Be fruitful, and multiply, and replenish the earth, and subdue it: and have dominion over the fish of the sea, and over the fowl of the air, and over every living thing that moveth upon the earth.' },
  { id: 'local_v_GEN_1_29', number: 29, text: 'And God said, Behold, I have given you every herb bearing seed, which is upon the face of all the earth, and every tree, in the which is the fruit of a tree yielding seed; to you it shall be for meat.' },
  { id: 'local_v_GEN_1_30', number: 30, text: 'And to every beast of the earth, and to every fowl of the air, and to every thing that creepeth upon the earth, wherein there is life, I have given every green herb for meat: and it was so.' },
  { id: 'local_v_GEN_1_31', number: 31, text: 'And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day.' },
];

// Map of "BOOK_CODE:chapter" → verses, so more chapters can be added later.
const LOCAL_VERSES_MAP: Record<string, typeof LOCAL_GENESIS_1_VERSES> = {
  'GENESIS:1': LOCAL_GENESIS_1_VERSES,
};

import type { BibleReaderPayload } from '@/screens/tabs/bible/useBibleData';

/**
 * Return a fully-formed BibleReaderPayload from bundled local text when the
 * server is unreachable and there is no cached chapter on device.
 * Returns null if we don't have local text for the requested book+chapter.
 */
export function getLocalFallbackReader(
  bookCode: string,
  chapter: number,
): BibleReaderPayload | null {
  const key = `${bookCode}:${chapter}`;
  const verses = LOCAL_VERSES_MAP[key];
  if (!verses) return null;

  const book = LOCAL_BIBLE_BOOKS.find((b) => b.code === bookCode) ?? {
    id: `local_${bookCode}`,
    code: bookCode,
    name: bookCode,
    testament: 'OT' as const,
  };

  const chapterCount = BOOK_CHAPTER_COUNTS[bookCode] ?? 1;
  return {
    translation: LOCAL_KJV_TRANSLATION,
    book,
    chapter: { id: `local_ch_${bookCode}_${chapter}`, number: chapter, book },
    reference: `${book.name} ${chapter}`,
    navigation: {
      previous: chapter > 1
        ? { id: `local_ch_${bookCode}_${chapter - 1}`, number: chapter - 1, book }
        : null,
      next: chapter < chapterCount
        ? { id: `local_ch_${bookCode}_${chapter + 1}`, number: chapter + 1, book }
        : null,
    },
    verses,
    audio: null,
  };
}
