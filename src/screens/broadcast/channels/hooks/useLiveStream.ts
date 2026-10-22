// src/screens/broadcast/channels/hooks/useLiveStream.ts
//
// Full live-stream state manager for both viewers and broadcasters.
//
//  • Fetches stream detail and polls for status changes.
//  • Listens for realtime viewer-count and chat via socket (useChannelSocket).
//  • Manages live chat messages (socket + REST fallback).
//  • Exposes camera source list for multi-camera switching.
//  • Provides sendChatMessage, switchCameraSource, refresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest }  from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { normalizeLiveStream } from './useChannelsData';
import type { BroadcastChannelLiveStream } from '../api/channels.types';
import type { CameraSource } from '@/services/liveStreamingService';
import { useChannelSocket } from './useChannelSocket';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
  isMine?: boolean;
  is_pinned?: boolean;
  is_moderator?: boolean;
  is_member?: boolean;
};

export type IncomingReaction = { id: number; emoji: string; userId: string };

export type UseLiveStreamResult = {
  stream:          BroadcastChannelLiveStream | null;
  loading:         boolean;
  viewerCount:     number;
  chatMessages:    LiveChatMessage[];
  cameraSources:   CameraSource[];
  activeCameraId:  string | null;
  // Ephemeral - the most recent reaction from ANOTHER viewer (D6 of the
  // YouTube-parity batch). Not accumulated into a list - the UI consumes
  // each one once (keyed by `id`) to trigger a floating-emoji animation,
  // the same way a toast is consumed once, not appended to a feed.
  lastReaction:    IncomingReaction | null;
  sendChatMessage: (text: string) => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  reportChatMessage: (messageId: string, reason?: string) => Promise<void>;
  sendReaction:    (emoji: string) => void;
  switchCamera:    (sourceId: string) => Promise<void>;
  refresh:         () => Promise<void>;
};

// ── Poll interval (ms) ────────────────────────────────────────────────────────

