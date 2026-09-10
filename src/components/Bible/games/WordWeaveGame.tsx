// src/components/Bible/games/WordWeaveGame.tsx
//
// Game 6 of 30: "Word Weave" — sentence reconstruction. A verse's words are
// shuffled into tappable tiles; the player taps them in order to rebuild
// the verse exactly. Tests verbatim word-order recall specifically — the
// closest of the original 6 games to the classic "say the memory verse back
// perfectly" skill, and deliberately not the same mechanic as Complete the
// Verse (which only ever tests 1-2 missing words, not the whole sentence).
//
// Same tap-to-place / tap-to-remove interaction as Books in Order
// (deliberately reused, not reinvented, for cross-game consistency) rather
// than drag-and-drop, for the same ScrollView-gesture-conflict reason.
//
// Only verses between 5 and 20 words are eligible — long enough to be a
// real reconstruction challenge, short enough that the tile tray doesn't
// overflow into an unplayable wall of words. Since verse content is now
// randomly assigned per stage, a narrow stage (e.g. deep in a genealogy of
// short "and X begat Y" verses) may not have a full ROUND_LENGTH's worth of
// eligible verses — the round simply plays with however many it finds,
// same graceful-degradation approach used by the other migrated games.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
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
const MIN_WORDS = 5;
const MAX_WORDS = 20;

type Tile = { key: string; word: string };

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function eligibleVerses(stageVerses: VerseRef[]): VerseRef[] {
  return stageVerses.filter((v) => {
    const n = tokenizeVerse(getVerseText(v.bookName, v.chapter, v.verse)).length;
    return n >= MIN_WORDS && n <= MAX_WORDS;
  });
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPuzzle(verse: VerseRef) {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const words = tokenizeVerse(text);
  const tiles: Tile[] = words.map((word, i) => ({ key: `${i}-${word}`, word }));
  return { words, tray: shuffle(tiles) };
}

export default function WordWeaveGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [order, setOrder] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [tray, setTray] = useState<Tile[]>([]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<{ stagesCompleted: number; isFinalStage: boolean } | null>(null);

  const loadRound = useCallback(async () => {
    const stageVerses = await getCurrentStageVerses(gameKey);
    const pool = eligibleVerses(stageVerses);
    setOrder(shuffle(pool).slice(0, ROUND_LENGTH));
    setRoundIndex(0);
    setScore(0);
  }, [gameKey]);

  useEffect(() => { loadRound(); }, [loadRound]);

  const setupRound = useCallback((verse: VerseRef) => {
    const { words, tray: newTray } = buildPuzzle(verse);
    setCorrectWords(words);
    setTray(newTray);
    setPlaced([]);
    setSubmitted(false);
  }, []);

  useEffect(() => {
    if (order && order[roundIndex]) setupRound(order[roundIndex]);
  }, [roundIndex, order, setupRound]);

  const currentVerse = order?.[roundIndex];

  const handleTrayTap = (tile: Tile) => {
    if (submitted) return;
    setPlaced((prev) => [...prev, tile]);
    setTray((prev) => prev.filter((t) => t.key !== tile.key));
  };

  const handlePlacedTap = (index: number) => {
    if (submitted) return;
    const tile = placed[index];
    setPlaced((prev) => prev.filter((_, i) => i !== index));
    setTray((prev) => [...prev, tile]);
  };

  const isComplete = placed.length === correctWords.length && correctWords.length > 0;
  const isCorrect = useMemo(
    () => isComplete && placed.every((t, i) => t.word === correctWords[i]),
    [isComplete, placed, correctWords],
  );

  const handleSubmit = () => {
    if (!isComplete) return;
    setSubmitted(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (!order) return;
    const nextIndex = roundIndex + 1;
    if (nextIndex >= order.length) {
      await recordScore(gameKey, score); // score already reflects this round's point, set by handleSubmit
      const progress = await completeCurrentStage(gameKey);
      setStageResult({ stagesCompleted: progress.stagesCompleted, isFinalStage: progress.stagesCompleted >= STAGES_PER_GAME });
      return;
    }
    setRoundIndex(nextIndex);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${order?.length ?? ROUND_LENGTH} correct this stage`}
            stagesCompleted={stageResult.stagesCompleted}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            onContinue={() => {
              setStageResult(null);
              loadRound();
            }}
            onViewStats={onOpenStats}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  if (!order || !currentVerse) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`Verse ${roundIndex + 1} of ${order.length}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(currentVerse)}</Text>
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap the words below to rebuild the verse in order.
        </Text>

        <View style={[styles.reconstructionArea, { backgroundColor: palette.card }]}>
          {placed.length === 0 ? (
            <Text style={[styles.placeholder, { color: palette.subtext }]}>Tap words below to begin…</Text>
          ) : (
            <View style={styles.wordFlow}>
              {placed.map((tile, index) => {
                const correctHere = submitted && tile.word === correctWords[index];
                const wrongHere = submitted && tile.word !== correctWords[index];
                return (
                  <Pressable
                    key={tile.key}
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
                    <Text style={[styles.placedTileText, { color: palette.text }]}>{tile.word}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct verse</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>{correctWords.join(' ')}</Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => handleTrayTap(tile)}
              disabled={submitted}
              style={[styles.chip, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{tile.word}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= order.length ? 'Finish Stage' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!isComplete}
            style={[styles.actionBtn, { backgroundColor: isComplete ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: isComplete ? palette.onGold : palette.subtext }]}>
              Check Verse
            </Text>
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
  reconstructionArea: { borderRadius: 16, padding: 14, minHeight: 90 },
  placeholder: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 20 },
  wordFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  placedTile: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  placedTileText: { fontSize: 15, fontWeight: '700' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 14, fontWeight: '800' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
