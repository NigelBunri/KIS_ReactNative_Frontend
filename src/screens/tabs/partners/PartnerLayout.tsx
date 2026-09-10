import React from 'react';
import { View } from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import styles from '@/components/partners/partnersStyles';
import PartnersLeftRail from '@/components/partners/PartnersLeftRail';
import PartnersCenterPane from '@/components/partners/PartnersCenterPane';
import PartnerPanels from './PartnerPanels';
import { DetachedPartnersOverlayBridge } from '@/contexts/DetachedPartnersOverlayContext';
import { useKISTheme } from '@/theme/useTheme';
import { useStatusBarStyle } from '@/theme/useStatusBarStyle';
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
  isMessagesPaneOnTop: boolean;
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
  // Whether the Partners tab is the currently-focused screen. The detached
  // overlay bridge below is only mounted while true - see the comment at
  // its render site for why this is required, not optional.
  isFocused: boolean;
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
  isMessagesPaneOnTop,
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
  isFocused,
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
  // it renders as a genuine top-level sibling (see
  // DetachedPartnersOverlayContext.tsx) so it can fully cover the Golden
  // Section + tab bar once actually open, exactly as requested. It is always
  // full-height (top:0/bottom:0, matching the open state exactly) — the
  // Golden Section and tab bar naturally paint over the peek sliver's ends
  // while closed because PartnersMessagesPane's own zIndex drops below both
  // of theirs in that state (see the zIndex swap in PartnersMessagesPane.tsx
  // itself), and rises above both once opened. No separate top/bottom inset
  // math is needed — a stacking-order swap instead of a size change, so
  // there's nothing here that needs to track the Golden Section's live
  // (Reanimated-driven, collapsible) height or the tab bar's own height
  // formula.
  //
  // This is a single, permanently-stable render location (matching the
  // proven chat-overlay Bridge/Outlet pattern exactly — it always bridges,
  // never conditionally un-bridges): an earlier attempt conditionally
  // switched between rendering the pane inline vs. via the detached bridge
  // based on isMessagesExpanded, which broke the close animation — the
  // remount happened while the closing spring animation (useNativeDriver:
  // true) was still in flight, and destroying/recreating the native view
  // mid-animation desynced it from messagesOffsetAnim, leaving the pane
  // visually stuck partway closed until the user manually dragged it the
  // rest of the way.

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
          App.tsx (see DetachedPartnersOverlayContext.tsx) WHILE THE PARTNERS
          TAB IS FOCUSED - "always bridged, never conditionally unbridged"
          only within a single focus session, not across the tab's entire
          mounted lifetime. Bottom `Tabs.Navigator` has no unmountOnBlur, so
          PartnerLayout itself keeps living after the user switches tabs;
          without this isFocused gate, the Bridge's setProps(...) effect
          kept re-firing on every re-render regardless of which tab was
          actually showing, and the Outlet (App.tsx) had no way to know it
          should stop painting - the peek sliver (and, if left open, the
          full pane) would visibly leak onto every other tab in the app.
          Unmounting the Bridge on blur reuses its EXISTING cleanup
          (setProps(null) in its own effect return, see
          DetachedPartnersOverlayContext.tsx) rather than adding new
          clear-on-blur logic - remounting on refocus is cheap and correct
          since all the real state (isMessagesExpanded, offsets, etc.) lives
          in PartnersScreen's hooks, not in this bridge.
          This does NOT reintroduce the old mid-animation-remount bug: that
          bug was about remounting while the CLOSE SPRING was still running
          on THIS tab (a user-visible glitch); unmounting because the user
          navigated to a completely different tab is a different, legitimate
          case where an instant disappearance is exactly what's wanted, not
          a regression - see PartnersScreen.tsx's blur handler, which also
          snaps (non-animated) the pane/sheet closed and restores the tab
          bar the instant focus is lost, precisely so nothing is mid-flight
          when this unmount happens. */}
      {isFocused && (
      <DetachedPartnersOverlayBridge
        messagesPaneProps={{
          width,
          messagesOffsetAnim,
          messagePanHandlers,
          isMessagesPaneOnTop,
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
      )}

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
