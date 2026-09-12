// src/components/Bible/games/ChapterScrollGame.tsx
//
// "Chapter Scroll" — scroll a full chapter, then a short summary quiz.
// A stage's verses may span several chapters; this groups them into unique
// (book, chapter) pairs and plays up to 5 of them (fewer if the stage
// carries fewer distinct chapters — graceful degradation, same as every
// other partition-driven game). For each chapter: fetch every verse of that
// chapter via getChapterVerses and render it as a scrollable numbered
// mini-reader. The player must actually engage with it before continuing —
// tracked via real scroll position (see hasScrolledEnough below), with a
// "nothing to scroll" escape hatch for chapters short enough to fit the
// viewport outright, so a one-verse chapter never soft-locks the Continue
// button. Once continued, one multiple-choice question derived purely from
// that chapter's own fetched verse list (never a curated summary) checks
// what stuck.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { AnswerFeedback, StageComplete } from './GameFeedback';
import { getChapterVerses, type ChapterVerseEntry } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const TARGET_CHAPTER_COUNT = 5;
const SCROLL_THRESHOLD = 0.8; // must scroll to at least 80% of content height

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

type ChapterRef = { bookName: string; chapter: number };

function chapterKeyOf(ref: ChapterRef): string {
  return `${ref.bookName}-${ref.chapter}`;
}

function getDistinctChapters(stageVerses: VerseRef[]): ChapterRef[] {
  const seen = new Set<string>();
  const list: ChapterRef[] = [];
  for (const v of stageVerses) {
    const ref = { bookName: v.bookName, chapter: v.chapter };
    const key = chapterKeyOf(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(ref);
  }
  return list;
}

type QuestionType = 'versecount' | 'whichnumber';

type RoundQuestion = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
};

function buildChapterQuestion(verses: ChapterVerseEntry[]): RoundQuestion {
  const count = verses.length;
  const feasible: QuestionType[] = ['versecount'];
  const eligibleForWhichNumber = verses.filter((v) => v.text.length > 0);
  if (eligibleForWhichNumber.length >= 2) feasible.push('whichnumber');
  const type = feasible[Math.floor(Math.random() * feasible.length)];

  if (type === 'whichnumber') {
    const target = eligibleForWhichNumber[Math.floor(Math.random() * eligibleForWhichNumber.length)];
    const otherNumbers = verses.filter((v) => v.verse !== target.verse).map((v) => v.verse);
    const distractors = shuffle(otherNumbers).slice(0, 3);
    const options = shuffle([target.verse, ...distractors]).map(String);
    const shortText = target.text.length > 90 ? `${target.text.slice(0, 87)}…` : target.text;
    return {
      type,
      prompt: `Which verse number is this line from?\n"${shortText}"`,
      options,
      correctIndex: options.indexOf(String(target.verse)),
    };
  }

  const distractors = buildNumberDistractors(count, 3);
  const options = shuffle([count, ...distractors]).map(String);
  return {
    type: 'versecount',
    prompt: 'How many verses does this chapter have?',
    options,
    correctIndex: options.indexOf(String(count)),
  };
}

