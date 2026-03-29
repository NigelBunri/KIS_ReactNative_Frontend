import type { InsightPayload } from '@/api/insights/types';
import type { AnalyticsHeader, ServiceAnalyticsBundle } from '@/features/health-dashboard/models';

const money = (amountCents: number): string => {
  return `$${(amountCents / 100).toFixed(2)}`;
};

export const mapHealthDashboardAnalyticsToInsightPayload = (
  header: AnalyticsHeader,
  analytics: ServiceAnalyticsBundle,
): InsightPayload => {
  return {
    kpis: [
      { id: 'rev_today', label: 'Revenue today', value: money(header.revenue.today) },
      { id: 'rev_week', label: 'Revenue week', value: money(header.revenue.week) },
      { id: 'rev_month', label: 'Revenue month', value: money(header.revenue.month) },
      { id: 'bookings', label: 'Bookings', value: header.bookingsCount },
      { id: 'completed', label: 'Completed', value: header.completedConsultations },
      { id: 'pending', label: 'Pending schedules', value: header.pendingSchedules },
      { id: 'cancel', label: 'Cancellation rate', value: `${header.cancellationRate}%` },
      { id: 'convert', label: 'Conversion rate', value: `${header.conversion.rate}%` },
      { id: 'rating', label: 'Average rating', value: header.averageRating.toFixed(2) },
      { id: 'return_rate', label: 'Patient return', value: `${header.patientReturnRate}%` },
    ],
    series: [
      {
        id: 'bookings_over_time',
        name: 'Bookings',
        data: analytics.bookingsOverTime.map((item) => ({ x: item.label, y: item.value })),
      },
    ],
    breakdown: analytics.revenueBreakdown.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    distribution: analytics.serviceUsageDistribution.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    topItems: analytics.topServices.map((item) => ({
      id: item.id,
      title: item.label,
      metric: String(item.value),
    })),
  };
};
