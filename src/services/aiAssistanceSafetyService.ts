import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type AIAssistanceSafetyCheck = {
  key: string;
  label: string;
  status: 'pass' | 'fail' | string;
  severity: 'critical' | 'warning' | string;
  detail: string;
};

export type AIAssistanceSafetyPolicy = {
  version: string;
  enabled: boolean;
  provider: {
    selected: string;
    live_calls_enabled: boolean;
    provider_key_configured: boolean;
    secret_values_exposed: boolean;
  };
  boundaries: Record<string, boolean>;
  privacy_controls: Record<string, boolean>;
  assistant_surfaces: Record<string, { status: string; risk: string; guardrail: string }>;
  checks: AIAssistanceSafetyCheck[];
  summary: {
    go_live_status: 'go' | 'conditional' | 'blocked' | string;
    total_checks: number;
    passed: number;
    critical_failures: number;
    warnings: number;
  };
};

export const fetchAIAssistanceSafetyPolicy =
  async (): Promise<AIAssistanceSafetyPolicy | null> => {
    const response = await getRequest(ROUTES.ai.safetyPolicy, {
      forceNetwork: true,
      errorMessage: 'Unable to load AI safety policy.',
    });
    if (!response.success) {
      throw new Error(response.message || 'Unable to load AI safety policy.');
    }
    return response.data || null;
  };