export default function ChapterScrollGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterVerses, setChapterVerses] = useState<ChapterVerseEntry[]>([]);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [hasScrolledEnough, setHasScrolledEnough] = useState(false);
  const [phase, setPhase] = useState<'reading' | 'question'>('reading');
  const [question, setQuestion] = useState<RoundQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      setStageVerses(verses);
      setChapters(shuffle(getDistinctChapters(verses)).slice(0, TARGET_CHAPTER_COUNT));
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  useEffect(() => {
    const current = chapters[chapterIndex];
    if (!current) return;
    setChapterVerses(getChapterVerses(current.bookName, current.chapter));
    setContentHeight(0);
    setViewportHeight(0);
    setHasScrolledEnough(false);
    setPhase('reading');
    setQuestion(null);
    setSelectedIndex(null);
  }, [chapters, chapterIndex]);

  useEffect(() => {
    if (contentHeight > 0 && viewportHeight > 0 && contentHeight <= viewportHeight) {
      setHasScrolledEnough(true);
    }
  }, [contentHeight, viewportHeight]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentSize.height <= 0) return;
    const scrolledFraction = (contentOffset.y + layoutMeasurement.height) / contentSize.height;
    if (scrolledFraction >= SCROLL_THRESHOLD) setHasScrolledEnough(true);
  };

  const handleContinue = () => {
    if (!hasScrolledEnough || chapterVerses.length === 0) return;
    setQuestion(buildChapterQuestion(chapterVerses));
    setPhase('question');
  };

  const handleSelect = (index: number) => {
    if (selectedIndex !== null || !question) return;
    setSelectedIndex(index);
    if (index === question.correctIndex) setScore((s) => s + 1);
  };

  const handleNextChapter = async () => {
    const nextIndex = chapterIndex + 1;
    if (nextIndex >= chapters.length) {
      const outcome = await finishStage(gameKey, stageIndex, score); // score already reflects this chapter's point, set by handleSelect
      setStageResult(outcome);
      return;
    }
    setChapterIndex(nextIndex);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${chapters.length} chapters correct`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setChapterIndex(0);
              setScore(0);
              getStageVerses(gameKey, stageIndex).then((verses) => {
                setStageVerses(verses);
                setChapters(shuffle(getDistinctChapters(verses)).slice(0, TARGET_CHAPTER_COUNT));
              });
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

  if (chapters.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.emptyCard, { backgroundColor: palette.card }]}>
            <KISIcon name="book" size={30} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              This stage doesn't have enough chapter content to play a full round — try another stage.
            </Text>
            <Pressable onPress={onExit} style={[styles.actionBtn, { backgroundColor: palette.goldReadable, marginTop: 10 }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  const currentChapter = chapters[chapterIndex];

  return (
    <GameShell
      title={meta.title}
      subtitle={
        phase === 'reading'
          ? `${isReplay ? 'Replay · ' : ''}${currentChapter.bookName} ${currentChapter.chapter} — Chapter ${chapterIndex + 1} of ${chapters.length}`
          : `${isReplay ? 'Replay · ' : ''}Chapter ${chapterIndex + 1} of ${chapters.length}`
      }
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      {phase === 'reading' ? (
        <View style={styles.readingWrap}>
          <View
            style={styles.scrollViewport}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          >
            <ScrollView
              showsVerticalScrollIndicator
              onScroll={handleScroll}
              scrollEventThrottle={32}
              onContentSizeChange={(_w, h) => setContentHeight(h)}
              contentContainerStyle={styles.chapterScrollContent}
            >
              {chapterVerses.length === 0 ? (
                <Text style={[styles.emptyText, { color: palette.subtext }]}>This chapter has no available text.</Text>
              ) : (
                chapterVerses.map((v) => (
                  <View key={v.verse} style={styles.verseRow}>
                    <Text style={[styles.verseNum, { color: palette.goldReadable }]}>{v.verse}</Text>
                    <Text style={[styles.verseRowText, { color: palette.text }]}>{v.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          <Pressable
            onPress={handleContinue}
            disabled={!hasScrolledEnough}
            style={[
              styles.actionBtn,
              { backgroundColor: hasScrolledEnough ? palette.goldReadable : palette.selectedBg, marginTop: 12 },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: hasScrolledEnough ? palette.onGold : palette.subtext }]}>
              {hasScrolledEnough ? 'Continue' : 'Scroll to read the whole chapter'}
            </Text>
          </Pressable>
        </View>
      ) : question ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.questionPrompt, { color: palette.text }]}>{question.prompt}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {question.options.map((option, index) => {
              const showState = selectedIndex !== null;
              const isSelected = selectedIndex === index;
              const isCorrectOption = index === question.correctIndex;
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
              correct={selectedIndex === question.correctIndex}
              text={selectedIndex === question.correctIndex ? 'Correct!' : `Correct answer: ${question.options[question.correctIndex]}`}
            />
          ) : null}

          {selectedIndex !== null ? (
            <Pressable onPress={handleNextChapter} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
                {chapterIndex + 1 >= chapters.length ? 'See Results' : 'Next Chapter'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      )}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  readingWrap: { flex: 1, minHeight: 0 },
  scrollViewport: { flex: 1, minHeight: 0 },
  chapterScrollContent: { paddingBottom: 12 },
  verseRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  verseNum: { fontSize: 12, fontWeight: '900', width: 22, textAlign: 'right', marginTop: 2 },
  verseRowText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  scrollContent: { gap: 16, paddingBottom: 16 },
  verseCard: { borderRadius: 18, padding: 18, gap: 10, alignSelf: 'stretch' },
  questionPrompt: { fontSize: 16, fontWeight: '800', lineHeight: 23, textAlign: 'center' },
  optionsWrap: { gap: 10 },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
});
