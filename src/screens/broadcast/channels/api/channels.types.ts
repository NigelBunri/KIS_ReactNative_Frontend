export type BroadcastChannelSummary = {
  id: string;
  handle: string;
  display_name: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  category?: string;
  language?: string;
  country?: string;
  is_verified?: boolean;
  is_broadcast?: boolean;
  broadcast_id?: string;
  verification_badges?: string[];
  subscriber_count?: number;
  content_count?: number;
  is_subscribed?: boolean;
  viewer_role?: string;
};

export type BroadcastChannelContentAsset = {
  id?: string;
  asset_type?: string;
  url?: string;
  thumbnail_url?: string;
  caption?: string;
  mime_type?: string;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  processing_status?: string;
  metadata?: Record<string, any>;
};

export type BroadcastChannelContent = {
  id: string;
  channel?: BroadcastChannelSummary;
  content_type: string;
  title?: string;
  description?: string;
  description_preview?: string;
  text_plain?: string;
  text_plain_preview?: string;
  text_doc?: Record<string, any> | string | null;
  thumbnail_url?: string;
  first_asset?: BroadcastChannelContentAsset | null;
  assets?: BroadcastChannelContentAsset[];
  status?: string;
  is_broadcast?: boolean;
  broadcast_id?: string;
  visibility?: string;
  published_at?: string;
  duration_seconds?: number;
  stats?: Record<string, any>;
  engagement_counts?: Record<string, number>;
  metadata?: Record<string, any>;
  scheduled_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BroadcastChannelDetail = BroadcastChannelSummary & {
  branding?: Record<string, any>;
  links?: Array<{ label?: string; url?: string }>;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

export type BroadcastChannelPlaylist = {
  id: string;
  title: string;
  description?: string;
  visibility?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

export type BroadcastChannelsResponse = {
  results?: BroadcastChannelSummary[];
  next_cursor?: string | null;
};

export type BroadcastChannelContentsResponse = {
  results?: BroadcastChannelContent[];
  next_cursor?: string | null;
};

export type BroadcastChannelPlaylistsResponse = {
  results?: BroadcastChannelPlaylist[];
  next_cursor?: string | null;
};


export type BroadcastChannelLiveStream = {
  id: string;
  channel?: BroadcastChannelSummary;
  content_id?: string | null;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled' | 'failed' | string;
  scheduled_start_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  provider?: string;
  provider_stream_id?: string;
  ingest_url?: string;
  stream_key_available?: boolean;
  playback_url?: string;
  replay_url?: string;
  thumbnail_url?: string;
  viewer_count?: number;
  peak_viewer_count?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  // Stream settings (YouTube-parity fields)
  latency_mode?: 'normal' | 'low' | 'ultra_low';
  dvr_enabled?: boolean;
  dvr_window_seconds?: number;
};

export type BroadcastChannelLiveStreamsResponse = {
  results?: BroadcastChannelLiveStream[];
};


export type ChannelContentComment = {
  id: string;
  content?: string;
  user?: string;
  user_display?: string;
  body: string;
  parent?: string | null;
  like_count?: number;
  is_liked?: boolean;
  is_pinned?: boolean;
  has_creator_heart?: boolean;
  reply_count?: number;
  created_at?: string;
  updated_at?: string;
};


export type ChannelContentChapter = {
  id: string;
  content?: string;
  title: string;
  start_seconds: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ChannelAnalyticsSummary = {
  subscribers?: number;
  content_count?: number;
  published_count?: number;
  views?: number;
  unique_viewers?: number;
  watch_time_seconds?: number;
  reactions?: number;
  comments?: number;
  saves?: number;
  shares?: number;
};

export type ChannelModerationRecord = {
  id: string;
  target_type: 'channel' | 'content' | 'comment' | string;
  target_id: string;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed' | string;
  action?: string;
  reason?: string;
  notes?: string;
  reporter_display?: string;
  actor_display?: string;
  content_title?: string;
  comment_body?: string;
  created_at?: string;
  resolved_at?: string | null;
};
