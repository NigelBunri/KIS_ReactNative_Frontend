// src/screens/tabs/PartnersScreen.tsx
import React, { useCallback, useEffect } from 'react';
import { Alert, Animated, DeviceEventEmitter, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useResponsiveLayout } from '@/theme/responsive';
import { useKISTheme } from '@/theme/useTheme';
import { useContextPanelContent, TabletCard } from '@/components/shell';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../../App';
import PartnerLayout from './partners/PartnerLayout';
import { normalizePartnerRole } from '@/components/partners/settings/partnerSettingsData';
import { usePartnerSettingsCatalog } from '@/components/partners/settings/usePartnerSettingsCatalog';
import { useMessagesPane } from './partners/useMessagesPane';
import { usePartnerSheet } from './partners/usePartnerSheet';
import { usePartnersData } from './partners/usePartnersData';
import { usePartnerSettingsPanel } from './partners/usePartnerSettingsPanel';
import { usePartnerCreatePanel } from './partners/usePartnerCreatePanel';
import { usePartnerDiscoveryPanel } from './partners/usePartnerDiscoveryPanel';
import { usePartnerRecruitmentPanel } from './partners/usePartnerRecruitmentPanel';
import { usePartnerAuditPanel } from './partners/usePartnerAuditPanel';
import { usePartnerPolicyPanel } from './partners/usePartnerPolicyPanel';
import { usePartnerIntegrationsPanel } from './partners/usePartnerIntegrationsPanel';
import { usePartnerAutomationPanel } from './partners/usePartnerAutomationPanel';
import { usePartnerReportsPanel } from './partners/usePartnerReportsPanel';
import { usePartnerNavigationActions } from './partners/usePartnerNavigationActions';
import { usePartnerGovernancePanel } from './partners/usePartnerGovernancePanel';
import { usePartnerMembersPanel } from './partners/usePartnerMembersPanel';
import { usePartnerRolesPanel } from './partners/usePartnerRolesPanel';
import { usePartnerChannelsPanel } from './partners/usePartnerChannelsPanel';
import { usePartnerTasksPanel } from './partners/usePartnerTasksPanel';
import { usePartnerTaskBoardsPanel } from './partners/usePartnerTaskBoardsPanel';
import { usePartnerOrgStructurePanel } from './partners/usePartnerOrgStructurePanel';
import { usePartnerMembershipRulesPanel } from './partners/usePartnerMembershipRulesPanel';
import { usePartnerSpacesDirectoryPanel } from './partners/usePartnerSpacesDirectoryPanel';
import { usePartnerAnalyticsPanel } from './partners/usePartnerAnalyticsPanel';
import { usePartnerLeadershipPanel } from './partners/usePartnerLeadershipPanel';
import { usePartnerResourcesPanel } from './partners/usePartnerResourcesPanel';
import { usePartnerTrainingTracksPanel } from './partners/usePartnerTrainingTracksPanel';
import { usePartnerEventsCalendarPanel } from './partners/usePartnerEventsCalendarPanel';
import { usePartnerBroadcastCenterPanel } from './partners/usePartnerBroadcastCenterPanel';
import { usePartnerSupportInboxPanel } from './partners/usePartnerSupportInboxPanel';
import { usePartnerPostTemplatesPanel } from './partners/usePartnerPostTemplatesPanel';
import { usePartnerSurveysPanel } from './partners/usePartnerSurveysPanel';
import { usePartnerBudgetTrackingPanel } from './partners/usePartnerBudgetTrackingPanel';
import { usePartnerVolunteerRosterPanel } from './partners/usePartnerVolunteerRosterPanel';
import { usePartnerDonationTrackingPanel } from './partners/usePartnerDonationTrackingPanel';
import { usePartnerWorkspaceBrandingPanel } from './partners/usePartnerWorkspaceBrandingPanel';
import { usePartnerVerificationPanel } from './partners/usePartnerVerificationPanel';
import { usePartnerPanelOpeners } from './partners/usePartnerPanelOpeners';
import { usePartnerFeaturePanel } from './partners/usePartnerFeaturePanel';
import { usePartnerOrgProfilePanel } from './partners/usePartnerOrgProfilePanel';
import { usePartnerOrganizationAppsPanel } from './partners/usePartnerOrganizationAppsPanel';
import { usePartnerScreenActions } from './partners/usePartnerScreenActions';
import { usePartnerCoursesPanel } from './partners/usePartnerCoursesPanel';
import { usePartnerLinksPanel } from './partners/usePartnerLinksPanel';
import { usePartnerComplaintsPanel } from './partners/usePartnerComplaintsPanel';
import usePartnerProfileLinks from './partners/usePartnerProfileLinks';
import { usePartnerOrganizationsPanel } from './partners/usePartnerOrganizationsPanel';
import usePartnerOrganizations from './partners/usePartnerOrganizations';
import { PartnerOrganizationAppsProvider } from '@/context/partners/PartnerOrganizationAppsContext';
import { useAdminDashboardPanel } from './partners/useAdminDashboardPanel';
import { useAdminUsersPanel } from './partners/useAdminUsersPanel';
import { useAdminContentPanel } from './partners/useAdminContentPanel';
import { useAdminAnalyticsPanel } from './partners/useAdminAnalyticsPanel';
import { useAdminPartnersPanel } from './partners/useAdminPartnersPanel';
import { useAdminVerificationPanel } from './partners/useAdminVerificationPanel';
import { useAdminSystemHealthPanel } from './partners/useAdminSystemHealthPanel';
import { useAdminAuditTrailPanel } from './partners/useAdminAuditTrailPanel';
import { useAppBuilderPanel } from './partners/useAppBuilderPanel';
import { useGeolocationPanel } from './partners/useGeolocationPanel';
import AdminDashboardPanel from '@/components/partners/AdminDashboardPanel';
import AdminUsersPanel from '@/components/partners/AdminUsersPanel';
import AdminContentPanel from '@/components/partners/AdminContentPanel';
import AdminAnalyticsPanel from '@/components/partners/AdminAnalyticsPanel';
import AdminPartnersPanel from '@/components/partners/AdminPartnersPanel';
import AdminVerificationPanel from '@/components/partners/AdminVerificationPanel';
import AdminSystemHealthPanel from '@/components/partners/AdminSystemHealthPanel';
import AdminAuditTrailPanel from '@/components/partners/AdminAuditTrailPanel';
import AdminBiblePanel from '@/components/partners/AdminBiblePanel';
import AdminKISAppPanel from '@/components/partners/AdminKISAppPanel';
import AppBuilderPanel from '@/components/partners/AppBuilderPanel';
import GeolocationPanel from '@/components/partners/GeolocationPanel';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import {
  getCurrentAuthUserId,
  readScopedProfileCache,
  writeScopedProfileCache,
} from '@/storage/userScopedProfileCache';


