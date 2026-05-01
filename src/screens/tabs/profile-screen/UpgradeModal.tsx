import React from 'react';
import UpgradeSheet from '../profile/profile/sheets/UpgradeSheet';

type UpgradeModalProps = {
  tiers: any[];
  accountTier: any;
  saving: boolean;
  onUpgrade: (tierId: string) => Promise<void> | void;
  subscription?: any;
  billingHistory?: any;
  usage?: Record<string, any>;
  onCancel?: (immediate?: boolean) => void;
  onResume?: () => void;
  onDowngrade?: (tierId: string) => void;
  onRetry?: (txRef: string) => void;
};

export function UpgradeModal(props: UpgradeModalProps) {
  return <UpgradeSheet {...props} />;
}
