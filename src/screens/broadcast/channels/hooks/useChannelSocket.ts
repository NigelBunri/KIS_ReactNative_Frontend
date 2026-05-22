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
//   channel.content.published – new content published on a channel
//   channel.subscribed        – server confirms a subscription change

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
  onContentPublished?:  (p: ContentPublishedPayload) => void;
};

export function useChannelSocket({
  channelId,
  streamId,
  onLiveStarted,
  onLiveEnded,
  onViewerCount,
  onChatMessage,
  onContentPublished,
}: UseChannelSocketOptions) {
  // Stable refs so listeners don't re-subscribe on every render
  const liveStartedRef    = useRef(onLiveStarted);
  const liveEndedRef      = useRef(onLiveEnded);
  const viewerCountRef    = useRef(onViewerCount);
  const chatMessageRef    = useRef(onChatMessage);
  const contentPubRef     = useRef(onContentPublished);
  const channelIdRef      = useRef(channelId);
  const streamIdRef       = useRef(streamId);

  useEffect(() => { liveStartedRef.current   = onLiveStarted; });
  useEffect(() => { liveEndedRef.current     = onLiveEnded; });
  useEffect(() => { viewerCountRef.current   = onViewerCount; });
  useEffect(() => { chatMessageRef.current   = onChatMessage; });
  useEffect(() => { contentPubRef.current    = onContentPublished; });
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

    return () => {
      s1.remove();
      s2.remove();
      s3.remove();
      s4.remove();
      s5.remove();
    };
  }, []); // intentionally empty — all logic uses stable refs
}