export default function PartnersScreen({ setHidNav, onOpenInfo }: any) {
  const navigation = useNavigation<any>();
  const { setAuth, user } = useAuth();
  const currentUserId = user?.id ?? null;
  const { width, height } = useWindowDimensions();
  // Slide-over panels below must size themselves off the width actually
  // available inside the tablet/desktop shell's content column, not the raw
  // device width — TabletLayout's mainColumn clips (overflow: hidden) once
  // the Sidebar/ContextPanel are reserved, so a panel sized from `width`
  // renders wider than that column and its left portion (often exactly
  // where a panel's filter row sits, right under its search bar) gets cut
  // off. `width` itself is kept for the few consumers below that
  // deliberately need the true device width (e.g. useMessagesPane's
  // right-peek offset).
  const { pageGutter, shellContentWidth } = useResponsiveLayout();
  const [isSuperuser, setIsSuperuser] = React.useState(false);
  const isGoUser = React.useCallback((user: any) => {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role: any) => String(role).toLowerCase()) : [];
    const roleText = String(user?.role ?? user?.account_role ?? user?.user_role ?? '').toLowerCase();
    return Boolean(
      user?.is_superuser ||
        user?.is_staff ||
        user?.is_admin ||
        user?.is_go ||
        user?.isGo ||
        user?.is_global_owner ||
        user?.isGlobalOwner ||
        user?.is_platform_owner ||
        roles.includes('go') ||
        roles.includes('owner') ||
        roles.includes('superuser') ||
        roleText === 'go' ||
        roleText === 'owner',
    );
  }, []);
  const checkSuperuser = React.useCallback(() => {
    let cacheMatched = false;
    readScopedProfileCache()
      .then(async raw => {
        if (raw) {
          cacheMatched = true;
          const payload = JSON.parse(raw);
          const user = payload?.user ?? payload?.profile?.user;
          setIsSuperuser(isGoUser(user));
        }
        const authUserId = await getCurrentAuthUserId();
        const res = await getRequest(ROUTES.profiles.me, {
          cacheKey: `partners_profile_role_check_v1:${authUserId ?? 'unknown'}`,
          staleWhileRevalidate: true,
          errorMessage: 'Unable to confirm partner access.',
        }).catch(() => null);
        if (res?.success && res.data) {
          await writeScopedProfileCache(res.data);
          const user = res.data?.user ?? res.data?.profile?.user;
          setIsSuperuser(isGoUser(user));
        } else if (!cacheMatched) {
          setIsSuperuser(false);
        }
      })
      .catch(() => {});
  }, [isGoUser]);
  React.useEffect(() => { checkSuperuser(); }, [checkSuperuser]);
  useFocusEffect(checkSuperuser);
  const rootNavigation = navigation.getParent?.() as
    | NativeStackNavigationProp<RootStackParamList>
    | undefined;
  const openInsights = useCallback(() => {
    rootNavigation?.navigate('PartnerInsights');
  }, [rootNavigation]);

  // 🔽 When leaving PartnersScreen, always restore the tab bar
  useFocusEffect(
    useCallback(() => {
      return () => {
        const parent = navigation.getParent();
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation]),
  );
  const {
    partners,
    partnersLoading,
    selectedPartner,
    selectedPartnerId,
    setSelectedPartnerId,
    selectedGroupId,
    setSelectedGroupId,
    selectedChannelId,
    setSelectedChannelId,
    selectedFeed,
    setSelectedFeed,
    selectedCommunityFeedId,
    setSelectedCommunityFeedId,
    expandedCommunities,
    toggleCommunity,
    rootGroups,
    rootChannels,
    groupsForPartner,
    channelsForPartner,
    communitiesForPartner,
    handlePartnerItemCreated,
    reloadPartners,
    reloadSelectedPartner,
  } = usePartnersData(isSuperuser);

  // Tablet-shell right-hand Context Panel — built from usePartnersData()'s
  // already-fetched state (no new fetches) plus the existing openInsights
  // navigation action. "Recent activity" from the reference mockup is
  // omitted: no activity-feed data source exists on this screen today.
  const { palette: partnersContextPalette } = useKISTheme();
  useContextPanelContent(
    <>
      <TabletCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KISIcon name="poll" size={18} color={partnersContextPalette.goldReadable} />
          <Text style={{ fontSize: 15, fontWeight: '800', color: partnersContextPalette.text }}>Partner Insights</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: partnersContextPalette.subtext, marginTop: 6 }}>
          See performance across all your partner workspaces.
        </Text>
        <Pressable onPress={openInsights} style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: partnersContextPalette.goldReadable }}>Open insights ›</Text>
        </Pressable>
      </TabletCard>

      <TabletCard>
        <Text style={{ fontSize: 15, fontWeight: '800', color: partnersContextPalette.text }}>Workspace</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {[
            { label: 'Partners', value: partners?.length },
            { label: 'Groups', value: groupsForPartner?.length },
            { label: 'Channels', value: channelsForPartner?.length },
            { label: 'Communities', value: communitiesForPartner?.length },
          ].filter((row) => typeof row.value === 'number').map((row) => (
            <View key={row.label} style={{ minWidth: '45%', borderRadius: 14, padding: 10, backgroundColor: partnersContextPalette.selectedBg }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: partnersContextPalette.text }}>{row.value}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: partnersContextPalette.subtext }}>{row.label}</Text>
            </View>
          ))}
        </View>
      </TabletCard>
    </>,
  );
  const {
    links,
    loading: linksLoading,
    error: linksError,
    toggleLink,
    setRole,
    refresh: refreshLinks,
  } = usePartnerProfileLinks(selectedPartner?.id);
  const {
    organizations,
    linkable: linkableOrganizations,
    loading: organizationsLoading,
    error: organizationsError,
    refresh: refreshOrganizations,
    linkOrganization,
    unlinkOrganization,
  } = usePartnerOrganizations(selectedPartner?.id);
  const partnerRole = normalizePartnerRole(
    selectedPartner?.role ??
      selectedPartner?.member_role ??
      selectedPartner?.access_level,
    'member',
  );
  const isSelectedKCAN =
    selectedPartner?.slug?.toLowerCase() === 'kcan' ||
    selectedPartner?.name?.toLowerCase() === 'kcan' ||
    selectedPartner?.name?.toLowerCase().includes('kingdom citizens') ||
    selectedPartner?.name?.toLowerCase().includes('kingdom impact') ||
    (isSuperuser && !selectedPartner);
  const superadminRoleOverride =
    isSuperuser && isSelectedKCAN ? ('owner' as const) : undefined;
  const { sections: settingsSections, role: settingsRole } =
    usePartnerSettingsCatalog(
      selectedPartner?.id,
      partnerRole,
      superadminRoleOverride,
    );
  const canManageOrganizationApps = ['owner', 'admin', 'manager'].includes(
    settingsRole,
  );
  const {
    messagesOffsetAnim,
    isMessagesExpanded,
    toggleMessagesPane,
    closeMessagesPane,
    openMessagesPane,
    panHandlers,
    messagePanHandlers,
  } = useMessagesPane(width, setHidNav);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'partner.open',
      (payload: any) => {
        const partnerId = String(payload?.partnerId ?? '');
        if (!partnerId) return;
        setSelectedPartnerId(partnerId);
        setSelectedGroupId(null);
        setSelectedChannelId(null);
        setSelectedFeed((payload?.feed ?? 'general') as any);
        setSelectedCommunityFeedId(null);
        openMessagesPane();
      },
    );
    return () => sub.remove();
  }, [
    openMessagesPane,
    setSelectedChannelId,
    setSelectedCommunityFeedId,
    setSelectedFeed,
    setSelectedGroupId,
    setSelectedPartnerId,
  ]);
  const {
    isPartnerSheetOpen,
    sheetHeight,
    sheetOffsetAnim,
    overlayOpacity,
    sheetPanHandlers,
    animatePartnerSheet,
  } = usePartnerSheet(height);
  const {
    panelWidth,
    panelTranslateX,
    activeSection,
    isOpen: isSettingsPanelOpen,
    openSection,
    closePanel,
  } = usePartnerSettingsPanel(shellContentWidth, settingsSections);
  const {
    panelWidth: createPanelWidth,
    panelTranslateX: createPanelTranslateX,
    kind: createKind,
    isOpen: isCreatePanelOpen,
    open: openCreatePanel,
    close: closeCreatePanel,
  } = usePartnerCreatePanel(shellContentWidth);
  const {
    panelWidth: discoverPanelWidth,
    panelTranslateX: discoverPanelTranslateX,
    isOpen: isDiscoverPanelOpen,
    open: openDiscoverPanel,
    close: closeDiscoverPanel,
  } = usePartnerDiscoveryPanel(shellContentWidth);
  const {
    panelWidth: recruitmentPanelWidth,
    panelTranslateX: recruitmentPanelTranslateX,
    isOpen: isRecruitmentPanelOpen,
    open: openRecruitmentPanel,
    close: closeRecruitmentPanel,
  } = usePartnerRecruitmentPanel(shellContentWidth);
  const {
    panelWidth: auditPanelWidth,
    panelTranslateX: auditPanelTranslateX,
    isOpen: isAuditPanelOpen,
    open: openAuditPanel,
    close: closeAuditPanel,
  } = usePartnerAuditPanel(shellContentWidth);
  const {
    panelWidth: policyPanelWidth,
    panelTranslateX: policyPanelTranslateX,
    isOpen: isPolicyPanelOpen,
    open: openPolicyPanel,
    close: closePolicyPanel,
  } = usePartnerPolicyPanel(shellContentWidth);
  const {
    panelWidth: integrationsPanelWidth,
    panelTranslateX: integrationsPanelTranslateX,
    isOpen: isIntegrationsPanelOpen,
    open: openIntegrationsPanel,
    close: closeIntegrationsPanel,
  } = usePartnerIntegrationsPanel(shellContentWidth);
  const {
    panelWidth: automationPanelWidth,
    panelTranslateX: automationPanelTranslateX,
    isOpen: isAutomationPanelOpen,
    open: openAutomationPanel,
    close: closeAutomationPanel,
  } = usePartnerAutomationPanel(shellContentWidth);
  const {
    panelWidth: reportsPanelWidth,
    panelTranslateX: reportsPanelTranslateX,
    isOpen: isReportsPanelOpen,
    open: openReportsPanel,
    close: closeReportsPanel,
  } = usePartnerReportsPanel(shellContentWidth);
  const {
    panelWidth: governancePanelWidth,
    panelTranslateX: governancePanelTranslateX,
    isOpen: isGovernancePanelOpen,
    open: openGovernancePanel,
    close: closeGovernancePanel,
  } = usePartnerGovernancePanel(shellContentWidth);
  const {
    panelWidth: membersPanelWidth,
    panelTranslateX: membersPanelTranslateX,
    isOpen: isMembersPanelOpen,
    open: openMembersPanel,
    close: closeMembersPanel,
  } = usePartnerMembersPanel(shellContentWidth);
  const {
    panelWidth: rolesPanelWidth,
    panelTranslateX: rolesPanelTranslateX,
    isOpen: isRolesPanelOpen,
    open: openRolesPanel,
    close: closeRolesPanel,
  } = usePartnerRolesPanel(shellContentWidth);
  const {
    panelWidth: channelsPanelWidth,
    panelTranslateX: channelsPanelTranslateX,
    isOpen: isChannelsPanelOpen,
    open: openChannelsPanel,
    close: closeChannelsPanel,
  } = usePartnerChannelsPanel(shellContentWidth);
  const {
    panelWidth: tasksPanelWidth,
    panelTranslateX: tasksPanelTranslateX,
    isOpen: isTasksPanelOpen,
    open: openTasksPanel,
    close: closeTasksPanel,
  } = usePartnerTasksPanel(shellContentWidth);
  const {
    panelWidth: taskBoardsPanelWidth,
    panelTranslateX: taskBoardsPanelTranslateX,
    isOpen: isTaskBoardsPanelOpen,
    open: openTaskBoardsPanel,
    close: closeTaskBoardsPanel,
  } = usePartnerTaskBoardsPanel(shellContentWidth);
  const {
    panelWidth: orgStructurePanelWidth,
    panelTranslateX: orgStructurePanelTranslateX,
    isOpen: isOrgStructurePanelOpen,
    open: openOrgStructurePanel,
    close: closeOrgStructurePanel,
  } = usePartnerOrgStructurePanel(shellContentWidth);
  const {
    panelWidth: membershipRulesPanelWidth,
    panelTranslateX: membershipRulesPanelTranslateX,
    isOpen: isMembershipRulesPanelOpen,
    open: openMembershipRulesPanel,
    close: closeMembershipRulesPanel,
  } = usePartnerMembershipRulesPanel(shellContentWidth);
  const {
    panelWidth: spacesDirectoryPanelWidth,
    panelTranslateX: spacesDirectoryPanelTranslateX,
    isOpen: isSpacesDirectoryPanelOpen,
    open: openSpacesDirectoryPanel,
    close: closeSpacesDirectoryPanel,
  } = usePartnerSpacesDirectoryPanel(shellContentWidth);
  const {
    panelWidth: analyticsPanelWidth,
    panelTranslateX: analyticsPanelTranslateX,
    isOpen: isAnalyticsPanelOpen,
    open: openAnalyticsPanel,
    close: closeAnalyticsPanel,
  } = usePartnerAnalyticsPanel(shellContentWidth);
  const {
    panelWidth: leadershipPanelWidth,
    panelTranslateX: leadershipPanelTranslateX,
    isOpen: isLeadershipPanelOpen,
    open: openLeadershipPanel,
    close: closeLeadershipPanel,
  } = usePartnerLeadershipPanel(shellContentWidth);
  const {
    panelWidth: resourcesPanelWidth,
    panelTranslateX: resourcesPanelTranslateX,
    isOpen: isResourcesPanelOpen,
    open: openResourcesPanel,
    close: closeResourcesPanel,
  } = usePartnerResourcesPanel(shellContentWidth);
  const {
    panelWidth: trainingTracksPanelWidth,
    panelTranslateX: trainingTracksPanelTranslateX,
    isOpen: isTrainingTracksPanelOpen,
    open: openTrainingTracksPanel,
    close: closeTrainingTracksPanel,
  } = usePartnerTrainingTracksPanel(shellContentWidth);
  const {
    panelWidth: eventsCalendarPanelWidth,
    panelTranslateX: eventsCalendarPanelTranslateX,
    isOpen: isEventsCalendarPanelOpen,
    open: openEventsCalendarPanel,
    close: closeEventsCalendarPanel,
  } = usePartnerEventsCalendarPanel(shellContentWidth);
  const {
    panelWidth: broadcastCenterPanelWidth,
    panelTranslateX: broadcastCenterPanelTranslateX,
    isOpen: isBroadcastCenterPanelOpen,
    open: openBroadcastCenterPanel,
    close: closeBroadcastCenterPanel,
  } = usePartnerBroadcastCenterPanel(shellContentWidth);
  const {
    panelWidth: supportInboxPanelWidth,
    panelTranslateX: supportInboxPanelTranslateX,
    isOpen: isSupportInboxPanelOpen,
    open: openSupportInboxPanel,
    close: closeSupportInboxPanel,
  } = usePartnerSupportInboxPanel(shellContentWidth);
  const {
    panelWidth: postTemplatesPanelWidth,
    panelTranslateX: postTemplatesPanelTranslateX,
    isOpen: isPostTemplatesPanelOpen,
    open: openPostTemplatesPanel,
    close: closePostTemplatesPanel,
  } = usePartnerPostTemplatesPanel(shellContentWidth);
  const {
    panelWidth: surveysPanelWidth,
    panelTranslateX: surveysPanelTranslateX,
    isOpen: isSurveysPanelOpen,
    open: openSurveysPanel,
    close: closeSurveysPanel,
  } = usePartnerSurveysPanel(shellContentWidth);
  const {
    panelWidth: budgetTrackingPanelWidth,
    panelTranslateX: budgetTrackingPanelTranslateX,
    isOpen: isBudgetTrackingPanelOpen,
    open: openBudgetTrackingPanel,
    close: closeBudgetTrackingPanel,
  } = usePartnerBudgetTrackingPanel(shellContentWidth);
  const {
    panelWidth: volunteerRosterPanelWidth,
    panelTranslateX: volunteerRosterPanelTranslateX,
    isOpen: isVolunteerRosterPanelOpen,
    open: openVolunteerRosterPanel,
    close: closeVolunteerRosterPanel,
  } = usePartnerVolunteerRosterPanel(shellContentWidth);
  const {
    panelWidth: donationTrackingPanelWidth,
    panelTranslateX: donationTrackingPanelTranslateX,
    isOpen: isDonationTrackingPanelOpen,
    open: openDonationTrackingPanel,
    close: closeDonationTrackingPanel,
  } = usePartnerDonationTrackingPanel(shellContentWidth);
  const {
    panelWidth: workspaceBrandingPanelWidth,
    panelTranslateX: workspaceBrandingPanelTranslateX,
    isOpen: isWorkspaceBrandingPanelOpen,
    open: openWorkspaceBrandingPanel,
    close: closeWorkspaceBrandingPanel,
  } = usePartnerWorkspaceBrandingPanel(shellContentWidth);
  const {
    panelWidth: verificationPanelWidth,
    panelTranslateX: verificationPanelTranslateX,
    isOpen: isVerificationPanelOpen,
    open: openVerificationPanel,
    close: closeVerificationPanel,
  } = usePartnerVerificationPanel(shellContentWidth);
  const [membersPanelInitialTab, setMembersPanelInitialTab] = React.useState<'members' | 'log'>('members');
  const {
    panelWidth: featurePanelWidth,
    panelTranslateX: featurePanelTranslateX,
    isOpen: isFeaturePanelOpen,
    feature: activeFeature,
    open: openFeaturePanel,
    close: closeFeaturePanel,
  } = usePartnerFeaturePanel(shellContentWidth);

  const {
    panelWidth: orgProfilePanelWidth,
    panelTranslateX: orgProfilePanelTranslateX,
    isOpen: isOrgProfilePanelOpen,
    open: openOrgProfilePanel,
    close: closeOrgProfilePanel,
  } = usePartnerOrgProfilePanel(shellContentWidth);
  const {
    panelWidth: orgAppsPanelWidth,
    panelTranslateX: orgAppsPanelTranslateX,
    isOpen: isOrgAppsPanelOpen,
    open: openOrgAppsPanel,
    close: closeOrgAppsPanel,
  } = usePartnerOrganizationAppsPanel(shellContentWidth);
  const {
    panelWidth: coursesPanelWidth,
    panelTranslateX: coursesPanelTranslateX,
    isOpen: isCoursesPanelOpen,
    open: openCoursesPanel,
    close: closeCoursesPanel,
  } = usePartnerCoursesPanel(shellContentWidth);
  const {
    panelWidth: linksPanelWidth,
    panelTranslateX: linksPanelTranslateX,
    isOpen: isLinksPanelOpen,
    open: openLinksPanel,
    close: closeLinksPanel,
  } = usePartnerLinksPanel(shellContentWidth);
  const complaintsPanel = usePartnerComplaintsPanel(shellContentWidth);
  const {
    panelWidth: organizationsPanelWidth,
    panelTranslateX: organizationsPanelTranslateX,
    isOpen: isOrganizationsPanelOpen,
    open: openOrganizationsPanel,
    close: closeOrganizationsPanel,
  } = usePartnerOrganizationsPanel(shellContentWidth);

  // ── KCAN Admin Panels (superuser / GO only) ──────────────────────────────
  // isKcanAdmin: true if superuser flag is confirmed OR if the backend already
  // returned member_role='owner' on KCAN (which only happens for superusers/staff).
  const isKcanAdmin =
    isSelectedKCAN &&
    (isSuperuser || selectedPartner?.member_role === 'owner');
  const adminDashboard = useAdminDashboardPanel(shellContentWidth);
  const adminUsers = useAdminUsersPanel(shellContentWidth);
  const adminContent = useAdminContentPanel(shellContentWidth);
  const adminAnalytics = useAdminAnalyticsPanel(shellContentWidth);
  const adminPartners = useAdminPartnersPanel(shellContentWidth);
  const adminVerification = useAdminVerificationPanel(shellContentWidth);
  const adminSystemHealth = useAdminSystemHealthPanel(shellContentWidth);
  const adminAuditTrail = useAdminAuditTrailPanel(shellContentWidth);

  // Bible App Admin and KIS App Admin panels (simple open/close with animation)
  const adminPanelWidth = React.useMemo(
    () =>
      shellContentWidth < 600
        ? shellContentWidth
        : Math.min(900, Math.max(600, Math.round(shellContentWidth * 0.85))),
    [shellContentWidth],
  );
  const [adminBibleOpen, setAdminBibleOpen] = React.useState(false);
  const adminBibleTranslateX = React.useRef(new Animated.Value(adminPanelWidth)).current;
  const openAdminBible = React.useCallback(() => {
    setAdminBibleOpen(true);
    requestAnimationFrame(() => {
      adminBibleTranslateX.setValue(adminPanelWidth);
      Animated.timing(adminBibleTranslateX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    });
  }, [adminBibleTranslateX, adminPanelWidth]);
  const closeAdminBible = React.useCallback(() => {
    Animated.timing(adminBibleTranslateX, { toValue: adminPanelWidth, duration: 220, useNativeDriver: true }).start(() => setAdminBibleOpen(false));
  }, [adminBibleTranslateX, adminPanelWidth]);

  const [adminKISAppOpen, setAdminKISAppOpen] = React.useState(false);
  const adminKISAppTranslateX = React.useRef(new Animated.Value(adminPanelWidth)).current;
  const openAdminKISApp = React.useCallback(() => {
    setAdminKISAppOpen(true);
    requestAnimationFrame(() => {
      adminKISAppTranslateX.setValue(adminPanelWidth);
      Animated.timing(adminKISAppTranslateX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    });
  }, [adminKISAppTranslateX, adminPanelWidth]);
  const closeAdminKISApp = React.useCallback(() => {
    Animated.timing(adminKISAppTranslateX, { toValue: adminPanelWidth, duration: 220, useNativeDriver: true }).start(() => setAdminKISAppOpen(false));
  }, [adminKISAppTranslateX, adminPanelWidth]);

  // ── App Builder (Partner Pro) ─────────────────────────────────────────────
  const appBuilderPanel = useAppBuilderPanel(shellContentWidth);
  const handleOpenAppBuilder = useCallback(() => {
    closePanel();
    setTimeout(() => appBuilderPanel.open(), 240);
  }, [closePanel, appBuilderPanel]);

  // ── Geolocation & Attendance (Partner Pro) ────────────────────────────────
  const geolocationPanel = useGeolocationPanel(shellContentWidth);
  const handleOpenGeolocation = useCallback(() => {
    closePanel();
    setTimeout(() => geolocationPanel.open(), 240);
  }, [closePanel, geolocationPanel]);

  const { onGroupPress, onFeedPress, onCommunityFeedPress, onChannelPress } =
    usePartnerNavigationActions({
      selectedPartner: selectedPartner as any,
      isMessagesExpanded,
      setSelectedGroupId,
      setSelectedChannelId,
      setSelectedFeed: (value: string | null) => setSelectedFeed(value as any),
      setSelectedCommunityFeedId,
      openMessagesPane,
    });
  const {
    handleOpenRecruitment,
    handleOpenAudit,
    handleOpenPolicy,
    handleOpenIntegrations,
    handleOpenAutomation,
    handleOpenReports,
    handleOpenGovernance,
    handleOpenComplaints,
    handleOpenMembers,
    handleOpenModerationLog,
    handleOpenRoles,
    handleOpenChannels,
    handleOpenVerification,
  } = usePartnerPanelOpeners({
    closePanel,
    openRecruitment: openRecruitmentPanel,
    openAudit: openAuditPanel,
    openPolicy: openPolicyPanel,
    openIntegrations: openIntegrationsPanel,
    openAutomation: openAutomationPanel,
    openReports: openReportsPanel,
    openGovernance: openGovernancePanel,
    openComplaints: complaintsPanel.open,
    openMembers: openMembersPanel,
    openRoles: openRolesPanel,
    openChannels: openChannelsPanel,
    openVerification: openVerificationPanel,
    setMembersPanelInitialTab,
  });

  const handleOpenOrganizationApps = useCallback(() => {
    closePanel();
    setTimeout(() => {
      openOrgAppsPanel();
    }, 240);
  }, [closePanel, openOrgAppsPanel]);

  const handleOpenFeature = (feature: {
    key: string;
    title: string;
    description?: string;
  }) => {
    closePanel();
    if (
      [
        'course_builder',
        'lesson_library',
        'course_pricing',
        'course_enrollments',
      ].includes(feature.key)
    ) {
      openCoursesPanel();
      return;
    }
    if (['org_apps_catalog', 'org_apps_bible'].includes(feature.key)) {
      handleOpenOrganizationApps();
      return;
    }
    if (feature.key === 'org_apps_builder') {
      handleOpenAppBuilder();
      return;
    }
    if (['location_events', 'location_attendance_report', 'location_consent_settings'].includes(feature.key)) {
      handleOpenGeolocation();
      return;
    }
    if (feature.key === 'create_community') {
      onOpenCreate('community');
      return;
    }
    if (feature.key === 'create_group') {
      onOpenCreate('group');
      return;
    }
    if (feature.key === 'task_boards') {
      openTaskBoardsPanel();
      return;
    }
    if (['units_departments', 'org_locations'].includes(feature.key)) {
      openOrgStructurePanel();
      return;
    }
    if (feature.key === 'content_rules') {
      handleOpenPolicy();
      return;
    }
    if (feature.key === 'membership_rules') {
      openMembershipRulesPanel();
      return;
    }
    if (feature.key === 'spaces_directory') {
      openSpacesDirectoryPanel();
      return;
    }
    if ([
      'engagement_overview', 'reaction_trends', 'top_contributors', 'growth_funnel',
      'content_performance', 'channel_health', 'community_heatmap', 'participation_depth',
      'sentiment_snapshot', 'message_velocity', 'retention', 'campaign_tracking',
      'response_times', 'event_uptake', 'resource_downloads',
    ].includes(feature.key)) {
      openAnalyticsPanel();
      return;
    }
    if ([
      'org_tree_view', 'leadership_roles', 'succession_plan', 'team_health',
      'leadership_directory', 'mentorship_routes', 'skills_matrix', 'capacity_planning',
      'role_alignment', 'org_announcements', 'org_tree_notes', 'role_requirements',
      'onboarding_paths', 'leadership_goals', 'cross_team_projects', 'reporting_lines',
      'span_of_control', 'diversity_dashboard', 'conflict_resolution', 'leadership_scorecards',
    ].includes(feature.key)) {
      if (feature.key === 'leadership_roles') {
        handleOpenRoles();
        return;
      }
      openLeadershipPanel();
      return;
    }
    if (['resource_library', 'knowledge_base'].includes(feature.key)) {
      openResourcesPanel();
      return;
    }
    if (feature.key === 'training_tracks') {
      openTrainingTracksPanel();
      return;
    }
    if (feature.key === 'events_calendar') {
      openEventsCalendarPanel();
      return;
    }
    if (['broadcast_center', 'announcement_scheduler'].includes(feature.key)) {
      openBroadcastCenterPanel();
      return;
    }
    if (['support_inbox', 'helpdesk'].includes(feature.key)) {
      openSupportInboxPanel();
      return;
    }
    if (feature.key === 'templates') {
      openPostTemplatesPanel();
      return;
    }
    if (['feedback_hub', 'surveys'].includes(feature.key)) {
      openSurveysPanel();
      return;
    }
    if (feature.key === 'budget_tracking') {
      openBudgetTrackingPanel();
      return;
    }
    if (feature.key === 'volunteer_roster') {
      openVolunteerRosterPanel();
      return;
    }
    if (feature.key === 'donation_tracking') {
      openDonationTrackingPanel();
      return;
    }
    if (feature.key === 'workspace_branding') {
      openWorkspaceBrandingPanel();
      return;
    }
    openFeaturePanel(feature);
  };

  const handleLaunchOrganizationApp = useCallback(
    (app: PartnerOrganizationApp) => {
      closeOrgAppsPanel();
      rootNavigation?.navigate('OrganizationApp', {
        app,
        partnerName: selectedPartner?.name,
        canManage: canManageOrganizationApps,
      });
    },
    [closeOrgAppsPanel, rootNavigation, selectedPartner?.name, canManageOrganizationApps],
  );

  const handleOpenOrgProfile = () => {
    closePanel();
    setTimeout(() => {
      openOrgProfilePanel();
    }, 240);
  };

  const handleOpenPartnerInfo = useCallback(() => {
    const activePartnerId = String(selectedPartner?.id || '');
    if (!activePartnerId) {
      // No partner selected — nothing to show info/landing-page-builder for.
      return;
    }
    Alert.alert('Partner actions', 'Choose what to open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open info',
        onPress: () => openOrgProfilePanel(),
      },
      {
        text: 'Landing page builder',
        onPress: () =>
          rootNavigation?.navigate('WebsiteBuilder', {
            ownerType: 'partner',
            ownerId: activePartnerId,
            ownerLabel: selectedPartner?.name || 'Partner Profile',
          }),
      },
    ]);
  }, [openOrgProfilePanel, rootNavigation, selectedPartner?.id, selectedPartner?.name]);
  const {
    rootPanHandlers,
    onAddPartnerPress,
    handleCloseMessages,
    onPartnerHeaderPress,
    onOpenCreate,
  } = usePartnerScreenActions({
    isReadOnly: selectedPartner?.member_role === 'readonly',
    panHandlers,
    setAuth,
    closeMessagesPane,
    openDiscoverPanel,
    openCreatePanel,
    animatePartnerSheet,
    isSettingsPanelOpen,
    isCreatePanelOpen,
    isDiscoverPanelOpen,
    isRecruitmentPanelOpen,
    isAuditPanelOpen,
    isPolicyPanelOpen,
    isIntegrationsPanelOpen,
    isAutomationPanelOpen,
    isReportsPanelOpen,
    isGovernancePanelOpen,
    isFeaturePanelOpen,
    isOrgProfilePanelOpen,
    isCoursesPanelOpen,
    isOrganizationAppsPanelOpen: isOrgAppsPanelOpen,
    isComplaintsPanelOpen: complaintsPanel.isOpen,
  });

  return (
    <PartnerOrganizationAppsProvider partnerId={selectedPartner?.id}>
      <PartnerLayout
        rootPanHandlers={rootPanHandlers}
        partners={partners}
        partnersLoading={partnersLoading}
        selectedPartnerId={selectedPartnerId}
        setSelectedPartnerId={id => setSelectedPartnerId(id as any)}
        onAddPartnerPress={onAddPartnerPress}
        selectedPartner={selectedPartner}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        selectedFeed={selectedFeed}
        selectedCommunityFeedId={selectedCommunityFeedId}
        rootGroups={rootGroups}
        rootChannels={rootChannels}
        groupsForPartner={groupsForPartner}
        channelsForPartner={channelsForPartner}
        communitiesForPartner={communitiesForPartner}
        expandedCommunities={expandedCommunities}
        toggleCommunity={toggleCommunity}
        onGroupPress={onGroupPress}
        onChannelPress={onChannelPress}
        onFeedPress={onFeedPress}
        onCommunityFeedPress={onCommunityFeedPress}
        onPartnerHeaderPress={onPartnerHeaderPress}
        onInfoPress={handleOpenPartnerInfo}
        width={width}
        messagesOffsetAnim={messagesOffsetAnim}
        messagePanHandlers={messagePanHandlers}
        isMessagesExpanded={isMessagesExpanded}
        toggleMessagesPane={toggleMessagesPane}
        handleCloseMessages={handleCloseMessages}
        onOpenInfo={onOpenInfo}
        onOpenTasks={openTasksPanel}
        isPartnerSheetOpen={isPartnerSheetOpen}
        sheetHeight={sheetHeight}
        sheetOffsetAnim={sheetOffsetAnim}
        overlayOpacity={overlayOpacity}
        sheetPanHandlers={sheetPanHandlers}
        communitiesCount={communitiesForPartner.length}
        groupsCount={groupsForPartner.length}
        channelsCount={rootChannels.length}
        partnerRole={settingsRole}
        settingsSections={settingsSections}
        openSection={openSection}
        onOpenCreate={onOpenCreate}
        onOpenLinks={openLinksPanel}
        onOpenOrganizations={openOrganizationsPanel}
        animatePartnerSheet={animatePartnerSheet}
        onOpenInsights={openInsights}
        onLaunchOrganizationApp={handleLaunchOrganizationApp}
        onOpenOrganizationApps={handleOpenOrganizationApps}
        panels={{
          settingsPanel: {
            isOpen: isSettingsPanelOpen,
            panelWidth,
            panelTranslateX,
            activeSection,
            role: settingsRole,
            onClose: closePanel,
            onOpenRecruitment: handleOpenRecruitment,
            onOpenAudit: handleOpenAudit,
            onOpenPolicy: handleOpenPolicy,
            onOpenIntegrations: handleOpenIntegrations,
            onOpenAutomation: handleOpenAutomation,
            onOpenReports: handleOpenReports,
            onOpenGovernance: handleOpenGovernance,
            onOpenFeature: handleOpenFeature,
            onOpenOrgProfile: handleOpenOrgProfile,
            onOpenComplaints: handleOpenComplaints,
            onOpenMembers: handleOpenMembers,
            onOpenModerationLog: handleOpenModerationLog,
            onOpenRoles: handleOpenRoles,
            onOpenChannels: handleOpenChannels,
            onOpenVerification: handleOpenVerification,
          },
          createPanel: {
            isOpen: isCreatePanelOpen,
            panelWidth: createPanelWidth,
            panelTranslateX: createPanelTranslateX,
            kind: createKind,
            onClose: closeCreatePanel,
            onSwitchKind: openCreatePanel,
            onCreated: handlePartnerItemCreated,
          },
          discoveryPanel: {
            isOpen: isDiscoverPanelOpen,
            panelWidth: discoverPanelWidth,
            panelTranslateX: discoverPanelTranslateX,
            onClose: closeDiscoverPanel,
            onJoined: reloadPartners,
          },
          recruitmentPanel: {
            isOpen: isRecruitmentPanelOpen,
            panelWidth: recruitmentPanelWidth,
            panelTranslateX: recruitmentPanelTranslateX,
            onClose: closeRecruitmentPanel,
          },
          auditPanel: {
            isOpen: isAuditPanelOpen,
            panelWidth: auditPanelWidth,
            panelTranslateX: auditPanelTranslateX,
            onClose: closeAuditPanel,
          },
          policyPanel: {
            isOpen: isPolicyPanelOpen,
            panelWidth: policyPanelWidth,
            panelTranslateX: policyPanelTranslateX,
            onClose: closePolicyPanel,
          },
          integrationsPanel: {
            isOpen: isIntegrationsPanelOpen,
            panelWidth: integrationsPanelWidth,
            panelTranslateX: integrationsPanelTranslateX,
            onClose: closeIntegrationsPanel,
          },
          automationPanel: {
            isOpen: isAutomationPanelOpen,
            panelWidth: automationPanelWidth,
            panelTranslateX: automationPanelTranslateX,
            onClose: closeAutomationPanel,
          },
          reportsPanel: {
            isOpen: isReportsPanelOpen,
            panelWidth: reportsPanelWidth,
            panelTranslateX: reportsPanelTranslateX,
            onClose: closeReportsPanel,
          },
          governancePanel: {
            isOpen: isGovernancePanelOpen,
            panelWidth: governancePanelWidth,
            panelTranslateX: governancePanelTranslateX,
            onClose: closeGovernancePanel,
          },
          membersPanel: {
            isOpen: isMembersPanelOpen,
            panelWidth: membersPanelWidth,
            panelTranslateX: membersPanelTranslateX,
            onClose: closeMembersPanel,
            isOwner: canManageOrganizationApps,
            initialTab: membersPanelInitialTab,
          },
          rolesPanel: {
            isOpen: isRolesPanelOpen,
            panelWidth: rolesPanelWidth,
            panelTranslateX: rolesPanelTranslateX,
            onClose: closeRolesPanel,
          },
          channelsPanel: {
            isOpen: isChannelsPanelOpen,
            panelWidth: channelsPanelWidth,
            panelTranslateX: channelsPanelTranslateX,
            onClose: closeChannelsPanel,
          },
          tasksPanel: {
            isOpen: isTasksPanelOpen,
            panelWidth: tasksPanelWidth,
            panelTranslateX: tasksPanelTranslateX,
            onClose: closeTasksPanel,
            channelId: selectedChannelId,
            channelName: channelsForPartner?.find((c: any) => c.id === selectedChannelId)?.name ?? null,
            currentUserId,
            canManageTasks: canManageOrganizationApps,
          },
          taskBoardsPanel: {
            isOpen: isTaskBoardsPanelOpen,
            panelWidth: taskBoardsPanelWidth,
            panelTranslateX: taskBoardsPanelTranslateX,
            onClose: closeTaskBoardsPanel,
            currentUserId,
            canManageTasks: canManageOrganizationApps,
          },
          orgStructurePanel: {
            isOpen: isOrgStructurePanelOpen,
            panelWidth: orgStructurePanelWidth,
            panelTranslateX: orgStructurePanelTranslateX,
            onClose: closeOrgStructurePanel,
          },
          membershipRulesPanel: {
            isOpen: isMembershipRulesPanelOpen,
            panelWidth: membershipRulesPanelWidth,
            panelTranslateX: membershipRulesPanelTranslateX,
            onClose: closeMembershipRulesPanel,
          },
          spacesDirectoryPanel: {
            isOpen: isSpacesDirectoryPanelOpen,
            panelWidth: spacesDirectoryPanelWidth,
            panelTranslateX: spacesDirectoryPanelTranslateX,
            onClose: closeSpacesDirectoryPanel,
          },
          analyticsPanel: {
            isOpen: isAnalyticsPanelOpen,
            panelWidth: analyticsPanelWidth,
            panelTranslateX: analyticsPanelTranslateX,
            onClose: closeAnalyticsPanel,
          },
          leadershipPanel: {
            isOpen: isLeadershipPanelOpen,
            panelWidth: leadershipPanelWidth,
            panelTranslateX: leadershipPanelTranslateX,
            onClose: closeLeadershipPanel,
          },
          resourcesPanel: {
            isOpen: isResourcesPanelOpen,
            panelWidth: resourcesPanelWidth,
            panelTranslateX: resourcesPanelTranslateX,
            onClose: closeResourcesPanel,
            canManage: canManageOrganizationApps,
          },
          trainingTracksPanel: {
            isOpen: isTrainingTracksPanelOpen,
            panelWidth: trainingTracksPanelWidth,
            panelTranslateX: trainingTracksPanelTranslateX,
            onClose: closeTrainingTracksPanel,
          },
          eventsCalendarPanel: {
            isOpen: isEventsCalendarPanelOpen,
            panelWidth: eventsCalendarPanelWidth,
            panelTranslateX: eventsCalendarPanelTranslateX,
            onClose: closeEventsCalendarPanel,
            canManage: canManageOrganizationApps,
          },
          broadcastCenterPanel: {
            isOpen: isBroadcastCenterPanelOpen,
            panelWidth: broadcastCenterPanelWidth,
            panelTranslateX: broadcastCenterPanelTranslateX,
            onClose: closeBroadcastCenterPanel,
          },
          supportInboxPanel: {
            isOpen: isSupportInboxPanelOpen,
            panelWidth: supportInboxPanelWidth,
            panelTranslateX: supportInboxPanelTranslateX,
            onClose: closeSupportInboxPanel,
            canManage: canManageOrganizationApps,
          },
          postTemplatesPanel: {
            isOpen: isPostTemplatesPanelOpen,
            panelWidth: postTemplatesPanelWidth,
            panelTranslateX: postTemplatesPanelTranslateX,
            onClose: closePostTemplatesPanel,
          },
          surveysPanel: {
            isOpen: isSurveysPanelOpen,
            panelWidth: surveysPanelWidth,
            panelTranslateX: surveysPanelTranslateX,
            onClose: closeSurveysPanel,
            canManage: canManageOrganizationApps,
          },
          budgetTrackingPanel: {
            isOpen: isBudgetTrackingPanelOpen,
            panelWidth: budgetTrackingPanelWidth,
            panelTranslateX: budgetTrackingPanelTranslateX,
            onClose: closeBudgetTrackingPanel,
          },
          volunteerRosterPanel: {
            isOpen: isVolunteerRosterPanelOpen,
            panelWidth: volunteerRosterPanelWidth,
            panelTranslateX: volunteerRosterPanelTranslateX,
            onClose: closeVolunteerRosterPanel,
            canManage: canManageOrganizationApps,
          },
          donationTrackingPanel: {
            isOpen: isDonationTrackingPanelOpen,
            panelWidth: donationTrackingPanelWidth,
            panelTranslateX: donationTrackingPanelTranslateX,
            onClose: closeDonationTrackingPanel,
          },
          workspaceBrandingPanel: {
            isOpen: isWorkspaceBrandingPanelOpen,
            panelWidth: workspaceBrandingPanelWidth,
            panelTranslateX: workspaceBrandingPanelTranslateX,
            onClose: closeWorkspaceBrandingPanel,
          },
          verificationPanel: {
            isOpen: isVerificationPanelOpen,
            panelWidth: verificationPanelWidth,
            panelTranslateX: verificationPanelTranslateX,
            onClose: closeVerificationPanel,
            isGoStaff: isSuperuser,
          },
          featurePanel: {
            isOpen: isFeaturePanelOpen,
            panelWidth: featurePanelWidth,
            panelTranslateX: featurePanelTranslateX,
            feature: activeFeature,
            onClose: closeFeaturePanel,
          },
          orgProfilePanel: {
            isOpen: isOrgProfilePanelOpen,
            panelWidth: orgProfilePanelWidth,
            panelTranslateX: orgProfilePanelTranslateX,
            onClose: closeOrgProfilePanel,
          },
          appsPanel: {
            isOpen: isOrgAppsPanelOpen,
            panelWidth: orgAppsPanelWidth,
            panelTranslateX: orgAppsPanelTranslateX,
            onClose: closeOrgAppsPanel,
            canManageApps: canManageOrganizationApps,
            onLaunchApp: handleLaunchOrganizationApp,
          },
          coursesPanel: {
            isOpen: isCoursesPanelOpen,
            panelWidth: coursesPanelWidth,
            panelTranslateX: coursesPanelTranslateX,
            partnerName: selectedPartner?.name ?? null,
            onClose: closeCoursesPanel,
          },
          linksPanel: {
            isOpen: isLinksPanelOpen,
            panelWidth: linksPanelWidth,
            panelTranslateX: linksPanelTranslateX,
            links,
            loading: linksLoading,
            error: linksError,
            onClose: closeLinksPanel,
            onToggleLink: toggleLink,
            onSetRole: setRole,
            onRefresh: refreshLinks,
          },
          complaintsPanel: {
            isOpen: complaintsPanel.isOpen,
            panelWidth: complaintsPanel.panelWidth,
            panelTranslateX: complaintsPanel.panelTranslateX,
            onClose: complaintsPanel.close,
          },
          organizationsPanel: {
            isOpen: isOrganizationsPanelOpen,
            panelWidth: organizationsPanelWidth,
            panelTranslateX: organizationsPanelTranslateX,
            onClose: closeOrganizationsPanel,
            organizations,
            linkable: linkableOrganizations,
            loading: organizationsLoading,
            error: organizationsError,
            onLink: linkOrganization,
            onUnlink: unlinkOrganization,
            onRefresh: refreshOrganizations,
          },
        }}
        isKcanAdmin={isKcanAdmin}
        onOpenAdminDashboard={isKcanAdmin ? adminDashboard.open : undefined}
        onRefreshPartner={reloadSelectedPartner}
      />

      {/* ── KCAN Super-Admin Panels ────────────────────────────────────── */}
      {isKcanAdmin && (
        <>
          <AdminDashboardPanel
            isOpen={adminDashboard.isOpen}
            panelWidth={adminDashboard.panelWidth}
            panelTranslateX={adminDashboard.panelTranslateX}
            kpis={adminDashboard.kpis}
            loading={adminDashboard.loading}
            error={adminDashboard.error}
            onClose={adminDashboard.close}
            onOpenUsers={adminUsers.open}
            onOpenContent={adminContent.open}
            onOpenAnalytics={adminAnalytics.open}
            onOpenPartners={adminPartners.open}
            onOpenVerification={adminVerification.open}
            onOpenSystemHealth={adminSystemHealth.open}
            onOpenAuditTrail={adminAuditTrail.open}
            onOpenBibleAdmin={openAdminBible}
            onOpenKISAppAdmin={openAdminKISApp}
            onRefresh={adminDashboard.refresh}
          />
          <AdminUsersPanel
            isOpen={adminUsers.isOpen}
            panelWidth={adminUsers.panelWidth}
            panelTranslateX={adminUsers.panelTranslateX}
            users={adminUsers.users}
            pagination={adminUsers.pagination}
            loading={adminUsers.loading}
            actionLoading={adminUsers.actionLoading}
            error={adminUsers.error}
            query={adminUsers.query}
            onSearch={adminUsers.search}
            onBan={adminUsers.banUser}
            onUnban={adminUsers.unbanUser}
            onSetTier={adminUsers.setUserTier}
            onLoadPage={(p) => { adminUsers.setPage(p); void adminUsers.load({ p }); }}
            onClose={adminUsers.close}
          />
          <AdminContentPanel
            isOpen={adminContent.isOpen}
            panelWidth={adminContent.panelWidth}
            panelTranslateX={adminContent.panelTranslateX}
            flags={adminContent.flags}
            summary={adminContent.summary}
            loading={adminContent.loading}
            actionLoading={adminContent.actionLoading}
            error={adminContent.error}
            totalPages={adminContent.totalPages}
            page={adminContent.page}
            onLoadPage={(p) => { adminContent.setPage(p); void adminContent.loadFlags({ p }); }}
            onTakeAction={adminContent.takeAction}
            onClose={adminContent.close}
          />
          <AdminAnalyticsPanel
            isOpen={adminAnalytics.isOpen}
            panelWidth={adminAnalytics.panelWidth}
            panelTranslateX={adminAnalytics.panelTranslateX}
            revenue={adminAnalytics.revenue}
            engagement={adminAnalytics.engagement}
            dashboards={adminAnalytics.dashboards}
            loading={adminAnalytics.loading}
            error={adminAnalytics.error}
            period={adminAnalytics.period}
            onChangePeriod={adminAnalytics.changePeriod}
            onClose={adminAnalytics.close}
            onRefresh={adminAnalytics.refresh}
          />
          <AdminPartnersPanel
            isOpen={adminPartners.isOpen}
            panelWidth={adminPartners.panelWidth}
            panelTranslateX={adminPartners.panelTranslateX}
            partners={adminPartners.partners}
            stats={adminPartners.stats}
            loading={adminPartners.loading}
            actionLoading={adminPartners.actionLoading}
            error={adminPartners.error}
            query={adminPartners.query}
            page={adminPartners.page}
            totalPages={adminPartners.totalPages}
            onSearch={adminPartners.search}
            onSetActive={adminPartners.setPartnerActive}
            onLoadPage={(p) => { adminPartners.setPage(p); void adminPartners.load({ p }); }}
            onClose={adminPartners.close}
          />
          <AdminVerificationPanel
            isOpen={adminVerification.isOpen}
            panelWidth={adminVerification.panelWidth}
            panelTranslateX={adminVerification.panelTranslateX}
            cases={adminVerification.cases}
            summary={adminVerification.summary}
            suspiciousSignals={adminVerification.suspiciousSignals}
            loading={adminVerification.loading}
            actionLoading={adminVerification.actionLoading}
            error={adminVerification.error}
            page={adminVerification.page}
            totalPages={adminVerification.totalPages}
            onTakeAction={adminVerification.takeAction}
            onApproveBadge={adminVerification.approveBadge}
            onRejectCase={adminVerification.rejectCase}
            onLoadPage={(p) => { adminVerification.setPage(p); void adminVerification.load({ p }); }}
            onClose={adminVerification.close}
          />
          <AdminSystemHealthPanel
            isOpen={adminSystemHealth.isOpen}
            panelWidth={adminSystemHealth.panelWidth}
            panelTranslateX={adminSystemHealth.panelTranslateX}
            metrics={adminSystemHealth.metrics}
            alerts={adminSystemHealth.alerts}
            performance={adminSystemHealth.performance}
            loading={adminSystemHealth.loading}
            error={adminSystemHealth.error}
            onClose={adminSystemHealth.close}
            onRefresh={adminSystemHealth.refresh}
          />
          <AdminAuditTrailPanel
            isOpen={adminAuditTrail.isOpen}
            panelWidth={adminAuditTrail.panelWidth}
            panelTranslateX={adminAuditTrail.panelTranslateX}
            entries={adminAuditTrail.entries}
            loading={adminAuditTrail.loading}
            error={adminAuditTrail.error}
            page={adminAuditTrail.page}
            totalPages={adminAuditTrail.totalPages}
            severityFilter={adminAuditTrail.severityFilter}
            actionFilter={adminAuditTrail.actionFilter}
            onFilterSeverity={(s) => { adminAuditTrail.setSeverityFilter(s); void adminAuditTrail.load({ severity: s, p: 1 }); }}
            onFilterAction={(a) => { adminAuditTrail.setActionFilter(a); void adminAuditTrail.load({ action: a, p: 1 }); }}
            onLoadPage={(p) => { adminAuditTrail.setPage(p); void adminAuditTrail.load({ p }); }}
            onClose={adminAuditTrail.close}
          />
          <AdminBiblePanel
            isOpen={adminBibleOpen}
            panelWidth={adminPanelWidth}
            panelTranslateX={adminBibleTranslateX}
            onClose={closeAdminBible}
          />
          <AdminKISAppPanel
            isOpen={adminKISAppOpen}
            panelWidth={adminPanelWidth}
            panelTranslateX={adminKISAppTranslateX}
            onClose={closeAdminKISApp}
          />
        </>
      )}

      {/* ── App Builder (Partner Pro) ────────────────────────────────── */}
      {canManageOrganizationApps && selectedPartner?.id && (
        <AppBuilderPanel
          isOpen={appBuilderPanel.isOpen}
          panelWidth={appBuilderPanel.panelWidth}
          panelTranslateX={appBuilderPanel.panelTranslateX}
          partnerId={selectedPartner.id}
          onClose={appBuilderPanel.close}
        />
      )}

      {/* ── Geolocation & Attendance ──────────────────────────────────── */}
      {selectedPartner?.id && (
        <GeolocationPanel
          isOpen={geolocationPanel.isOpen}
          panelWidth={geolocationPanel.panelWidth}
          panelTranslateX={geolocationPanel.panelTranslateX}
          partnerId={selectedPartner.id}
          isAdmin={canManageOrganizationApps}
          onClose={geolocationPanel.close}
        />
      )}
    </PartnerOrganizationAppsProvider>
  );
}
