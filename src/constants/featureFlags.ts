// src/constants/featureFlags.ts
const toBool = (value?: string | null) => value === 'true' || value === '1';
const env = (globalThis as any)?.process?.env ?? {};
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(env.KIS_EDU_V2 ?? null) || __DEV__,
  // Set KIS_MEDIA_VERIFICATION_ENABLED=false in .env to bypass AI scan (testing without AI keys)
  MEDIA_VERIFICATION_ENABLED: env.KIS_MEDIA_VERIFICATION_ENABLED !== 'false',
  // Suspended for now: registration/login skip OTP entirely and the backend
  // auto-verifies accounts (see KIS_PHONE_VERIFICATION_ENABLED on the API).
  // Set true here (and on the API) to bring phone verification back live.
  PHONE_VERIFICATION_ENABLED: toBool(env.KIS_PHONE_VERIFICATION_ENABLED ?? null),
  // KIS Auth (Google-backed identity, kisauth.kingdomimpactventures.org) —
  // recovery-first rollout per the Phase 2 design. Off by default: flip on
  // only once a real KIS Auth deployment + Google OAuth client exist.
  // Ships ALONGSIDE the existing email/phone recovery path, never replacing
  // it in this phase.
  KIS_AUTH_RECOVERY_ENABLED: toBool(env.KIS_AUTH_RECOVERY_ENABLED ?? null),
};
