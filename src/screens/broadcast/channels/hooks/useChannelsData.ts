import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { emitMainTabBadgeRefresh } from '@/services/mainTabNotificationBadges';
import {
  CHANNELS_ENDPOINT,
  channelContentDetailEndpoint,
  channelContentsEndpoint,
  channelDetailEndpoint,
  channelPlaylistsEndpoint,
  channelSubscribeEndpoint,
  channelLiveStreamsEndpoint,
  liveStreamDetailEndpoint,
  liveStreamEndEndpoint,
  liveStreamStartEndpoint,
  channelContentCommentsEndpoint,
  channelAnalyticsEndpoint,
  channelCommentModerateEndpoint,
  channelContentReportEndpoint,
  channelBroadcastEndpoint,
  channelContentBroadcastEndpoint,
  channelModerationActionEndpoint,
  channelModerationEndpoint,
  channelReportEndpoint,
  channelContentReactEndpoint,
  channelContentSaveEndpoint,
  channelContentShareEndpoint,
  channelContentViewEndpoint,
} from '@/screens/broadcast/channels/api/channels.endpoints';
import type {
  BroadcastChannelContent,
  BroadcastChannelContentAsset,
  BroadcastChannelDetail,
  BroadcastChannelPlaylist,
  BroadcastChannelLiveStream,
  BroadcastChannelSummary,
  ChannelContentComment,
  ChannelAnalyticsSummary,
  ChannelModerationRecord,
} from '@/screens/broadcast/channels/api/channels.types';

type Params = {
  q?: string;
  category?: string | null;
  mine?: boolean;
};

const buildQuery = (params: Record<string, any>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    qs.set(key, text);
  });
  const out = qs.toString();
  return out ? `?${out}` : '';
};

export const buildChannelQuery = buildQuery;

export const normalizeChannel = (item: any): BroadcastChannelSummary | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  return {
    id: String(item.id),
    handle: String(item.handle || ''),
    display_name: String(item.display_name || item.displayName || item.handle || 'KIS Channel'),
    description: item.description ? String(item.description) : '',
    avatar_url: item.avatar_url || item.avatarUrl || '',
    banner_url: item.banner_url || item.bannerUrl || '',
    category: item.category || '',
    language: item.language || '',
    country: item.country || '',
    is_verified: Boolean(item.is_verified ?? item.isVerified),
    is_broadcast: Boolean(item.is_broadcast ?? item.isBroadcast),
    broadcast_id: item.broadcast_id || item.broadcastId || '',
    verification_badges: Array.isArray(item.verification_badges) ? item.verification_badges : [],
    subscriber_count: Number(item.subscriber_count ?? item.subscriberCount ?? 0),
    content_count: Number(item.content_count ?? item.contentCount ?? 0),
    is_subscribed: Boolean(item.is_subscribed ?? item.isSubscribed),
    viewer_role: item.viewer_role || item.viewerRole || '',
  };
};


const normalizeAsset = (asset: any): BroadcastChannelContentAsset | null => {
  if (!asset || typeof asset !== 'object') return null;
  return {
    id: asset.id ? String(asset.id) : undefined,
    asset_type: String(asset.asset_type || asset.assetType || asset.type || ''),
    url: asset.url || asset.file_url || asset.fileUrl || asset.uri || '',
    thumbnail_url: asset.thumbnail_url || asset.thumbnailUrl || asset.preview_url || asset.previewUrl || '',
    caption: asset.caption || '',
    mime_type: asset.mime_type || asset.mimeType || '',
    size_bytes: asset.size_bytes ?? asset.sizeBytes ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    duration_seconds: asset.duration_seconds ?? asset.durationSeconds ?? null,
    processing_status: asset.processing_status || asset.processingStatus || '',
    metadata: asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {},
  };
};

