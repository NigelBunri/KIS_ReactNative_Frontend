import { API_BASE_URL } from '../config';

// This module did not exist before — every ROUTES.bible.* call across
// src/components/Bible/** and the Bible tab screens resolved to `undefined`
// at runtime (ROUTES.bible was never defined/spread into the aggregator in
// network/index.tsx), throwing as soon as any Bible panel tried to sync.
// Paths below are derived directly from apps/bible/urls.py (router
// registrations + @action url_paths + the standalone APIView paths).
const b = (path: string) => API_BASE_URL + "/api/v1/bible/" + path;

const bibleRoutes = {
  bible: {
    translations: b("translations/"),
    books: b("books/"),
    chapters: b("chapters/"),
    reader: b("reader/"),
    search: b("search/"),
    stats: b("stats/"),
    spiritualGrowthSummary: b("spiritual-growth-summary/"),

    translationRegistry: b("translation-registry/"),
    translationRegistryScan: b("translation-registry/scan/"),

    topics: b("topics/"),
    dailyPassages: b("daily-passages/"),
    dailyToday: b("daily-passages/today/"),
    meditationPosts: b("meditation-posts/"),
    prayerMonthCurrent: b("prayer-months/current/"),
    prayerDays: b("prayer-days/"),
    contentAudit: b("content-audit/"),

    plans: b("plans/"),
    planEnrollments: b("plan-enrollments/"),
    history: b("history/"),
    readingEvents: b("reading-events/"),
    readingEventFromSelection: b("reading-events/from-selection/"),

    bookmarks: b("bookmarks/"),
    notes: b("notes/"),
    highlights: b("highlights/"),
    highlightColors: b("highlights/colors/"),
    memory: b("memory/"),
    preferencesCurrent: b("preferences/current/"),
    crossReferences: b("cross-references/"),

    courses: b("courses/"),
    courseModules: b("course-modules/"),
    lessons: b("lessons/"),
    enrollments: b("course-enrollments/"),
    enrollmentComplete: (id: string) => b(`course-enrollments/${id}/complete/`),
    enrollmentPurchase: (id: string) => b(`course-enrollments/${id}/purchase/`),
    lessonProgress: b("lesson-progress/"),
    courseComments: b("course-comments/"),
    lessonComments: b("lesson-comments/"),
    courseReact: (id: string) => b(`courses/${id}/react/`),
    courseShare: (id: string) => b(`courses/${id}/share/`),
    lessonReact: (id: string) => b(`lessons/${id}/react/`),
    courseCertificate: (id: string) => b(`courses/${id}/certificate/`),

    courseTracks: b("course-tracks/"),
    courseTrackItems: b("course-track-items/"),
    courseTrackItemDetail: (id: string) => b(`course-track-items/${id}/`),
    courseTrackAssign: (id: string) => b(`course-tracks/${id}/assign/`),
    courseTrackUnassign: (id: string) => b(`course-tracks/${id}/unassign/`),
    courseTrackRoster: (id: string) => b(`course-tracks/${id}/roster/`),
    courseTrackProgress: b("course-track-progress/"),
    coursePrerequisites: b("course-prerequisites/"),

    quizzes: b("quizzes/"),
    quizQuestions: b("quiz-questions/"),
    quizChoices: b("quiz-choices/"),
    quizAttempts: b("quiz-attempts/"),
    quizSubmit: (id: string) => b(`quizzes/${id}/submit/`),

    assignments: b("assignments/"),
    assignmentSubmissions: b("assignment-submissions/"),
    peerReviews: b("peer-reviews/"),

    courseForums: b("course-forums/"),
    forumThreads: b("forum-threads/"),
    forumPosts: b("forum-posts/"),
    mentors: b("mentors/"),

    liveSessions: b("live-sessions/"),
    liveAttendance: b("live-attendance/"),
    liveAttendanceJoin: (id: string) => b(`live-attendance/${id}/join/`),
    liveRecordings: b("live-recordings/"),

    courseBundles: b("course-bundles/"),
    courseBundleItems: b("course-bundle-items/"),
    courseCoupons: b("course-coupons/"),
    courseSeatPools: b("course-seat-pools/"),
    courseRefunds: b("course-refunds/"),
    credentials: b("credentials/"),
    credentialShare: (id: string) => b(`credentials/${id}/share/`),
    credentialShareView: (token: string) => b(`credentials/share/${token}/`),

    kcanBooks: b("kcan-books/"),
    kcanMessageTopics: b("kcan-message-topics/"),
    kcanMinisters: b("kcan-ministers/"),
    kcanMessages: b("kcan-messages/"),
    kcanMessageView: (id: string) => b(`kcan-messages/${id}/view/`),
  },
};

export default bibleRoutes;
