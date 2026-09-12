// src/components/Bible/games/KeywordSortGame.tsx
//
// "Keyword Sort" — sort key words from the passage into categories. The
// category has to be something ALWAYS objectively determinable from a word
// alone, with zero NLP/semantic risk, so it works on literally any passage
// (genealogies, legal codes, short/repetitive text included):
// "4 letters or fewer" vs "5 letters or more".
//
// Tap-to-sort, not drag-and-drop: RN drag gestures have known conflicts
// elsewhere in this codebase (see BooksInOrderGame's docblock) — tapping a
// tray chip selects it, then tapping one of the two bucket buttons files it
// into that bucket. Scoring happens once every word is placed and the
// player checks the sort: each chip gets a green check or red X depending
// on whether its bucket matches its true length category.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
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

const TARGET_WORD_COUNT = 12;
const MIN_WORD_LENGTH = 3; // skip tiny fragments like "a"/"in" — "of" etc. are already stoplisted
const SHORT_MAX_LENGTH = 4; // "4 letters or fewer" vs "5 letters or more"
const STOPLIST = new Set([
  'and', 'the', 'of', 'unto', 'that', 'shall', 'thou', 'thy', 'thee', 'which', 'with', 'for', 'from', 'upon',
]);

type Category = 'short' | 'long';

type WordChip = {
  id: string;
  display: string;
  length: number;
  category: Category;
};

type PlacedChip = WordChip & { placedAs: Category };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stripPunct(raw: string): string {
  return raw.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

/** Gathers up to TARGET_WORD_COUNT distinct, significant words from a
 * sample of the stage's own verses, rebalanced across both length
 * categories when both have enough candidates - a lopsided passage (e.g.
 * all long words) just gets a lopsided-but-still-playable set rather than a
 * forced ratio. Capped verse sample keeps this cheap on large stages. */
function gatherWords(stageVerses: VerseRef[]): WordChip[] {
  const seen = new Set<string>();
  const shortPool: WordChip[] = [];
  const longPool: WordChip[] = [];
  const sample = stageVerses.slice(0, 40);
  let idx = 0;

  for (const v of sample) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    for (const raw of tokenizeVerse(text)) {
      const norm = normalizeWord(raw);
      if (norm.length < MIN_WORD_LENGTH || STOPLIST.has(norm) || seen.has(norm)) continue;
      seen.add(norm);
      const display = stripPunct(raw) || norm;
      const category: Category = norm.length <= SHORT_MAX_LENGTH ? 'short' : 'long';
      const chip: WordChip = { id: `${norm}-${idx++}`, display, length: norm.length, category };
      (category === 'short' ? shortPool : longPool).push(chip);
    }
  }

  const shortShuffled = shuffle(shortPool);
  const longShuffled = shuffle(longPool);
  const half = Math.floor(TARGET_WORD_COUNT / 2);
  let shortTake = Math.min(half, shortShuffled.length);
  let longTake = Math.min(half, longShuffled.length);
  let remaining = TARGET_WORD_COUNT - shortTake - longTake;
  if (remaining > 0) {
    const extraShort = Math.min(remaining, shortShuffled.length - shortTake);
    shortTake += extraShort;
    remaining -= extraShort;
  }
  if (remaining > 0) {
    const extraLong = Math.min(remaining, longShuffled.length - longTake);
    longTake += extraLong;
    remaining -= extraLong;
  }

  return shuffle([...shortShuffled.slice(0, shortTake), ...longShuffled.slice(0, longTake)]);
}

