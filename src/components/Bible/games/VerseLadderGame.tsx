// src/components/Bible/games/VerseLadderGame.tsx
//
// "Verse Ladder" — up to 8 "rungs" sampled from the stage's own verses,
// sorted by word count and spread across evenly-spaced percentile
// positions so the ladder genuinely climbs from short to long. Each rung
// reuses the exact verbatim word-order reconstruction mechanic
// WordWeaveGame.tsx implements (shuffled word tiles, tapped in order to
// rebuild the verse exactly) — reimplemented directly here rather than
// imported, since the ladder framing (rung N of however many, difficulty
// climbing with each one) is what makes this game distinct, not the
// underlying tile mechanic itself.
//
// Score is rungs successfully cleared, out of however many rungs the
// stage could produce (fewer than 8 only when the stage itself has fewer
// than 8 distinct verses — never a broken empty state).

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const MAX_RUNGS = 8;

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

/** Up to MAX_RUNGS verses spanning short-to-long, sampled at evenly-spaced
 * percentile positions through the stage's verses sorted by word count -
 * the whole reason this game feels like a "ladder" rather than a random
 * shuffle of same-difficulty rounds. */
function pickRungs(stageVerses: VerseRef[]): VerseRef[] {
  const withCounts = stageVerses
    .map((v) => ({ v, wc: tokenizeVerse(getVerseText(v.bookName, v.chapter, v.verse)).length }))
    .filter((x) => x.wc > 0)
    .sort((a, b) => a.wc - b.wc);
  if (!withCounts.length) return [];

  const n = Math.min(MAX_RUNGS, withCounts.length);
  const usedIdx = new Set<number>();
  const rungs: VerseRef[] = [];
  for (let i = 0; i < n; i++) {
    const pct = n === 1 ? 0 : i / (n - 1);
    let idx = Math.round(pct * (withCounts.length - 1));
    while (usedIdx.has(idx) && idx < withCounts.length - 1) idx++;
    while (usedIdx.has(idx) && idx > 0) idx--;
    usedIdx.add(idx);
    rungs.push(withCounts[idx].v);
  }
  return rungs;
}

type Tile = { id: string; text: string };

type Rung = {
  verse: VerseRef;
  tokens: string[]; // exact, in order - the target sequence
  tray: Tile[];
};

function buildRung(verse: VerseRef): Rung {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  const tray = shuffle(tokens.map((t, i) => ({ id: `t${i}`, text: t })));
  return { verse, tokens, tray };
}

export default function VerseLadderGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [rungs, setRungs] = useState<VerseRef[] | null>(null);
  const [rungIndex, setRungIndex] = useState(0);
  const [rung, setRung] = useState<Rung | null>(null);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [tray, setTray] = useState<Tile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [rungsCleared, setRungsCleared] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const r = pickRungs(verses);
      setRungs(r);
      if (!r.length) {
        finishStage(gameKey, stageIndex, 0).then((outcome) => {
          if (active) setStageResult(outcome);
        });
      }
    });
    return () => {
      active = false;
    };
  }, [gameKey, stageIndex]);

  useEffect(() => {
    if (!rungs || !rungs.length || rung || rungIndex >= rungs.length) return;
    const next = buildRung(rungs[rungIndex]);
    setRung(next);
    setPlaced([]);
    setTray(next.tray);
    setSubmitted(false);
  }, [rungs, rungIndex, rung]);

  const totalRungs = rungs?.length ?? 0;
  const isComplete = rung !== null && placed.length === rung.tokens.length;
  const isCorrect = useMemo(
    () => rung !== null && isComplete && placed.every((t, i) => t.text === rung.tokens[i]),
    [rung, isComplete, placed],
  );

  const handleTrayTap = (item: Tile) => {
    if (submitted) return;
    setPlaced((prev) => [...prev, item]);
    setTray((prev) => prev.filter((t) => t.id !== item.id));
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
    if (isCorrect) setRungsCleared((c) => c + 1);
  };

  const handleNext = async () => {
    const nextIndex = rungIndex + 1;
    if (nextIndex >= totalRungs) {
      const outcome = await finishStage(gameKey, stageIndex, rungsCleared);
      setStageResult(outcome);
      return;
    }
    setRungIndex(nextIndex);
    setRung(null);
  };

  const resetGame = () => {
    setStageResult(null);
    setRungIndex(0);
    setRungsCleared(0);
    setRung(null);
    getStageVerses(gameKey, stageIndex).then((verses) => setRungs(pickRungs(verses)));
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${rungsCleared} / ${totalRungs} rungs cleared`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={resetGame}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!rung) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Rung ${rungIndex + 1} of ${totalRungs}`}
      onBack={onExit}
      rightStat={{ label: 'Cleared', value: rungsCleared }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap the words below in order to rebuild this verse exactly.
        </Text>

        <View style={[styles.placedRow, { backgroundColor: palette.card }]}>
          <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(rung.verse)}</Text>
          <View style={styles.placedWrap}>
            {rung.tokens.map((_, index) => {
              const item = placed[index];
              const correctHere = submitted && item && item.text === rung.tokens[index];
              const wrongHere = submitted && item && item.text !== rung.tokens[index];
              return (
                <Pressable
                  key={index}
                  onPress={() => handlePlacedTap(index)}
                  disabled={submitted || !item}
                  style={[
                    styles.slot,
                    {
                      backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : palette.selectedBg,
                      borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                    },
                  ]}
                >
                  <Text style={[styles.slotText, { color: item ? palette.text : palette.subtext }]}>
                    {item ? item.text : '__'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct verse</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>{rung.tokens.join(' ')}</Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((item) => (
            <Pressable
              key={item.id}
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
              {rungIndex + 1 >= totalRungs ? 'See Results' : 'Next Rung'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!isComplete}
            style={[styles.actionBtn, { backgroundColor: isComplete ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: isComplete ? palette.onGold : palette.subtext }]}>
              Check Order
            </Text>
          </Pressable>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 16 },
  instructions: { fontSize: 13, fontWeight: '600' },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  placedRow: { borderRadius: 16, padding: 14, gap: 6 },
  placedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 36,
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { fontSize: 15, fontWeight: '700' },

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
