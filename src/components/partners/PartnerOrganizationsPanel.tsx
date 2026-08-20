import React, { useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type {
  LinkableOrganization,
  PartnerOrganizationLink,
  PartnerOrganizationType,
} from '@/screens/tabs/partners/usePartnerOrganizations';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  organizations: PartnerOrganizationLink[];
  linkable: LinkableOrganization[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onLink: (ownerType: PartnerOrganizationType, ownerId: string) => void;
  onUnlink: (linkId: string) => void;
  onRefresh: () => void;
};

const TYPE_LABELS: Record<PartnerOrganizationType, string> = {
  shop: 'Shop',
  health_institution: 'Health Institution',
  education_institution: 'Education Institution',
  broadcast_channel: 'Broadcast Channel',
};

export default function PartnerOrganizationsPanel({
  panelWidth,
  panelTranslateX,
  organizations,
  linkable,
  loading,
  error,
  onLink,
  onUnlink,
  onRefresh,
}: Props) {
  const { palette } = useKISTheme();
  const [showLinkable, setShowLinkable] = useState(false);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: panelWidth,
        height: '100%',
        transform: [{ translateX: panelTranslateX }],
      }}
    >
      <View style={{ flex: 1, backgroundColor: palette.surfaceElevated, padding: 16 }}>
        <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>My organizations</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Connect the shops, institutions, and channels you own to this partner profile.
            </Text>
          </View>
          <KISButton
            title={showLinkable ? 'Cancel' : '+ Link'}
            size="sm"
            variant={showLinkable ? 'outline' : 'primary'}
            onPress={() => setShowLinkable((prev) => !prev)}
          />
        </View>

        {loading ? (
          <Text style={{ color: palette.subtext }}>Loading…</Text>
        ) : error ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.danger ?? palette.primaryStrong }}>{error}</Text>
            <KISButton title="Retry" size="sm" onPress={onRefresh} />
          </View>
        ) : null}

        {showLinkable ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 6 }}>
              Your organizations not yet linked
            </Text>
            {linkable.length === 0 ? (
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                Nothing to link — every shop, institution, or channel you own is already connected here.
              </Text>
            ) : (
              linkable.map((org) => (
                <View
                  key={`${org.owner_type}-${org.owner_id}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                    backgroundColor: palette.surface,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{org.name || 'Untitled'}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>{TYPE_LABELS[org.owner_type]}</Text>
                  </View>
                  <KISButton
                    title="Link"
                    size="sm"
                    onPress={() => {
                      onLink(org.owner_type, org.owner_id);
                      setShowLinkable(false);
                    }}
                  />
                </View>
              ))
            )}
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false}>
          {organizations.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13 }}>
              No organizations connected yet. Tap "+ Link" to connect a shop, institution, or channel you own.
            </Text>
          ) : (
            organizations.map((org) => (
              <View
                key={org.id}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 12,
                  backgroundColor: palette.surface,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: palette.text, fontWeight: '900' }}>
                      {org.exists ? org.name || 'Untitled' : 'No longer available'}
                    </Text>
                    <TypeChip type={org.owner_type} palette={palette} />
                  </View>
                  <KISButton title="Unlink" size="sm" variant="outline" onPress={() => onUnlink(org.id)} />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const TypeChip = ({
  type,
  palette,
}: {
  type: PartnerOrganizationType;
  palette: ReturnType<typeof useKISTheme>['palette'];
}) => (
  <View
    style={{
      alignSelf: 'flex-start',
      marginTop: 4,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: palette.primarySoft,
    }}
  >
    <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '700' }}>{TYPE_LABELS[type]}</Text>
  </View>
);
