import React from 'react';
import { View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { InstitutionsListScreen } from '@/screens/health/InstitutionsListScreen';
import type { HealthAccessUser } from '@/screens/health/accessControl';
import { VerificationStatusCard } from '@/components/verification';
import { getVerificationSummary } from '@/services/verificationService';

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
