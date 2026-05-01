import React from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import styles from '@/components/partners/partnersStyles';
import PartnersLeftRail from '@/components/partners/PartnersLeftRail';
import PartnersCenterPane from '@/components/partners/PartnersCenterPane';
import PartnersMessagesPane from '@/components/partners/PartnersMessagesPane';
import PartnerSheet from '@/components/partners/PartnerSheet';
import PartnerPanels from './PartnerPanels';
import { useKISTheme } from '@/theme/useTheme';
import PartnerAppLaunchBar from '@/components/partners/PartnerAppLaunchBar';
import { usePartnerOrganizationAppsContext } from '@/context/partners/PartnerOrganizationAppsContext';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

type Props = {
  rootPanHandlers: Record<string, any>;
  partners: any[];
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
  width: number;
  messagesOffsetAnim: any;
  messagePanHandlers: Record<string, any>;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  handleCloseMessages: () => void;
  onOpenInfo: any;
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
    featurePanel: any;
    orgProfilePanel: any;
    coursesPanel: any;
    linksPanel: any;
    complaintsPanel: any;
    appsPanel: any;
  };
  onLaunchOrganizationApp: (app: PartnerOrganizationApp) => void;
  onOpenOrganizationApps: () => void;
};

export default function PartnerLayout({
  rootPanHandlers,
  partners,
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
  width,
  messagesOffsetAnim,
  messagePanHandlers,
  isMessagesExpanded,
  toggleMessagesPane,
  handleCloseMessages,
  onOpenInfo,
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
  animatePartnerSheet,
  panels,
  onOpenInsights: _onOpenInsights,
  onLaunchOrganizationApp,
  onOpenOrganizationApps,
}: Props) {
  const { palette } = useKISTheme();
  const {
    apps: organizationApps,
    loading: organizationAppsLoading,
    error: organizationAppsError,
    reload: reloadOrganizationApps,
  } = usePartnerOrganizationAppsContext();
  return (
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
      <View
        style={[styles.rootGlowTop, { backgroundColor: palette.primaryStrong }]}
      />
      <View
        style={[
          styles.rootGlowBottom,
          { backgroundColor: palette.secondary ?? palette.primaryStrong },
        ]}
      />

      <PartnersLeftRail
        partners={partners}
        selectedPartnerId={selectedPartnerId}
        onSelectPartner={setSelectedPartnerId}
        onAddPartnerPress={onAddPartnerPress}
      />

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
      />

      {!isMessagesExpanded ? (
        <PartnerAppLaunchBar
          apps={organizationApps}
          loading={organizationAppsLoading}
          onLaunchApp={onLaunchOrganizationApp}
          onOpenMore={onOpenOrganizationApps}
        />
      ) : null}

      <PartnersMessagesPane
        width={width}
        messagesOffsetAnim={messagesOffsetAnim}
        messagePanHandlers={messagePanHandlers}
        isMessagesExpanded={isMessagesExpanded}
        toggleMessagesPane={toggleMessagesPane}
        closeMessagesPane={handleCloseMessages}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        selectedFeed={selectedFeed}
        selectedCommunityFeedId={selectedCommunityFeedId}
        groupsForPartner={groupsForPartner}
        channelsForPartner={channelsForPartner}
        communitiesForPartner={communitiesForPartner}
        selectedPartner={selectedPartner}
        onOpenInfo={onOpenInfo}
      />

      <PartnerSheet
        isOpen={isPartnerSheetOpen}
        sheetHeight={sheetHeight}
        sheetOffsetAnim={sheetOffsetAnim}
        overlayOpacity={overlayOpacity}
        sheetPanHandlers={sheetPanHandlers}
        selectedPartner={selectedPartner}
        communitiesCount={communitiesCount}
        groupsCount={groupsCount}
        channelsCount={channelsCount}
        partnerRole={partnerRole}
        sections={settingsSections}
        onOpenSettingsSection={openSection}
        onOpenCreate={onOpenCreate}
        animatePartnerSheet={animatePartnerSheet}
        onOpenLinks={onOpenLinks}
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
      />
    </View>
  );
}
