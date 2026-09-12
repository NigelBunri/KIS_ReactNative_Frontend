jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALL_GAME_KEYS,
  areAllGamesCompleted,
  completeCurrentStage,
  finishStage,
  getCoverageSummary,
  getCurrentStageVerses,
  getGameProgress,
  getGameStageDescriptors,
  getOrSeedVaultDeck,
  getPartitionState,
  getStageScores,
  getStageVerses,
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

  it('concurrent first-ever reads all resolve to the SAME seed (regression: race condition in seed creation)', async () => {
    // Simulates e.g. the hub and a journey screen both mounting around the
    // very first app launch, before any seed has been persisted yet -
    // every concurrent caller must land on one shared seed, never each
    // generate/persist its own and silently disagree about game content.
    const results = await Promise.all(Array.from({ length: 20 }, () => getPartitionState()));
    const uniqueSeeds = new Set(results.map((r) => r.seed));
    expect(uniqueSeeds.size).toBe(1);
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

  describe('Verse Vault deck (per-stage)', () => {
    it("seeds one card per verse in verse-vault's stage 0", async () => {
      const stageVerses = await getStageVerses('verse-vault', 0);
      const { deck, stageVerses: returnedVerses } = await getOrSeedVaultDeck(0);
      expect(returnedVerses).toEqual(stageVerses);
      expect(Object.keys(deck)).toHaveLength(stageVerses.length);
      for (const ref of stageVerses) {
        expect(deck[vaultCardId(ref)]).toBeDefined();
      }
    });

    it('returns the same deck on repeated calls for the same stage (no silent reseed)', async () => {
      const { deck: first } = await getOrSeedVaultDeck(0);
      const someId = Object.keys(first)[0];
      const reviewed = reviewCard(first[someId], 'good');
      await saveVaultDeck(0, { ...first, [someId]: reviewed });

      const { deck: second } = await getOrSeedVaultDeck(0);
      expect(second[someId].lastReviewedAt).toBe(reviewed.lastReviewedAt);
    });

    it('seeds an independent fresh deck for a different stage, without touching stage 0', async () => {
      const { deck: firstDeck } = await getOrSeedVaultDeck(0);
      const someId = Object.keys(firstDeck)[0];
      await saveVaultDeck(0, { ...firstDeck, [someId]: reviewCard(firstDeck[someId], 'good') });

      const { deck: stage1Deck } = await getOrSeedVaultDeck(1);
      expect(Object.values(stage1Deck).every((c) => c.lastReviewedAt === null)).toBe(true);

      // Stage 0's reviewed card must still be there, untouched by seeding stage 1.
      const { deck: stage0Again } = await getOrSeedVaultDeck(0);
      expect(stage0Again[someId].lastReviewedAt).not.toBeNull();
    });
  });

  describe('getStageVerses', () => {
    it('returns the same content as getCurrentStageVerses for stage 0 (nothing advanced yet)', async () => {
      const viaCurrent = await getCurrentStageVerses('verse-locator');
      const viaExplicit = await getStageVerses('verse-locator', 0);
      expect(viaExplicit).toEqual(viaCurrent);
    });

    it('clamps an out-of-range stage index instead of throwing', async () => {
      const tooHigh = await getStageVerses('verse-locator', 999);
      const negative = await getStageVerses('verse-locator', -5);
      expect(tooHigh.length).toBeGreaterThan(0);
      expect(negative.length).toBeGreaterThan(0);
    });

    it('every stage of a game returns non-overlapping, non-empty verses', async () => {
      const allStages = await Promise.all(
        Array.from({ length: STAGES_PER_GAME }, (_, i) => getStageVerses('anagram-unscramble', i)),
      );
      const seen = new Set<string>();
      for (const stage of allStages) {
        expect(stage.length).toBeGreaterThan(0);
        for (const v of stage) {
          const id = `${v.bookName}-${v.chapter}-${v.verse}`;
          expect(seen.has(id)).toBe(false); // a verse never appears in two stages of the same game
          seen.add(id);
        }
      }
    });
  });

  describe('getGameStageDescriptors (journey map data)', () => {
    it('stage 0 is current and every other stage is locked on a fresh game', async () => {
      const stages = await getGameStageDescriptors('word-search');
      expect(stages).toHaveLength(STAGES_PER_GAME);
      expect(stages[0].status).toBe('current');
      for (const s of stages.slice(1)) expect(s.status).toBe('locked');
    });

    it('marks earlier stages completed and the next one current as progress advances', async () => {
      await completeCurrentStage('word-search');
      await completeCurrentStage('word-search');
      const stages = await getGameStageDescriptors('word-search');
      expect(stages[0].status).toBe('completed');
      expect(stages[1].status).toBe('completed');
      expect(stages[2].status).toBe('current');
      expect(stages[3].status).toBe('locked');
    });

    it('the final stage reads as completed, not current, once the whole game is done', async () => {
      for (let i = 0; i < STAGES_PER_GAME; i++) await completeCurrentStage('word-search');
      const stages = await getGameStageDescriptors('word-search');
      expect(stages[STAGES_PER_GAME - 1].status).toBe('completed');
      expect(stages.every((s) => s.status === 'completed')).toBe(true);
    });
  });

  describe('finishStage', () => {
    it('forward play on the current stage advances progress and records a stage score', async () => {
      const outcome = await finishStage('chapter-sprint', 0, 7);
      expect(outcome).toEqual({ stagesCompleted: 1, isFinalStage: false, isNewCompletion: true });
      const progress = await getGameProgress('chapter-sprint');
      expect(progress).toEqual({ currentStage: 1, stagesCompleted: 1 });
      expect((await getStageScores('chapter-sprint'))[0]).toBe(7);
    });

    it('reports isFinalStage on the game-completing call', async () => {
      let outcome;
      for (let i = 0; i < STAGES_PER_GAME; i++) {
        outcome = await finishStage('chapter-sprint', i, 5);
      }
      expect(outcome).toEqual({ stagesCompleted: STAGES_PER_GAME, isFinalStage: true, isNewCompletion: true });
    });

    it('replaying an already-completed stage updates its score but never advances or double-counts progress', async () => {
      await finishStage('chapter-sprint', 0, 4);
      const progressAfterFirstPlay = await getGameProgress('chapter-sprint');

      const replayOutcome = await finishStage('chapter-sprint', 0, 9); // better score, same stage
      const progressAfterReplay = await getGameProgress('chapter-sprint');

      expect(replayOutcome.isNewCompletion).toBe(false);
      expect(progressAfterReplay).toEqual(progressAfterFirstPlay); // untouched
      expect((await getStageScores('chapter-sprint'))[0]).toBe(9); // best score still updates
    });

    it('a replay with a lower score keeps the existing best rather than overwriting it', async () => {
      await finishStage('chapter-sprint', 0, 9);
      await finishStage('chapter-sprint', 0, 3); // worse replay attempt
      expect((await getStageScores('chapter-sprint'))[0]).toBe(9);
    });

    it('a locked stage (ahead of currentStage) is a defense-in-depth no-op', async () => {
      const before = await getGameProgress('chapter-sprint');
      const outcome = await finishStage('chapter-sprint', 5, 10); // stage 5 is locked; currentStage is 0
      const after = await getGameProgress('chapter-sprint');
      expect(outcome.isNewCompletion).toBe(false);
      expect(after).toEqual(before);
      expect((await getStageScores('chapter-sprint'))[5]).toBeUndefined();
    });
  });
});
