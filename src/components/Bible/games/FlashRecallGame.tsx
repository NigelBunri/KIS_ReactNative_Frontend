// src/components/Bible/games/FlashRecallGame.tsx
//
// "Flash Recall" — a verse flashes briefly, then recall a detail about it.
// Deliberately snappy/urgent rather than a comfortable read: a "Get
// ready…" countdown beat, then the verse shows for only 1.5-3 seconds
// (scaled slightly by word count, much shorter than Verse Race's 6-20s
// read window — that's the key difference between the two games). Once the
// flash ends the text is hidden completely and one multiple-choice detail
// question tests what stuck.
//
// Question categories (word count / book / first word / last word) are the
// same derived-from-this-stage's-own-content family Verse Race uses, with
// "last word" added for variety so the two games don't feel identical —
// every option and distractor still comes only from this stage's verses.

import React, { useCallback, useEffect, useState } from 'react';
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
const COUNTDOWN_MS = 1000;

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

type QuestionType = 'wordcount' | 'book' | 'firstword' | 'lastword';

type RoundQuestion = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
};

function uniqueOtherWords(otherVerses: VerseRef[], exclude: string, pick: (tokens: string[]) => string | undefined): string[] {
  const map = new Map<string, string>(); // normalized -> display
  for (const v of otherVerses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const tokens = tokenizeVerse(text);
    const raw = pick(tokens);
    if (!raw) continue;
    const word = cleanWord(raw);
    const norm = normalizeWord(word);
    if (norm && norm !== normalizeWord(exclude) && !map.has(norm)) map.set(norm, word);
  }
  return Array.from(map.values());
}

function buildQuestion(verse: VerseRef, tokens: string[], stageVerses: VerseRef[]): RoundQuestion {
  const id = verseId(verse);
  const wordCount = tokens.length;
  const firstWord = cleanWord(tokens[0] ?? '');
  const lastWord = cleanWord(tokens[tokens.length - 1] ?? '');

  const otherVerses = stageVerses.filter((v) => verseId(v) !== id);
  const otherBooks = Array.from(new Set(otherVerses.map((v) => v.bookName).filter((b) => b !== verse.bookName)));
  const otherFirstWords = uniqueOtherWords(otherVerses, firstWord, (t) => t[0]);
  const otherLastWords = uniqueOtherWords(otherVerses, lastWord, (t) => t[t.length - 1]);

  const feasible: QuestionType[] = ['wordcount'];
  if (otherBooks.length >= 1) feasible.push('book');
  if (otherFirstWords.length >= 1) feasible.push('firstword');
  if (otherLastWords.length >= 1 && lastWord) feasible.push('lastword');
  const type = feasible[Math.floor(Math.random() * feasible.length)];

  if (type === 'book') {
    const distractors = shuffle(otherBooks).slice(0, 3);
    const options = shuffle([verse.bookName, ...distractors]);
    return { type, prompt: 'Which book was that verse from?', options, correctIndex: options.indexOf(verse.bookName) };
  }

  if (type === 'firstword') {
    const distractors = shuffle(otherFirstWords).slice(0, 3);
    const options = shuffle([firstWord, ...distractors]);
    return { type, prompt: 'What was the FIRST word of that verse?', options, correctIndex: options.indexOf(firstWord) };
  }

  if (type === 'lastword') {
    const distractors = shuffle(otherLastWords).slice(0, 3);
    const options = shuffle([lastWord, ...distractors]);
    return { type, prompt: 'What was the LAST word of that verse?', options, correctIndex: options.indexOf(lastWord) };
  }

  const distractors = buildNumberDistractors(wordCount, 3);
  const options = shuffle([wordCount, ...distractors]).map(String);
  return { type: 'wordcount', prompt: 'How many words were in that verse?', options, correctIndex: options.indexOf(String(wordCount)) };
}

type Round = {
  verse: VerseRef;
  tokens: string[];
  flashMs: number;
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
  const flashMs = Math.round(Math.max(1.5, Math.min(3, 1.5 + tokens.length * 0.05)) * 1000);
  const question = buildQuestion(verse, tokens, stageVerses);
  return { verse, tokens, flashMs, question };
}

type Phase = 'countdown' | 'flash' | 'question';

export default function FlashRecallGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

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
    setPhase('countdown');
    setSelectedIndex(null);
  }, []);

  useEffect(() => {
    if (stageVerses && stageVerses.length > 0 && !round) startRound(stageVerses, seenIds);
  }, [stageVerses, round, seenIds, startRound]);

  useEffect(() => {
    if (!round) return;
    if (phase === 'countdown') {
      const t = setTimeout(() => setPhase('flash'), COUNTDOWN_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'flash') {
      const t = setTimeout(() => setPhase('question'), round.flashMs);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, round]);

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
            <KISIcon name="bolt" size={30} color={palette.subtext} />
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
      {phase === 'countdown' ? (
        <View style={styles.centerFill}>
          <KISIcon name="bolt" size={36} color={palette.goldReadable} />
          <Text style={[styles.countdownText, { color: palette.text }]}>Get ready…</Text>
        </View>
      ) : phase === 'flash' ? (
        <View style={styles.centerFill}>
          <Text style={[styles.nowLabel, { color: palette.goldReadable }]}>NOW</Text>
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
            <Text style={[styles.verseText, { color: palette.text }]}>{round.tokens.join(' ')}</Text>
          </View>
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
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10, alignSelf: 'stretch' },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  verseText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  questionPrompt: { fontSize: 17, fontWeight: '800', lineHeight: 24, textAlign: 'center' },
  countdownText: { fontSize: 20, fontWeight: '900' },
  nowLabel: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  optionsWrap: { gap: 10 },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
});
