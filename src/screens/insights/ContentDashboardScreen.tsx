import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function ContentDashboardScreen() {
  return (
    <InsightScreen
      target="content"
      title="Content dashboard"
      description="Stories, tags, and media consumption metrics streamed from the content app."
      footer={<InsightsFooterNote message="Pulls content performance via ROUTES.content.contents + tags." />}
    />
  );
}
