export const getSheetTitle = (activeSheet: string | null | undefined) => {
  if (activeSheet === 'editProfile') return 'Edit Profile';
  if (activeSheet === 'privacy') return 'Privacy & Visibility';
  if (activeSheet === 'editItem') return 'Edit Item';
  if (activeSheet === 'upgrade') return 'Upgrade Account';
  return 'Wallet & KIS-Coins';
};

export const getPartnerLimitText = (
  isUnlimited: boolean,
  label?: string,
  value?: number,
) => {
  if (isUnlimited) return 'Unlimited';
  if (label) return label;
  if (typeof value === 'number') return String(value);
  return '0';
};
