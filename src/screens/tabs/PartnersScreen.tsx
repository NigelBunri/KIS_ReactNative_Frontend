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
import { usePartnerPanelOpeners } from './partners/usePartnerPanelOpeners';
import { usePartnerFeaturePanel } from './partners/usePartnerFeaturePanel';
import { usePartnerOrgProfilePanel } from './partners/usePartnerOrgProfilePanel';
import { usePartnerOrganizationAppsPanel } from './partners/usePartnerOrganizationAppsPanel';
import { usePartnerScreenActions } from './partners/usePartnerScreenActions';
import { usePartnerCoursesPanel } from './partners/usePartnerCoursesPanel';
import { usePartnerLinksPanel } from './partners/usePartnerLinksPanel';
import { usePartnerComplaintsPanel } from './partners/usePartnerComplaintsPanel';
import usePartnerProfileLinks from './partners/usePartnerProfileLinks';
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
  const { setAuth } = useAuth();
  const { width, height } = useWindowDimensions();
  const { pageGutter } = useResponsiveLayout();
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
  } = usePartnerSettingsPanel(width, settingsSections);
  const {
    panelWidth: createPanelWidth,
    panelTranslateX: createPanelTranslateX,
    kind: createKind,
    isOpen: isCreatePanelOpen,
    open: openCreatePanel,
    close: closeCreatePanel,
  } = usePartnerCreatePanel(width);
  const {
    panelWidth: discoverPanelWidth,
    panelTranslateX: discoverPanelTranslateX,
    isOpen: isDiscoverPanelOpen,
    open: openDiscoverPanel,
    close: closeDiscoverPanel,
  } = usePartnerDiscoveryPanel(width);
  const {
    panelWidth: recruitmentPanelWidth,
    panelTranslateX: recruitmentPanelTranslateX,
    isOpen: isRecruitmentPanelOpen,
    open: openRecruitmentPanel,
    close: closeRecruitmentPanel,
  } = usePartnerRecruitmentPanel(width);
  const {
    panelWidth: auditPanelWidth,
    panelTranslateX: auditPanelTranslateX,
    isOpen: isAuditPanelOpen,
    open: openAuditPanel,
    close: closeAuditPanel,
  } = usePartnerAuditPanel(width);
  const {
    panelWidth: policyPanelWidth,
    panelTranslateX: policyPanelTranslateX,
    isOpen: isPolicyPanelOpen,
    open: openPolicyPanel,
    close: closePolicyPanel,
  } = usePartnerPolicyPanel(width);
  const {
    panelWidth: integrationsPanelWidth,
    panelTranslateX: integrationsPanelTranslateX,
    isOpen: isIntegrationsPanelOpen,
    open: openIntegrationsPanel,
    close: closeIntegrationsPanel,
  } = usePartnerIntegrationsPanel(width);
  const {
    panelWidth: automationPanelWidth,
    panelTranslateX: automationPanelTranslateX,
    isOpen: isAutomationPanelOpen,
    open: openAutomationPanel,
    close: closeAutomationPanel,
  } = usePartnerAutomationPanel(width);
  const {
    panelWidth: reportsPanelWidth,
    panelTranslateX: reportsPanelTranslateX,
    isOpen: isReportsPanelOpen,
    open: openReportsPanel,
    close: closeReportsPanel,
  } = usePartnerReportsPanel(width);
  const {
    panelWidth: governancePanelWidth,
    panelTranslateX: governancePanelTranslateX,
    isOpen: isGovernancePanelOpen,
    open: openGovernancePanel,
    close: closeGovernancePanel,
  } = usePartnerGovernancePanel(width);
  const {
    panelWidth: featurePanelWidth,
    panelTranslateX: featurePanelTranslateX,
    isOpen: isFeaturePanelOpen,
    feature: activeFeature,
    open: openFeaturePanel,
    close: closeFeaturePanel,
  } = usePartnerFeaturePanel(width);

  const {
    panelWidth: orgProfilePanelWidth,
    panelTranslateX: orgProfilePanelTranslateX,
    isOpen: isOrgProfilePanelOpen,
    open: openOrgProfilePanel,
    close: closeOrgProfilePanel,
  } = usePartnerOrgProfilePanel(width);
  const {
    panelWidth: orgAppsPanelWidth,
    panelTranslateX: orgAppsPanelTranslateX,
    isOpen: isOrgAppsPanelOpen,
    open: openOrgAppsPanel,
    close: closeOrgAppsPanel,
  } = usePartnerOrganizationAppsPanel(width);
  const {
    panelWidth: coursesPanelWidth,
    panelTranslateX: coursesPanelTranslateX,
    isOpen: isCoursesPanelOpen,
    open: openCoursesPanel,
    close: closeCoursesPanel,
  } = usePartnerCoursesPanel(width);
  const {
    panelWidth: linksPanelWidth,
    panelTranslateX: linksPanelTranslateX,
    isOpen: isLinksPanelOpen,
    open: openLinksPanel,
    close: closeLinksPanel,
  } = usePartnerLinksPanel(width);
  const complaintsPanel = usePartnerComplaintsPanel(width);

  // ── KCAN Admin Panels (superuser / GO only) ──────────────────────────────
  // isKcanAdmin: true if superuser flag is confirmed OR if the backend already
  // returned member_role='owner' on KCAN (which only happens for superusers/staff).
  const isKcanAdmin =
    isSelectedKCAN &&
    (isSuperuser || selectedPartner?.member_role === 'owner');
  const adminDashboard = useAdminDashboardPanel(width);
  const adminUsers = useAdminUsersPanel(width);
  const adminContent = useAdminContentPanel(width);
  const adminAnalytics = useAdminAnalyticsPanel(width);
  const adminPartners = useAdminPartnersPanel(width);
  const adminVerification = useAdminVerificationPanel(width);
  const adminSystemHealth = useAdminSystemHealthPanel(width);
  const adminAuditTrail = useAdminAuditTrailPanel(width);

  // Bible App Admin and KIS App Admin panels (simple open/close with animation)
  const adminPanelWidth = React.useMemo(
    () => (width < 600 ? width : Math.min(900, Math.max(600, Math.round(width * 0.85)))),
    [width],
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
  const appBuilderPanel = useAppBuilderPanel(width);
  const handleOpenAppBuilder = useCallback(() => {
    closePanel();
    setTimeout(() => appBuilderPanel.open(), 240);
  }, [closePanel, appBuilderPanel]);

  // ── Geolocation & Attendance (Partner Pro) ────────────────────────────────
  const geolocationPanel = useGeolocationPanel(width);
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
      onOpenInfo?.();
      return;
    }
    Alert.alert('Partner actions', 'Choose what to open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open info',
        onPress: () => onOpenInfo?.(),
      },
      {
        text: 'Landing page builder',
        onPress: () =>
          rootNavigation?.navigate('ProfileLandingEditor', {
            kind: 'partner',
            partnerId: activePartnerId,
            profileLabel: selectedPartner?.name || 'Partner Profile',
          }),
      },
    ]);
  }, [onOpenInfo, rootNavigation, selectedPartner?.id, selectedPartner?.name]);
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
        width={width}
        messagesOffsetAnim={messagesOffsetAnim}
        messagePanHandlers={messagePanHandlers}
        isMessagesExpanded={isMessagesExpanded}
        toggleMessagesPane={toggleMessagesPane}
        handleCloseMessages={handleCloseMessages}
        onOpenInfo={handleOpenPartnerInfo}
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
