// src/components/Bible/games/LetterFillGame.tsx
//
// "Letter Fill" — 1-2 words (5+ letters) per verse have roughly 40% of
// their INTERIOR letters blanked out (never the first or last letter, so
// the word stays readable at a glance) and replaced with underscores
// inline in the verse. The player taps letter tiles from a bank — the
// correct missing letters plus a few distractors — into the blanks in
// order to restore the word(s). Tap-to-place / tap-to-remove, same
// "next open slot" interaction CompleteVerseGame.tsx uses for its own
// word blanks.
//
// Eligibility falls back gracefully: a verse needs at least one word of
// length >= 5 to be picked normally; if a whole stage somehow has none
// (never happens with real KJV text, but defended against per the
// "never crash on any random slice" requirement), the round is simply
// shorter, down to zero, rather than a broken empty state.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const ROUND_LENGTH = 8;
const TARGET_WORD_MIN_LEN = 5;
const FALLBACK_WORD_MIN_LEN = 3; // only used if a stage has literally no word >= 5 letters
const BLANK_RATIO = 0.4;
const DISTRACTOR_COUNT = 4;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function coreWord(token: string): string {
  return token.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type LetterTile = { id: string; letter: string };

type BlankRef = { tokenIndex: number; letterIndex: number; correctLetter: string };

type Round = {
  verse: VerseRef;
  tokens: string[]; // raw display tokens, in order
  targetTokenIndexes: Set<number>;
  blanks: BlankRef[]; // flat, in verse-reading order
  bank: LetterTile[];
};

/** Which interior letter positions (never index 0 or length-1) of one word
 * get blanked - roughly BLANK_RATIO of the interior, at least 1. */
function pickBlankPositions(wordLength: number): number[] {
  if (wordLength < 3) return [];
  const interior = Array.from({ length: wordLength - 2 }, (_, i) => i + 1);
  const count = Math.max(1, Math.round(interior.length * BLANK_RATIO));
  return shuffle(interior).slice(0, count).sort((a, b) => a - b);
}

function pickTargetTokenIndexes(tokens: string[], minLen: number): number[] {
  const eligible = tokens
    .map((t, i) => ({ i, len: coreWord(t).length }))
    .filter((x) => x.len >= minLen);
  if (!eligible.length) return [];
  const count = Math.min(2, eligible.length);
  return shuffle(eligible).slice(0, count).map((e) => e.i).sort((a, b) => a - b);
}

function buildRound(verse: VerseRef): Round | null {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  let targetIdxs = pickTargetTokenIndexes(tokens, TARGET_WORD_MIN_LEN);
  if (!targetIdxs.length) targetIdxs = pickTargetTokenIndexes(tokens, FALLBACK_WORD_MIN_LEN);
  if (!targetIdxs.length) return null;

  const blanks: BlankRef[] = [];
  for (const tokenIndex of targetIdxs) {
    const word = coreWord(tokens[tokenIndex]);
    const positions = pickBlankPositions(word.length);
    for (const letterIndex of positions) {
      blanks.push({ tokenIndex, letterIndex, correctLetter: word[letterIndex].toLowerCase() });
    }
  }
  if (!blanks.length) return null;

  const correctLetterSet = new Set(blanks.map((b) => b.correctLetter));
  const distractors: string[] = [];
  while (distractors.length < DISTRACTOR_COUNT) {
    const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!correctLetterSet.has(letter) && !distractors.includes(letter)) distractors.push(letter);
  }

  const bank = shuffle([
    ...blanks.map((b, i) => ({ id: `c${i}`, letter: b.correctLetter })),
    ...distractors.map((d, i) => ({ id: `d${i}`, letter: d })),
  ]);

  return { verse, tokens, targetTokenIndexes: new Set(targetIdxs), blanks, bank };
}

function buildQueue(stageVerses: VerseRef[]): VerseRef[] {
  if (!stageVerses.length) return [];
  const eligible = stageVerses.filter((v) => {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    return tokenizeVerse(text).some((t) => coreWord(t).length >= TARGET_WORD_MIN_LEN);
  });
  const fallback = eligible.length
    ? eligible
    : stageVerses.filter((v) => {
        const text = getVerseText(v.bookName, v.chapter, v.verse);
        return tokenizeVerse(text).some((t) => coreWord(t).length >= FALLBACK_WORD_MIN_LEN);
      });
  return shuffle(fallback).slice(0, Math.min(ROUND_LENGTH, fallback.length));
}

