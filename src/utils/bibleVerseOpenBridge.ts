// src/utils/bibleVerseOpenBridge.ts
//
// Bridges "open this verse" requests (from a chat link, global search, a
// shared verse card, etc.) into the Bible tab. The Bible tab lives inside a
// lazy bottom-tab navigator, so on a caller's FIRST-ever tap in a session it
// isn't mounted yet — a plain DeviceEventEmitter.emit() fired right after
// navigation.navigate() would be lost forever, since nothing is listening
// yet. Keeping the last request in a module-level variable lets the Bible
// screen pick it up itself once it mounts, in addition to the live event for
// when it's already mounted and listening.
import { DeviceEventEmitter } from 'react-native';

export const BIBLE_VERSE_OPEN_EVENT = 'bible.verse.open';

export type BibleVerseOpenPayload = {
  reference?: string;
  book?: string;
  chapter?: number;
  verse?: number;
};

let pending: BibleVerseOpenPayload | null = null;

/** Call after navigating to the Bible tab to make it jump to a specific verse/chapter. */
export function openBibleVerse(payload: BibleVerseOpenPayload) {
  pending = payload;
  DeviceEventEmitter.emit(BIBLE_VERSE_OPEN_EVENT, payload);
}

/** Called by the Bible screen on mount to pick up a request that arrived before it existed. */
export function consumePendingBibleVerseOpen(): BibleVerseOpenPayload | null {
  const value = pending;
  pending = null;
  return value;
}
