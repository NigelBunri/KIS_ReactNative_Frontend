import { extractCapitalizedWords, getChapterVerses, getVerseText, normalizeWord, tokenizeVerse } from '../verseText';
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

  describe('getChapterVerses', () => {
    it('returns every verse of a real chapter, in order', () => {
      const verses = getChapterVerses('John', 3);
      expect(verses.length).toBeGreaterThan(30); // John 3 has 36 verses
      expect(verses.map((v) => v.verse)).toEqual([...verses].map((v) => v.verse).sort((a, b) => a - b));
      const v16 = verses.find((v) => v.verse === 16);
      expect(v16?.text).toContain('For God so loved the world');
    });

    it('returns an empty array for an unknown book or chapter, never throws', () => {
      expect(getChapterVerses('Not A Real Book', 1)).toEqual([]);
      expect(getChapterVerses('John', 999)).toEqual([]);
    });
  });

  describe('extractCapitalizedWords', () => {
    it('finds a mid-sentence proper noun but not the sentence-initial word', () => {
      const found = extractCapitalizedWords('And the LORD said unto Moses, Speak unto Pharaoh.');
      expect(found).toContain('Moses');
      expect(found).toContain('Pharaoh');
      expect(found).not.toContain('And');
    });

    it('excludes short words and all-caps words like LORD', () => {
      const found = extractCapitalizedWords('And the LORD said unto Moses.');
      expect(found).not.toContain('LORD');
    });

    it('returns an empty array for text with no qualifying capitalized words', () => {
      expect(extractCapitalizedWords('and he begat sons and daughters')).toEqual([]);
    });
  });
});
