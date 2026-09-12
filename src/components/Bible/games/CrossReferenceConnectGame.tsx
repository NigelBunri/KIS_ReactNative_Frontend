// src/components/Bible/games/CrossReferenceConnectGame.tsx
//
// "Cross Reference Connect" — memory/pairs, same flip-card mechanic as
// VerseMatchGame, but both halves of a pair show verse TEXT rather than a
// reference+text pair. "Related" here means simply ADJACENT within the
// stage's own verse list: since a stage is always a contiguous run of
// Scripture, verse[i] and verse[i+1] genuinely are narratively connected.
// Non-overlapping consecutive pairs (0,1), (2,3), (4,5)... are formed once
// from the stage's own verses and never drawn from outside it.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, Animated, Easing } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { StageComplete } from './GameFeedback';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import {
  finishStage,
  getStageVerses,
  STAGES_PER_GAME,
  type StageOutcome,
  type VerseRef,
} from '../../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../../screens/tabs/bible/games/gameScreenTypes';

const MAX_PAIRS_PER_ROUND = 5;
const MAX_ROUNDS = 4;

type CardData = {
  key: string;
  pairId: string;
  label: string;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function verseId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

function shortText(ref: VerseRef): string {
  const text = getVerseText(ref.bookName, ref.chapter, ref.verse);
  return text.length > 70 ? `${text.slice(0, 67)}…` : text;
}

/** Non-overlapping consecutive pairs of the stage's own verses, in order —
 * verse[0]+verse[1], verse[2]+verse[3], etc. Capped to what MAX_ROUNDS *
 * MAX_PAIRS_PER_ROUND can use so a huge stage doesn't build thousands of
 * unused pairs; a small stage simply produces fewer pairs, which the round
 * chunker below turns into fewer/smaller rounds rather than crashing. */
function buildPairs(stageVerses: VerseRef[]): [VerseRef, VerseRef][] {
  const pairs: [VerseRef, VerseRef][] = [];
  const cap = MAX_ROUNDS * MAX_PAIRS_PER_ROUND * 2;
  const limited = stageVerses.slice(0, cap);
  for (let i = 0; i + 1 < limited.length; i += 2) {
    pairs.push([limited[i], limited[i + 1]]);
  }
  return pairs;
}

/** Chunk the stage's pairs into up to MAX_ROUNDS rounds of up to
 * MAX_PAIRS_PER_ROUND pairs each — a stage with only a handful of pairs
 * gracefully produces just 1-2 short rounds instead of a broken screen. */
function chunkIntoRounds(pairs: [VerseRef, VerseRef][]): [VerseRef, VerseRef][][] {
  const rounds: [VerseRef, VerseRef][][] = [];
  for (let i = 0; i < pairs.length && rounds.length < MAX_ROUNDS; i += MAX_PAIRS_PER_ROUND) {
    rounds.push(pairs.slice(i, i + MAX_PAIRS_PER_ROUND));
  }
  return rounds;
}

function buildCards(roundPairs: [VerseRef, VerseRef][]): CardData[] {
  const cards: CardData[] = [];
  for (const [a, b] of roundPairs) {
    const id = `${verseId(a)}__${verseId(b)}`;
    cards.push({ key: `${id}-a`, pairId: id, label: shortText(a) });
    cards.push({ key: `${id}-b`, pairId: id, label: shortText(b) });
  }
  return shuffle(cards);
}

function FlipCard({
  card,
  isFlipped,
  isMatched,
  onPress,
  size,
}: {
  card: CardData;
  isFlipped: boolean;
  isMatched: boolean;
  onPress: () => void;
  size: number;
}) {
  const { palette } = useKISTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isFlipped || isMatched ? 180 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isFlipped, isMatched, anim]);

  const frontRotate = anim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
  const backRotate = anim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

  return (
    <Pressable onPress={onPress} disabled={isFlipped || isMatched} style={{ width: size, height: size }}>
      <Animated.View
        style={[
          styles.cardFace,
          {
            backgroundColor: palette.selectedBg,
            borderColor: palette.goldReadable,
            transform: [{ perspective: 800 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <KISIcon name="shuffle" size={22} color={palette.goldReadable} />
      </Animated.View>

      <Animated.View
        style={[
          styles.cardFace,
          styles.cardFaceAbsolute,
          {
            backgroundColor: isMatched ? '#16a34a20' : palette.card,
            borderColor: isMatched ? '#16a34a' : palette.goldReadable,
            transform: [{ perspective: 800 }, { rotateY: backRotate }],
          },
        ]}
      >
        <Text numberOfLines={5} style={[styles.cardBodyText, { color: isMatched ? '#16a34a' : palette.text }]}>
          {card.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function CrossReferenceConnectGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const meta = GAME_METADATA[gameKey];
  const [rounds, setRounds] = useState<[VerseRef, VerseRef][][] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedKeys, setFlippedKeys] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [stageResult, setStageResult] = useState<StageOutcome | null>(null);
  const scoredRef = useRef(false);

  const columns = responsive.isCompactPhone || responsive.isWatch ? 3 : 4;
  const gap = 10;
  const cardSize = (responsive.contentMaxWidth - responsive.pageGutter * 2) / columns - gap;

  const load = useCallback(() => {
    let active = true;
    getStageVerses(gameKey, stageIndex).then((verses) => {
      if (!active) return;
      const pairs = buildPairs(verses);
      const chunked = chunkIntoRounds(pairs);
      setRounds(chunked);
      setRoundIndex(0);
      setTotalMoves(0);
      setCards(chunked.length ? buildCards(chunked[0]) : []);
      setFlippedKeys([]);
      setMatchedPairIds(new Set());
      setMoves(0);
      setStageResult(null);
      scoredRef.current = false;
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  useEffect(() => load(), [load]);

  const currentRoundPairs = rounds?.[roundIndex] ?? [];
  const allMatched = currentRoundPairs.length > 0 && matchedPairIds.size === currentRoundPairs.length;

  useEffect(() => {
    if (allMatched && !scoredRef.current) {
      scoredRef.current = true;
      setTotalMoves((t) => t + moves);
    }
  }, [allMatched, moves]);

  const handleCardPress = useCallback(
    (card: CardData) => {
      if (locked || flippedKeys.includes(card.key) || matchedPairIds.has(card.pairId)) return;
      const nextFlipped = [...flippedKeys, card.key];
      setFlippedKeys(nextFlipped);

      if (nextFlipped.length === 2) {
        setLocked(true);
        setMoves((m) => m + 1);
        const [firstKey, secondKey] = nextFlipped;
        const first = cards.find((c) => c.key === firstKey)!;
        const second = cards.find((c) => c.key === secondKey)!;
        const isMatch = first.pairId === second.pairId;

        setTimeout(() => {
          if (isMatch) {
            setMatchedPairIds((prev) => new Set(prev).add(first.pairId));
          }
          setFlippedKeys([]);
          setLocked(false);
        }, isMatch ? 500 : 900);
      }
    },
    [locked, flippedKeys, matchedPairIds, cards],
  );

  const handleContinue = async () => {
    if (!rounds) return;
    const nextRound = roundIndex + 1;
    if (nextRound >= rounds.length) {
      const totalPairs = rounds.reduce((sum, r) => sum + r.length, 0);
      const score = Math.max(0, totalPairs * 4 - totalMoves);
      const outcome = await finishStage(gameKey, stageIndex, score);
      setStageResult(outcome);
      return;
    }
    setRoundIndex(nextRound);
    setCards(buildCards(rounds[nextRound]));
    setFlippedKeys([]);
    setMatchedPairIds(new Set());
    setMoves(0);
    scoredRef.current = false;
  };

  if (stageResult) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <StageComplete
            gameTitle={meta.title}
            scoreLine={`${totalMoves} total moves across ${rounds?.length ?? 0} round${(rounds?.length ?? 0) === 1 ? '' : 's'}`}
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

  if (rounds === null) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (rounds.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.fallbackCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.fallbackText, { color: palette.text }]}>
              This stage doesn't have enough verses to form connected pairs.
            </Text>
            <Pressable onPress={onExit} style={[styles.roundCompleteBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.roundCompleteBtnText, { color: palette.onGold }]}>Back to Journey</Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  if (allMatched) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.roundCompleteCard, { backgroundColor: palette.card }]}>
            <KISIcon name="checkmark-circle" size={40} color={palette.success} />
            <Text style={[styles.roundCompleteTitle, { color: palette.text }]}>All connected!</Text>
            <Text style={[styles.roundCompleteScore, { color: palette.subtext }]}>
              Round {roundIndex + 1} of {rounds.length} completed in {moves} moves
            </Text>
            <Pressable onPress={handleContinue} style={[styles.roundCompleteBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.roundCompleteBtnText, { color: palette.onGold }]}>
                {roundIndex + 1 >= rounds.length ? 'Finish Stage' : 'Next Round'}
              </Text>
            </Pressable>
          </View>
        </View>
      </GameShell>
    );
  }

  if (cards.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={meta.title}
      subtitle={`${isReplay ? 'Replay · ' : ''}Round ${roundIndex + 1} of ${rounds.length} — match adjacent verses`}
      onBack={onExit}
      rightStat={{ label: 'Moves', value: moves }}
    >
      <View style={[styles.grid, { gap }]}>
        {cards.map((card) => (
          <FlipCard
            key={card.key}
            card={card}
            isFlipped={flippedKeys.includes(card.key)}
            isMatched={matchedPairIds.has(card.pairId)}
            onPress={() => handleCardPress(card)}
            size={cardSize}
          />
        ))}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 14 },
  fallbackText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  roundCompleteCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 6 },
  roundCompleteTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  roundCompleteScore: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  roundCompleteBtn: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  roundCompleteBtnText: { fontSize: 15, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cardFace: {
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    backfaceVisibility: 'hidden',
    width: '100%',
    height: '100%',
  },
  cardFaceAbsolute: { position: 'absolute', top: 0, left: 0 },
  cardBodyText: { fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
});
