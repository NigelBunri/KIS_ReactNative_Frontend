import React from 'react';
import { Text, View } from 'react-native';
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
  accountTier?: any;
  tierLabel?: string | null;
  onViewInstitution: (inst: any) => void;
  onManageInstitution: (inst: any) => void;
  onAddInstitution: () => void;
  onOpenVerificationCenter?: (institution: any) => void;
};

export function HealthManagementModal(props: HealthManagementModalProps) {
  const {
    institutions,
    currentUser,
    accountTier,
    tierLabel,
    onViewInstitution,
    onManageInstitution,
    onAddInstitution,
    onOpenVerificationCenter,
    palette,
  } = props;

  const healthInstitutionLimit = (() => {
    const raw = accountTier?.features_json?.health_profiles;
    if (raw === undefined || raw === null || raw === '') return null;
    if (String(raw).toLowerCase() === 'unlimited') return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  })();

  return (
    <View style={{ flex: 1 }}>
      {tierLabel ? (
        <Text
          style={{
            color: palette.subtext,
            fontSize: 12,
            textAlign: 'center',
            paddingHorizontal: 14,
            paddingTop: 10,
          }}
        >
          Current health tier: {tierLabel}
          {'\n'}
          {healthInstitutionLimit === null
            ? `${institutions.length} institution${institutions.length === 1 ? '' : 's'} created`
            : `${institutions.length}/${healthInstitutionLimit} institution${healthInstitutionLimit === 1 ? '' : 's'} used`}
        </Text>
      ) : null}
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
