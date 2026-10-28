// src/screens/broadcast/channels/hooks/useChannelSocket.ts
//
// Subscribes to channel-specific realtime events that SocketProvider
// forwards through DeviceEventEmitter.
//
// Events forwarded by SocketProvider:
//   channel.live.started      – a channel just went live
//   channel.live.ended        – a live stream ended
//   channel.viewer.count      – viewer count update (streamId + count)
//   channel.chat.message      – new live chat message
//   channel.chat.message_deleted – a chat message was moderated/removed
//   channel.content.published – new content published on a channel
//   channel.subscribed        – server confirms a subscription change
//   channel.live.status_changed – a stream's status flipped (live/ended),
//                                  pushed into the viewer's own stream room
//                                  (not the subscriber fan-out above) so
//                                  someone already watching doesn't wait
//                                  on the next REST poll tick to find out
//   channel.live.reaction      – an ephemeral emoji burst from any viewer
//                                  in the stream room (not persisted)

import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';

type LiveStartedPayload = {
  channelId: string;
  streamId: string;
  title?: string;
  channelName?: string;
};

type LiveEndedPayload = {
  channelId: string;
  streamId: string;
};

type ViewerCountPayload = {
  streamId: string;
  count: number;
};

type ChatMessagePayload = {
  streamId: string;
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
  isMember?: boolean;
  // Matches notify_live_chat_message's payload exactly (apps/broadcasts/
  // realtime.py) - only one of stickerAssetId/(assetUrl+durationSeconds)
  // is ever present, matching messageType.
  messageType?: string;
  stickerAssetId?: string;
  assetUrl?: string;
  durationSeconds?: number;
};

type ChatMessageDeletedPayload = {
  streamId: string;
  id: string;
};

type ChatMessagePinnedPayload = {
  streamId: string;
  id: string;
  isPinned: boolean;
};

type LiveStatusChangedPayload = {
  streamId: string;
  status: string;
};

type LiveReactionPayload = {
  streamId: string;
  emoji: string;
  userId: string;
  sentAt: string;
};

type ContentPublishedPayload = {
  channelId: string;
  contentId: string;
  title?: string;
};

export type UseChannelSocketOptions = {
  channelId?: string | null;
  streamId?: string | null;
  onLiveStarted?:       (p: LiveStartedPayload) => void;
  onLiveEnded?:         (p: LiveEndedPayload) => void;
  onViewerCount?:       (count: number, streamId: string) => void;
  onChatMessage?:       (message: ChatMessagePayload) => void;
  onChatMessageDeleted?: (p: ChatMessageDeletedPayload) => void;
  onChatMessagePinned?: (p: ChatMessagePinnedPayload) => void;
  onContentPublished?:  (p: ContentPublishedPayload) => void;
  onLiveStatusChanged?: (p: LiveStatusChangedPayload) => void;
  onLiveReaction?: (p: LiveReactionPayload) => void;
};

export function useChannelSocket({
  channelId,
  streamId,
  onLiveStarted,
  onLiveEnded,
  onViewerCount,
  onChatMessage,
  onChatMessageDeleted,
  onChatMessagePinned,
  onContentPublished,
  onLiveStatusChanged,
  onLiveReaction,
}: UseChannelSocketOptions) {
  // Stable refs so listeners don't re-subscribe on every render
  const liveStartedRef    = useRef(onLiveStarted);
  const liveEndedRef      = useRef(onLiveEnded);
  const viewerCountRef    = useRef(onViewerCount);
  const chatMessageRef    = useRef(onChatMessage);
  const chatMessageDelRef = useRef(onChatMessageDeleted);
  const chatMessagePinRef = useRef(onChatMessagePinned);
  const contentPubRef     = useRef(onContentPublished);
  const statusChangedRef  = useRef(onLiveStatusChanged);
  const reactionRef       = useRef(onLiveReaction);
  const channelIdRef      = useRef(channelId);
  const streamIdRef       = useRef(streamId);

  useEffect(() => { liveStartedRef.current   = onLiveStarted; });
  useEffect(() => { liveEndedRef.current     = onLiveEnded; });
  useEffect(() => { viewerCountRef.current   = onViewerCount; });
  useEffect(() => { chatMessageRef.current   = onChatMessage; });
  useEffect(() => { chatMessageDelRef.current = onChatMessageDeleted; });
  useEffect(() => { chatMessagePinRef.current = onChatMessagePinned; });
  useEffect(() => { contentPubRef.current    = onContentPublished; });
  useEffect(() => { statusChangedRef.current = onLiveStatusChanged; });
  useEffect(() => { reactionRef.current      = onLiveReaction; });
  useEffect(() => { channelIdRef.current     = channelId; });
  useEffect(() => { streamIdRef.current      = streamId; });

  useEffect(() => {
    const s1 = DeviceEventEmitter.addListener(
      'channel.live.started',
      (p: LiveStartedPayload) => {
        if (channelIdRef.current && p.channelId !== channelIdRef.current) return;
        liveStartedRef.current?.(p);
      },
    );

    const s2 = DeviceEventEmitter.addListener(
      'channel.live.ended',
      (p: LiveEndedPayload) => {
        if (channelIdRef.current && p.channelId !== channelIdRef.current) return;
        liveEndedRef.current?.(p);
      },
    );

    const s3 = DeviceEventEmitter.addListener(
      'channel.viewer.count',
      (p: ViewerCountPayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        viewerCountRef.current?.(p.count, p.streamId);
      },
    );

    const s4 = DeviceEventEmitter.addListener(
      'channel.chat.message',
      (p: ChatMessagePayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        chatMessageRef.current?.(p);
      },
    );

    const s5 = DeviceEventEmitter.addListener(
      'channel.content.published',
      (p: ContentPublishedPayload) => {
        if (channelIdRef.current && p.channelId !== channelIdRef.current) return;
        contentPubRef.current?.(p);
      },
    );

    const s6 = DeviceEventEmitter.addListener(
      'channel.chat.message_deleted',
      (p: ChatMessageDeletedPayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        chatMessageDelRef.current?.(p);
      },
    );

    const s9 = DeviceEventEmitter.addListener(
      'channel.chat.message_pinned',
      (p: ChatMessagePinnedPayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        chatMessagePinRef.current?.(p);
      },
    );

    const s7 = DeviceEventEmitter.addListener(
      'channel.live.status_changed',
      (p: LiveStatusChangedPayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        statusChangedRef.current?.(p);
      },
    );

    const s8 = DeviceEventEmitter.addListener(
      'channel.live.reaction',
      (p: LiveReactionPayload) => {
        if (streamIdRef.current && p.streamId !== streamIdRef.current) return;
        reactionRef.current?.(p);
      },
    );

    return () => {
      s1.remove();
      s2.remove();
      s3.remove();
      s4.remove();
      s5.remove();
      s6.remove();
      s7.remove();
      s8.remove();
      s9.remove();
    };
  }, []); // intentionally empty — all logic uses stable refs
}
