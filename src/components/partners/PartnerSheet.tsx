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
  const statCards = [
    { label: 'Groups', value: groupsCount },
    { label: 'Communities', value: communitiesCount },
    { label: 'Channels', value: channelsCount },
    { label: 'Admins', value: selectedPartner?.admins?.length || 0 },
  ];

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
        <Pressable
          style={{ flex: 1 }}
          onPress={() => animatePartnerSheet(false)}
        />
      </Animated.View>

      {/* draggable sheet itself */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: sheetHeight,
            backgroundColor: palette.surface,
            borderTopColor: palette.divider,
            shadowColor: palette.shadow ?? '#000',
            transform: [{ translateY: sheetOffsetAnim }],
          },
        ]}
      >
        <View style={styles.sheetDragZone} {...sheetPanHandlers}>
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: palette.borderMuted },
            ]}
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingsSheetHeader}>
            <View style={styles.settingsHeroTopRow}>
              <View style={styles.settingsHeroTitleWrap}>
                <Text
                  style={[
                    styles.settingsEyebrow,
                    { color: palette.primaryStrong },
                  ]}
                >
                  Partner control room
                </Text>
                <Text
                  style={[styles.settingsTitle, { color: palette.text }]}
                  numberOfLines={2}
                >
                  {selectedPartner?.name ?? 'Partner'} settings
                </Text>
              </View>
              <Pressable
                onPress={() => animatePartnerSheet(false)}
                style={({ pressed }) => [
                  styles.settingsCloseButton,
                  {
                    borderColor: palette.borderMuted,
                    backgroundColor: palette.surface,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.settingsCloseText, { color: palette.text }]}
                >
                  Close
                </Text>
              </Pressable>
            </View>
            <Text
              style={[styles.settingsSubtitle, { color: palette.subtext }]}
              numberOfLines={2}
            >
              Configure communities, roles, analytics, and organizational tools.
            </Text>

            <View style={styles.settingsHeroMetaRow}>
              <View
                style={[
                  styles.settingsRoleBadge,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <Text
                  style={[
                    styles.settingsRoleText,
                    { color: palette.primaryStrong },
                  ]}
                >
                  ROLE: {partnerRole.toUpperCase()}
                </Text>
              </View>
              <View
                style={[
                  styles.settingsRoleBadge,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderMuted,
                  },
                ]}
              >
                <Text
                  style={[styles.settingsRoleText, { color: palette.text }]}
                >
                  {sections.length} AREAS
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.settingsStatsGrid}>
            {statCards.map(card => (
              <View
                key={card.label}
                style={[
                  styles.settingsStatCard,
                  {
                    backgroundColor: palette.surfaceElevated,
                    borderColor: palette.borderMuted,
                  },
                ]}
              >
                <Text
                  style={[styles.settingsStatValue, { color: palette.text }]}
                >
                  {card.value}
                </Text>
                <Text
                  style={[styles.settingsStatLabel, { color: palette.subtext }]}
                >
                  {card.label}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.sheetSection,
              styles.settingsQuickActionPanel,
              {
                backgroundColor: palette.surfaceElevated,
                borderColor: palette.borderMuted,
              },
            ]}
          >
            <Text style={[styles.sheetSectionTitle, { color: palette.text }]}>
              Quick actions
            </Text>
            <Text style={[styles.sheetSectionText, { color: palette.subtext }]}>
              Create spaces or connect this partner to public profiles.
            </Text>
            <View style={styles.settingsActionGrid}>
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
              <KISButton
                title="New channel"
                size="sm"
                variant="outline"
                onPress={() => onOpenCreate('channel')}
              />
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

          <View style={styles.settingsAreasHeader}>
            <Text style={[styles.sheetSectionTitle, { color: palette.text }]}>
              Settings areas
            </Text>
            <Text style={[styles.sheetSectionText, { color: palette.subtext }]}>
              Open a section to manage tools, analytics, and org structure.
            </Text>
          </View>

          {sections.map(section => {
            const allowedCount = section.features.filter(
              feature =>
                feature.allowed ?? canAccessFeature(partnerRole, feature),
            ).length;
            return (
              <View
                key={section.key}
                style={[
                  styles.settingsSectionCard,
                  {
                    backgroundColor: palette.surfaceElevated,
                    borderColor: palette.borderMuted,
                    shadowColor: palette.shadow ?? '#000',
                  },
                ]}
              >
                <View style={styles.settingsSectionHeader}>
                  <Text
                    style={[
                      styles.settingsSectionTitle,
                      { color: palette.text },
                    ]}
                  >
                    {section.title}
                  </Text>
                  <Text
                    style={[
                      styles.settingsSectionMeta,
                      {
                        color: palette.primaryStrong,
                        backgroundColor: palette.primarySoft,
                      },
                    ]}
                  >
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
