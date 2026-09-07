// src/components/Bible/games/BooksInOrderGame.tsx
//
// Game 2 of 6: "Books in Order" — sequencing. A run of consecutive books
// from the 66-book canon is shuffled; the player taps them back into
// correct order. Tap-to-place rather than drag-and-drop, deliberately: this
// screen renders inside the same scroll container the rest of the app uses,
// and a PanResponder-based drag list fighting a ScrollView for the same
// touch is a real, well-known RN gesture conflict — tap-to-place gets the
// same "reconstruct the sequence" mechanic without that risk.
//
// A random *contiguous* slice of the canon (not the whole 66 at once) keeps
// each round approachable and replayable, and still teaches real,
// consecutive book order — which is what actually matters for navigating
// the Bible, more than being able to recite all 66 in one unbroken breath.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { RoundComplete } from './GameFeedback';
import { LOCAL_BIBLE_BOOKS } from '@/data/bibleLocalData';
import { recordScore } from '../../../screens/tabs/bible/games/gameStorage';

type Difficulty = { label: string; length: number };
const DIFFICULTIES: Difficulty[] = [
  { label: 'Easy · 5 books', length: 5 },
  { label: 'Medium · 8 books', length: 8 },
  { label: 'Hard · 12 books', length: 12 },
];

type BookItem = { code: string; name: string };

function pickSequence(length: number): BookItem[] {
  const maxStart = LOCAL_BIBLE_BOOKS.length - length;
  const start = Math.floor(Math.random() * (maxStart + 1));
  return LOCAL_BIBLE_BOOKS.slice(start, start + length).map((b) => ({ code: b.code, name: b.name }));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function BooksInOrderGame({ onExit }: { onExit: () => void }) {
  const { palette } = useKISTheme();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [correctOrder, setCorrectOrder] = useState<BookItem[]>([]);
  const [tray, setTray] = useState<BookItem[]>([]);
  const [placed, setPlaced] = useState<BookItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);

  const startRound = useCallback((diff: Difficulty) => {
    const seq = pickSequence(diff.length);
    setCorrectOrder(seq);
    setTray(shuffle(seq));
    setPlaced([]);
    setSubmitted(false);
    setDifficulty(diff);
  }, []);

  const handleTrayTap = (item: BookItem) => {
    if (submitted) return;
    setPlaced((prev) => [...prev, item]);
    setTray((prev) => prev.filter((b) => b.code !== item.code));
  };

  const handlePlacedTap = (index: number) => {
    if (submitted) return;
    const item = placed[index];
    setPlaced((prev) => prev.filter((_, i) => i !== index));
    setTray((prev) => [...prev, item]);
  };

  const isComplete = difficulty ? placed.length === difficulty.length : false;
  const isAllCorrect = useMemo(
    () => isComplete && placed.every((b, i) => b.code === correctOrder[i]?.code),
    [isComplete, placed, correctOrder],
  );

  const handleSubmit = () => {
    if (!isComplete) return;
    setSubmitted(true);
    setRounds((r) => r + 1);
    if (isAllCorrect) setCorrectRounds((c) => c + 1);
  };

  const handleNextRound = () => {
    if (difficulty) startRound(difficulty);
  };

  const handleFinishSession = () => {
    recordScore('books-in-order', correctRounds);
    setDifficulty(null);
  };

  // ── Difficulty picker ──────────────────────────────────────────────────
  if (!difficulty) {
    const sessionSummary = rounds > 0 ? `Last session: ${correctRounds}/${rounds} correct` : null;
    return (
      <GameShell title="Books in Order" subtitle="Pick a difficulty" onBack={onExit}>
        <View style={styles.pickerWrap}>
          {sessionSummary ? (
            <RoundComplete
              title="Nice work!"
              scoreLine={sessionSummary}
              onPlayAgain={() => setRounds(0)}
              onExit={onExit}
            />
          ) : null}
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d.label}
              onPress={() => startRound(d)}
              style={[styles.difficultyCard, { backgroundColor: palette.card, borderColor: palette.goldReadable }]}
            >
              <KISIcon name="layers" size={22} color={palette.goldReadable} />
              <Text style={[styles.difficultyLabel, { color: palette.text }]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Books in Order"
      subtitle={difficulty.label}
      onBack={handleFinishSession}
      rightStat={{ label: 'Score', value: `${correctRounds}/${rounds}` }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.instructions, { color: palette.subtext }]}>
          Tap the books below in their correct order, first to last.
        </Text>

        <View style={[styles.placedRow, { backgroundColor: palette.card }]}>
          {correctOrder.map((_, index) => {
            const item = placed[index];
            const correctHere = submitted && item?.code === correctOrder[index].code;
            const wrongHere = submitted && item && item.code !== correctOrder[index].code;
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
                <Text style={[styles.slotIndex, { color: palette.subtext }]}>{index + 1}</Text>
                <Text numberOfLines={1} style={[styles.slotText, { color: palette.text }]}>
                  {item?.name ?? ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {submitted && !isAllCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct order</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>
              {correctOrder.map((b) => b.name).join(' → ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => handleTrayTap(item)}
              disabled={submitted}
              style={[styles.chip, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNextRound} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>Next Round</Text>
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
  pickerWrap: { flex: 1, gap: 14, paddingTop: 8 },
  difficultyCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  difficultyLabel: { fontSize: 16, fontWeight: '800' },

  scrollContent: { gap: 16, paddingBottom: 16 },
  instructions: { fontSize: 13, fontWeight: '600' },
  placedRow: { borderRadius: 16, padding: 12, gap: 8 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  slotIndex: { fontSize: 12, fontWeight: '900', width: 18 },
  slotText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },

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
