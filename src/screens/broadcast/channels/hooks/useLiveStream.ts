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
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { normalizeLiveStream } from './useChannelsData';
import type { BroadcastChannelLiveStream } from '../api/channels.types';
import type { CameraSource } from '@/services/liveStreamingService';
import { useChannelSocket } from './useChannelSocket';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveChatMessageType = 'text' | 'emoji' | 'sticker' | 'voice_note';

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
  messageType?: LiveChatMessageType;
  // Only set when messageType === 'sticker' - the Sticker's underlying
  // MediaAsset id, never a baked image URL (see
  // apps/broadcasts/realtime.py's notify_live_chat_message comment on
  // the Django side for why: private bucket, real access-control
  // chokepoint, ~1h presigned expiry). Resolve a displayable URL via
  // GET /api/v1/media/assets/<assetId>/signed-url/ at render time.
  stickerAssetId?: string;
  // Only set when messageType === 'voice_note'.
  assetUrl?: string;
  durationSeconds?: number;
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
  sendStickerMessage: (stickerId: string) => Promise<void>;
  sendVoiceMessage: (mediaId: string, durationSeconds: number) => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  pinChatMessage: (messageId: string, isPinned: boolean) => Promise<void>;
  reportChatMessage: (messageId: string, reason?: string) => Promise<void>;
  sendReaction:    (emoji: string) => void;
  switchCamera:    (sourceId: string) => Promise<void>;
  refresh:         () => Promise<void>;
};

// ── Poll interval (ms) ────────────────────────────────────────────────────────

