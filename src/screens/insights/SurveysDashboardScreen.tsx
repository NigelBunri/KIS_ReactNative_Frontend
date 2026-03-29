import React from 'react';
import InsightScreen, { InsightsFooterNote } from './InsightScreen';

export default function SurveysDashboardScreen() {
  return (
    <InsightScreen
      target="surveys"
      title="Surveys dashboard"
      description="Response rates, question performance, and sentiment trends from the surveys app."
      footer={<InsightsFooterNote message="Data pulls from ROUTES.surveys.responses & questions." />}
    />
  );
}
