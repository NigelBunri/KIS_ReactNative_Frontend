// src/components/Bible/games/VerseRaceGame.tsx
//
// "Verse Race" — timed read-through with a recall check at the end. Each
// round gives the player a verse to read against a countdown scaled to its
// length (roughly 1.2s/word, clamped to a 6-20s window — long enough to
// read once at a comfortable pace, not a speed-reading drill). They can tap
// "I'm ready" to move on early. Once time's up (or they tap ready), the
// verse text is hidden completely and a multiple-choice recall question
// tests what they remember about it. The pressure is entirely on the READ
// phase — that's what distinguishes this from Flash Recall's brief-flash
// mechanic, which puts the pressure on a much shorter glimpse instead.
//
// All three recall question types (word count / book / first word) and all
// their distractors are derived purely from this stage's own verses — never
// outside trivia — so the game stays fair on any random slice of the Bible
// a stage happens to carry.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
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

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

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

function cleanWord(word: string): string {
  return word.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '') || word;
}

function buildNumberDistractors(correct: number, count: number): number[] {
  const candidates = new Set<number>();
  const deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
  for (const d of deltas) {
    const candidate = correct + d;
    if (candidate > 0 && candidate !== correct) candidates.add(candidate);
  }
  return shuffle(Array.from(candidates)).slice(0, count);
}

type QuestionType = 'wordcount' | 'book' | 'firstword';

type RoundQuestion = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
};

function buildQuestion(verse: VerseRef, tokens: string[], stageVerses: VerseRef[]): RoundQuestion {
  const id = verseId(verse);
  const wordCount = tokens.length;
  const firstWord = cleanWord(tokens[0] ?? '');

  const otherVerses = stageVerses.filter((v) => verseId(v) !== id);
  const otherBooks = Array.from(new Set(otherVerses.map((v) => v.bookName).filter((b) => b !== verse.bookName)));
  const otherFirstWordsSet = new Map<string, string>(); // normalized -> display
  for (const v of otherVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const first = cleanWord(tokenizeVerse(text)[0] ?? '');
    if (!first) continue;
    const norm = normalizeWord(first);
    if (norm && norm !== normalizeWord(firstWord) && !otherFirstWordsSet.has(norm)) {
      otherFirstWordsSet.set(norm, first);
    }
  }
  const otherFirstWords = Array.from(otherFirstWordsSet.values());

  const feasible: QuestionType[] = ['wordcount'];
  if (otherBooks.length >= 1) feasible.push('book');
  if (otherFirstWords.length >= 1) feasible.push('firstword');
  const type = feasible[Math.floor(Math.random() * feasible.length)];

  if (type === 'book') {
    const distractors = shuffle(otherBooks).slice(0, 3);
    const options = shuffle([verse.bookName, ...distractors]);
    return {
      type,
      prompt: 'Which book was that verse from?',
      options,
      correctIndex: options.indexOf(verse.bookName),
    };
  }

  if (type === 'firstword') {
    const distractors = shuffle(otherFirstWords).slice(0, 3);
    const options = shuffle([firstWord, ...distractors]);
    return {
      type,
      prompt: 'What was the FIRST word of that verse?',
      options,
      correctIndex: options.indexOf(firstWord),
    };
  }

  const distractors = buildNumberDistractors(wordCount, 3);
  const options = shuffle([wordCount, ...distractors]).map(String);
  return {
    type: 'wordcount',
    prompt: 'How many words are in that verse?',
    options,
    correctIndex: options.indexOf(String(wordCount)),
  };
}

type Round = {
  verse: VerseRef;
  tokens: string[];
  readSeconds: number;
  question: RoundQuestion;
};

function buildRound(stageVerses: VerseRef[], exclude: Set<string>): Round | null {
  const available = stageVerses.filter((v) => !exclude.has(verseId(v)));
  const source = available.length ? available : stageVerses;
  if (!source.length) return null;
  const verse = source[Math.floor(Math.random() * source.length)];
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  if (!tokens.length) return null;
  const readSeconds = Math.max(6, Math.min(20, Math.round(tokens.length * 1.2)));
  const question = buildQuestion(verse, tokens, stageVerses);
  return { verse, tokens, readSeconds, question };
}

