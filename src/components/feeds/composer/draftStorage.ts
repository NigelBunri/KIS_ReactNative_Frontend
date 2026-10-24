// src/components/feeds/composer/draftStorage.ts
//
// Client-side persistence for FeedComposerSheet's autosaved draft and
// saved templates. Deliberately excludes attachments/videoThumbUri —
// picker-returned local file URIs are not reliably valid across app
// restarts (iOS in particular cleans up picker temp files), so a
// restored draft always lands back on the form with media re-pick
// required.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComposerType, EventSettings, LinkSettings, PollSettings, RichComposerState } from './types';

export type ComposerDraftFields = {
  type: ComposerType;
  rich: RichComposerState;
  link: string;
  linkSettings: LinkSettings;
  pollQuestion: string;
  pollOptions: string[];
  pollSettings: PollSettings;
  eventTitle: string;
  eventStartsAt: string;
  eventLocation: string;
  eventSettings: EventSettings;
  visibility: 'public' | 'unlisted' | 'private' | 'members_only';
  scheduleEnabled: boolean;
  scheduledAt: string | null;
  thumbnail: string | null;
  embedAllowed: boolean;
  playlistIds: string[];
};

export type ComposerDraftSnapshot = ComposerDraftFields & {
  savedAt: string;
};

export type ComposerTemplate = ComposerDraftFields & {
  id: string;
  name: string;
  savedAt: string;
};

const draftStorageKey = (channelId?: string | null) =>
  `@kis_feed_composer_draft:${channelId || 'generic'}`;

const TEMPLATES_KEY = '@kis_feed_composer_templates';

export const saveComposerDraft = async (
  channelId: string | null | undefined,
  fields: ComposerDraftFields,
): Promise<void> => {
  const snapshot: ComposerDraftSnapshot = { ...fields, savedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(draftStorageKey(channelId), JSON.stringify(snapshot));
  } catch {
    // Best-effort — losing an autosave isn't worth surfacing to the user.
  }
};

export const loadComposerDraft = async (
  channelId: string | null | undefined,
): Promise<ComposerDraftSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(draftStorageKey(channelId));
    if (!raw) return null;
    return JSON.parse(raw) as ComposerDraftSnapshot;
  } catch {
    return null;
  }
};

export const clearComposerDraft = async (channelId: string | null | undefined): Promise<void> => {
  try {
    await AsyncStorage.removeItem(draftStorageKey(channelId));
  } catch {
    // Non-fatal.
  }
};

export const loadComposerTemplates = async (): Promise<ComposerTemplate[]> => {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveComposerTemplate = async (
  name: string,
  fields: ComposerDraftFields,
): Promise<ComposerTemplate[]> => {
  const existing = await loadComposerTemplates();
  const template: ComposerTemplate = {
    ...fields,
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    savedAt: new Date().toISOString(),
  };
  const next = [template, ...existing];
  try {
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal — the in-memory list below still reflects it for this session.
  }
  return next;
};

export const deleteComposerTemplate = async (id: string): Promise<ComposerTemplate[]> => {
  const existing = await loadComposerTemplates();
  const next = existing.filter(t => t.id !== id);
  try {
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal.
  }
  return next;
};
