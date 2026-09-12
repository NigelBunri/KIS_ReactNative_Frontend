// src/screens/tabs/bible/games/speakerDetection.ts
//
// Heuristic "who is speaking in this verse" extraction for Who Said It.
// ScriptureTriviaGame.tsx's own history is the reason this exists as a
// derivation rather than a curated lookup: its original "who said this"
// question type only ever worked for the old hand-curated 68-verse pool
// (curatedVerses.ts's `speaker` field) and had to be dropped once verse
// content became partition-assigned, because that curated data simply
// doesn't exist for an arbitrary verse a reshuffle might hand out. This
// derives a speaker straight from the KJV text itself instead, so it works
// on any stage of any of the 30 games' partitions - the same "works on
// genealogies and legal lists too" bar every partition-driven game holds
// itself to.
//
// KJV attribution is formulaic enough to catch most of it with one pattern:
// an optional leading conjunction, a capitalized subject (a name, or "the
// LORD"), a speech verb ("said"/"saith"/"spake"/"answered"/"cried"),
// optionally "unto <someone>", then a comma introducing the quoted speech.
// This is a heuristic, not an NLP parser - false negatives (a real
// attribution the regex misses) just mean that verse isn't used; there is
// no false-positive cost worth worrying about since a correct answer is
// always the exact name this same function extracted.

const SPEECH_VERB = 'said|saith|spake|answered|cried';

const SPEAKER_PATTERN = new RegExp(
  `^(?:And|Then|But|Now|So)?\\s*(?:the\\s+)?([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+){0,2})\\s+` +
    `(?:answered\\s+and\\s+)?(?:${SPEECH_VERB})\\b(?:\\s+unto\\s+[^,]+)?\\s*,\\s*(.+)$`,
);

// Captured subjects that are grammatically capitalized but never a valid
// speaker on their own - filtered out rather than tuning the regex further,
// since a short denylist is far easier to reason about than a more
// "clever" pattern. Two distinct failure modes land here:
//   - sentence-initial capitalized words that aren't names at all (The,
//     Behold, ...).
//   - pronouns/conjunctions the pattern's own OPTIONAL leading-conjunction
//     group can end up NOT consuming, on a verse with no named subject at
//     all before the verb (e.g. "And saith unto him, ..." with no name -
//     the leading `(?:And|...)?` group fails to find a valid capitalized
//     word after it, so the regex engine backtracks and lets the main
//     capture group grab "And" itself instead, since "And" alone still
//     satisfies `[A-Z][A-Za-z]+`). Denylisting these words directly is far
//     simpler than trying to make the pattern backtrack-proof.
const NOT_A_SPEAKER = new Set([
  'The', 'This', 'That', 'These', 'Those', 'There', 'Behold',
  'And', 'But', 'Then', 'Now', 'So', 'He', 'She', 'It', 'They', 'We', 'You', 'I',
  'Which', 'Who', 'Whom', 'Some', 'Others', 'Other', 'Any', 'All', 'Each', 'For',
]);

// A verse ending in "...spake unto Moses, saying," or "...Jesus answered
// and spake unto them again by parables, and said," (both extremely common
// - Law/History books do the first, Gospels the second) matches the pattern
// structurally - there IS a comma right where the pattern expects one - but
// the verse just ends there, with the actual quoted speech starting in the
// NEXT verse. What's "captured" as the quote in these cases is nothing but
// the attribution formula's own dangling tail, not real speech - reject any
// quote that IS (only) one of these tails, and reject anything implausibly
// short as a backstop for variants this exact list doesn't name.
const MIN_QUOTE_LENGTH = 8;
const ATTRIBUTION_TAIL_ONLY = /^(and\s+)?(saying|said)[:,.]?$/i;

export type DetectedSpeech = {
  speaker: string; // display label, e.g. "Jesus", "the LORD", "Moses"
  quote: string; // the speech itself, trimmed
};

/** Attempts to extract "who said this" from one verse's own text. Returns
 * null when the verse doesn't match a recognizable attribution pattern, or
 * matches one but the "speaker" or "quote" it found isn't actually usable
 * (see NOT_A_SPEAKER / ATTRIBUTION_TAIL_ONLY above) - the caller (Who Said
 * It) simply skips verses where this returns null, same graceful-
 * degradation approach WordWeaveGame.tsx already uses for "not every verse
 * in an arbitrary stage fits this game's shape." */
export function detectSpeech(text: string): DetectedSpeech | null {
  const match = SPEAKER_PATTERN.exec(text.trim());
  if (!match) return null;
  // A sentence-initial connective ("The Lord said" when this verse opens
  // the sentence; "Wherefore Nathan said"/"For David said"/"Moreover
  // Jeremiah said" when it opens with one of these less-common ones) can
  // ride along as the FIRST of the capture's up-to-3 words - strip one such
  // leading word before evaluating the rest, rather than denylisting every
  // multi-word combination that happens to start with one of them.
  const rawSpeaker = match[1]
    .trim()
    .replace(/^(The|And|But|Then|Now|So|For|Also|Moreover|Therefore|Whereas|Wherefore|Again|Behold)\s+/, '');
  const quote = match[2].trim();
  if (!rawSpeaker || !quote) return null;
  if (NOT_A_SPEAKER.has(rawSpeaker)) return null;
  if (quote.length < MIN_QUOTE_LENGTH || ATTRIBUTION_TAIL_ONLY.test(quote)) return null;

  // "the LORD"/"the LORD God" is how Scripture actually refers to this
  // speaker - captured without "the" (consumed separately by the pattern)
  // so it reads oddly standing alone; every other captured name is
  // displayed as-is.
  const speaker = /^(LORD|Lord)(\s|$)/.test(rawSpeaker) ? `the ${rawSpeaker}` : rawSpeaker;
  return { speaker, quote };
}
