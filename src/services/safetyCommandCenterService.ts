import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type SafetyCommandCenterSection = {
  status: 'healthy' | 'warning' | 'critical' | string;
  count: number;
  label: string;
  detail: string;
  route: string;
};

export type SafetyCommandCenterSummary = {
  version: string;
  window: string;
  overall_status: 'healthy' | 'warning' | 'critical' | string;
  counts: {
    critical_signals: number;
    warning_signals: number;
    media_open_queue: number;
    moderation_pending_flags: number;
    verification_open_cases: number;
    payment_pending_intents: number;
    notification_failed_deliveries: number;
    messaging_active_conversations: number;
  };
  sections: Record<string, SafetyCommandCenterSection>;
  details: Record<string, any>;
  privacy: Record<string, boolean>;
  launch_blockers: string[];
};

export const fetchSafetyCommandCenterSummary = async (): Promise<SafetyCommandCenterSummary | null> => {
  const response = await getRequest(ROUTES.dashboards.safetyCommandCenter, {
    forceNetwork: true,
    errorMessage: 'Unable to load safety command center.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load safety command center.');
  }
  return response.data || null;
};
