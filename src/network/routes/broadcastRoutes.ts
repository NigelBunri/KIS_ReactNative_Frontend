import { API_BASE_URL, NEST_API_BASE_URL } from '../config';

const broadcastRoutes = {
  bible: {
    translations: `${API_BASE_URL}/api/v1/bible/translations/`,
    books: `${API_BASE_URL}/api/v1/bible/books/`,
    chapters: `${API_BASE_URL}/api/v1/bible/chapters/`,
    reader: `${API_BASE_URL}/api/v1/bible/reader/`,
    readerParallel: `${API_BASE_URL}/api/v1/bible/reader/parallel/`,
    search: `${API_BASE_URL}/api/v1/bible/search/`,
    daily: `${API_BASE_URL}/api/v1/bible/daily-passages/`,
    dailyToday: `${API_BASE_URL}/api/v1/bible/daily-passages/today/`,
    dailyPassages: `${API_BASE_URL}/api/v1/bible/daily-passages/`,
    topics: `${API_BASE_URL}/api/v1/bible/topics/`,
    schedules: `${API_BASE_URL}/api/v1/bible/schedules/`,
    meditations: `${API_BASE_URL}/api/v1/bible/meditation-posts/`,
    meditationPosts: `${API_BASE_URL}/api/v1/bible/meditation-posts/`,
    prayers: `${API_BASE_URL}/api/v1/bible/prayers/`,
    prayersPublic: `${API_BASE_URL}/api/v1/bible/prayers/public/`,
    prayersAdminList: `${API_BASE_URL}/api/v1/bible/prayers/admin-list/`,
    prayerMarkPrayed: (id: string | number) => `${API_BASE_URL}/api/v1/bible/prayers/${id}/mark-prayed/`,
    prayerMonths: `${API_BASE_URL}/api/v1/bible/prayer-months/`,
    prayerMonthCurrent: `${API_BASE_URL}/api/v1/bible/prayer-months/current/`,
    prayerDays: `${API_BASE_URL}/api/v1/bible/prayer-days/`,
    courses: `${API_BASE_URL}/api/v1/bible/courses/`,
    courseReact: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/courses/${id}/react/`,
    courseShare: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/courses/${id}/share/`,
    courseCertificate: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/courses/${id}/certificate/`,
    courseComments: `${API_BASE_URL}/api/v1/bible/course-comments/`,
    lessonReact: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/lessons/${id}/react/`,
    lessonComments: `${API_BASE_URL}/api/v1/bible/lesson-comments/`,
    courseModules: `${API_BASE_URL}/api/v1/bible/course-modules/`,
    lessons: `${API_BASE_URL}/api/v1/bible/lessons/`,
    enrollments: `${API_BASE_URL}/api/v1/bible/course-enrollments/`,
    enrollmentComplete: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/course-enrollments/${id}/complete/`,
    enrollmentPurchase: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/course-enrollments/${id}/purchase/`,
    lessonProgress: `${API_BASE_URL}/api/v1/bible/lesson-progress/`,
    courseTracks: `${API_BASE_URL}/api/v1/bible/course-tracks/`,
    courseTrackItems: `${API_BASE_URL}/api/v1/bible/course-track-items/`,
    coursePrerequisites: `${API_BASE_URL}/api/v1/bible/course-prerequisites/`,
    quizzes: `${API_BASE_URL}/api/v1/bible/quizzes/`,
    quizQuestions: `${API_BASE_URL}/api/v1/bible/quiz-questions/`,
    quizChoices: `${API_BASE_URL}/api/v1/bible/quiz-choices/`,
    quizAttempts: `${API_BASE_URL}/api/v1/bible/quiz-attempts/`,
    quizSubmit: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/quizzes/${id}/submit/`,
    assignments: `${API_BASE_URL}/api/v1/bible/assignments/`,
    assignmentSubmissions: `${API_BASE_URL}/api/v1/bible/assignment-submissions/`,
    assignmentGrade: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/assignment-submissions/${id}/grade/`,
    peerReviews: `${API_BASE_URL}/api/v1/bible/peer-reviews/`,
    courseForums: `${API_BASE_URL}/api/v1/bible/course-forums/`,
    forumThreads: `${API_BASE_URL}/api/v1/bible/forum-threads/`,
    forumPosts: `${API_BASE_URL}/api/v1/bible/forum-posts/`,
    mentors: `${API_BASE_URL}/api/v1/bible/mentors/`,
    liveSessions: `${API_BASE_URL}/api/v1/bible/live-sessions/`,
    liveAttendance: `${API_BASE_URL}/api/v1/bible/live-attendance/`,
    liveAttendanceJoin: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/live-attendance/${id}/join/`,
    liveAttendanceLeave: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/live-attendance/${id}/leave/`,
    liveRecordings: `${API_BASE_URL}/api/v1/bible/live-recordings/`,
    courseBundles: `${API_BASE_URL}/api/v1/bible/course-bundles/`,
    courseBundleItems: `${API_BASE_URL}/api/v1/bible/course-bundle-items/`,
    courseCoupons: `${API_BASE_URL}/api/v1/bible/course-coupons/`,
    courseSeatPools: `${API_BASE_URL}/api/v1/bible/course-seat-pools/`,
    courseRefunds: `${API_BASE_URL}/api/v1/bible/course-refunds/`,
    credentials: `${API_BASE_URL}/api/v1/bible/credentials/`,
    credentialShare: (id: string | number) =>
      `${API_BASE_URL}/api/v1/bible/credentials/${id}/share/`,
    credentialSharePublic: (token: string) =>
      `${API_BASE_URL}/api/v1/bible/credentials/share/${token}/`,
    plans: `${API_BASE_URL}/api/v1/bible/plans/`,
    planEnrollments: `${API_BASE_URL}/api/v1/bible/plan-enrollments/`,
    history: `${API_BASE_URL}/api/v1/bible/history/`,
    bookmarks: `${API_BASE_URL}/api/v1/bible/bookmarks/`,
    notes: `${API_BASE_URL}/api/v1/bible/notes/`,
    highlights: `${API_BASE_URL}/api/v1/bible/highlights/`,
    highlightColors: `${API_BASE_URL}/api/v1/bible/highlights/colors/`,
    memory: `${API_BASE_URL}/api/v1/bible/memory/`,
    preferences: `${API_BASE_URL}/api/v1/bible/preferences/`,
    preferencesCurrent: `${API_BASE_URL}/api/v1/bible/preferences/current/`,
    readingEvents: `${API_BASE_URL}/api/v1/bible/reading-events/`,
    readingEventFromSelection: `${API_BASE_URL}/api/v1/bible/reading-events/from-selection/`,
    translationRegistry: `${API_BASE_URL}/api/v1/bible/translation-registry/`,
    translationRegistryScan: `${API_BASE_URL}/api/v1/bible/translation-registry/scan/`,
    contentAudit: `${API_BASE_URL}/api/v1/bible/content-audit/`,
    crossReferences: `${API_BASE_URL}/api/v1/bible/cross-references/`,
    stats: `${API_BASE_URL}/api/v1/bible/stats/`,
    spiritualGrowthSummary: `${API_BASE_URL}/api/v1/bible/spiritual-growth-summary/`,
    kcanBooks: `${API_BASE_URL}/api/v1/bible/kcan-books/`,
    kcanBook: (id: string | number) => `${API_BASE_URL}/api/v1/bible/kcan-books/${id}/`,
    kcanMessageTopics: `${API_BASE_URL}/api/v1/bible/kcan-message-topics/`,
    kcanMinisters: `${API_BASE_URL}/api/v1/bible/kcan-ministers/`,
    kcanMessages: `${API_BASE_URL}/api/v1/bible/kcan-messages/`,
    kcanMessageView: (id: string | number) => `${API_BASE_URL}/api/v1/bible/kcan-messages/${id}/view/`,
  },
  education: {
    discovery: `${API_BASE_URL}/api/v1/bible/courses/`,
    search: `${API_BASE_URL}/api/v1/bible/search/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/bible/courses/${id}/`,
    certificate: (id: string) =>
      `${API_BASE_URL}/api/v1/bible/courses/${id}/certificate/`,
    certificateShare: (token: string) =>
      `${API_BASE_URL}/api/v1/bible/credentials/share/${token}/`,
    enroll: (id: string) =>
      `${API_BASE_URL}/api/v1/bible/course-enrollments/`,
    itemAction: (contentId: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/bible/courses/${contentId}/lessons/${itemId}/`,
    progress: `${API_BASE_URL}/api/v1/bible/course-enrollments/`,
    review: `${API_BASE_URL}/api/v1/bible/peer-reviews/`,
    contentReviews: (id: string) =>
      `${API_BASE_URL}/api/v1/bible/peer-reviews/?course=${id}`,
    contentQuestions: (id: string) =>
      `${API_BASE_URL}/api/v1/bible/quiz-questions/?course=${id}`,
    bookingSatisfy: (institutionId: string, bookingId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/bookings/${bookingId}/satisfy/`,
    partnerLinks: (partnerId: string) =>
      `${API_BASE_URL}/api/v1/partners/${partnerId}/links/`,
    partnerLink: (partnerId: string, profileKey: string) =>
      `${API_BASE_URL}/api/v1/partners/${partnerId}/links/${profileKey}/`,
    enrollments: `${API_BASE_URL}/api/v1/bible/course-enrollments/`,
  },
  partners: {
    list: `${API_BASE_URL}/api/v1/partners/`,
    create: `${API_BASE_URL}/api/v1/partners/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/`,
    discordSummary: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/discord-summary/`,
    discover: `${API_BASE_URL}/api/v1/partners/discover/`,
    apply: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/apply/`,
    subscribe: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/subscribe/`,
    approveApplication: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/applications/${appId}/approve/`,
    jobs: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/jobs/`,
    jobDetail: (id: string, jobId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/jobs/${jobId}/`,
    settingsCatalog: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/settings-catalog/`,
    settings: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/settings/`,
    settingsConfig: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/settings-config/`,
    settingsConfigDetail: (id: string, key: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/settings-config/${key}/`,
    organizationProfile: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-profile/`,
    organizationApps: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/`,
    organizationApp: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/`,
    organizationAppAccessLog: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/access-log/`,
    organizationAppTabs: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/tabs/`,
    organizationAppTabBlocks: (id: string, appId: string, tabId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/tabs/${tabId}/blocks/`,
    organizationAppTab: (id: string, appId: string, tabId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/tabs/${tabId}/`,
    organizationAppBlock: (id: string, appId: string, tabId: string, blockId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/tabs/${tabId}/blocks/${blockId}/`,
    organizationAppsGlobal: `${API_BASE_URL}/api/v1/partners/organization-apps/global/`,
    appShortcuts: `${API_BASE_URL}/api/v1/partners/app-shortcuts/`,
    appShortcutRemove: (id: string) => `${API_BASE_URL}/api/v1/partners/app-shortcuts/${id}/`,
    appShortcutOpened: (id: string) => `${API_BASE_URL}/api/v1/partners/app-shortcuts/${id}/opened/`,
    appShortcutsAnalytics: `${API_BASE_URL}/api/v1/partners/app-shortcuts/analytics/`,
    organizationAppPromote: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/promote/`,
    // Location & Attendance
    locationEvents: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/`,
    locationEvent: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/`,
    locationCheckin: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/checkin/`,
    locationMyStatus: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/my-status/`,
    locationAttendance: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/attendance/`,
    locationManualCheckin: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/attendance/manual-checkin/`,
    locationAttendanceExport: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/attendance/export/`,
    locationZones: (id: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/events/${eventId}/zones/`,
    locationConsent: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/consent/`,
    locationAudit: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/location/audit/`,
    policy: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/policy/`,
    auditEvents: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/audit-events/`,
    roles: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/roles/`,
    roleAssignments: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/role-assignments/`,
    removeRoleAssignment: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/role-assignments/remove/`,
    integrations: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/integrations/`,
    integrationUpdate: (id: string, integrationId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/integrations/${integrationId}/`,
    webhooks: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/webhooks/`,
    webhookUpdate: (id: string, webhookId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/webhooks/${webhookId}/`,
    webhookRemove: (id: string, webhookId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/webhooks/${webhookId}/remove/`,
    webhookDeliveries: (id: string, webhookId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/webhooks/${webhookId}/deliveries/`,
    webhookDeliveryRetry: (id: string, webhookId: string, deliveryId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/webhooks/${webhookId}/deliveries/${deliveryId}/retry/`,
    automationRules: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/`,
    automationRuleUpdate: (id: string, ruleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/${ruleId}/`,
    automationRuleRemove: (id: string, ruleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/${ruleId}/remove/`,
    reportsSummary: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/reports/summary/`,
    exports: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/exports/`,
    exportSchedules: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/`,
    exportScheduleUpdate: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/`,
    exportScheduleRemove: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/remove/`,
    exportScheduleRun: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/run/`,
    accessRequests: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-requests/`,
    accessRequestApprove: (id: string, requestId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-requests/${requestId}/approve/`,
    accessRequestReject: (id: string, requestId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-requests/${requestId}/reject/`,
    accessReviews: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-reviews/`,
    accessReviewClose: (id: string, reviewId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-reviews/${reviewId}/close/`,
    posts: `${API_BASE_URL}/api/v1/partners/posts/`,
    postComment: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/comment/`,
    postComments: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/comments/`,
    postCommentRoom: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/comment-room/`,
    postReact: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/react/`,
    postDelete: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/delete/`,
    postBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/posts/${id}/broadcast/`,
    deactivate: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/deactivate/`,
    reactivate: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/reactivate/`,
    remove: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/remove/`,
    verificationStatus: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/verification-status/`,
    verificationStart: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/verification/start/`,
  },
  broadcasts: {
    list: `${API_BASE_URL}/api/v1/broadcasts/`,
    react: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/react/`,
    share: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/share/`,
    save: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/save/`,
    hide: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/hide/`,
    commentRoom: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/${id}/comment-room/`,
    channelMessages: `${API_BASE_URL}/api/v1/broadcasts/channel-messages/`,
    features: `${API_BASE_URL}/api/v1/broadcasts/features/`,
    channelFeatures: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/features/`,
    channels: `${API_BASE_URL}/api/v1/broadcasts/channels/`,
    channelDetail: (handleOrId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${handleOrId}/`,
    channelSubscribe: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/subscribe/`,
    channelSubscription: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/subscription/`,
    channelReport: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/report/`,
    channelModeration: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/moderation/`,
    channelAnalytics: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/analytics/`,
    channelBroadcast: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/broadcast/`,
    channelContents: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/contents/`,
    channelPlaylists: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/playlists/`,
    channelLiveStreams: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/live-streams/`,
    liveStreamDetail: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/`,
    liveStreamStart: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/start/`,
    liveStreamEnd: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/end/`,
    // Streaming credentials & ingest
    liveStreamStreamKey: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/stream-key/`,
    liveStreamWhip: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/whip/`,
    // Multi-camera source management
    liveStreamCameras: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/cameras/`,
    liveStreamSwitchCamera: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/switch-camera/`,
    // Live chat for a specific stream
    liveStreamChat: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/chat/`,
    // Per-channel notification preference (notify on live / new content)
    channelNotificationPreference: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/notification-preference/`,
    embedContent: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/embed/contents/${contentId}/`,
    embedContentOembed: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/embed/contents/${contentId}/oembed/`,
    publicChannelLanding: (handle: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/public/channels/${handle}/`,
    publicContentLanding: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/public/contents/${contentId}/`,
    publicSitemapPlan: `${API_BASE_URL}/api/v1/broadcasts/public/sitemap-plan/`,
    publicRobots: `${API_BASE_URL}/api/v1/broadcasts/public/robots.txt`,
    channelContentEmbedToken: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/embed-token/`,
    channelContentReact: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/react/`,
    channelContentSave: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/save/`,
    channelContentShare: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/share/`,
    channelContentView: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/view/`,
    channelContentReport: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/report/`,
    channelContentBroadcast: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/broadcast/`,
    channelContentComments: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/comments/`,
    channelCommentModerate: (commentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/moderate/`,
    channelCommentReact: (commentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/react/`,
    channelCommentPin: (commentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/pin/`,
    channelModerationAction: (recordId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-moderation/${recordId}/action/`,
    watchHistory: `${API_BASE_URL}/api/v1/broadcasts/watch-history/`,
    channelContentClip: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/clip/`,
    playlistItems: (playlistId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/playlists/${playlistId}/items/`,
    playlistItemDetail: (playlistId: string, contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/playlists/${playlistId}/items/${contentId}/`,
    // Live stream viewer presence (REST fallback for when socket is unavailable)
    liveStreamViewerPing: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/viewer-ping/`,
    // User-created personal playlists (cross-device, server-persisted)
    userPlaylists: `${API_BASE_URL}/api/v1/broadcasts/user-playlists/`,
    userPlaylistDetail: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/user-playlists/${id}/`,
    userPlaylistItems: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/user-playlists/${id}/items/`,
    userPlaylistItemDetail: (id: string, itemId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/user-playlists/${id}/items/${itemId}/`,
    channelContentDetail: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/`,
    channelContentPublish: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/publish/`,
    channelContentSchedule: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/schedule/`,
    channelContentUnpublish: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/unpublish/`,
    channelContentAssets: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/assets/`,
    videos: (type?: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/videos/${
        type ? `?type=${encodeURIComponent(type)}` : ''
      }`,
    videoStream: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/videos/${id}/stream/`,
    lessons: `${API_BASE_URL}/api/v1/broadcasts/lessons/`,
    lessonEnrollments: `${API_BASE_URL}/api/v1/broadcasts/lessons/enrollments/`,
    lessonEnroll: (lessonId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/lessons/${lessonId}/enroll/`,
    createProfile: `${API_BASE_URL}/api/v1/broadcasts/profiles/create/`,
    feedProfile: `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/`,
    feedEntry: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/`,
    feedEntryBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/broadcast/`,
    feedEntryUnbroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/unbroadcast/`,
    feedEntryAttachment: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/attachments/`,
    profileAttachment: `${API_BASE_URL}/api/v1/broadcasts/profiles/attachment/`,
    profileManage: `${API_BASE_URL}/api/v1/broadcasts/profiles/manage/`,
    subscribe: `${API_BASE_URL}/api/v1/broadcasts/subscribe/`,
    educationCourseBroadcast: `${API_BASE_URL}/api/v1/broadcasts/education/courses/broadcast/`,
    educationHub: `${API_BASE_URL}/api/v1/broadcasts/education/hub/`,
    educationInstitutions: `${API_BASE_URL}/api/v1/broadcasts/education/institutions/`,
    educationInstitution: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/`,
    educationInstitutionVerificationStatus: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/verification-status/`,
    educationInstitutionVerificationStart: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/verification/start/`,
    educationInstitutionDashboard: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/dashboard/`,
    educationInstitutionMemberships: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/memberships/`,
    educationInstitutionMembershipAction: (
      institutionId: string,
      membershipId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/memberships/${membershipId}/action/`,
    educationInstitutionStudentMembershipDetail: (
      institutionId: string,
      membershipId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/memberships/${membershipId}/student-detail/`,
    educationInstitutionStaffMembershipDetail: (
      institutionId: string,
      membershipId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/memberships/${membershipId}/staff-detail/`,
    educationInstitutionStaffAssignments: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/staff-assignments/`,
    educationInstitutionStaffAssignment: (
      institutionId: string,
      assignmentId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/staff-assignments/${assignmentId}/`,
    educationInstitutionEnrollments: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/enrollments/`,
    educationInstitutionEnrollmentDetail: (
      institutionId: string,
      enrollmentId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/enrollments/${enrollmentId}/`,
    educationInstitutionEnrollmentAction: (
      institutionId: string,
      enrollmentId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/enrollments/${enrollmentId}/action/`,
    educationInstitutionBookings: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/bookings/`,
    educationInstitutionBookingDetail: (
      institutionId: string,
      bookingId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/bookings/${bookingId}/`,
    educationInstitutionBookingAction: (
      institutionId: string,
      bookingId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/bookings/${bookingId}/action/`,
    educationInstitutionPrograms: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/programs/`,
    educationInstitutionProgram: (institutionId: string, programId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/programs/${programId}/`,
    educationInstitutionProgramDetail: (
      institutionId: string,
      programId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/programs/${programId}/`,
    educationInstitutionCourses: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/courses/`,
    educationInstitutionCourse: (institutionId: string, courseId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/`,
    educationInstitutionCourseDetail: (
      institutionId: string,
      courseId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/`,
    educationInstitutionCourseModules: (
      institutionId: string,
      courseId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/modules/`,
    educationInstitutionCourseModule: (
      institutionId: string,
      courseId: string,
      moduleId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/modules/${moduleId}/`,
    educationInstitutionCourseModuleItems: (
      institutionId: string,
      courseId: string,
      moduleId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/modules/${moduleId}/items/`,
    educationInstitutionCourseModuleItem: (
      institutionId: string,
      courseId: string,
      moduleId: string,
      itemId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/courses/${courseId}/modules/${moduleId}/items/${itemId}/`,
    educationInstitutionLessons: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/lessons/`,
    educationInstitutionLesson: (institutionId: string, lessonId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/lessons/${lessonId}/`,
    educationInstitutionLessonDetail: (
      institutionId: string,
      lessonId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/lessons/${lessonId}/`,
    educationInstitutionClassSessions: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/class-sessions/`,
    educationInstitutionClassSession: (
      institutionId: string,
      sessionId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/class-sessions/${sessionId}/`,
    educationInstitutionClassSessionDetail: (
      institutionId: string,
      sessionId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/class-sessions/${sessionId}/`,
    educationInstitutionMaterials: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/materials/`,
    educationInstitutionMaterial: (institutionId: string, materialId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/materials/${materialId}/`,
    educationInstitutionEvents: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/events/`,
    educationInstitutionEvent: (institutionId: string, eventId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/events/${eventId}/`,
    educationInstitutionBroadcasts: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/broadcasts/`,
    educationInstitutionBroadcast: (
      institutionId: string,
      broadcastId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/broadcasts/${broadcastId}/`,
    educationInstitutionAssessments: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${id}/assessments/`,
    educationInstitutionAssessment: (
      institutionId: string,
      assessmentId: string,
    ) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/institutions/${institutionId}/assessments/${assessmentId}/`,
    educationProfiles: `${API_BASE_URL}/api/v1/broadcasts/education/profiles/`,
    educationProfile: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/profiles/${id}/`,
    educationProfileBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/profiles/${id}/broadcast/`,
    educationProfilePermissions: `${API_BASE_URL}/api/v1/broadcasts/education/profiles/permissions/`,
    healthCards: (institutionId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/cards/${encodeURIComponent(
        institutionId,
      )}/`,
    healthMediums: `${API_BASE_URL}/api/v1/broadcasts/health/mediums/`,
    healthMedium: (mediumId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/mediums/${encodeURIComponent(
        mediumId,
      )}/`,
    healthServices: `${API_BASE_URL}/api/v1/broadcasts/health/services/`,
    healthService: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/services/${encodeURIComponent(
        serviceId,
      )}/`,
    upload: `${API_BASE_URL}/api/v1/broadcasts/upload/`,
    channelContentChapters: (contentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/chapters/`,
    channelContentChapterDetail: (contentId: string, chapterId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/chapters/${chapterId}/`,
    channelCommentReport: (commentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/report/`,
    clipShare: (clipId: string) => `${API_BASE_URL}/api/v1/broadcasts/clips/${clipId}/share/`,
    channelCommentEdit: (commentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/edit/`,
    channelCommentDelete: (commentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/delete/`,
    channelCommentHeart: (commentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-comments/${commentId}/heart/`,
    channelContentSubtitles: (contentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/subtitles/`,
    channelContentRelated: (contentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/related/`,
    channelContentEndScreen: (contentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/end-screen/`,
    channelContentCards: (contentId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/cards/`,
    channelContentClipDetail: (contentId: string, clipId: string) => `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/clips/${clipId}/`,
    channelActivity: (channelId: string) => `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/activity/`,
    channelSubscribers: (channelId: string) => `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/subscribers/`,
    liveStreamPolls: (streamId: string) => `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/polls/`,
    livePollVote: (pollId: string) => `${API_BASE_URL}/api/v1/broadcasts/polls/${pollId}/vote/`,
    livePollEnd: (pollId: string) => `${API_BASE_URL}/api/v1/broadcasts/polls/${pollId}/end/`,
    liveStreamQA: (streamId: string) => `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/qa/`,
    qaSessionQuestions: (sessionId: string) => `${API_BASE_URL}/api/v1/broadcasts/qa/${sessionId}/questions/`,
    qaQuestionUpvote: (questionId: string) => `${API_BASE_URL}/api/v1/broadcasts/qa-questions/${questionId}/upvote/`,
    watchHistorySettings: `${API_BASE_URL}/api/v1/broadcasts/watch-history/settings/`,

    // Trending
    broadcastsTrending: `${API_BASE_URL}/api/v1/broadcasts/trending/`,

    // Content download
    channelContentDownload: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channel-contents/${contentId}/download/`,

    // Live archive (DVR webhook / manual trigger)
    liveStreamArchive: (streamId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/live-streams/${streamId}/archive/`,

    // Channel membership tiers + user membership
    channelMembershipTiers: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/membership-tiers/`,
    channelMembership: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/membership/`,
    tipCreator: (contentId: string) =>
      `${API_BASE_URL}/api/v1/broadcast-items/${contentId}/tip/`,
  },
  commerce: {
    carts: `${API_BASE_URL}/api/v1/commerce/carts/`,
    cartCurrent: `${API_BASE_URL}/api/v1/commerce/carts/current/`,
    cart: (id: string) => `${API_BASE_URL}/api/v1/commerce/carts/${id}/`,
    shops: `${API_BASE_URL}/api/v1/commerce/shops/`,
    shopVerificationStatus: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shops/${id}/`,
    shopVerificationStart: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shops/${id}/request_verification/`,
    products: `${API_BASE_URL}/api/v1/commerce/products/`,
    discovery: `${API_BASE_URL}/api/v1/commerce/discovery/`,
    productReviews: `${API_BASE_URL}/api/v1/commerce/product-reviews/`,
    productQuestions: `${API_BASE_URL}/api/v1/commerce/product-questions/`,
    productBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/products/${id}/broadcast/`,
    productSubscribe: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/products/${id}/subscribe/`,
    shopServiceBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shop-services/${id}/broadcast/`,
    shopJoin: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shops/${id}/join/`,
    shopMembers: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shops/${id}/members/`,
    shopTeamMembers: `${API_BASE_URL}/api/v1/commerce/shop-members/`,
    shopTeamMember: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shop-members/${id}/`,
    shopServices: `${API_BASE_URL}/api/v1/commerce/shop-services/`,
    shopService: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/shop-services/${id}/`,
    serviceBooking: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/`,
    serviceBookingReceipt: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/receipt/`,
    serviceBookingReceiptRegenerate: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/receipt/regenerate/`,
    serviceBookingCancel: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/cancel/`,
    serviceBookingReschedule: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/reschedule/`,
    serviceBookingPayRemaining: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/pay-remaining/`,
    payment: (id: string) => `${API_BASE_URL}/api/v1/commerce/payments/${id}/`,
    paymentSatisfy: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/payments/${id}/satisfy/`,
    follows: `${API_BASE_URL}/api/v1/commerce/follows/`,
    productCategories: `${API_BASE_URL}/api/v1/commerce/product-categories/`,
    catalogCategories: `${API_BASE_URL}/api/v1/commerce/product-categories/`,
    productCategoryDetail: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/product-categories/${id}/`,
    productRatings: `${API_BASE_URL}/api/v1/commerce/product-ratings/`,
    serviceBookings: `${API_BASE_URL}/api/v1/commerce/service-bookings/`,
    serviceBookingComplaints: `${API_BASE_URL}/api/v1/commerce/service-booking-complaints/`,
    serviceBookingComplaint: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-booking-complaints/${id}/`,
    cartItems: `${API_BASE_URL}/api/v1/commerce/cart-items/`,
    cartItem: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/cart-items/${id}/`,
    marketplaceOrders: `${API_BASE_URL}/api/v1/commerce/marketplace-orders/`,
    marketplaceProviderOrders: `${API_BASE_URL}/api/v1/commerce/marketplace-provider-orders/`,
    marketplaceOrder: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/`,
    marketplaceOrderCancel: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/cancel/`,
    marketplaceOrderSatisfy: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/satisfy/`,
    marketplaceOrderComplete: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/complete/`,
    marketplaceOrderDelete: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/`,
    marketplaceOrderReceipt: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/marketplace-orders/${id}/receipt/`,
    promotions: `${API_BASE_URL}/api/v1/commerce/promotions/`,
    promotion: (id: string) => `${API_BASE_URL}/api/v1/commerce/promotions/${id}/`,
    shopVerifications: `${API_BASE_URL}/api/v1/commerce/shop-verifications/`,
    shopVerification: (id: string) => `${API_BASE_URL}/api/v1/commerce/shop-verifications/${id}/`,
    productAuthChecks: `${API_BASE_URL}/api/v1/commerce/product-auth-checks/`,
    productAuthCheck: (id: string) => `${API_BASE_URL}/api/v1/commerce/product-auth-checks/${id}/`,
    marketplaceComplaints: `${API_BASE_URL}/api/v1/commerce/marketplace-complaints/`,
    marketplaceComplaint: (id: string) => `${API_BASE_URL}/api/v1/commerce/marketplace-complaints/${id}/`,
  },
  feeds: {
    create: `${NEST_API_BASE_URL}/api/v1/feeds`,
    broadcast: (id: string) =>
      `${NEST_API_BASE_URL}/api/v1/feeds/${id}/broadcast`,
    broadcastFromChannel: `${NEST_API_BASE_URL}/api/v1/feeds/broadcast-from-channel`,
  },
};

export default broadcastRoutes;
