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
  };
};
