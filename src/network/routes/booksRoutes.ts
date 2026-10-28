import { API_BASE_URL } from '../config';

const BASE = `${API_BASE_URL}/api/v1/books`;
const ADMIN_BASE = `${API_BASE_URL}/control/admin`;

export const booksRoutes = {
  list: (query = '') => `${BASE}/${query}`,
  discover: `${BASE}/discover/`,
  detail: (id: string) => `${BASE}/${id}/`,
  policyCurrent: `${BASE}/policy/current/`,
  chapterRead: (id: string, stableId: string) => `${BASE}/${id}/chapters/${stableId}/`,
  getFree: (id: string) => `${BASE}/${id}/get-free/`,

  mine: `${BASE}/mine/`,
  mineDetail: (id: string) => `${BASE}/mine/${id}/`,
  mineChapter: (id: string, stableId: string) => `${BASE}/mine/${id}/chapters/${stableId}/`,
  acknowledgePolicy: (id: string) => `${BASE}/mine/${id}/acknowledge-policy/`,
  manuscriptUpload: (id: string) => `${BASE}/mine/${id}/manuscript/`,
  conversionStatus: (id: string) => `${BASE}/mine/${id}/conversion/`,
  submit: (id: string) => `${BASE}/mine/${id}/submit/`,
  paidEligibility: `${BASE}/eligibility/paid/`,

  libraryMine: `${BASE}/library/mine/`,
  libraryOverview: `${BASE}/library/overview/`,
  progress: (id: string) => `${BASE}/${id}/progress/`,
  save: (id: string) => `${BASE}/${id}/save/`,

  chapterBookmarkToggle: (id: string, stableId: string) => `${BASE}/${id}/chapters/${stableId}/bookmark/`,
  chapterBookmarksList: (id: string) => `${BASE}/${id}/bookmarks/`,

  chapterHighlights: (id: string, stableId: string) => `${BASE}/${id}/chapters/${stableId}/highlights/`,
  bookHighlights: (id: string) => `${BASE}/${id}/highlights/`,
  highlightDetail: (highlightId: string) => `${BASE}/highlights/${highlightId}/`,
  annotationsMine: (query = '') => `${BASE}/annotations/mine/${query}`,

  imagePlacements: (id: string) => `${BASE}/mine/${id}/image-placements/`,
  imagePlacementUpload: (id: string, blockId: string) => `${BASE}/mine/${id}/image-placements/${blockId}/image/`,
  imageDownload: (assetId: string) => `${BASE}/images/${assetId}/`,

  chapterNotes: (id: string, stableId: string) => `${BASE}/${id}/chapters/${stableId}/notes/`,
  bookNotes: (id: string) => `${BASE}/${id}/notes/`,
  noteDetail: (noteId: string) => `${BASE}/notes/${noteId}/`,

  checkout: (id: string) => `${BASE}/${id}/checkout/`,
  purchasesMine: `${BASE}/purchases/mine/`,
  purchaseRefund: (id: string) => `${BASE}/purchases/${id}/refund/`,
  royaltiesMine: `${BASE}/royalties/mine/`,

  offlineRequest: (id: string) => `${BASE}/${id}/offline/request/`,
  offlineVerify: (id: string, deviceId: string) => `${BASE}/${id}/offline/verify/?device_id=${encodeURIComponent(deviceId)}`,
  offlineRevoke: (id: string, deviceId: string) => `${BASE}/${id}/offline/${encodeURIComponent(deviceId)}/`,
  offlineMine: `${BASE}/offline/mine/`,

  reviews: (id: string) => `${BASE}/${id}/reviews/`,
  reviewDetail: (reviewId: string) => `${BASE}/reviews/${reviewId}/`,
  reviewReport: (reviewId: string) => `${BASE}/reviews/${reviewId}/report/`,

  // GO / staff moderation
  adminQueue: (query = '') => `${ADMIN_BASE}/books/queue/${query}`,
  adminDetail: (id: string) => `${ADMIN_BASE}/books/${id}/`,
  adminAction: (id: string) => `${ADMIN_BASE}/books/${id}/action/`,
  adminAuthorRestrictions: (userId: string) => `${ADMIN_BASE}/authors/${userId}/restrictions/`,
  adminAuthorRestrictionLift: (id: string) => `${ADMIN_BASE}/authors/restrictions/${id}/lift/`,
  adminAuthorHistory: (userId: string) => `${ADMIN_BASE}/authors/${userId}/moderation-history/`,
};
