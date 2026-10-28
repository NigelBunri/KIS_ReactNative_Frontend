import { selectionToOffsets, sentenceOverlapsSpan, splitIntoSentences } from '../sentenceSplit';

describe('splitIntoSentences', () => {
  it('returns an empty array for empty or whitespace-only text', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   \n\t ')).toEqual([]);
  });

  it('splits a simple multi-sentence paragraph', () => {
    const result = splitIntoSentences('In the beginning God created the heavens. He saw that it was good.');
    expect(result.map((s) => s.text)).toEqual([
      'In the beginning God created the heavens.',
      'He saw that it was good.',
    ]);
  });

  it('handles single-sentence input with no terminal punctuation', () => {
    const result = splitIntoSentences('This is a heading with no period');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('This is a heading with no period');
  });

  it('handles exclamation and question marks', () => {
    const result = splitIntoSentences('Is this true? Yes, it is! Believe it.');
    expect(result.map((s) => s.text)).toEqual(['Is this true?', 'Yes, it is!', 'Believe it.']);
  });

  it('does not split on common abbreviations', () => {
    const result = splitIntoSentences('Dr. Smith met Mrs. Jones at St. Andrews. They spoke for an hour.');
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Dr. Smith met Mrs. Jones at St. Andrews.');
    expect(result[1].text).toBe('They spoke for an hour.');
  });

  it('does not split on single-letter initials', () => {
    const result = splitIntoSentences('C. S. Lewis wrote many books. He was a theologian.');
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('C. S. Lewis wrote many books.');
  });

  it('does not split on decimal numbers or verse references', () => {
    const result = splitIntoSentences('Pi is approximately 3.14 in value. See Genesis 1:1 for the reference.');
    expect(result).toHaveLength(2);
    expect(result[0].text).toContain('3.14');
  });

  it('swallows trailing quotes after terminal punctuation', () => {
    const result = splitIntoSentences('He said, "It is finished." Then he rested.');
    expect(result.map((s) => s.text)).toEqual(['He said, "It is finished."', 'Then he rested.']);
  });

  it('collapses runs of terminal punctuation into one boundary', () => {
    const result = splitIntoSentences('Really?! That cannot be true. Or can it?');
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('Really?!');
  });

  it('returns correct start/end offsets into the original string', () => {
    const text = 'First sentence. Second sentence.';
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(2);
    for (const sentence of result) {
      expect(text.slice(sentence.start, sentence.end)).toBe(sentence.text);
    }
  });

  it('handles a long real paragraph without losing any sentence', () => {
    const text =
      'Grace is a gift. It cannot be earned by works, no matter how sincere the effort. ' +
      'Dr. Jonathan Edwards wrote extensively on this subject in the 18th century. ' +
      'His sermon, delivered on July 8, 1741, remains widely studied today. ' +
      'What does this mean for us? It means we are free.';
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(6);
    expect(result[result.length - 1].text).toBe('It means we are free.');
  });
});

describe('selectionToOffsets', () => {
  const text = 'First sentence here. Second sentence here. Third sentence here.';

  it('returns the exact span of a single tapped sentence', () => {
    const span = selectionToOffsets(text, 0, 0);
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe('First sentence here.');
  });

  it('returns the exact span of a consecutive multi-sentence selection', () => {
    const span = selectionToOffsets(text, 0, 1);
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe('First sentence here. Second sentence here.');
  });

  it('is order-independent — tapping backwards extends the same as forwards', () => {
    const forward = selectionToOffsets(text, 0, 2);
    const backward = selectionToOffsets(text, 2, 0);
    expect(forward).toEqual(backward);
  });

  it('returns null for an out-of-range sentence index', () => {
    expect(selectionToOffsets(text, 0, 99)).toBeNull();
  });
});

describe('sentenceOverlapsSpan', () => {
  const text = 'First sentence here. Second sentence here.';
  const sentences = splitIntoSentences(text);

  it('matches a sentence fully inside a highlighted span', () => {
    expect(sentenceOverlapsSpan(sentences[0], 0, text.length)).toBe(true);
  });

  it('matches a sentence exactly equal to the highlighted span', () => {
    const s = sentences[0];
    expect(sentenceOverlapsSpan(s, s.start, s.end)).toBe(true);
  });

  it('does not match a sentence with no overlap at all', () => {
    expect(sentenceOverlapsSpan(sentences[1], sentences[0].start, sentences[0].end)).toBe(false);
  });

  it('matches a partial overlap at a span boundary', () => {
    const s = sentences[1];
    expect(sentenceOverlapsSpan(s, s.start - 3, s.start + 3)).toBe(true);
  });
});
