import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type SecurityLaunchGateCheck = {
  key: string;
  label: string;
  status: 'pass' | 'fail' | string;
  severity: 'critical' | 'warning' | string;
  detail: string;
};

export type SecurityLaunchGateSummary = {
  version: string;
  environment: {
    production_mode: boolean;
    debug: boolean;
    settings_module: string;
  };
  summary: {
    go_live_status: 'go' | 'conditional' | 'blocked' | string;
    total_checks: number;
    passed: number;
    critical_failures: number;
    warnings: number;
  };
  checks: SecurityLaunchGateCheck[];
  evidence_required: string[];
  privacy: Record<string, boolean>;
};

export const fetchSecurityLaunchGateSummary = async (): Promise<SecurityLaunchGateSummary | null> => {
  const response = await getRequest(ROUTES.dashboards.securityLaunchGate, {
    forceNetwork: true,
    errorMessage: 'Unable to load security launch gate.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load security launch gate.');
  }
  return response.data || null;
};
