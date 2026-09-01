import React from 'react';
import PartnerAuditPanel from '@/components/partners/PartnerAuditPanel';
import PartnerAutomationPanel from '@/components/partners/PartnerAutomationPanel';
import PartnerFeaturePanel from '@/components/partners/PartnerFeaturePanel';
import PartnerOrganizationAppsPanel from '@/components/partners/PartnerOrganizationAppsPanel';
import PartnerOrganizationProfilePanel from '@/components/partners/PartnerOrganizationProfilePanel';
import PartnerGovernancePanel from '@/components/partners/PartnerGovernancePanel';
import PartnerCreatePanel from '@/components/partners/PartnerCreatePanel';
import PartnerDiscoveryPanel from '@/components/partners/PartnerDiscoveryPanel';
import PartnerIntegrationsPanel from '@/components/partners/PartnerIntegrationsPanel';
import PartnerPolicyPanel from '@/components/partners/PartnerPolicyPanel';
import PartnerRecruitmentPanel from '@/components/partners/PartnerRecruitmentPanel';
import PartnerReportsPanel from '@/components/partners/PartnerReportsPanel';
import PartnerSettingsPanel from '@/components/partners/settings/PartnerSettingsPanel';
import PartnerLinksPanel from '@/components/partners/PartnerLinksPanel';
import PartnerCoursesPanel from '@/components/partners/PartnerCoursesPanel';
import PartnerComplaintsPanel from '@/components/partners/PartnerComplaintsPanel';
import PartnerOrganizationsPanel from '@/components/partners/PartnerOrganizationsPanel';
import PartnerMembersPanel from '@/components/partners/PartnerMembersPanel';
import PartnerRolesPanel from '@/components/partners/PartnerRolesPanel';
import PartnerChannelsPanel from '@/components/partners/PartnerChannelsPanel';
import PartnerTasksPanel from '@/components/partners/PartnerTasksPanel';
import PartnerTaskBoardsPanel from '@/components/partners/PartnerTaskBoardsPanel';
import PartnerOrgStructurePanel from '@/components/partners/PartnerOrgStructurePanel';
import PartnerMembershipRulesPanel from '@/components/partners/PartnerMembershipRulesPanel';
import PartnerSpacesDirectoryPanel from '@/components/partners/PartnerSpacesDirectoryPanel';
import PartnerAnalyticsPanel from '@/components/partners/PartnerAnalyticsPanel';
import PartnerLeadershipPanel from '@/components/partners/PartnerLeadershipPanel';
import PartnerResourcesPanel from '@/components/partners/PartnerResourcesPanel';
import PartnerTrainingTracksPanel from '@/components/partners/PartnerTrainingTracksPanel';
import PartnerEventsCalendarPanel from '@/components/partners/PartnerEventsCalendarPanel';
import PartnerBroadcastCenterPanel from '@/components/partners/PartnerBroadcastCenterPanel';
import PartnerSupportInboxPanel from '@/components/partners/PartnerSupportInboxPanel';
import PartnerPostTemplatesPanel from '@/components/partners/PartnerPostTemplatesPanel';
import PartnerSurveysPanel from '@/components/partners/PartnerSurveysPanel';
import PartnerBudgetTrackingPanel from '@/components/partners/PartnerBudgetTrackingPanel';
import PartnerVolunteerRosterPanel from '@/components/partners/PartnerVolunteerRosterPanel';
import PartnerDonationTrackingPanel from '@/components/partners/PartnerDonationTrackingPanel';
import PartnerWorkspaceBrandingPanel from '@/components/partners/PartnerWorkspaceBrandingPanel';
import PartnerVerificationPanel from '@/components/partners/PartnerVerificationPanel';
import type { PartnerProfileLink } from '@/screens/broadcast/education/api/education.models';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';
import type {
  LinkableOrganization,
  PartnerOrganizationLink,
  PartnerOrganizationType,
} from '@/screens/tabs/partners/usePartnerOrganizations';

