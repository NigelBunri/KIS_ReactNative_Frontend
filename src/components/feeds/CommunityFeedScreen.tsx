import React, { useCallback } from 'react';
import FeedScreen from './FeedScreen';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type CommunityFeedScreenProps = {
  community: {
    id: string;
    name: string;
  };
  onBack: () => void;
};

export default function CommunityFeedScreen({ community, onBack }: CommunityFeedScreenProps) {
  const loadPosts = useCallback(async () => {
    const response = await getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
      errorMessage: 'Failed to load posts',
    });
    const list = response?.data?.results ?? response?.data ?? response ?? [];
    return Array.isArray(list) ? list : [];
  }, [community.id]);

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
      deleteEndpoint={(postId) => ROUTES.community.postDelete(postId)}
      broadcastEndpoint={(postId) => ROUTES.community.postBroadcast(postId)}
      feedType="community"
      commentChatContext={() => ({
        communityId: community.id,
        communityName: community.name,
      })}
      chatHeaderLabel={(post) =>
        `Feed: ${post.text_plain ?? post.text ?? community.name}`
      }
    />
  );
}
