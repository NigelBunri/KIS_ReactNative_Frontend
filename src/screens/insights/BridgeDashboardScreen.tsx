import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function BridgeDashboardScreen() {
  return (
    <InsightScreen
      target="bridge"
      title="Bridge dashboard"
      description="Automation, job history, and thread sync metrics from the bridge layers."
      footer={<InsightsFooterNote message="Bridge analytics come from ROUTES.bridge.analytics + messages." />}
    />
  );
}
