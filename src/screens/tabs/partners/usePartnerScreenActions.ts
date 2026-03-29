import { Alert } from 'react-native';
import { clearAuthTokens } from '@/security/authStorage';

type Params = {
  isReadOnly: boolean;
  panHandlers: Record<string, any>;
  setAuth: (value: boolean) => void;
  closeMessagesPane: () => void;
  clearMessagesSelection?: () => void;
  openDiscoverPanel: () => void;
  openCreatePanel: (kind: 'community' | 'group' | 'channel') => void;
  animatePartnerSheet: (open: boolean) => void;
  isSettingsPanelOpen: boolean;
  isCreatePanelOpen: boolean;
  isDiscoverPanelOpen: boolean;
  isRecruitmentPanelOpen: boolean;
  isAuditPanelOpen: boolean;
  isPolicyPanelOpen: boolean;
  isIntegrationsPanelOpen: boolean;
  isAutomationPanelOpen: boolean;
  isReportsPanelOpen: boolean;
  isGovernancePanelOpen: boolean;
  isFeaturePanelOpen: boolean;
  isOrgProfilePanelOpen: boolean;
  isCoursesPanelOpen: boolean;
  isOrganizationAppsPanelOpen: boolean;
  isComplaintsPanelOpen: boolean;
};

export const usePartnerScreenActions = ({
  isReadOnly,
  panHandlers,
  setAuth,
  closeMessagesPane,
  clearMessagesSelection,
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
  isOrganizationAppsPanelOpen,
  isComplaintsPanelOpen,
}: Params) => {
  const rootPanHandlers =
    isSettingsPanelOpen ||
    isCreatePanelOpen ||
    isDiscoverPanelOpen ||
    isRecruitmentPanelOpen ||
    isAuditPanelOpen ||
    isPolicyPanelOpen ||
    isIntegrationsPanelOpen ||
    isAutomationPanelOpen ||
    isReportsPanelOpen ||
    isGovernancePanelOpen ||
    isFeaturePanelOpen ||
    isOrgProfilePanelOpen ||
    isCoursesPanelOpen ||
    isOrganizationAppsPanelOpen
    || isComplaintsPanelOpen
      ? {}
      : panHandlers;

  const onLogout = async () => {
    try {
      await clearAuthTokens();
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  const onAddPartnerPress = () => {
    openDiscoverPanel();
  };

  const handleCloseMessages = () => {
    clearMessagesSelection?.();
    closeMessagesPane();
  };

  const onPartnerHeaderPress = () => {
    animatePartnerSheet(true);
  };

  const onOpenCreate = (kind: 'community' | 'group' | 'channel') => {
    if (isReadOnly) {
      Alert.alert('Subscribers', 'Subscribers can only view the feed.');
      return;
    }
    openCreatePanel(kind);
  };

  return {
    rootPanHandlers,
    onLogout,
    onAddPartnerPress,
    handleCloseMessages,
    onPartnerHeaderPress,
    onOpenCreate,
  };
};
