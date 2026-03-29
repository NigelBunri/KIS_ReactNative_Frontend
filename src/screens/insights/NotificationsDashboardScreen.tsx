import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function NotificationsDashboardScreen() {
  return (
    <InsightScreen
      target="notifications"
      title="Notifications dashboard"
      description="Delivery rates, open benchmarks, and rule usage across all channels."
      footer={<InsightsFooterNote message="Connected to ROUTES.notifications.* endpoints for delivery stats." />}
    />
  );
}