export const normalizeChannelContent = (item: any): BroadcastChannelContent | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  const firstAsset = normalizeAsset(item.first_asset || item.firstAsset || null);
  const assets = Array.isArray(item.assets)
    ? item.assets.map(normalizeAsset).filter(Boolean) as BroadcastChannelContentAsset[]
    : [];
  return {
    id: String(item.id),
    channel: normalizeChannel(item.channel || item.channel_summary || item.channelSummary || {}) || undefined,
    content_type: String(item.content_type || item.contentType || item.type || 'post'),
    title: item.title ? String(item.title) : '',
    description: item.description ? String(item.description) : '',
    description_preview: item.description_preview || item.descriptionPreview || '',
    text_plain: item.text_plain || item.textPlain || '',
    text_plain_preview: item.text_plain_preview || item.textPlainPreview || '',
    text_doc: item.text_doc || item.textDoc || null,
    thumbnail_url: item.thumbnail_url || item.thumbnailUrl || firstAsset?.thumbnail_url || firstAsset?.url || '',
    first_asset: firstAsset,
    assets,
    status: item.status || '',
    is_broadcast: Boolean(item.is_broadcast ?? item.isBroadcast),
    broadcast_id: item.broadcast_id || item.broadcastId || '',
    visibility: item.visibility || '',
    published_at: item.published_at || item.publishedAt || '',
    duration_seconds: item.duration_seconds ?? item.durationSeconds ?? firstAsset?.duration_seconds ?? null,
    stats: item.stats && typeof item.stats === 'object' ? item.stats : {},
    engagement_counts: item.engagement_counts || item.engagementCounts || {},
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    scheduled_at: item.scheduled_at || item.scheduledAt || null,
    created_at: item.created_at || item.createdAt || '',
    updated_at: item.updated_at || item.updatedAt || '',
  };
};

export const normalizePlaylist = (item: any): BroadcastChannelPlaylist | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  return {
    id: String(item.id),
    title: String(item.title || 'Playlist'),
    description: item.description || '',
    visibility: item.visibility || '',
    sort_order: Number(item.sort_order ?? item.sortOrder ?? 0),
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    created_at: item.created_at || item.createdAt || '',
    updated_at: item.updated_at || item.updatedAt || '',
  };
};

const unwrapRows = (payload: any) => Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];

export const fetchChannelDetail = async (handleOrId: string): Promise<BroadcastChannelDetail | null> => {
  const response = await getRequest(channelDetailEndpoint(handleOrId), { errorMessage: 'Unable to load channel.' });
  if (!response?.success) return null;
  return normalizeChannel(response.data) as BroadcastChannelDetail | null;
};

export const createBroadcastChannel = async (payload: Record<string, any>): Promise<BroadcastChannelDetail | null> => {
  const response = await postRequest(CHANNELS_ENDPOINT, payload, { errorMessage: 'Unable to create channel.' });
  if (!response?.success) return null;
  return normalizeChannel(response.data) as BroadcastChannelDetail | null;
};

export const fetchChannelContents = async (
  channelId: string,
  params: Record<string, any> = {},
): Promise<{ contents: BroadcastChannelContent[]; nextCursor: string | null }> => {
  const response = await getRequest(`${channelContentsEndpoint(channelId)}${buildQuery(params)}`, { errorMessage: 'Unable to load channel content.' });
  if (!response?.success) return { contents: [], nextCursor: null };
  const payload: any = response.data || {};
  return {
    contents: unwrapRows(payload).map(normalizeChannelContent).filter(Boolean) as BroadcastChannelContent[],
    nextCursor: payload.next_cursor || payload.nextCursor || null,
  };
};

export const fetchChannelPlaylists = async (channelId: string): Promise<BroadcastChannelPlaylist[]> => {
  const response = await getRequest(`${channelPlaylistsEndpoint(channelId)}${buildQuery({ limit: 24 })}`, { errorMessage: 'Unable to load playlists.' });
  if (!response?.success) return [];
  return unwrapRows(response.data || {}).map(normalizePlaylist).filter(Boolean) as BroadcastChannelPlaylist[];
};

