// src/screens/broadcast/education/api/education.models.ts
export type EducationContentType = 'course' | 'lesson' | 'workshop' | 'program' | 'credential' | 'mentorship';

export interface EducationPricing {
  id: string;
  isFree: boolean;
  amountCents?: number;
  currency?: string;
  tierAccess?: string[];
  couponCodes?: string[];
}

export interface CourseOutcome {
  id: string;
  label: string;
  description?: string;
}

export interface CourseRequirement {
  id: string;
  label: string;
}

export interface ContentTag {
  id: string;
  label: string;
}

export interface EducationInstitutionSpotlight {
  id: string;
  name: string;
  description?: string;
  institutionType?: string;
  membershipPolicy?: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  programCount?: number;
  courseCount?: number;
  eventCount?: number;
  publishedBroadcastCount?: number;
  memberCount?: number;
}

export interface EducationTrustSignals {
  moduleCount?: number;
  itemCount?: number;
  enrollmentCount?: number;
  bookingCount?: number;
  liveSessionCount?: number;
  assessmentCount?: number;
  materialCount?: number;
  previewItemCount?: number;
}

export interface EducationBase {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  coverUrl?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  language?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'all';
  topics?: ContentTag[];
  rating?: number;
  reviews?: number;
  durationMinutes?: number;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timezoneName?: string;
  locationText?: string;
  meetingUrl?: string;
  deliveryMode?: string;
  seatLimit?: number | null;
  eventType?: string;
  broadcastId?: string;
  institutionId?: string;
  broadcastKind?: string;
  bookingEnabled?: boolean;
  membershipPolicy?: string;
  targetLabel?: string;
  type: EducationContentType;
}

export interface EducationLessonContentPayload {
  lesson_id: string;
  content?: string;
  lesson_order?: number;
  is_preview?: boolean;
  materials?: Array<{
    id: string;
    title: string;
    kind: string;
    resource_url?: string;
    resource_name?: string;
    resource_mime_type?: string;
    is_downloadable?: boolean;
  }>;
}

export interface EducationMaterialContentPayload {
  material_id: string;
  kind: string;
  resource_url?: string;
  resource_name?: string;
  resource_mime_type?: string;
  storage_path?: string;
  is_downloadable?: boolean;
}

export interface EducationClassContentPayload {
  class_session_id: string;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone_name?: string;
  delivery_mode?: string;
  location_text?: string;
  meeting_url?: string;
  seat_limit?: number | null;
  status?: string;
}

export interface EducationAssessmentContentPayload {
  assessment_id: string;
  instructions?: string;
  assessment_type?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  duration_minutes?: number;
  max_attempts?: number;
  passing_score_percent?: number;
  total_points?: number;
  question_count?: number;
  questions?: Array<{
    id: string;
    prompt: string;
    question_type: string;
    points?: number;
    is_required?: boolean;
    options?: Array<{ id: string; option_text: string; option_order?: number }>;
  }>;
}

export interface EducationEventContentPayload {
  event_id: string;
  event_type?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone_name?: string;
  location_text?: string;
  meeting_url?: string;
  seat_limit?: number | null;
  status?: string;
}

export interface EducationBroadcastContentPayload {
  broadcast_id: string;
  broadcast_kind?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  booking_enabled?: boolean;
}

export interface EducationCourseOutlineItem {
  id: string;
  title: string;
  summary?: string;
  type: string;
  duration_minutes?: number;
  module_id?: string;
  module_title?: string;
  target?: Record<string, string>;
  is_preview?: boolean;
  content?:
    | EducationLessonContentPayload
    | EducationMaterialContentPayload
    | EducationClassContentPayload
    | EducationAssessmentContentPayload
    | EducationEventContentPayload
    | EducationBroadcastContentPayload
    | Record<string, any>;
}

export interface EducationCourseOutlineModule {
  id: string;
  title: string;
  summary?: string;
  item_count?: number;
  duration_minutes?: number;
  items?: EducationCourseOutlineItem[];
}

