// src/screens/tabs/bible/games/gameStorage.ts
//
// All persistence for the 6 Bible games lives here — a thin AsyncStorage
// wrapper, same package/pattern already used elsewhere in the app (see
// src/services/bibleOfflineCache.ts). Entirely local/offline: nothing here
// ever makes a network call, matching the hard "fully offline" requirement
// for this whole feature.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { newCardState, type SrsCardState } from './srs';
import {
  STAGES_PER_GAME,
  TOTAL_GAMES,
  generateSeed,
  getPartitionForSeed,
  getTotalVerseCount,
  type VerseRef,
} from './versePartition';

const KEY_PREFIX = 'bible_games_v1_';
const KEY_VAULT_DECK = `${KEY_PREFIX}vault_deck`;
const KEY_BEST_SCORES = `${KEY_PREFIX}best_scores`;
const KEY_MISSED_WORDS = `${KEY_PREFIX}missed_words`; // Complete the Verse's light spaced-repetition weighting
const KEY_PARTITION_STATE = `${KEY_PREFIX}partition_state`;
const KEY_GAME_PROGRESS = `${KEY_PREFIX}game_progress`;

// Order here fixes each game's position in the verse partition
// (versePartition.ts assigns Bible content by numeric gameIndex, 0-29) -
// this array's index IS that gameIndex via ALL_GAME_KEYS.indexOf(key).
// Reordering this array would silently reshuffle which flavor of Scripture
// every existing player's games carry, so once shipped, only ever APPEND
// new keys here, never reorder or remove existing ones.
export const ALL_GAME_KEYS = [
  'complete-verse',
  'books-in-order',
  'verse-match',
  'scripture-trivia',
  'verse-vault',
  'word-weave',
  'verse-race',
  'chapter-scroll',
  'flash-recall',
  'first-letters',
  'verse-jigsaw',
  'punctuation-restore',
  'letter-fill',
  'reference-rally',
  'verse-locator',
  'chapter-sprint',
  'book-detective',
  'sequence-chain',
  'name-place-match',
  'keyword-sort',
  'count-challenge',
  'verse-pairs',
  'who-said-it',
  'cross-reference-connect',
  'listen-and-tap',
  'audio-dictation',
  'verse-crossword',
  'word-search',
  'anagram-unscramble',
  'verse-ladder',
] as const;

export type GameKey = (typeof ALL_GAME_KEYS)[number];

export type BestScores = Partial<Record<GameKey, { best: number; playCount: number }>>;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt/unreadable local storage is treated as "start fresh", never a
    // crash — nothing here is server-recoverable data worth failing hard for.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — a failed write just means progress isn't saved this
    // round, not a reason to interrupt gameplay with an error.
  }
}

// ─── Best scores / streaks (Complete the Verse, Trivia, Word Weave, etc.) ──

export async function getBestScores(): Promise<BestScores> {
  return readJson<BestScores>(KEY_BEST_SCORES, {});
}

export async function recordScore(game: GameKey, score: number): Promise<BestScores> {
  const current = await getBestScores();
  const existing = current[game];
  const next: BestScores = {
    ...current,
    [game]: {
      best: Math.max(existing?.best ?? 0, score),
      playCount: (existing?.playCount ?? 0) + 1,
    },
  };
  await writeJson(KEY_BEST_SCORES, next);
  return next;
}

// ─── Complete the Verse's light spaced-repetition weighting ───────────────
// Not the full SM-2 scheduler Verse Vault uses — just a "missed this
// recently, ask again sooner" weight bump, per the game's own design (see
// CompleteVerseGame.tsx). Stored as verseId -> miss count, decayed by
// halving on every correct answer rather than a full due-date schedule.

export type MissedWordsMap = Record<string, number>;

export async function getMissedWeights(): Promise<MissedWordsMap> {
  return readJson<MissedWordsMap>(KEY_MISSED_WORDS, {});
}

export async function recordVerseOutcome(verseId: string, wasCorrect: boolean): Promise<MissedWordsMap> {
  const current = await getMissedWeights();
  const currentWeight = current[verseId] ?? 0;
  const nextWeight = wasCorrect ? Math.floor(currentWeight / 2) : currentWeight + 2;
  const next = { ...current, [verseId]: nextWeight };
  await writeJson(KEY_MISSED_WORDS, next);
  return next;
}

