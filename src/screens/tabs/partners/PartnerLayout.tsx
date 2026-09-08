import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LinearGradient from 'react-native-linear-gradient';
import styles from '@/components/partners/partnersStyles';
import PartnersLeftRail from '@/components/partners/PartnersLeftRail';
import PartnersCenterPane from '@/components/partners/PartnersCenterPane';
import PartnerPanels from './PartnerPanels';
import { DetachedPartnersOverlayBridge } from '@/contexts/DetachedPartnersOverlayContext';
import { useKISTheme } from '@/theme/useTheme';
import { useStatusBarStyle } from '@/theme/useStatusBarStyle';
import { useResponsiveLayout } from '@/theme/responsive';
import PartnerAppLaunchBar from '@/components/partners/PartnerAppLaunchBar';
import { usePartnerOrganizationAppsContext } from '@/context/partners/PartnerOrganizationAppsContext';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import { useRawTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  rootPanHandlers: Record<string, any>;
  partners: any[];
  partnersLoading?: boolean;
  selectedPartnerId: string;
  setSelectedPartnerId: (id: string) => void;
  onAddPartnerPress: () => void;
  selectedPartner: any | null;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  selectedFeed: 'general' | null;
  selectedCommunityFeedId: string | null;
  rootGroups: any[];
  rootChannels: any[];
  groupsForPartner: any[];
  channelsForPartner: any[];
  communitiesForPartner: any[];
  expandedCommunities: Record<string, boolean>;
  toggleCommunity: (id: string) => void;
  onGroupPress: (id: string) => void;
  onChannelPress: (id: string) => void;
  onFeedPress: () => void;
  onCommunityFeedPress: (id: string) => void;
  onPartnerHeaderPress: () => void;
  onInfoPress?: () => void;
  width: number;
  messagesOffsetAnim: any;
  messagePanHandlers: Record<string, any>;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  handleCloseMessages: () => void;
  onOpenInfo: any;
  onOpenTasks?: () => void;
  onOpenInsights?: () => void;
  isPartnerSheetOpen: boolean;
  sheetHeight: number;
  sheetOffsetAnim: any;
  overlayOpacity: any;
  sheetPanHandlers: any;
  communitiesCount: number;
  groupsCount: number;
  channelsCount: number;
  partnerRole: any;
  settingsSections: any[];
  openSection: (sectionKey: string) => void;
  onOpenCreate: (kind: 'community' | 'group' | 'channel') => void;
  onOpenLinks: () => void;
  onOpenOrganizations: () => void;
  animatePartnerSheet: (open: boolean) => void;
  panels: {
    settingsPanel: any;
    createPanel: any;
    discoveryPanel: any;
    recruitmentPanel: any;
    auditPanel: any;
    policyPanel: any;
    integrationsPanel: any;
    automationPanel: any;
    reportsPanel: any;
    governancePanel: any;
    membersPanel: any;
    rolesPanel: any;
    channelsPanel: any;
    tasksPanel: any;
    taskBoardsPanel: any;
    orgStructurePanel: any;
    membershipRulesPanel: any;
    spacesDirectoryPanel: any;
    analyticsPanel: any;
    leadershipPanel: any;
    resourcesPanel: any;
    trainingTracksPanel: any;
    eventsCalendarPanel: any;
    broadcastCenterPanel: any;
    supportInboxPanel: any;
    postTemplatesPanel: any;
    surveysPanel: any;
    budgetTrackingPanel: any;
    volunteerRosterPanel: any;
    donationTrackingPanel: any;
    workspaceBrandingPanel: any;
    verificationPanel: any;
    featurePanel: any;
    orgProfilePanel: any;
    coursesPanel: any;
    linksPanel: any;
    complaintsPanel: any;
    appsPanel: any;
    organizationsPanel: any;
  };
  onLaunchOrganizationApp: (app: PartnerOrganizationApp) => void;
  onOpenOrganizationApps: () => void;
  isKcanAdmin?: boolean;
  onOpenAdminDashboard?: () => void;
  onRefreshPartner?: () => Promise<void> | void;
};

