// src/components/Bible/games/VerseJigsawGame.tsx
//
// Game 11 of 30: "Verse Jigsaw" — a single verse is split into a handful of
// clause-sized chunks (split on commas/semicolons where present, falling
// back to even word-count chunks for a verse with no internal punctuation
// at all - a genealogy verse like "And Enos lived ninety years, and begat
// Cainan" still splits cleanly on its comma; one with none still splits
// into readable word-groups rather than failing to produce a puzzle).
// Purely structural reconstruction, same reasoning as Sequence Chain: works
// on any verse the partition engine hands it, not just famous ones.
//
// Reads its verses from the stage/partition system (gameStorage.ts).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
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

const ROUNDS_PER_STAGE = 6;
const MIN_CHUNKS = 3;
const MAX_CHUNKS = 6;
const TARGET_WORDS_PER_CHUNK = 4;

type Chunk = { key: string; text: string };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Splits a verse into clause-sized chunks. Prefers natural punctuation
 * breaks (comma/semicolon); if that produces too few or too many pieces
 * (or the verse has none), falls back to grouping words evenly - every
 * verse in the Bible produces SOME valid puzzle, never zero chunks. */
function chunkVerseText(text: string): string[] {
  const punctuationSplit = text
    .split(/(?<=[,;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (punctuationSplit.length >= MIN_CHUNKS && punctuationSplit.length <= MAX_CHUNKS) {
    return punctuationSplit;
  }
  const words = text.split(/\s+/).filter(Boolean);
  const chunkCount = Math.max(MIN_CHUNKS, Math.min(MAX_CHUNKS, Math.round(words.length / TARGET_WORDS_PER_CHUNK)));
  if (words.length <= chunkCount) return words;
  const chunks: string[] = [];
  const perChunk = Math.ceil(words.length / chunkCount);
  for (let i = 0; i < words.length; i += perChunk) {
    chunks.push(words.slice(i, i + perChunk).join(' '));
  }
  return chunks;
}

function pickRandomVerseWithEnoughText(stageVerses: VerseRef[]): { ref: VerseRef; text: string } | null {
  const pool = shuffle(stageVerses);
  for (const ref of pool) {
    const text = getVerseText(ref.bookName, ref.chapter, ref.verse);
    if (text.split(/\s+/).filter(Boolean).length >= MIN_CHUNKS) return { ref, text };
  }
  return null;
}

function buildRound(stageVerses: VerseRef[]): { ref: VerseRef; correctOrder: Chunk[]; tray: Chunk[] } | null {
  const picked = pickRandomVerseWithEnoughText(stageVerses);
  if (!picked) return null;
  const pieces = chunkVerseText(picked.text);
  const correctOrder: Chunk[] = pieces.map((text, i) => ({ key: `${picked.ref.bookName}-${picked.ref.chapter}-${picked.ref.verse}-${i}`, text }));
  return { ref: picked.ref, correctOrder, tray: shuffle(correctOrder) };
}

export default function VerseJigsawGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentRef, setCurrentRef] = useState<VerseRef | null>(null);
  const [correctOrder, setCorrectOrder] = useState<Chunk[]>([]);
  const [tray, setTray] = useState<Chunk[]>([]);
  const [placed, setPlaced] = useState<Chunk[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentStageVerses(gameKey).then((verses) => { if (active) setStageVerses(verses); });
    return () => { active = false; };
  }, [gameKey]);

  const setupRound = useCallback((verses: VerseRef[]) => {
    const round = buildRound(verses);
    if (!round) return;
    setCurrentRef(round.ref);
    setCorrectOrder(round.correctOrder);
    setTray(round.tray);
    setPlaced([]);
    setSubmitted(false);
  }, []);

  useEffect(() => {
    if (stageVerses) setupRound(stageVerses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageVerses, roundIndex]);

  const isComplete = placed.length === correctOrder.length && correctOrder.length > 0;
  const isCorrect = useMemo(
    () => isComplete && placed.every((c, i) => c.key === correctOrder[i]?.key),
    [isComplete, placed, correctOrder],
  );

  const handleTrayTap = (item: Chunk) => {
    if (submitted) return;
    setPlaced((prev) => [...prev, item]);
    setTray((prev) => prev.filter((t) => t.key !== item.key));
  };

  const handlePlacedTap = (index: number) => {
    if (submitted) return;
    const item = placed[index];
    setPlaced((prev) => prev.filter((_, i) => i !== index));
    setTray((prev) => [...prev, item]);
  };

  const handleSubmit = () => {
    if (!isComplete) return;
    setSubmitted(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    const nextRound = roundIndex + 1;
    if (nextRound >= ROUNDS_PER_STAGE) {
      await recordScore(gameKey, score);
      const progress = await completeCurrentStage(gameKey);
      setStageResult({ stagesCompleted: progress.stagesCompleted, isFinalStage: progress.stagesCompleted >= STAGES_PER_GAME });
      return;
    }
    setRoundIndex(nextRound);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${ROUNDS_PER_STAGE} correct this stage`}
            stagesCompleted={stageResult.stagesCompleted}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            onContinue={() => {
              setStageResult(null);
              setRoundIndex(0);
              setScore(0);
              getCurrentStageVerses(gameKey).then(setStageVerses);
            }}
            onViewStats={onOpenStats}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  if (!stageVerses || !currentRef || correctOrder.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`Round ${roundIndex + 1} of ${ROUNDS_PER_STAGE}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.reference, { color: palette.goldReadable }]}>{currentRef.bookName} {currentRef.chapter}:{currentRef.verse}</Text>
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap the pieces below to rebuild the verse in order.
        </Text>

        <View style={[styles.placedArea, { backgroundColor: palette.card }]}>
          {placed.length === 0 ? (
            <Text style={[styles.placeholder, { color: palette.subtext }]}>Tap a piece below to begin…</Text>
          ) : (
            <View style={styles.wordFlow}>
              {placed.map((item, index) => {
                const correctHere = submitted && item.key === correctOrder[index]?.key;
                const wrongHere = submitted && item.key !== correctOrder[index]?.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => handlePlacedTap(index)}
                    disabled={submitted}
                    style={[
                      styles.placedTile,
                      {
                        backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : palette.selectedBg,
                        borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                      },
                    ]}
                  >
                    <Text style={[styles.placedTileText, { color: palette.text }]}>{item.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct verse</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>
              {correctOrder.map((c) => c.text).join(' ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => handleTrayTap(item)}
              disabled={submitted}
              style={[styles.chip, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{item.text}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUNDS_PER_STAGE ? 'Finish Stage' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!isComplete}
            style={[styles.actionBtn, { backgroundColor: isComplete ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: isComplete ? palette.onGold : palette.subtext }]}>Check Verse</Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 14, paddingBottom: 16 },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  instructions: { fontSize: 13, fontWeight: '600', marginTop: -8 },
  placedArea: { borderRadius: 16, padding: 14, minHeight: 90 },
  placeholder: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 20 },
  wordFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  placedTile: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  placedTileText: { fontSize: 14, fontWeight: '700' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chipText: { fontSize: 13, fontWeight: '800' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