export interface EducationCourse extends EducationBase {
  type: 'course';
  syllabus?: { id: string; title: string; lessons: string[] }[];
  lessons?: EducationLesson[];
  outcomes?: CourseOutcome[];
  requirements?: CourseRequirement[];
  price?: EducationPricing;
  previewLesson?: EducationLesson;
  courseOutline?: EducationCourseOutlineModule[];
  institutionSummary?: EducationInstitutionSpotlight;
  trustSignals?: EducationTrustSignals;
  instructors?: Array<{ id: string; name: string; role?: string }>;
}

export interface EducationLesson extends EducationBase {
  type: 'lesson';
  lessonUrl?: string;
  startsAt?: string;
  endsAt?: string;
  isLive?: boolean;
  instructor?: string;
  sampleTranscript?: string;
}

export interface EducationWorkshop extends EducationBase {
  type: 'workshop';
  modules?: {
    id: string;
    title: string;
    resourceUrl?: string;
    summary?: string;
  }[];
  facilitator?: string;
  schedule?: string[];
}

export interface EducationProgram extends EducationBase {
  type: 'program';
  // Programs keep learners on structured pathways.
  courses?: EducationCourse[];
  durationWeeks?: number;
  cohortStartsAt?: string | null;
  completionCredentialId?: string | null;
}

export interface EducationCredential extends EducationBase {
  type: 'credential';
  // Credentials/badges highlight mastery and signal readiness.
  badgeUrl?: string;
  expiresAt?: string | null;
  requirements?: CourseRequirement[];
  linkedCourseIds?: string[];
}

export interface EducationMentorship extends EducationBase {
  type: 'mentorship';
  // Mentorship/Live Cohorts provide high-touch guided learning.
  mentors: string[];
  cohortSizeMax?: number;
  scheduleDetails?: string;
  meetUrl?: string;
}

export type EducationContentItem =
  | EducationCourse
  | EducationLesson
  | EducationWorkshop
  | EducationProgram
  | EducationCredential
  | EducationMentorship;

export interface EducationEnrollment {
  id: string;
  contentId: string;
  contentType: EducationContentType;
  enrolledAt: string;
  lastAccessedAt?: string | null;
  progressPercent: number;
  currentLessonId?: string;
  receiptUrl?: string;
}

export interface EducationProgress {
  contentId: string;
  contentType: EducationContentType;
  contentTitle?: string;
  lastLessonTitle?: string;
  progressPercent: number;
  resumeUrl?: string;
  downloaded?: boolean;
  currentModuleId?: string;
  currentItemId?: string;
  completedItemIds?: string[];
  currentItem?: EducationCourseOutlineItem | null;
  currentModule?: EducationCourseOutlineModule | null;
  nextItem?: EducationCourseOutlineItem | null;
  isCompleted?: boolean;
}

export interface EducationLearnerInsights {
  attendanceCount: number;
  assessmentSubmissionCount: number;
  gradedAssessmentCount: number;
  averageScorePercent: number;
  certificateProgressPercent: number;
  certificateReady: boolean;
}

export interface EducationReview {
  id: string;
  contentId: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface PartnerProfileLink {
  id: string;
  profileKey: 'broadcast_feed' | 'health' | 'market' | 'education';
  linked: boolean;
  role: 'admin' | 'editor' | 'viewer';
  lastSyncedAt?: string | null;
  analytics: {
    enrollments: number;
    completions: number;
    watchMinutes: number;
    revenueCents: number;
  };
}

export interface EducationDiscoverySection {
  id: string;
  title: string;
  type: EducationContentType;
  items: EducationContentItem[];
  summary?: string;
}

export interface EducationDiscoveryPayload {
  heroCourse?: EducationCourse | EducationLesson | null;
  sections: EducationDiscoverySection[];
  categories: ContentTag[];
  institutionSpotlights?: EducationInstitutionSpotlight[];
  continueLearning: EducationProgress[];
  filters: {
    languages: string[];
    levels: string[];
    prices: ('free' | 'paid')[];
    partners: string[];
    topics: string[];
    sortOptions: string[];
  };
}
