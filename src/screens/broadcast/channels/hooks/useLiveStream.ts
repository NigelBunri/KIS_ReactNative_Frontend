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
import { getRequest }  from '@/network/get';
import { postRequest } from '@/network/post';
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
};

export type UseLiveStreamResult = {
  stream:          BroadcastChannelLiveStream | null;
  loading:         boolean;
  viewerCount:     number;
  chatMessages:    LiveChatMessage[];
  cameraSources:   CameraSource[];
  activeCameraId:  string | null;
  sendChatMessage: (text: string) => Promise<void>;
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
      id:          String(r.id ?? ''),
      userId:      String(r.user_id ?? r.userId ?? ''),
      displayName: String(r.user_display ?? r.displayName ?? 'Viewer'),
      text:        String(r.text ?? r.body ?? ''),
      sentAt:      String(r.sent_at ?? r.sentAt ?? r.created_at ?? ''),
      isMine:      currentUserId
        ? String(r.user_id ?? r.userId) === String(currentUserId)
        : false,
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
      const status = stream?.status ?? '';
      if (status === 'ended' || status === 'cancelled') return; // stop polling

      const ms = status === 'live' ? POLL_LIVE_MS : POLL_PENDING_MS;
      pollTimerRef.current = setTimeout(async () => {
        await fetchStream();
        schedule();
      }, ms);
    };

    schedule();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [streamId, stream?.status, fetchStream]);

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
        id:          msg.id,
        userId:      msg.userId,
        displayName: msg.displayName,
        text:        msg.text,
        sentAt:      msg.sentAt,
        isMine:      currentUserId
          ? msg.userId === String(currentUserId)
          : false,
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
  });

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
      { text: text.trim() },
      { errorMessage: 'Unable to send message.' },
    );

    if (res?.success && res.data) {
      const saved: LiveChatMessage = {
        id:          String(res.data.id ?? optimisticId),
        userId:      String(res.data.user_id ?? currentUserId ?? ''),
        displayName: String(res.data.user_display ?? 'You'),
        text:        String(res.data.text ?? text),
        sentAt:      String(res.data.sent_at ?? new Date().toISOString()),
        isMine:      true,
      };
      setChatMessages(prev =>
        prev.map(m => m.id === optimisticId ? saved : m),
      );
    } else {
      // Remove optimistic on failure
      setChatMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  }, [streamId, currentUserId]);

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
    sendChatMessage,
    switchCamera,
    refresh,
  };
}
