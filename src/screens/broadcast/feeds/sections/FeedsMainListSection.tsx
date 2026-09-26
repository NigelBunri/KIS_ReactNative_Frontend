import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';

import BroadcastFeedCard from '@/components/broadcast/BroadcastFeedCard';
import BroadcastAuthorProfileSheet from '@/components/broadcast/BroadcastAuthorProfileSheet';
import { isUserBroadcastSource } from '@/components/broadcast/authorProfileUtils';
import useAuthorProfilePreview from '@/components/broadcast/useAuthorProfilePreview';
import SectionHeader from '@/screens/broadcast/feeds/components/SectionHeader';
import Skeleton from '@/components/common/Skeleton';
import PromoEducationCard from '@/screens/broadcast/feeds/components/PromoEducationCard';

// Mirrors BroadcastFeedCard's edge-to-edge YouTube-style shape (padded
// header/title, full-bleed thumbnail, padded footer) so the loading state
// doesn't jump/resize once real cards swap in - shown only while there's
// nothing to show yet (see the loading && list.length === 0 gate below),
// never over already-visible content during a background refresh.
function FeedCardSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={44} height={44} radius={16} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="45%" height={14} radius={6} />
            <Skeleton width="28%" height={10} radius={6} />
          </View>
        </View>
        <Skeleton width="85%" height={16} radius={6} />
      </View>
      <Skeleton width="100%" height={200} radius={0} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 16 }}>
        <Skeleton width={40} height={18} radius={6} />
        <Skeleton width={40} height={18} radius={6} />
        <Skeleton width={40} height={18} radius={6} />
      </View>
    </View>
  );
}

export type BroadcastSourceMeta = {
  type: string;
  id?: string | null;
  name?: string;
  avatar_url?: string | null;
  verified?: boolean;
  allow_subscribe?: boolean;
  is_subscribed?: boolean;
  can_open?: boolean;
  conversation_id?: string;
  join_policy?: string;
  allow_apply?: boolean;
  auto_approve?: boolean;
  methods?: string[];
  is_member?: boolean;
  tier?: 'free' | 'pro' | 'business' | 'education' | string;
  followers_count?: number;
};

export type BroadcastFeedItem = {
  id: string;
  source_type: string;
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
    bio?: string;
    headline?: string;
    is_go?: boolean;
  };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
  viewer_reaction?: string | null;
  viewer_saved?: boolean;
  comment_count?: number;
  share_count?: number;
  is_live?: boolean;
  video_duration_seconds?: number;
  source?: BroadcastSourceMeta;
};

type Props = {
  items: BroadcastFeedItem[];
  loading?: boolean;
  loadingMore?: boolean;
  onRefresh?: () => void;
  // Optional attachment index — see BroadcastFeedCard's onVideoPress doc.
  onOpenItem: (item: BroadcastFeedItem, attachmentIndex?: number) => void;
  onShare: (item: BroadcastFeedItem) => void;
  onLike: (item: BroadcastFeedItem) => void;
  onSave: (item: BroadcastFeedItem) => void;
  onComment: (item: BroadcastFeedItem) => void;
  onMenu: (item: BroadcastFeedItem) => void;
  onSubscribe: (
    source: BroadcastSourceMeta,
    isSubscribed: boolean,
  ) => Promise<void> | void;
  // Id of the single item whose comment room is currently being opened
  // (see FeedsDiscoverPage's handleOpenComments) - lets just that item's
  // card show a loading spinner on its comment button.
  commentsLoadingItemId?: string | null;
  // Same idea for the share and save buttons.
  shareLoadingItemId?: string | null;
  saveLoadingItemId?: string | null;
};

