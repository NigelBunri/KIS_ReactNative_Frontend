// src/components/Bible/BibleGamesPanel.tsx
//
// Hub for the Bible games — 30 of them, each carrying its own slice of the
// whole Bible (see versePartition.ts): finishing every game's 10 stages
// means having read every one of the Bible's 31,102 verses at least once.
//
// Registry-based, not the old hardcoded array + `if (activeGame === 'x')`
// chain this replaced — that pattern was fine for 6 games and would not
// have scaled to 30. GAME_REGISTRY is a Record<GameKey, GameDefinition>
// keyed the same way every other lookup in this feature is (gameStorage.ts,
// versePartition.ts). All 30 games are now built and React.lazy-loaded (no
// existing lazy-loading precedent elsewhere in this codebase — first use of
// the pattern here, deliberately, since eagerly importing all 30 game
// screens into this one hub's import graph would bloat the initial bundle
// even with every screen shipped). `Component: null` is kept as a supported
// state in the type/registry (not deleted along with the last `null` entry)
// so a future 31st game can land the same way these did — metadata first,
// "Coming soon" card, then wired in once built — without another refactor
// of this file's shape.
//
// Fully offline, always: every game reads from the bundled kjv.json (see
// screens/tabs/bible/games/), never a network call. All games use the King
// James Version specifically (not whichever translation the user has set
// for the Read tab) — the only translation guaranteed to be bundled
// regardless of what a user has actually downloaded offline.

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import BibleSectionCard from './BibleSectionCard';
import {
  ALL_GAME_KEYS,
  getAllGameProgress,
  getBestScores,
  isGameCompleted,
  STAGES_PER_GAME,
  type AllGameStageProgress,
  type BestScores,
  type GameKey,
} from '../../screens/tabs/bible/games/gameStorage';
import { GAME_METADATA } from '../../screens/tabs/bible/games/gameMetadata';
import type { GameScreenProps } from '../../screens/tabs/bible/games/gameScreenTypes';
import BibleGameStatsScreen from './games/BibleGameStatsScreen';
import BibleGamesOverallStatsScreen from './games/BibleGamesOverallStatsScreen';
import GameJourneyScreen from './games/journey/GameJourneyScreen';

type LazyGameComponent = React.LazyExoticComponent<React.ComponentType<GameScreenProps>>;

export type GameDefinition = {
  key: GameKey;
  title: string;
  description: string;
  icon: KISIconName;
  Component: LazyGameComponent | null; // null = not yet built ("coming soon")
};

