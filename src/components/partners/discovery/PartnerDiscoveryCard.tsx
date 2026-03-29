import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PartnerDiscover } from '@/components/partners/partnersTypes';

type Props = {
  palette: any;
  partner: PartnerDiscover;
  joinMethods: string[];
  onApply: () => void;
  onSubscribe: () => void;
};

export default function PartnerDiscoveryCard({
  palette,
  partner,
  joinMethods,
  onApply,
  onSubscribe,
}: Props) {
  const canApply = partner.join_config?.allow_apply !== false;
  const canSubscribe = partner.join_config?.allow_subscribe !== false;
  const alreadyMember =
    partner.membership_status === 'member' ||
    partner.membership_status === 'subscriber';
  const criteria = partner.join_config?.criteria || {};
  const criteriaText = Object.keys(criteria).length
    ? Object.entries(criteria)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(' | ')
    : '';

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.borderMuted,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        backgroundColor: palette.surface,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
        {partner.name}
      </Text>
      {partner.description ? (
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
          {partner.description}
        </Text>
      ) : null}
      {criteriaText ? (
        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 6 }}>
          Criteria: {criteriaText}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {joinMethods.map((method) => (
          <View
            key={`${partner.id}-${method}`}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: palette.primarySoft,
              marginRight: 6,
              marginBottom: 6,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontSize: 10, fontWeight: '600' }}>
              {method.replace(/_/g, ' ')}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {!alreadyMember && canApply ? (
          <Pressable
            onPress={onApply}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: palette.primaryStrong,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '700', fontSize: 12 }}>
              Apply
            </Text>
          </Pressable>
        ) : null}
        {!alreadyMember && canSubscribe ? (
          <Pressable
            onPress={onSubscribe}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: palette.surfaceElevated,
              borderWidth: 2,
              borderColor: palette.borderMuted,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>
              Subscribe
            </Text>
          </Pressable>
        ) : null}
      </View>

      {alreadyMember ? (
        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 6 }}>
          You are already a member.
        </Text>
      ) : partner.application_status === 'pending' ? (
        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 6 }}>
          Application pending review.
        </Text>
      ) : null}
    </View>
  );
}
