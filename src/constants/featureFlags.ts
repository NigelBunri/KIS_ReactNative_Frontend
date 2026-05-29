// src/constants/featureFlags.ts
const toBool = (value?: string | null) => value === 'true' || value === '1';
const env = (globalThis as any)?.process?.env ?? {};
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(env.KIS_EDU_V2 ?? null) || __DEV__,
  // Set KIS_MEDIA_VERIFICATION_ENABLED=false in .env to bypass AI scan (testing without AI keys)
  MEDIA_VERIFICATION_ENABLED: env.KIS_MEDIA_VERIFICATION_ENABLED !== 'false',
};
