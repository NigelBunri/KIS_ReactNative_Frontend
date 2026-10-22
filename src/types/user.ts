// Core user object returned by /api/v1/users/me/ and related endpoints.
// Fields marked optional may be absent depending on auth state or serializer scope.

export interface KISUser {
  id: string;
  pk?: string | number;
  username: string;
  display_name?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  email?: string | null;
  email_verified?: boolean;
  // Server-authoritative Google-link status, set only by
  // apps.kis_auth_bridge after a verified KIS Auth identity assertion is
  // redeemed - never client-writable (UserSerializer.Meta.read_only_fields
  // excludes `verification` entirely). `google.email` is the connected
  // Google account's email, distinct from the top-level `email` (contact
  // email), since linking an existing account never changes contact email.
  verification?: {
    google?: {
      linked: boolean;
      email: string | null;
      email_verified: boolean;
      linked_at: string;
    };
    [key: string]: unknown;
  } | null;
  is_active?: boolean;
  status?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  last_login?: string;
  // Top-level, not nested under profile - UserSerializer puts tier directly
  // on the user object (read_only_fields); ProfileSerializer (the profile
  // field below) has no tier column at all, despite KISUserProfile.tier
  // below suggesting otherwise. That mismatch is what let
  // ChannelStudioScreen.tsx read user?.profile?.tier (always undefined)
  // without a type error for a long time.
  tier?: string | null;
  profile?: KISUserProfile | null;
  // Server-authoritative Quick Lock PIN state — never the PIN or its hash,
  // just whether one is configured on this account. See QuickLockService.
  has_pin?: boolean;
  // legacy fields some endpoints still return
  user_id?: string;
  userId?: string;
}

export interface KISUserProfile {
  id?: string;
  display_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  cover_image?: string | null;
  // Misleading: ProfileSerializer never actually populates this - real
  // tier is KISUser.tier above, not this field. Kept for now since other
  // code may reference it; don't add new reads of user.profile.tier.
  tier?: string | null;
  verified?: boolean;
  // 'none' | 'open_for_work' | 'hiring', viewer-gated server-side (see
  // apps/accounts/visibility.py get_visible_work_status) - already public
  // by default unless the user explicitly restricts it.
  work_status?: string | null;
}