const POLL_LIVE_MS    = 10_000; // while live — viewer count + status
const POLL_PENDING_MS = 30_000; // while scheduled
// Recording archival (MP4 upload + Django's replay_url write) finishes a
// few seconds AFTER the broadcaster disconnects, not at the same instant
// status flips to "ended" - polling used to stop dead the moment status
// became "ended", so a viewer already on the page would never pick up
// replay_url even though it showed up moments later: they'd be stuck on
// "stream ended" forever unless they left and reopened the screen. This
// keeps polling a bounded number of times specifically to catch that,
// then gives up for good (e.g. a genuinely failed recording, matching
// the "No recording was captured for this stream" case seen in Channel
// Studio) rather than polling forever.
const POLL_ENDED_GRACE_MS = 5_000;
const POLL_ENDED_MAX_ATTEMPTS = 12; // 60s of grace total

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
      messageType:    (r.message_type ?? 'text') as LiveChatMessageType,
      stickerAssetId: r.sticker_asset_id ? String(r.sticker_asset_id) : undefined,
      assetUrl:       r.asset_url ? String(r.asset_url) : undefined,
      durationSeconds: typeof r.duration_seconds === 'number' ? r.duration_seconds : undefined,
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

  const endedGraceAttemptsRef = useRef(0);

  useEffect(() => {
    if (!streamId) return;
    if (stream?.status !== 'ended') endedGraceAttemptsRef.current = 0;

    const schedule = () => {
      if (!mountedRef.current) return;
      const status = stream?.status ?? '';
      if (status === 'cancelled') return; // stop polling
      if (status === 'ended') {
        // Already have a replay, or genuinely gave up after the grace
        // window - either way, nothing left to poll for.
        if (stream?.replay_url || endedGraceAttemptsRef.current >= POLL_ENDED_MAX_ATTEMPTS) return;
        pollTimerRef.current = setTimeout(async () => {
          if (!mountedRef.current) return;
          endedGraceAttemptsRef.current += 1;
          await fetchStream();
          if (mountedRef.current) schedule();
        }, POLL_ENDED_GRACE_MS);
        return;
      }

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
  }, [streamId, stream?.status, stream?.replay_url, fetchStream, fetchChatHistory]);

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
        messageType:    ((msg as any).messageType ?? 'text') as LiveChatMessageType,
        stickerAssetId: (msg as any).stickerAssetId,
        assetUrl:       (msg as any).assetUrl,
        durationSeconds: (msg as any).durationSeconds,
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

    onChatMessagePinned: ({ id, isPinned }) => {
      if (!mountedRef.current) return;
      setChatMessages(prev => prev.map(m => ({
        ...m,
        is_pinned: m.id === id ? isPinned : (isPinned ? false : m.is_pinned),
      })));
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
      // The socket's onChatMessage echo of this same message can arrive
      // before this POST resolves (it's a separate round trip, raced
      // against this one, not sequenced after it) - when that happens its
      // dedup check (prev.some(m => m.id === message.id)) passes cleanly
      // (the optimistic bubble's id doesn't match the real one yet), so
      // the real message is already in the array by the time this runs.
      // A plain .map() replacing only the optimistic entry would then
      // leave BOTH that socket-added copy and this one with the same real
      // id - a real duplicate-key crash caught live (React: "Encountered
      // two children with the same key"), not a hypothetical one. Filtering
      // out any existing entry with the real id first, in addition to the
      // optimistic one, makes this correct regardless of which arrives first.
      setChatMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId && m.id !== saved.id),
        saved,
      ]);
    } else {
      // Remove optimistic on failure, and throw so the caller (LiveChatPanel)
      // can tell the viewer their message didn't actually go out and restore
      // the draft text — previously this failed silently: the bubble just
      // disappeared with no error and no way to tell it needed retrying.
      setChatMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw new Error(res?.message || 'Unable to send message.');
    }
  }, [streamId, currentUserId]);

  // Shared by sendStickerMessage/sendVoiceMessage below - both just POST a
  // different message_type to the exact same endpoint sendChatMessage
  // uses, then append the server's confirmed row. No optimistic bubble
  // here (unlike sendChatMessage) - a sticker/voice note isn't typed
  // character-by-character, so there's no "instant feedback while you
  // type" need to optimistically render ahead of the real send; the
  // socket's own echo of this same message is still deduped by id below,
  // same race this file's sendChatMessage comment already documents.
  const postRichChatMessage = useCallback(async (body: Record<string, unknown>): Promise<void> => {
    if (!streamId) return;
    const res = await postRequest(
      ROUTES.broadcasts.liveStreamChat(streamId),
      body,
      { errorMessage: 'Unable to send.' },
    );
    if (!res?.success || !res.data) {
      throw new Error(res?.message || 'Unable to send.');
    }
    const d = res.data;
    const saved: LiveChatMessage = {
      id:           String(d.id ?? ''),
      userId:       String(d.user_id ?? currentUserId ?? ''),
      displayName:  String(d.display_name ?? 'You'),
      text:         String(d.message ?? ''),
      sentAt:       String(d.created_at ?? new Date().toISOString()),
      isMine:       true,
      is_member:    Boolean(d.is_member),
      messageType:    (d.message_type ?? body.message_type ?? 'text') as LiveChatMessageType,
      stickerAssetId: d.sticker_asset_id ? String(d.sticker_asset_id) : undefined,
      assetUrl:       d.asset_url ? String(d.asset_url) : undefined,
      durationSeconds: typeof d.duration_seconds === 'number' ? d.duration_seconds : undefined,
    };
    setChatMessages(prev => [...prev.filter(m => m.id !== saved.id), saved]);
  }, [streamId, currentUserId]);

  const sendStickerMessage = useCallback(async (stickerId: string) => {
    await postRichChatMessage({ message_type: 'sticker', sticker_id: stickerId });
  }, [postRichChatMessage]);

  const sendVoiceMessage = useCallback(async (mediaId: string, durationSeconds: number) => {
    await postRichChatMessage({
      message_type: 'voice_note',
      media_id: mediaId,
      duration_seconds: durationSeconds,
    });
  }, [postRichChatMessage]);

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

  // Manager-only - same endpoint delete/report already use, a different
  // HTTP verb (see ChannelLiveChatMessageModerationView.patch on the
  // Django side). At most one pinned message per stream server-side
  // (pinning a second one there un-pins whatever was pinned first), so
  // the optimistic local update mirrors that: pinning clears is_pinned on
  // every other message, not just sets it on this one.
  const pinChatMessage = useCallback(async (messageId: string, isPinned: boolean) => {
    if (!streamId) return;
    const previous = chatMessages;
    setChatMessages(prev => prev.map(m => ({
      ...m,
      is_pinned: m.id === messageId ? isPinned : (isPinned ? false : m.is_pinned),
    })));
    const res = await patchRequest(
      ROUTES.broadcasts.liveStreamChatMessageModerate(streamId, messageId),
      { is_pinned: isPinned },
      { errorMessage: 'Unable to update pinned message.' },
    );
    if (!res?.success) {
      setChatMessages(previous);
      throw new Error(res?.message || 'Unable to update pinned message.');
    }
  }, [streamId, chatMessages]);

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
    sendStickerMessage,
    sendVoiceMessage,
    deleteChatMessage,
    pinChatMessage,
    reportChatMessage,
    sendReaction,
    switchCamera,
    refresh,
  };
}
