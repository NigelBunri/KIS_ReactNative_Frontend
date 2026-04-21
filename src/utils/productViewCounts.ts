import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@kis:product-view-counts';

const safeParse = (value: string | null): Record<string, number> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed).reduce<Record<string, number>>((acc, [key, val]) => {
      const numeric = Number(val);
      acc[key] = Number.isFinite(numeric) ? numeric : 0;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const persistCounts = async (counts: Record<string, number>) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // best effort only
  }
};

export const getProductViewCounts = async (): Promise<Record<string, number>> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
};

export const incrementProductViewCount = async (productId: string): Promise<number> => {
  if (!productId) {
    return 0;
  }
  const current = await getProductViewCounts();
  const nextCount = (current[productId] ?? 0) + 1;
  const next = { ...current, [productId]: nextCount };
  await persistCounts(next);
  return nextCount;
};

export const getProductViewCount = async (productId: string): Promise<number> => {
  if (!productId) {
    return 0;
  }
  const counts = await getProductViewCounts();
  return counts[productId] ?? 0;
};
