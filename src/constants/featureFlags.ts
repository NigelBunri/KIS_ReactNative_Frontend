// src/constants/featureFlags.ts
const toBool = (value?: string | null) => value === 'true' || value === '1';
const env = (globalThis as any)?.process?.env ?? {};
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(env.KIS_EDU_V2 ?? null) || __DEV__,
};