export const fetchChannelContentDetail = async (contentId: string): Promise<BroadcastChannelContent | null> => {
  const response = await getRequest(channelContentDetailEndpoint(contentId), { errorMessage: 'Unable to load content.' });
  if (!response?.success) return null;
  return normalizeChannelContent(response.data);
};

export const toggleChannelSubscription = async (channelId: string, subscribe: boolean) => {
  const response = await postRequest(channelSubscribeEndpoint(channelId), { subscribe }, { errorMessage: 'Unable to update subscription.' });
  if (response?.success) emitMainTabBadgeRefresh('channel_subscription_updated');
  return response;
};




export const normalizeChannelComment = (item: any): ChannelContentComment | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  return {
    id: String(item.id),
    content: item.content ? String(item.content) : undefined,
    user: item.user ? String(item.user) : undefined,
    user_display: item.user_display || item.userDisplay || 'KIS user',
    body: String(item.body || ''),
    parent: item.parent || null,
    created_at: item.created_at || item.createdAt || '',
    updated_at: item.updated_at || item.updatedAt || '',
  };
};

export const fetchChannelComments = async (contentId: string): Promise<ChannelContentComment[]> => {
  const response = await getRequest(channelContentCommentsEndpoint(contentId), { errorMessage: 'Unable to load comments.' });
  if (!response?.success) return [];
  const rows = Array.isArray(response.data?.results) ? response.data.results : [];
  return rows.map(normalizeChannelComment).filter(Boolean) as ChannelContentComment[];
};

export const postChannelComment = async (contentId: string, body: string) => {
  const response = await postRequest(channelContentCommentsEndpoint(contentId), { body }, { errorMessage: 'Unable to post comment.' });
  return response?.success ? { comment: normalizeChannelComment(response.data), data: response.data } : null;
};

export const reactToChannelContent = async (contentId: string, reaction = 'like') => {
  const response = await postRequest(channelContentReactEndpoint(contentId), { reaction }, { errorMessage: 'Unable to react.' });
  return response?.success ? response.data : null;
};

export const removeChannelContentReaction = async (contentId: string) => {
  const response = await deleteRequest(channelContentReactEndpoint(contentId), { errorMessage: 'Unable to remove reaction.' });
  return response?.success ? response.data : null;
};

export const saveChannelContent = async (contentId: string) => {
  const response = await postRequest(channelContentSaveEndpoint(contentId), {}, { errorMessage: 'Unable to save content.' });
  return response?.success ? response.data : null;
};

export const removeSavedChannelContent = async (contentId: string) => {
  const response = await deleteRequest(channelContentSaveEndpoint(contentId), { errorMessage: 'Unable to remove saved content.' });
  return response?.success ? response.data : null;
};

export const shareChannelContent = async (contentId: string, completed = true) => {
  const response = await postRequest(channelContentShareEndpoint(contentId), { completed }, { errorMessage: 'Unable to record share.' });
  return response?.success ? response.data : null;
};

export const recordChannelContentView = async (contentId: string, payload: Record<string, any> = {}) => {
  const response = await postRequest(channelContentViewEndpoint(contentId), payload, { errorMessage: 'Unable to record view.' });
  if (response?.success) emitMainTabBadgeRefresh('channel_content_viewed');
  return response?.success ? response.data : null;
};


export const normalizeModerationRecord = (item: any): ChannelModerationRecord | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  return {
    id: String(item.id),
    target_type: String(item.target_type || item.targetType || ''),
    target_id: String(item.target_id || item.targetId || ''),
    status: String(item.status || 'open'),
    action: item.action || '',
    reason: item.reason || '',
    notes: item.notes || '',
    reporter_display: item.reporter_display || item.reporterDisplay || '',
    actor_display: item.actor_display || item.actorDisplay || '',
    content_title: item.content_title || item.contentTitle || '',
    comment_body: item.comment_body || item.commentBody || '',
    created_at: item.created_at || item.createdAt || '',
    resolved_at: item.resolved_at || item.resolvedAt || null,
  };
};

