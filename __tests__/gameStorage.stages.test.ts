jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALL_GAME_KEYS,
  areAllGamesCompleted,
  completeCurrentStage,
  getCoverageSummary,
  getCurrentStageVerses,
  getGameProgress,
  getOrSeedVaultDeck,
  getPartitionState,
  isGameCompleted,
  resetAndReshuffle,
  saveVaultDeck,
  vaultCardId,
  STAGES_PER_GAME,
  TOTAL_GAMES,
} from '@/screens/tabs/bible/games/gameStorage';
import { reviewCard } from '@/screens/tabs/bible/games/srs';

describe('gameStorage stage/partition system', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has exactly 30 game keys, matching TOTAL_GAMES', () => {
    expect(ALL_GAME_KEYS).toHaveLength(30);
    expect(ALL_GAME_KEYS).toHaveLength(TOTAL_GAMES);
  });

  it('a new game starts at stage 0 with nothing completed', async () => {
    const progress = await getGameProgress('sequence-chain');
    expect(progress).toEqual({ currentStage: 0, stagesCompleted: 0 });
    expect(isGameCompleted(progress)).toBe(false);
  });

  it('a fresh install lazily creates and persists a seed', async () => {
    const first = await getPartitionState();
    const second = await getPartitionState();
    expect(first.seed).toBe(second.seed);
    expect(first.timesCompletedBible).toBe(0);
  });

  it('completing a stage advances progress and is idempotent past the final stage', async () => {
    for (let i = 0; i < STAGES_PER_GAME; i++) {
      await completeCurrentStage('verse-race');
    }
    const completed = await getGameProgress('verse-race');
    expect(completed.stagesCompleted).toBe(STAGES_PER_GAME);
    expect(completed.currentStage).toBe(STAGES_PER_GAME - 1);
    expect(isGameCompleted(completed)).toBe(true);

    // Calling again past the final stage must not overshoot.
    const again = await completeCurrentStage('verse-race');
    expect(again.stagesCompleted).toBe(STAGES_PER_GAME);
  });

  it('getCurrentStageVerses returns real, non-empty verses for the game/stage the player is on', async () => {
    const verses = await getCurrentStageVerses('book-detective');
    expect(verses.length).toBeGreaterThan(0);
    expect(verses[0]).toHaveProperty('bookName');
    expect(verses[0]).toHaveProperty('chapter');
    expect(verses[0]).toHaveProperty('verse');
  });

  it('areAllGamesCompleted is false until every one of the 30 games reaches its final stage', async () => {
    // Complete all but one game fully.
    for (const key of ALL_GAME_KEYS.slice(0, -1)) {
      for (let i = 0; i < STAGES_PER_GAME; i++) {
        await completeCurrentStage(key);
      }
    }
    expect(await areAllGamesCompleted()).toBe(false);

    const lastKey = ALL_GAME_KEYS[ALL_GAME_KEYS.length - 1];
    for (let i = 0; i < STAGES_PER_GAME; i++) {
      await completeCurrentStage(lastKey);
    }
    expect(await areAllGamesCompleted()).toBe(true);
  });

  it('resetAndReshuffle generates a new seed, clears progress, and increments the completion counter', async () => {
    await completeCurrentStage('word-search');
    const before = await getPartitionState();

    const after = await resetAndReshuffle();

    expect(after.seed).not.toBe(before.seed);
    expect(after.timesCompletedBible).toBe(before.timesCompletedBible + 1);
    const progress = await getGameProgress('word-search');
    expect(progress.stagesCompleted).toBe(0);
  });

  it('coverage summary reports the fixed Bible total and a real per-game verse count for all 30 games', async () => {
    const summary = await getCoverageSummary();
    expect(summary.totalBibleVerses).toBe(31102);
    expect(summary.games).toHaveLength(30);
    const totalAcrossGames = summary.games.reduce((sum, g) => sum + g.verseCount, 0);
    expect(totalAcrossGames).toBe(31102);
  });

  describe('Verse Vault deck (stage-scoped)', () => {
    it('seeds one card per verse in verse-vault\'s current stage', async () => {
      const stageVerses = await getCurrentStageVerses('verse-vault');
      const { deck, stageVerses: returnedVerses } = await getOrSeedVaultDeck();
      expect(returnedVerses).toEqual(stageVerses);
      expect(Object.keys(deck)).toHaveLength(stageVerses.length);
      for (const ref of stageVerses) {
        expect(deck[vaultCardId(ref)]).toBeDefined();
      }
    });

    it('returns the same deck on repeated calls within the same stage (no silent reseed)', async () => {
      const { deck: first } = await getOrSeedVaultDeck();
      const someId = Object.keys(first)[0];
      const reviewed = reviewCard(first[someId], 'good');
      await saveVaultDeck({ ...first, [someId]: reviewed });

      const { deck: second } = await getOrSeedVaultDeck();
      expect(second[someId].lastReviewedAt).toBe(reviewed.lastReviewedAt);
    });

    it('reseeds a fresh, all-new deck once the stage advances', async () => {
      const { deck: firstDeck } = await getOrSeedVaultDeck();
      const someId = Object.keys(firstDeck)[0];
      await saveVaultDeck({ ...firstDeck, [someId]: reviewCard(firstDeck[someId], 'good') });

      await completeCurrentStage('verse-vault'); // advances currentStage from 0 to 1

      const { deck: nextDeck } = await getOrSeedVaultDeck();
      expect(Object.values(nextDeck).every((c) => c.lastReviewedAt === null)).toBe(true);
    });
  });
});