// Not-yet-built games map to `null` - the grid renders them as a disabled
// "Coming soon" card instead of navigating into a blank screen.
// GAME_METADATA (gameMetadata.ts) is the single source of truth for every
// game's title/description/icon, kept separate from this Component map so
// the stats screens can read metadata without importing this whole
// lazy-loaded panel (which would create a circular import: hub -> game
// screen -> "view stats" -> stats screen -> hub).
const GAME_COMPONENTS: Record<GameKey, LazyGameComponent | null> = {
  'complete-verse': React.lazy(() => import('./games/CompleteVerseGame')),
  'books-in-order': React.lazy(() => import('./games/BooksInOrderGame')),
  'verse-match': React.lazy(() => import('./games/VerseMatchGame')),
  'scripture-trivia': React.lazy(() => import('./games/ScriptureTriviaGame')),
  'verse-vault': React.lazy(() => import('./games/VerseVaultGame')),
  'word-weave': React.lazy(() => import('./games/WordWeaveGame')),
  'verse-race': React.lazy(() => import('./games/VerseRaceGame')),
  'chapter-scroll': React.lazy(() => import('./games/ChapterScrollGame')),
  'flash-recall': React.lazy(() => import('./games/FlashRecallGame')),
  'first-letters': React.lazy(() => import('./games/FirstLettersGame')),
  'verse-jigsaw': React.lazy(() => import('./games/VerseJigsawGame')),
  'punctuation-restore': React.lazy(() => import('./games/PunctuationRestoreGame')),
  'letter-fill': React.lazy(() => import('./games/LetterFillGame')),
  'reference-rally': React.lazy(() => import('./games/ReferenceRallyGame')),
  'verse-locator': React.lazy(() => import('./games/VerseLocatorGame')),
  'chapter-sprint': React.lazy(() => import('./games/ChapterSprintGame')),
  'book-detective': React.lazy(() => import('./games/BookDetectiveGame')),
  'sequence-chain': React.lazy(() => import('./games/SequenceChainGame')),
  'name-place-match': React.lazy(() => import('./games/NamePlaceMatchGame')),
  'keyword-sort': React.lazy(() => import('./games/KeywordSortGame')),
  'count-challenge': React.lazy(() => import('./games/CountChallengeGame')),
  'verse-pairs': React.lazy(() => import('./games/VersePairsGame')),
  'who-said-it': React.lazy(() => import('./games/WhoSaidItGame')),
  'cross-reference-connect': React.lazy(() => import('./games/CrossReferenceConnectGame')),
  'listen-and-tap': React.lazy(() => import('./games/ListenAndTapGame')),
  'audio-dictation': React.lazy(() => import('./games/AudioDictationGame')),
  'verse-crossword': React.lazy(() => import('./games/VerseCrosswordGame')),
  'word-search': React.lazy(() => import('./games/WordSearchGame')),
  'anagram-unscramble': React.lazy(() => import('./games/AnagramUnscrambleGame')),
  'verse-ladder': React.lazy(() => import('./games/VerseLadderGame')),
};

const GAME_REGISTRY: Record<GameKey, GameDefinition> = Object.fromEntries(
  ALL_GAME_KEYS.map((key) => [key, { ...GAME_METADATA[key], Component: GAME_COMPONENTS[key] }]),
) as Record<GameKey, GameDefinition>;

type ActiveView =
  | { type: 'journey'; key: GameKey }
  | { type: 'game'; key: GameKey; stageIndex: number; isReplay: boolean }
  | { type: 'game-stats'; key: GameKey }
  | { type: 'overall-stats' }
  | null;

