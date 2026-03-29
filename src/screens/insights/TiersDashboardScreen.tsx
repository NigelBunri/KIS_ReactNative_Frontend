import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function TiersDashboardScreen() {
  return (
    <InsightScreen
      target="tiers"
      title="Tiers dashboard"
      description="Plan, campaign, and subscription health across managed tiers."
      footer={<InsightsFooterNote message="Data surfaces refer to ROUTES.tiers.plans + campaigns + usage." />}
    />
  );
}
