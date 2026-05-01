import React from 'react';
import { View, Text } from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { styles } from '../profile/profile.styles';
import type { KISPalette } from '@/theme/constants';
import type { BroadcastProfileDefinition } from '@/screens/tabs/profile-screen/types';

type Props = {
  palette: KISPalette;
  broadcastProfiles: Record<string, any> | null;
  definitions: BroadcastProfileDefinition[];
  onProfileAction: (def: BroadcastProfileDefinition) => void;
};

export default function BroadcastProfilesSection({
  palette,
  broadcastProfiles,
  definitions,
  onProfileAction,
}: Props) {
  const isLoading = broadcastProfiles === null;

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Broadcast and workspace launchers</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Open the real domain workspace for health, market, or education. Only the broadcast feed is fully broadcast-owned.
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        {definitions.map((def) => {
          const profileData = broadcastProfiles?.[def.profileKey];
          const nameLabel = isLoading
            ? 'Loading…'
            : profileData?.profile_name || 'Not created yet';
          const summaryText = isLoading
            ? 'Refreshing your broadcast profiles…'
            : profileData
            ? def.summary(profileData)
            : def.emptySummary;

          return (
            <View
              key={def.profileKey}
              style={[
                styles.broadcastProfileCard,
                { borderColor: palette.divider, backgroundColor: palette.surface },
              ]}
            >
              <View style={styles.broadcastProfileRow}>
                <View style={[styles.broadcastProfileIcon, { backgroundColor: palette.primarySoft }]}> 
                  <KISIcon name={def.icon as any} size={20} color={palette.primaryStrong} />
                </View>
                <View style={styles.broadcastProfileInfo}>
                  <Text style={[styles.broadcastProfileTitle, { color: palette.text }]}>{def.label}</Text>
                  <Text style={[styles.broadcastProfileSubtitle, { color: palette.subtext }]}>{def.helper}</Text>
                  {def.ownershipLabel ? (
                    <Text style={[styles.broadcastProfileSubtitle, { color: palette.subtext }]}>
                      {def.ownershipLabel}
                    </Text>
                  ) : null}
                  <Text style={[styles.broadcastProfileSubtitle, { color: palette.subtext }]}>{nameLabel}</Text>
                  <Text style={[styles.broadcastProfileMeta, { color: palette.subtext }]}>{summaryText}</Text>
                </View>
                <KISButton
                  title={profileData ? def.managementLabel || 'Open' : 'Open'}
                  size="xs"
                  variant={profileData ? 'primary' : 'secondary'}
                  onPress={() => onProfileAction(def)}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