type Props = {
  selectedPartnerId?: string | null;
  settingsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    activeSection: any;
    role: any;
    onClose: () => void;
    onOpenRecruitment: () => void;
    onOpenAudit: () => void;
    onOpenPolicy: () => void;
    onOpenIntegrations: () => void;
    onOpenAutomation: () => void;
    onOpenReports: () => void;
    onOpenGovernance: () => void;
    onOpenFeature: (feature: any) => void;
    onOpenOrgProfile: () => void;
    onOpenComplaints: () => void;
    onOpenMembers?: () => void;
    onOpenModerationLog?: () => void;
    onOpenRoles?: () => void;
    onOpenChannels?: () => void;
    onOpenVerification?: () => void;
  };
  createPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    kind: any;
    onClose: () => void;
    onSwitchKind: (kind: any) => void;
    onCreated: (kind: any, data: any) => void;
  };
  discoveryPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    onJoined: () => void;
  };
  recruitmentPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  auditPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  policyPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  integrationsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  automationPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  reportsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  governancePanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  membersPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    isOwner?: boolean;
    initialTab?: 'members' | 'log';
  };
  rolesPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  channelsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  tasksPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    channelId?: string | null;
    channelName?: string | null;
    currentUserId?: string | null;
    canManageTasks?: boolean;
  };
  taskBoardsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    currentUserId?: string | null;
    canManageTasks?: boolean;
  };
  orgStructurePanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  membershipRulesPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  spacesDirectoryPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  analyticsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  leadershipPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  resourcesPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    canManage?: boolean;
  };
  trainingTracksPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  eventsCalendarPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    canManage?: boolean;
  };
  broadcastCenterPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  supportInboxPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    canManage?: boolean;
  };
  postTemplatesPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  surveysPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    canManage?: boolean;
  };
  budgetTrackingPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  volunteerRosterPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    canManage?: boolean;
  };
  donationTrackingPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  workspaceBrandingPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  directoryChannels?: any[];
  directoryGroups?: any[];
  directoryCommunities?: any[];
  onSelectDirectoryChannel?: (id: string) => void;
  onSelectDirectoryGroup?: (id: string) => void;
  onSelectDirectoryCommunity?: (id: string) => void;
  verificationPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    isGoStaff?: boolean;
  };
  featurePanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    feature: any;
    onClose: () => void;
  };
  orgProfilePanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  appsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    partnerId?: string | null;
    onClose: () => void;
    apps: PartnerOrganizationApp[];
    loading: boolean;
    error?: string | null;
    onReload: () => void;
    canManageApps: boolean;
    onLaunchApp: (app: PartnerOrganizationApp) => void;
  };
  coursesPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    partnerName?: string | null;
    onClose: () => void;
  };
  linksPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    links: PartnerProfileLink[];
    loading: boolean;
    error?: string | null;
    onClose: () => void;
    onToggleLink: (profileKey: PartnerProfileLink['profileKey'], link: boolean) => void;
    onSetRole: (profileKey: PartnerProfileLink['profileKey'], role: PartnerProfileLink['role']) => void;
    onRefresh: () => void;
  };
  complaintsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
  };
  organizationsPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    onClose: () => void;
    organizations: PartnerOrganizationLink[];
    linkable: LinkableOrganization[];
    loading: boolean;
    error?: string | null;
    onLink: (ownerType: PartnerOrganizationType, ownerId: string) => void;
    onUnlink: (linkId: string) => void;
    onRefresh: () => void;
  };
};

