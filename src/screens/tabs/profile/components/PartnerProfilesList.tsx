import React from 'react';
import { View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISText from '@/components/common/KISText';
import { KISIcon } from '@/constants/kisIcons';

type PartnerProfileRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  is_active: boolean;
  deactivation_source?: string | null;
  grace_expires_at?: string | null;
  can_reactivate?: boolean;
};

type Props = {
  partners: PartnerProfileRow[];
  limitLabel?: string | number | null;
  limitValue?: number | null;
  isUnlimited?: boolean;
  canCreate?: boolean;
  actionLoadingId?: string | null;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenLandingBuilder?: (partnerId: string, partnerName?: string | null) => void;
};

const PartnerProfilesList = ({
  partners,
  limitLabel,
  limitValue,
  isUnlimited = false,
  canCreate = false,
  actionLoadingId,
  onDeactivate,
  onReactivate,
  onDelete,
  onOpenLandingBuilder,
}: Props) => {
  const { palette } = useKISTheme();
  const totalLabel = isUnlimited
    ? 'Unlimited'
    : limitLabel ?? (limitValue !== undefined ? String(limitValue) : '0');

  const renderPartner = (partner: PartnerProfileRow) => {
    const isBusy = actionLoadingId === partner.id;
    const systemDeactivated = partner.deactivation_source === 'system';
    const statusLabel = partner.is_active
      ? 'Active'
      : systemDeactivated
      ? 'System deactivated'
      : 'Deactivated';
    const statusColor = partner.is_active
      ? palette.success
      : systemDeactivated
      ? palette.warning
      : palette.danger;
    const deadline = partner.grace_expires_at ? new Date(partner.grace_expires_at) : null;
    const deadlineText = deadline
      ? deadline.getTime() > Date.now()
        ? `Expires ${deadline.toLocaleDateString()}`
        : 'Grace window expired'
      : null;

    return (
      <View
        key={partner.id}
        style={{
          borderWidth: 2,
          borderColor: palette.border,
          borderRadius: 16,
          padding: 12,
          backgroundColor: palette.card,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <KISText preset="title" weight="700" style={{ color: palette.text }} numberOfLines={1}>
              {partner.name || 'Partner organization'}
            </KISText>
            <KISText preset="helper" color={palette.subtext}>
              @{partner.slug || 'partner'}
            </KISText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <KISIcon name={partner.is_active ? 'check' : 'shield'} size={18} color={statusColor} />
            <KISText preset="helper" color={statusColor}>
              {statusLabel}
            </KISText>
          </View>
        </View>
        {deadlineText ? (
          <KISText preset="caption" color={palette.warning}>
            {deadlineText}
          </KISText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {partner.is_active && (
            <KISButton
              title="Deactivate"
              size="xs"
              variant="ghost"
              onPress={() => onDeactivate(partner.id)}
              disabled={isBusy}
            />
          )}
          {!partner.is_active && partner.can_reactivate && !systemDeactivated && (
            <KISButton
              title="Reactivate"
              size="xs"
              variant="primary"
              onPress={() => onReactivate(partner.id)}
              disabled={isBusy}
            />
          )}
          <KISButton
            title="Delete"
            size="xs"
            variant="outline"
            onPress={() => onDelete(partner.id)}
            disabled={isBusy}
          />
          {onOpenLandingBuilder ? (
            <KISButton
              title="Landing Page"
              size="xs"
              variant="outline"
              onPress={() => onOpenLandingBuilder(partner.id, partner.name)}
              disabled={isBusy}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <KISText preset="title" weight="800" style={{ color: palette.text }}>
          Partner organizations
        </KISText>
        <KISText preset="helper" color={palette.subtext}>
          {partners.length} / {totalLabel}
        </KISText>
      </View>
      {partners.length === 0 ? (
        <KISText preset="helper" color={palette.subtext}>
          No partner profiles yet. Upgrade to Partner Pro to unlock partner org management.
        </KISText>
      ) : (
        partners.map((partner) => renderPartner(partner))
      )}
      {!isUnlimited && !canCreate ? (
        <KISText preset="helper" color={palette.warning}>
          Upgrade to Partner Pro to add or reactivate partner profiles beyond the limit.
        </KISText>
      ) : null}
    </View>
  );
};

export type { PartnerProfileRow };
export default PartnerProfilesList;