// ─── Verse partition state (which Bible verses each of the 30 games
// carries) + per-game stage progress ────────────────────────────────────────
// The partition itself (versePartition.ts) is pure/deterministic from a
// seed - only the seed and each game's own stage-completion count need to
// be persisted, not the (large) computed verse lists themselves.

export type PartitionState = {
  seed: string;
  // Every time all 30 games reach their final stage and the player resets,
  // this increments and a fresh seed reshuffles which verses every game
  // carries next - the "how many times have I been through the whole
  // Bible" counter shown on the general stats page. Local-device only, like
  // every other number in this file - does not survive an uninstall/device
  // change (see the games-expansion plan's disclosed-limitations note).
  timesCompletedBible: number;
};

async function getOrCreatePartitionState(): Promise<PartitionState> {
  const existing = await readJson<PartitionState | null>(KEY_PARTITION_STATE, null);
  if (existing?.seed) return existing;
  const fresh: PartitionState = { seed: generateSeed(), timesCompletedBible: 0 };
  await writeJson(KEY_PARTITION_STATE, fresh);
  return fresh;
}

export async function getPartitionState(): Promise<PartitionState> {
  return getOrCreatePartitionState();
}

export type GameStageProgress = {
  // Index of the stage the player is currently ON (0-9). Once
  // stagesCompleted reaches STAGES_PER_GAME, currentStage stays pinned at
  // the final stage index - there is nothing past it to advance to.
  currentStage: number;
  stagesCompleted: number; // 0-10
};

const DEFAULT_GAME_STAGE_PROGRESS: GameStageProgress = { currentStage: 0, stagesCompleted: 0 };

export type AllGameStageProgress = Partial<Record<GameKey, GameStageProgress>>;

async function readAllGameProgress(): Promise<AllGameStageProgress> {
  return readJson<AllGameStageProgress>(KEY_GAME_PROGRESS, {});
}

export async function getGameProgress(game: GameKey): Promise<GameStageProgress> {
  const all = await readAllGameProgress();
  return all[game] ?? DEFAULT_GAME_STAGE_PROGRESS;
}

export async function getAllGameProgress(): Promise<AllGameStageProgress> {
  return readAllGameProgress();
}

export function isGameCompleted(progress: GameStageProgress): boolean {
  return progress.stagesCompleted >= STAGES_PER_GAME;
}

/** Called when the player finishes the stage they're currently on. Safe to
 * call again on an already-completed game (no-op past the final stage). */
export async function completeCurrentStage(game: GameKey): Promise<GameStageProgress> {
  const all = await readAllGameProgress();
  const current = all[game] ?? DEFAULT_GAME_STAGE_PROGRESS;
  if (isGameCompleted(current)) return current;
  const stagesCompleted = current.stagesCompleted + 1;
  const next: GameStageProgress = {
    stagesCompleted,
    currentStage: Math.min(stagesCompleted, STAGES_PER_GAME - 1),
  };
  await writeJson(KEY_GAME_PROGRESS, { ...all, [game]: next });
  return next;
}

export async function areAllGamesCompleted(): Promise<boolean> {
  const all = await readAllGameProgress();
  return ALL_GAME_KEYS.every((key) => isGameCompleted(all[key] ?? DEFAULT_GAME_STAGE_PROGRESS));
}

/** The verses assigned to a game's CURRENT stage, resolved from the stored
 * seed + that game's stored progress. This is the one function every game
 * screen should call to get its playable content - never read
 * versePartition.ts directly, so the stage-pinning behavior in
 * isGameCompleted/completeCurrentStage stays the single source of truth. */
export async function getCurrentStageVerses(game: GameKey): Promise<VerseRef[]> {
  const [state, progress] = await Promise.all([getOrCreatePartitionState(), getGameProgress(game)]);
  const partition = getPartitionForSeed(state.seed);
  const gameIndex = ALL_GAME_KEYS.indexOf(game);
  return partition.games[gameIndex]?.stages[progress.currentStage]?.verses ?? [];
}

