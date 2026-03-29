import React from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type { PartnerProfileLink } from '@/screens/broadcast/education/api/education.models';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  links: PartnerProfileLink[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onToggleLink: (profileKey: PartnerProfileLink['profileKey'], link: boolean) => void;
  onSetRole: (profileKey: PartnerProfileLink['profileKey'], role: PartnerProfileLink['role']) => void;
  onRefresh: () => void;
};

const PROFILE_LABELS: Record<PartnerProfileLink['profileKey'], string> = {
  broadcast_feed: 'Broadcast',
  health: 'Health',
  market: 'Market',
  education: 'Education',
};

const ROLE_ORDER: PartnerProfileLink['role'][] = ['admin', 'editor', 'viewer'];

export default function PartnerLinksPanel({
  panelWidth,
  panelTranslateX,
  links,
  loading,
  error,
  onToggleLink,
  onSetRole,
  onRefresh,
}: Props) {
  const { palette } = useKISTheme();

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
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Linked profiles</Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Manage cross-profile visibility + analytics.</Text>
        </View>
        {loading ? (
          <Text style={{ color: palette.subtext }}>Loading linked profiles…</Text>
        ) : error ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.danger ?? palette.primaryStrong }}>{error}</Text>
            <KISButton title="Retry" size="sm" onPress={onRefresh} />
          </View>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false}>
          {links.map((link) => {
            const safeRole = link.role ?? 'viewer';
            const safeProfile = link.profileKey ?? 'unknown';
            const uniqueKey = link.id ?? `${safeProfile}-${safeRole}-${link.linked ? '1' : '0'}`;

            return (
              <View
                key={uniqueKey}
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
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {PROFILE_LABELS[link.profileKey]}
                  </Text>
                  <KISButton
                    title={link.linked ? 'Unlink' : 'Link'}
                    size="sm"
                    variant={link.linked ? 'outline' : 'primary'}
                    onPress={() => onToggleLink(link.profileKey, !link.linked)}
                  />
                </View>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>Role: {link.role.toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
                  {ROLE_ORDER.map((role) => (
                    <PressableChip
                      key={`${link.profileKey}-${role}`}
                      label={role}
                      active={link.role === role}
                      onPress={() => onSetRole(link.profileKey, role)}
                      palette={palette}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Enrollments: {link.analytics.enrollments}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Completions: {link.analytics.completions}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Watch min: {Math.round(link.analytics.watchMinutes)}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Revenue: ${(link.analytics.revenueCents / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const PressableChip = ({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useKISTheme>['palette'];
}) => (
  <Pressable
    onPress={onPress}
    style={{
      borderWidth: 1,
      borderColor: active ? palette.primaryStrong : palette.divider,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: active ? palette.primarySoft : 'transparent',
    }}
  >
    <Text style={{ color: active ? palette.primaryStrong : palette.text, fontSize: 12 }}>{label}</Text>
  </Pressable>
);
