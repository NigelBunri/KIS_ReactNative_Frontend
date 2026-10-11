// NOTE (broadcast-channels-closure, 2026-10-04):
// This file originally also exported `BroadcastEngagement` and
// `normalizeBroadcastItem`, which existed solely to support the now-deleted
// `useBroadcastFeed.ts` hook / `FeedsNavigator.tsx` / `FeedsListScreen.tsx`
// stack (built for the dormant NestJS feeds-republish module, never wired
// into App.tsx's root navigator — confirmed zero live references). That
// dead code has been removed.
//
// `BroadcastItem` itself is KEPT because it is still a live dependency:
// `src/components/broadcast/FeedItemCard.tsx` imports it as a prop type,
// and FeedItemCard is used by the live
// `src/screens/broadcast/feeds/sections/TrendingClipsSection.tsx` ->
// `FeedsDiscoverPage.tsx` path. Do not delete this type without first
// updating FeedItemCard.tsx's prop type.
export type BroadcastItem = {
  id: string;
  vertical: 'feeds';
  sourceType: 'feed_post';
  sourceId: string;
  creatorId: string;
  broadcastedAt: string;
  title?: string;
  body?: string;
  text?: any;
  text_doc?: any;
  text_plain?: string;
  styled_text?: any;
  attachments: any[];
  metadata: Record<string, unknown>;
  visibility: 'public' | 'community' | 'restricted' | 'private';
  engagement: {
    reactions: number;
    comments: number;
    shares: number;
    saves: number;
  };
};
