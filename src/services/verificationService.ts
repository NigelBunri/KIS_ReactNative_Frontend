import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

export type VerificationSubjectType =
  | 'user'
  | 'shop'
  | 'partner'
  | 'health_institution'
  | 'education_institution';

export type VerificationBadgeSummary = {
  code?: string;
  label?: string;
  issued_at?: string | null;
  expires_at?: string | null;
};

export type VerificationCaseSummary = {
  id?: string;
  status?: string;
  level?: string;
  provider?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  metadata?: Record<string, any> | null;
};

export type VerificationSummary = {
  verified?: boolean;
  status?: string;
  badges?: VerificationBadgeSummary[];
  latest_case?: VerificationCaseSummary | null;
  subject_type?: string;
  subject_id?: string;
  last_verified_at?: string | null;
  next_review_at?: string | null;
};

export type TrustSurfaceSummary = VerificationSummary & {
  display_name?: string;
  trust_tier?: string;
  trust_label?: string;
  badge_count?: number;
  expiry?: {
    expires_soon?: boolean;
    days_until?: number | null;
  };
  privacy?: {
    public_safe?: boolean;
    raw_documents_exposed?: boolean;
    provider_payload_exposed?: boolean;
    storage_paths_exposed?: boolean;
    staff_only_evidence_visible?: boolean;
  };
  staff_evidence?: Record<string, any>;
};

export type UnifiedTrustOverview = {
  generated_at?: string;
  viewer?: { is_staff?: boolean };
  counts?: {
    subjects?: number;
    verified_subjects?: number;
    active_public_badges?: number;
    expiring_badges_30d?: number;
    channels?: number;
    verified_channels?: number;
  };
  by_type?: Record<string, { total?: number; verified?: number; open?: number; expiring?: number }>;
  subjects?: TrustSurfaceSummary[];
  channels?: TrustSurfaceSummary[];
  bible_kcan_publisher?: TrustSurfaceSummary | null;
  surfaces_ready?: Record<string, boolean>;
  privacy?: TrustSurfaceSummary['privacy'];
  staff_evidence?: Record<string, any>;
};

export type VerificationStartPayload = {
  level?: string;
  provider?: string;
  evidence_metadata?: Record<string, any>;
};

export type VerificationEvidenceUploadInput = {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
};

export type VerificationEvidencePrivateRef = {
  private_media_id: string;
  original_name?: string;
  mime_type?: string;
  size?: number | null;
  visibility: 'private';
  scan_status?: string;
};

export type VerificationStaffCase = {
  id: string;
  level?: string;
  status?: string;
  provider?: string;
  provider_status?: string;
  risk_score?: number | null;
  subject?: {
    subject_type?: string;
    subject_id?: string;
    display_name?: string;
    current_status?: string;
    owner_label?: string;
  };
  evidence_summary?: Record<string, any>;
  provider_payload_summary?: Record<string, any>;
  reviewer_notes?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  expires_at?: string | null;
  badges?: Array<VerificationBadgeSummary & { id?: string; status?: string }>;
};

export type VerificationStaffAuditEvent = {
  id: string;
  action?: string;
  provider?: string;
  actor_label?: string;
  created_at?: string;
  subject?: VerificationStaffCase['subject'];
};

export type VerificationStaffBadge = VerificationBadgeSummary & {
  id: string;
  status?: string;
  public?: boolean;
  revoke_reason?: string;
};

export type VerificationSubjectRef = {
  type: VerificationSubjectType;
  id?: string | number | null;
};

const routeForStatus = (subject: VerificationSubjectRef): string | null => {
  const id = subject.id ? String(subject.id) : '';
  switch (subject.type) {
    case 'user':
      return ROUTES.verification.userStatus;
    case 'shop':
      return id ? ROUTES.commerce.shopVerificationStatus(id) : null;
    case 'partner':
      return id ? ROUTES.partners.verificationStatus(id) : null;
    case 'health_institution':
      return id ? ROUTES.healthOps.institutionVerificationStatus(id) : null;
    case 'education_institution':
      return id ? ROUTES.broadcasts.educationInstitutionVerificationStatus(id) : null;
    default:
      return null;
  }
};

const routeForStart = (subject: VerificationSubjectRef): string | null => {
  const id = subject.id ? String(subject.id) : '';
  switch (subject.type) {
    case 'user':
      return ROUTES.verification.userStart;
    case 'shop':
      return id ? ROUTES.commerce.shopVerificationStart(id) : null;
    case 'partner':
      return id ? ROUTES.partners.verificationStart(id) : null;
    case 'health_institution':
      return id ? ROUTES.healthOps.institutionVerificationStart(id) : null;
    case 'education_institution':
      return id ? ROUTES.broadcasts.educationInstitutionVerificationStart(id) : null;
    default:
      return null;
  }
};

const unwrapStatus = (payload: any): VerificationSummary | null => {
  if (!payload) return null;
  if (payload.status && typeof payload.status === 'object') return payload.status;
  if (payload.verification_summary && typeof payload.verification_summary === 'object') {
    return payload.verification_summary;
  }
  if ('verified' in payload || 'badges' in payload || 'latest_case' in payload) return payload;
  return null;
};

export const getVerificationSummary = (value: any): VerificationSummary | null => {
  if (!value || typeof value !== 'object') return null;
  return (
    value.verification_summary ||
    value.verificationSummary ||
    value.verification ||
    value.trust_badges_summary ||
    null
  );
};

