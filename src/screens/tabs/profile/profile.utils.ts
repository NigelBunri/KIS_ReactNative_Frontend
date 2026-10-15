export const makeUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

export const formatMoney = (cents = 0) => {
  const value = Math.max(0, cents) / 100;
  return `${value.toFixed(2)}`;
};

export const parseCsv = (value: string | null | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

/**
 * AND-247/AND-260: whether the "Create Shop" quick action (ProfileScreen's
 * Business tab) should be enabled for this profile. Shops require a
 * Business+ plan server-side (ShopViewSet.perform_create enforces the
 * "shops_limit" tier feature, apps/commerce/views.py on backend/kis) - the
 * client used to have no idea, so a free/Pro-tier user could fill out the
 * whole create-shop form and only learn they're blocked from an Alert on
 * submit. `shop_profiles_can_create` (added to GET /profiles/me/ by
 * _shop_profile_summary) mirrors the existing partner_profiles_can_create
 * pattern. Defaults to true (not gated) when the field is absent - e.g. a
 * profile payload cached from before this flag existed server-side -
 * matching "fail open" rather than wrongly disabling the action for every
 * existing cached profile on rollout.
 */
export const canCreateShopFromProfile = (
  profile: { shop_profiles_can_create?: boolean } | null | undefined,
): boolean => profile?.shop_profiles_can_create !== false;
