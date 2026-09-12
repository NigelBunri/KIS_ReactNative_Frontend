// src/components/Bible/games/PunctuationRestoreGame.tsx
//
// "Punctuation Restore" — a verse's punctuation (, . ; : ! ?) is stripped
// out, its original position (which word it followed) remembered, and the
// player restores it by tapping a blank marker, then tapping a punctuation
// tile from a bank to fill it — tapping a filled blank again clears it,
// mirroring CompleteVerseGame.tsx's blank-filling interaction.
//
// Only verses that actually contain at least one of those marks are
// eligible (a verse with none has nothing to restore). If a whole stage
// happens to have none at all, the round is simply shorter (down to zero
// rounds, immediately finishing the stage) rather than showing a broken
// empty state — same graceful-degradation philosophy WordWeaveGame.tsx
// documents for its own eligibility window.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
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
const PUNCT_RE = /[,.;:!?]/g;

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type MarkTile = { id: string; mark: string };

type Round = {
  verse: VerseRef;
  // Flat, in-reading-order list of words with an optional trailing blank
  // (one entry per mark stripped) — a word can carry more than one blank if
  // it originally had two marks attached (rare, but possible).
  words: { text: string; blankCount: number }[];
  marks: string[]; // original mark for each blank, in the same flat order the blanks render
  bank: MarkTile[];
};

function stripPunctuation(text: string): { words: { text: string; blankCount: number }[]; marks: string[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const words: { text: string; blankCount: number }[] = [];
  const marks: string[] = [];
  for (const token of tokens) {
    const found = token.match(PUNCT_RE);
    const clean = token.replace(PUNCT_RE, '');
    words.push({ text: clean, blankCount: found ? found.length : 0 });
    if (found) marks.push(...found);
  }
  return { words, marks };
}

function buildRound(verse: VerseRef): Round | null {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const { words, marks } = stripPunctuation(text);
  if (!marks.length) return null;
  const bank = shuffle(marks.map((m, i) => ({ id: `m${i}`, mark: m })));
  return { verse, words, marks, bank };
}

/** Up to ROUND_LENGTH verses that actually contain punctuation to restore -
 * a verse with none is simply not eligible content for this game. */
function buildQueue(stageVerses: VerseRef[]): VerseRef[] {
  const eligible = stageVerses.filter((v) => {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    return PUNCT_RE.test(text);
  });
  return shuffle(eligible).slice(0, Math.min(ROUND_LENGTH, eligible.length));
}

export default function PunctuationRestoreGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [queue, setQueue] = useState<VerseRef[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [filled, setFilled] = useState<(MarkTile | null)[]>([]);
  const [bank, setBank] = useState<MarkTile[]>([]);
  const [selectedBlank, setSelectedBlank] = useState<number | null>(null);
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
    setFilled(new Array(next.marks.length).fill(null));
    setBank(next.bank);
    setSelectedBlank(null);
    setSubmitted(false);
  }, [queue, queueIndex, round]);

  const totalRounds = queue?.length ?? 0;
  const allFilled = filled.every((f) => f !== null);
  const isCorrect = useMemo(
    () => round !== null && allFilled && filled.every((f, i) => f && f.mark === round.marks[i]),
    [round, allFilled, filled],
  );

  const handleBlankPress = (index: number) => {
    if (submitted) return;
    const existing = filled[index];
    if (existing) {
      setFilled((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
      setBank((prev) => [...prev, existing]);
      setSelectedBlank(null);
      return;
    }
    setSelectedBlank(index);
  };

  const handleTilePress = (tile: MarkTile) => {
    if (submitted || selectedBlank === null) return;
    setFilled((prev) => {
      const next = [...prev];
      next[selectedBlank] = tile;
      return next;
    });
    setBank((prev) => prev.filter((t) => t.id !== tile.id));
    setSelectedBlank(null);
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

  // Flatten words+blanks into a single ordered render list of {kind:'word'|'blank', ...}
  let blankCursor = 0;
  const renderItems: { key: string; kind: 'word' | 'blank'; text?: string; blankIndex?: number }[] = [];
  round.words.forEach((w, wi) => {
    renderItems.push({ key: `w${wi}`, kind: 'word', text: w.text });
    for (let b = 0; b < w.blankCount; b++) {
      renderItems.push({ key: `b${wi}-${b}`, kind: 'blank', blankIndex: blankCursor });
      blankCursor++;
    }
  });

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
            {renderItems.map((item) => {
              if (item.kind === 'word') {
                return (
                  <Text key={item.key} style={[styles.word, { color: palette.text }]}>
                    {item.text}{' '}
                  </Text>
                );
              }
              const index = item.blankIndex ?? 0;
              const tile = filled[index];
              const isSelected = selectedBlank === index;
              const correctHere = submitted && tile && tile.mark === round.marks[index];
              const wrongHere = submitted && tile && tile.mark !== round.marks[index];
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleBlankPress(index)}
                  disabled={submitted}
                  style={[
                    styles.blank,
                    {
                      backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : isSelected ? palette.goldReadable : palette.selectedBg,
                      borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.blankText, { color: tile ? (isSelected ? palette.onGold : palette.text) : palette.subtext }]}>
                    {tile ? tile.mark : '_'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {submitted && !isCorrect ? (
          <AnswerHintRow marks={round.marks} palette={palette} />
        ) : null}

        <View style={styles.bankRow}>
          {bank.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => handleTilePress(tile)}
              disabled={submitted || selectedBlank === null}
              style={[
                styles.chip,
                {
                  backgroundColor: palette.selectedBg,
                  borderColor: palette.goldReadable,
                  opacity: selectedBlank === null && !submitted ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{tile.mark}</Text>
            </Pressable>
          ))}
        </View>
        {!submitted ? (
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>
            Tap a blank, then tap a mark to fill it.
          </Text>
        ) : null}
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

function AnswerHintRow({ marks, palette }: { marks: string[]; palette: ReturnType<typeof useKISTheme>['palette'] }) {
  return (
    <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
      <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct marks, in order</Text>
      <Text style={[styles.correctAnswerText, { color: palette.text }]}>{marks.join(' ')}</Text>
    </View>
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 2,
    marginHorizontal: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  blankText: { fontSize: 16, fontWeight: '800' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  bankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minWidth: 44, alignItems: 'center' },
  chipText: { fontSize: 16, fontWeight: '900' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