export default function PartnerLayout({
  rootPanHandlers,
  partners,
  partnersLoading = false,
  selectedPartnerId,
  setSelectedPartnerId,
  onAddPartnerPress,
  selectedPartner,
  selectedGroupId,
  selectedChannelId,
  selectedFeed,
  selectedCommunityFeedId,
  rootGroups,
  rootChannels,
  groupsForPartner,
  channelsForPartner,
  communitiesForPartner,
  expandedCommunities,
  toggleCommunity,
  onGroupPress,
  onChannelPress,
  onFeedPress,
  onCommunityFeedPress,
  onPartnerHeaderPress,
  onInfoPress,
  width,
  messagesOffsetAnim,
  messagePanHandlers,
  isMessagesExpanded,
  toggleMessagesPane,
  handleCloseMessages,
  onOpenInfo,
  onOpenTasks,
  isPartnerSheetOpen,
  sheetHeight,
  sheetOffsetAnim,
  overlayOpacity,
  sheetPanHandlers,
  communitiesCount,
  groupsCount,
  channelsCount,
  partnerRole,
  settingsSections,
  openSection,
  onOpenCreate,
  onOpenLinks,
  onOpenOrganizations,
  animatePartnerSheet,
  panels,
  onOpenInsights,
  onLaunchOrganizationApp,
  onOpenOrganizationApps,
  isKcanAdmin,
  onOpenAdminDashboard,
  onRefreshPartner,
}: Props) {
  const { palette, tone } = useKISTheme();
  // Gold header → dark icons (same as Messages + Broadcast + Bible)
  useStatusBarStyle(tone, 'dark-content');
  // Opts out of the app-wide GLOBAL_TOP_PADDING dial (useSafeTopInset) — this
  // is one of the 5 main-tab gold-header screens with its own hand-tuned
  // spacing, so it reads the raw (corrected) device inset instead.
  const topInset = useRawTopInset();
  const {
    apps: organizationApps,
    loading: organizationAppsLoading,
    error: organizationAppsError,
    reload: reloadOrganizationApps,
  } = usePartnerOrganizationAppsContext();

  // PartnersMessagesPane's "closed" state is an intentional, always-visible
  // peek sliver at the right edge (RIGHT_PEEK_WIDTH), not a hidden state —
  // it now renders as a genuine top-level sibling (see
  // DetachedPartnersOverlayContext.tsx) so it can fully cover the Golden
  // Section + tab bar once actually open, exactly as requested. But that
  // same top-level promotion means its position:absolute top:0/bottom:0 is
  // now relative to the whole window instead of a box already confined
  // below the Golden Section / above the tab bar by ordinary flex layout,
  // so the always-visible peek sliver needs its OWN top/bottom insets while
  // closed to stay out of both. These are applied as a plain style prop on
  // the always-mounted pane (never remounting it) — an earlier attempt
  // solved this by conditionally switching between rendering the pane
  // inline vs. via the detached bridge based on isMessagesExpanded, which
  // genuinely fixed the visual bug but broke the close animation: the
  // remount happens while the closing spring animation (useNativeDriver:
  // true) is still in flight, and destroying/recreating the native view
  // mid-animation desyncs it from messagesOffsetAnim, leaving the pane
  // visually stuck partway closed until the user manually drags it the
  // rest of the way. A single, permanently-stable render location (matching
  // the proven chat-overlay Bridge/Outlet pattern exactly — it always
  // bridges, never conditionally un-bridges) avoids that entirely.
  //
  // peekBottomInset mirrors AnimatedKISTabBar's own height formula exactly
  // (see AppNavigator.tsx) so the sliver's bottom edge lines up with the
  // real tab bar's top edge precisely, not an approximation.
  //
  // peekTopInset is a deliberately generous, static estimate of the Golden
  // Section's own worst-case (fully expanded) rendered height for this
  // screen specifically, not a pixel-exact live measurement — the Golden
  // Section's real height is a Reanimated-driven, continuously variable
  // value (collapses on scroll; see useCollapsingGoldHeader.ts) that isn't
  // otherwise exposed outside its own shared-value graph, and threading it
  // out just for this approximate, non-critical buffer isn't worth the
  // complexity it would add. Overestimating here is safe (worst case: a
  // sliver of visible background above the peek sliver) - underestimating
  // is the actual bug, so this errs generous on purpose.
  const responsive = useResponsiveLayout();
  const safeAreaInsets = useSafeAreaInsets();
  const tabBarHeight = responsive.isWatch ? 52 : responsive.isCompactPhone ? 62 : 72;
  const peekBottomInset = tabBarHeight + Math.max(safeAreaInsets.bottom, 0);
  const peekTopInset = topInset + 300;

  return (
    // Root no longer has paddingTop — the left rail fills all the way to y=0
    // (behind the status bar) while the centre column handles its own top inset
    // via the gold header's paddingTop.
    <View
      style={[styles.root, { backgroundColor: palette.chrome }]}
      {...rootPanHandlers}
    >
      <LinearGradient
        colors={[palette.chrome, palette.surface, palette.chrome]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.rootGradient}
      />
      <View style={[styles.rootGlowTop, { backgroundColor: palette.primaryStrong }]} />
      <View style={[styles.rootGlowBottom, { backgroundColor: palette.secondary ?? palette.primaryStrong }]} />

      {/* ── Left rail — extends from the very top of the screen (y=0) ─────── */}
      <PartnersLeftRail
        partners={partners}
        selectedPartnerId={selectedPartnerId}
        onSelectPartner={setSelectedPartnerId}
        onAddPartnerPress={onAddPartnerPress}
        loading={partnersLoading}
        topInset={topInset}
      />

      {/* ── Centre pane — golden header lives inside the scrollable content ── */}
      <PartnersCenterPane
        selectedPartner={selectedPartner}
        isReadOnly={selectedPartner?.member_role === 'readonly'}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        rootGroups={rootGroups}
        rootChannels={rootChannels}
        groupsForPartner={groupsForPartner}
        communitiesForPartner={communitiesForPartner}
        expandedCommunities={expandedCommunities}
        onToggleCommunity={toggleCommunity}
        onGroupPress={onGroupPress}
        onChannelPress={onChannelPress}
        onFeedPress={onFeedPress}
        onCommunityFeedPress={onCommunityFeedPress}
        onPartnerHeaderPress={onPartnerHeaderPress}
        onInfoPress={onInfoPress}
        isKcanAdmin={isKcanAdmin}
        onOpenAdminDashboard={onOpenAdminDashboard}
        onOpenInsights={onOpenInsights}
        loading={partnersLoading}
        onRefresh={onRefreshPartner}
        topInset={topInset}
      />

      {!isMessagesExpanded ? (
        <PartnerAppLaunchBar
          apps={organizationApps}
          loading={organizationAppsLoading}
          onLaunchApp={onLaunchOrganizationApp}
          onOpenMore={onOpenOrganizationApps}
        />
      ) : null}

      {/* Chat/feed pane + settings sheet render as true top-level siblings in
          App.tsx (see DetachedPartnersOverlayContext.tsx), permanently — the
          same "always bridged, never conditionally unbridged" shape as the
          chat overlay, so the pane is never remounted mid-animation (an
          earlier attempt toggled render location based on isMessagesExpanded
          and broke the close animation this way - see the long comment
          above peekTopInset/peekBottomInset). Instead, the pane's own
          top/bottom insets do the work: full coverage while open, confined
          to peekTopInset/peekBottomInset while closed - a plain style change
          on an always-mounted component, not a remount. */}
      <DetachedPartnersOverlayBridge
        messagesPaneProps={{
          width,
          messagesOffsetAnim,
          messagePanHandlers,
          isMessagesExpanded,
          toggleMessagesPane,
          closeMessagesPane: handleCloseMessages,
          selectedGroupId,
          selectedChannelId,
          selectedFeed,
          selectedCommunityFeedId,
          groupsForPartner,
          channelsForPartner,
          communitiesForPartner,
          selectedPartner,
          onOpenInfo,
          onOpenTasks,
          peekTopInset,
          peekBottomInset,
        }}
        partnerSheetProps={{
          isOpen: isPartnerSheetOpen,
          sheetHeight,
          sheetOffsetAnim,
          overlayOpacity,
          sheetPanHandlers,
          selectedPartner,
          communitiesCount,
          groupsCount,
          channelsCount,
          partnerRole,
          sections: settingsSections,
          onOpenSettingsSection: openSection,
          onOpenCreate,
          animatePartnerSheet,
          onOpenLinks,
          onOpenOrganizations,
        }}
      />

      <PartnerPanels
        selectedPartnerId={selectedPartner?.id}
        settingsPanel={panels.settingsPanel}
        createPanel={panels.createPanel}
        discoveryPanel={panels.discoveryPanel}
        recruitmentPanel={panels.recruitmentPanel}
        auditPanel={panels.auditPanel}
        policyPanel={panels.policyPanel}
        integrationsPanel={panels.integrationsPanel}
        automationPanel={panels.automationPanel}
        reportsPanel={panels.reportsPanel}
        governancePanel={panels.governancePanel}
        membersPanel={panels.membersPanel}
        rolesPanel={panels.rolesPanel}
        channelsPanel={panels.channelsPanel}
        tasksPanel={panels.tasksPanel}
        taskBoardsPanel={panels.taskBoardsPanel}
        orgStructurePanel={panels.orgStructurePanel}
        membershipRulesPanel={panels.membershipRulesPanel}
        spacesDirectoryPanel={panels.spacesDirectoryPanel}
        analyticsPanel={panels.analyticsPanel}
        leadershipPanel={panels.leadershipPanel}
        resourcesPanel={panels.resourcesPanel}
        trainingTracksPanel={panels.trainingTracksPanel}
        eventsCalendarPanel={panels.eventsCalendarPanel}
        broadcastCenterPanel={panels.broadcastCenterPanel}
        supportInboxPanel={panels.supportInboxPanel}
        postTemplatesPanel={panels.postTemplatesPanel}
        surveysPanel={panels.surveysPanel}
        budgetTrackingPanel={panels.budgetTrackingPanel}
        volunteerRosterPanel={panels.volunteerRosterPanel}
        donationTrackingPanel={panels.donationTrackingPanel}
        workspaceBrandingPanel={panels.workspaceBrandingPanel}
        directoryChannels={channelsForPartner}
        directoryGroups={groupsForPartner}
        directoryCommunities={communitiesForPartner}
        onSelectDirectoryChannel={onChannelPress}
        onSelectDirectoryGroup={onGroupPress}
        onSelectDirectoryCommunity={onCommunityFeedPress}
        verificationPanel={panels.verificationPanel}
        featurePanel={panels.featurePanel}
        orgProfilePanel={panels.orgProfilePanel}
        appsPanel={{
          ...panels.appsPanel,
          apps: organizationApps,
          loading: organizationAppsLoading,
          error: organizationAppsError,
          onReload: reloadOrganizationApps,
        }}
        coursesPanel={panels.coursesPanel}
        linksPanel={panels.linksPanel}
        complaintsPanel={panels.complaintsPanel}
        organizationsPanel={panels.organizationsPanel}
      />
    </View>
  );
}
