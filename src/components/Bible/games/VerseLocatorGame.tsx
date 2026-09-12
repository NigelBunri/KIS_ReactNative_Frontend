// src/components/Bible/games/VerseLocatorGame.tsx
//
// Game 15 of 30: "Verse Locator" — the inverse of Reference Rally. Given a
// reference (e.g. "John 3:16"), pick the correct verse TEXT from 4 options.
// Distractor texts are other verses from the same stage - plausible without
// depending on any "famous verse" data, so it works on any random slice of
// the Bible, genealogies included.

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

const ROUND_LENGTH = 8;

type Question = { id: string; reference: string; correctText: string; choices: string[] };

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
  const allTexts = withText.map((v) => v.text);

  const questions: Question[] = shuffle(withText)
    .slice(0, Math.min(ROUND_LENGTH * 2, withText.length))
    .map(({ ref, text }) => {
      const distractors = shuffle(Array.from(new Set(allTexts.filter((t) => t !== text)))).slice(0, 3);
      return {
        id: referenceOf(ref),
        reference: referenceOf(ref),
        correctText: text,
        choices: shuffle([text, ...distractors]),
      };
    })
    // A stage with too few distinct verse texts (very short stage) can't
    // always produce 3 real distractors - drop that question rather than
    // show fewer than 4 choices.
    .filter((q) => q.choices.length === 4)
    .slice(0, ROUND_LENGTH);

  return questions;
}

export default function VerseLocatorGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [round, setRound] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  const loadRound = useCallback(async () => {
    const verses = await getStageVerses(gameKey, stageIndex);
    setRound(buildQuestions(verses));
    setIndex(0);
    setSelected(null);
    setScore(0);
  }, [gameKey, stageIndex]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const current = round?.[index] ?? null;

  const handleSelect = (choice: string) => {
    if (selected || !current) return;
    setSelected(choice);
    if (choice === current.correctText) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round) return;
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      const outcome = await finishStage(gameKey, stageIndex, score);
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
            onPlayAgain={() => { setStageResult(null); loadRound(); }}
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
        <Text style={[styles.prompt, { color: palette.goldReadable }]}>Which verse is {current.reference}?</Text>

        <View style={styles.choices}>
          {current.choices.map((choice, i) => {
            const isSelected = selected === choice;
            const isCorrectChoice = choice === current.correctText;
            const showState = selected !== null;
            const bg = !showState ? palette.card : isCorrectChoice ? '#16a34a20' : isSelected ? '#dc262620' : palette.card;
            const border = !showState ? palette.selectedBg : isCorrectChoice ? '#16a34a' : isSelected ? '#dc2626' : palette.selectedBg;
            return (
              <Pressable
                key={`${choice}-${i}`}
                onPress={() => handleSelect(choice)}
                disabled={showState}
                style={[styles.choiceCard, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[styles.choiceText, { color: palette.text }]}>“{choice}”</Text>
              </Pressable>
            );
          })}
        </View>

        {selected ? (
          <AnswerFeedback
            correct={selected === current.correctText}
            text={selected === current.correctText ? 'Correct!' : 'Not quite — the correct verse is highlighted above.'}
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
  prompt: { fontSize: 15, fontWeight: '900' },
  choices: { gap: 10 },
  choiceCard: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  choiceText: { fontSize: 14, fontWeight: '600', lineHeight: 20, fontStyle: 'italic' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
