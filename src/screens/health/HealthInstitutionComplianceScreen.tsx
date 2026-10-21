// src/screens/health/HealthInstitutionComplianceScreen.tsx
//
// Compliance + billing tooling for a health institution. FinancialPanel and
// CompliancePanel were fully built against real apps/core/apps/billing
// endpoints but had no mount point anywhere in the app - this closes that
// gap for the Health side the same way ShopDashboardScreen's new
// "Compliance" tab closes it for Market.

import React from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { CompliancePanel } from '@/screens/tabs/profile-screen/CompliancePanel';
import { FinancialPanel } from '@/screens/tabs/profile-screen/FinancialPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionCompliance'>;

export default function HealthInstitutionComplianceScreen({ route }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { institutionId } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: responsive.pageGutter,
          gap: 16,
          width: '100%',
          maxWidth: responsive.contentMaxWidth,
          alignSelf: 'center',
        }}
      >
        <FinancialPanel palette={palette} organizationId={institutionId} />
        <CompliancePanel palette={palette} organizationId={institutionId} />
      </ScrollView>
    </SafeAreaView>
  );
}
