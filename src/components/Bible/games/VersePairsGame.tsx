// src/components/Bible/games/VersePairsGame.tsx
//
// "Verse Pairs" — a memory match of verse-halves. Same flip-card mechanic as
// VerseMatchGame, but each pair comes from splitting ONE verse's words
// roughly at the midpoint into a first-half and second-half text chunk —
// distinct from Cross Reference Connect, which pairs two DIFFERENT adjacent
// verses. Matching first-half-of-verse-X to second-half-of-verse-X is what
// makes a pair here.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, Animated, Easing } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
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

const PAIR_COUNT = 6; // up to 6 pairs (12 cards) per round when the stage has enough eligible verses
const ROUNDS_PER_STAGE = 5;

type CardKind = 'first' | 'second';

type CardData = {
  key: string;
  pairId: string;
  kind: CardKind;
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

function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** A verse needs at least 2 words to split into two halves - anything
 * shorter (rare, but genealogies and short exclamations exist) can't form a
 * pair and is filtered out before rounds are built. */
function splitHalves(text: string): { first: string; second: string } | null {
  const tokens = tokenizeVerse(text);
  if (tokens.length < 2) return null;
  const mid = Math.ceil(tokens.length / 2);
  return { first: tokens.slice(0, mid).join(' '), second: tokens.slice(mid).join(' ') };
}

function buildCards(eligibleVerses: VerseRef[]): CardData[] {
  const verses = shuffle(eligibleVerses).slice(0, PAIR_COUNT);
  const cards: CardData[] = [];
  for (const v of verses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const halves = splitHalves(text);
    if (!halves) continue;
    const id = verseId(v);
    cards.push({ key: `${id}-first`, pairId: id, kind: 'first', label: truncate(halves.first) });
    cards.push({ key: `${id}-second`, pairId: id, kind: 'second', label: truncate(halves.second) });
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
        <KISIcon name="puzzle" size={22} color={palette.goldReadable} />
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

export default function VersePairsGame({ gameKey, stageIndex, isReplay, onExit, onOpenStats }: GameScreenProps) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const meta = GAME_METADATA[gameKey];
  const [eligibleVerses, setEligibleVerses] = useState<VerseRef[] | null>(null);
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
      const eligible = verses.filter((v) => splitHalves(getVerseText(v.bookName, v.chapter, v.verse)) !== null);
      setEligibleVerses(eligible);
      setRoundIndex(0);
      setTotalMoves(0);
      setCards(eligible.length ? buildCards(eligible) : []);
      setFlippedKeys([]);
      setMatchedPairIds(new Set());
      setMoves(0);
      setStageResult(null);
      scoredRef.current = false;
    });
    return () => { active = false; };
  }, [gameKey, stageIndex]);

  useEffect(() => load(), [load]);

  const pairsInRound = Math.floor(cards.length / 2);
  const allMatched = pairsInRound > 0 && matchedPairIds.size === pairsInRound;

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
        const isMatch = first.pairId === second.pairId && first.kind !== second.kind;

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
    if (!eligibleVerses) return;
    const nextRound = roundIndex + 1;
    if (nextRound >= ROUNDS_PER_STAGE) {
      const score = Math.max(0, ROUNDS_PER_STAGE * PAIR_COUNT * 4 - totalMoves);
      const outcome = await finishStage(gameKey, stageIndex, score);
      setStageResult(outcome);
      return;
    }
    setRoundIndex(nextRound);
    setCards(buildCards(eligibleVerses));
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
            scoreLine={`${totalMoves} total moves across ${ROUNDS_PER_STAGE} rounds`}
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

  if (eligibleVerses === null) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}><ActivityIndicator color={palette.primary} /></View>
      </GameShell>
    );
  }

  if (eligibleVerses.length === 0) {
    return (
      <GameShell title={meta.title} onBack={onExit}>
        <View style={styles.centerFill}>
          <View style={[styles.fallbackCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.fallbackText, { color: palette.text }]}>
              This stage doesn't have enough verse text to split into pairs.
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
            <Text style={[styles.roundCompleteTitle, { color: palette.text }]}>All matched!</Text>
            <Text style={[styles.roundCompleteScore, { color: palette.subtext }]}>
              Round {roundIndex + 1} of {ROUNDS_PER_STAGE} completed in {moves} moves
            </Text>
            <Pressable onPress={handleContinue} style={[styles.roundCompleteBtn, { backgroundColor: palette.goldReadable }]}>
              <Text style={[styles.roundCompleteBtnText, { color: palette.onGold }]}>
                {roundIndex + 1 >= ROUNDS_PER_STAGE ? 'Finish Stage' : 'Next Round'}
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
      subtitle={`${isReplay ? 'Replay · ' : ''}Round ${roundIndex + 1} of ${ROUNDS_PER_STAGE} — match each verse-half to its other half`}
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