export const fetchChannelAnalytics = async (channelId: string): Promise<{ summary: ChannelAnalyticsSummary; topContent: BroadcastChannelContent[] }> => {
  const response = await getRequest(channelAnalyticsEndpoint(channelId), { errorMessage: 'Unable to load channel analytics.' });
  if (!response?.success) return { summary: {}, topContent: [] };
  const payload: any = response.data || {};
  return {
    summary: payload.summary || {},
    topContent: Array.isArray(payload.top_content) ? payload.top_content.map(normalizeChannelContent).filter(Boolean) as BroadcastChannelContent[] : [],
  };
};

export const fetchChannelModerationQueue = async (channelId: string, status = 'open'): Promise<ChannelModerationRecord[]> => {
  const response = await getRequest(`${channelModerationEndpoint(channelId)}${buildQuery({ status })}`, { errorMessage: 'Unable to load moderation queue.' });
  if (!response?.success) return [];
  return unwrapRows(response.data || {}).map(normalizeModerationRecord).filter(Boolean) as ChannelModerationRecord[];
};

export const actionChannelModerationRecord = async (recordId: string, action: string, notes = '') => {
  const response = await postRequest(channelModerationActionEndpoint(recordId), { action, notes }, { errorMessage: 'Unable to update moderation record.' });
  return response?.success ? normalizeModerationRecord(response.data) : null;
};

export const reportChannel = async (channelId: string, reason: string) => {
  const response = await postRequest(channelReportEndpoint(channelId), { reason }, { errorMessage: 'Unable to report channel.' });
  return response?.success ? response.data : null;
};

export const reportChannelContent = async (contentId: string, reason: string) => {
  const response = await postRequest(channelContentReportEndpoint(contentId), { reason }, { errorMessage: 'Unable to report content.' });
  return response?.success ? response.data : null;
};

export const setChannelBroadcastState = async (channelId: string, broadcast: boolean): Promise<BroadcastChannelDetail | null> => {
  const endpoint = channelBroadcastEndpoint(channelId);
  const response = broadcast
    ? await postRequest(endpoint, {}, { errorMessage: 'Unable to broadcast channel.' })
    : await deleteRequest(endpoint, { errorMessage: 'Unable to stop broadcasting channel.' });
  return response?.success ? normalizeChannel(response.data) as BroadcastChannelDetail | null : null;
};

export const setChannelContentBroadcastState = async (contentId: string, broadcast: boolean): Promise<BroadcastChannelContent | null> => {
  const endpoint = channelContentBroadcastEndpoint(contentId);
  const response = broadcast
    ? await postRequest(endpoint, {}, { errorMessage: 'Unable to broadcast content.' })
    : await deleteRequest(endpoint, { errorMessage: 'Unable to stop broadcasting content.' });
  return response?.success ? normalizeChannelContent(response.data) : null;
};

export const removeChannelComment = async (commentId: string) => {
  const response = await deleteRequest(channelCommentModerateEndpoint(commentId), { errorMessage: 'Unable to remove comment.' });
  return response?.success ? response.data : null;
};

export const normalizeLiveStream = (item: any): BroadcastChannelLiveStream | null => {
  if (!item || typeof item !== 'object' || !item.id) return null;
  return {
    id: String(item.id),
    channel: normalizeChannel(item.channel || {}) || undefined,
    content_id: item.content_id || item.contentId || null,
    title: String(item.title || 'Live stream'),
    description: item.description || '',
    status: item.status || 'scheduled',
    scheduled_start_at: item.scheduled_start_at || item.scheduledStartAt || null,
    started_at: item.started_at || item.startedAt || null,
    ended_at: item.ended_at || item.endedAt || null,
    provider: item.provider || '',
    provider_stream_id: item.provider_stream_id || item.providerStreamId || '',
    ingest_url: item.ingest_url || item.ingestUrl || '',
    stream_key_available: Boolean(item.stream_key_available ?? item.streamKeyAvailable),
    playback_url: item.playback_url || item.playbackUrl || '',
    replay_url: item.replay_url || item.replayUrl || '',
    thumbnail_url: item.thumbnail_url || item.thumbnailUrl || '',
    viewer_count: Number(item.viewer_count ?? item.viewerCount ?? 0),
    peak_viewer_count: Number(item.peak_viewer_count ?? item.peakViewerCount ?? 0),
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    created_at: item.created_at || item.createdAt || '',
    updated_at: item.updated_at || item.updatedAt || '',
  };
};

