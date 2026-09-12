// src/components/Bible/games/journey/journeyThemes.ts
//
// One visual identity per game for its journey map: a name for the route
// ("The Scribe's Path", "Chariot Track"...), a one-line tagline, an accent/
// glow color pair, and a journeyGeometry.ts path config. This is what makes
// 30 games sharing one JourneyMap engine (see JourneyMap.tsx) still read as
// 30 distinct places rather than one screen recolored 30 times — every
// field here differs game to game, and no two neighbors share the same
// (pattern kind, amplitude, direction) triple.
//
// Accent colors are used ONLY for the path line, node rings/fills, and small
// icon tints — never as a text color on its own (see BibleSectionCard/
// palette usage in JourneyMap.tsx), so this stays legible in both themes
// regardless of how saturated a given game's hue is: real text always comes
// from useKISTheme()'s palette.text/subtext/ivory, not from this table.

import type { GameKey } from '../../../../screens/tabs/bible/games/gameStorage';
import type { JourneyPathConfig } from './journeyGeometry';

export type JourneyTheme = {
  journeyTitle: string;
  journeyTagline: string;
  accent: string;
  glow: string;
  path: JourneyPathConfig;
};

export const JOURNEY_THEMES: Record<GameKey, JourneyTheme> = {
  'complete-verse': {
    journeyTitle: "The Scribe's Path",
    journeyTagline: 'Ten passages, each with words only memory can fill.',
    accent: '#C9A227',
    glow: '#F0D875',
    path: { kind: 'wave', amplitude: 22, frequency: 2, direction: 1 },
  },
  'books-in-order': {
    journeyTitle: 'The Canon Trail',
    journeyTagline: 'Walk the shelf of Scripture back into its right order.',
    accent: '#2E6B8F',
    glow: '#6FB3D8',
    path: { kind: 'steps', amplitude: 24, direction: 1 },
  },
  'verse-match': {
    journeyTitle: 'The Garden of Pairs',
    journeyTagline: 'Ten beds of the garden, each hiding a matching pair.',
    accent: '#2F7D5A',
    glow: '#6FCF9E',
    path: { kind: 'arc', amplitude: 30, direction: -1 },
  },
  'scripture-trivia': {
    journeyTitle: 'Mountain of Knowledge',
    journeyTagline: 'Ten switchbacks toward the summit of Scripture.',
    accent: '#6B3FA0',
    glow: '#B98CE0',
    path: { kind: 'zigzag', amplitude: 20, direction: 1 },
  },
  'verse-vault': {
    journeyTitle: 'The Vault Stairway',
    journeyTagline: 'A descending stair of verses, reviewed until they last.',
    accent: '#B8860B',
    glow: '#FFD966',
    path: { kind: 'steps', amplitude: 18, direction: -1 },
  },
  'word-weave': {
    journeyTitle: "The Weaver's Loom",
    journeyTagline: 'Ten threads of Scripture, rewoven word by word.',
    accent: '#A33B3B',
    glow: '#E08080',
    path: { kind: 'wave', amplitude: 26, frequency: 3, direction: -1 },
  },
  'verse-race': {
    journeyTitle: 'The Chariot Track',
    journeyTagline: 'Ten laps against the clock, verse held in memory.',
    accent: '#C1651A',
    glow: '#FFAA5C',
    path: { kind: 'arc', amplitude: 34, direction: 1 },
  },
  'chapter-scroll': {
    journeyTitle: 'The Unrolling Scroll',
    journeyTagline: 'Ten chapters unrolled from parchment, then tested.',
    accent: '#8A6D3B',
    glow: '#D9C08A',
    path: { kind: 'wave', amplitude: 30, frequency: 1.5, direction: 1 },
  },
  'flash-recall': {
    journeyTitle: 'Beacon Ridge',
    journeyTagline: 'A verse lights the ridge for a moment — hold onto it.',
    accent: '#2464A8',
    glow: '#6FC3FF',
    path: { kind: 'zigzag', amplitude: 30, direction: -1 },
  },
  'first-letters': {
    journeyTitle: 'Stepping Stones',
    journeyTagline: 'Cross the river one initial at a time.',
    accent: '#1F8A8A',
    glow: '#6FE0E0',
    path: { kind: 'scatter', amplitude: 22, direction: 1 },
  },
  'verse-jigsaw': {
    journeyTitle: 'Puzzle Peaks',
    journeyTagline: 'Ten peaks, each verse broken into pieces to rebuild.',
    accent: '#6A4C93',
    glow: '#B08FDB',
    path: { kind: 'zigzag', amplitude: 26, direction: -1 },
  },
  'punctuation-restore': {
    journeyTitle: "The Scribe's Ink Trail",
    journeyTagline: 'Ten lines stripped bare — restore the scribe’s hand.',
    accent: '#34405A',
    glow: '#E8C767',
    path: { kind: 'wave', amplitude: 18, frequency: 4, direction: 1 },
  },
  'letter-fill': {
    journeyTitle: 'The Mosaic Courtyard',
    journeyTagline: 'Ten tile-floors, each missing pieces only you can set.',
    accent: '#B5651D',
    glow: '#E8A25C',
    path: { kind: 'steps', amplitude: 28, direction: 1 },
  },
  'reference-rally': {
    journeyTitle: 'Waypoint Rally',
    journeyTagline: 'Ten checkpoints — name the address of every verse.',
    accent: '#2F7D46',
    glow: '#7FD99A',
    path: { kind: 'steps', amplitude: 22, direction: -1 },
  },
  'verse-locator': {
    journeyTitle: "The Cartographer's Route",
    journeyTagline: 'Ten coordinates given — find the verse they mark.',
    accent: '#A6793B',
    glow: '#E0B876',
    path: { kind: 'scatter', amplitude: 26, direction: -1 },
  },
  'chapter-sprint': {
    journeyTitle: 'Sprint Switchbacks',
    journeyTagline: 'Ten sprints up the hillside, the clock always running.',
    accent: '#C23B3B',
    glow: '#FF8A65',
    path: { kind: 'zigzag', amplitude: 32, direction: 1 },
  },
  'book-detective': {
    journeyTitle: 'The Investigation Trail',
    journeyTagline: 'Ten cases — trace every verse back to its book.',
    accent: '#1B2A4A',
    glow: '#6FA8DC',
    path: { kind: 'scatter', amplitude: 20, direction: 1 },
  },
  'sequence-chain': {
    journeyTitle: 'The Chain Path',
    journeyTagline: 'Ten links of Scripture, forged back into order.',
    accent: '#8C6A3F',
    glow: '#D8B27A',
    path: { kind: 'wave', amplitude: 20, frequency: 2.5, direction: -1 },
  },
  'name-place-match': {
    journeyTitle: 'Atlas Waypoints',
    journeyTagline: 'Ten stops on the map — match every name to its place.',
    accent: '#2A5F8A',
    glow: '#7FC2E0',
    path: { kind: 'steps', amplitude: 30, direction: 1 },
  },
  'keyword-sort': {
    journeyTitle: 'Harvest Row',
    journeyTagline: 'Ten rows of the field, sorted basket by basket.',
    accent: '#7A8B3F',
    glow: '#C9D97A',
    path: { kind: 'steps', amplitude: 16, direction: -1 },
  },
  'count-challenge': {
    journeyTitle: 'The Counting Trail',
    journeyTagline: 'Ten tallies drawn straight from the passage itself.',
    accent: '#52627A',
    glow: '#A8B8CC',
    path: { kind: 'zigzag', amplitude: 18, direction: 1 },
  },
  'verse-pairs': {
    journeyTitle: 'Garden of Archways',
    journeyTagline: 'Ten archways, each joining a verse to its other half.',
    accent: '#2E8B57',
    glow: '#7FD9A8',
    path: { kind: 'arc', amplitude: 28, direction: 1 },
  },
  'who-said-it': {
    journeyTitle: 'The Council Steps',
    journeyTagline: 'Ten voices from Scripture — name who is speaking.',
    accent: '#5B3E8C',
    glow: '#A98CD9',
    path: { kind: 'steps', amplitude: 24, direction: 1 },
  },
  'cross-reference-connect': {
    journeyTitle: 'The Constellation Path',
    journeyTagline: 'Ten pairs of verses, connected like stars in a sky.',
    accent: '#1A1A3D',
    glow: '#E8D97A',
    path: { kind: 'scatter', amplitude: 32, direction: -1 },
  },
  'listen-and-tap': {
    journeyTitle: 'Bell Tower Ascent',
    journeyTagline: 'Ten rings of the bell — listen, then find the words.',
    accent: '#8C5A2B',
    glow: '#E0A85C',
    path: { kind: 'wave', amplitude: 24, frequency: 3, direction: 1 },
  },
  'audio-dictation': {
    journeyTitle: "The Shepherd's Path",
    journeyTagline: 'Ten fields walked by ear, listening for the missing word.',
    accent: '#3F7D4C',
    glow: '#8FD99E',
    path: { kind: 'wave', amplitude: 24, frequency: 1.5, direction: -1 },
  },
  'verse-crossword': {
    journeyTitle: 'Temple Tile Floor',
    journeyTagline: 'Ten courtyards, each floor set from the passage’s own words.',
    accent: '#6B5B3F',
    glow: '#C9B98A',
    path: { kind: 'steps', amplitude: 26, direction: -1 },
  },
  'word-search': {
    journeyTitle: 'The Wilderness Trail',
    journeyTagline: 'Ten stretches of wilderness, words hidden like oases.',
    accent: '#C99A4A',
    glow: '#F0D08A',
    path: { kind: 'scatter', amplitude: 34, direction: 1 },
  },
  'anagram-unscramble': {
    journeyTitle: "The Potter's Wheel",
    journeyTagline: 'Ten lumps of clay, spun into shape letter by letter.',
    accent: '#A85C3F',
    glow: '#E0A87F',
    path: { kind: 'spiral', amplitude: 24, frequency: 1.5, direction: 1 },
  },
  'verse-ladder': {
    journeyTitle: 'The Ladder Climb',
    journeyTagline: 'Ten rungs, each verse longer than the one before.',
    accent: '#2E6B9E',
    glow: '#E8C767',
    path: { kind: 'zigzag', amplitude: 14, direction: 1 },
  },
};

export function getJourneyTheme(key: GameKey): JourneyTheme {
  return JOURNEY_THEMES[key];
}
