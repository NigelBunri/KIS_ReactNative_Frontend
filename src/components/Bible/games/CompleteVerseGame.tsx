// src/components/Bible/games/CompleteVerseGame.tsx
//
// Game 1 of 6: "Complete the Verse" — fill-in-the-blank. A verse is shown
// with 1-2 key words blanked out; the player taps the correct word out of a
// small on-screen word bank (no typing required — keeps this fast and
// thumb-friendly, and sidesteps any KJV spelling/punctuation edge cases a
// free-text answer would have to fuzzy-match against).
//
// Light spaced-repetition layer: verses missed recently are weighted to
// reappear sooner within the round (see gameStorage.ts's missed-weights
// map) — not the full SM-2 scheduler Verse Vault uses (this is a quick
// arcade round, not a long-term review deck), just a "you got this wrong,
// let's circle back" nudge.

import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, RoundComplete } from './GameFeedback';
import { CURATED_VERSES, type CuratedVerseRef } from '../../../screens/tabs/bible/games/curatedVerses';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import { getMissedWeights, recordVerseOutcome, recordScore } from '../../../screens/tabs/bible/games/gameStorage';

const ROUND_LENGTH = 10;
const MIN_BLANK_WORD_LENGTH = 4; // skip blanking tiny connective words like "and"/"the"

type Round = {
  verse: CuratedVerseRef;
  tokens: string[];
  blankIndexes: number[];
  choices: string[]; // shuffled: correct word(s) + distractors
  correctWords: string[]; // normalized, in blank order
};

function pickBlankIndexes(tokens: string[]): number[] {
  const eligible = tokens
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => normalizeWord(word).length >= MIN_BLANK_WORD_LENGTH);
  if (!eligible.length) return [Math.floor(tokens.length / 2)];
  const blankCount = tokens.length > 14 ? 2 : 1;
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, blankCount).map((e) => e.index).sort((a, b) => a - b);
}

function buildDistractors(correctWords: string[], excludeVerseId: string, count: number): string[] {
  const pool = new Set<string>();
  const otherVerses = CURATED_VERSES.filter((v) => v.id !== excludeVerseId);
  const shuffledVerses = [...otherVerses].sort(() => Math.random() - 0.5);
  for (const v of shuffledVerses) {
    if (pool.size >= count) break;
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const words = tokenizeVerse(text).map(normalizeWord).filter((w) => w.length >= MIN_BLANK_WORD_LENGTH);
    for (const w of words) {
      if (!correctWords.includes(w) && !pool.has(w)) {
        pool.add(w);
        break; // at most one distractor per source verse, for variety
      }
    }
  }
  return Array.from(pool).slice(0, count);
}

function buildRound(weights: Record<string, number>, excludeIds: Set<string>): Round {
  // Weighted-random pick: verses with a higher miss-weight appear more often
  // in the eligible pool (simple repetition trick, not a full weighted RNG).
  const pool: CuratedVerseRef[] = [];
  for (const v of CURATED_VERSES) {
    if (excludeIds.has(v.id)) continue;
    const weight = 1 + (weights[v.id] ?? 0);
    for (let i = 0; i < weight; i++) pool.push(v);
  }
  const source = pool.length ? pool : CURATED_VERSES;
  const verse = source[Math.floor(Math.random() * source.length)];

  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  const blankIndexes = pickBlankIndexes(tokens);
  const correctWords = blankIndexes.map((i) => normalizeWord(tokens[i]));
  const distractors = buildDistractors(correctWords, verse.id, Math.max(3, 5 - correctWords.length));
  const choices = [...correctWords, ...distractors].sort(() => Math.random() - 0.5);

  return { verse, tokens, blankIndexes, choices, correctWords };
}

