// src/screens/tabs/PartnersCenterPane.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import {
  Partner,
  PartnerChannel,
  PartnerCommunity,
  PartnerGroup,
  RIGHT_PEEK_WIDTH,
} from './partnersTypes';
import PartnerAdminsStrip from './center/PartnerAdminsStrip';
import PartnerChannelsSection from './center/PartnerChannelsSection';
import PartnerCommunitiesSection from './center/PartnerCommunitiesSection';
import PartnerCoursesSection from './center/PartnerCoursesSection';
import PartnerGroupsSection from './center/PartnerGroupsSection';
import PartnerHeaderSection from './center/PartnerHeaderSection';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';
import {
  VerificationBadgeRow,
  VerificationCenterSheet,
  VerificationStatusCard,
} from '@/components/verification';
import { fetchVerificationStatus, getVerificationSummary } from '@/services/verificationService';
import type { VerificationSummary } from '@/services/verificationService';

type Props = {
  selectedPartner: Partner;
  isReadOnly?: boolean;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  rootGroups: PartnerGroup[];
  rootChannels: PartnerChannel[];
  groupsForPartner: PartnerGroup[];
  communitiesForPartner: PartnerCommunity[];
  expandedCommunities: Record<string, boolean>;
  onToggleCommunity: (communityId: string) => void;
  onGroupPress: (groupId: string) => void;
  onChannelPress: (channelId: string) => void;
  onFeedPress: () => void;
  onCommunityFeedPress: (communityId: string) => void;
  onPartnerHeaderPress: () => void;
  isKcanAdmin?: boolean;
  onOpenAdminDashboard?: () => void;
};

