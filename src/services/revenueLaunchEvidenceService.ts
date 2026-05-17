import billingRoutes from '@/network/routes/billingRoutes';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export type RevenueLaunchEvidenceRecord = {
  id: string;
  area: string;
  title: string;
  status: string;
  owner_role?: string;
  reviewer_display?: string;
  required_reviewer_role?: string;
  private_media_asset_id?: string | null;
  redacted_summary?: string;
  expires_at?: string | null;
  is_expired?: boolean;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_by_display?: string;
  audit_events?: Array<Record<string, any>>;
  created_at?: string;
  updated_at?: string;
};

export type RevenueLaunchEvidenceList = {
  count?: number;
  results?: RevenueLaunchEvidenceRecord[];
};

export type RevenueLaunchEvidencePayload = {
  area: string;
  title: string;
  owner_role?: string;
  private_media_asset_id?: string | null;
  redacted_summary?: string;
  expires_at?: string | null;
};

const unwrapEvidenceList = (data: any): RevenueLaunchEvidenceList => {
  if (Array.isArray(data)) {
    return { count: data.length, results: data };
  }
  return {
    count: typeof data?.count === 'number' ? data.count : data?.results?.length || 0,
    results: Array.isArray(data?.results) ? data.results : [],
  };
};

export const fetchRevenueLaunchEvidenceRecords =
  async (): Promise<RevenueLaunchEvidenceList> => {
    const response = await getRequest(billingRoutes.revenueLaunchEvidence, {
      forceNetwork: true,
      errorMessage: 'Unable to load revenue launch evidence.',
    });
    if (response?.success && response.data) {
      return unwrapEvidenceList(response.data);
    }
    return { count: 0, results: [] };
  };

export const createRevenueLaunchEvidenceRecord = async (
  payload: RevenueLaunchEvidencePayload,
): Promise<RevenueLaunchEvidenceRecord> => {
  const response = await postRequest(billingRoutes.revenueLaunchEvidence, payload, {
    errorMessage: 'Unable to create revenue launch evidence.',
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Unable to create revenue launch evidence.');
  }
  return response.data;
};

export const updateRevenueLaunchEvidenceRecord = async (
  id: string,
  payload: Partial<RevenueLaunchEvidencePayload>,
): Promise<RevenueLaunchEvidenceRecord> => {
  const response = await patchRequest(billingRoutes.revenueLaunchEvidenceDetail(id), payload, {
    errorMessage: 'Unable to update revenue launch evidence.',
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Unable to update revenue launch evidence.');
  }
  return response.data;
};

export const runRevenueLaunchEvidenceAction = async (
  id: string,
  action: 'submit' | 'approve' | 'needs_changes' | 'reject' | 'revoke',
): Promise<RevenueLaunchEvidenceRecord> => {
  const routeMap = {
    submit: billingRoutes.revenueLaunchEvidenceSubmit,
    approve: billingRoutes.revenueLaunchEvidenceApprove,
    needs_changes: billingRoutes.revenueLaunchEvidenceNeedsChanges,
    reject: billingRoutes.revenueLaunchEvidenceReject,
    revoke: billingRoutes.revenueLaunchEvidenceRevoke,
  };
  const response = await postRequest(routeMap[action](id), {}, {
    errorMessage: 'Unable to update revenue launch evidence status.',
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Unable to update revenue launch evidence status.');
  }
  return response.data;
};
