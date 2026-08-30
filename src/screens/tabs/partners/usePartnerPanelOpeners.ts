type PanelOpeners = {
  closePanel: () => void;
  openRecruitment: () => void;
  openAudit: () => void;
  openPolicy: () => void;
  openIntegrations: () => void;
  openAutomation: () => void;
  openReports: () => void;
  openGovernance: () => void;
  openComplaints: () => void;
  openMembers?: () => void;
  openRoles?: () => void;
  openChannels?: () => void;
  openVerification?: () => void;
  setMembersPanelInitialTab?: (tab: 'members' | 'log') => void;
};

export const usePartnerPanelOpeners = ({
  closePanel,
  openRecruitment,
  openAudit,
  openPolicy,
  openIntegrations,
  openAutomation,
  openReports,
  openGovernance,
  openComplaints,
  openMembers,
  openRoles,
  openChannels,
  openVerification,
  setMembersPanelInitialTab,
}: PanelOpeners) => {
  return {
    handleOpenRecruitment: () => {
      closePanel();
      openRecruitment();
    },
    handleOpenAudit: () => {
      closePanel();
      openAudit();
    },
    handleOpenPolicy: () => {
      closePanel();
      openPolicy();
    },
    handleOpenIntegrations: () => {
      closePanel();
      openIntegrations();
    },
    handleOpenAutomation: () => {
      closePanel();
      openAutomation();
    },
    handleOpenReports: () => {
      closePanel();
      openReports();
    },
    handleOpenGovernance: () => {
      closePanel();
      openGovernance();
    },
    handleOpenComplaints: () => {
      closePanel();
      openComplaints();
    },
    handleOpenMembers: () => {
      closePanel();
      setMembersPanelInitialTab?.('members');
      openMembers?.();
    },
    handleOpenModerationLog: () => {
      closePanel();
      setMembersPanelInitialTab?.('log');
      openMembers?.();
    },
    handleOpenRoles: () => {
      closePanel();
      openRoles?.();
    },
    handleOpenChannels: () => {
      closePanel();
      openChannels?.();
    },
    handleOpenVerification: () => {
      closePanel();
      openVerification?.();
    },
  };
};
