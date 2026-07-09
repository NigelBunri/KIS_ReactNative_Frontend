// src/screens/tabs/PartnersCenterPane.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useGoldenSectionContent } from '@/contexts/GoldenSectionContext';
import { useCollapsingGoldHeader } from '@/hooks/useCollapsingGoldHeader';
import ReanimatedScroll from 'react-native-reanimated';
import { PartnerCenterPaneSkeleton } from './PartnersSkeleton';
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
  /** When true, suppresses PartnerHeaderSection (golden header in PartnerLayout renders instead). */
  hidePartnerHeader?: boolean;
  /** Safe-area top inset so the scrollable golden header can pad correctly. */
  topInset?: number;
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
  onOpenInsights?: () => void;
  loading?: boolean;
  onRefresh?: () => Promise<void> | void;
};

export default function PartnersCenterPane({
  selectedPartner,
  isReadOnly,
  hidePartnerHeader = false,
  topInset = 0,
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
  onOpenInsights,
  loading = false,
  onRefresh,
}: Props) {
  const [paneRefreshing, setPaneRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(async () => {
    if (!onRefresh) return;
    setPaneRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setPaneRefreshing(false);
    }
  }, [onRefresh]);
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

  const { onScroll, onHeaderLayout, collapseStyle } = useCollapsingGoldHeader(140);

  useGoldenSectionContent({
    content: (
      <>
        <PartnerCompactGoldBar
          partner={selectedPartner}
          topInset={topInset}
          pageGutter={responsive.pageGutter}
          onSettingsPress={onPartnerHeaderPress}
          verificationSummary={partnerVerificationSummary}
        />
        <ReanimatedScroll.View style={[collapseStyle, { overflow: 'hidden' }]}>
          <View onLayout={onHeaderLayout}>
            <PartnerDetailHeroCard
              partner={selectedPartner}
              pageGutter={responsive.pageGutter}
              onInsightsPress={onOpenInsights}
              verificationSummary={partnerVerificationSummary}
              onOpenVerification={() => setVerificationVisible(true)}
            />
          </View>
        </ReanimatedScroll.View>
      </>
    ),
  });

  if (loading && !selectedPartner?.id) {
    return <PartnerCenterPaneSkeleton />;
  }

  return (
    <Animated.View
      style={[
        styles.centerPane,
        {
          marginRight: rightPeek,
          // Zero out all padding — golden header fills edge-to-edge naturally,
          // content below uses its own padded View wrapper.
          paddingHorizontal: 0,
          paddingVertical: 0,
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
      <ReanimatedScroll.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: compact ? 28 : 42 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={paneRefreshing}
              onRefresh={handleRefresh}
            />
          ) : undefined
        }
      >
        {/* ── Padded content area below the header ─────────────────────── */}
        <View style={{ paddingHorizontal: responsive.pageGutter, paddingTop: 12 }}>

        {/* VerificationBadgeRow always shows status badges */}
        <VerificationBadgeRow
          palette={palette}
          summary={partnerVerificationSummary}
          compact
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
        {/* Insights, VerificationStatusCard, and VerificationBadgeRow are now
            inside PartnerDetailHeroCard above — not repeated here. */}
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
        </View>{/* end padded content wrapper */}
      </ReanimatedScroll.ScrollView>
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

// ─────────────────────────────────────────────────────────────────────────────
// Partner golden section — split in two:
//  - PartnerCompactGoldBar: identity glance (avatar/name/role/settings),
//    registered via useGoldenSectionContent so it renders inside the shared,
//    fixed Golden Section host in App.tsx (gold gradient supplied there).
//  - PartnerDetailHeroCard: the rest (tagline, pills, insights, verification)
//    stays in-page as a normal scrolling card — no gold gradient of its own.
// ─────────────────────────────────────────────────────────────────────────────

function getPartnerIdentity(partner: Partner | null) {
  const initials = partner?.initials ?? partner?.name?.slice(0, 2).toUpperCase() ?? '?';
  const roleName = (() => {
    const r = partner?.member_role ?? partner?.role ?? '';
    if (!r) return 'Member';
    const map: Record<string, string> = {
      owner: 'Owner', admin: 'Admin', moderator: 'Moderator',
      member: 'Member', readonly: 'Read Only',
    };
    return map[r.toLowerCase()] ?? r.charAt(0).toUpperCase() + r.slice(1);
  })();
  return { initials, roleName };
}

type CompactGoldBarProps = {
  partner: Partner | null;
  topInset: number;
  pageGutter: number;
  onSettingsPress?: () => void;
  verificationSummary?: any;
};

function PartnerCompactGoldBar({
  partner,
  topInset,
  pageGutter,
  onSettingsPress,
  verificationSummary,
}: CompactGoldBarProps) {
  const { palette, tone } = useKISTheme();
  const metallicGold = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];
  const { initials, roleName } = getPartnerIdentity(partner);

  return (
    <View
      style={[
        localHeaderStyles.compactRow,
        { paddingTop: topInset * 2.6, paddingHorizontal: pageGutter },
      ]}
    >
      <View
        style={localHeaderStyles.compactAvatar}
      >
        <View pointerEvents="none" style={localHeaderStyles.goldSheen} />
        {partner?.avatar_url ? (
          <Image
            source={{ uri: partner.avatar_url }}
            style={StyleSheet.absoluteFillObject as any}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ color: palette.ivory, fontSize: 15, fontWeight: '900' }}>
            {initials}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: 'rgba(255,244,184,0.96)', fontSize: 17, fontWeight: '900' }}
        >
          {partner?.name ?? '—'}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: 'rgba(255,244,184,0.70)', fontSize: 11, fontWeight: '700', marginTop: 2 }}
        >
          {roleName}{verificationSummary?.verified ? ' · Verified ✓' : ''}
        </Text>
      </View>

      {onSettingsPress && (
        <Pressable
          onPress={onSettingsPress}
          hitSlop={8}
          style={({ pressed }) => [
            localHeaderStyles.compactIconBtn,
            { opacity: pressed ? 0.75 : 1 },
          ]}
          accessibilityLabel="Partner settings"
        >
          <KISIcon name="settings" size={18} color="rgba(255,244,184,0.92)" />
        </Pressable>
      )}
    </View>
  );
}

