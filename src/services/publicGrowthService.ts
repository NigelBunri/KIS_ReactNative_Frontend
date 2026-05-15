import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type PublicGrowthMetadata = {
  type: 'channel' | 'content' | string;
  id: string;
  title?: string;
  display_name?: string;
  handle?: string;
  description?: string;
  url: string;
  seo: {
    title: string;
    description: string;
    canonical_url: string;
    robots: string;
  };
  share_card: {
    title: string;
    description: string;
    image?: string;
    url: string;
  };
  trust_badges?: string[];
  latest_contents?: PublicGrowthMetadata[];
  embed?: {
    oembed_url: string;
    enabled: boolean;
    requires_policy_check: boolean;
  };
  report?: {
    method: string;
    url: string;
  };
};

export type PublicSitemapPlan = {
  indexing_enabled: boolean;
  robots: string;
  channels: string[];
  contents: string[];
};

export const fetchPublicChannelLanding = async (
  handle: string,
): Promise<PublicGrowthMetadata | null> => {
  const response = await getRequest(ROUTES.broadcast.publicChannelLanding(handle.replace(/^@/, '')), {
    forceNetwork: true,
    errorMessage: 'Unable to load public channel metadata.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load public channel metadata.');
  }
  return response.data || null;
};

export const fetchPublicContentLanding = async (
  contentId: string,
): Promise<PublicGrowthMetadata | null> => {
  const response = await getRequest(ROUTES.broadcast.publicContentLanding(contentId), {
    forceNetwork: true,
    errorMessage: 'Unable to load public content metadata.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load public content metadata.');
  }
  return response.data || null;
};

export const fetchPublicSitemapPlan = async (): Promise<PublicSitemapPlan | null> => {
  const response = await getRequest(ROUTES.broadcast.publicSitemapPlan, {
    forceNetwork: true,
    errorMessage: 'Unable to load public growth plan.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load public growth plan.');
  }
  return response.data || null;
};
