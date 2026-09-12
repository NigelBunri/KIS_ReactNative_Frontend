// src/components/Bible/games/AnagramUnscrambleGame.tsx
//
// "Anagram Unscramble" — one word per round (preferring a name/place via
// verseText.ts's extractCapitalizedWords, since scrambling "Nebuchadnezzar"
// is a lot more interesting than scrambling "and") is masked out of its
// verse as "_____" for context, and its letters are shown scrambled as
// tappable tiles. The player taps tiles in order into a row of blank slots
// sized to the word's length to spell it back out. Tap-to-place /
// tap-to-remove, same interaction family as LetterFillGame.tsx.
//
// extractCapitalizedWords excludes sentence-initial words (so it won't
// flag ordinary capitalized-because-it-starts-a-sentence words), which
// means very short verses can come back with zero candidates (e.g. "Jesus
// wept." — "Jesus" is sentence-initial). Falls back to any word >= 5
// letters, then >= 3 letters as a last resort, so every verse in the Bible
// has SOME word this game can use — never a broken empty state.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { extractCapitalizedWords, getVerseText, tokenizeVerse } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const ROUND_LENGTH = 8;

function referenceOf(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.verse}`;
}

function coreWord(token: string): string {
  return token.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Candidate = { word: string; tokenIndex: number };

/** Picks the word this round scrambles, and the index of the token it came
 * from (so the masked verse display hides that exact occurrence, not just
 * any word matching the same text). */
function pickCandidate(tokens: string[], text: string): Candidate | null {
  const names = extractCapitalizedWords(text);
  if (names.length) {
    const chosen = names[Math.floor(Math.random() * names.length)];
    const idx = tokens.findIndex((t) => coreWord(t) === chosen);
    if (idx !== -1) return { word: chosen, tokenIndex: idx };
  }
  const byMinLen = (minLen: number) =>
    tokens
      .map((t, i) => ({ w: coreWord(t), i }))
      .filter((x) => x.w.length >= minLen);
  const pool = byMinLen(5).length ? byMinLen(5) : byMinLen(3);
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { word: pick.w, tokenIndex: pick.i };
}

function scrambleWord(word: string): string {
  if (word.length <= 1) return word;
  let attempt = 0;
  let letters = word.split('');
  while (attempt < 25) {
    letters = shuffle(word.split(''));
    if (letters.join('').toLowerCase() !== word.toLowerCase()) break;
    attempt++;
  }
  return letters.join('');
}

type LetterTile = { id: string; letter: string };

type Round = {
  verse: VerseRef;
  maskedText: string;
  word: string;
  tiles: LetterTile[]; // scrambled, tray order
};

function buildRound(verse: VerseRef): Round | null {
  const text = getVerseText(verse.bookName, verse.chapter, verse.verse);
  const tokens = tokenizeVerse(text);
  const candidate = pickCandidate(tokens, text);
  if (!candidate) return null;

  const maskedTokens = tokens.map((t, i) => (i === candidate.tokenIndex ? '_____' : t));
  const scrambled = scrambleWord(candidate.word);
  const tiles = scrambled.split('').map((letter, i) => ({ id: `t${i}`, letter }));

  return { verse, maskedText: maskedTokens.join(' '), word: candidate.word, tiles: shuffle(tiles) };
}

function hasEligibleWord(text: string): boolean {
  const tokens = tokenizeVerse(text);
  return tokens.some((t) => coreWord(t).length >= 3);
}

function buildQueue(stageVerses: VerseRef[]): VerseRef[] {
  const eligible = stageVerses.filter((v) => hasEligibleWord(getVerseText(v.bookName, v.chapter, v.verse)));
  return shuffle(eligible).slice(0, Math.min(ROUND_LENGTH, eligible.length));
}

export default function AnagramUnscrambleGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const meta = GAME_METADATA[gameKey];
  const [queue, setQueue] = useState<VerseRef[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [placed, setPlaced] = useState<(LetterTile | null)[]>([]);
  const [tray, setTray] = useState<LetterTile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);

  useEffect(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const q = buildQueue(verses);
      setQueue(q);
      if (!q.length) {
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
    if (!queue || !queue.length || round || queueIndex >= queue.length) return;
    const next = buildRound(queue[queueIndex]);
    if (!next) return;
    setRound(next);
    setPlaced(new Array(next.tiles.length).fill(null));
    setTray(next.tiles);
    setSubmitted(false);
  }, [queue, queueIndex, round]);

  const totalRounds = queue?.length ?? 0;
  const nextSlot = placed.findIndex((p) => p === null);
  const allFilled = placed.every((p) => p !== null);
  const isCorrect = useMemo(() => {
    if (!round || !allFilled) return false;
    const guess = placed.map((p) => p?.letter ?? '').join('');
    return guess.toLowerCase() === round.word.toLowerCase();
  }, [round, allFilled, placed]);

  const handleTilePress = (tile: LetterTile) => {
    if (submitted || nextSlot === -1) return;
    setPlaced((prev) => {
      const next = [...prev];
      next[nextSlot] = tile;
      return next;
    });
    setTray((prev) => prev.filter((t) => t.id !== tile.id));
  };

  const handleSlotPress = (index: number) => {
    if (submitted) return;
    const tile = placed[index];
    if (!tile) return;
    setPlaced((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setTray((prev) => [...prev, tile]);
  };

  const handleSubmit = () => {
    if (!round || !allFilled) return;
    setSubmitted(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex >= totalRounds) {
      const outcome = await finishStage(gameKey, stageIndex, score);
      setStageResult(outcome);
      return;
    }
    setQueueIndex(nextIndex);
    setRound(null);
  };

  const resetGame = () => {
    setStageResult(null);
    setQueueIndex(0);
    setScore(0);
    setRound(null);
    getStageVerses(gameKey, stageIndex).then((verses) => setQueue(buildQueue(verses)));
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${score} / ${totalRounds} correct this stage`}
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

  if (!round) {
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
      subtitle={`${isReplay ? 'Replay · ' : ''}Verse ${queueIndex + 1} of ${totalRounds}`}
      onBack={onExit}
      rightStat={{ label: 'Score', value: score }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.verseCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.reference, { color: palette.goldReadable }]}>{referenceOf(round.verse)}</Text>
          <Text style={[styles.maskedText, { color: palette.text }]}>{round.maskedText}</Text>
        </View>

        <View style={styles.slotRow}>
          {placed.map((tile, index) => {
            const correctHere = submitted && isCorrect;
            const wrongHere = submitted && !isCorrect;
            return (
              <Pressable
                key={index}
                onPress={() => handleSlotPress(index)}
                disabled={submitted || !tile}
                style={[
                  styles.slot,
                  {
                    backgroundColor: correctHere ? '#16a34a25' : wrongHere ? '#dc262625' : palette.selectedBg,
                    borderColor: correctHere ? '#16a34a' : wrongHere ? '#dc2626' : palette.goldReadable,
                  },
                ]}
              >
                <Text style={[styles.slotText, { color: tile ? palette.text : palette.subtext }]}>
                  {tile ? tile.letter.toUpperCase() : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {submitted && !isCorrect ? (
          <View style={[styles.correctAnswerCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.correctAnswerLabel, { color: palette.goldReadable }]}>Correct word</Text>
            <Text style={[styles.correctAnswerText, { color: palette.text }]}>{round.word}</Text>
          </View>
        ) : null}

        <View style={styles.trayRow}>
          {tray.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => handleTilePress(tile)}
              disabled={submitted || nextSlot === -1}
              style={[styles.chip, { backgroundColor: palette.selectedBg, borderColor: palette.goldReadable }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{tile.letter.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitted ? (
          <Pressable onPress={handleNext} style={[styles.actionBtn, { backgroundColor: palette.goldReadable }]}>
            <Text style={[styles.actionBtnText, { color: palette.onGold }]}>
              {queueIndex + 1 >= totalRounds ? 'See Results' : 'Next Verse'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!allFilled}
            style={[styles.actionBtn, { backgroundColor: allFilled ? palette.goldReadable : palette.selectedBg }]}
          >
            <Text style={[styles.actionBtnText, { color: allFilled ? palette.onGold : palette.subtext }]}>
              Check Answer
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
  verseCard: { borderRadius: 18, padding: 18, gap: 10 },
  reference: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  maskedText: { fontSize: 16, fontWeight: '600', lineHeight: 24 },

  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  slot: {
    borderWidth: 1.5,
    borderRadius: 8,
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { fontSize: 18, fontWeight: '900' },

  correctAnswerCard: { borderRadius: 14, padding: 14, gap: 4 },
  correctAnswerLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  correctAnswerText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 16, fontWeight: '900' },

  footer: { paddingVertical: 14 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '900' },
});
