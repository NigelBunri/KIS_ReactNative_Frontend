import React from 'react';
import { View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { InstitutionsListScreen } from '@/screens/health/InstitutionsListScreen';
import type { HealthAccessUser } from '@/screens/health/accessControl';
import { VerificationStatusCard } from '@/components/verification';
import { getVerificationSummary } from '@/services/verificationService';
import HealthRevenuePreviewCard from '@/components/profitability/HealthRevenuePreviewCard';
import InstitutionMonetizationPreviewCard from '@/components/profitability/InstitutionMonetizationPreviewCard';
import TrustPromotionRevenuePreviewCard from '@/components/profitability/TrustPromotionRevenuePreviewCard';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

export type HealthManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  institutions: any[];
  currentUser?: HealthAccessUser | null;
  onViewInstitution: (inst: any) => void;
  onManageInstitution: (inst: any) => void;
  onAddInstitution: () => void;
  onOpenVerificationCenter?: (institution: any) => void;
};

export function HealthManagementModal(props: HealthManagementModalProps) {
  const {
    institutions,
    currentUser,
    onViewInstitution,
    onManageInstitution,
    onAddInstitution,
    onOpenVerificationCenter,
    palette,
  } = props;

  return (
    <View style={{ flex: 1 }}>
      {institutions[0] ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <VerificationStatusCard
            palette={palette}
            summary={getVerificationSummary(institutions[0])}
            title="Health verification center"
            subtitle="Submit private licensing and accreditation references for review."
            onOpen={() => onOpenVerificationCenter?.(institutions[0])}
          />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <InstitutionMonetizationPreviewCard
          palette={palette}
          kind="health"
          title="Health provider growth preview"
          subtitle="Health Provider Pro is preview-only and focuses on booking, trust, reminders, and operations, not diagnosis."
        />
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <HealthRevenuePreviewCard
          palette={palette}
          kind="provider_dashboard"
          title="Health revenue engine preview"
          subtitle="Provider analytics, care-plan readiness, USD payment state, service fees, and promotion entry points are visible but not live."
        />
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <TrustPromotionRevenuePreviewCard
          palette={palette}
          kind="health_verification"
          title="Health verification and trust preview"
          subtitle="License review, badge renewal, provider trust, and promotion readiness are preview-only and do not enable live fees."
        />
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <EnterpriseKcanRevenuePreviewCard
          palette={palette}
          kind="health_network"
          title="Health network packaging preview"
          subtitle="Clinic networks, provider roles, care workflow support, and safety evidence are preview-only."
        />
      </View>
      <InstitutionsListScreen
        institutions={institutions}
        currentUser={currentUser}
        onEdit={onManageInstitution}
        onView={onViewInstitution}
        onAdd={onAddInstitution}
      />
    </View>
  );
}
