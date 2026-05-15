import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type UnifiedDashboardSurface = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  metrics: Record<string, number | string | boolean | null | undefined>;
  readiness: Record<string, boolean>;
};

export type UnifiedDashboardSummary = {
  version: string;
  counts: {
    dashboards: number;
    channels: number;
    shops: number;
    education_institutions: number;
    health_institutions: number;
    partners: number;
    verified_surfaces: number;
  };
  surfaces: UnifiedDashboardSurface[];
  readiness: Record<string, boolean | number>;
  placeholders: Record<string, boolean>;
  privacy: Record<string, boolean>;
  family_accessibility: {
    age_mode: string;
    navigation_mode: string;
    min_touch_target: number;
    family_safe_content: boolean;
  };
};

export const fetchUnifiedDashboardSummary = async (): Promise<UnifiedDashboardSummary | null> => {
  const response = await getRequest(ROUTES.dashboards.unified, {
    forceNetwork: true,
    errorMessage: 'Unable to load dashboard summary.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load dashboard summary.');
  }
  return response.data || null;
};
