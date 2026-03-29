import React, { useCallback } from 'react';
import FeedScreen from './FeedScreen';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type PartnerFeedScreenProps = {
  partner: {
    id: string;
    name: string;
  };
  onBack: () => void;
};

export default function PartnerFeedScreen({ partner, onBack }: PartnerFeedScreenProps) {
  const loadPosts = useCallback(async () => {
    const response = await getRequest(`${ROUTES.partners.posts}?partner=${partner.id}`, {
      errorMessage: 'Failed to load partner feed',
    });
    const list = response?.data?.results ?? response?.data ?? response ?? [];
    return Array.isArray(list) ? list : [];
  }, [partner.id]);

  return (
    <FeedScreen
      entityTitle={`${partner.name} Feed`}
      feedLabel="General Feed"
      adTitle="Reach partner members with targeted updates"
      adDescription="Promote your programs and announcements here."
      shareSubtitle="Partner share"
      shareWatermarkColor="#F97316"
      onBack={onBack}
      composerEndpoint={ROUTES.partners.posts}
      composerContext={{ key: 'partner', value: partner.id }}
      composerErrorMessage="Unable to post to partner feed."
      loadPosts={loadPosts}
      reactEndpoint={(postId) => ROUTES.partners.postReact(postId)}
      commentRoomEndpoint={(postId) => ROUTES.partners.postCommentRoom(postId)}
      deleteEndpoint={(postId) => ROUTES.partners.postDelete(postId)}
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
