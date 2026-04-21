export const KISC_CURRENCY = 'KISC';
export const FRONTEND_KISC_MAJOR_TO_BACKEND_CENTS = 10000;

export const normalizeCurrencyValue = (value: number | string | null | undefined) => {
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

export const formatKiscAmount = (
  value: number | string | null | undefined,
  options?: { decimals?: number; suffix?: string },
) => {
  const numeric = normalizeCurrencyValue(value);
  const decimals = options?.decimals ?? 2;
  const suffix = options?.suffix ?? KISC_CURRENCY;
  return `${numeric.toFixed(decimals)} ${suffix}`;
};

export const formatKiscLabel = (
  value: number | string | null | undefined,
  options?: { decimals?: number; suffix?: string },
) => formatKiscAmount(value, options);

export const frontendKiscMajorToBackendCents = (
  value: number | string | null | undefined,
) => {
  const numeric = normalizeCurrencyValue(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * FRONTEND_KISC_MAJOR_TO_BACKEND_CENTS);
};

export const backendCentsToFrontendKisc = (
  value: number | string | null | undefined,
) => {
  const numeric = normalizeCurrencyValue(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric / FRONTEND_KISC_MAJOR_TO_BACKEND_CENTS;
};

export const backendOrderTotalToFrontendKisc = (
  value: number | string | null | undefined,
) => {
  const numeric = normalizeCurrencyValue(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric / 100;
};
