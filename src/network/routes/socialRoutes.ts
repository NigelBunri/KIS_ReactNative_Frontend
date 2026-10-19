import { API_BASE_URL, NEST_API_BASE_URL } from '../config';

const socialRoutes = {
  content: {
    list: `${API_BASE_URL}/api/v1/contents/`,
    create: `${API_BASE_URL}/api/v1/contents/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/contents/${id}/`,
    react: (id: string) => `${API_BASE_URL}/api/v1/contents/${id}/react/`,
    metrics: (id: string) => `${API_BASE_URL}/api/v1/contents/${id}/metrics/`,
  },
  events: {
    list: `${API_BASE_URL}/api/v1/events/`,
    create: `${API_BASE_URL}/api/v1/events/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/events/${id}/`,
    rsvp: `${API_BASE_URL}/api/v1/attendances/`,
    tickets: `${API_BASE_URL}/api/v1/tickets/`,
  },
  notificationRules: {
    list: `${API_BASE_URL}/api/v1/notification-rules/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/notification-rules/${id}/`,
  },
  community: {
    list: `${API_BASE_URL}/api/v1/chat-communities/`,
    create: `${API_BASE_URL}/api/v1/chat-communities/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/add-members/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/join/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/request-join/`,
    joinRequests: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/join-requests/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/reject-request/`,
    setMemberRole: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/members/set-role/`,
    promoteMemberToGroupAdmin: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/members/promote-admin/`,
    removeMember: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/members/remove/`,
    blockMember: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/members/block/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/unban/`,
    inviteLink: (id: string) => `${API_BASE_URL}/api/v1/chat-communities/${id}/invite-link/`,
    joinByInvite: `${API_BASE_URL}/api/v1/chat-communities/join-by-invite/`,
    posts: `${API_BASE_URL}/api/v1/posts/`,
    postDetail: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/`,
    postComment: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment/`,
    postComments: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comments/`,
    postCommentRoom: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment-room/`,
    postReact: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/react/`,
    postPin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/pin/`,
    postUnpin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/unpin/`,
    postDelete: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/delete/`,
    // Community posts have no separate .../edit/ action - PATCH the post's
    // own detail endpoint, now permission-checked (author or community
    // admin/mod) in CommunityPostViewSet.partial_update.
    postUpdate: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/`,
    postBroadcast: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/broadcast/`,
  },
  contactLinks: {
    me: `${API_BASE_URL}/api/v1/chats/contact-links/me/`,
    redeem: `${API_BASE_URL}/api/v1/chats/contact-links/redeem/`,
    // Unauthenticated preview - same public resolver every join-link type
    // uses (apps.core.link_resolver), never phone/id, safe to call before
    // login.
    resolve: (token: string) => `${API_BASE_URL}/api/v1/links/resolve/contact/${token}/`,
  },
  groups: {
    list: `${API_BASE_URL}/api/v1/chat-groups/`,
    create: `${API_BASE_URL}/api/v1/chat-groups/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/add-members/`,
    setMemberRole: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/members/set-role/`,
    removeMember: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/members/remove/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/join/`,
    joinByInvite: `${API_BASE_URL}/api/v1/chat-groups/join-by-invite/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/request-join/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/reject-request/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/unban/`,
    inviteLink: (id: string) => `${API_BASE_URL}/api/v1/chat-groups/${id}/invite-link/`,
  },
  channels: {
    getAllChannels: `${API_BASE_URL}/api/v1/partner-channels/channels/`,
    getChannelById: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/`,
    createChannel: `${API_BASE_URL}/api/v1/partner-channels/channels/`,
    subscribeChannel: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/subscribe/`,
    unsubscribeChannel: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/unsubscribe/`,
    addMembersToChannel: (channelId: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${channelId}/members/`,
    getChannelMembers: (channelId: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${channelId}/members/`,
    updateChannel: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/`,
    archiveChannel: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/archive/`,
    overwrites: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/overwrites/`,
    overwriteDetail: (id: string, overwriteId: string) =>
      `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/overwrites/${overwriteId}/`,
    inviteLink: (id: string) => `${API_BASE_URL}/api/v1/partner-channels/channels/${id}/invite-link/`,
    joinByInvite: `${API_BASE_URL}/api/v1/partner-channels/channels/join-by-invite/`,
  },
  subchannels: {
    getAllSubchannels: `${API_BASE_URL}/api/v1/subchannels/`,
    getSubchannelById: (id: string) => `${API_BASE_URL}/api/v1/subchannels/${id}/`,
    createSubchannel: `${API_BASE_URL}/api/v1/subchannels/`,
    getSubchannelMembers: (id: string) => `${API_BASE_URL}/api/v1/subchannels/${id}/members/`,
  },
  statuses: {
    list: `${API_BASE_URL}/api/v1/statuses/`,
    search: `${API_BASE_URL}/api/v1/statuses/search/`,
    create: `${API_BASE_URL}/api/v1/statuses/`,
    mine: `${API_BASE_URL}/api/v1/statuses/mine/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/view/`,
    viewers: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/viewers/`,
    report: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/report/`,
    // Back-compat alias for the original quick-reply box - creates a
    // top-level StatusComment. New code should use `comments` below, which
    // also supports parent_id (threaded replies) and pagination.
    reply: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/reply/`,
    react: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/react/`,
    unreact: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/unreact/`,
    // Grouped by emoji, with per-group participant previews - see
    // apps/statuses/views.py's reactions() action.
    reactions: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/reactions/`,
    // GET ?parent_id=<comment_id> for a comment's replies, omit for
    // top-level comments; POST with optional parent_id to reply.
    comments: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/comments/`,
    hide: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/hide/`,
    unhide: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/unhide/`,
    // Owner-only real deletion (soft-delete + underlying file removed
    // server-side — see apps/statuses/views.py's destroy() override).
    delete: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/`,
    mute: `${API_BASE_URL}/api/v1/statuses/mute/`,
    unmute: `${API_BASE_URL}/api/v1/statuses/unmute/`,
    // Standard DRF detail route - StatusViewSet is a plain ModelViewSet
    // (apps/statuses/views.py), so PATCH/DELETE here already work and are
    // scoped to the owner via get_queryset(); no separate backend change
    // needed to support removing/editing a status item.
    detail: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/`,
    // Fresh short-lived presigned GET for a status's media — visibility is
    // re-checked server-side on every call (same rules as list/view). See
    // apps/statuses/views.py's media_url action.
    mediaUrl: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/media-url/`,
  },
  chat: {
    listConversations: `${API_BASE_URL}/api/v1/chats/conversations/`,
    conversationDetail: (id: string) => `${API_BASE_URL}/api/v1/chats/conversations/${id}/`,
    searchConversations: `${API_BASE_URL}/api/v1/chats/conversations/search/`,
    searchParticipants: `${API_BASE_URL}/api/v1/chats/conversations/participant-search/`,
    directConversation: `${API_BASE_URL}/api/v1/chats/conversations/direct/`,
    threads: `${API_BASE_URL}/api/v1/chats/threads/`,
    setMemberRole: (conversationId: string) =>
      `${API_BASE_URL}/api/v1/chats/conversations/${conversationId}/members/role/`,
    markRead: (conversationId: string) =>
      `${API_BASE_URL}/api/v1/chats/conversations/${conversationId}/mark-read/`,
    updateSettings: (conversationId: string) =>
      `${API_BASE_URL}/api/v1/chats/conversations/${conversationId}/settings/`,
  },
  moderation: {
    mute: `${NEST_API_BASE_URL}/api/v1/moderation/mute`,
    block: `${NEST_API_BASE_URL}/api/v1/moderation/block`,
    report: `${NEST_API_BASE_URL}/api/v1/moderation/report`,
  },
  // PinsController (Nestjs) is @Controller('pins') — mounted at /pins, NOT
  // /api/v1/pins (Nest sets no global prefix; only Django's own API uses
  // /api/v1). This previously pointed at the wrong path entirely, 404ing
  // with "Cannot POST /api/v1/pins/set" every time - same bug class as the
  // calls/moderation.mute routes nearby.
  pins: {
    set: `${NEST_API_BASE_URL}/pins/set`,
    list: `${NEST_API_BASE_URL}/pins/list`,
  },
  conversations: {
    broadcast: `${NEST_API_BASE_URL}/api/v1/conversations/broadcast`,
  },
  // ScheduledMessagesController (Nestjs) is @Controller('chat/scheduled-messages')
  // — mounted at /chat/scheduled-messages, no /api/v1 prefix (same rule as pins/calls above).
  scheduledMessages: {
    list: `${NEST_API_BASE_URL}/chat/scheduled-messages`,
    create: `${NEST_API_BASE_URL}/chat/scheduled-messages`,
    update: (id: string) => `${NEST_API_BASE_URL}/chat/scheduled-messages/${id}`,
    cancel: (id: string) => `${NEST_API_BASE_URL}/chat/scheduled-messages/${id}`,
  },
  // CallsController (Nestjs) is @Controller('calls') — mounted at /calls,
  // NOT /api/v1/calls. This whole block previously pointed at the wrong
  // prefix for every route except `history`, which happened to 401/200
  // instead of 404 only because app.controller.ts has a deliberate DEAD
  // STUB at exactly /api/v1/calls/history (`return { results: [], count: 0
  // }`, left over from before real server-side call history existed) that
  // silently absorbed the request and always returned empty — so the app
  // looked like it was "syncing" while actually always getting nothing
  // back, permanently falling back to local-only AsyncStorage history that
  // a fresh install has none of. Every other route here was a flat-out 404
  // (verified live: iceServers/missedCount/scheduled/active/conversation/
  // join/invite-link all 404 at .../api/v1/calls/*, 401 — i.e. reachable —
  // at .../calls/*), meaning ICE/TURN credentials, scheduled calls, the
  // active-call banner, and invite-link joining were ALL silently broken
  // too, not just call history. iceServers failing silently and falling
  // back to STUN-only defaults is a very plausible contributor to the
  // reported "delays in connecting".
  calls: {
    iceServers: `${NEST_API_BASE_URL}/calls/ice-servers`,
    history: `${NEST_API_BASE_URL}/calls/history`,
    missedCount: `${NEST_API_BASE_URL}/calls/missed-count`,
    standalone: `${NEST_API_BASE_URL}/calls/standalone`,
    scheduled: `${NEST_API_BASE_URL}/calls/scheduled`,
    inviteLink: `${NEST_API_BASE_URL}/calls/invite-link`,
    joinByToken: (token: string) => `${NEST_API_BASE_URL}/calls/join/${token}`,
    active: (conversationId: string) => `${NEST_API_BASE_URL}/calls/active?conversationId=${encodeURIComponent(conversationId)}`,
    forConversation: (conversationId: string, limit = 30) => `${NEST_API_BASE_URL}/calls/conversation?conversationId=${encodeURIComponent(conversationId)}&limit=${limit}`,
    ringingAck: (callId: string) => `${NEST_API_BASE_URL}/calls/${encodeURIComponent(callId)}/ringing-ack`,
    decline: (callId: string) => `${NEST_API_BASE_URL}/calls/${encodeURIComponent(callId)}/decline`,
  },
  e2ee: {
    conversationKey: (conversationId: string) =>
      `${NEST_API_BASE_URL}/api/v1/e2ee/conversations/${conversationId}/key`,
  },
  stickers: {
    packs: `${API_BASE_URL}/api/v1/stickers/packs/`,
    create: `${API_BASE_URL}/api/v1/stickers/`,
    library: `${API_BASE_URL}/api/v1/stickers/library/`,
    save: (stickerId: string) => `${API_BASE_URL}/api/v1/stickers/${encodeURIComponent(stickerId)}/save/`,
    removeLibraryEntry: (entryId: string) => `${API_BASE_URL}/api/v1/stickers/library/${encodeURIComponent(entryId)}/`,
  },
  jobs: {
    board: `${API_BASE_URL}/api/v1/partners/jobs/`,
    myApplications: `${API_BASE_URL}/api/v1/partners/my-applications/`,
    withdrawApplication: (appId: string) => `${API_BASE_URL}/api/v1/partners/my-applications/${appId}/withdraw/`,
  },
  profiles: {
    discover: `${API_BASE_URL}/api/v1/profiles/discover/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/`,
    endorseSkill: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/endorse-skill/`,
    openToWork: `${API_BASE_URL}/api/v1/profiles/open-to-work/`,
  },
  connections: {
    list: `${API_BASE_URL}/api/v1/connections/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/connections/${id}/`,
    peopleYouMayKnow: `${API_BASE_URL}/api/v1/connections/people-you-may-know/`,
    search: `${API_BASE_URL}/api/v1/connections/search/`,
  },
};

export default socialRoutes;
