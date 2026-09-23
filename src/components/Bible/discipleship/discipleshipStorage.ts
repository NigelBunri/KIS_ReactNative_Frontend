// src/components/Bible/discipleship/discipleshipStorage.ts
//
// All content AND persistence for the 12 Pillars discipleship journey lives
// here — content comes from the bundled twelvePillars.json (never fetched;
// same "fixed and offline" requirement as the Bible games, see
// screens/tabs/bible/games/gameStorage.ts's docblock), progress is a thin
// AsyncStorage wrapper mirroring that same file's pattern exactly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import content from '@/assets/bible/twelvePillars.json';

const KEY_PREFIX = 'discipleship_12pillars_v1_';
const KEY_DAY_SCORES = `${KEY_PREFIX}day_scores`;
const KEY_INTRO_SEEN = `${KEY_PREFIX}intro_seen`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt/unreadable local storage is treated as "start fresh", never a
    // crash — nothing here is server-recoverable, so failing hard buys
    // nothing.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — a failed write just means this attempt's score isn't
    // saved, not a reason to interrupt study with an error.
  }
}

// ─── Bundled content ────────────────────────────────────────────────────

export type QuizChoiceContent = { text: string; isCorrect: boolean };
export type QuizQuestionContent = { prompt: string; choices: QuizChoiceContent[] };
export type DayContent = {
  title: string;
  content: string;
  passScore: number;
  questions: QuizQuestionContent[];
};
export type DoctrineContent = {
  order: number;
  title: string;
  summary: string;
  days: DayContent[];
};

export function getCourseTitle(): string {
  return content.courseTitle;
}

export function getDoctrines(): DoctrineContent[] {
  return content.doctrines as DoctrineContent[];
}

/** A choice tagged with its position in the ORIGINAL (unshuffled) choices
 * array, so a caller can grade a quiz by comparing chosen originalIndex ->
 * isCorrect without depending on display text or post-shuffle position. */
export type GradableChoice = QuizChoiceContent & { originalIndex: number };

// Fisher-Yates. Most of the authored quiz bank happens to list the correct
// choice first (an authoring artifact, not intentional) — rendering choices
// in on-disk order would make "always tap the first option" a working
// strategy. Reshuffled fresh every time a quiz is opened, including on
// retry, so position never becomes a second thing to memorize.
export function shuffledChoices(question: QuizQuestionContent): GradableChoice[] {
  const arr: GradableChoice[] = question.choices.map((c, i) => ({ ...c, originalIndex: i }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Intro seen flag ────────────────────────────────────────────────────

export async function getIntroSeen(): Promise<boolean> {
  return readJson(KEY_INTRO_SEEN, false);
}

export async function setIntroSeen(): Promise<void> {
  await writeJson(KEY_INTRO_SEEN, true);
}

// ─── Day scores / progress ──────────────────────────────────────────────

/** `${doctrineOrder}-${dayIndex}` -> best score achieved on that day's test, 0-100. */
export type DayScores = Record<string, number>;

function dayKey(doctrineOrder: number, dayIndex: number): string {
  return `${doctrineOrder}-${dayIndex}`;
}

async function readAllDayScores(): Promise<DayScores> {
  return readJson<DayScores>(KEY_DAY_SCORES, {});
}

export async function recordDayScore(doctrineOrder: number, dayIndex: number, percent: number): Promise<void> {
  const all = await readAllDayScores();
  const key = dayKey(doctrineOrder, dayIndex);
  const existing = all[key] ?? 0;
  await writeJson(KEY_DAY_SCORES, { ...all, [key]: Math.max(existing, percent) });
}

// ─── Journey descriptors (locked/current/completed) ────────────────────

export type DayStatus = 'completed' | 'current' | 'locked';
export type DayDescriptor = {
  index: number;
  title: string;
  status: DayStatus;
  scorePercent: number | null;
};
export type DoctrineStatus = 'completed' | 'current' | 'locked';
export type DoctrineDescriptor = {
  order: number;
  title: string;
  summary: string;
  status: DoctrineStatus;
  days: DayDescriptor[];
};

/** Everything the step list + day roadmap need: which doctrines/days are
 * locked (not reachable until everything before them, in order, is
 * passed), which is the current one to work on, and which are done. Same
 * strictly-sequential philosophy as getGameStageDescriptors, just two
 * levels (doctrine, then day within it) instead of one. */
export async function getJourneyDescriptors(): Promise<DoctrineDescriptor[]> {
  const scores = await readAllDayScores();
  const doctrines = getDoctrines();

  let previousDoctrineComplete = true; // doctrine 1 is always reachable
  return doctrines.map(doc => {
    const doctrineLocked = !previousDoctrineComplete;
    let previousDayComplete = true; // day 1 of a reachable doctrine is always reachable

    const days: DayDescriptor[] = doc.days.map((day, index) => {
      const scorePercent = scores[dayKey(doc.order, index)] ?? null;
      const passed = scorePercent != null && scorePercent >= day.passScore;
      const locked = doctrineLocked || !previousDayComplete;
      const status: DayStatus = locked ? 'locked' : passed ? 'completed' : 'current';
      previousDayComplete = passed;
      return { index, title: day.title, status, scorePercent };
    });

    const doctrineCompleted = !doctrineLocked && days.every(d => d.status === 'completed');
    const doctrineStatus: DoctrineStatus = doctrineLocked ? 'locked' : doctrineCompleted ? 'completed' : 'current';
    previousDoctrineComplete = doctrineCompleted;

    return { order: doc.order, title: doc.title, summary: doc.summary, status: doctrineStatus, days };
  });
}

export type OverallStats = {
  totalDoctrines: number;
  doctrinesCompleted: number;
  totalDays: number;
  daysCompleted: number;
  journeyComplete: boolean;
};

export async function getOverallStats(): Promise<OverallStats> {
  const descriptors = await getJourneyDescriptors();
  const totalDoctrines = descriptors.length;
  const doctrinesCompleted = descriptors.filter(d => d.status === 'completed').length;
  const totalDays = descriptors.reduce((sum, d) => sum + d.days.length, 0);
  const daysCompleted = descriptors.reduce(
    (sum, d) => sum + d.days.filter(x => x.status === 'completed').length,
    0,
  );
  return {
    totalDoctrines,
    doctrinesCompleted,
    totalDays,
    daysCompleted,
    journeyComplete: totalDoctrines > 0 && doctrinesCompleted === totalDoctrines,
  };
}
