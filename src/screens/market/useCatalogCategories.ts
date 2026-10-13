import { useCallback, useEffect, useState } from 'react';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { FixedCategoryOption } from './market.constants';

type CatalogCategoryType = 'all' | 'product' | 'service';

const cachedCategoriesByType: Record<CatalogCategoryType, FixedCategoryOption[]> = {
  all: [],
  product: [],
  service: [],
};
const pendingRequestsByType = new Map<CatalogCategoryType, Promise<FixedCategoryOption[]>>();

const normalizePayload = (raw: any): FixedCategoryOption[] => {
  const source = raw?.data ?? raw ?? {};
  const payload = Array.isArray(source?.results) ? source.results : Array.isArray(source) ? source : [];
  return payload
    .filter((entry: any) => entry && typeof entry === 'object' && entry.id)
    .map((entry: any) => ({
      id: String(entry.id),
      name: entry.name ?? '',
      slug: entry.slug ?? '',
      description: entry.description,
      category_type: entry.category_type === 'service' ? 'service' : 'product',
      parent_id: entry.parent_id ? String(entry.parent_id) : null,
      parent_slug: entry.parent_slug ?? null,
      parent_name: entry.parent_name ?? null,
      sort_order: Number(entry.sort_order ?? 0),
    }));
};

const fetchCategories = async (categoryType: CatalogCategoryType): Promise<FixedCategoryOption[]> => {
  const response = await getRequest(ROUTES.commerce.catalogCategories, {
    errorMessage: 'Unable to load catalog categories.',
    params: categoryType === 'all' ? undefined : { category_type: categoryType },
  });
  return normalizePayload(response?.data ?? response);
};

export function useCatalogCategories(categoryType: CatalogCategoryType = 'all') {
  const cachedCategories = cachedCategoriesByType[categoryType];
  const [categories, setCategories] = useState<FixedCategoryOption[]>(cachedCategories);
  const [loading, setLoading] = useState(!cachedCategories.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedCategories.length) {
      setCategories(cachedCategories);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    if (!pendingRequestsByType.has(categoryType)) {
      pendingRequestsByType.set(categoryType, fetchCategories(categoryType));
    }
    pendingRequestsByType
      .get(categoryType)!
      .then((result) => {
        cachedCategoriesByType[categoryType] = result;
        setCategories(result);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load catalog categories', err);
        // Keep whatever categories were already shown rather than wiping
        // the list to empty on a transient network failure - an empty list
        // reads as "no categories exist" when it may really mean "couldn't
        // reach the server". Callers should surface `error` to the user.
        setError(err?.message ?? 'Unable to load categories.');
      })
      .finally(() => {
        pendingRequestsByType.delete(categoryType);
        setLoading(false);
      });
  }, [cachedCategories, categoryType]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCategories(categoryType);
      cachedCategoriesByType[categoryType] = result;
      setCategories(result);
      setError(null);
    } catch (err: any) {
      console.error('Failed to refresh catalog categories', err);
      setError(err?.message ?? 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }, [categoryType]);

  return { categories, loading, error, refresh };
}
