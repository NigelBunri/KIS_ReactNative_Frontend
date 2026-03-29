export type MarketShop = {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  image_url?: string | null;
  employee_slots?: number;
  owner?: string;
  verified?: boolean;
  join_policy?: 'open' | 'request' | string;
  is_member?: boolean;
};

export type MarketProduct = {
  id: string;
  shop?: string;
  shop_name?: string;
  name?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  stock_qty?: number;
  image_url?: string | null;
  is_trending?: boolean;
  badge?: 'drop' | 'limited' | 'exclusive' | string;
  category?: MarketProductCategory;
  images?: MarketProductImage[];
};

export type MarketProductImage = {
  id: string;
  image_url?: string | null;
  order?: number;
};

export type MarketProductCategory = {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  category_type?: 'product' | 'service' | 'both';
  shop?: string;
};

export type MarketDrop = {
  id: string;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  is_live?: boolean;
  cover_url?: string | null;
  product_ids?: string[];
  shop_id?: string;
  shop_name?: string;
};

export type MarketHomePayload = {
  featured_drop?: MarketDrop | null;
  trending_products?: MarketProduct[];
  popular_shops?: MarketShop[];
  drops?: MarketDrop[];
};

export const normalizeList = <T,>(raw: any): T[] => {
  const d = raw?.data ?? raw ?? {};
  const payload = d?.results ?? d;
  return Array.isArray(payload) ? payload : [];
};

export const normalizeHome = (raw: any): MarketHomePayload => {
  const d = raw?.data ?? raw ?? {};
  return {
    featured_drop: d.featured_drop ?? null,
    trending_products: Array.isArray(d.trending_products) ? d.trending_products : [],
    popular_shops: Array.isArray(d.popular_shops) ? d.popular_shops : [],
    drops: Array.isArray(d.drops) ? d.drops : [],
  };
};