export default function CompleteVerseGame({ onExit }: { onExit: () => void }) {
  const { palette } = useKISTheme();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [weightsLoaded, setWeightsLoaded] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [filled, setFilled] = useState<(string | null)[]>([]);
  const [usedChoices, setUsedChoices] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getMissedWeights().then((w) => {
      setWeights(w);
      setWeightsLoaded(true);
    });
  }, []);

  const startRound = useCallback((exclude: Set<string>, w: Record<string, number>) => {
    const next = buildRound(w, exclude);
    setRound(next);
    setFilled(new Array(next.blankIndexes.length).fill(null));
    setUsedChoices(new Set());
    setSubmitted(false);
  }, []);

  useEffect(() => {
    if (weightsLoaded && !round) startRound(seenIds, weights);
  }, [weightsLoaded, round, seenIds, weights, startRound]);

  const nextBlankSlot = filled.findIndex((f) => f === null);

  const handleChoicePress = (choice: string, choiceIndex: number) => {
    if (submitted || nextBlankSlot === -1 || usedChoices.has(choiceIndex)) return;
    const nextFilled = [...filled];
    nextFilled[nextBlankSlot] = choice;
    setFilled(nextFilled);
    setUsedChoices((prev) => new Set(prev).add(choiceIndex));
  };

  const handleClearSlot = (slotIndex: number) => {
    if (submitted) return;
    const choiceValue = filled[slotIndex];
    if (choiceValue === null) return;
    const nextFilled = [...filled];
    nextFilled[slotIndex] = null;
    setFilled(nextFilled);
    // Free the used-choice so it can be picked again (find its first used occurrence of this value).
    if (round) {
      const idx = round.choices.findIndex((c, i) => c === choiceValue && usedChoices.has(i));
      if (idx !== -1) {
        setUsedChoices((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    }
  };

  const allFilled = filled.every((f) => f !== null);
  const isCorrect = round ? filled.every((f, i) => f === round.correctWords[i]) : false;

  const handleSubmit = async () => {
    if (!round || !allFilled) return;
    setSubmitted(true);
    const correct = filled.every((f, i) => f === round.correctWords[i]);
    if (correct) setScore((s) => s + 1);
    const updated = await recordVerseOutcome(round.verse.id, correct);
    setWeights(updated);
  };

  const handleNext = () => {
    if (!round) return;
    const nextSeen = new Set(seenIds).add(round.verse.id);
    setSeenIds(nextSeen);
    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUND_LENGTH) {
      setRoundIndex(nextIndex);
      setFinished(true);
      recordScore('complete-verse', score); // score already reflects this round's point, set by handleSubmit
      return;
    }
    setRoundIndex(nextIndex);
    startRound(nextSeen, weights);
  };

  const handlePlayAgain = () => {
    setRoundIndex(0);
    setSeenIds(new Set());
    setScore(0);
    setFinished(false);
    setRound(null);
  };

  if (finished) {
    return (
      <GameShell title="Complete the Verse" onBack={onExit}>
        <View style={styles.centerFill}>
          <RoundComplete
            title={score === ROUND_LENGTH ? 'Perfect round!' : 'Round complete'}
            scoreLine={`${score} / ${ROUND_LENGTH} correct`}
            onPlayAgain={handlePlayAgain}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  if (!round) {
    return (
      <GameShell title="Complete the Verse" onBack={onExit}>
        <View style={styles.centerFill} />
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Complete the Verse"
      subtitle={`Verse ${roundIndex + 1} of ${ROUND_LENGTH}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.reference, { color: palette.goldReadable }]}>{round.verse.reference}</Text>
          <View style={styles.verseTextWrap}>
            {round.tokens.map((word, index) => {
              const blankSlot = round.blankIndexes.indexOf(index);
              if (blankSlot === -1) {
                return (
                  <Text key={index} style={[styles.word, { color: palette.text }]}>
                    {word}{' '}
                  </Text>
                );
              }
              const filledValue = filled[blankSlot];
              const slotCorrect = submitted && filledValue === round.correctWords[blankSlot];
              const slotWrong = submitted && filledValue !== round.correctWords[blankSlot];
              return (
                <Pressable
                  key={index}
                  onPress={() => handleClearSlot(blankSlot)}
                  disabled={submitted}
                  style={[
                    styles.blank,
                    {
                      backgroundColor: slotCorrect
                        ? '#16a34a25'
                        : slotWrong
                          ? '#dc262625'
                          : palette.selectedBg,
                      borderColor: slotCorrect ? '#16a34a' : slotWrong ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.blankText,
                      { color: filledValue ? palette.text : palette.subtext },
                    ]}
                  >
                    {filledValue ?? '_____'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {submitted ? (
          <AnswerFeedback
            correct={isCorrect}
            text={isCorrect ? 'Correct!' : `Correct answer: ${round.correctWords.join(', ')}`}
          />
        ) : null}

        <View style={styles.wordBank}>
          {round.choices.map((choice, index) => {
            const used = usedChoices.has(index);
            return (
              <Pressable
                key={`${choice}-${index}`}
                onPress={() => handleChoicePress(choice, index)}
                disabled={used || submitted || nextBlankSlot === -1}
                style={[
                  styles.chip,
                  {
                    backgroundColor: used ? palette.bg : palette.selectedBg,
                    borderColor: palette.goldReadable,
                    opacity: used ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: palette.text }]}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUND_LENGTH ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!allFilled}
            style={[
              styles.actionBtn,
              { backgroundColor: allFilled ? palette.goldReadable : palette.selectedBg },
            ]}
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
  blank: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginVertical: 2,
    marginHorizontal: 2,
  },
  blankText: { fontSize: 16, fontWeight: '800' },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 15, fontWeight: '800' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
