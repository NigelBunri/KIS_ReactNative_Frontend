import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function EventsDashboardScreen() {
  return (
    <InsightScreen
      target="events"
      title="Events dashboard"
      description="Attendance, ticketing, and engagement trends for every event unit."
      footer={<InsightsFooterNote message="Events service: ROUTES.events.list / attendance endpoints keep this refreshing." />}
    />
  );
}
