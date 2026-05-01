// src/screens/tabs/PartnersScreen.tsx
import React, { useCallback, useEffect } from 'react';
import { Alert, DeviceEventEmitter, useWindowDimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

export default function PartnersScreen({ setHidNav, onOpenInfo }: any) {
  const navigation = useNavigation<any>();
  const { setAuth } = useAuth();
  const { width, height } = useWindowDimensions();
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
    reloadSelectedPartner,
    reloadPartners,
  } = usePartnersData();
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
  const { sections: settingsSections, role: settingsRole } =
    usePartnerSettingsCatalog(selectedPartner?.id, partnerRole);
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
    openFeaturePanel(feature);
  };

  const handleLaunchOrganizationApp = useCallback(
    (app: PartnerOrganizationApp) => {
      closeOrgAppsPanel();
      rootNavigation?.navigate('OrganizationApp', { app });
    },
    [closeOrgAppsPanel, rootNavigation],
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
            onCreated: reloadSelectedPartner,
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
      />
    </PartnerOrganizationAppsProvider>
  );
}
