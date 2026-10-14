// src/constants/featureFlags.ts
import { APP_ENV } from '../env';

const toBool = (value?: string | null) => value === 'true' || value === '1';
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(APP_ENV.KIS_EDU_V2) || __DEV__,
  // Set KIS_MEDIA_VERIFICATION_ENABLED=false in .env to bypass AI scan (testing without AI keys)
  MEDIA_VERIFICATION_ENABLED: (APP_ENV.KIS_MEDIA_VERIFICATION_ENABLED as string) !== 'false',
  // Email/SMS OTP has been removed entirely (2026-10-14 KIS Auth migration).
  // Registration auto-verifies accounts and KIS Auth (Google) is now the
  // only source of email verification, recovery, and account linking.
  // KIS Auth (Google-backed identity, kisauth.kingdomimpactventures.org) is
  // the production default — these flags exist so a build can still be
  // shipped with one of them off if a specific rollout needs to stage it,
  // but none of them have an OTP fallback anymore if turned off.
  KIS_AUTH_RECOVERY_ENABLED: toBool(APP_ENV.KIS_AUTH_RECOVERY_ENABLED),
  // Gates the "Connect/Link Google Account" entry in Settings and the
  // post-registration linking prompt (mirrors KIS_AUTH_LINK_ENABLED on the
  // Django side).
  KIS_AUTH_LINK_ENABLED: toBool(APP_ENV.KIS_AUTH_LINK_ENABLED),
  // Gates "Sign up with Google" on the registration screen.
  KIS_AUTH_REGISTRATION_ENABLED: toBool(APP_ENV.KIS_AUTH_REGISTRATION_ENABLED),
};
