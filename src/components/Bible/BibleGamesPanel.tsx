// src/components/Bible/BibleGamesPanel.tsx
//
// Hub for the 6 Bible memorization games, following the same
// local-state-routing pattern already used elsewhere in this module (see
// BibleLessonsPanel.tsx's selectedCourse/selectedLesson) rather than a
// nested React Navigation stack — this screen just swaps between "hub grid"
// and "playing game X" via component state.
//
// Fully offline, always: every game reads from the bundled kjv.json (see
// screens/tabs/bible/games/), never a network call. All 6 games use the
// King James Version specifically (not whichever translation the user has
// set for the Read tab) — the only translation guaranteed to be bundled
// regardless of what a user has actually downloaded offline. Called out
// explicitly below so it doesn't read as a mismatch bug for anyone whose
// Read tab is set to a different translation.

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import BibleSectionCard from './BibleSectionCard';
import type { GameKey } from '../../screens/tabs/bible/games/gameStorage';
import { getBestScores, type BestScores } from '../../screens/tabs/bible/games/gameStorage';
import CompleteVerseGame from './games/CompleteVerseGame';
import BooksInOrderGame from './games/BooksInOrderGame';
import VerseMatchGame from './games/VerseMatchGame';
import ScriptureTriviaGame from './games/ScriptureTriviaGame';
import VerseVaultGame from './games/VerseVaultGame';
import WordWeaveGame from './games/WordWeaveGame';

type GameDef = {
  key: GameKey;
  title: string;
  description: string;
  icon: KISIconName;
};

const GAMES: GameDef[] = [
  {
    key: 'complete-verse',
    title: 'Complete the Verse',
    description: 'Fill in the missing words from memory',
    icon: 'edit',
  },
  {
    key: 'books-in-order',
    title: 'Books in Order',
    description: 'Put shuffled books back in canon order',
    icon: 'layers',
  },
  {
    key: 'verse-match',
    title: 'Verse Match',
    description: 'Pair each reference with its verse',
    icon: 'puzzle',
  },
  {
    key: 'scripture-trivia',
    title: 'Scripture Trivia',
    description: 'Multiple-choice questions on Scripture',
    icon: 'bar-chart',
  },
  {
    key: 'verse-vault',
    title: 'Verse Vault',
    description: 'Spaced-repetition flashcards for real mastery',
    icon: 'trophy',
  },
  {
    key: 'word-weave',
    title: 'Word Weave',
    description: 'Rebuild a verse word by word, in order',
    icon: 'shuffle',
  },
];

export default function BibleGamesPanel() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [activeGame, setActiveGame] = useState<GameKey | null>(null);
  const [bestScores, setBestScores] = useState<BestScores>({});

  React.useEffect(() => {
    getBestScores().then(setBestScores);
  }, []);

  const handleExitGame = () => {
    setActiveGame(null);
    getBestScores().then(setBestScores); // refresh best-score chips with whatever the round just recorded
  };

  if (activeGame === 'complete-verse') return <CompleteVerseGame onExit={handleExitGame} />;
  if (activeGame === 'books-in-order') return <BooksInOrderGame onExit={handleExitGame} />;
  if (activeGame === 'verse-match') return <VerseMatchGame onExit={handleExitGame} />;
  if (activeGame === 'scripture-trivia') return <ScriptureTriviaGame onExit={handleExitGame} />;
  if (activeGame === 'verse-vault') return <VerseVaultGame onExit={handleExitGame} />;
  if (activeGame === 'word-weave') return <WordWeaveGame onExit={handleExitGame} />;

  const columns = responsive.isTablet ? 3 : 1;

  return (
    <ScrollView
      style={styles.wrap}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter, paddingBottom: 40 + insets.bottom }]}
    >
      <Text style={[styles.intro, { color: palette.subtext }]}>
        Six ways to grow in Scripture memory — from quick rounds to a long-term review deck.
      </Text>

      <View style={[styles.kjvNote, { backgroundColor: palette.selectedBg }]}>
        <KISIcon name="info" size={14} color={palette.goldReadable} />
        <Text style={[styles.kjvNoteText, { color: palette.subtext }]}>
          Games use the King James Version, played fully offline — this may differ from your Read tab's translation.
        </Text>
      </View>

      <View style={[styles.grid, { gap: responsive.cardGap }]}>
        {GAMES.map((game) => {
          const best = bestScores[game.key]?.best;
          return (
            <Pressable
              key={game.key}
              onPress={() => setActiveGame(game.key)}
              style={{ width: columns === 1 ? '100%' : `${100 / columns - 2}%` }}
            >
              <BibleSectionCard style={styles.gameCard}>
                <View style={styles.gameCardRow}>
                  <View style={[styles.iconCircle, { backgroundColor: palette.selectedBg }]}>
                    <KISIcon name={game.icon} size={22} color={palette.goldReadable} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.gameTitle, { color: palette.text }]}>{game.title}</Text>
                    <Text style={[styles.gameDescription, { color: palette.subtext }]} numberOfLines={2}>
                      {game.description}
                    </Text>
                  </View>
                  <KISIcon name="chevron-right" size={18} color={palette.subtext} />
                </View>
                {typeof best === 'number' ? (
                  <View style={[styles.bestChip, { backgroundColor: palette.selectedBg }]}>
                    <KISIcon name="trophy" size={12} color={palette.goldReadable} />
                    <Text style={[styles.bestChipText, { color: palette.goldReadable }]}>Best: {best}</Text>
                  </View>
                ) : null}
              </BibleSectionCard>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scrollContent: { gap: 14, paddingTop: 4 },
  intro: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  kjvNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kjvNoteText: { fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gameCard: { gap: 10 },
  gameCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  gameTitle: { fontSize: 15, fontWeight: '800' },
  gameDescription: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  bestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestChipText: { fontSize: 11, fontWeight: '800' },
});
