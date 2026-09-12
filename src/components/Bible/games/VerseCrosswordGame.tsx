// src/components/Bible/games/VerseCrosswordGame.tsx
//
// "Verse Crossword" — a small crossword built entirely from words pulled out
// of the stage's own verses (see wordGrids.ts's generateCrossword; this file
// only renders what it returns). Each clue is an honest "Appears in Book
// c:v" reference back to where the word came from — there's no curated
// definitional-clue bank that could cover an arbitrary passage, so the
// reference IS the clue.
//
// One grid per stage (not a fixed-length round batch). Tapping a clue opens
// a tap-to-fill letter bank for just that word — CompleteVerseGame.tsx's
// exact tap-to-place-into-blanks interaction, applied per clue instead of
// per round, with each clue's bank scoped to that word's own shuffled
// letters (simplest correct approach when words can share overlapping
// cells).

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import { generateCrossword, type CrosswordGrid, type CrosswordPlacement } from '../../../screens/tabs/bible/games/wordGrids';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const MAX_WORDS = 6;
const SAMPLE_VERSES = 15;
const MAX_CANDIDATES = 15;
const MIN_WORD_LENGTH = 4;

type Cell = { row: number; col: number };

function cellsForPlacement(p: CrosswordPlacement): Cell[] {
  return Array.from({ length: p.word.length }, (_, i) => ({
    row: p.direction === 'down' ? p.row + i : p.row,
    col: p.direction === 'across' ? p.col + i : p.col,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Candidate {word, clue} entries gathered from a sample of the stage's own
 * verses — never a curated list. The clue is the honest, always-available
 * reference the word came from. */
function gatherEntries(stageVerses: VerseRef[]): { word: string; clue: string }[] {
  const sample = stageVerses.slice(0, SAMPLE_VERSES);
  const seen = new Set<string>();
  const entries: { word: string; clue: string }[] = [];
  for (const v of sample) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    for (const raw of tokenizeVerse(text)) {
      const w = normalizeWord(raw);
      if (w.length < MIN_WORD_LENGTH || seen.has(w)) continue;
      seen.add(w);
      entries.push({ word: w, clue: `Appears in ${v.bookName} ${v.chapter}:${v.verse}` });
    }
  }
  return entries.sort((a, b) => b.word.length - a.word.length).slice(0, MAX_CANDIDATES);
}

type CellInfo = {
  letter: string;
  number?: number;
  entries: { placementIndex: number; letterIndex: number }[];
};

function buildCellMap(grid: CrosswordGrid): Map<string, CellInfo> {
  const map = new Map<string, CellInfo>();
  grid.placements.forEach((p, placementIndex) => {
    cellsForPlacement(p).forEach((c, letterIndex) => {
      const key = `${c.row},${c.col}`;
      const existing = map.get(key);
      if (existing) {
        existing.entries.push({ placementIndex, letterIndex });
      } else {
        map.set(key, { letter: p.word[letterIndex], entries: [{ placementIndex, letterIndex }] });
      }
    });
  });
  // Number the first cell of each distinct placement start, in reading order.
  const starts = Array.from(new Set(grid.placements.map((p) => `${p.row},${p.col}`)))
    .map((k) => k.split(',').map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  starts.forEach(([r, c], i) => {
    const info = map.get(`${r},${c}`);
    if (info) info.number = i + 1;
  });
  return map;
}

type PlacementState = {
  filled: (string | null)[];
  usedBankIdx: Set<number>;
  solved: boolean;
};

export default function VerseCrosswordGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const meta = GAME_METADATA[gameKey];

  const [grid, setGrid] = useState<CrosswordGrid | null>(null);
  const [cellMap, setCellMap] = useState<Map<string, CellInfo> | null>(null);
  const [bankLetters, setBankLetters] = useState<string[][]>([]);
  const [states, setStates] = useState<PlacementState[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  const loadFreshGrid = (verses: VerseRef[]) => {
    const entries = gatherEntries(verses);
    const nextGrid = generateCrossword(entries, { maxWords: MAX_WORDS });
    setGrid(nextGrid);
    setCellMap(buildCellMap(nextGrid));
    setBankLetters(nextGrid.placements.map((p) => shuffle(p.word.split(''))));
    setStates(nextGrid.placements.map((p) => ({ filled: new Array(p.word.length).fill(null), usedBankIdx: new Set(), solved: false })));
    setActiveIndex(null);
  };

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      loadFreshGrid(verses);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey, stageIndex]);

  const totalWords = grid?.placements.length ?? 0;
  const solvedCount = states.filter((s) => s.solved).length;

  const finishRound = async (score: number) => {
    if (finished) return;
    setFinished(true);
    const outcome = await finishStage(gameKey, stageIndex, score);
    setStageResult(outcome);
  };

  const handleClueTap = (index: number) => {
    if (states[index]?.solved) return;
    setActiveIndex((prev) => (prev === index ? null : index));
  };

  const handleBankTap = (letterIndex: number) => {
    if (activeIndex === null || !grid) return;
    const placement = grid.placements[activeIndex];
    const state = states[activeIndex];
    if (!placement || !state || state.solved) return;
    if (state.usedBankIdx.has(letterIndex)) return;
    const nextEmpty = state.filled.findIndex((f) => f === null);
    if (nextEmpty === -1) return;

    const letter = bankLetters[activeIndex][letterIndex];
    const nextFilled = [...state.filled];
    nextFilled[nextEmpty] = letter;
    const nextUsed = new Set(state.usedBankIdx).add(letterIndex);

    const allFilled = nextFilled.every((f) => f !== null);
    const isCorrect = allFilled && nextFilled.join('') === placement.word;

    const nextStates = [...states];
    nextStates[activeIndex] = { filled: nextFilled, usedBankIdx: nextUsed, solved: isCorrect };
    setStates(nextStates);

    if (isCorrect) {
      const solved = nextStates.filter((s) => s.solved).length;
      setActiveIndex(null);
      if (solved === totalWords) finishRound(solved);
    }
  };

  const handleClearSlot = (placementIndex: number, slotIndex: number) => {
    const state = states[placementIndex];
    if (!state || state.solved) return;
    const value = state.filled[slotIndex];
    if (value === null) return;
    const nextFilled = [...state.filled];
    nextFilled[slotIndex] = null;
    // Free the bank tile that produced this letter — first used tile with a matching letter.
    const bank = bankLetters[placementIndex];
    let freedIdx: number | null = null;
    for (const idx of state.usedBankIdx) {
      if (bank[idx] === value) { freedIdx = idx; break; }
    }
    const nextUsed = new Set(state.usedBankIdx);
    if (freedIdx !== null) nextUsed.delete(freedIdx);
    const nextStates = [...states];
    nextStates[placementIndex] = { filled: nextFilled, usedBankIdx: nextUsed, solved: false };
    setStates(nextStates);
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${solvedCount} / ${totalWords} words solved`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setFinished(false);
              getStageVerses(gameKey, stageIndex).then(loadFreshGrid);
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!grid || !cellMap) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (grid.placements.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.emptyCard, { backgroundColor: palette.card }]}>
            <KISIcon name="grid" size={32} color={palette.subtext} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No puzzle this time</Text>
            <Text style={[styles.emptyBody, { color: palette.subtext }]}>
              This stage's passage didn't have enough word variety to build a crossword. Try another stage.
            </Text>
            <Pressable onPress={onExit} style={[styles.emptyBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.emptyBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  const gridWidth = Math.min(responsive.contentMaxWidth - responsive.pageGutter * 2, 380);
  const cellSize = Math.min(gridWidth / grid.cols, 40);

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}${solvedCount}/${totalWords} solved`}
      onBack={onExit}
      rightStat={{ label: 'Solved', value: `${solvedCount}/${totalWords}` }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.gridWrap}>
          {Array.from({ length: grid.rows }, (_, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: grid.cols }, (_, c) => {
                const info = cellMap.get(`${r},${c}`);
                if (!info) return <View key={c} style={{ width: cellSize, height: cellSize }} />;
                const activeEntry = activeIndex !== null ? info.entries.find((e) => e.placementIndex === activeIndex) : undefined;
                let displayLetter: string | null = null;
                for (const e of info.entries) {
                  const v = states[e.placementIndex]?.filled[e.letterIndex];
                  if (v) { displayLetter = v; break; }
                }
                const isSolvedCell = info.entries.some((e) => states[e.placementIndex]?.solved);
                return (
                  <Pressable
                    key={c}
                    disabled={!activeEntry}
                    onPress={() => activeEntry && handleClearSlot(activeEntry.placementIndex, activeEntry.letterIndex)}
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: isSolvedCell ? '#16a34a25' : activeEntry ? palette.selectedBg : palette.card,
                        borderColor: isSolvedCell ? '#16a34a' : activeEntry ? palette.goldReadable : palette.selectedBg,
                      },
                    ]}
                  >
                    {info.number ? (
                      <Text style={[styles.cellNumber, { color: palette.subtext }]}>{info.number}</Text>
                    ) : null}
                    <Text style={[styles.cellLetter, { color: isSolvedCell ? '#16a34a' : palette.text, fontSize: cellSize * 0.42 }]}>
                      {displayLetter ?? ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.clueList}>
          {grid.placements.map((p, index) => {
            const info = cellMap.get(`${p.row},${p.col}`);
            const state = states[index];
            const isActive = activeIndex === index;
            return (
              <Pressable
                key={p.word}
                onPress={() => handleClueTap(index)}
                disabled={state?.solved}
                style={[
                  styles.clueRow,
                  {
                    backgroundColor: state?.solved ? '#16a34a15' : isActive ? palette.selectedBg : 'transparent',
                    borderColor: state?.solved ? '#16a34a' : isActive ? palette.goldReadable : palette.selectedBg,
                  },
                ]}
              >
                <Text style={[styles.clueNumber, { color: palette.goldReadable }]}>{info?.number ?? index + 1}.</Text>
                <Text style={[styles.clueText, { color: palette.text }]} numberOfLines={2}>
                  {p.clue} ({p.direction}, {p.word.length} letters)
                </Text>
                {state?.solved ? <KISIcon name="checkmark-circle" size={16} color="#16a34a" /> : null}
              </Pressable>
            );
          })}
        </View>

        {activeIndex !== null && !states[activeIndex]?.solved ? (
          <View style={[styles.bankCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.bankLabel, { color: palette.subtext }]}>Tap letters in order to fill the word above</Text>
            <View style={styles.wordBank}>
              {bankLetters[activeIndex].map((letter, idx) => {
                const used = states[activeIndex].usedBankIdx.has(idx);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleBankTap(idx)}
                    disabled={used}
                    style={[
                      styles.chip,
                      { backgroundColor: used ? palette.bg : palette.selectedBg, borderColor: palette.goldReadable, opacity: used ? 0.35 : 1 },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: palette.text }]}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 24 },
  gridWrap: { alignSelf: 'center' },
  gridRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cellNumber: { position: 'absolute', top: 1, left: 2, fontSize: 8, fontWeight: '800' },
  cellLetter: { fontWeight: '800' },
  clueList: { gap: 8 },
  clueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  clueNumber: { fontSize: 13, fontWeight: '900' },
  clueText: { flex: 1, fontSize: 13, fontWeight: '600' },
  bankCard: { borderRadius: 16, padding: 16, gap: 10 },
  bankLabel: { fontSize: 12, fontWeight: '700' },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontSize: 15, fontWeight: '800' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, maxWidth: 320 },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: '900' },
});
