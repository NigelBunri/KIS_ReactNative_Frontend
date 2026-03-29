import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import healthRoutes from '@/network/routes/healthRoutes';
import { InstitutionSchema, institutionSchemaMap, FieldDefinition } from '@/schema/institutionOnboarding';

export type OnboardingPayload = Record<string, any>;

const REQUIRED_STATUSES = {
  draft: 'draft',
  submitted: 'submitted',
  underReview: 'under_review',
  approved: 'approved',
  rejected: 'rejected',
};

const ensureStatus = (status: string) => {
  if (!Object.values(REQUIRED_STATUSES).includes(status)) {
    throw new Error(`Invalid onboarding status: ${status}`);
  }
  return status;
};

const getSchemaForType = (type: string): InstitutionSchema => {
  return institutionSchemaMap[type] ?? institutionSchemaMap['clinic'];
};

const collectRequiredDocuments = (schema: InstitutionSchema) =>
  schema.banner.requiredDocuments;

export const fetchInstitutionOnboarding = (organizationId: string) =>
  getRequest(healthRoutes.healthcare.organization(organizationId), {
    errorMessage: 'Unable to load onboarding data.',
  });

export const saveOnboardingDraft = (organizationId: string, payload: OnboardingPayload) =>
  patchRequest(healthRoutes.healthcare.organization(organizationId), payload, {
    errorMessage: 'Could not save draft. Verify required fields.',
  });

export const changeOnboardingStatus = (organizationId: string, status: string, metadata?: Record<string, any>) => {
  const safeStatus = ensureStatus(status);
  return patchRequest(healthRoutes.healthcare.organization(organizationId), {
    onboarding_status: safeStatus,
    onboarding_metadata: metadata || {},
  }, {
    errorMessage: 'Unable to update onboarding status.',
  });
};

export const submitOnboarding = (organizationId: string, payload: OnboardingPayload, type: string) => {
  const schema = getSchemaForType(type);
  const requiredDocs = collectRequiredDocuments(schema);
  const providedDocs = payload.document_keys ?? [];
  const missing = requiredDocs.filter((doc) => !providedDocs.includes(doc));
  if (missing.length) {
    throw new Error(`Missing required compliance documents: ${missing.join(', ')}`);
  }
  return changeOnboardingStatus(organizationId, REQUIRED_STATUSES.submitted, {
    submitted_at: new Date().toISOString(),
    required_documents: requiredDocs,
  });
};

export const uploadComplianceDocument = async (
  organizationId: string,
  profileId: string,
  documentName: string,
  field: FieldDefinition,
  file: File | Blob,
) => {
  const form = new FormData();
  form.append('organization', organizationId);
  form.append('profile', profileId);
  form.append('document_name', documentName);
  form.append('file', file, documentName);
  form.append('metadata', JSON.stringify({ field: field.key, mime: file.type }));

  return postRequest(healthRoutes.compliance.documents, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    errorMessage: 'Unable to upload compliance document.',
  });
};

