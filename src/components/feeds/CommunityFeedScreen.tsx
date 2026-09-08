import React, { useCallback, useEffect, useState } from 'react';
import FeedScreen from './FeedScreen';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { getFeedPlainText } from './richTextValue';
import { useSocket } from '@/SocketProvider';

type CommunityFeedScreenProps = {
  community: {
    id: string;
    name: string;
  };
  onBack: () => void;
};

export default function CommunityFeedScreen({ community, onBack }: CommunityFeedScreenProps) {
  // Bumped when a live community.post_*/comment_created event for this
  // community arrives - included in loadPosts' own identity below so
  // FeedScreen's existing `useEffect(() => { loadFeed() }, [loadFeed])`
  // refetches automatically, the same way it already does whenever
  // community.id changes. No changes to FeedScreen itself needed.
  const [liveRefreshNonce, setLiveRefreshNonce] = useState(0);
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !community.id) return undefined;
    const events = [
      'community.post_created',
      'community.post_updated',
      'community.post_deleted',
      'community.comment_created',
    ];
    const handler = (payload: any) => {
      if (String(payload?.communityId ?? '') !== String(community.id)) return;
      setLiveRefreshNonce((n) => n + 1);
    };
    events.forEach((eventName) => socket.on(eventName, handler));
    return () => {
      events.forEach((eventName) => socket.off(eventName, handler));
    };
  }, [socket, community.id]);

  const loadPosts = useCallback(async () => {
    const response = await getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
      errorMessage: 'Failed to load posts',
    });
    const list = response?.data?.results ?? response?.data ?? response ?? [];
    return Array.isArray(list) ? list : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community.id, liveRefreshNonce]);

  return (
    <FeedScreen
      entityTitle={`${community.name} Feed`}
      feedLabel="Community Feed"
      adTitle="Promote your ministry or product here"
      adDescription="Reach engaged community members with native ads."
      shareSubtitle="Community share"
      shareWatermarkColor="#22C55E"
      onBack={onBack}
      composerEndpoint={ROUTES.community.posts}
      composerContext={{ key: 'community', value: community.id }}
      composerErrorMessage="Unable to post to community feed."
      loadPosts={loadPosts}
      reactEndpoint={(postId) => ROUTES.community.postReact(postId)}
      commentRoomEndpoint={(postId) => ROUTES.community.postCommentRoom(postId)}
      commentsListEndpoint={(postId) => ROUTES.community.postComments(postId)}
      commentCreateEndpoint={(postId) => ROUTES.community.postComment(postId)}
      deleteEndpoint={(postId) => ROUTES.community.postDelete(postId)}
      editEndpoint={(postId) => ROUTES.community.postUpdate(postId)}
      broadcastEndpoint={(postId) => ROUTES.community.postBroadcast(postId)}
      feedType="community"
      commentChatContext={() => ({
        communityId: community.id,
        communityName: community.name,
      })}
      chatHeaderLabel={(post) =>
        `Feed: ${getFeedPlainText(post) || community.name}`
      }
    />
  );
}
