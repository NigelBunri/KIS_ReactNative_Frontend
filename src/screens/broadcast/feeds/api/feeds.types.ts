export type BroadcastSourceMeta = {
  type: string;
  id?: string | null;
  name?: string;
  conversation_id?: string;
  join_policy?: string;
  is_member?: boolean;
  allow_apply?: boolean;
  allow_subscribe?: boolean;
  auto_approve?: boolean;
  methods?: string[];
  is_subscribed?: boolean;
  can_open?: boolean;
  verified?: boolean;
  tier?: 'free' | 'pro' | 'business' | 'education' | string;
  followers_count?: number;
};

export type BroadcastFeedItem = {
  id: string;
  source_type: string;
  source_id?: string;
  title?: string;
  text?: string;
  styled_text?: { text?: string } | null;
  text_doc?: any;
  text_plain?: string;
  attachments?: any[];
  author?: {
    display_name?: string;
    avatar_url?: string;
    id?: string;
    profile_id?: string;
    bio?: string;
    headline?: string;
    summary?: string;
  };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
  viewer_reaction?: string | null;
  viewer_saved?: boolean;
  comment_count?: number;
  comment_conversation_id?: string | null;
  share_count?: number;
  save_count?: number;
  view_count?: number;
  is_live?: boolean;
  live_viewers?: number;
  is_premium?: boolean;
  is_lesson?: boolean;
  lesson_duration?: number;
  lesson_level?: 'beginner' | 'intermediate' | 'advanced' | string;
  product?: any;
  video_category?: string | null;
  video_duration_seconds?: number;
  source?: BroadcastSourceMeta;
};

export type TrendingClipItem = {
  id: string;
  title?: string;
  body?: string;
  text?: any;
  styled_text?: any;
  text_doc?: any;
  text_plain?: string;
  broadcastedAt?: string;
  attachments?: any[];
  engagement?: { reactions?: number; comments?: number };
};

export type PaginatedResult<T> = {
  results: T[];
  next?: string | null;
  previous?: string | null;
  count?: number;
};

export const normalizePaginated = <T>(data: any): PaginatedResult<T> => {
  if (!data) return { results: [], next: null, previous: null, count: 0 };
  if (Array.isArray(data))
    return {
      results: data as T[],
      next: null,
      previous: null,
      count: data.length,
    };
  const results = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.data)
    ? data.data
    : [];
  return {
    results,
    next: data.next ?? null,
    previous: data.previous ?? null,
    count: typeof data.count === 'number' ? data.count : results.length,
  };
};
