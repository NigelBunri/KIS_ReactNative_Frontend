import React from 'react';
import { View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { InstitutionsListScreen } from '@/screens/health/InstitutionsListScreen';
import type { HealthAccessUser } from '@/screens/health/accessControl';

export type HealthManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  institutions: any[];
  currentUser?: HealthAccessUser | null;
  onViewInstitution: (inst: any) => void;
  onManageInstitution: (inst: any) => void;
  onAddInstitution: () => void;
};

export function HealthManagementModal(props: HealthManagementModalProps) {
  const { institutions, currentUser, onViewInstitution, onManageInstitution, onAddInstitution } = props;

  return (
    <View style={{ flex: 1 }}>
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
