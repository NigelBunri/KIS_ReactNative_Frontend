import { API_BASE_URL } from '../config';

const socialRoutes = {
  messaging: {
    getMessages: `${API_BASE_URL}/messages/fetch_messages/`,
    sendMessage: `${API_BASE_URL}/messages/send_message/`,
    exchangeKeys: `${API_BASE_URL}/messages/exchange_keys/`,
  },
  community: {
    list: `${API_BASE_URL}/api/v1/communities/`,
    create: `${API_BASE_URL}/api/v1/communities/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/add-members/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/join/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/request-join/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/reject-request/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/unban/`,
    posts: `${API_BASE_URL}/api/v1/posts/`,
    postDetail: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/`,
    postComment: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment/`,
    postComments: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comments/`,
    postCommentRoom: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment-room/`,
    postReact: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/react/`,
    postPin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/pin/`,
    postUnpin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/unpin/`,
    postDelete: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/delete/`,
    postBroadcast: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/broadcast/`,
  },
  groups: {
    list: `${API_BASE_URL}/api/v1/groups/`,
    create: `${API_BASE_URL}/api/v1/groups/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/add-members/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/join/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/request-join/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/reject-request/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/unban/`,
  },
  channels: {
    getAllChannels: `${API_BASE_URL}/api/v1/channels/`,
    getChannelById: (id: string) => `${API_BASE_URL}/api/v1/channels/${id}/`,
    createChannel: `${API_BASE_URL}/api/v1/channels/`,
    subscribeChannel: (id: string) => `${API_BASE_URL}/api/v1/channels/${id}/subscribe/`,
    addMembersToChannel: (channelId: string) => `${API_BASE_URL}/api/v1/channels/${channelId}/members/`,
    getChannelMembers: (channelId: string) => `${API_BASE_URL}/api/v1/channels/${channelId}/members/`,
  },
  subchannels: {
    getAllSubchannels: `${API_BASE_URL}/subchannels/`,
    getSubchannelById: (id: string) => `${API_BASE_URL}/subchannels/${id}/`,
    createSubchannel: `${API_BASE_URL}/subchannels/create/`,
    getSubchannelMembers: (id: string) => `${API_BASE_URL}/subchannels/${id}/members/`,
  },
  statuses: {
    list: `${API_BASE_URL}/api/v1/statuses/`,
    create: `${API_BASE_URL}/api/v1/statuses/`,
    mine: `${API_BASE_URL}/api/v1/statuses/mine/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/view/`,
  },
  chat: {
    listConversations: `${API_BASE_URL}/api/v1/chats/conversations/`,
    directConversation: `${API_BASE_URL}/api/v1/chats/conversations/direct/`,
  },
  e2ee: {
    conversationKey: (conversationId: string) =>
      `${API_BASE_URL}/api/v1/auth/e2ee/conversations/${conversationId}/key/`,
  },
};

export default socialRoutes;
