import { useCallback } from 'react';

type Partner = {
  id?: string;
  member_role?: string;
};

type Params = {
  selectedPartner?: Partner | null;
  isMessagesExpanded: boolean;
  setSelectedGroupId: (value: string | null) => void;
  setSelectedChannelId: (value: string | null) => void;
  setSelectedFeed: (value: string | null) => void;
  setSelectedCommunityFeedId: (value: string | null) => void;
  openMessagesPane: () => void;
};

export const usePartnerNavigationActions = ({
  selectedPartner,
  isMessagesExpanded,
  setSelectedGroupId,
  setSelectedChannelId,
  setSelectedFeed,
  setSelectedCommunityFeedId,
  openMessagesPane,
}: Params) => {
  const guardReadOnly = useCallback(() => {
    return selectedPartner?.member_role === 'readonly';
  }, [selectedPartner?.member_role]);

  const openMessagesIfNeeded = useCallback(() => {
    if (!isMessagesExpanded) {
      openMessagesPane();
    }
  }, [isMessagesExpanded, openMessagesPane]);

  const onGroupPress = useCallback(
    (groupId: string) => {
      if (guardReadOnly()) {
        return;
      }
      setSelectedGroupId(groupId);
      setSelectedChannelId(null);
      setSelectedFeed(null);
      setSelectedCommunityFeedId(null);
      openMessagesIfNeeded();
    },
    [
      guardReadOnly,
      openMessagesIfNeeded,
      setSelectedChannelId,
      setSelectedCommunityFeedId,
      setSelectedFeed,
      setSelectedGroupId,
    ],
  );

  const onFeedPress = useCallback(() => {
    if (!selectedPartner) return;
    setSelectedGroupId(null);
    setSelectedChannelId(null);
    setSelectedFeed('general');
    setSelectedCommunityFeedId(null);
    openMessagesIfNeeded();
  }, [
    openMessagesIfNeeded,
    selectedPartner,
    setSelectedChannelId,
    setSelectedCommunityFeedId,
    setSelectedFeed,
    setSelectedGroupId,
  ]);

  const onCommunityFeedPress = useCallback(
    (communityId: string) => {
      if (guardReadOnly()) {
        return;
      }
      setSelectedGroupId(null);
      setSelectedChannelId(null);
      setSelectedFeed(null);
      setSelectedCommunityFeedId(communityId);
      openMessagesIfNeeded();
    },
    [
      guardReadOnly,
      openMessagesIfNeeded,
      setSelectedChannelId,
      setSelectedCommunityFeedId,
      setSelectedFeed,
      setSelectedGroupId,
    ],
  );

  const onChannelPress = useCallback(
    (channelId: string) => {
      if (guardReadOnly()) {
        return;
      }
      setSelectedGroupId(null);
      setSelectedChannelId(channelId);
      setSelectedFeed(null);
      setSelectedCommunityFeedId(null);
      openMessagesIfNeeded();
    },
    [
      guardReadOnly,
      openMessagesIfNeeded,
      setSelectedChannelId,
      setSelectedCommunityFeedId,
      setSelectedFeed,
      setSelectedGroupId,
    ],
  );

  return {
    onGroupPress,
    onFeedPress,
    onCommunityFeedPress,
    onChannelPress,
  };
};