export const fetchChannelLiveStreams = async (channelId: string): Promise<BroadcastChannelLiveStream[]> => {
  const response = await getRequest(`${channelLiveStreamsEndpoint(channelId)}${buildQuery({ limit: 24 })}`, { errorMessage: 'Unable to load live streams.' });
  if (!response?.success) return [];
  return unwrapRows(response.data || {}).map(normalizeLiveStream).filter(Boolean) as BroadcastChannelLiveStream[];
};

export const scheduleChannelLiveStream = async (channelId: string, payload: Record<string, any>) => {
  const response = await postRequest(channelLiveStreamsEndpoint(channelId), payload, { errorMessage: 'Unable to schedule live stream.' });
  return response?.success ? normalizeLiveStream(response.data) : null;
};

export const fetchLiveStreamDetail = async (streamId: string): Promise<BroadcastChannelLiveStream | null> => {
  const response = await getRequest(liveStreamDetailEndpoint(streamId), { errorMessage: 'Unable to load live stream.' });
  if (!response?.success) return null;
  return normalizeLiveStream(response.data);
};

export const startLiveStream = async (streamId: string): Promise<BroadcastChannelLiveStream | null> => {
  const response = await postRequest(liveStreamStartEndpoint(streamId), {}, { errorMessage: 'Unable to start live stream.' });
  return response?.success ? normalizeLiveStream(response.data) : null;
};

export const endLiveStream = async (streamId: string): Promise<BroadcastChannelLiveStream | null> => {
  const response = await postRequest(liveStreamEndEndpoint(streamId), {}, { errorMessage: 'Unable to end live stream.' });
  return response?.success ? normalizeLiveStream(response.data) : null;
};


export function useChannelsData({ q = '', category = null, mine = false }: Params = {}) {
  const [channels, setChannels] = useState<BroadcastChannelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => `${q.trim()}::${category || ''}::${mine ? 'mine' : 'public'}`, [category, mine, q]);

  const load = useCallback(
    async ({ cursor, replace = false }: { cursor?: string | null; replace?: boolean } = {}) => {
      if (replace) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const url = `${CHANNELS_ENDPOINT}${buildQuery({ q, category: category === 'all' ? '' : category, cursor, limit: 24, mine: mine ? 1 : undefined })}`;
        const response = await getRequest(url, { errorMessage: 'Unable to load channels.' });
        if (!response?.success) {
          setError(response?.message || 'Unable to load channels.');
          if (replace) setChannels([]);
          return;
        }
        const payload: any = response.data || {};
        const rows = Array.isArray(payload.results) ? payload.results : Array.isArray(payload) ? payload : [];
        const normalized = rows.map(normalizeChannel).filter(Boolean) as BroadcastChannelSummary[];
        setChannels(prev => (replace || !cursor ? normalized : [...prev, ...normalized]));
        setNextCursor(payload.next_cursor || payload.nextCursor || null);
      } catch (err: any) {
        setError(err?.message || 'Unable to load channels.');
        if (replace) setChannels([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, mine, q],
  );

  const refresh = useCallback(() => load({ replace: true }), [load]);
  const loadMore = useCallback(() => {
    if (!nextCursor || loading) return;
    void load({ cursor: nextCursor });
  }, [load, loading, nextCursor]);

  useEffect(() => {
    void load({ replace: true });
  }, [load, queryKey]);

  return { channels, loading, refreshing, error, nextCursor, refresh, loadMore };
}
