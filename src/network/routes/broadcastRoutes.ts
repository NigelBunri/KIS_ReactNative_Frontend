import { API_BASE_URL, NEST_API_BASE_URL } from '../config';

const broadcastRoutes = {
  bible: {
    translations: `${API_BASE_URL}/api/v1/bible/translations/`,
    books: `${API_BASE_URL}/api/v1/bible/books/`,
    chapters: `${API_BASE_URL}/api/v1/bible/chapters/`,
    reader: `${API_BASE_URL}/api/v1/bible/reader/`,
    search: `${API_BASE_URL}/api/v1/bible/search/`,
    daily: `${API_BASE_URL}/api/v1/bible/daily/`,
    topics: `${API_BASE_URL}/api/v1/bible/topics/`,
    schedules: `${API_BASE_URL}/api/v1/bible/schedules/`,
    meditations: `${API_BASE_URL}/api/v1/bible/meditations/`,
    prayers: `${API_BASE_URL}/api/v1/bible/prayers/`,
    prayersPublic: `${API_BASE_URL}/api/v1/bible/prayers/public/`,
    courses: `${API_BASE_URL}/api/v1/bible/courses/`,
    courseReact: (id: string | number) => `${API_BASE_URL}/api/v1/bible/courses/${id}/react/`,
    courseShare: (id: string | number) => `${API_BASE_URL}/api/v1/bible/courses/${id}/share/`,
    courseCertificate: (id: string | number) => `${API_BASE_URL}/api/v1/bible/courses/${id}/certificate/`,
    courseComments: `${API_BASE_URL}/api/v1/bible/course-comments/`,
    lessonReact: (id: string | number) => `${API_BASE_URL}/api/v1/bible/lessons/${id}/react/`,
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
    quizSubmit: (id: string | number) => `${API_BASE_URL}/api/v1/bible/quizzes/${id}/submit/`,
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
    credentialShare: (id: string | number) => `${API_BASE_URL}/api/v1/bible/credentials/${id}/share/`,
    credentialSharePublic: (token: string) =>
      `${API_BASE_URL}/api/v1/bible/credentials/share/${token}/`,
    plans: `${API_BASE_URL}/api/v1/bible/plans/`,
    planEnrollments: `${API_BASE_URL}/api/v1/bible/plan-enrollments/`,
    history: `${API_BASE_URL}/api/v1/bible/history/`,
    bookmarks: `${API_BASE_URL}/api/v1/bible/bookmarks/`,
    notes: `${API_BASE_URL}/api/v1/bible/notes/`,
    highlights: `${API_BASE_URL}/api/v1/bible/highlights/`,
    memory: `${API_BASE_URL}/api/v1/bible/memory/`,
    preferences: `${API_BASE_URL}/api/v1/bible/preferences/`,
    crossReferences: `${API_BASE_URL}/api/v1/bible/cross-references/`,
    stats: `${API_BASE_URL}/api/v1/bible/stats/`,
  },
  education: {
    discovery: `${API_BASE_URL}/api/v1/education/discovery/`,
    search: `${API_BASE_URL}/api/v1/education/search/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/education/contents/${id}/`,
    enroll: (id: string) => `${API_BASE_URL}/api/v1/education/contents/${id}/enroll/`,
    progress: `${API_BASE_URL}/api/v1/education/progress/`,
    review: `${API_BASE_URL}/api/v1/education/reviews/`,
    contentReviews: (id: string) => `${API_BASE_URL}/api/v1/education/contents/${id}/reviews/`,
    partnerLinks: (partnerId: string) => `${API_BASE_URL}/api/v1/partners/${partnerId}/links/`,
    partnerLink: (partnerId: string, profileKey: string) =>
      `${API_BASE_URL}/api/v1/partners/${partnerId}/links/${profileKey}/`,
    enrollments: `${API_BASE_URL}/api/v1/education/enrollments/`,
  },
  partners: {
    list: `${API_BASE_URL}/api/v1/partners/`,
    create: `${API_BASE_URL}/api/v1/partners/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/`,
    discover: `${API_BASE_URL}/api/v1/partners/discover/`,
    apply: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/apply/`,
    subscribe: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/subscribe/`,
    approveApplication: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/applications/${appId}/approve/`,
    jobs: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/jobs/`,
    jobDetail: (id: string, jobId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/jobs/${jobId}/`,
    settingsCatalog: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/settings-catalog/`,
    settings: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/settings/`,
    settingsConfig: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/settings-config/`,
    settingsConfigDetail: (id: string, key: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/settings-config/${key}/`,
    organizationProfile: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/organization-profile/`,
    organizationApps: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/`,
    organizationApp: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/`,
    organizationAppAccessLog: (id: string, appId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/organization-apps/${appId}/access-log/`,
    policy: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/policy/`,
    auditEvents: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/audit-events/`,
    roles: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/roles/`,
    roleAssignments: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/role-assignments/`,
    removeRoleAssignment: (id: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/role-assignments/remove/`,
    integrations: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/integrations/`,
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
    automationRules: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/`,
    automationRuleUpdate: (id: string, ruleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/${ruleId}/`,
    automationRuleRemove: (id: string, ruleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/automation-rules/${ruleId}/remove/`,
    reportsSummary: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/reports/summary/`,
    exports: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/exports/`,
    exportSchedules: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/`,
    exportScheduleUpdate: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/`,
    exportScheduleRemove: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/remove/`,
    exportScheduleRun: (id: string, scheduleId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/export-schedules/${scheduleId}/run/`,
    accessRequests: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/access-requests/`,
    accessRequestApprove: (id: string, requestId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-requests/${requestId}/approve/`,
    accessRequestReject: (id: string, requestId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-requests/${requestId}/reject/`,
    accessReviews: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/access-reviews/`,
    accessReviewClose: (id: string, reviewId: string) =>
      `${API_BASE_URL}/api/v1/partners/${id}/access-reviews/${reviewId}/close/`,
    posts: `${API_BASE_URL}/api/v1/partners/posts/`,
    postComment: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comment/`,
    postComments: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comments/`,
    postCommentRoom: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comment-room/`,
    postReact: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/react/`,
    postDelete: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/delete/`,
    postBroadcast: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/broadcast/`,
    deactivate: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/deactivate/`,
    reactivate: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/reactivate/`,
    remove: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/remove/`,
  },
  broadcasts: {
    list: `${API_BASE_URL}/api/v1/broadcasts/`,
    react: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/react/`,
    share: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/share/`,
    hide: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/hide/`,
    commentRoom: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/${id}/comment-room/`,
    channelMessages: `${API_BASE_URL}/api/v1/broadcasts/channel-messages/`,
    features: `${API_BASE_URL}/api/v1/broadcasts/features/`,
    channelFeatures: (channelId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/channels/${channelId}/features/`,
    videos: (type?: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/videos/${type ? `?type=${encodeURIComponent(type)}` : ''}`,
    videoStream: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/videos/${id}/stream/`,
    lessons: `${API_BASE_URL}/api/v1/broadcasts/lessons/`,
    lessonEnrollments: `${API_BASE_URL}/api/v1/broadcasts/lessons/enrollments/`,
    lessonEnroll: (lessonId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/lessons/${lessonId}/enroll/`,
    createProfile: `${API_BASE_URL}/api/v1/broadcasts/profiles/create/`,
    feedProfile: `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/`,
    feedEntry: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/`,
    feedEntryBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/broadcast/`,
    feedEntryAttachment: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/profiles/feeds/${id}/attachments/`,
    profileAttachment: `${API_BASE_URL}/api/v1/broadcasts/profiles/attachment/`,
    profileManage: `${API_BASE_URL}/api/v1/broadcasts/profiles/manage/`,
    subscribe: `${API_BASE_URL}/api/v1/broadcasts/subscribe/`,
    educationCourseBroadcast: `${API_BASE_URL}/api/v1/broadcasts/education/courses/broadcast/`,
    educationProfiles: `${API_BASE_URL}/api/v1/broadcasts/education/profiles/`,
    educationProfile: (id: string) => `${API_BASE_URL}/api/v1/broadcasts/education/profiles/${id}/`,
    educationProfileBroadcast: (id: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/education/profiles/${id}/broadcast/`,
    educationProfilePermissions: `${API_BASE_URL}/api/v1/broadcasts/education/profiles/permissions/`,
    healthCards: (institutionId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/cards/${encodeURIComponent(institutionId)}/`,
    healthMediums: `${API_BASE_URL}/api/v1/broadcasts/health/mediums/`,
    healthMedium: (mediumId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/mediums/${encodeURIComponent(mediumId)}/`,
    healthServices: `${API_BASE_URL}/api/v1/broadcasts/health/services/`,
    healthService: (serviceId: string) =>
      `${API_BASE_URL}/api/v1/broadcasts/health/services/${encodeURIComponent(serviceId)}/`,
    upload: `${API_BASE_URL}/api/v1/broadcasts/upload/`,
  },
  commerce: {
    shops: `${API_BASE_URL}/api/v1/commerce/shops/`,
    products: `${API_BASE_URL}/api/v1/commerce/products/`,
    productBroadcast: (id: string) => `${API_BASE_URL}/api/v1/commerce/products/${id}/broadcast/`,
    productSubscribe: (id: string) => `${API_BASE_URL}/api/v1/commerce/products/${id}/subscribe/`,
    shopServiceBroadcast: (id: string) => `${API_BASE_URL}/api/v1/commerce/shop-services/${id}/broadcast/`,
    shopJoin: (id: string) => `${API_BASE_URL}/api/v1/commerce/shops/${id}/join/`,
    shopMembers: (id: string) => `${API_BASE_URL}/api/v1/commerce/shops/${id}/members/`,
    shopTeamMembers: `${API_BASE_URL}/api/v1/commerce/shop-members/`,
    shopTeamMember: (id: string) => `${API_BASE_URL}/api/v1/commerce/shop-members/${id}/`,
    shopServices: `${API_BASE_URL}/api/v1/commerce/shop-services/`,
    shopService: (id: string) => `${API_BASE_URL}/api/v1/commerce/shop-services/${id}/`,
    serviceBooking: (id: string) => `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/`,
    serviceBookingReceipt: (id: string) => `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/receipt/`,
    serviceBookingCancel: (id: string) => `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/cancel/`,
    serviceBookingPayRemaining: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-bookings/${id}/pay-remaining/`,
    payment: (id: string) => `${API_BASE_URL}/api/v1/commerce/payments/${id}/`,
    paymentSatisfy: (id: string) => `${API_BASE_URL}/api/v1/commerce/payments/${id}/satisfy/`,
    follows: `${API_BASE_URL}/api/v1/commerce/follows/`,
    productCategories: `${API_BASE_URL}/api/v1/commerce/product-categories/`,
    productCategoryDetail: (id: string) => `${API_BASE_URL}/api/v1/commerce/product-categories/${id}/`,
    productRatings: `${API_BASE_URL}/api/v1/commerce/product-ratings/`,
    serviceBookings: `${API_BASE_URL}/api/v1/commerce/service-bookings/`,
    serviceBookingComplaints: `${API_BASE_URL}/api/v1/commerce/service-booking-complaints/`,
    serviceBookingComplaint: (id: string) =>
      `${API_BASE_URL}/api/v1/commerce/service-booking-complaints/${id}/`,
  },
  feeds: {
    create: `${NEST_API_BASE_URL}/api/v1/feeds`,
    broadcast: (id: string) => `${NEST_API_BASE_URL}/api/v1/feeds/${id}/broadcast`,
    broadcastFromChannel: `${NEST_API_BASE_URL}/api/v1/feeds/broadcast-from-channel`,
  },
};

export default broadcastRoutes;
