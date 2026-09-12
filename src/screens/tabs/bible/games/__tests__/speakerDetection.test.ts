import { detectSpeech } from '../speakerDetection';

describe('detectSpeech', () => {
  it('detects a simple named speaker', () => {
    const result = detectSpeech('And God said, Let there be light: and there was light.');
    expect(result).toEqual({ speaker: 'God', quote: 'Let there be light: and there was light.' });
  });

  it('detects "the LORD" and displays it with "the"', () => {
    const result = detectSpeech('And the LORD said unto Moses, Speak unto the children of Israel.');
    expect(result?.speaker).toBe('the LORD');
    expect(result?.quote).toBe('Speak unto the children of Israel.');
  });

  it('detects "answered and said" phrasing', () => {
    const result = detectSpeech('Jesus answered and said unto them, Verily, verily, I say unto you.');
    expect(result?.speaker).toBe('Jesus');
    expect(result?.quote).toBe('Verily, verily, I say unto you.');
  });

  it('detects a multi-word name', () => {
    const result = detectSpeech('Then Simon Peter said unto him, Lord, to whom shall we go?');
    expect(result?.speaker).toBe('Simon Peter');
  });

  it('returns null for pronoun-only attribution (no named subject)', () => {
    expect(detectSpeech('And he said unto them, Follow me.')).toBeNull();
  });

  it('returns null for verses with no speech attribution at all', () => {
    expect(detectSpeech('And Enos lived ninety years, and begat Cainan.')).toBeNull();
  });

  it('returns null when the captured word is a denylisted false subject', () => {
    expect(detectSpeech('The said unto him, nothing of value.')).toBeNull();
  });

  // Regression: found by cross-checking against the real bundled KJV text
  // (not just hand-picked examples) - a verse with NO named subject before
  // the verb at all (e.g. "And saith unto him, ...") was backtracking into
  // capturing the leading conjunction itself ("And") as the "speaker",
  // since "And" alone still satisfies the capture group's own shape.
  it('returns null rather than capturing a leading conjunction as the speaker (real KJV pattern: Matthew 4:6)', () => {
    expect(detectSpeech('And saith unto him, If thou be the Son of God, cast thyself down.')).toBeNull();
  });

  it('returns null rather than capturing "They" as a speaker (real KJV pattern: Psalms 18:41)', () => {
    expect(detectSpeech('They cried, but there was none to save them.')).toBeNull();
  });

  it('strips a leading sentence-initial connective from a multi-word capture (real KJV pattern: "Wherefore Nathan said")', () => {
    const result = detectSpeech('Wherefore Nathan said unto Bathsheba, Hast thou not heard that Adonijah reigneth?');
    expect(result?.speaker).toBe('Nathan');
  });

  // Regression: "...spake unto Moses, saying," and "...Jesus answered and
  // spake unto them again by parables, and said," are both extremely
  // common KJV sentence endings where the verse itself stops right there -
  // the real quoted speech starts in the NEXT verse. The pattern still
  // structurally matches (there IS a comma in the expected place), but what
  // it captures as the "quote" is just the attribution formula's own
  // dangling tail, not real speech.
  it('rejects a verse ending in "...saying," as having no usable quote (real KJV pattern: Leviticus 4:1)', () => {
    expect(detectSpeech('And the LORD spake unto Moses, saying,')).toBeNull();
  });

  it('rejects a verse ending in "...and said," as having no usable quote (real KJV pattern: Job 3:2)', () => {
    expect(detectSpeech('And Job spake, and said,')).toBeNull();
  });

  it('displays "the LORD God" (a real compound name), not just bare "LORD God"', () => {
    const result = detectSpeech('And the LORD God said unto the serpent, Because thou hast done this.');
    expect(result?.speaker).toBe('the LORD God');
  });
});
