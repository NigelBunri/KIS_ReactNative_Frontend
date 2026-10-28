// Pure, testable sentence splitter for KIS Books text-to-speech.
//
// Honest scope: this is a heuristic regex splitter, not a full NLP
// sentence boundary detector. It handles the common abbreviation cases
// that would otherwise wrongly break a sentence (Mr., Mrs., Dr., St.,
// e.g., i.e., vs., U.S., single-letter initials like "C. S. Lewis", and
// numbered/decimal values like "3.14" or "Genesis 1:1") well enough for
// prose Christian-book manuscripts, but will occasionally mis-split or
// under-split on unusual punctuation. That's an acceptable trade-off for
// TTS sentence-by-sentence playback and highlighting — a slightly wrong
// boundary just means one "sentence" spoken is briefly longer or shorter
// than ideal, never a crash or lost content.

export type Sentence = { text: string; start: number; end: number };

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'st', 'prof', 'rev', 'gen', 'sen', 'rep', 'sgt', 'col', 'capt', 'lt',
  'jr', 'sr', 'vs', 'etc', 'eg', 'ie', 'no', 'vol', 'fig', 'approx', 'dept', 'univ', 'assn', 'co',
  'inc', 'ltd', 'u.s', 'u.k', 'a.m', 'p.m',
]);

function endsWithAbbreviation(textBeforePeriod: string): boolean {
  const match = textBeforePeriod.match(/([A-Za-z]+)\.?$/);
  if (!match) return false;
  const word = match[1].toLowerCase();
  if (ABBREVIATIONS.has(word)) return true;
  // Single capital letter immediately before the period — "C. S. Lewis",
  // "John F. Kennedy" — a lone initial, not a sentence end.
  if (match[1].length === 1 && /[A-Z]/.test(match[1])) return true;
  return false;
}

/**
 * Splits plain text into sentences with stable [start, end) character
 * offsets into the ORIGINAL string (so a highlight/karaoke overlay can be
 * computed by substring, not by re-finding text). Whitespace-only input
 * returns an empty array, never a single empty "sentence".
 */
export function splitIntoSentences(text: string): Sentence[] {
  if (!text || !text.trim()) return [];

  const sentences: Sentence[] = [];
  let segmentStart = 0;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    const isTerminator = ch === '.' || ch === '!' || ch === '?';
    if (!isTerminator) continue;

    // Decimal numbers ("3.14") and verse references ("1:1.5") — a period
    // immediately surrounded by digits never ends a sentence.
    const prevChar = text[i - 1];
    const nextChar = text[i + 1];
    if (ch === '.' && /[0-9]/.test(prevChar || '') && /[0-9]/.test(nextChar || '')) continue;

    if (ch === '.' && endsWithAbbreviation(text.slice(segmentStart, i + 1))) continue;

    // Swallow a run of trailing terminators/quotes/brackets ("...!"" or "?!").
    let end = i + 1;
    while (end < len && /["'\])]/.test(text[end])) end += 1;
    while (end < len && /[.!?]/.test(text[end])) {
      end += 1;
      while (end < len && /["'\])]/.test(text[end])) end += 1;
    }

    const raw = text.slice(segmentStart, end);
    const trimmed = raw.trim();
    if (trimmed) {
      const leadingWs = raw.length - raw.trimStart().length;
      const trailingWs = raw.length - raw.trimEnd().length;
      sentences.push({ text: trimmed, start: segmentStart + leadingWs, end: end - trailingWs });
    }
    segmentStart = end;
    i = end - 1;
  }

  if (segmentStart < len) {
    const raw = text.slice(segmentStart);
    const trimmed = raw.trim();
    if (trimmed) {
      const leadingWs = raw.length - raw.trimStart().length;
      sentences.push({ text: trimmed, start: segmentStart + leadingWs, end: len - (raw.length - raw.trimEnd().length) });
    }
  }

  return sentences;
}

/**
 * The exact [start, end) character span a tap-based sentence selection
 * covers, given the block's full text and the anchor/focus sentence
 * indices (order-independent — tapping "backwards" to an earlier
 * sentence extends the selection the same as tapping forwards). Returns
 * null if either index is out of range for this text (e.g. the block's
 * text changed under an in-progress selection).
 */
export function selectionToOffsets(
  text: string,
  anchorIdx: number,
  focusIdx: number,
): { start: number; end: number } | null {
  const sentences = splitIntoSentences(text);
  const lo = Math.min(anchorIdx, focusIdx);
  const hi = Math.max(anchorIdx, focusIdx);
  if (!sentences[lo] || !sentences[hi]) return null;
  return { start: sentences[lo].start, end: sentences[hi].end };
}

/** Whether a sentence's own [start, end) span overlaps a saved
 * highlight's [start_offset, end_offset) span at all — the test a
 * highlight-tinted/comment-attached sentence render decides on. A
 * sentence fully inside, fully containing, or merely overlapping the
 * highlighted range all count (a highlight anchor's offsets don't
 * necessarily land on a sentence boundary — e.g. a legacy whole-block
 * highlight from before sentence-level selection existed). */
export function sentenceOverlapsSpan(sentence: Sentence, spanStart: number, spanEnd: number): boolean {
  return sentence.start < spanEnd && sentence.end > spanStart;
}
