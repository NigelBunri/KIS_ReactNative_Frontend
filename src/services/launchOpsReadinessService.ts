import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type LaunchOpsCheck = {
  key: string;
  label: string;
  status: 'ready' | 'blocked' | string;
  severity: 'critical' | 'warning' | string;
  detail: string;
};

export type LaunchOpsReadinessSummary = {
  version: string;
  generated_at: string;
  go_no_go: 'go' | 'conditional_go' | 'no_go' | string;
  readiness_percent: number;
  summary: {
    critical_blockers: number;
    warnings: number;
    safety_status: string;
    security_status: string;
    checks_total: number;
    checks_ready: number;
  };
  sections: Record<string, LaunchOpsCheck[]>;
  safe_counts: Record<string, number>;
  blockers: string[];
  warnings: string[];
  privacy: Record<string, boolean>;
};

export const fetchLaunchOpsReadinessSummary = async (): Promise<LaunchOpsReadinessSummary | null> => {
  const response = await getRequest(ROUTES.dashboards.launchOpsReadiness, {
    forceNetwork: true,
    errorMessage: 'Unable to load launch operations readiness.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load launch operations readiness.');
  }
  return response.data || null;
};
