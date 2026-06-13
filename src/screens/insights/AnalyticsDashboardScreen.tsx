import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function AnalyticsDashboardScreen() {
  return (
    <InsightScreen
      target="analytics"
      title="Analytics overview"
      description="High-level KPIs for every connected surface, refreshed in real time."
      footer={<InsightsFooterNote message="Data refreshed in real time from the KIS analytics engine." />}
    />
  );
}
