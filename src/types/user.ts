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
  is_active?: boolean;
  status?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  last_login?: string;
  profile?: KISUserProfile | null;
  // legacy fields some endpoints still return
  user_id?: string;
  userId?: string;
}

export interface KISUserProfile {
  id?: string;
  display_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  cover_image?: string | null;
  tier?: string | null;
  verified?: boolean;
}
