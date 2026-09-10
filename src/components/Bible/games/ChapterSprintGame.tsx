// src/components/Bible/games/ChapterSprintGame.tsx
//
// Game 16 of 30: "Chapter Sprint" — multiple choice, "which chapter (of
// this book) is this verse from?", under a per-question countdown. The
// timer is what earns this its own game rather than duplicating Scripture
// Trivia's untimed chapter-question type: same underlying question shape,
// genuinely different pressure/pacing experience. Distractors are other
// chapter numbers of the SAME book present in the current stage, so it
// works on any slice of the Bible a reshuffle assigns.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import {
  completeCurrentStage,
  getCurrentStageVerses,
  recordScore,
  STAGES_PER_GAME,
  type GameKey,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';

const ROUND_LENGTH = 10;
const SECONDS_PER_QUESTION = 8;

type Question = { id: string; verseText: string; bookName: string; correctChapter: string; choices: string[] };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions(stageVerses: VerseRef[]): Question[] {
  const questions: Question[] = [];
  for (const v of stageVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    if (!text) continue;
    const sameBookChapters = Array.from(
      new Set(stageVerses.filter((o) => o.bookName === v.bookName).map((o) => String(o.chapter))),
    );
    const distractors = shuffle(sameBookChapters.filter((c) => c !== String(v.chapter))).slice(0, 3);
    if (distractors.length !== 3) continue;
    questions.push({
      id: `${v.bookName}-${v.chapter}-${v.verse}`,
      verseText: text,
      bookName: v.bookName,
      correctChapter: String(v.chapter),
      choices: shuffle([String(v.chapter), ...distractors]),
    });
  }
  return shuffle(questions).slice(0, ROUND_LENGTH);
}

export default function ChapterSprintGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [round, setRound] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRound = useCallback(async () => {
    const verses = await getCurrentStageVerses(gameKey);
    setRound(buildQuestions(verses));
    setIndex(0);
    setSelected(null);
    setTimedOut(false);
    setScore(0);
  }, [gameKey]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const current = round?.[index] ?? null;
  const answered = selected !== null || timedOut;

  // Countdown for the current question only - stops the moment an answer
  // (or a timeout) has already been recorded.
  useEffect(() => {
    if (!current || answered) return;
    setSecondsLeft(SECONDS_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimedOut(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (choice: string) => {
    if (answered || !current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(choice);
    if (choice === current.correctChapter) setScore((s) => s + 1);
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
    setTimedOut(false);
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
        <View style={[styles.timerTrack, { backgroundColor: palette.divider }]}>
          <View
            style={[
              styles.timerFill,
              {
                width: `${(secondsLeft / SECONDS_PER_QUESTION) * 100}%`,
                backgroundColor: secondsLeft <= 3 ? '#dc2626' : palette.goldReadable,
              },
            ]}
          />
        </View>

        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.verseText, { color: palette.text }]}>“{current.verseText}”</Text>
        </View>

        <Text style={[styles.prompt, { color: palette.goldReadable }]}>
          Which chapter of {current.bookName} is this verse from?
        </Text>

        <View style={styles.choices}>
          {current.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrectChoice = choice === current.correctChapter;
            const showState = answered;
            const bg = !showState ? palette.card : isCorrectChoice ? '#16a34a20' : isSelected ? '#dc262620' : palette.card;
            const border = !showState ? palette.selectedBg : isCorrectChoice ? '#16a34a' : isSelected ? '#dc2626' : palette.selectedBg;
            return (
              <Pressable
                key={choice}
                onPress={() => handleSelect(choice)}
                disabled={showState}
                style={[styles.choiceRow, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.choiceText, { color: palette.text }]}>Chapter {choice}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <AnswerFeedback
            correct={selected === current.correctChapter}
            text={
              timedOut
                ? `Time's up! Correct answer: Chapter ${current.correctChapter}`
                : selected === current.correctChapter
                  ? 'Correct!'
                  : `Correct answer: Chapter ${current.correctChapter}`
            }
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={!answered}
          style={[styles.actionBtn, { backgroundColor: answered ? palette.goldReadable : palette.selectedBg }]}
        >
          <Text style={[styles.actionBtnText, { color: answered ? palette.onGold : palette.subtext }]}>
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
  timerTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 999 },
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
