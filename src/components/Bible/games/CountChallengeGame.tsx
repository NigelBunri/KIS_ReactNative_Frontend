// src/components/Bible/games/CountChallengeGame.tsx
//
// Game 21 of 30: "Count Challenge" — numeric multiple choice, two question
// types, both derived purely from a verse's own text (no curated data, so
// it works on any random slice of the Bible):
//   - "How many words are in this verse?"
//   - "How many times does the word '___' appear in this verse?" (picks a
//     word that repeats at least twice - genealogies and legal lists,
//     which repeat phrases like "begat"/"son of"/"shall", are especially
//     well suited to this type, not just tolerated by it).

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import {
  completeCurrentStage,
  getCurrentStageVerses,
  recordScore,
  STAGES_PER_GAME,
  type GameKey,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';

const ROUND_LENGTH = 8;

type Question = { id: string; verseText: string; prompt: string; correctCount: number; choices: number[] };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function numericDistractors(correct: number): number[] {
  const candidates = new Set<number>();
  const deltas = [-2, -1, 1, 2, 3, -3];
  for (const d of deltas) {
    const v = correct + d;
    if (v > 0 && v !== correct) candidates.add(v);
    if (candidates.size >= 3) break;
  }
  return Array.from(candidates).slice(0, 3);
}

function mostRepeatedWord(words: string[]): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const w of words) {
    const n = normalizeWord(w);
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (count >= 2 && (!best || count > best.count)) best = { word, count };
  }
  return best;
}

function buildQuestions(stageVerses: VerseRef[]): Question[] {
  const questions: Question[] = [];
  for (const v of stageVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    if (!text) continue;
    const words = tokenizeVerse(text);
    const id = `${v.bookName}-${v.chapter}-${v.verse}`;

    if (words.length >= 3) {
      const correct = words.length;
      const distractors = numericDistractors(correct);
      if (distractors.length === 3) {
        questions.push({
          id: `${id}-wordcount`,
          verseText: text,
          prompt: 'How many words are in this verse?',
          correctCount: correct,
          choices: shuffle([correct, ...distractors]),
        });
      }
    }

    const repeated = mostRepeatedWord(words);
    if (repeated) {
      const distractors = numericDistractors(repeated.count);
      if (distractors.length === 3) {
        questions.push({
          id: `${id}-wordoccurrence`,
          verseText: text,
          prompt: `How many times does "${repeated.word}" appear in this verse?`,
          correctCount: repeated.count,
          choices: shuffle([repeated.count, ...distractors]),
        });
      }
    }
  }
  return shuffle(questions).slice(0, ROUND_LENGTH);
}

export default function CountChallengeGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [round, setRound] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);

  const loadRound = useCallback(async () => {
    const verses = await getCurrentStageVerses(gameKey);
    setRound(buildQuestions(verses));
    setIndex(0);
    setSelected(null);
    setScore(0);
  }, [gameKey]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const current = round?.[index] ?? null;

  const handleSelect = (choice: number) => {
    if (selected !== null || !current) return;
    setSelected(choice);
    if (choice === current.correctCount) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round) return;
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      await recordScore(gameKey, score);
      const progress = await completeCurrentStage(gameKey);
      setStageResult({ stagesCompleted: progress.stagesCompleted, isFinalStage: progress.stagesCompleted >= STAGES_PER_GAME });
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
            stagesCompleted={stageResult.stagesCompleted}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            onContinue={() => { setStageResult(null); loadRound(); }}
            onViewStats={onOpenStats}
            onExit={onExit}
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
      subtitle={`Question ${index + 1} of ${round.length}`}
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
            const isCorrectChoice = choice === current.correctCount;
            const showState = selected !== null;
            const bg = !showState ? palette.card : isCorrectChoice ? '#16a34a20' : isSelected ? '#dc262620' : palette.card;
            const border = !showState ? palette.selectedBg : isCorrectChoice ? '#16a34a' : isSelected ? '#dc2626' : palette.selectedBg;
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

        {selected !== null ? (
          <AnswerFeedback
            correct={selected === current.correctCount}
            text={selected === current.correctCount ? 'Correct!' : `Correct answer: ${current.correctCount}`}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={selected === null}
          style={[styles.actionBtn, { backgroundColor: selected !== null ? palette.goldReadable : palette.selectedBg }]}
        >
          <Text style={[styles.actionBtnText, { color: selected !== null ? palette.onGold : palette.subtext }]}>
            {index + 1 >= round.length ? 'Finish Stage' : 'Next Question'}
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
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceRow: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, minWidth: 72, alignItems: 'center' },
  choiceText: { fontSize: 17, fontWeight: '800' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
