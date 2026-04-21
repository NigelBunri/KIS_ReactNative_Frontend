import React, { useMemo } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import BroadcastFeedCard from '@/components/broadcast/BroadcastFeedCard';
import BroadcastAuthorProfileSheet from '@/components/broadcast/BroadcastAuthorProfileSheet';
import {
  isUserBroadcastSource,
} from '@/components/broadcast/authorProfileUtils';
import useAuthorProfilePreview from '@/components/broadcast/useAuthorProfilePreview';
import SectionHeader from '@/screens/broadcast/feeds/components/SectionHeader';

export type BroadcastSourceMeta = {
  type: string;
  id?: string | null;
  name?: string;
  verified?: boolean;
  allow_subscribe?: boolean;
  is_subscribed?: boolean;
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
  author?: { display_name?: string; avatar_url?: string; id?: string; bio?: string; headline?: string };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
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
  onOpenItem: (item: BroadcastFeedItem) => void;
  onShare: (item: BroadcastFeedItem) => void;
  onLike: (item: BroadcastFeedItem) => void;
  onSave: (item: BroadcastFeedItem) => void;
  onComment: (item: BroadcastFeedItem) => void;
  onMenu: (item: BroadcastFeedItem) => void;
  onSubscribe: (source: BroadcastSourceMeta, isSubscribed: boolean) => Promise<void> | void;
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
}: Props) {
  const { palette } = useKISTheme();
  const {
    visible: authorProfileVisible,
    loading: authorProfileLoading,
    error: authorProfileError,
    profile: authorProfile,
    openAuthorProfile,
    closeAuthorProfile,
  } = useAuthorProfilePreview();

  const headerSubtitle = useMemo(() => {
    // optional: if your backend returns a top channel/source, you can show it here
    return 'Tech innovators';
  }, []);


  const list = items ?? [];

  return (
    <View style={{ gap: 12 }}>
      <View>
        <SectionHeader title="Feeds" subtitle={headerSubtitle} rightLabel="•••" onRightPress={() => {}} />
      </View>

      {/* Pull-to-refresh feel using a small rail wrapper */}
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 22,
          backgroundColor: palette.card,
          padding: 10,
        }}
      >
        <View
          style={{ gap: 12 }}
          // lightweight refresh surface (so you still refresh even without FlatList)
        >
          <View
            style={{
              height: 0,
            }}
          />

          {/* Fake refresh control hint */}
          {onRefresh ? (
            <View style={{ height: 0 }}>
              <RefreshControl refreshing={loading} onRefresh={onRefresh} />
            </View>
          ) : null}

          {list.length === 0 && !loading ? (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: palette.subtext, fontWeight: '800' }}>No posts yet.</Text>
            </View>
          ) : null}

          {list.map((item) => {
            const sourceId = item.source?.id ? String(item.source.id) : null;
            const canSubscribe = Boolean(item.source?.allow_subscribe && sourceId);
            const subscribed = Boolean(item.source?.is_subscribed);
            const enrichedSource: BroadcastSourceMeta = {
              ...(item.source ?? {}),
              type: item.source?.type ?? 'unknown',
              allow_subscribe: canSubscribe,
              is_subscribed: subscribed,
            };
            return (
              <BroadcastFeedCard
                key={item.id}
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
                onVideoPress={() => onOpenItem(item)}
                onMenuPress={() => onMenu(item)}
                onSave={() => onSave(item)}
                onToggleComments={() => onComment(item)}
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
            );
          })}

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
              <Text style={{ color: palette.subtext, fontWeight: '900' }}>Loading more…</Text>
            </View>
          ) : null}
        </View>
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
