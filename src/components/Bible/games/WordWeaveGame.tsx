// src/components/Bible/games/WordWeaveGame.tsx
//
// Game 6 of 6: "Word Weave" — sentence reconstruction. A verse's words are
// shuffled into tappable tiles; the player taps them in order to rebuild
// the verse exactly. Tests verbatim word-order recall specifically — the
// closest of the 6 games to the classic "say the memory verse back
// perfectly" skill, and deliberately not the same mechanic as Complete the
// Verse (which only ever tests 1-2 missing words, not the whole sentence).
//
// Same tap-to-place / tap-to-remove interaction as Books in Order
// (deliberately reused, not reinvented, for cross-game consistency) rather
// than drag-and-drop, for the same ScrollView-gesture-conflict reason.
//
// Only curated verses between 5 and 20 words are eligible — long enough to
// be a real reconstruction challenge, short enough that the tile tray
// doesn't overflow into an unplayable wall of words.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { RoundComplete } from './GameFeedback';
import { CURATED_VERSES, type CuratedVerseRef } from '../../../screens/tabs/bible/games/curatedVerses';
import { getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import { recordScore } from '../../../screens/tabs/bible/games/gameStorage';

const ROUND_LENGTH = 8;
const MIN_WORDS = 5;
const MAX_WORDS = 20;

type Tile = { key: string; word: string };

function eligibleVerses(): CuratedVerseRef[] {
  return CURATED_VERSES.filter((v) => {
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

function buildPuzzle(verse: CuratedVerseRef) {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const words = tokenizeVerse(text);
  const tiles: Tile[] = words.map((word, i) => ({ key: `${i}-${word}`, word }));
  return { words, tray: shuffle(tiles) };
}

export default function WordWeaveGame({ onExit }: { onExit: () => void }) {
  const { palette } = useKISTheme();
  const pool = useMemo(() => eligibleVerses(), []);
  const [order, setOrder] = useState<CuratedVerseRef[]>(() => shuffle(pool).slice(0, ROUND_LENGTH));
  const [roundIndex, setRoundIndex] = useState(0);
  const [tray, setTray] = useState<Tile[]>([]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const setupRound = useCallback((verse: CuratedVerseRef) => {
    const { words, tray: newTray } = buildPuzzle(verse);
    setCorrectWords(words);
    setTray(newTray);
    setPlaced([]);
    setSubmitted(false);
  }, []);

  React.useEffect(() => {
    if (order[roundIndex]) setupRound(order[roundIndex]);
  }, [roundIndex, order, setupRound]);

  const currentVerse = order[roundIndex];

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

  const handleNext = () => {
    const nextIndex = roundIndex + 1;
    if (nextIndex >= order.length) {
      setFinished(true);
      recordScore('word-weave', score); // score already reflects this round's point, set by handleSubmit
      return;
    }
    setRoundIndex(nextIndex);
  };

  const handlePlayAgain = () => {
    setOrder(shuffle(pool).slice(0, ROUND_LENGTH));
    setRoundIndex(0);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <GameShell title="Word Weave" onBack={onExit}>
        <View style={styles.centerFill}>
          <RoundComplete
            title={score === ROUND_LENGTH ? 'Perfect round!' : 'Round complete'}
            scoreLine={`${score} / ${ROUND_LENGTH} correct`}
            onPlayAgain={handlePlayAgain}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  if (!currentVerse) {
    return (
      <GameShell title="Word Weave" onBack={onExit}>
        <View style={styles.centerFill} />
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Word Weave"
      subtitle={`Verse ${roundIndex + 1} of ${order.length}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.reference, { color: palette.goldReadable }]}>{currentVerse.reference}</Text>
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
              {roundIndex + 1 >= order.length ? 'See Results' : 'Next Verse'}
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