export default function PartnerPanels({
  selectedPartnerId,
  settingsPanel,
  createPanel,
  discoveryPanel,
  recruitmentPanel,
  auditPanel,
  policyPanel,
  integrationsPanel,
  automationPanel,
  reportsPanel,
  governancePanel,
  membersPanel,
  rolesPanel,
  channelsPanel,
  tasksPanel,
  taskBoardsPanel,
  orgStructurePanel,
  membershipRulesPanel,
  spacesDirectoryPanel,
  analyticsPanel,
  leadershipPanel,
  resourcesPanel,
  trainingTracksPanel,
  eventsCalendarPanel,
  broadcastCenterPanel,
  supportInboxPanel,
  postTemplatesPanel,
  surveysPanel,
  budgetTrackingPanel,
  volunteerRosterPanel,
  donationTrackingPanel,
  workspaceBrandingPanel,
  directoryChannels,
  directoryGroups,
  directoryCommunities,
  onSelectDirectoryChannel,
  onSelectDirectoryGroup,
  onSelectDirectoryCommunity,
  verificationPanel,
  featurePanel,
  orgProfilePanel,
  appsPanel,
  coursesPanel,
  linksPanel,
  complaintsPanel,
  organizationsPanel,
}: Props) {
  return (
    <>
      <PartnerSettingsPanel
        isOpen={settingsPanel.isOpen}
        panelWidth={settingsPanel.panelWidth}
        panelTranslateX={settingsPanel.panelTranslateX}
        section={settingsPanel.activeSection}
        role={settingsPanel.role}
        onClose={settingsPanel.onClose}
        onOpenRecruitment={settingsPanel.onOpenRecruitment}
        onOpenAudit={settingsPanel.onOpenAudit}
        onOpenPolicy={settingsPanel.onOpenPolicy}
        onOpenIntegrations={settingsPanel.onOpenIntegrations}
        onOpenAutomation={settingsPanel.onOpenAutomation}
        onOpenReports={settingsPanel.onOpenReports}
        onOpenGovernance={settingsPanel.onOpenGovernance}
        onOpenFeature={settingsPanel.onOpenFeature}
        onOpenOrgProfile={settingsPanel.onOpenOrgProfile}
        onOpenComplaints={settingsPanel.onOpenComplaints}
        onOpenMembers={settingsPanel.onOpenMembers}
        onOpenModerationLog={settingsPanel.onOpenModerationLog}
        onOpenRoles={settingsPanel.onOpenRoles}
        onOpenChannels={settingsPanel.onOpenChannels}
        onOpenVerification={settingsPanel.onOpenVerification}
      />

      <PartnerCreatePanel
        isOpen={createPanel.isOpen}
        panelWidth={createPanel.panelWidth}
        panelTranslateX={createPanel.panelTranslateX}
        kind={createPanel.kind}
        partnerId={selectedPartnerId}
        onClose={createPanel.onClose}
        onSwitchKind={createPanel.onSwitchKind}
        onCreated={createPanel.onCreated}
      />

      <PartnerDiscoveryPanel
        isOpen={discoveryPanel.isOpen}
        panelWidth={discoveryPanel.panelWidth}
        panelTranslateX={discoveryPanel.panelTranslateX}
        onClose={discoveryPanel.onClose}
        onJoined={discoveryPanel.onJoined}
      />

      <PartnerRecruitmentPanel
        isOpen={recruitmentPanel.isOpen}
        panelWidth={recruitmentPanel.panelWidth}
        panelTranslateX={recruitmentPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={recruitmentPanel.onClose}
      />

      <PartnerAuditPanel
        isOpen={auditPanel.isOpen}
        panelWidth={auditPanel.panelWidth}
        panelTranslateX={auditPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={auditPanel.onClose}
      />

      <PartnerPolicyPanel
        isOpen={policyPanel.isOpen}
        panelWidth={policyPanel.panelWidth}
        panelTranslateX={policyPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={policyPanel.onClose}
      />

      <PartnerIntegrationsPanel
        isOpen={integrationsPanel.isOpen}
        panelWidth={integrationsPanel.panelWidth}
        panelTranslateX={integrationsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={integrationsPanel.onClose}
      />

      <PartnerAutomationPanel
        isOpen={automationPanel.isOpen}
        panelWidth={automationPanel.panelWidth}
        panelTranslateX={automationPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={automationPanel.onClose}
      />

      <PartnerReportsPanel
        isOpen={reportsPanel.isOpen}
        panelWidth={reportsPanel.panelWidth}
        panelTranslateX={reportsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={reportsPanel.onClose}
      />

      <PartnerGovernancePanel
        isOpen={governancePanel.isOpen}
        panelWidth={governancePanel.panelWidth}
        panelTranslateX={governancePanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={governancePanel.onClose}
      />

      <PartnerMembersPanel
        isOpen={membersPanel.isOpen}
        panelWidth={membersPanel.panelWidth}
        panelTranslateX={membersPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        isOwner={membersPanel.isOwner}
        initialTab={membersPanel.initialTab}
        onClose={membersPanel.onClose}
      />

      <PartnerRolesPanel
        isOpen={rolesPanel.isOpen}
        panelWidth={rolesPanel.panelWidth}
        panelTranslateX={rolesPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={rolesPanel.onClose}
      />

      <PartnerChannelsPanel
        isOpen={channelsPanel.isOpen}
        panelWidth={channelsPanel.panelWidth}
        panelTranslateX={channelsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={channelsPanel.onClose}
      />

      <PartnerTasksPanel
        isOpen={tasksPanel.isOpen}
        panelWidth={tasksPanel.panelWidth}
        panelTranslateX={tasksPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        channelId={tasksPanel.channelId}
        channelName={tasksPanel.channelName}
        currentUserId={tasksPanel.currentUserId}
        canManageTasks={tasksPanel.canManageTasks}
        onClose={tasksPanel.onClose}
      />

      <PartnerTaskBoardsPanel
        isOpen={taskBoardsPanel.isOpen}
        panelWidth={taskBoardsPanel.panelWidth}
        panelTranslateX={taskBoardsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        channels={directoryChannels ?? []}
        currentUserId={taskBoardsPanel.currentUserId}
        canManageTasks={taskBoardsPanel.canManageTasks}
        onClose={taskBoardsPanel.onClose}
      />

      <PartnerOrgStructurePanel
        isOpen={orgStructurePanel.isOpen}
        panelWidth={orgStructurePanel.panelWidth}
        panelTranslateX={orgStructurePanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={orgStructurePanel.onClose}
      />

      <PartnerMembershipRulesPanel
        isOpen={membershipRulesPanel.isOpen}
        panelWidth={membershipRulesPanel.panelWidth}
        panelTranslateX={membershipRulesPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={membershipRulesPanel.onClose}
      />

      <PartnerSpacesDirectoryPanel
        isOpen={spacesDirectoryPanel.isOpen}
        panelWidth={spacesDirectoryPanel.panelWidth}
        panelTranslateX={spacesDirectoryPanel.panelTranslateX}
        channels={directoryChannels ?? []}
        groups={directoryGroups ?? []}
        communities={directoryCommunities ?? []}
        onSelectChannel={onSelectDirectoryChannel ?? (() => {})}
        onSelectGroup={onSelectDirectoryGroup ?? (() => {})}
        onSelectCommunity={onSelectDirectoryCommunity ?? (() => {})}
        onClose={spacesDirectoryPanel.onClose}
      />

      <PartnerAnalyticsPanel
        isOpen={analyticsPanel.isOpen}
        panelWidth={analyticsPanel.panelWidth}
        panelTranslateX={analyticsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={analyticsPanel.onClose}
      />

      <PartnerLeadershipPanel
        isOpen={leadershipPanel.isOpen}
        panelWidth={leadershipPanel.panelWidth}
        panelTranslateX={leadershipPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={leadershipPanel.onClose}
      />

      <PartnerResourcesPanel
        isOpen={resourcesPanel.isOpen}
        panelWidth={resourcesPanel.panelWidth}
        panelTranslateX={resourcesPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        canManage={resourcesPanel.canManage}
        onClose={resourcesPanel.onClose}
      />

      <PartnerTrainingTracksPanel
        isOpen={trainingTracksPanel.isOpen}
        panelWidth={trainingTracksPanel.panelWidth}
        panelTranslateX={trainingTracksPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={trainingTracksPanel.onClose}
      />

      <PartnerEventsCalendarPanel
        isOpen={eventsCalendarPanel.isOpen}
        panelWidth={eventsCalendarPanel.panelWidth}
        panelTranslateX={eventsCalendarPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        canManage={eventsCalendarPanel.canManage}
        onClose={eventsCalendarPanel.onClose}
      />

      <PartnerBroadcastCenterPanel
        isOpen={broadcastCenterPanel.isOpen}
        panelWidth={broadcastCenterPanel.panelWidth}
        panelTranslateX={broadcastCenterPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={broadcastCenterPanel.onClose}
      />

      <PartnerSupportInboxPanel
        isOpen={supportInboxPanel.isOpen}
        panelWidth={supportInboxPanel.panelWidth}
        panelTranslateX={supportInboxPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        canManage={supportInboxPanel.canManage}
        onClose={supportInboxPanel.onClose}
      />

      <PartnerPostTemplatesPanel
        isOpen={postTemplatesPanel.isOpen}
        panelWidth={postTemplatesPanel.panelWidth}
        panelTranslateX={postTemplatesPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={postTemplatesPanel.onClose}
      />

      <PartnerSurveysPanel
        isOpen={surveysPanel.isOpen}
        panelWidth={surveysPanel.panelWidth}
        panelTranslateX={surveysPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        canManage={surveysPanel.canManage}
        onClose={surveysPanel.onClose}
      />

      <PartnerBudgetTrackingPanel
        isOpen={budgetTrackingPanel.isOpen}
        panelWidth={budgetTrackingPanel.panelWidth}
        panelTranslateX={budgetTrackingPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={budgetTrackingPanel.onClose}
      />

      <PartnerVolunteerRosterPanel
        isOpen={volunteerRosterPanel.isOpen}
        panelWidth={volunteerRosterPanel.panelWidth}
        panelTranslateX={volunteerRosterPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        canManage={volunteerRosterPanel.canManage}
        onClose={volunteerRosterPanel.onClose}
      />

      <PartnerDonationTrackingPanel
        isOpen={donationTrackingPanel.isOpen}
        panelWidth={donationTrackingPanel.panelWidth}
        panelTranslateX={donationTrackingPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={donationTrackingPanel.onClose}
      />

      <PartnerWorkspaceBrandingPanel
        isOpen={workspaceBrandingPanel.isOpen}
        panelWidth={workspaceBrandingPanel.panelWidth}
        panelTranslateX={workspaceBrandingPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={workspaceBrandingPanel.onClose}
      />

      <PartnerVerificationPanel
        isOpen={verificationPanel.isOpen}
        panelWidth={verificationPanel.panelWidth}
        panelTranslateX={verificationPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        isGoStaff={verificationPanel.isGoStaff}
        onClose={verificationPanel.onClose}
      />

      <PartnerFeaturePanel
        isOpen={featurePanel.isOpen}
        panelWidth={featurePanel.panelWidth}
        panelTranslateX={featurePanel.panelTranslateX}
        partnerId={selectedPartnerId}
        feature={featurePanel.feature}
        onClose={featurePanel.onClose}
      />

      <PartnerOrganizationProfilePanel
        isOpen={orgProfilePanel.isOpen}
        panelWidth={orgProfilePanel.panelWidth}
        panelTranslateX={orgProfilePanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={orgProfilePanel.onClose}
      />

      <PartnerOrganizationAppsPanel
        isOpen={appsPanel.isOpen}
        panelWidth={appsPanel.panelWidth}
        panelTranslateX={appsPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        onClose={appsPanel.onClose}
        apps={appsPanel.apps}
        loading={appsPanel.loading}
        error={appsPanel.error}
        onRefresh={appsPanel.onReload}
        onLaunchApp={appsPanel.onLaunchApp}
        canManageApps={appsPanel.canManageApps}
      />

      <PartnerCoursesPanel
        isOpen={coursesPanel.isOpen}
        panelWidth={coursesPanel.panelWidth}
        panelTranslateX={coursesPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        partnerName={coursesPanel.partnerName}
        onClose={coursesPanel.onClose}
      />
      <PartnerLinksPanel
        isOpen={linksPanel.isOpen}
        panelWidth={linksPanel.panelWidth}
        panelTranslateX={linksPanel.panelTranslateX}
        partnerId={selectedPartnerId}
        links={linksPanel.links}
        loading={linksPanel.loading}
        error={linksPanel.error}
        onClose={linksPanel.onClose}
        onToggleLink={linksPanel.onToggleLink}
        onSetRole={linksPanel.onSetRole}
        onRefresh={linksPanel.onRefresh}
      />
      <PartnerComplaintsPanel
        isOpen={complaintsPanel.isOpen}
        panelWidth={complaintsPanel.panelWidth}
        panelTranslateX={complaintsPanel.panelTranslateX}
        onClose={complaintsPanel.onClose}
      />
      <PartnerOrganizationsPanel
        isOpen={organizationsPanel.isOpen}
        panelWidth={organizationsPanel.panelWidth}
        panelTranslateX={organizationsPanel.panelTranslateX}
        onClose={organizationsPanel.onClose}
        organizations={organizationsPanel.organizations}
        linkable={organizationsPanel.linkable}
        loading={organizationsPanel.loading}
        error={organizationsPanel.error}
        onLink={organizationsPanel.onLink}
        onUnlink={organizationsPanel.onUnlink}
        onRefresh={organizationsPanel.onRefresh}
      />
    </>
  );
}