const POLL_LIVE_MS    = 10_000; // while live — viewer count + status
const POLL_PENDING_MS = 30_000; // while scheduled

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveStream(
  streamId: string | null | undefined,
  currentUserId?: string | null,
): UseLiveStreamResult {
  const [stream,         setStream]         = useState<BroadcastChannelLiveStream | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [viewerCount,    setViewerCount]    = useState(0);
  const [chatMessages,   setChatMessages]   = useState<LiveChatMessage[]>([]);
  const [cameraSources,  setCameraSources]  = useState<CameraSource[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [lastReaction,   setLastReaction]   = useState<IncomingReaction | null>(null);
  const reactionIdRef = useRef(0);

  const mountedRef    = useRef(true);
  const pollTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── Fetch stream detail ─────────────────────────────────────────────────────

  const fetchStream = useCallback(async () => {
    if (!streamId) { setLoading(false); return; }
    try {
      const res = await getRequest(
        ROUTES.broadcasts.liveStreamDetail(streamId),
        { errorMessage: 'Unable to load stream.' },
      );
      if (!mountedRef.current) return;
      const normalized = normalizeLiveStream(res?.data);
      if (normalized) {
        setStream(normalized);
        setViewerCount(normalized.viewer_count ?? 0);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [streamId]);

  // ── Fetch camera sources (broadcaster) ─────────────────────────────────────

  const fetchCameraSources = useCallback(async () => {
    if (!streamId) return;
    const res = await getRequest(
      ROUTES.broadcasts.liveStreamCameras(streamId),
      { errorMessage: '' },
    );
    if (!mountedRef.current || !res?.success) return;
    const rows: any[] = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data) ? res.data : [];
    const sources: CameraSource[] = rows.map((r: any) => ({
      id:          String(r.id ?? r.source_id ?? ''),
      label:       String(r.label ?? r.name ?? 'Camera'),
      facing:      r.facing ?? undefined,
      isActive:    Boolean(r.is_active ?? r.isActive),
      isExternal:  Boolean(r.is_external ?? r.isExternal),
      thumbnailUrl: r.thumbnail_url ?? r.thumbnailUrl ?? undefined,
    }));
    setCameraSources(sources);
    const active = sources.find(s => s.isActive);
    if (active) setActiveCameraId(active.id);
  }, [streamId]);

  // ── Fetch chat history ──────────────────────────────────────────────────────

  const fetchChatHistory = useCallback(async () => {
    if (!streamId) return;
    const res = await getRequest(
      ROUTES.broadcasts.liveStreamChat(streamId),
      { errorMessage: '' },
    );
    if (!mountedRef.current || !res?.success) return;
    const rows: any[] = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data) ? res.data : [];
    const messages: LiveChatMessage[] = rows.map((r: any) => ({
      id:           String(r.id ?? ''),
      userId:       String(r.user_id ?? r.userId ?? ''),
      displayName:  String(r.display_name ?? r.displayName ?? 'Viewer'),
      text:         String(r.message ?? r.text ?? ''),
      sentAt:       String(r.created_at ?? r.sent_at ?? r.sentAt ?? ''),
      isMine:       currentUserId
        ? String(r.user_id ?? r.userId) === String(currentUserId)
        : false,
      is_pinned:    Boolean(r.is_pinned),
      is_moderator: Boolean(r.is_moderator),
      is_member:    Boolean(r.is_member),
    }));
    setChatMessages(messages);
  }, [streamId, currentUserId]);

  // ── Initial load ────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStream(), fetchChatHistory()]);
    await fetchCameraSources();
  }, [fetchStream, fetchChatHistory, fetchCameraSources]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Auto-polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!streamId) return;

    const schedule = () => {
      if (!mountedRef.current) return;
      const status = stream?.status ?? '';
      if (status === 'ended' || status === 'cancelled') return; // stop polling

      const ms = status === 'live' ? POLL_LIVE_MS : POLL_PENDING_MS;
      pollTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        // REST fallback for chat, same role as the viewer-count ping below —
        // covers any viewer whose socket connection drops or missed an
        // emit, so messages don't silently stop appearing. Only worth the
        // request while actually live.
        if (status === 'live') {
          await Promise.all([fetchStream(), fetchChatHistory()]);
        } else {
          await fetchStream();
        }
        // Re-check after the await — the component may have unmounted
        // while the request was in flight. Without this, the recursive
        // schedule() call below sets a new timer *after* the effect's own
        // cleanup already ran (it only clears whatever timer existed at
        // that instant), so polling silently continued forever on an
        // unmounted screen.
        if (mountedRef.current) schedule();
      }, ms);
    };

    schedule();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [streamId, stream?.status, fetchStream, fetchChatHistory]);

  // ── Realtime socket events ──────────────────────────────────────────────────

  useChannelSocket({
    streamId,
    channelId: stream?.channel?.id,

    onViewerCount: (count) => {
      if (mountedRef.current) setViewerCount(count);
    },

    onChatMessage: (msg) => {
      if (!mountedRef.current) return;
      const message: LiveChatMessage = {
        id:           msg.id,
        userId:       msg.userId,
        displayName:  msg.displayName,
        text:         msg.text,
        sentAt:       msg.sentAt,
        isMine:       currentUserId
          ? msg.userId === String(currentUserId)
          : false,
        is_pinned:    (msg as any).is_pinned ?? false,
        is_moderator: (msg as any).is_moderator ?? false,
        // Socket payload is camelCase (matches userId/displayName/sentAt
        // above - see notify_live_chat_message in apps/broadcasts/
        // realtime.py), unlike the snake_case REST response fetchChatHistory
        // reads above it.
        is_member:    msg.isMember ?? false,
      };
      setChatMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    },

    onLiveStarted: () => {
      void fetchStream();
    },

    onLiveEnded: () => {
      void fetchStream();
    },

    onChatMessageDeleted: ({ id }) => {
      if (!mountedRef.current) return;
      setChatMessages(prev => prev.filter(m => m.id !== id));
    },

    // C6 of the YouTube-parity batch: updates status immediately from the
    // stream-room push (notify_live_stream_status_changed) instead of
    // waiting up to POLL_LIVE_MS/POLL_PENDING_MS for the next poll tick.
    // The poll above is left in place unchanged as a fallback for a
    // dropped/reconnecting socket - this just makes the common case instant.
    onLiveStatusChanged: ({ status: newStatus }) => {
      if (!mountedRef.current || !newStatus) return;
      setStream(prev => (prev ? { ...prev, status: newStatus as typeof prev.status } : prev));
    },

    // D6 of the YouTube-parity batch: the server echoes every reaction,
    // including the sender's own, back to the whole room - best-effort
    // filtering out this viewer's own tap when currentUserId is known
    // (it's already animated locally and instantly by the caller). When
    // currentUserId isn't passed, the sender's own tap simply animates
    // twice in quick succession - a harmless cosmetic redundancy for a
    // low-weight ephemeral feature, not worth a client-generated-nonce
    // correlation scheme to fully eliminate.
    onLiveReaction: ({ emoji, userId }) => {
      if (!mountedRef.current) return;
      if (currentUserId && userId === String(currentUserId)) return;
      setLastReaction({ id: reactionIdRef.current++, emoji, userId });
    },
  });

  const sendReaction = useCallback((emoji: string) => {
    if (!streamId) return;
    DeviceEventEmitter.emit('channel.live.reaction.send', { streamId, emoji });
  }, [streamId]);

  // ── Emit viewer presence events for real-time viewer count ─────────────────
  // Join the stream room on the socket so NestJS can count active viewers.
  // Also POST a REST ping every 25s as fallback for non-socket contexts.

  useEffect(() => {
    if (!streamId || stream?.status !== 'live') return;

    // Signal join to any socket provider listening
    DeviceEventEmitter.emit('channel.live.join', { streamId });

    // REST ping fallback every 25 s keeps viewer count accurate when socket unavailable
    const pingId = setInterval(() => {
      if (!mountedRef.current) return;
      void postRequest(
        ROUTES.broadcasts.liveStreamViewerPing(streamId),
        {},
        { errorMessage: '' },
      ).then((res: any) => {
        if (res?.success && mountedRef.current) {
          const count = res?.data?.viewer_count;
          if (typeof count === 'number') setViewerCount(count);
        }
      });
    }, 25_000);

    return () => {
      clearInterval(pingId);
      DeviceEventEmitter.emit('channel.live.leave', { streamId });
    };
  }, [streamId, stream?.status]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(async (text: string) => {
    if (!streamId || !text.trim()) return;
    const optimisticId = `opt_${Date.now()}`;
    const optimistic: LiveChatMessage = {
      id:          optimisticId,
      userId:      currentUserId ?? '',
      displayName: 'You',
      text:        text.trim(),
      sentAt:      new Date().toISOString(),
      isMine:      true,
    };
    setChatMessages(prev => [...prev, optimistic]);

    const res = await postRequest(
      ROUTES.broadcasts.liveStreamChat(streamId),
      { message: text.trim() },
      { errorMessage: 'Unable to send message.' },
    );

    if (res?.success && res.data) {
      const saved: LiveChatMessage = {
        id:          String(res.data.id ?? optimisticId),
        userId:      String(res.data.user_id ?? currentUserId ?? ''),
        displayName: String(res.data.display_name ?? 'You'),
        text:        String(res.data.message ?? text),
        sentAt:      String(res.data.created_at ?? new Date().toISOString()),
        isMine:      true,
        is_member:   Boolean(res.data.is_member),
      };
      setChatMessages(prev =>
        prev.map(m => m.id === optimisticId ? saved : m),
      );
    } else {
      // Remove optimistic on failure, and throw so the caller (LiveChatPanel)
      // can tell the viewer their message didn't actually go out and restore
      // the draft text — previously this failed silently: the bubble just
      // disappeared with no error and no way to tell it needed retrying.
      setChatMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw new Error(res?.message || 'Unable to send message.');
    }
  }, [streamId, currentUserId]);

  const deleteChatMessage = useCallback(async (messageId: string) => {
    if (!streamId) return;
    // Optimistic removal - the socket broadcast (channel.chat.message_deleted)
    // will also fire and re-filter, but that's a no-op by then; this is what
    // makes it feel instant for the moderator who just tapped Delete.
    const prevMessages = chatMessages;
    setChatMessages(prev => prev.filter(m => m.id !== messageId));
    const res = await deleteRequest(
      ROUTES.broadcasts.liveStreamChatMessageModerate(streamId, messageId),
      { errorMessage: 'Unable to delete message.' },
    );
    if (!res?.success) {
      setChatMessages(prevMessages); // restore on failure
      throw new Error(res?.message || 'Unable to delete message.');
    }
  }, [streamId, chatMessages]);

  const reportChatMessage = useCallback(async (messageId: string, reason?: string) => {
    if (!streamId) return;
    const res = await postRequest(
      ROUTES.broadcasts.liveStreamChatMessageModerate(streamId, messageId),
      { reason: reason || 'Reported by viewer' },
      { errorMessage: 'Unable to report message.' },
    );
    if (!res?.success) {
      throw new Error(res?.message || 'Unable to report message.');
    }
  }, [streamId]);

  const switchCamera = useCallback(async (sourceId: string) => {
    if (!streamId) return;
    // Optimistic
    setCameraSources(prev => prev.map(s => ({ ...s, isActive: s.id === sourceId })));
    setActiveCameraId(sourceId);

    const res = await postRequest(
      ROUTES.broadcasts.liveStreamSwitchCamera(streamId),
      { source_id: sourceId },
      { errorMessage: 'Unable to switch camera.' },
    );
    if (!res?.success) {
      // Revert
      void fetchCameraSources();
    }
  }, [streamId, fetchCameraSources]);

  return {
    stream,
    loading,
    viewerCount,
    chatMessages,
    cameraSources,
    activeCameraId,
    lastReaction,
    sendChatMessage,
    deleteChatMessage,
    reportChatMessage,
    sendReaction,
    switchCamera,
    refresh,
  };
}
