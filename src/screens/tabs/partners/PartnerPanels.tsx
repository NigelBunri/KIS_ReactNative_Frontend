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
import type { PartnerProfileLink } from '@/screens/broadcast/education/api/education.models';
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

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
  };
  createPanel: {
    isOpen: boolean;
    panelWidth: number;
    panelTranslateX: any;
    kind: any;
    onClose: () => void;
    onSwitchKind: (kind: any) => void;
    onCreated: () => void;
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
  featurePanel,
  orgProfilePanel,
  appsPanel,
  coursesPanel,
  linksPanel,
  complaintsPanel,
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
    </>
  );
}
