export const KIS_COIN_CODE = 'KISC';
export const KIS_COIN_LABEL = 'KIS Coin';
export const KIS_TO_USD_RATE = 100;

export const CATEGORY_SELECTION_LIMIT = 5;

export type FixedCategoryOption = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_type: 'product' | 'service';
  parent_id?: string | null;
  parent_slug?: string | null;
  parent_name?: string | null;
  sort_order?: number;
};