export default function KeywordSortGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [words, setWords] = useState<WordChip[] | null>(null);
  const [tray, setTray] = useState<WordChip[]>([]);
  const [shortBucket, setShortBucket] = useState<PlacedChip[]>([]);
  const [longBucket, setLongBucket] = useState<PlacedChip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  const load = useCallback(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const gathered = gatherWords(verses);
      setWords(gathered);
      setTray(gathered);
      setShortBucket([]);
      setLongBucket([]);
      setSelectedId(null);
      setSubmitted(false);
      setScore(0);
      setStageResult(null);
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  useEffect(() => load(), [load]);

  const handleChipTap = (chip: WordChip) => {
    if (submitted) return;
    setSelectedId((prev) => (prev === chip.id ? null : chip.id));
  };

  const handlePlace = (category: Category) => {
    if (submitted || !selectedId) return;
    const chip = tray.find((c) => c.id === selectedId);
    if (!chip) return;
    setTray((prev) => prev.filter((c) => c.id !== selectedId));
    const placed: PlacedChip = { ...chip, placedAs: category };
    if (category === 'short') setShortBucket((prev) => [...prev, placed]);
    else setLongBucket((prev) => [...prev, placed]);
    setSelectedId(null);
  };

  const handleUnplace = (chip: PlacedChip, from: Category) => {
    if (submitted) return;
    if (from === 'short') setShortBucket((prev) => prev.filter((c) => c.id !== chip.id));
    else setLongBucket((prev) => prev.filter((c) => c.id !== chip.id));
    setTray((prev) => [...prev, { id: chip.id, display: chip.display, length: chip.length, category: chip.category }]);
  };

  const allSorted = words !== null && words.length > 0 && tray.length === 0;

  const handleSubmit = () => {
    if (!allSorted) return;
    const correct =
      shortBucket.filter((c) => c.category === 'short').length + longBucket.filter((c) => c.category === 'long').length;
    setScore(correct);
    setSubmitted(true);
  };

  const handleContinue = async () => {
    const outcome = await finishStage(gameKey, stageIndex, score);
    setStageResult(outcome);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${words?.length ?? 0} sorted correctly`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={load}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (words === null) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (words.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.fallbackCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.fallbackText, { color: palette.text }]}>
              This stage doesn't have enough distinct words to sort.
            </Text>
            <Pressable onPress={onExit} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  const renderBucketChip = (chip: PlacedChip, from: Category) => {
    const isCorrect = chip.placedAs === chip.category;
    const showResult = submitted;
    return (
      <Pressable
        key={chip.id}
        onPress={() => handleUnplace(chip, from)}
        disabled={submitted}
        style={[
          styles.chip,
          {
            backgroundColor: showResult ? (isCorrect ? '#16a34a20' : '#dc262620') : palette.selectedBg,
            borderColor: showResult ? (isCorrect ? '#16a34a' : '#dc2626') : palette.goldReadable,
          },
        ]}
      >
        <Text style={[styles.chipText, { color: palette.text }]}>{chip.display}</Text>
        {showResult ? (
          <KISIcon name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={14} color={isCorrect ? '#16a34a' : '#dc2626'} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Sort ${words.length} words by length`}
      onBack={onExit}
      rightStat={submitted ? { label: 'Score', value: `${score}/${words.length}` } : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap a word below, then tap a bucket to sort it.
        </Text>

        <View style={styles.trayRow}>
          {tray.map((chip) => (
            <Pressable
              key={chip.id}
              onPress={() => handleChipTap(chip)}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedId === chip.id ? palette.goldReadable : palette.selectedBg,
                  borderColor: palette.goldReadable,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selectedId === chip.id ? palette.onGold : palette.text }]}>
                {chip.display}
              </Text>
            </Pressable>
          ))}
          {tray.length === 0 ? (
            <Text style={[styles.trayEmpty, { color: palette.subtext }]}>All words sorted — check below.</Text>
          ) : null}
        </View>

        {selectedId && !submitted ? (
          <View style={styles.sortActionsRow}>
            <Pressable onPress={() => handlePlace('short')} style={[styles.sortActionBtn, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}>
              <Text style={[styles.sortActionText, { color: palette.text }]}>Sort: 4 letters or fewer</Text>
            </Pressable>
            <Pressable onPress={() => handlePlace('long')} style={[styles.sortActionBtn, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}>
              <Text style={[styles.sortActionText, { color: palette.text }]}>Sort: 5 letters or more</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.bucket, { backgroundColor: palette.card }]}>
          <Text style={[styles.bucketLabel, { color: palette.goldReadable }]}>4 letters or fewer</Text>
          <View style={styles.bucketRow}>
            {shortBucket.map((chip) => renderBucketChip(chip, 'short'))}
            {shortBucket.length === 0 ? <Text style={[styles.bucketEmpty, { color: palette.subtext }]}>Empty</Text> : null}
          </View>
        </View>

        <View style={[styles.bucket, { backgroundColor: palette.card }]}>
          <Text style={[styles.bucketLabel, { color: palette.goldReadable }]}>5 letters or more</Text>
          <View style={styles.bucketRow}>
            {longBucket.map((chip) => renderBucketChip(chip, 'long'))}
            {longBucket.length === 0 ? <Text style={[styles.bucketEmpty, { color: palette.subtext }]}>Empty</Text> : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleContinue} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!allSorted}
            style={[styles.actionBtn, { backgroundColor: allSorted ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: allSorted ? palette.onGold : palette.subtext }]}>Check Sorting</Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 14 },
  fallbackText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  instructions: { fontSize: 13, fontWeight: '600' },
  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 40 },
  trayEmpty: { fontSize: 13, fontWeight: '600' },
  sortActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sortActionBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  sortActionText: { fontSize: 13, fontWeight: '800' },
  bucket: { borderRadius: 16, padding: 14, gap: 10 },
  bucketLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 36 },
  bucketEmpty: { fontSize: 13, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: { fontSize: 14, fontWeight: '800' },
  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
