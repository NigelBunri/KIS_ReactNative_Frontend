import { canCreateShopFromProfile } from '../src/screens/tabs/profile/profile.utils';

describe('canCreateShopFromProfile', () => {
  // AND-247/AND-260: "Create Shop" used to always be enabled regardless of
  // plan, so a free/Pro-tier user filled out the whole create-shop form
  // only to be bounced by a backend Alert on submit (ShopViewSet enforces
  // "shops_limit" server-side). canCreateShopFromProfile backs the
  // up-front CTA gate added to ProfileScreen's "Create Shop" quick action,
  // mirroring the existing partner_profiles_can_create pattern.

  it('is blocked when the backend explicitly says the plan does not allow shop creation', () => {
    expect(canCreateShopFromProfile({ shop_profiles_can_create: false })).toBe(false);
  });

  it('is allowed when the backend explicitly says the plan allows shop creation', () => {
    expect(canCreateShopFromProfile({ shop_profiles_can_create: true })).toBe(true);
  });

  it('fails open (allowed) when the flag is missing - e.g. a profile cached before this field existed', () => {
    expect(canCreateShopFromProfile({})).toBe(true);
  });

  it('fails open (allowed) for a null/undefined profile, matching the pre-fix always-enabled behavior', () => {
    expect(canCreateShopFromProfile(null)).toBe(true);
    expect(canCreateShopFromProfile(undefined)).toBe(true);
  });
});
