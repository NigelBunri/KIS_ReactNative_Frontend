// src/components/Bible/games/VerseMatchGame.tsx
//
// Game 3 of 6: "Verse Match" — memory/pairs. A face-down grid where half the
// cards show a reference ("John 3:16") and half show that verse's text;
// flip two at a time to find matching pairs. Spatial/associative memory —
// deliberately not another recall-on-demand mechanic like games 1 and 6.
//
// Real flip animation (Animated rotateY, the standard two-face RN card-flip
// pattern) rather than an instant show/hide swap — a memory-match game
// without a flip animation barely reads as a game at all.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, Easing } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import GameShell from './GameShell';
import { RoundComplete } from './GameFeedback';
import { shuffledCuratedVerses } from '../../../screens/tabs/bible/games/curatedVerses';
import { getVerseText } from '../../../screens/tabs/bible/games/verseText';
import { recordScore } from '../../../screens/tabs/bible/games/gameStorage';

const PAIR_COUNT = 6; // 12 cards total — a 3x4 or 4x3 grid, enough real matching without overwhelming

type CardData = {
  key: string;
  pairId: string;
  kind: 'reference' | 'text';
  label: string;
};

function buildCards(): CardData[] {
  const verses = shuffledCuratedVerses(PAIR_COUNT);
  const cards: CardData[] = [];
  for (const v of verses) {
    const text = getVerseText(v.bookName, v.chapter, v.verse);
    const shortText = text.length > 70 ? `${text.slice(0, 67)}…` : text;
    cards.push({ key: `${v.id}-ref`, pairId: v.id, kind: 'reference', label: v.reference });
    cards.push({ key: `${v.id}-text`, pairId: v.id, kind: 'text', label: shortText });
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
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
      {/* Back face (face-down, shown at rest) */}
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
        <KISIcon name="book" size={22} color={palette.goldReadable} />
      </Animated.View>

      {/* Front face (content, shown once flipped) */}
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
        <Text
          numberOfLines={card.kind === 'reference' ? 2 : 5}
          style={[
            card.kind === 'reference' ? styles.cardRefText : styles.cardBodyText,
            { color: isMatched ? '#16a34a' : palette.text },
          ]}
        >
          {card.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function VerseMatchGame({ onExit }: { onExit: () => void }) {
  const responsive = useResponsiveLayout();
  const [cards, setCards] = useState<CardData[]>(() => buildCards());
  const [flippedKeys, setFlippedKeys] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const scoredRef = useRef(false);

  const columns = responsive.isCompactPhone || responsive.isWatch ? 3 : 4;
  const gap = 10;
  const cardSize = (responsive.contentMaxWidth - responsive.pageGutter * 2) / columns - gap;

  const allMatched = matchedPairIds.size === PAIR_COUNT;

  useEffect(() => {
    if (allMatched && !scoredRef.current) {
      scoredRef.current = true;
      // Fewer moves = better — score as "efficiency points", floor at 0.
      recordScore('verse-match', Math.max(0, PAIR_COUNT * 4 - moves));
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

  const handlePlayAgain = () => {
    setCards(buildCards());
    setFlippedKeys([]);
    setMatchedPairIds(new Set());
    setMoves(0);
    scoredRef.current = false;
  };

  if (allMatched) {
    return (
      <GameShell title="Verse Match" onBack={onExit}>
        <View style={styles.centerFill}>
          <RoundComplete
            title="All matched!"
            scoreLine={`Completed in ${moves} moves`}
            onPlayAgain={handlePlayAgain}
            onExit={onExit}
          />
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell
      title="Verse Match"
      subtitle="Find the reference for each verse"
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
  cardRefText: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  cardBodyText: { fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
});