export default function FeedsMainListSection({
  items,
  loading = false,
  loadingMore = false,
  onRefresh,
  onOpenItem,
  onShare,
  onLike,
  onSave,
  onComment,
  onMenu,
  onSubscribe,
  commentsLoadingItemId,
  shareLoadingItemId,
  saveLoadingItemId,
}: Props) {
  const { palette } = useKISTheme();
  // Education UX v2: PromoEducationCard existed but was never mounted
  // anywhere, so Education had no presence in the main Feed at all - see
  // the interleave below, inserted once per screen (not repeated every N
  // items) to stay a single contextual promo, not spam.
  const navigation = useNavigation<any>();
  const {
    visible: authorProfileVisible,
    loading: authorProfileLoading,
    error: authorProfileError,
    profile: authorProfile,
    openAuthorProfile,
    closeAuthorProfile,
  } = useAuthorProfilePreview();

  const list = items ?? [];
  console.log('FeedsMainListSection list', list);

  const headerSubtitle = useMemo(() => {
    if (!list.length) return '';
    return `${list.length} post${list.length === 1 ? '' : 's'}`;
  }, [list.length]);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <SectionHeader
          title="Feeds"
          subtitle={headerSubtitle}
        />
      </View>

      <View style={{ gap: 12 }}>
          {list.length === 0 && !loading ? (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>
                No posts yet.
              </Text>
            </View>
          ) : null}

          {/* Cards bleed to the screen edges - offsets the parent's
              paddingHorizontal: 12 (FeedsDiscoverPage.tsx) so the default-view
              feed cards render full width, matching the YouTube-style
              reference, instead of sitting inset like the rest of the page. */}
          {loading && list.length === 0 ? (
            // Nothing loaded yet - shimmer placeholders instead of a blank
            // screen. Gated on list.length so a background refresh (which
            // also flips `loading`) never blanks out already-visible posts;
            // that case is covered by the pull-to-refresh spinner instead.
            <View style={{ gap: 12, marginHorizontal: -12 }}>
              <FeedCardSkeleton />
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </View>
          ) : (
          <View style={{ gap: 12, marginHorizontal: -12 }}>
            {list.map((item, index) => {
              const sourceId = item.source?.id ? String(item.source.id) : null;
              const canSubscribe = Boolean(
                item.source?.allow_subscribe && sourceId,
              );
              const subscribed = Boolean(item.source?.is_subscribed);
              const enrichedSource: BroadcastSourceMeta = {
                ...(item.source ?? {}),
                type: item.source?.type ?? 'unknown',
                allow_subscribe: canSubscribe,
                is_subscribed: subscribed,
              };
              return (
                <React.Fragment key={item.id}>
                <BroadcastFeedCard
                  item={{
                    ...item,
                    source: {
                      ...(item.source ?? {}),
                      type: item.source?.type ?? 'unknown',
                      allow_subscribe: canSubscribe,
                      is_subscribed: subscribed,
                    },
                  }}
                  onLike={() => onLike(item)}
                  onShare={() => onShare(item)}
                  onOpenSource={() => onOpenItem(item)}
                  onVideoPress={attachmentIndex => onOpenItem(item, attachmentIndex)}
                  onSave={() => onSave(item)}
                  onToggleComments={() => onComment(item)}
                  commentsLoading={commentsLoadingItemId === item.id}
                  shareLoading={shareLoadingItemId === item.id}
                  savesLoading={saveLoadingItemId === item.id}
                  onMenuPress={() => onMenu(item)}
                  onOpenAuthorProfile={
                    isUserBroadcastSource(item)
                      ? () => {
                          void openAuthorProfile(item);
                        }
                      : undefined
                  }
                  onSubscribe={
                    canSubscribe || subscribed
                      ? async () => {
                          await onSubscribe(enrichedSource, subscribed);
                        }
                      : undefined
                  }
                />
                {index === 3 && list.length > 4 ? (
                  <PromoEducationCard
                    title="Education on KIS"
                    subtitle="Learn something new this week"
                    footerLeft="Courses, live classes, and certificates from Kingdom institutions"
                    ctaLabel="Explore"
                    onPress={() => navigation.navigate('EducationHome')}
                  />
                ) : null}
                </React.Fragment>
              );
            })}
          </View>
          )}

          {loadingMore ? (
            <View
              style={{
                height: 52,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: palette.subtext, fontWeight: '900' }}>
                Loading more…
              </Text>
            </View>
          ) : null}
      </View>
      <BroadcastAuthorProfileSheet
        visible={authorProfileVisible}
        loading={authorProfileLoading}
        error={authorProfileError}
        profile={authorProfile}
        onClose={closeAuthorProfile}
      />
    </View>
  );
}
