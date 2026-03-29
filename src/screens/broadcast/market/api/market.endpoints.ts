export const MARKET_FEED_ENDPOINT = '/api/v1/commerce/market-feed/';
export const MARKET_SHOPS_ENDPOINT = '/api/v1/commerce/shops/';
export const MARKET_PRODUCTS_ENDPOINT = '/api/v1/commerce/products/';
export const MARKET_JOIN_SHOP_ENDPOINT = (shopId: string) => `/api/v1/commerce/shops/${shopId}/join/`;
export const MARKET_SUBSCRIBE_PRODUCT_ENDPOINT = (productId: string) =>
  `/api/v1/commerce/products/${productId}/subscribe/`;
export const MARKET_BROADCAST_PRODUCT_ENDPOINT = (productId: string) =>
  `/api/v1/commerce/products/${productId}/broadcast/`;
