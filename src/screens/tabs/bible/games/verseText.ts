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
