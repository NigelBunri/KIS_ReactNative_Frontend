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
const KEY_STAGE_SCORES = `${KEY_PREFIX}stage_scores`; // per-stage best score, for the journey map's replay-to-improve UI

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

// Concurrent callers before a seed has ever been persisted (e.g. the hub and
// a journey screen both mounting around the very first app launch, both
// touching partition state before either write lands) must not each
// generate and write their OWN seed - whichever write happened to land last
// would silently become "the" seed, while calls already in flight against
// an earlier generated-but-never-persisted seed would keep computing
// partitions for content that was never actually saved, handing out
// verses from a different game/stage bucket than what every other caller
// sees. All concurrent creators share this one in-flight promise instead;
// cleared once it resolves so a later legitimate reseed (resetAndReshuffle,
// or a cleared store in tests) isn't stuck replaying a stale creation.
let partitionStateInitPromise: Promise<PartitionState> | null = null;

async function getOrCreatePartitionState(): Promise<PartitionState> {
  const existing = await readJson<PartitionState | null>(KEY_PARTITION_STATE, null);
  if (existing?.seed) return existing;
  if (!partitionStateInitPromise) {
    partitionStateInitPromise = (async () => {
      const fresh: PartitionState = { seed: generateSeed(), timesCompletedBible: 0 };
      await writeJson(KEY_PARTITION_STATE, fresh);
      return fresh;
    })().finally(() => {
      partitionStateInitPromise = null;
    });
  }
  return partitionStateInitPromise;
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

/** The verses assigned to one specific stage (0-9) of a game, resolved from
 * the stored seed - never read versePartition.ts directly from a game
 * screen, so this stays the single source of truth for "what content does
 * stage N carry." Used both for playing forward (stage === currentStage)
 * and for replaying an already-completed stage from the journey map -
 * replay reads exactly the same verses the player originally cleared,
 * since the partition is a pure function of the seed and never reshuffles
 * until every game is fully complete (see resetAndReshuffle). */
export async function getStageVerses(game: GameKey, stageIndex: number): Promise<VerseRef[]> {
  const state = await getOrCreatePartitionState();
  const partition = getPartitionForSeed(state.seed);
  const gameIndex = ALL_GAME_KEYS.indexOf(game);
  const clamped = Math.max(0, Math.min(STAGES_PER_GAME - 1, stageIndex));
  return partition.games[gameIndex]?.stages[clamped]?.verses ?? [];
}

/** The verses assigned to a game's CURRENT stage. Thin wrapper over
 * getStageVerses for the common "just play whatever I'm on" case. */
export async function getCurrentStageVerses(game: GameKey): Promise<VerseRef[]> {
  const progress = await getGameProgress(game);
  return getStageVerses(game, progress.currentStage);
}

// ─── Per-stage best scores (journey map "replay to improve" + stats) ──────
// Separate from getBestScores' single all-time-best-across-every-play
// number (kept as-is, unchanged, for backward compatibility with existing
// stats screens) - this tracks a best PER STAGE so the journey map can show
// "your best on Stage 4 was 8/10" on a stage the player revisits long after
// moving on. Like every other number in this file, never cleared by
// resetAndReshuffle - an all-time personal-best record, same philosophy as
// getBestScores, even though a reshuffle changes what content that stage
// slot carries next.

export type StageScores = Partial<Record<GameKey, Partial<Record<number, number>>>>;

async function readAllStageScores(): Promise<StageScores> {
  return readJson<StageScores>(KEY_STAGE_SCORES, {});
}

export async function getStageScores(game: GameKey): Promise<Partial<Record<number, number>>> {
  const all = await readAllStageScores();
  return all[game] ?? {};
}

export async function recordStageScore(game: GameKey, stageIndex: number, score: number): Promise<void> {
  const all = await readAllStageScores();
  const gameScores = all[game] ?? {};
  const existing = gameScores[stageIndex];
  const next: StageScores = { ...all, [game]: { ...gameScores, [stageIndex]: Math.max(existing ?? 0, score) } };
  await writeJson(KEY_STAGE_SCORES, next);
}

// ─── Journey map data (one call per game's journey screen) ────────────────

export type StageStatus = 'completed' | 'current' | 'locked';

export type StageDescriptor = {
  index: number; // 0-9
  status: StageStatus;
  verseCount: number;
  bestScore: number | null;
};

/** Everything a game's bespoke journey screen needs to render its 10 nodes:
 * which are completed (tappable, replayable), which one is current
 * (tappable, the only one that can still advance progress), and which are
 * locked (not tappable - reaching them requires clearing every stage before
 * them first, in order). */
export async function getGameStageDescriptors(game: GameKey): Promise<StageDescriptor[]> {
  const [state, progress, stageScores] = await Promise.all([
    getOrCreatePartitionState(),
    getGameProgress(game),
    getStageScores(game),
  ]);
  const partition = getPartitionForSeed(state.seed);
  const gamePartition = partition.games[ALL_GAME_KEYS.indexOf(game)];
  return Array.from({ length: STAGES_PER_GAME }, (_, index) => {
    // Order matters: a fully-completed game pins currentStage at the final
    // index (see completeCurrentStage), so "completed" must be checked
    // before "current" or the last stage would wrongly show as still-active.
    const status: StageStatus =
      index < progress.stagesCompleted ? 'completed' : index === progress.currentStage ? 'current' : 'locked';
    return {
      index,
      status,
      verseCount: gamePartition?.stages[index]?.verses.length ?? 0,
      bestScore: stageScores[index] ?? null,
    };
  });
}

export type StageOutcome = {
  stagesCompleted: number;
  isFinalStage: boolean;
  /** False when this call was a replay of an already-completed stage (or a
   * no-op on a locked one) - only a fresh forward-completion advances the
   * journey and deserves the "Stage complete!" progression framing instead
   * of a plain "nice score" one. */
  isNewCompletion: boolean;
};

/** The ONE function every game screen calls when a round of `stageIndex`
 * finishes - replaces calling recordScore + completeCurrentStage directly.
 * Handles all three cases a journey-map-driven game can hit:
 *   - stageIndex is the game's current, not-yet-completed stage: records
 *     the stage score AND advances progress (the original "forward play"
 *     behavior every one of the first 13 games already had).
 *   - stageIndex is an already-completed stage (replay from the journey
 *     map): only updates that stage's best score - progress/currentStage
 *     never move, so replaying an early stage can never re-trigger
 *     "advance" or double-count towards completion.
 *   - stageIndex is locked (> currentStage): a defense-in-depth no-op:
 *     the journey map's own UI must never let a locked node be entered in
 *     the first place, but this guarantees a bypass attempt still can't
 *     write bogus progress even if one ever slipped through. */
export async function finishStage(game: GameKey, stageIndex: number, score: number): Promise<StageOutcome> {
  const progress = await getGameProgress(game);
  const isLocked = stageIndex > progress.currentStage;
  if (isLocked) {
    return { stagesCompleted: progress.stagesCompleted, isFinalStage: isGameCompleted(progress), isNewCompletion: false };
  }

  await recordStageScore(game, stageIndex, score);

  const isForwardPlay = stageIndex === progress.currentStage && !isGameCompleted(progress);
  if (!isForwardPlay) {
    return { stagesCompleted: progress.stagesCompleted, isFinalStage: isGameCompleted(progress), isNewCompletion: false };
  }

  await recordScore(game, score); // keep the legacy all-time best/playCount aggregate in sync
  const next = await completeCurrentStage(game);
  return { stagesCompleted: next.stagesCompleted, isFinalStage: isGameCompleted(next), isNewCompletion: true };
}

// ─── Verse Vault deck (SM-2-lite state per verse) ──────────────────────────
// Unlike the other 29 games, Verse Vault's "round" isn't a fixed-length
// batch — it's a spaced-repetition deck, one per stage (reviewing an old
// stage's deck again from the journey map is exactly the "keep it fresh"
// use case spaced repetition is for, so - unlike a discrete quiz round -
// there's real value in Verse Vault supporting replay the same as every
// other game, not just its current stage).

export type VaultDeck = Record<string, SrsCardState>; // keyed by `${bookName}-${chapter}-${verse}`

type VaultDecksByStage = Record<number, VaultDeck>;

// Pre-journey-map shape: a single { stageIndex, deck } tied to whatever
// stage happened to be "current" - migrated in place, best-effort, the
// first time it's read after the per-stage map replaced it.
type LegacyVaultDeckState = { stageIndex: number; deck: VaultDeck };

async function readVaultDecks(): Promise<VaultDecksByStage> {
  const raw = await readJson<VaultDecksByStage | LegacyVaultDeckState | null>(KEY_VAULT_DECK, null);
  if (!raw) return {};
  if ('stageIndex' in raw && 'deck' in raw) {
    return { [raw.stageIndex]: raw.deck };
  }
  return raw;
}

/** Returns the deck for one specific stage, seeding one fresh (one card per
 * verse in that stage) the first time it's requested. */
export async function getOrSeedVaultDeck(stageIndex: number): Promise<{ deck: VaultDeck; stageVerses: VerseRef[] }> {
  const [stageVerses, decks] = await Promise.all([getStageVerses('verse-vault', stageIndex), readVaultDecks()]);
  const existing = decks[stageIndex];
  if (existing) return { deck: existing, stageVerses };

  const deck: VaultDeck = {};
  for (const ref of stageVerses) {
    const id = vaultCardId(ref);
    deck[id] = newCardState(id);
  }
  await writeJson(KEY_VAULT_DECK, { ...decks, [stageIndex]: deck });
  return { deck, stageVerses };
}

export async function saveVaultDeck(stageIndex: number, deck: VaultDeck): Promise<void> {
  const decks = await readVaultDecks();
  await writeJson(KEY_VAULT_DECK, { ...decks, [stageIndex]: deck });
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
