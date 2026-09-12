// src/components/Bible/games/WordSearchGame.tsx
//
// "Word Search" — one procedurally-generated letter grid per stage, built
// from words drawn out of that stage's own verses (see wordGrids.ts's
// generateWordSearch; this file only renders what it returns, never
// reimplements placement). One round per stage, not a fixed-length batch of
// rounds like the two audio games.
//
// Deliberately no drag gesture (RN ScrollView/PanResponder gesture conflict
// risk) — tap the first letter of a word, then its last letter, and the
// straight-line path between the two taps is checked against the grid's
// actual placements (geometry match, not just a string-equality check
// against the placement list, which also rules out a coincidental letter
// match against unrelated filler letters landing on a real word's text).

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText, normalizeWord, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import { generateWordSearch, type WordSearchGrid, type WordSearchDirection, type WordSearchPlacement } from '../../../screens/tabs/bible/games/wordGrids';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const GRID_SIZE = 10;
const MAX_CANDIDATE_WORDS = 10;
const SAMPLE_VERSES = 15;

const DIRECTION_DELTAS: Record<WordSearchDirection, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
  S: { dr: 1, dc: 0 },
  N: { dr: -1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  SW: { dr: 1, dc: -1 },
  NE: { dr: -1, dc: 1 },
  NW: { dr: -1, dc: -1 },
};

type Cell = { row: number; col: number };

function cellKey(c: Cell): string {
  return `${c.row},${c.col}`;
}

function cellsForPlacement(p: WordSearchPlacement): Cell[] {
  const { dr, dc } = DIRECTION_DELTAS[p.direction];
  return Array.from({ length: p.word.length }, (_, i) => ({ row: p.row + dr * i, col: p.col + dc * i }));
}

function sameCells(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((c, i) => c.row === b[i].row && c.col === b[i].col);
}

/** The straight-line path of cells between two taps, IF they align to one of
 * the 8 word-search directions exactly (same row, same column, or an equal
 * row/col delta for a diagonal) — null otherwise, meaning the two taps don't
 * describe a valid line at all. */
function computePath(first: Cell, second: Cell): Cell[] | null {
  const dr = second.row - first.row;
  const dc = second.col - first.col;
  if (dr === 0 && dc === 0) return null;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (!(dr === 0 || dc === 0 || adr === adc)) return null;
  const steps = Math.max(adr, adc);
  const unitDr = dr === 0 ? 0 : dr / adr;
  const unitDc = dc === 0 ? 0 : dc / adc;
  return Array.from({ length: steps + 1 }, (_, i) => ({ row: first.row + unitDr * i, col: first.col + unitDc * i }));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Candidate words for the grid, gathered from a sample of the stage's own
 * verses — never a curated list, so this holds up on any random slice of
 * the Bible. Prefers longer words (more satisfying to find) but keeps a mix
 * of shorter ones too, rather than excluding them outright. */
function gatherCandidateWords(stageVerses: VerseRef[]): string[] {
  const sample = stageVerses.slice(0, SAMPLE_VERSES);
  const seen = new Set<string>();
  const long: string[] = [];
  const short: string[] = [];
  for (const v of sample) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    for (const raw of tokenizeVerse(text)) {
      const w = normalizeWord(raw);
      if (w.length < 3 || w.length > 10 || seen.has(w)) continue;
      seen.add(w);
      (w.length >= 6 ? long : short).push(w);
    }
  }
  const longShuffled = shuffle(long);
  const shortShuffled = shuffle(short);
  const chosen: string[] = [];
  let li = 0;
  let si = 0;
  while (chosen.length < MAX_CANDIDATE_WORDS && (li < longShuffled.length || si < shortShuffled.length)) {
    const wantLong = chosen.length % 3 !== 2; // roughly 2 long : 1 short
    if (wantLong && li < longShuffled.length) chosen.push(longShuffled[li++]);
    else if (si < shortShuffled.length) chosen.push(shortShuffled[si++]);
    else if (li < longShuffled.length) chosen.push(longShuffled[li++]);
  }
  return chosen;
}