// ─── Verse Vault deck (SM-2-lite state per verse) ──────────────────────────
// Unlike the other 29 games, Verse Vault's "round" isn't a fixed-length
// batch — it's a spaced-repetition deck. Tying that deck to the current
// stage (reseeded whenever the stage advances, same as every other game's
// content) keeps it consistent with "completing this stage covers these
// verses" instead of drifting into a separate, unbounded curated pool.

export type VaultDeck = Record<string, SrsCardState>; // keyed by `${bookName}-${chapter}-${verse}`

type VaultDeckState = { stageIndex: number; deck: VaultDeck };

/** Returns the deck for verse-vault's CURRENT stage, seeding one fresh
 * (one card per verse in the stage) the first time this stage is played or
 * whenever the stored deck belongs to a now-superseded stage. */
export async function getOrSeedVaultDeck(): Promise<{ deck: VaultDeck; stageVerses: VerseRef[] }> {
  const [progress, stageVerses] = await Promise.all([
    getGameProgress('verse-vault'),
    getCurrentStageVerses('verse-vault'),
  ]);
  const existing = await readJson<VaultDeckState | null>(KEY_VAULT_DECK, null);
  if (existing && existing.stageIndex === progress.currentStage) {
    return { deck: existing.deck, stageVerses };
  }

  const deck: VaultDeck = {};
  for (const ref of stageVerses) {
    const id = vaultCardId(ref);
    deck[id] = newCardState(id);
  }
  await writeJson(KEY_VAULT_DECK, { stageIndex: progress.currentStage, deck });
  return { deck, stageVerses };
}

export async function saveVaultDeck(deck: VaultDeck): Promise<void> {
  const progress = await getGameProgress('verse-vault');
  await writeJson(KEY_VAULT_DECK, { stageIndex: progress.currentStage, deck });
}

export function vaultCardId(ref: VerseRef): string {
  return `${ref.bookName}-${ref.chapter}-${ref.verse}`;
}

export type GameCoverageSummary = {
  game: GameKey;
  gameIndex: number;
  verseCount: number; // total verses this game carries, across all 10 stages
  versesCoveredByCompletedStages: number;
  progress: GameStageProgress;
};

/** Everything the general stats page needs in one call: per-game verse
 * counts (from the current partition) + stage progress, plus the fixed
 * total Bible verse count for the "X of 31,102 verses covered" framing. */
export async function getCoverageSummary(): Promise<{
  totalBibleVerses: number;
  games: GameCoverageSummary[];
  timesCompletedBible: number;
}> {
  const [state, allProgress] = await Promise.all([getOrCreatePartitionState(), readAllGameProgress()]);
  const partition = getPartitionForSeed(state.seed);
  const games: GameCoverageSummary[] = ALL_GAME_KEYS.map((key, gameIndex) => {
    const gamePartition = partition.games[gameIndex];
    const progress = allProgress[key] ?? DEFAULT_GAME_STAGE_PROGRESS;
    const versesCoveredByCompletedStages = gamePartition.stages
      .slice(0, progress.stagesCompleted)
      .reduce((sum, stage) => sum + stage.verses.length, 0);
    return {
      game: key,
      gameIndex,
      verseCount: gamePartition.verseCount,
      versesCoveredByCompletedStages,
      progress,
    };
  });
  return { totalBibleVerses: getTotalVerseCount(), games, timesCompletedBible: state.timesCompletedBible };
}

/** Only ever call this after confirming areAllGamesCompleted() - it does not
 * re-check itself, so a caller building a "Reset" button is responsible for
 * disabling it until every game has reached its final stage (per the
 * product requirement: reset unlocks only once the whole Bible has been
 * covered once). Generates a new seed (reshuffling which verses every game
 * carries next), clears every game's stage progress back to zero, and
 * increments the "times completed" counter. */
export async function resetAndReshuffle(): Promise<PartitionState> {
  const previous = await getOrCreatePartitionState();
  const next: PartitionState = { seed: generateSeed(), timesCompletedBible: previous.timesCompletedBible + 1 };
  await writeJson(KEY_PARTITION_STATE, next);
  await writeJson(KEY_GAME_PROGRESS, {});
  return next;
}

export { STAGES_PER_GAME, TOTAL_GAMES };
export type { VerseRef };
