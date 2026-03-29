// src/screens/tabs/PartnerSheet.tsx
import React from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { Partner } from './partnersTypes';
import KISButton from '@/constants/KISButton';
import {
  PartnerRole,
  PartnerSettingsSection,
  canAccessFeature,
} from './settings/partnerSettingsData';

type Props = {
  isOpen: boolean;
  sheetHeight: number;
  sheetOffsetAnim: Animated.Value;
  overlayOpacity: Animated.AnimatedInterpolation<string | number>;
  sheetPanHandlers: any;
  selectedPartner?: Partner;
  communitiesCount: number;
  groupsCount: number;
  channelsCount: number;
  partnerRole: PartnerRole;
  sections: PartnerSettingsSection[];
  onOpenSettingsSection: (sectionKey: string) => void;
  onOpenCreate: (kind: 'community' | 'group' | 'channel') => void;
  animatePartnerSheet: (open: boolean) => void;
  onOpenLinks: () => void;
};

export default function PartnerSheet({
  isOpen,
  sheetHeight,
  sheetOffsetAnim,
  overlayOpacity,
  sheetPanHandlers,
  selectedPartner,
  communitiesCount,
  groupsCount,
  channelsCount,
  partnerRole,
  sections,
  onOpenSettingsSection,
  onOpenCreate,
  onOpenLinks,
  animatePartnerSheet,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View
      style={styles.sheetOverlay}
      pointerEvents={isOpen ? 'box-none' : 'none'}
    >
      {/* tappable space above the sheet to close it */}
      <Animated.View
        style={[
          styles.sheetBackdrop,
          { backgroundColor: palette.backdrop, opacity: overlayOpacity },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={() => animatePartnerSheet(false)} />
      </Animated.View>

      {/* draggable sheet itself */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: sheetHeight,
            backgroundColor: palette.surfaceElevated,
            borderTopColor: palette.divider,
            transform: [{ translateY: sheetOffsetAnim }],
          },
        ]}
        {...sheetPanHandlers}
      >
        <View
          style={[
            styles.sheetHandle,
            { backgroundColor: palette.borderMuted },
          ]}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingsSheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.settingsTitle, { color: palette.text, flex: 1 }]}>
                {(selectedPartner?.name ?? 'Partner')} settings
              </Text>
              <Pressable
                onPress={() => animatePartnerSheet(false)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: palette.borderMuted,
                    backgroundColor: palette.surface,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>
                  CLOSE
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.settingsSubtitle, { color: palette.subtext }]}>
              Configure communities, roles, analytics, and organizational tools.
            </Text>
            <View
              style={[
                styles.settingsRoleBadge,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text style={[styles.settingsRoleText, { color: palette.primaryStrong }]}>
                ROLE: {partnerRole.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.sheetSection}>
            <Text style={[styles.sheetSectionTitle, { color: palette.text }]}>
              Quick actions
            </Text>
            <Text style={[styles.sheetSectionText, { color: palette.subtext }]}>
              Groups: {groupsCount}
              {'\n'}Communities: {communitiesCount}
              {'\n'}Channels: {channelsCount}
              {'\n'}Admins: {selectedPartner?.admins?.length || 0}
            </Text>
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <KISButton
                title="New community"
                size="sm"
                onPress={() => onOpenCreate('community')}
              />
              <KISButton
                title="New group"
                size="sm"
                variant="outline"
                onPress={() => onOpenCreate('group')}
              />
            </View>
            <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
              <KISButton
                title="New channel"
                size="sm"
                variant="outline"
                onPress={() => onOpenCreate('channel')}
              />
            </View>
            <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
              <KISButton
                title="Link profiles"
                size="sm"
                variant="secondary"
                onPress={() => {
                  animatePartnerSheet(false);
                  onOpenLinks();
                }}
              />
            </View>
          </View>

          <View style={styles.sheetSection}>
            <Text style={[styles.sheetSectionTitle, { color: palette.text }]}>
              Settings areas
            </Text>
            <Text style={[styles.sheetSectionText, { color: palette.subtext }]}>
              Open a section to manage tools, analytics, and org structure.
            </Text>
          </View>

          {sections.map((section) => {
            const allowedCount = section.features.filter((feature) =>
              feature.allowed ?? canAccessFeature(partnerRole, feature),
            ).length;
            return (
              <View
                key={section.key}
                style={[
                  styles.settingsSectionCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderMuted,
                  },
                ]}
              >
                <View style={styles.settingsSectionHeader}>
                  <Text style={[styles.settingsSectionTitle, { color: palette.text }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.settingsSectionMeta, { color: palette.subtext }]}>
                    {allowedCount}/{section.features.length}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.settingsSectionDescription,
                    { color: palette.subtext },
                  ]}
                >
                  {section.description}
                </Text>
                <View style={styles.settingsSectionActionRow}>
                  <KISButton
                    title="Open"
                    size="sm"
                    onPress={() => onOpenSettingsSection(section.key)}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
