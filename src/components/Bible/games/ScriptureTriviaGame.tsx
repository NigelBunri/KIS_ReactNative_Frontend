// src/components/Bible/games/ScriptureTriviaGame.tsx
//
// Game 4 of 6 (now 4 of 30): "Scripture Trivia" — multiple choice about
// recognition/attribution rather than verbatim recall, the thing that made
// this distinct from Complete the Verse/Word Weave. Two question types,
// both universally derivable from ANY verse the partition engine assigns
// (which book, which chapter) rather than the original curated-pool
// version's "who said this" (that relied on hand-curated speaker
// attribution that only ever existed for the original 68-verse pool, not
// something derivable for an arbitrary stage of the whole Bible).

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
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

const ROUND_LENGTH = 10;

type Question = {
  id: string;
  verseText: string;
  prompt: string;
  choices: string[];
  correctAnswer: string;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function distractorsFrom(pool: string[], correct: string, count: number): string[] {
  const unique = Array.from(new Set(pool.filter((v) => v !== correct)));
  return shuffle(unique).slice(0, count);
}

function buildQuestionPool(stageVerses: VerseRef[]): Question[] {
  const allBookNames = Array.from(new Set(stageVerses.map((v) => v.bookName)));

  const questions: Question[] = [];
  for (const v of stageVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    if (!text) continue;
    const id = `${v.bookName}-${v.chapter}-${v.verse}`;

    // Type 1: which book is this from — needs at least 3 OTHER books
    // present in this stage. A narrow stage (deep inside one large book)
    // may not have enough - skipped for that verse rather than padding
    // with fewer than 4 real choices.
    const bookDistractors = distractorsFrom(allBookNames, v.bookName, 3);
    if (bookDistractors.length === 3) {
      questions.push({
        id: `${id}-book`,
        verseText: text,
        prompt: 'Which book is this verse from?',
        choices: shuffle([v.bookName, ...bookDistractors]),
        correctAnswer: v.bookName,
      });
    }

    // Type 2: which chapter is this from — distractors are other chapter
    // numbers of the SAME book present in this stage.
    const sameBookChapters = Array.from(
      new Set(stageVerses.filter((o) => o.bookName === v.bookName).map((o) => String(o.chapter))),
    );
    const chapterDistractors = distractorsFrom(sameBookChapters, String(v.chapter), 3);
    if (chapterDistractors.length === 3) {
      questions.push({
        id: `${id}-chapter`,
        verseText: text,
        prompt: `Which chapter of ${v.bookName} is this verse from?`,
        choices: shuffle([String(v.chapter), ...chapterDistractors]),
        correctAnswer: String(v.chapter),
      });
    }
  }
  return questions;
}

export default function ScriptureTriviaGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [round, setRound] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  const loadRound = useCallback(async () => {
    const verses = await getStageVerses(gameKey, stageIndex);
    const pool = buildQuestionPool(verses);
    setRound(shuffle(pool).slice(0, ROUND_LENGTH));
  }, [gameKey, stageIndex]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const current = round?.[index] ?? null;

  const handleSelect = (choice: string) => {
    if (selected || !current) return;
    setSelected(choice);
    if (choice === current.correctAnswer) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round) return;
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      const outcome = await finishStage(gameKey, stageIndex, score); // score already reflects this question's point, set by handleSelect
      setStageResult(outcome);
      return;
    }
    setIndex(nextIndex);
    setSelected(null);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${round?.length ?? ROUND_LENGTH} correct this stage`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setIndex(0);
              setSelected(null);
              setScore(0);
              loadRound();
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!round || !current) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Question ${index + 1} of ${round.length}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.verseText, { color: palette.text }]}>“{current.verseText}”</Text>
        </View>

        <Text style={[styles.prompt, { color: palette.goldReadable }]}>{current.prompt}</Text>

        <View style={styles.choices}>
          {current.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrectChoice = choice === current.correctAnswer;
            const showState = selected !== null;
            const bg = !showState
              ? palette.card
              : isCorrectChoice
                ? '#16a34a20'
                : isSelected
                  ? '#dc262620'
                  : palette.card;
            const border = !showState
              ? palette.selectedBg
              : isCorrectChoice
                ? '#16a34a'
                : isSelected
                  ? '#dc2626'
                  : palette.selectedBg;
            return (
              <Pressable
                key={choice}
                onPress={() => handleSelect(choice)}
                disabled={showState}
                style={[styles.choiceRow, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.choiceText, { color: palette.text }]}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>

        {selected ? (
          <AnswerFeedback
            correct={selected === current.correctAnswer}
            text={selected === current.correctAnswer ? 'Correct!' : `Correct answer: ${current.correctAnswer}`}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={!selected}
          style={[styles.actionBtn, { backgroundColor: selected ? palette.goldReadable : palette.selectedBg }]}
        >
          <Text style={[styles.actionBtnText, { color: selected ? palette.onGold : palette.subtext }]}>
            {index + 1 >= round.length ? 'See Results' : 'Next Question'}
          </Text>
        </Pressable>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18 },
  verseText: { fontSize: 17, fontWeight: '600', lineHeight: 26, fontStyle: 'italic' },
  prompt: { fontSize: 14, fontWeight: '900' },
  choices: { gap: 10 },
  choiceRow: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  choiceText: { fontSize: 15, fontWeight: '700' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
