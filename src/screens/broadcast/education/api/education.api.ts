// src/screens/broadcast/education/api/education.api.ts
import type {
  EducationCourse,
  EducationCredential,
  EducationLesson,
  EducationMentorship,
  EducationProgram,
  EducationProgress,
  EducationReview,
  EducationWorkshop,
  PartnerProfileLink,
} from '@/screens/broadcast/education/api/education.models';

/**
 * Backend API assumptions for the education surfaces.
 *
 *_DISCOVERY_: GET /api/v1/education/discovery/
 *  - Returns hero content, sections split by type, available filters, and continue learning state.
 *  - Each section stores `type` + array of items (course, lesson, etc) with metadata.
 *  - Optional `categories` array for filtering.
 */
export interface EducationDiscoveryResponse {
  hero_course?: EducationCourse | EducationLesson | null;
  sections: Array<{
    id: string;
    title: string;
    type: 'course' | 'lesson' | 'workshop' | 'program' | 'credential' | 'mentorship';
    items: (
      | EducationCourse
      | EducationLesson
      | EducationWorkshop
      | EducationProgram
      | EducationCredential
      | EducationMentorship
    )[];
  }>;
  categories: Array<{ id: string; label: string }>;
  continue_learning: EducationProgress[];
  filters: {
    sortOptions: string[];
    languages: string[];
    levels: string[];
    prices: ('free' | 'paid')[];
    partners: string[];
    topics: string[];
  };
}

/**
 * COURSE DETAIL: GET /api/v1/education/contents/{id}/
 *  - Returns syllabus, requirements, FAQs, pricing, rating, reviews.
 */
export interface EducationContentDetail {
  course: EducationCourse;
  reviews: EducationReview[];
  faqs: Array<{ question: string; answer: string }>;
}

/**
 * ENROLLMENT FLOW:
 * POST /api/v1/education/contents/{id}/enroll/
 *  - Body may include pricing metadata / coupon codes.
 *  - Response returns receipt + progress entry.
 */
export interface EducationEnrollmentRequest {
  contentId: string;
  paymentToken?: string;
  couponCode?: string;
}

export interface EducationEnrollmentResponse {
  enrollmentId: string;
  receiptUrl: string;
  progress: EducationProgress;
}

/**
 * PARTNER LINKS: GET /api/v1/partners/{partnerId}/links/
 *  - Indicates which profiles are connected to the Partner account + analytics.
 * POST /api/v1/partners/{partnerId}/links/{profileKey}/
 * DELETE /api/v1/partners/{partnerId}/links/{profileKey}/
 */
export interface PartnerProfileLinksResponse {
  results: PartnerProfileLink[];
}

export interface PartnerProfileLinkUpdate {
  profileKey: PartnerProfileLink['profileKey'];
  linked: boolean;
  role?: PartnerProfileLink['role'];
}
