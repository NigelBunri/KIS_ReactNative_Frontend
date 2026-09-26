// src/screens/broadcast/education/utils/educationAccess.ts
//
// Pure helpers extracted from EducationV2DiscoverPage (Education UX v2) so
// the new CourseDetailScreen/LearningPlayerScreen destinations derive
// enrollment/booking/access state identically to the existing discover
// page and detail sheet, instead of re-deriving their own copy.
import type { EducationContentItem, EducationProgress } from '@/screens/broadcast/education/api/education.models';

export const ACTIVE_ENROLLMENT_STATUSES = new Set(['enrolled', 'completed']);

export const hasLearningAccessForItem = (
  item: EducationContentItem | null | undefined,
  _progress?: EducationProgress | null,
) => {
  if (!item) return false;
  const viewerState = (item as any)?.viewerState || {};
  const enrollmentStatus = String(
    viewerState?.enrollment?.status || viewerState?.enrollment_status || '',
  ).toLowerCase();
  return (
    Boolean(viewerState?.has_learning_access) ||
    ACTIVE_ENROLLMENT_STATUSES.has(enrollmentStatus)
  );
};

export const getBookingStatus = (item: EducationContentItem | null | undefined) =>
  String(
    (item as any)?.viewerState?.booking?.status ||
      (item as any)?.viewerState?.booking_status ||
      '',
  ).toLowerCase();

export const getEnrollmentStatus = (item: EducationContentItem | null | undefined) =>
  String(
    (item as any)?.viewerState?.enrollment?.status ||
      (item as any)?.viewerState?.enrollment_status ||
      '',
  ).toLowerCase();

export const getPrimaryActionLabel = (
  item: EducationContentItem,
  progress?: EducationProgress | null,
) => {
  if (hasLearningAccessForItem(item, progress)) {
    return progress ? 'Continue' : 'Start';
  }
  const enrollmentStatus = getEnrollmentStatus(item);
  if (enrollmentStatus === 'waitlisted') return 'On the list';
  if (enrollmentStatus === 'pending') return 'Waiting...';
  const bookingStatus = getBookingStatus(item);
  if (bookingStatus === 'awaiting_satisfaction') return 'Confirming';
  if (bookingStatus === 'confirmed') return 'Reserved';
  if (bookingStatus === 'payment_pending' || bookingStatus === 'pending')
    return 'Complete booking';
  const pricing = 'price' in item ? (item as any).price : undefined;
  return pricing?.isFree ? 'Join free' : 'Book a spot';
};

export const getStatusLabel = (
  item: EducationContentItem,
  progress?: EducationProgress | null,
) => {
  if (hasLearningAccessForItem(item, progress)) {
    return progress ? `${progress.progressPercent}%` : 'Enrolled';
  }
  const enrollmentStatus = getEnrollmentStatus(item);
  if (enrollmentStatus) return enrollmentStatus.replace(/_/g, ' ');
  const bookingStatus = getBookingStatus(item);
  if (bookingStatus) return bookingStatus.replace(/_/g, ' ');
  return '';
};