type DetailHeroCardProps = {
  partner: Partner | null;
  pageGutter: number;
  onInsightsPress?: () => void;
  verificationSummary?: any;
  onOpenVerification?: () => void;
};

/**
 * The collapsing part of Partners' Golden Section — tagline, pills, insights,
 * and verification. Avatar/name/role already live in the sticky
 * PartnerCompactGoldBar above, so this doesn't repeat them; it just sits on
 * the same gold gradient (no card chrome of its own) and collapses away via
 * useCollapsingGoldHeader as the pane scrolls.
 */
function PartnerDetailHeroCard({
  partner,
  pageGutter,
  onInsightsPress,
  verificationSummary,
  onOpenVerification,
}: DetailHeroCardProps) {
  const { roleName } = getPartnerIdentity(partner);

  return (
    <View style={[localHeaderStyles.detailCard, { paddingHorizontal: pageGutter }]}>
      {!!partner?.tagline && (
        <Text style={localHeaderStyles.tagline} numberOfLines={2}>
          {partner.tagline}
        </Text>
      )}

      <View style={localHeaderStyles.pillRow}>
        <View style={localHeaderStyles.pill}>
          <Text style={localHeaderStyles.pillText}>Role: {roleName}</Text>
        </View>
        <View style={localHeaderStyles.pill}>
          <Text style={localHeaderStyles.pillText}>Active partner</Text>
        </View>
        {verificationSummary?.verified && (
          <View style={[localHeaderStyles.pill, { backgroundColor: 'rgba(60,210,100,0.15)', borderColor: 'rgba(60,210,100,0.35)' }]}>
            <Text style={[localHeaderStyles.pillText, { color: '#B8F5CC' }]}>✓ Verified</Text>
          </View>
        )}
      </View>

      {onInsightsPress && (
        <Pressable
          onPress={onInsightsPress}
          style={({ pressed }) => [localHeaderStyles.insightsBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ fontSize: 15 }}>📊</Text>
          <Text style={localHeaderStyles.insightsBtnText}>Insights</Text>
          <View style={{ flex: 1 }} />
          <KISIcon name="chevron-right" size={14} color="rgba(255,244,184,0.6)" />
        </Pressable>
      )}

      {!verificationSummary?.verified && onOpenVerification && (
        <Pressable
          onPress={onOpenVerification}
          style={({ pressed }) => [localHeaderStyles.verifyBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ fontSize: 15 }}>🔐</Text>
          <View style={{ flex: 1 }}>
            <Text style={localHeaderStyles.verifyBtnTitle}>Verify this partner</Text>
            <Text style={localHeaderStyles.verifyBtnSub}>Submit documents to unlock full capabilities</Text>
          </View>
          <KISIcon name="chevron-right" size={14} color="rgba(255,244,184,0.6)" />
        </Pressable>
      )}
    </View>
  );
}

// Local styles just for the golden header — kept separate so they don't
// pollute the shared partnersStyles.ts file.
const localHeaderStyles = StyleSheet.create({
  // ── Compact gold bar (rendered inside the shared gold gradient shell) ──
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 16,
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,244,184,0.35)',
  },
  compactIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,17,31,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,244,184,0.26)',
  },
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ translateX: -14 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },

  // ── Detail card (collapsing content, sits directly on the shared gold
  //    gradient — no card chrome of its own) ──
  detailCard: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 18,
    color: 'rgba(255,244,184,0.78)',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,244,184,0.10)',
    borderColor: 'rgba(255,244,184,0.25)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,244,184,0.88)',
  },
  insightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: 'rgba(23,17,31,0.30)',
    borderColor: 'rgba(255,244,184,0.22)',
  },
  insightsBtnText: {
    fontWeight: '700',
    fontSize: 13,
    color: 'rgba(255,244,184,0.90)',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(23,17,31,0.30)',
    borderColor: 'rgba(255,244,184,0.22)',
  },
  verifyBtnTitle: {
    fontWeight: '800',
    fontSize: 13,
    color: 'rgba(255,244,184,0.90)',
  },
  verifyBtnSub: {
    fontWeight: '500',
    fontSize: 11,
    marginTop: 2,
    color: 'rgba(255,244,184,0.55)',
  },
});
