// src/screens/tabs/bible/games/gameMetadata.ts
//
// Display metadata (title/description/icon) for all 30 games, kept
// separate from BibleGamesPanel.tsx's component registry so the stats
// screens (which need a game's title but must never import the panel
// itself, which lazy-imports the game screens) don't create a circular
// import between "the hub" and "a game's stats page reachable from within
// a game screen reachable from the hub."

import type { KISIconName } from '@/constants/kisIcons';
import { ALL_GAME_KEYS, type GameKey } from './gameStorage';

export type GameMetadata = {
  key: GameKey;
  title: string;
  description: string;
  icon: KISIconName;
};

export const GAME_METADATA: Record<GameKey, GameMetadata> = {
  'complete-verse': { key: 'complete-verse', title: 'Complete the Verse', icon: 'edit', description: 'Fill in the missing words from memory' },
  'books-in-order': { key: 'books-in-order', title: 'Books in Order', icon: 'layers', description: 'Put shuffled books back in canon order' },
  'verse-match': { key: 'verse-match', title: 'Verse Match', icon: 'puzzle', description: 'Pair each reference with its verse' },
  'scripture-trivia': { key: 'scripture-trivia', title: 'Scripture Trivia', icon: 'bar-chart', description: 'Multiple-choice questions on Scripture' },
  'verse-vault': { key: 'verse-vault', title: 'Verse Vault', icon: 'trophy', description: 'Spaced-repetition flashcards for real mastery' },
  'word-weave': { key: 'word-weave', title: 'Word Weave', icon: 'shuffle', description: 'Rebuild a verse word by word, in order' },
  'verse-race': { key: 'verse-race', title: 'Verse Race', icon: 'timer', description: 'Timed read-through with a recall check at the end' },
  'chapter-scroll': { key: 'chapter-scroll', title: 'Chapter Scroll', icon: 'book', description: 'Scroll a full chapter, then a short summary quiz' },
  'flash-recall': { key: 'flash-recall', title: 'Flash Recall', icon: 'bolt', description: 'A verse flashes briefly — recall a detail about it' },
  'first-letters': { key: 'first-letters', title: 'First Letters', icon: 'edit-2', description: 'Reconstruct a verse from just its first letters' },
  'verse-jigsaw': { key: 'verse-jigsaw', title: 'Verse Jigsaw', icon: 'puzzle', description: 'Reorder shuffled clause-chunks back into place' },
  'punctuation-restore': { key: 'punctuation-restore', title: 'Punctuation Restore', icon: 'edit', description: 'Restore the stripped punctuation of a verse' },
  'letter-fill': { key: 'letter-fill', title: 'Letter Fill', icon: 'edit', description: 'Fill in blanked-out letters within each word' },
  'reference-rally': { key: 'reference-rally', title: 'Reference Rally', icon: 'pin', description: 'Given a verse, pick its correct book, chapter, and verse' },
  'verse-locator': { key: 'verse-locator', title: 'Verse Locator', icon: 'pin', description: 'Given a reference, find the right verse fastest' },
  'chapter-sprint': { key: 'chapter-sprint', title: 'Chapter Sprint', icon: 'timer', description: 'Identify which chapter a shown verse belongs to' },
  'book-detective': { key: 'book-detective', title: 'Book Detective', icon: 'search', description: 'Identify which of the 66 books a verse is from' },
  'sequence-chain': { key: 'sequence-chain', title: 'Sequence Chain', icon: 'layers', description: 'Reorder a run of consecutive verses into Bible order' },
  'name-place-match': { key: 'name-place-match', title: 'Name & Place Match', icon: 'users', description: 'Match names and places to clues from the same passage' },
  'keyword-sort': { key: 'keyword-sort', title: 'Keyword Sort', icon: 'layers', description: 'Sort key words from the passage into categories' },
  'count-challenge': { key: 'count-challenge', title: 'Count Challenge', icon: 'bar-chart', description: 'Numeric challenges drawn from the passage' },
  'verse-pairs': { key: 'verse-pairs', title: 'Verse Pairs', icon: 'puzzle', description: 'A memory match of verse-halves' },
  'who-said-it': { key: 'who-said-it', title: 'Who Said It', icon: 'users', description: 'Identify the speaker or narrator of a line' },
  'cross-reference-connect': { key: 'cross-reference-connect', title: 'Cross Reference Connect', icon: 'shuffle', description: 'Match a verse to a related verse in the same passage' },
  'listen-and-tap': { key: 'listen-and-tap', title: 'Listen & Tap', icon: 'volume-2', description: 'Listen to a verse, tap the matching text' },
  'audio-dictation': { key: 'audio-dictation', title: 'Audio Dictation', icon: 'volume-2', description: 'Listen, then fill in the missing word' },
  'verse-crossword': { key: 'verse-crossword', title: 'Verse Crossword', icon: 'grid', description: 'A mini crossword built from the passage' },
  'word-search': { key: 'word-search', title: 'Word Search', icon: 'search', description: 'Find passage words hidden in a letter grid' },
  'anagram-unscramble': { key: 'anagram-unscramble', title: 'Anagram Unscramble', icon: 'shuffle', description: 'Unscramble scrambled words and names' },
  'verse-ladder': { key: 'verse-ladder', title: 'Verse Ladder', icon: 'layers', description: 'Climb a ladder of progressively longer verses' },
};

export function getGameMetadataList(): GameMetadata[] {
  return ALL_GAME_KEYS.map((key) => GAME_METADATA[key]);
}
