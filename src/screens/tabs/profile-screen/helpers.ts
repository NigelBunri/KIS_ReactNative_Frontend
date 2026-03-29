export const countProducts = (shops: any[] | undefined) =>
  (shops ?? []).reduce((sum, shop) => {
    const products = Array.isArray(shop?.products) ? shop.products.length : 0;
    return sum + products;
  }, 0);
