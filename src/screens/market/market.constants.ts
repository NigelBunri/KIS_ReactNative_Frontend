export const KIS_COIN_CODE = 'USD';
export const KIS_COIN_LABEL = 'USD';
export const KIS_TO_USD_RATE = 1; // compatibility only; new commerce prices are USD-first
export const MARKET_PAYMENT_PROVIDER_LABEL = 'Flutterwave';

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
