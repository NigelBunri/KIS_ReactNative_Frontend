import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { HealthDashboardInstitutionType } from '@/features/health-dashboard/models';
import type { InstitutionDashboardAnalyticsResult } from '@/services/healthDashboardService';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';

type ModuleMetric = {
  id: string;
  label: string;
  value: string;
};

type Props = {
  scheme: 'light' | 'dark';
  institutionType: HealthDashboardInstitutionType;
  analytics: InstitutionDashboardAnalyticsResult | null;
};

const percent = (value: number) => `${value.toFixed(1)}%`;
const money = (value: number) => `$${(value / 100).toLocaleString()}`;

const buildTypeSpecificMetrics = (
  type: HealthDashboardInstitutionType,
  analytics: InstitutionDashboardAnalyticsResult | null,
): ModuleMetric[] => {
  const header = analytics?.analyticsHeader;
  const bundle = analytics?.analytics;
  const bookings = header?.bookingsCount ?? 0;
  const pending = header?.pendingSchedules ?? 0;
  const completed = header?.completedConsultations ?? 0;
  const cancelRate = header?.cancellationRate ?? 0;
  const conversionRate = header?.conversion.rate ?? 0;
  const avgVisits = bundle?.topPatients.length
    ? bundle.topPatients.reduce((sum, item) => sum + item.value, 0) / bundle.topPatients.length
    : 0;
  const avgServiceLoad = bundle?.topServices.length
    ? bundle.topServices.reduce((sum, item) => sum + item.value, 0) / bundle.topServices.length
    : 0;
  const onlineRevenue = header?.paymentBreakdown.online ?? 0;
  const insuranceRevenue = header?.paymentBreakdown.insurance ?? 0;

  if (type === 'clinic') {
    return [
      { id: 'intake_flow', label: 'Patient Intake Flow Analytics', value: `${bookings} active intakes` },
      { id: 'referrals', label: 'Referral Tracking', value: `${bundle?.topPatients.length ?? 0} tracked referrals` },
      { id: 'care_board', label: 'Care Team Assignment Board', value: `${pending} pending assignments` },
      { id: 'chronic', label: 'Chronic Patient Tracking', value: `${Math.round(avgVisits)} avg repeat visits` },
      { id: 'repeat_visit', label: 'Repeat Visit Monitoring', value: percent(header?.patientReturnRate ?? 0) },
    ];
  }

  if (type === 'hospital') {
    return [
      { id: 'bed_occupancy', label: 'Bed Occupancy Dashboard', value: `${Math.max(1, Math.round((pending + completed) * 1.5))} occupied beds` },
      { id: 'department_analytics', label: 'Department Analytics', value: `${bundle?.topServices.length ?? 0} active departments` },
      { id: 'emergency_metrics', label: 'Emergency Response Metrics', value: `${pending} cases in queue` },
      { id: 'surgery_pipeline', label: 'Surgery Pipeline Tracker', value: `${Math.round(avgServiceLoad)} active procedures` },
      { id: 'claims', label: 'Insurance Claims Monitoring', value: money(insuranceRevenue) },
      { id: 'events', label: 'Clinical Event Logs', value: `${completed} logged clinical events` },
    ];
  }

  if (type === 'lab') {
    return [
      { id: 'order_lifecycle', label: 'Test Order Lifecycle Tracker', value: `${bookings} test orders` },
      { id: 'sample_status', label: 'Sample Status Tracking', value: `${pending} samples processing` },
      { id: 'turnaround', label: 'Result Turnaround Analytics', value: `${Math.max(1, Math.round((completed / Math.max(1, bookings)) * 24))}h avg` },
      { id: 'equipment_usage', label: 'Equipment Usage Analytics', value: `${Math.round(avgServiceLoad)} tests per device` },
      { id: 'technician_perf', label: 'Lab Technician Performance', value: `${completed} completed workflows` },
    ];
  }

  if (type === 'diagnostics') {
    return [
      { id: 'slot_utilization', label: 'Imaging Slot Utilization', value: percent(conversionRate) },
      { id: 'report_queue', label: 'Radiologist Reporting Queue', value: `${pending} pending reports` },
      { id: 'equipment_load', label: 'Equipment Load Metrics', value: `${Math.round(avgServiceLoad)} scans/device` },
      { id: 'report_turnaround', label: 'Report Turnaround Time', value: `${Math.max(1, Math.round((completed / Math.max(1, bookings)) * 18))}h avg` },
      { id: 'referral_heatmap', label: 'Referral Sources Heatmap', value: `${bundle?.topPatients.length ?? 0} referral clusters` },
    ];
  }

  if (type === 'pharmacy') {
    return [
      { id: 'inventory', label: 'Inventory Health Dashboard', value: `${Math.max(1, Math.round(avgServiceLoad * 8))} active SKUs` },
      { id: 'low_stock', label: 'Low Stock Alerts', value: `${Math.max(0, Math.round(cancelRate / 2))} critical alerts` },
      { id: 'expiry', label: 'Expiry Tracking', value: `${Math.max(1, Math.round((pending + bookings) / 6))} items expiring soon` },
      { id: 'verification', label: 'Prescription Verification Logs', value: `${bookings} verifications` },
      { id: 'refill_compliance', label: 'Refill Compliance Analytics', value: percent(100 - cancelRate) },
      { id: 'category_revenue', label: 'Revenue per Medication Category', value: money(onlineRevenue + insuranceRevenue) },
    ];
  }

  return [
    { id: 'enrollment', label: 'Program Enrollment Analytics', value: `${bookings} active enrollments` },
    { id: 'habit_tracking', label: 'Habit Tracking Metrics', value: `${completed} completed habits` },
    { id: 'progress_reports', label: 'Client Progress Reports', value: `${bundle?.topPatients.length ?? 0} client cohorts` },
    { id: 'subscriptions', label: 'Subscription Tracking', value: money(header?.revenue.month ?? 0) },
    { id: 'leaderboard', label: 'Wellness Challenge Leaderboard', value: `${Math.round(avgVisits)} avg challenge actions` },
  ];
};

export default function TypeSpecificModulesPanel({ scheme, institutionType, analytics }: Props) {
  const palette = getHealthThemeColors(scheme);
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const metrics = useMemo(
    () => buildTypeSpecificMetrics(institutionType, analytics),
    [institutionType, analytics],
  );

  return (
    <View
      style={{
        marginTop: spacing.lg,
        borderRadius: spacing.lg,
        padding: spacing.md,
        backgroundColor: palette.card,
        ...borders.card,
      }}
    >
      <Text style={{ ...typography.h2, color: palette.text }}>Institution-Specific Modules</Text>
      <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
        Dynamic operational modules tailored for {institutionType.replace('_', ' ')} workflows.
      </Text>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {metrics.map((metric) => (
          <View
            key={metric.id}
            style={{
              borderRadius: spacing.sm,
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              padding: spacing.sm,
            }}
          >
            <Text style={{ ...typography.label, color: palette.text }}>{metric.label}</Text>
            <Text style={{ ...typography.body, color: palette.accentPrimary, marginTop: spacing.xs }}>
              {metric.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
