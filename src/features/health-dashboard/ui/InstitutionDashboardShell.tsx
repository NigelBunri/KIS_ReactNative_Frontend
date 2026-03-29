import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import { KpiGrid, LineChart, BarChart, DonutChart, TimeRangeSelector, TopItemsList } from '@/components/insights';
import type { TimeRange } from '@/api/insights/types';
import type { HealthDashboardInstitutionType } from '@/features/health-dashboard/models';
import {
  HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES,
  HEALTH_DASHBOARD_DEFAULT_SERVICES,
} from '@/features/health-dashboard/defaults';
import type { InstitutionDashboardAnalyticsResult } from '@/services/healthDashboardService';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import TypeSpecificModulesPanel from './TypeSpecificModulesPanel';

type Props = {
  scheme: 'light' | 'dark';
  institutionName: string;
  institutionType: HealthDashboardInstitutionType;
  loading: boolean;
  analytics: InstitutionDashboardAnalyticsResult | null;
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  onEditProfilePage: () => void;
  onManageAvailability: () => void;
  onManageServices: () => void;
  onManageMembers: () => void;
  onOpenHealthCards: () => void;
  accessControls?: {
    profile: boolean;
    schedules: boolean;
    services: boolean;
    members: boolean;
  };
};

const money = (amountCents: number) => `$${(amountCents / 100).toLocaleString()}`;

