import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { isPersonalizationEnabled } from '@/services/consentService';

export type RecommendationItem = {
  kind: string;
  title: string;
  subtitle?: string;
  target_type: string;
  target_id: string;
  route?: string;
  score?: number;
  metadata?: Record<string, any>;
};

export type SocialRecommendationFoundation = {
  generated_at?: string;
  privacy?: {
    public_safe?: boolean;
    private_relationships_exposed?: boolean;
    health_data_exposed?: boolean;
    verification_documents_exposed?: boolean;
    payment_data_exposed?: boolean;
    raw_storage_paths_exposed?: boolean;
  };
  controls?: {
    blocked_users_excluded?: boolean;
    muted_hidden_content_excluded?: boolean;
    child_youth_safe_defaults?: boolean;
    christian_content_safe_ranking?: boolean;
    explicit_content_blocked_by_media_gate?: boolean;
    sensitive_domains_downranked?: string[];
  };
  signals?: Record<string, number | boolean>;
  sections?: Record<string, RecommendationItem[]>;
  placeholders?: Record<string, string>;
};

export const fetchSocialRecommendationFoundation = async (
  limit = 8,
): Promise<SocialRecommendationFoundation | null> => {
  if (!isPersonalizationEnabled()) return null;
  const url = `${ROUTES.recommendations.foundation}?limit=${Math.max(1, Math.min(Number(limit) || 8, 20))}`;
  const response = await getRequest(url, {
    forceNetwork: true,
    errorMessage: 'Unable to load recommendations.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load recommendations.');
  }
  return response.data || null;
};
