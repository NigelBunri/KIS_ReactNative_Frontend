import React, { useCallback, useEffect, useState } from 'react';
import FeedScreen from './FeedScreen';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { useSocket } from '@/SocketProvider';

type PartnerFeedScreenProps = {
  partner: {
    id: string;
    name: string;
  };
  onBack: () => void;
  hideHeader?: boolean;
};

export default function PartnerFeedScreen({ partner, onBack, hideHeader = false }: PartnerFeedScreenProps) {
  // Mirrors CommunityFeedScreen.tsx's identical pattern — the partner
  // feed previously had no live-update push at all (manual pull-to-
  // refresh only); the backend now emits these via
  // apps.partners.views.PartnerPostViewSet (perform_create/comment/
  // delete_post/update), matching apps.communities' existing wiring.
  const [liveRefreshNonce, setLiveRefreshNonce] = useState(0);
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !partner.id) return undefined;
    const events = [
      'partner.post_created',
      'partner.post_updated',
      'partner.post_deleted',
      'partner.comment_created',
    ];
    const handler = (payload: any) => {
      if (String(payload?.partnerId ?? '') !== String(partner.id)) return;
      setLiveRefreshNonce((n) => n + 1);
    };
    events.forEach((eventName) => socket.on(eventName, handler));
    const bumpNonce = () => setLiveRefreshNonce((n) => n + 1);
    socket.on('connect', bumpNonce);
    return () => {
      events.forEach((eventName) => socket.off(eventName, handler));
      socket.off('connect', bumpNonce);
    };
  }, [socket, partner.id]);

  const loadPosts = useCallback(async () => {
    const response = await getRequest(`${ROUTES.partners.posts}?partner=${partner.id}`, {
      errorMessage: 'Failed to load partner feed',
    });
    const list = response?.data?.results ?? response?.data ?? response ?? [];
    return Array.isArray(list) ? list : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id, liveRefreshNonce]);

  return (
    <FeedScreen
      entityTitle={`${partner.name} Feed`}
      feedLabel="General Feed"
      adTitle="Reach partner members with targeted updates"
      adDescription="Promote your programs and announcements here."
      shareSubtitle="Partner share"
      shareWatermarkColor="#F97316"
      onBack={onBack}
      hideHeader={hideHeader}
      composerEndpoint={ROUTES.partners.posts}
      composerContext={{ key: 'partner', value: partner.id }}
      composerErrorMessage="Unable to post to partner feed."
      loadPosts={loadPosts}
      reactEndpoint={(postId) => ROUTES.partners.postReact(postId)}
      commentRoomEndpoint={(postId) => ROUTES.partners.postCommentRoom(postId)}
      commentsListEndpoint={(postId) => ROUTES.partners.postComments(postId)}
      commentCreateEndpoint={(postId) => ROUTES.partners.postComment(postId)}
      deleteEndpoint={(postId) => ROUTES.partners.postDelete(postId)}
      editEndpoint={(postId) => ROUTES.partners.postUpdate(postId)}
      broadcastEndpoint={(postId) => ROUTES.partners.postBroadcast(postId)}
      feedType="partner"
      commentChatContext={() => ({
        partnerId: partner.id,
        partnerName: partner.name,
      })}
      chatHeaderLabel={(post) =>
        `Feed: ${post.text_plain ?? post.text ?? partner.name}`
      }
      emptyStateText="No posts yet."
    />
  );
}
