// src/screens/broadcast/workspace/useAdvancedComposerSubmit.ts
//
// FeedComposerSheet's onSubmit prop is the actual, only persistence call -
// the composer has no internal fallback creation path (see its own submit
// handler: it builds a payload and `await onSubmit(payload)`s it, full
// stop). ProfileScreen.tsx's handleAdvancedFeedSubmit is the original,
// still-used implementation of that contract for the legacy broadcast_feed
// queue; this is the exact same wiring (same prepareBroadcastVideoPayload
// parsing, same addBroadcastFeedEntry call), extracted so the two new
// standalone-route screens (ChannelStudioScreen, BroadcastWorkspaceScreen)
// share one copy instead of two near-identical ones.
//
// Note: addBroadcastFeedEntry has no channel-targeting parameter - it always
// posts to the profile-level feed queue (ROUTES.broadcasts.feedProfile)
// regardless of any channelContext the composer was opened with. That's the
// existing, pre-redesign behavior of this exact composer/onSubmit pairing
// everywhere it's already used (ChannelStudioScreen's "Create" tab included)
// - preserved as-is here, not something this redesign changes.
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { prepareBroadcastVideoPayload } from '@/components/feeds/videoAttachmentHelpers';
import { buildDefaultFeedMediaOptions, type FeedMediaType } from '@/screens/tabs/profile-screen/types';
import type { FeedComposerPayload } from '@/components/feeds/FeedComposerSheet';

type ProfileController = {
  addBroadcastFeedEntry: (
    title: string,
    summary: string,
    mediaType: FeedMediaType,
    attachments: any[],
    mediaOptions: any,
    extras: any,
  ) => Promise<any>;
};

export function useAdvancedComposerSubmit(profileController: ProfileController) {
  return useCallback(async (payload: FeedComposerPayload) => {
    const prepared = await prepareBroadcastVideoPayload(payload);
    if (!prepared) return;
    const composerType = prepared.composerType ?? 'text';
    const mediaType: FeedMediaType =
      composerType === 'image' ? 'image'
      : composerType === 'video' || composerType === 'short_video' ? 'video'
      : composerType === 'audio' ? 'audio'
      : composerType === 'document' ? 'file'
      : 'text';
    const attachments = Array.isArray(prepared.attachments) ? prepared.attachments : [];
    const localAttachments = attachments
      .map((attachment: any) => {
        const uri = attachment?.uri ?? attachment?.url;
        if (!uri || /^https?:\/\//i.test(String(uri))) return null;
        return {
          uri: String(uri),
          name: attachment?.originalName ?? attachment?.name ?? `feed-${Date.now()}`,
          type: attachment?.mimeType ?? attachment?.type ?? 'application/octet-stream',
          caption: attachment?.caption || undefined,
        };
      })
      .filter((attachment: any): attachment is { uri: string; name: string; type: string; caption: string | undefined } => Boolean(attachment));
    const remoteAttachments = attachments.filter((attachment: any) => {
      const uri = attachment?.uri ?? attachment?.url;
      return !uri || /^https?:\/\//i.test(String(uri));
    });
    const summary =
      prepared.textPlain?.trim() || prepared.textPreview?.trim() ||
      prepared.event?.title?.trim?.() || prepared.poll?.question?.trim?.() ||
      prepared.link?.trim() || '';
    const title =
      summary.split(/\n+/)[0]?.slice(0, 80).trim() ||
      (composerType === 'poll' ? 'Poll' : composerType === 'event' ? 'Event' : composerType === 'link' ? 'Link' : 'Broadcast update');
    try {
      await profileController.addBroadcastFeedEntry(
        title,
        summary,
        mediaType,
        localAttachments,
        buildDefaultFeedMediaOptions()[mediaType],
        { ...prepared, attachmentPayloads: remoteAttachments },
      );
    } catch (error: any) {
      Alert.alert('Broadcast item', error?.message || 'Unable to save this item.');
      throw error instanceof Error ? error : new Error(String(error));
    }
  }, [profileController]);
}