export default function InstitutionDashboardShell({
  scheme,
  institutionName,
  institutionType,
  loading,
  analytics,
  timeRange,
  onTimeRangeChange,
  onEditProfilePage,
  onManageAvailability,
  onManageServices,
  onManageMembers,
  onOpenHealthCards,
  accessControls,
}: Props) {
  const palette = getHealthThemeColors(scheme);
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const fallbackKpis = [
    { id: 'revenue_today', label: 'Revenue today', value: '$0.00' },
    { id: 'bookings', label: 'Bookings', value: 0 },
    { id: 'completed', label: 'Completed consults', value: 0 },
    { id: 'pending', label: 'Pending schedules', value: 0 },
    { id: 'cancellation', label: 'Cancellation', value: '0%' },
    { id: 'conversion', label: 'Conversion', value: '0%' },
    { id: 'rating', label: 'Average rating', value: '0.00' },
    { id: 'return', label: 'Return rate', value: '0%' },
  ];

  const topPatientItems = (analytics?.analytics.topPatients ?? []).map((item) => ({
    id: item.id,
    title: item.label,
    metric: `${item.value} visits`,
  }));
  const paymentRows = analytics?.analytics.paymentMethodBreakdown ?? [];
  const services = HEALTH_DASHBOARD_DEFAULT_SERVICES[institutionType];
  const modules = HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES[institutionType];
  const canEditProfile = accessControls?.profile ?? true;
  const canManageSchedules = accessControls?.schedules ?? true;
  const canManageServices = accessControls?.services ?? true;
  const canManageMembers = accessControls?.members ?? true;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <View
        style={{
          borderRadius: spacing.lg,
          padding: spacing.md,
          backgroundColor: palette.card,
          ...borders.card,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>Analytics Header</Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
          {institutionName} analytics overview
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        </View>
        <KpiGrid items={analytics?.insightPayload.kpis ?? fallbackKpis} />

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}>
            Bookings Over Time
          </Text>
          <LineChart series={analytics?.insightPayload.series ?? []} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}>
            Revenue Breakdown
          </Text>
          <BarChart data={analytics?.insightPayload.breakdown ?? []} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}>
            Service Usage Distribution
          </Text>
          <DonutChart data={analytics?.insightPayload.distribution ?? []} />
        </View>
        <TopItemsList title="Top 10 Services" items={analytics?.insightPayload.topItems ?? []} />
        <TopItemsList title="Top 10 Patients by Usage" items={topPatientItems} />

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ ...typography.h3, color: palette.text, marginBottom: spacing.xs }}>
            Payment Method Breakdown
          </Text>
          {paymentRows.length === 0 ? (
            <Text style={{ ...typography.body, color: palette.subtext }}>No payment data available yet.</Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {paymentRows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.divider,
                  }}
                >
                  <Text style={{ ...typography.body, color: palette.text }}>
                    {row.label}
                  </Text>
                  <Text style={{ ...typography.body, color: palette.accentPrimary }}>
                    {money(row.value)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          borderRadius: spacing.lg,
          padding: spacing.md,
          backgroundColor: palette.card,
          ...borders.card,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>Institution Landing Preview</Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
          Public-facing preview of your institution landing page.
        </Text>
        <View
          style={{
            marginTop: spacing.md,
            borderRadius: spacing.md,
            padding: spacing.md,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.divider,
          }}
        >
          <Text style={{ ...typography.h3, color: palette.text }}>{institutionName}</Text>
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
            Hero • About Us • Services • Team Preview • Gallery • Testimonials • Certifications • Operating Hours
          </Text>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <KISButton title="Edit Profile Page" onPress={onEditProfilePage} disabled={loading || !canEditProfile} />
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          borderRadius: spacing.lg,
          padding: spacing.md,
          backgroundColor: palette.card,
          ...borders.card,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>Schedule Management</Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
          Today, upcoming, and past consultation schedule controls.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ flex: 1, borderRadius: spacing.md, backgroundColor: palette.surface, padding: spacing.sm }}>
            <Text style={{ ...typography.label, color: palette.subtext }}>Today</Text>
            <Text style={{ ...typography.h3, color: palette.text }}>
              {analytics?.analyticsHeader.pendingSchedules ?? 0}
            </Text>
          </View>
          <View style={{ flex: 1, borderRadius: spacing.md, backgroundColor: palette.surface, padding: spacing.sm }}>
            <Text style={{ ...typography.label, color: palette.subtext }}>Upcoming</Text>
            <Text style={{ ...typography.h3, color: palette.text }}>
              {analytics?.analyticsHeader.bookingsCount ?? 0}
            </Text>
          </View>
          <View style={{ flex: 1, borderRadius: spacing.md, backgroundColor: palette.surface, padding: spacing.sm }}>
            <Text style={{ ...typography.label, color: palette.subtext }}>Completed</Text>
            <Text style={{ ...typography.h3, color: palette.text }}>
              {analytics?.analyticsHeader.completedConsultations ?? 0}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <KISButton title="Manage Availability" onPress={onManageAvailability} disabled={loading || !canManageSchedules} />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <KISButton title="Open Health Cards" variant="outline" onPress={onOpenHealthCards} disabled={loading || !canManageSchedules} />
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          borderRadius: spacing.lg,
          padding: spacing.md,
          backgroundColor: palette.card,
          ...borders.card,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>Services Management</Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
          Service catalog is separate from institution profile details.
        </Text>
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          {services.map((service) => (
            <View
              key={service.id}
              style={{
                borderRadius: spacing.sm,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                padding: spacing.sm,
              }}
            >
              <Text style={{ ...typography.label, color: palette.text }}>{service.name}</Text>
              <Text style={{ ...typography.body, color: palette.subtext }}>{service.description}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ ...typography.h3, color: palette.text }}>Operational Modules</Text>
          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            {modules.map((module) => (
              <Text key={module.id} style={{ ...typography.body, color: palette.subtext }}>
                • {module.title}
              </Text>
            ))}
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <KISButton title="Open Service Catalog" onPress={onManageServices} disabled={loading || !canManageServices} />
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          borderRadius: spacing.lg,
          padding: spacing.md,
          backgroundColor: palette.card,
          ...borders.card,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>Members</Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: 4 }}>
          Manage institution team access. Assign roles to members and remove roles when access is no longer needed.
        </Text>
        <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
          This includes owner-added members, registered users, and subscription-linked members.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <KISButton title="Open Members List" onPress={onManageMembers} disabled={loading || !canManageMembers} />
        </View>
      </View>

      <TypeSpecificModulesPanel
        scheme={scheme}
        institutionType={institutionType}
        analytics={analytics}
      />
    </ScrollView>
  );
}
