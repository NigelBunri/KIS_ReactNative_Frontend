// src/components/Bible/games/ScriptureTriviaGame.tsx
//
// Game 4 of 6: "Scripture Trivia" — multiple choice. Two question types,
// both generated from the curated verse pool, both about recognition/
// attribution ("which book is this from", "who said this") rather than
// verbatim recall — the thing that makes this genuinely distinct from
// games 1 and 6, which both test exact wording.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { AnswerFeedback, RoundComplete } from './GameFeedback';
import { CURATED_VERSES } from '../../../screens/tabs/bible/games/curatedVerses';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import { recordScore } from '../../../screens/tabs/bible/games/gameStorage';

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

function buildQuestionPool(): Question[] {
  const allBookNames = Array.from(new Set(CURATED_VERSES.map((v) => v.bookName)));
  const allSpeakers = Array.from(new Set(CURATED_VERSES.map((v) => v.speaker).filter(Boolean))) as string[];

  const questions: Question[] = [];
  for (const v of CURATED_VERSES) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    if (!text) continue;

    // Type 1: which book is this from — always available.
    const bookDistractors = distractorsFrom(allBookNames, v.bookName, 3);
    questions.push({
      id: `${v.id}-book`,
      verseText: text,
      prompt: 'Which book is this verse from?',
      choices: shuffle([v.bookName, ...bookDistractors]),
      correctAnswer: v.bookName,
    });

    // Type 2: who said this — only for verses with an attributed speaker.
    if (v.speaker) {
      const speakerDistractors = distractorsFrom(allSpeakers, v.speaker, 3);
      if (speakerDistractors.length >= 2) {
        questions.push({
          id: `${v.id}-speaker`,
          verseText: text,
          prompt: 'Who said this?',
          choices: shuffle([v.speaker, ...speakerDistractors]),
          correctAnswer: v.speaker,
        });
      }
    }
  }
  return questions;
}

export default function ScriptureTriviaGame({ onExit }: { onExit: () => void }) {
  const { palette } = useKISTheme();
  const pool = useMemo(() => buildQuestionPool(), []);
  const [round, setRound] = useState<Question[]>(() => shuffle(pool).slice(0, ROUND_LENGTH));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = round[index];

  const handleSelect = (choice: string) => {
    if (selected) return;
    setSelected(choice);
    if (choice === current.correctAnswer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= round.length) {
      setFinished(true);
      recordScore('scripture-trivia', score); // score already reflects this question's point, set by handleSelect
      return;
    }
    setIndex(nextIndex);
    setSelected(null);
  };

  const handlePlayAgain = () => {
    setRound(shuffle(pool).slice(0, ROUND_LENGTH));
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <GameShell title="Scripture Trivia" onBack={onExit}>
        <View style={styles.centerFill}>
          <RoundComplete
            title={score === ROUND_LENGTH ? 'Perfect score!' : 'Round complete'}
            scoreLine={`${score} / ${ROUND_LENGTH} correct`}
            onPlayAgain={handlePlayAgain}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  if (!current) {
    return (
      <GameShell title="Scripture Trivia" onBack={onExit}>
        <View style={styles.centerFill} />
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Scripture Trivia"
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