export const fetchVerificationStatus = async (
  subject: VerificationSubjectRef,
): Promise<VerificationSummary | null> => {
  const url = routeForStatus(subject);
  if (!url) return null;
  const response = await getRequest(url, {
    forceNetwork: true,
    errorMessage: 'Unable to load verification status.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load verification status.');
  }
  return unwrapStatus(response.data);
};

export const fetchUnifiedTrustOverview = async (): Promise<UnifiedTrustOverview | null> => {
  const response = await getRequest(ROUTES.verification.trustOverview, {
    forceNetwork: true,
    errorMessage: 'Unable to load trust overview.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load trust overview.');
  }
  return response.data || null;
};

export const fetchPublicTrustSummary = async (
  subjectType: string,
  subjectId: string,
): Promise<TrustSurfaceSummary | null> => {
  if (!subjectType || !subjectId) return null;
  const response = await getRequest(ROUTES.verification.publicTrustSummary(subjectType, subjectId), {
    forceNetwork: true,
    errorMessage: 'Unable to load public trust summary.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load public trust summary.');
  }
  return response.data || null;
};

export const startVerificationCase = async (
  subject: VerificationSubjectRef,
  payload: VerificationStartPayload,
) => {
  const url = routeForStart(subject);
  if (!url) {
    throw new Error('Verification is not available for this item yet.');
  }
  const requestPayload =
    subject.type === 'shop'
      ? {
          documents: (payload.evidence_metadata?.private_media_refs ?? []).map((ref: string) => ({
            private_media_ref: ref,
            legal_name: payload.evidence_metadata?.legal_name,
            registration_number: payload.evidence_metadata?.registration_number,
            certificate_issuer: payload.evidence_metadata?.certificate_issuer,
            expires_at: payload.evidence_metadata?.expires_at,
            applicant_notes: payload.evidence_metadata?.applicant_notes,
          })),
        }
      : payload;
  const response = await postRequest(url, requestPayload, {
    errorMessage: 'Unable to start verification.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to start verification.');
  }
  return response.data;
};

export const uploadVerificationEvidenceMedia = async (
  file: VerificationEvidenceUploadInput,
): Promise<VerificationEvidencePrivateRef> => {
  if (!file?.uri) throw new Error('Select a verification evidence file first.');
  const form = new FormData();
  form.append('visibility', 'private');
  form.append('purpose', 'verification_evidence');
  form.append('context', 'verification');
  form.append('file', {
    uri: file.uri,
    name: file.name || `verification-evidence-${Date.now()}`,
    type: file.type || 'application/octet-stream',
  } as any);
  const response = await postRequest(ROUTES.uploads.file, form, {
    errorMessage: 'Unable to upload verification evidence.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to upload verification evidence.');
  }
  const attachment = response.data?.attachment || response.data;
  const privateId = attachment?.id || attachment?.private_media_id;
  if (!privateId) throw new Error('Private upload did not return a media reference.');
  return {
    private_media_id: String(privateId),
    original_name: attachment?.originalName || file.name || undefined,
    mime_type: attachment?.mimeType || file.type || undefined,
    size: attachment?.size ?? file.size ?? null,
    visibility: 'private',
    scan_status: attachment?.scanStatus || undefined,
  };
};

export const fetchVerificationStaffCases = async (params?: {
  status?: string;
  subject_type?: VerificationSubjectType | string;
  provider?: string;
  q?: string;
  limit?: number;
}): Promise<VerificationStaffCase[]> => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) query.append(key, String(value));
  });
  const url = `${ROUTES.verification.staffCases}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await getRequest(url, {
    forceNetwork: true,
    errorMessage: 'Unable to load verification review queue.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to load verification review queue.');
  return Array.isArray(response.data?.results) ? response.data.results : [];
};

export const updateVerificationStaffCaseStatus = async (
  caseId: string,
  payload: { status: 'in_review' | 'needs_more_info' | 'cancelled' | 'expired'; notes?: string },
): Promise<VerificationStaffCase> => {
  const response = await patchRequest(ROUTES.verification.staffCase(caseId), payload, {
    errorMessage: 'Unable to update verification case.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to update verification case.');
  return response.data;
};

export const fetchVerificationStaffAuditEvents = async (limit = 25): Promise<VerificationStaffAuditEvent[]> => {
  const response = await getRequest(`${ROUTES.verification.staffAuditEvents}?limit=${limit}`, {
    forceNetwork: true,
    errorMessage: 'Unable to load verification audit events.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to load verification audit events.');
  return Array.isArray(response.data?.results) ? response.data.results : [];
};

export const fetchVerificationExpiryReminders = async (days = 30) => {
  const response = await getRequest(`${ROUTES.verification.staffExpiryReminders}?days=${days}`, {
    forceNetwork: true,
    errorMessage: 'Unable to load verification expiry reminders.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to load verification expiry reminders.');
  return response.data;
};

export const issueVerificationStaffBadge = async (payload: {
  case_id?: string;
  subject_type: VerificationSubjectType | string;
  subject_id?: string;
  code: string;
  label?: string;
  level?: string;
  public?: boolean;
  expires_at?: string | null;
  reason?: string;
}): Promise<VerificationStaffBadge> => {
  const response = await postRequest(ROUTES.verification.staffBadgeIssue, payload, {
    errorMessage: 'Unable to issue verification badge.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to issue verification badge.');
  return response.data;
};

export const revokeVerificationStaffBadge = async (
  badgeId: string,
  reason?: string,
): Promise<VerificationStaffBadge> => {
  const response = await postRequest(ROUTES.verification.staffBadgeRevoke(badgeId), { reason: reason || '' }, {
    errorMessage: 'Unable to revoke verification badge.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to revoke verification badge.');
  return response.data;
};