export default function PartnersCenterPane({
  selectedPartner,
  isReadOnly,
  selectedGroupId,
  selectedChannelId,
  rootGroups,
  rootChannels,
  groupsForPartner,
  communitiesForPartner,
  expandedCommunities,
  onToggleCommunity,
  onGroupPress,
  onChannelPress,
  onFeedPress,
  onCommunityFeedPress,
  onPartnerHeaderPress,
  isKcanAdmin,
  onOpenAdminDashboard,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const rightPeek = responsive.isWatch ? 48 : responsive.isCompactPhone ? 56 : RIGHT_PEEK_WIDTH;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const [collapsed, setCollapsed] = useState({
    feed: false,
    courses: false,
    channels: false,
    groups: false,
    communities: false,
  });
  const [verificationVisible, setVerificationVisible] = useState(false);
  const propSummary = useMemo(
    () => getVerificationSummary(selectedPartner),
    [selectedPartner],
  );
  const [liveSummary, setLiveSummary] = useState<VerificationSummary | null>(null);
  useEffect(() => { setLiveSummary(null); }, [selectedPartner?.id]);
  const partnerVerificationSummary = liveSummary ?? propSummary;

  const handleVerificationClose = useCallback(async () => {
    setVerificationVisible(false);
    if (!selectedPartner?.id) return;
    try {
      const fresh = await fetchVerificationStatus({ type: 'partner', id: selectedPartner.id });
      if (fresh) setLiveSummary(fresh);
    } catch {
      // silently ignore — stale data is fine
    }
  }, [selectedPartner?.id]);
  const discordSummary = selectedPartner?.discord_summary ?? null;
  const discordCounts = discordSummary?.counts ?? {};
  const discordReadiness = discordSummary?.readiness ?? {};
  const workspaceStats = useMemo(
    () => [
      {
        label: 'Members',
        value: String(discordCounts.active_members ?? 0),
      },
      {
        label: 'Channels',
        value: String(discordCounts.visible_channels ?? rootChannels.length),
      },
      {
        label: 'Unread',
        value:
          (discordCounts.unread_messages ?? 0) > 99
            ? '99+'
            : String(discordCounts.unread_messages ?? 0),
      },
      {
        label: 'Moderation',
        value: String(discordCounts.open_moderation_actions ?? 0),
      },
    ],
    [
      discordCounts.active_members,
      discordCounts.open_moderation_actions,
      discordCounts.unread_messages,
      discordCounts.visible_channels,
      rootChannels.length,
    ],
  );

  const sectionHeaders = useMemo(
    () => ({
      feed: {
        title: 'General feed',
        meta: isReadOnly ? 'Subscriber view' : null,
      },
      courses: { title: 'Courses', meta: 'Lessons & enrollments' },
      channels: { title: 'Channels', meta: `${rootChannels.length} channels` },
      groups: { title: 'Groups', meta: `${rootGroups.length} groups` },
      communities: {
        title: 'Communities',
        meta: `${communitiesForPartner.length} communities`,
      },
    }),
    [
      communitiesForPartner.length,
      isReadOnly,
      rootChannels.length,
      rootGroups.length,
    ],
  );

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim, selectedPartner?.id]);

  return (
    <Animated.View
      style={[
        styles.centerPane,
        {
          marginRight: rightPeek,
          paddingHorizontal: responsive.pageGutter,
          backgroundColor: 'transparent',
          opacity: contentAnim,
          transform: [
            {
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.centerScrollContent,
          { paddingBottom: compact ? 28 : 42 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PartnerHeaderSection
          partner={selectedPartner}
          onPress={onPartnerHeaderPress}
        />
        {isKcanAdmin && onOpenAdminDashboard && (
          <Pressable
            onPress={onOpenAdminDashboard}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderRadius: 14,
              backgroundColor: palette.royalInk,
              borderWidth: 1,
              borderColor: palette.goldDeep,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            })}
          >
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <Text style={{ color: palette.ivory, fontWeight: '900', fontSize: 13, flex: 1 }}>
              Admin Hub
            </Text>
            <KISIcon name="chevron-right" size={15} color={palette.ivory} />
          </Pressable>
        )}
        {!partnerVerificationSummary?.verified && (
          <VerificationStatusCard
            palette={palette}
            summary={partnerVerificationSummary}
            title="Partner verification"
            subtitle="Submit company registration, representative authorization, and beneficial-owner references."
            onOpen={() => setVerificationVisible(true)}
          />
        )}
        <VerificationBadgeRow
          palette={palette}
          summary={partnerVerificationSummary}
          compact
        />
        <View
          style={[
            styles.workspaceCommandCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.goldLight,
              shadowColor: palette.shadow ?? '#000',
            },
          ]}
        >
          <View style={[styles.workspaceCommandHeader, compact && styles.wrapRow]}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.workspaceCommandTitle,
                  { color: palette.text },
                ]}
              >
                Workspace command
              </Text>
              <Text
                style={[
                  styles.workspaceCommandSubtitle,
                  { color: palette.subtext },
                ]}
              >
                Roles, rooms, safety, and member activity in one view.
              </Text>
            </View>
            <View
              style={[
                styles.workspaceCommandBadge,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 11,
                  fontWeight: '900',
                }}
              >
                120
              </Text>
            </View>
          </View>
          <View style={styles.workspaceStatsGrid}>
            {workspaceStats.map(item => (
              <View
                key={item.label}
                style={[
                  styles.workspaceStatTile,
                  {
                    backgroundColor: palette.card,
                    flexBasis: compact ? '100%' : responsive.isTablet ? '22%' : '45%',
                    borderColor: palette.goldLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.workspaceStatValue,
                    { color: palette.text },
                  ]}
                >
                  {item.value}
                </Text>
                <Text
                  style={[
                    styles.workspaceStatLabel,
                    { color: palette.subtext },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.workspaceSignalRow}>
            {[
              {
                label: discordReadiness.family_safe_media
                  ? 'Family-safe media'
                  : 'Media review ready',
              },
              {
                label: discordReadiness.low_bandwidth_ready
                  ? 'Low-bandwidth ready'
                  : 'Online-first',
              },
              {
                label: discordReadiness.moderation_ready
                  ? 'Moderation active'
                  : 'Moderation pending',
              },
              {
                label: discordReadiness.legacy_wallet_disabled
                  ? 'USD-safe workspace'
                  : 'Payment review',
              },
            ].map(item => (
              <View
                key={item.label}
                style={[
                  styles.workspaceSignalPill,
                  { borderColor: palette.goldLight },
                ]}
              >
                <Text
                  style={[
                    styles.workspaceSignalText,
                    { color: palette.text },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <PartnerAdminsStrip admins={selectedPartner?.admins ?? []} />

        {/* General feed */}
        <Pressable
          onPress={() => toggleSection('feed')}
          style={[styles.sectionHeaderRow, compact && styles.wrapRow]}
        >
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            {sectionHeaders.feed.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {sectionHeaders.feed.meta ? (
              <Text
                style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
              >
                {sectionHeaders.feed.meta}
              </Text>
            ) : null}
            <KISIcon
              name="chevron-down"
              size={16}
              color={palette.subtext}
              style={{
                transform: [{ rotate: collapsed.feed ? '180deg' : '0deg' }],
              }}
            />
          </View>
        </Pressable>

        {!collapsed.feed ? (
          <Pressable
            onPress={onFeedPress}
            style={({ pressed }) => [
              styles.groupRow,
              {
                backgroundColor: palette.surface,
                borderColor: palette.goldLight,
                shadowColor: palette.shadow ?? '#000',
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.groupHash,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 15,
                  fontWeight: '700',
                }}
              >
                FE
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                color: palette.text,
                fontSize: 14,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {selectedPartner?.name} feed
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => toggleSection('courses')}
          style={[styles.sectionHeaderRow, compact && styles.wrapRow, { marginTop: 12 }]}
        >
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            {sectionHeaders.courses.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
            >
              {sectionHeaders.courses.meta}
            </Text>
            <KISIcon
              name="chevron-down"
              size={16}
              color={palette.subtext}
              style={{
                transform: [{ rotate: collapsed.courses ? '180deg' : '0deg' }],
              }}
            />
          </View>
        </Pressable>

        {!collapsed.courses ? (
          <PartnerCoursesSection partner={selectedPartner} />
        ) : null}

        {isReadOnly ? (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 12 }}>
            Subscribe-only accounts can follow feeds but cannot access groups or
            channels.
          </Text>
        ) : (
          <>
            <Pressable
              onPress={() => toggleSection('channels')}
              style={[styles.sectionHeaderRow, compact && styles.wrapRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.channels.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.channels.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.channels ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.channels ? (
              <PartnerChannelsSection
                rootChannels={rootChannels}
                selectedChannelId={selectedChannelId}
                onChannelPress={onChannelPress}
                showHeader={false}
              />
            ) : null}

            <Pressable
              onPress={() => toggleSection('groups')}
              style={[styles.sectionHeaderRow, compact && styles.wrapRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.groups.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.groups.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.groups ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.groups ? (
              <PartnerGroupsSection
                rootGroups={rootGroups}
                selectedGroupId={selectedGroupId}
                onGroupPress={onGroupPress}
                showHeader={false}
              />
            ) : null}

            <Pressable
              onPress={() => toggleSection('communities')}
              style={[styles.sectionHeaderRow, compact && styles.wrapRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.communities.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.communities.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.communities ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.communities ? (
              <PartnerCommunitiesSection
                communities={communitiesForPartner}
                groups={groupsForPartner}
                expandedCommunities={expandedCommunities}
                selectedGroupId={selectedGroupId}
                onToggleCommunity={onToggleCommunity}
                onGroupPress={onGroupPress}
                onCommunityFeedPress={onCommunityFeedPress}
                showHeader={false}
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <VerificationCenterSheet
        visible={verificationVisible}
        palette={palette}
        subject={{ type: 'partner', id: selectedPartner?.id }}
        title="Partner verification"
        subtitle="Submit private company evidence references for staff/provider review."
        initialSummary={partnerVerificationSummary}
        onClose={handleVerificationClose}
        onSubmitted={handleVerificationClose}
      />
    </Animated.View>
  );
}
