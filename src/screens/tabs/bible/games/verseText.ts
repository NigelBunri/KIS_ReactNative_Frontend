// src/screens/tabs/bible/games/verseText.ts
//
// All 6 games read verse text from here, and only from here — a single,
// live lookup into the bundled kjv.json (never a hardcoded string anywhere
// in a game file) so wording always matches what src/data/bibleLocalData.ts
// and the Read tab itself would show for the same reference. Fully offline:
// kjv.json is bundled into the app binary, not fetched.

import kjvBible from '@/assets/bible/kjv.json';

type BundledBibleJson = Record<string, Record<string, Record<string, string>>>;
const BUNDLED_KJV: BundledBibleJson = kjvBible as BundledBibleJson;

/** Raw verse text for one reference. Empty string if not found (never throws — a
 * missing verse is a game-content gap, not a crash). */
export function getVerseText(bookName: string, chapter: number, verse: number): string {
  const chapterMap = BUNDLED_KJV[bookName];
  if (!chapterMap) return '';
  const verseMap = chapterMap[String(chapter)];
  if (!verseMap) return '';
  return String(verseMap[String(verse)] || '').trim();
}

/** Strip trailing punctuation/whitespace so tokenized word comparisons
 * ("God" vs "God,") aren't defeated by punctuation attached to a word. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '');
}

/** Split verse text into display-ready word tokens (punctuation kept for
 * display, stripped only when comparing for correctness via normalizeWord). */
export function tokenizeVerse(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export type ChapterVerseEntry = { verse: number; text: string };

/** Every verse of one chapter, in order - for the handful of games that
 * present a whole chapter rather than a single verse (Chapter Scroll's
 * scroll-through, Verse Crossword/Word Search's word pools drawn from a
 * fuller span of text than one verse gives). Empty array if the book/chapter
 * isn't found - never throws, same "content gap, not a crash" contract as
 * getVerseText. */
export function getChapterVerses(bookName: string, chapter: number): ChapterVerseEntry[] {
  const chapterMap = BUNDLED_KJV[bookName];
  if (!chapterMap) return [];
  const verseMap = chapterMap[String(chapter)];
  if (!verseMap) return [];
  return Object.keys(verseMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((verse) => ({ verse, text: String(verseMap[String(verse)] || '').trim() }));
}

/** Capitalized words that AREN'T just sentence-initial capitalization - a
 * cheap proxy for "this is probably a name or place" without a real NLP
 * dependency, so Name & Place Match and Anagram Unscramble can pick
 * game-worthy words from whatever arbitrary passage the partition hands
 * them (a curated names list would only ever cover famous passages). Not
 * perfect (KJV capitalizes a few other things mid-sentence, e.g. "Spirit"),
 * but a false positive here just means the game asks about a slightly
 * unusual word, not a broken round. */
export function extractCapitalizedWords(text: string): string[] {
  const tokens = tokenizeVerse(text);
  const found: string[] = [];
  tokens.forEach((token, i) => {
    const clean = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (clean.length < 3 || !/^[A-Z][a-z]+$/.test(clean)) return;
    const prevToken = tokens[i - 1];
    const isSentenceInitial = i === 0 || (prevToken ? /[.!?:;]$/.test(prevToken) : false);
    if (isSentenceInitial) return;
    found.push(clean);
  });
  return found;
}
