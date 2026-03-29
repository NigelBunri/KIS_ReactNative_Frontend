import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function MediaDashboardScreen() {
  return (
    <InsightScreen
      target="media"
      title="Media dashboard"
      description="Asset ingestion, processing jobs, and delivery quality from the media service."
      footer={<InsightsFooterNote message="Tracks ROUTES.media.assets + jobs so uploads stay visible." />}
    />
  );
}
