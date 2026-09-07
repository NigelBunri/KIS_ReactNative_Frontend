import { getVerseText, normalizeWord, tokenizeVerse } from '../verseText';
import { CURATED_VERSES } from '../curatedVerses';

describe('verseText', () => {
  it('resolves every curated verse reference to non-empty real text', () => {
    for (const v of CURATED_VERSES) {
      const text = getVerseText(v.bookName, v.chapter, v.verse);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('returns a well-known verse correctly (John 3:16)', () => {
    const text = getVerseText('John', 3, 16);
    expect(text).toContain('For God so loved the world');
  });

  it('returns empty string for an unknown book/chapter/verse, never throws', () => {
    expect(getVerseText('Not A Real Book', 1, 1)).toBe('');
    expect(getVerseText('John', 999, 1)).toBe('');
    expect(getVerseText('John', 3, 999)).toBe('');
  });

  it('normalizeWord strips punctuation and lowercases', () => {
    expect(normalizeWord('God,')).toBe('god');
    expect(normalizeWord('"beginning"')).toBe('beginning');
    expect(normalizeWord("God's")).toBe("god's");
  });

  it('tokenizeVerse splits on whitespace and drops empty tokens', () => {
    expect(tokenizeVerse('In the  beginning God created')).toEqual([
      'In', 'the', 'beginning', 'God', 'created',
    ]);
  });

  it('every curated verse reference is unique (no accidental id collisions)', () => {
    const ids = CURATED_VERSES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
