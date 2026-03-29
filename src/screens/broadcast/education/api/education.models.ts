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

export interface EducationBase {
  id: string;
  title: string;
  summary?: string;
  coverUrl?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  language?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'all';
  topics?: ContentTag[];
  rating?: number;
  reviews?: number;
  durationMinutes?: number;
  type: EducationContentType;
}

export interface EducationCourse extends EducationBase {
  type: 'course';
  syllabus?: { id: string; title: string; lessons: string[] }[];
  lessons?: EducationLesson[];
  outcomes?: CourseOutcome[];
  requirements?: CourseRequirement[];
  price?: EducationPricing;
  previewLesson?: EducationLesson;
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
  lastLessonTitle?: string;
  progressPercent: number;
  resumeUrl?: string;
  downloaded?: boolean;
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
