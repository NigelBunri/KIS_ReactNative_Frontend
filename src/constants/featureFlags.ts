// src/constants/featureFlags.ts
import { APP_ENV } from '../env';

const toBool = (value?: string | null) => value === 'true' || value === '1';
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(APP_ENV.KIS_EDU_V2) || __DEV__,
  // Set KIS_MEDIA_VERIFICATION_ENABLED=false in .env to bypass AI scan (testing without AI keys)
  MEDIA_VERIFICATION_ENABLED: (APP_ENV.KIS_MEDIA_VERIFICATION_ENABLED as string) !== 'false',
  // Suspended for now: registration/login skip OTP entirely and the backend
  // auto-verifies accounts (see KIS_PHONE_VERIFICATION_ENABLED on the API).
  // Set true here (and on the API) to bring phone verification back live.
  PHONE_VERIFICATION_ENABLED: toBool(APP_ENV.KIS_PHONE_VERIFICATION_ENABLED),
  // KIS Auth (Google-backed identity, kisauth.kingdomimpactventures.org) —
  // recovery-first rollout per the Phase 2 design. Off by default: flip on
  // only once a real KIS Auth deployment + Google OAuth client exist.
  // Ships ALONGSIDE the existing email/phone recovery path, never replacing
  // it in this phase.
  KIS_AUTH_RECOVERY_ENABLED: toBool(APP_ENV.KIS_AUTH_RECOVERY_ENABLED),
  // Gates the "Link Google Account" entry in Settings — separate from
  // RECOVERY because linking is what recovery depends on, not the same
  // user journey (mirrors KIS_AUTH_LINK_ENABLED on the Django side).
  KIS_AUTH_LINK_ENABLED: toBool(APP_ENV.KIS_AUTH_LINK_ENABLED),
  // Gates "Sign up with Google" on the registration screen.
  KIS_AUTH_REGISTRATION_ENABLED: toBool(APP_ENV.KIS_AUTH_REGISTRATION_ENABLED),
};