export default function LetterFillGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [queue, setQueue] = useState<VerseRef[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [filled, setFilled] = useState<(LetterTile | null)[]>([]);
  const [bank, setBank] = useState<LetterTile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const q = buildQueue(verses);
      setQueue(q);
      if (!q.length) {
        finishStage(gameKey, stageIndex, 0).then((outcome) => {
          if (active) setStageResult(outcome);
        });
      }
    });
    return () => {
      active = false;
    };
  }, [gameKey, stageIndex]);

  useEffect(() => {
    if (!queue || !queue.length || round || queueIndex >= queue.length) return;
    const next = buildRound(queue[queueIndex]);
    if (!next) return;
    setRound(next);
    setFilled(new Array(next.blanks.length).fill(null));
    setBank(next.bank);
    setSubmitted(false);
  }, [queue, queueIndex, round]);

  const totalRounds = queue?.length ?? 0;
  const nextSlot = filled.findIndex((f) => f === null);
  const allFilled = filled.every((f) => f !== null);
  const isCorrect = useMemo(
    () => round !== null && allFilled && filled.every((f, i) => f && f.letter === round.blanks[i].correctLetter),
    [round, allFilled, filled],
  );

  const handleTilePress = (tile: LetterTile) => {
    if (submitted || nextSlot === -1) return;
    setFilled((prev) => {
      const next = [...prev];
      next[nextSlot] = tile;
      return next;
    });
    setBank((prev) => prev.filter((t) => t.id !== tile.id));
  };

  const handleBlankPress = (index: number) => {
    if (submitted) return;
    const tile = filled[index];
    if (!tile) return;
    setFilled((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setBank((prev) => [...prev, tile]);
  };

  const handleSubmit = () => {
    if (!round || !allFilled) return;
    setSubmitted(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex >= totalRounds) {
      const outcome = await finishStage(gameKey, stageIndex, score);
      setStageResult(outcome);
      return;
    }
    setQueueIndex(nextIndex);
    setRound(null);
  };

  const resetGame = () => {
    setStageResult(null);
    setQueueIndex(0);
    setScore(0);
    setRound(null);
    getStageVerses(gameKey, stageIndex).then((verses) => setQueue(buildQueue(verses)));
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${totalRounds} correct this stage`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={resetGame}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!round) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </GameShell>
    );
  }

  // Build a flat blank-index lookup: for a given token+letter position, which
  // entry in round.blanks (if any) it corresponds to.
  const blankLookup = new Map<string, number>();
  round.blanks.forEach((b, i) => blankLookup.set(`${b.tokenIndex}-${b.letterIndex}`, i));

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${queueIndex + 1} of ${totalRounds}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
          <View style={styles.verseTextWrap}>
            {round.tokens.map((token, tokenIndex) => {
              if (!round.targetTokenIndexes.has(tokenIndex)) {
                return (
                  <Text key={tokenIndex} style={[styles.word, { color: palette.text }]}>
                    {token}{' '}
                  </Text>
                );
              }
              const word = coreWord(token);
              const leading = token.slice(0, token.indexOf(word));
              const trailing = token.slice(token.indexOf(word) + word.length);
              return (
                <View key={tokenIndex} style={styles.letterWordWrap}>
                  {leading ? <Text style={[styles.word, { color: palette.text }]}>{leading}</Text> : null}
                  {word.split('').map((letter, letterIndex) => {
                    const blankIdx = blankLookup.get(`${tokenIndex}-${letterIndex}`);
                    if (blankIdx === undefined) {
                      return (
                        <Text key={letterIndex} style={[styles.word, { color: palette.text }]}>
                          {letter}
                        </Text>
                      );
                    }
                    const tile = filled[blankIdx];
                    const correctHere = submitted && tile && tile.letter === round.blanks[blankIdx].correctLetter;
                    const wrongHere = submitted && tile && tile.letter !== round.blanks[blankIdx].correctLetter;
                    return (
                      <Pressable
                        key={letterIndex}
                        onPress={() => handleBlankPress(blankIdx)}
                        disabled={submitted || !tile}
                        style={[
                          styles.letterBlank,
                          {
                            backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : palette.selectedBg,
                            borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                          },
                        ]}
                      >
                        <Text style={[styles.letterBlankText, { color: tile ? palette.text : palette.subtext }]}>
                          {tile ? tile.letter.toUpperCase() : '_'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {trailing ? <Text style={[styles.word, { color: palette.text }]}>{trailing}</Text> : null}
                  <Text style={[styles.word, { color: palette.text }]}> </Text>
                </View>
              );
            })}
          </View>
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct letters, in order</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>
              {round.blanks.map((b) => b.correctLetter.toUpperCase()).join(' ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.bankRow}>
          {bank.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => handleTilePress(tile)}
              disabled={submitted || nextSlot === -1}
              style={[
                styles.chip,
                { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable },
              ]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{tile.letter.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {queueIndex + 1 >= totalRounds ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!allFilled}
            style={[styles.actionBtn, { backgroundColor: allFilled ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: allFilled ? palette.onGold : palette.subtext }]}>
              Check Answer
            </Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10 },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  verseTextWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  word: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  letterWordWrap: { flexDirection: 'row', alignItems: 'center' },
  letterBlank: {
    borderWidth: 1.5,
    borderRadius: 6,
    minWidth: 20,
    paddingHorizontal: 3,
    marginHorizontal: 1,
    alignItems: 'center',
  },
  letterBlankText: { fontSize: 16, fontWeight: '800' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  bankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, minWidth: 46, alignItems: 'center' },
  chipText: { fontSize: 16, fontWeight: '900' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
