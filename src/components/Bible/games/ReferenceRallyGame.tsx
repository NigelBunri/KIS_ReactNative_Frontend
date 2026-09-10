// src/components/Bible/games/ReferenceRallyGame.tsx
//
// Game 14 of 30: "Reference Rally" — multiple choice. Given a verse's text,
// pick its correct book/chapter/verse reference from 4 options. Distractor
// references are drawn from the SAME stage's own verse list (other verses
// the player is already working through), never from famous/well-known
// verses elsewhere in the Bible - this keeps it plausible and hard
// regardless of whether the stage happens to be Psalms or a Leviticus law
// list, since it never depends on outside "which verses are famous" data.
//
// Reads its verses from the stage/partition system (gameStorage.ts), same
// as Sequence Chain and Verse Jigsaw - the same-style reuse of Scripture
// Trivia's existing multiple-choice UI (AnswerFeedback + choice rows) for
// cross-game consistency.

import React, { useCallback, useEffect, useState } from 'react';
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

const ROUND_LENGTH = 8;

type Question = { id: string; verseText: string; correctReference: string; choices: string[] };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function buildQuestions(stageVerses: VerseRef[]): Question[] {
  const withText = stageVerses
    .map((ref) => ({ ref, text: getVerseText(ref.bookName, ref.chapter, ref.verse) }))
    .filter((v) => v.text.length > 0);
  const allReferences = withText.map((v) => referenceOf(v.ref));

  const questions: Question[] = shuffle(withText)
    .slice(0, Math.min(ROUND_LENGTH * 2, withText.length))
    .map(({ ref, text }) => {
      const correctReference = referenceOf(ref);
      const distractors = shuffle(Array.from(new Set(allReferences.filter((r) => r !== correctReference)))).slice(0, 3);
      return {
        id: correctReference,
        verseText: text,
        correctReference,
        choices: shuffle([correctReference, ...distractors]),
      };
    })
    // A stage with too few distinct references (very short stage) can't
    // always produce 3 real distractors - drop any question that came up
    // short rather than show fewer than 4 choices.
    .filter((q) => q.choices.length === 4)
    .slice(0, ROUND_LENGTH);

  return questions;
}

export default function ReferenceRallyGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [round, setRound] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);

  const loadRound = useCallback(async () => {
    const verses = await getCurrentStageVerses(gameKey);
    setRound(buildQuestions(verses));
  }, [gameKey]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const current = round?.[index] ?? null;

  const handleSelect = (choice: string) => {
    if (selected || !current) return;
    setSelected(choice);
    if (choice === current.correctReference) setScore((s) => s + 1);
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
            onContinue={() => {
              setStageResult(null);
              setIndex(0);
              setSelected(null);
              setScore(0);
              loadRound();
            }}
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

        <Text style={[styles.prompt, { color: palette.goldReadable }]}>Which reference is this verse from?</Text>

        <View style={styles.choices}>
          {current.choices.map((choice) => {
            const isSelected = selected === choice;
            const isCorrectChoice = choice === current.correctReference;
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

        {selected ? (
          <AnswerFeedback
            correct={selected === current.correctReference}
            text={selected === current.correctReference ? 'Correct!' : `Correct answer: ${current.correctReference}`}
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
  choices: { gap: 10 },
  choiceRow: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  choiceText: { fontSize: 15, fontWeight: '700' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
