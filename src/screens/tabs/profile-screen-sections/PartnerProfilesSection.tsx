import React from 'react';
import { View } from 'react-native';
import PartnerProfilesList from '@/screens/tabs/profile/components/PartnerProfilesList';
import { styles } from '../profile/profile.styles';
import type { KISPalette } from '@/theme/constants';

type Props = {
  palette: KISPalette;
  partners: any[];
  limitLabel?: string | null;
  limitValue?: number | null;
  isUnlimited?: boolean;
  canCreate?: boolean;
  actionLoadingId?: string | null;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenLandingBuilder?: (partnerId: string, partnerName?: string | null) => void;
};

export default function PartnerProfilesSection({
  palette,
  partners,
  limitLabel,
  limitValue,
  isUnlimited,
  canCreate,
  actionLoadingId,
  onDeactivate,
  onReactivate,
  onDelete,
  onOpenLandingBuilder,
}: Props) {
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
      ]}
    >
      <PartnerProfilesList
        partners={partners}
        limitLabel={limitLabel}
        limitValue={limitValue}
        isUnlimited={isUnlimited}
        canCreate={canCreate}
        actionLoadingId={actionLoadingId}
        onDeactivate={onDeactivate}
        onReactivate={onReactivate}
        onDelete={onDelete}
        onOpenLandingBuilder={onOpenLandingBuilder}
      />
    </View>
  );
}