export default function VerseRaceGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<'reading' | 'question'>('reading');
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setStageVerses(verses);
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  const startRound = useCallback((verses: VerseRef[], exclude: Set<string>) => {
    const next = buildRound(verses, exclude);
    if (!next) return;
    setRound(next);
    setPhase('reading');
    setTimeLeft(next.readSeconds);
    setSelectedIndex(null);
  }, []);

  useEffect(() => {
    if (stageVerses && stageVerses.length > 0 && !round) startRound(stageVerses, seenIds);
  }, [stageVerses, round, seenIds, startRound]);

  useEffect(() => {
    if (phase !== 'reading' || !round) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase('question');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, round]);

  const handleReady = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('question');
  };

  const handleSelect = (index: number) => {
    if (selectedIndex !== null || !round) return;
    setSelectedIndex(index);
    if (index === round.question.correctIndex) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!round || !stageVerses) return;
    const nextSeen = new Set(seenIds).add(verseId(round.verse));
    setSeenIds(nextSeen);
    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUND_LENGTH) {
      setRoundIndex(nextIndex);
      const outcome = await finishStage(gameKey, stageIndex, score); // score already reflects this round's point, set by handleSelect
      setStageResult(outcome);
      return;
    }
    setRoundIndex(nextIndex);
    startRound(stageVerses, nextSeen);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${ROUND_LENGTH} correct this stage`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setRoundIndex(0);
              setSeenIds(new Set());
              setScore(0);
              setRound(null);
              getStageVerses(gameKey, stageIndex).then(setStageVerses);
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!stageVerses) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (stageVerses.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.emptyCard, { backgroundColor: palette.card }]}>
            <KISIcon name="book" size={30} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              This stage doesn't have enough verses to play a full round — try another stage.
            </Text>
            <Pressable onPress={onExit} style={[styles.actionBtn, { backgroundColor: palette.goldReadable, marginTop: 10 }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  if (!round) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${roundIndex + 1} of ${ROUND_LENGTH}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      {phase === 'reading' ? (
        <View style={styles.centerFill}>
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
            <Text style={[styles.verseText, { color: palette.text }]}>{round.tokens.join(' ')}</Text>
          </View>

          <View style={styles.timerWrap}>
            <View style={[styles.timerTrack, { backgroundColor: palette.selectedBg }]}>
              <View
                style={[
                  styles.timerFill,
                  { backgroundColor: palette.goldReadable, width: `${(timeLeft / round.readSeconds) * 100}%` },
                ]}
              />
            </View>
            <Text style={[styles.timerText, { color: palette.subtext }]}>{timeLeft}s left to read</Text>
          </View>

          <Pressable onPress={handleReady} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>I'm ready</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.questionPrompt, { color: palette.text }]}>{round.question.prompt}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {round.question.options.map((option, index) => {
              const showState = selectedIndex !== null;
              const isSelected = selectedIndex === index;
              const isCorrectOption = index === round.question.correctIndex;
              return (
                <Pressable
                  key={`${option}-${index}`}
                  onPress={() => handleSelect(index)}
                  disabled={selectedIndex !== null}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: showState && isCorrectOption ? '#16a34a25' : showState && isSelected ? '#dc262625' : palette.selectedBg,
                      borderColor: showState && isCorrectOption ? '#16a34a' : showState && isSelected ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: palette.text }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedIndex !== null ? (
            <AnswerFeedback
              correct={selectedIndex === round.question.correctIndex}
              text={
                selectedIndex === round.question.correctIndex
                  ? 'Correct!'
                  : `Correct answer: ${round.question.options[round.question.correctIndex]}`
              }
            />
          ) : null}

          {selectedIndex !== null ? (
            <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
                {roundIndex + 1 >= ROUND_LENGTH ? 'See Results' : 'Next Verse'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10, alignSelf: 'stretch' },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  verseText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  questionPrompt: { fontSize: 17, fontWeight: '800', lineHeight: 24, textAlign: 'center' },
  timerWrap: { alignSelf: 'stretch', gap: 8 },
  timerTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 999 },
  timerText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  optionsWrap: { gap: 10 },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
});