export default function BibleGamesPanel() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<ActiveView>(null);
  const [bestScores, setBestScores] = useState<BestScores>({});
  const [progress, setProgress] = useState<AllGameStageProgress>({});

  const refresh = useCallback(() => {
    getBestScores().then(setBestScores);
    getAllGameProgress().then(setProgress);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A finished round returns to the game's OWN journey map, not the hub -
  // the player should immediately see the stage they just cleared light up
  // and the next one unlock, not lose that context by bouncing all the way
  // back out (see GameJourneyScreen.tsx / the product spec's "completing a
  // level should naturally lead the player toward the next one").
  const handleExitToJourney = (key: GameKey) => {
    setActive({ type: 'journey', key });
    refresh(); // keep the hub's own stage/best chips in sync for whenever the player does back out
  };

  const games = useMemo(() => ALL_GAME_KEYS.map((key) => GAME_REGISTRY[key]), []);

  if (active?.type === 'journey') {
    return (
      <GameJourneyScreen
        gameKey={active.key}
        onExit={() => { setActive(null); refresh(); }}
        onOpenStats={() => setActive({ type: 'game-stats', key: active.key })}
        onEnterStage={(stageIndex, isReplay) => setActive({ type: 'game', key: active.key, stageIndex, isReplay })}
      />
    );
  }

  if (active?.type === 'game') {
    const def = GAME_REGISTRY[active.key];
    if (!def.Component) {
      // Metadata exists for every one of the 30 games so the hub grid is
      // complete, but tapping into one that hasn't shipped yet must never
      // show a blank/broken screen - shouldn't be reachable since
      // "coming soon" cards don't navigate (see the grid below), but this
      // is the honest fallback if it ever is.
      return (
        <View style={[styles.comingSoonFallback, { backgroundColor: palette.bg }]}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>{def.title} is coming soon.</Text>
          <Pressable onPress={() => setActive(null)} style={[styles.backLink]}>
            <Text style={{ color: palette.primary, fontWeight: '800' }}>← Back to games</Text>
          </Pressable>
        </View>
      );
    }
    const GameComponent = def.Component;
    return (
      <Suspense fallback={<View style={[styles.center, { backgroundColor: palette.bg }]}><ActivityIndicator color={palette.primary} /></View>}>
        <GameComponent
          gameKey={active.key}
          stageIndex={active.stageIndex}
          isReplay={active.isReplay}
          onExit={() => handleExitToJourney(active.key)}
          onOpenStats={() => setActive({ type: 'game-stats', key: active.key })}
        />
      </Suspense>
    );
  }

  if (active?.type === 'game-stats') {
    return <BibleGameStatsScreen gameKey={active.key} onBack={() => setActive(null)} />;
  }

  if (active?.type === 'overall-stats') {
    return <BibleGamesOverallStatsScreen onBack={() => setActive(null)} onReset={refresh} />;
  }

  const columns = responsive.isTablet ? 3 : 1;

  return (
    <ScrollView
      style={styles.wrap}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter, paddingBottom: 40 + insets.bottom }]}
    >
      <Text style={[styles.intro, { color: palette.subtext }]}>
        30 ways to grow in Scripture — each one carries its own slice of the Bible, so finishing every game means
        finishing the whole Bible.
      </Text>

      <View style={[styles.kjvNote, { backgroundColor: palette.selectedBg }]}>
        <KISIcon name="info" size={14} color={palette.goldReadable} />
        <Text style={[styles.kjvNoteText, { color: palette.subtext }]}>
          Games use the King James Version, played fully offline — this may differ from your Read tab's translation.
        </Text>
      </View>

      <Pressable onPress={() => setActive({ type: 'overall-stats' })} style={[styles.overallStatsBtn, { borderColor: palette.primary }]}>
        <KISIcon name="bar-chart" size={16} color={palette.primary} />
        <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>Overall Bible-coverage progress</Text>
      </Pressable>

      <View style={[styles.grid, { gap: responsive.cardGap }]}>
        {games.map((game) => {
          const best = bestScores[game.key]?.best;
          const gameProgress = progress[game.key];
          const stagesCompleted = gameProgress?.stagesCompleted ?? 0;
          const completed = gameProgress ? isGameCompleted(gameProgress) : false;
          const comingSoon = !game.Component;
          return (
            <Pressable
              key={game.key}
              disabled={comingSoon}
              onPress={() => setActive({ type: 'journey', key: game.key })}
              style={{ width: columns === 1 ? '100%' : `${100 / columns - 2}%`, opacity: comingSoon ? 0.55 : 1 }}
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
                  {comingSoon ? null : <KISIcon name="chevron-right" size={18} color={palette.subtext} />}
                </View>
                <View style={styles.chipsRow}>
                  {comingSoon ? (
                    <View style={[styles.comingSoonChip, { backgroundColor: palette.selectedBg }]}>
                      <Text style={[styles.comingSoonChipText, { color: palette.subtext }]}>Coming soon</Text>
                    </View>
                  ) : (
                    <>
                      <View style={[styles.bestChip, { backgroundColor: palette.selectedBg }]}>
                        <Text style={[styles.bestChipText, { color: palette.goldReadable }]}>
                          Stage {Math.min(stagesCompleted + (completed ? 0 : 1), STAGES_PER_GAME)} of {STAGES_PER_GAME}
                        </Text>
                      </View>
                      {typeof best === 'number' ? (
                        <View style={[styles.bestChip, { backgroundColor: palette.selectedBg }]}>
                          <KISIcon name="trophy" size={12} color={palette.goldReadable} />
                          <Text style={[styles.bestChipText, { color: palette.goldReadable }]}>Best: {best}</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
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
  overallStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gameCard: { gap: 10 },
  gameCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  gameTitle: { fontSize: 15, fontWeight: '800' },
  gameDescription: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  comingSoonChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonChipText: { fontSize: 11, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  comingSoonFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  backLink: { padding: 8 },
});
