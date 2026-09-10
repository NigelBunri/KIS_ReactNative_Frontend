// src/components/Bible/games/SequenceChainGame.tsx
//
// Game 18 of 30: "Sequence Chain" — reorder a short run of consecutive
// verses back into their real Bible order. Deliberately structural (does
// this verse come before or after that one?), not "do you recognize this
// famous quote" — it works exactly as well on a genealogy or a legal list
// as it does on a Psalm, which matters here specifically: every game's
// verse content is randomly assigned by versePartition.ts and reshuffled
// on every reset, so a mechanic that only worked on well-known passages
// would break the first time it drew a chapter of "these are the
// generations of...". Same tap-to-place / tap-to-remove interaction as
// Word Weave and Books in Order (reused, not reinvented, for cross-game
// consistency) rather than drag-and-drop.
//
// Reads its verses from the stage/partition system (gameStorage.ts), not
// curatedVerses.ts - this is one of the first 3 new games proving that
// pipeline end-to-end.

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

const ROUNDS_PER_STAGE = 5;
const CHAIN_LENGTH = 4; // verses per round - long enough to be a real ordering puzzle, short enough to fit on screen

type ChainVerse = { key: string; ref: VerseRef; shortText: string };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shortenText(text: string): string {
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function buildRound(stageVerses: VerseRef[]): { correctOrder: ChainVerse[]; tray: ChainVerse[] } | null {
  if (stageVerses.length < 2) return null;
  const length = Math.min(CHAIN_LENGTH, stageVerses.length);
  const maxStart = stageVerses.length - length;
  const start = Math.floor(Math.random() * (maxStart + 1));
  const window = stageVerses.slice(start, start + length);
  const correctOrder: ChainVerse[] = window.map((ref, i) => ({
    key: `${ref.bookName}-${ref.chapter}-${ref.verse}-${i}`,
    ref,
    shortText: shortenText(getVerseText(ref.bookName, ref.chapter, ref.verse)),
  }));
  return { correctOrder, tray: shuffle(correctOrder) };
}

export default function SequenceChainGame({ gameKey, onExit, onOpenStats }: { gameKey: GameKey; onExit: () => void; onOpenStats: () => void }) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [stageVerses, setStageVerses] = useState<VerseRef[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [correctOrder, setCorrectOrder] = useState<ChainVerse[]>([]);
  const [tray, setTray] = useState<ChainVerse[]>([]);
  const [placed, setPlaced] = useState<ChainVerse[]>([]);
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
    () => isComplete && placed.every((v, i) => v.key === correctOrder[i]?.key),
    [isComplete, placed, correctOrder],
  );

  const handleTrayTap = (item: ChainVerse) => {
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
      await recordScore(gameKey, score); // score already reflects this round's point, set by handleSubmit
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

  if (!stageVerses || correctOrder.length === 0) {
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
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap the verses below to put them back in the order they appear in the Bible.
        </Text>

        <View style={[styles.placedArea, { backgroundColor: palette.card }]}>
          {placed.length === 0 ? (
            <Text style={[styles.placeholder, { color: palette.subtext }]}>Tap a verse below to begin…</Text>
          ) : (
            placed.map((item, index) => {
              const correctHere = submitted && item.key === correctOrder[index]?.key;
              const wrongHere = submitted && item.key !== correctOrder[index]?.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handlePlacedTap(index)}
                  disabled={submitted}
                  style={[
                    styles.placedRow,
                    {
                      backgroundColor: correctHere ? '#16a34a20' : wrongHere ? '#dc262620' : palette.selectedBg,
                      borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.placedIndex, { color: palette.subtext }]}>{index + 1}</Text>
                  <Text style={[styles.placedText, { color: palette.text }]} numberOfLines={2}>{item.shortText}</Text>
                </Pressable>
              );
            })
          )}
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct order</Text>
            {correctOrder.map((v, i) => (
              <Text key={v.key} style={{ color: palette.text, fontSize: 13, fontWeight: '700' }} numberOfLines={2}>
                {i + 1}. {v.shortText}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.trayStack}>
          {tray.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => handleTrayTap(item)}
              disabled={submitted}
              style={[styles.trayRow, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.trayText, { color: palette.text }]} numberOfLines={2}>{item.shortText}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {roundIndex + 1 >= ROUNDS_PER_STAGE ? 'Finish Stage' : 'Next Round'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!isComplete}
            style={[styles.actionBtn, { backgroundColor: isComplete ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: isComplete ? palette.onGold : palette.subtext }]}>Check Order</Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 14, paddingBottom: 16 },
  instructions: { fontSize: 13, fontWeight: '600' },
  placedArea: { borderRadius: 16, padding: 12, minHeight: 90, gap: 8 },
  placeholder: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 20 },
  placedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 10 },
  placedIndex: { fontSize: 13, fontWeight: '900', width: 18 },
  placedText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 6 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },

  trayStack: { gap: 8 },
  trayRow: { borderWidth: 1.5, borderRadius: 10, padding: 10 },
  trayText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