export default function WordSearchGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const meta = GAME_METADATA[gameKey];

  const [grid, setGrid] = useState<WordSearchGrid | null>(null);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [foundCellKeys, setFoundCellKeys] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Cell[]>([]);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const words = gatherCandidateWords(verses);
      setGrid(generateWordSearch(words, { size: GRID_SIZE }));
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  const totalWords = grid?.placements.length ?? 0;

  const finishRound = async (score: number) => {
    if (finished) return;
    setFinished(true);
    const outcome = await finishStage(gameKey, stageIndex, score);
    setStageResult(outcome);
  };

  const flashInvalid = (cells: Cell[]) => {
    setFlashKeys(new Set(cells.map(cellKey)));
    setSelected([]);
    setTimeout(() => setFlashKeys(new Set()), 400);
  };

  const handleCellPress = (row: number, col: number) => {
    if (!grid || finished) return;
    if (foundCellKeys.has(cellKey({ row, col }))) return;

    if (selected.length === 0) {
      setSelected([{ row, col }]);
      return;
    }
    const first = selected[0];
    if (first.row === row && first.col === col) {
      setSelected([]); // tapped the same cell twice — cancel
      return;
    }

    const path = computePath(first, { row, col });
    if (!path) {
      flashInvalid([first, { row, col }]);
      return;
    }
    const reversed = [...path].reverse();
    const match = grid.placements.find(
      (p) => !foundWords.has(p.word) && (sameCells(cellsForPlacement(p), path) || sameCells(cellsForPlacement(p), reversed)),
    );
    if (match) {
      const nextFound = new Set(foundWords).add(match.word);
      setFoundWords(nextFound);
      setFoundCellKeys((prev) => {
        const next = new Set(prev);
        path.forEach((c) => next.add(cellKey(c)));
        return next;
      });
      setSelected([]);
      if (nextFound.size === totalWords) finishRound(nextFound.size);
    } else {
      flashInvalid(path);
    }
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${foundWords.size} / ${totalWords} words found`}
            stageNumber={stageIndex + 1}
            totalStages={STAGES_PER_GAME}
            isFinalStage={stageResult.isFinalStage}
            isReplay={!stageResult.isNewCompletion}
            onPlayAgain={() => {
              setStageResult(null);
              setFinished(false);
              setFoundWords(new Set());
              setFoundCellKeys(new Set());
              setSelected([]);
              getStageVerses(gameKey, stageIndex).then((verses) => {
                const words = gatherCandidateWords(verses);
                setGrid(generateWordSearch(words, { size: GRID_SIZE }));
              });
            }}
            onBackToJourney={onExit}
            onViewStats={onOpenStats}
          />
        </View>
      </GameShell>
    );
  }

  if (!grid) {
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
            <KISIcon name="search" size={32} color={palette.subtext} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No puzzle this time</Text>
            <Text style={[styles.emptyBody, { color: palette.subtext }]}>
              This stage's passage didn't have enough word variety to build a word search. Try another stage.
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
  const cellSize = gridWidth / grid.size;

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Find all ${totalWords} words`}
      onBack={onExit}
      rightStat={{ label: 'Found', value: `${foundWords.size}/${totalWords}` }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.gridWrap, { width: gridWidth }]}>
          {grid.letters.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((letter, c) => {
                const key = cellKey({ row: r, col: c });
                const isFound = foundCellKeys.has(key);
                const isFlash = flashKeys.has(key);
                const isSelected = selected.some((s) => s.row === r && s.col === c);
                return (
                  <Pressable
                    key={c}
                    onPress={() => handleCellPress(r, c)}
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: isFound
                          ? '#16a34a30'
                          : isFlash
                            ? '#dc262640'
                            : isSelected
                              ? palette.selectedBg
                              : palette.card,
                        borderColor: isFound ? '#16a34a' : isSelected ? palette.goldReadable : palette.selectedBg,
                      },
                    ]}
                  >
                    <Text style={[styles.cellText, { color: isFound ? '#16a34a' : palette.text, fontSize: cellSize * 0.42 }]}>
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.wordList}>
          {grid.placements.map((p) => {
            const found = foundWords.has(p.word);
            return (
              <View
                key={p.word}
                style={[styles.wordChip, { backgroundColor: found ? '#16a34a20' : palette.selectedBg, borderColor: found ? '#16a34a' : palette.goldReadable }]}
              >
                {found ? <KISIcon name="checkmark-circle" size={14} color="#16a34a" /> : null}
                <Text
                  style={[
                    styles.wordChipText,
                    { color: found ? '#16a34a' : palette.text, textDecorationLine: found ? 'line-through' : 'none' },
                  ]}
                >
                  {p.word}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => finishRound(foundWords.size)}
          style={[styles.finishBtn, { borderColor: palette.selectedBg }]}
        >
          <Text style={[styles.finishBtnText, { color: palette.text }]}>
            {foundWords.size === totalWords ? 'Finish' : 'Give Up / Finish Early'}
          </Text>
        </Pressable>
      </ScrollView>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 24, alignItems: 'center' },
  gridWrap: { gap: 0 },
  gridRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cellText: { fontWeight: '800' },
  wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  wordChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  wordChipText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  finishBtn: { alignSelf: 'stretch', borderRadius: 999, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center' },
  finishBtnText: { fontSize: 14, fontWeight: '800' },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, maxWidth: 320 },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: '900' },
});
