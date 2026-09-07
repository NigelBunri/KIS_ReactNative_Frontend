// src/screens/tabs/bible/games/gameStorage.ts
//
// All persistence for the 6 Bible games lives here — a thin AsyncStorage
// wrapper, same package/pattern already used elsewhere in the app (see
// src/services/bibleOfflineCache.ts). Entirely local/offline: nothing here
// ever makes a network call, matching the hard "fully offline" requirement
// for this whole feature.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { newCardState, type SrsCardState } from './srs';
import { CURATED_VERSES } from './curatedVerses';

const KEY_PREFIX = 'bible_games_v1_';
const KEY_VAULT_DECK = `${KEY_PREFIX}vault_deck`;
const KEY_BEST_SCORES = `${KEY_PREFIX}best_scores`;
const KEY_MISSED_WORDS = `${KEY_PREFIX}missed_words`; // Complete the Verse's light spaced-repetition weighting

export type GameKey =
  | 'complete-verse'
  | 'books-in-order'
  | 'verse-match'
  | 'scripture-trivia'
  | 'verse-vault'
  | 'word-weave';

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

// ─── Verse Vault deck (SM-2-lite state per verse) ──────────────────────────

export type VaultDeck = Record<string, SrsCardState>; // keyed by CuratedVerseRef.id

/** A starter deck isn't forced on the user — if they've never opened Verse
 * Vault before, seed it with ~12 well-known verses so the game isn't an
 * empty room on first launch. Returns the existing deck untouched if one
 * already exists. */
export async function getOrSeedVaultDeck(): Promise<VaultDeck> {
  const existing = await readJson<VaultDeck | null>(KEY_VAULT_DECK, null);
  if (existing && Object.keys(existing).length > 0) return existing;

  const starter: VaultDeck = {};
  for (const verse of CURATED_VERSES.slice(0, 12)) {
    starter[verse.id] = newCardState(verse.id);
  }
  await writeJson(KEY_VAULT_DECK, starter);
  return starter;
}

export async function saveVaultDeck(deck: VaultDeck): Promise<void> {
  await writeJson(KEY_VAULT_DECK, deck);
}

export async function addVerseToVault(verseId: string): Promise<VaultDeck> {
  const deck = await getOrSeedVaultDeck();
  if (deck[verseId]) return deck;
  const next = { ...deck, [verseId]: newCardState(verseId) };
  await saveVaultDeck(next);
  return next;
}

export async function removeVerseFromVault(verseId: string): Promise<VaultDeck> {
  const deck = await getOrSeedVaultDeck();
  if (!deck[verseId]) return deck;
  const next = { ...deck };
  delete next[verseId];
  await saveVaultDeck(next);
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
