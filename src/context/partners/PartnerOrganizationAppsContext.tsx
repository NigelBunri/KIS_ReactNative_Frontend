import React, { createContext, useContext, ReactNode } from 'react';
import usePartnerOrganizationApps, {
  PartnerOrganizationApp,
} from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

type PartnerOrganizationAppsContextValue = {
  apps: PartnerOrganizationApp[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const PartnerOrganizationAppsContext = createContext<PartnerOrganizationAppsContextValue | null>(null);

export const PartnerOrganizationAppsProvider = ({
  partnerId,
  children,
}: {
  partnerId?: string | null;
  children: ReactNode;
}) => {
  const { apps, loading, error, reload } = usePartnerOrganizationApps(partnerId);

  return (
    <PartnerOrganizationAppsContext.Provider
      value={{ apps, loading, error, reload }}
    >
      {children}
    </PartnerOrganizationAppsContext.Provider>
  );
};

export const usePartnerOrganizationAppsContext = () => {
  const context = useContext(PartnerOrganizationAppsContext);
  if (!context) {
    throw new Error(
      'usePartnerOrganizationAppsContext must be used within PartnerOrganizationAppsProvider',
    );
  }
  return context;
};
