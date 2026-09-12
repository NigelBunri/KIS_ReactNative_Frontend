// src/components/Bible/games/FirstLettersGame.tsx
//
// "First Letters" — a verse is shown as a row of hint-tags, one per word,
// revealing only that word's first letter and its remaining-letter count as
// underscores (e.g. "F___" for "Face", just "I" for "I"). The player taps
// words from a bank (the verse's own words, shuffled, plus a few distractor
// words pulled from other verses in the same stage) into the hint slots in
// order to reconstruct the whole verse.
//
// Tap-to-place / tap-to-remove, same interaction family as BooksInOrderGame
// and CompleteVerseGame — never drag-and-drop (see those files' docblocks
// for why: a PanResponder drag list fights the surrounding ScrollView for
// the same touch).
//
// Eligible verses are 5-20 words (same bound WordWeaveGame uses) so a round
// is a real but bounded challenge. A stage narrow enough to have none in
// that range (e.g. deep in a genealogy) falls back to using whatever verses
// the stage has, any length, rather than showing a broken empty state — see
// buildQueue below.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
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
const MIN_WORDS = 5;
const MAX_WORDS = 20;
const MIN_DISTRACTOR_LEN = 4;

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

/** Strips leading/trailing punctuation but keeps original casing (unlike
 * verseText.ts's normalizeWord, which lowercases) so the hint tag's first
 * letter and the word bank's chips display naturally ("Face", not "face"). */
function coreWord(token: string): string {
  return token.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

function hintFor(word: string): string {
  if (word.length <= 1) return word;
  return word[0] + '_'.repeat(word.length - 1);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type BankItem = { id: string; text: string };

type Round = {
  verse: VerseRef;
  correctWords: string[];
  hints: string[];
  bank: BankItem[];
};

function buildDistractors(
  stageVerses: VerseRef[],
  excludeId: string,
  correctNormalized: Set<string>,
  count: number,
): string[] {
  const pool: string[] = [];
  const others = shuffle(stageVerses.filter((v) => verseId(v) !== excludeId));
  for (const v of others) {
    if (pool.length >= count) break;
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const words = tokenizeVerse(text).map(coreWord).filter((w) => w.length >= MIN_DISTRACTOR_LEN);
    for (const w of words) {
      const norm = normalizeWord(w);
      if (!correctNormalized.has(norm) && !pool.some((p) => normalizeWord(p) === norm)) {
        pool.push(w);
        break; // at most one distractor per source verse, for variety
      }
    }
  }
  return pool;
}

function buildRound(verse: VerseRef, stageVerses: VerseRef[]): Round | null {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  const correctWords = tokens.map(coreWord).filter((w) => w.length > 0);
  if (!correctWords.length) return null;

  const hints = correctWords.map(hintFor);
  const correctNormalized = new Set(correctWords.map(normalizeWord));
  const distractorCount = Math.min(4, Math.max(2, Math.round(correctWords.length / 2)));
  const distractors = buildDistractors(stageVerses, verseId(verse), correctNormalized, distractorCount);

  const bank = shuffle([
    ...correctWords.map((w, i) => ({ id: `c${i}`, text: w })),
    ...distractors.map((w, i) => ({ id: `d${i}`, text: w })),
  ]);

  return { verse, correctWords, hints, bank };
}

/** Up to ROUND_LENGTH verses to play, preferring the 5-20 word eligibility
 * window but falling back to any-length verses from the stage if the stage
 * doesn't have enough (or any) verses in that window — never an empty
 * round. */
function buildQueue(stageVerses: VerseRef[]): VerseRef[] {
  if (!stageVerses.length) return [];
  const inWindow = stageVerses.filter((v) => {
    const wc = tokenizeVerse(getVerseText(v.bookName, v.chapter, v.verse)).length;
    return wc >= MIN_WORDS && wc <= MAX_WORDS;
  });
  const source = inWindow.length ? inWindow : stageVerses;
  return shuffle(source).slice(0, Math.min(ROUND_LENGTH, source.length));
}

export default function FirstLettersGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [queue, setQueue] = useState<VerseRef[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [placed, setPlaced] = useState<(BankItem | null)[]>([]);
  const [tray, setTray] = useState<BankItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setStageVerses(verses);
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
    if (!stageVerses || !queue.length || round || queueIndex >= queue.length) return;
    const next = buildRound(queue[queueIndex], stageVerses);
    if (!next) return;
    setRound(next);
    setPlaced(new Array(next.correctWords.length).fill(null));
    setTray(next.bank);
    setSubmitted(false);
  }, [stageVerses, queue, queueIndex, round]);

  const totalRounds = queue.length;
  const nextSlot = placed.findIndex((p) => p === null);

  const handleTrayTap = (item: BankItem) => {
    if (submitted || nextSlot === -1) return;
    setPlaced((prev) => {
      const next = [...prev];
      next[nextSlot] = item;
      return next;
    });
    setTray((prev) => prev.filter((t) => t.id !== item.id));
  };

  const handlePlacedTap = (index: number) => {
    if (submitted) return;
    const item = placed[index];
    if (!item) return;
    setPlaced((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setTray((prev) => [...prev, item]);
  };

  const allFilled = placed.every((p) => p !== null);
  const isCorrect = useMemo(
    () => round !== null && allFilled && placed.every((p, i) => p && normalizeWord(p.text) === normalizeWord(round.correctWords[i])),
    [round, allFilled, placed],
  );

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
    getStageVerses(gameKey, stageIndex).then((verses) => {
      setStageVerses(verses);
      setQueue(buildQueue(verses));
    });
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${totalRounds || 0} correct this stage`}
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
          <View style={styles.hintWrap}>
            {round.hints.map((hint, index) => {
              const item = placed[index];
              const correctHere = submitted && item && normalizeWord(item.text) === normalizeWord(round.correctWords[index]);
              const wrongHere = submitted && item && normalizeWord(item.text) !== normalizeWord(round.correctWords[index]);
              return (
                <Pressable
                  key={index}
                  onPress={() => handlePlacedTap(index)}
                  disabled={submitted || !item}
                  style={[
                    styles.slot,
                    {
                      backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : palette.selectedBg,
                      borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.slotText, { color: item ? palette.text : palette.subtext }]}>
                    {item ? item.text : hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct verse</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>{round.correctWords.join(' ')}</Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleTrayTap(item)}
              disabled={submitted}
              style={[styles.chip, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{item.text}</Text>
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
  hintWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  slotText: { fontSize: 15, fontWeight: '800' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 14, fontWeight: '800' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
