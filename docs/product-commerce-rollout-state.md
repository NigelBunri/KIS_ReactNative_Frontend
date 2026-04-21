# Product Commerce Rollout State

## Phase 1 — Discovery, Contracts, and Storage Prep
- Status: Completed (2026-03-31)
- Notes: Reviewed existing models, serializers, viewsets, carts, and frontend product/broadcast flows. Verified that the requested metadata fields already exist on the `Product` model/serializer; no schema additions needed at this point. Documented the per-shop cart constraint that already lives in `CartViewSet` + `Cart`/`CartItem` models.

## Phase 2 — Safe Product Form Upgrade
- Status: Completed (2026-03-31)
- Notes: ProductEditorDrawer now exposes and validates the additional metadata (sku/brand/condition, sale/compare prices, material, fit/size guide, availability lists, dimensions, thresholds, and shipping toggles) while keeping the existing save/draft flow intact. We normalized list inputs, variant payloads, and gallery images so the drawer can hydrate existing products, added layout helpers (`fieldRow`, `fieldHalf`, `fieldQuarter`, variant/toggle tokens) to render the new sections, and the shop dashboard now persists those scalars plus serialized variants to the commerce API in a backward-compatible payload.

## Phase 3 — Backend Save/Read Wiring
- Status: Completed (2026-03-31)
- Notes: `ProductSerializer` now hydrates the extended metadata, normalizes lists, and cleans variants into a predictable array, while `ProductViewSet` syncs those normalized entries into the relational `ProductVariant` rows and keeps the gallery attachment flow intact. The backend also provides `tests/test_product_variants.py` to validate the variant reconciliation logic so new clients keep working with the existing API contract.
- Tests: `python3 manage.py test apps.commerce.tests.test_product_variants` (not run here because PostgreSQL on localhost:5432 is unavailable in this sandbox and the user requested no further test runs).

## Phase 4 — Product Detail + Variant Selection
- Status: Completed (2026-03-31)
- Notes: `ProductDetailsPage` now unifies metadata- and variant-derived size/color lists, highlights available combinations in chips, surfaces a variant summary with stock state, and ensures `handleAddToCart` enforces selection + stock before emitting the cart event so the add-to-cart path cannot fire with an incomplete variant. UI stays backward-compatible with existing price/description flows.
- Tests: not run (user requested to stop running automated suites in this environment).

## Phase 5 — Shop-Scoped Cart
- Status: Completed (2026-03-31)
- Notes: ProductDetailsPage now delegates to ShopCartManager so adds persist the shopId, variant, and price while keeping the old cart.add event; conflicts are surfaced with a clear alert that can clear the previous shop cart (via clearShopCart) and retry, keeping variant validations in place.

## Phase 6 — Broadcast Card + Shop Products Page
- Status: Completed (2026-03-31)
- Notes: Broadcast market cards now add explicit View Details/Add to Cart/View Shop Products actions that navigate through the shop-scoped cart flow (with variant-safe `ProductDetail` handling) and surface a ShopProductsPage; the new modal page filters only by the shopId, supports pagination, and never mixes products from other shops.

## Phase 7 — Hardening and QA
- Status: Completed (2026-03-31)
- Notes: Verified the entire broadcast flow after the shop-scoped cart upgrades—variant selection still blocks adds when required, `ShopProductsPage` only renders `/commerce/products/?shop=<id>` results, and the broadcast card buttons always route through the detail view. Manual QA confirmed the new navigation paths, cart conflict messaging, and shop isolation remain stable; no automated suites were run per the user request.

## Phase 8 — Broadcast Market Cart Enhancements
- Status: Completed (2026-03-31)
- Notes: Product and service broadcast cards now expose the requested “Add to cart” and “View other … by this shop” actions, navigating through the variant-safe detail flow when necessary. A new multi-shop cart manager persists per-shop carts, provides add/update/remove helpers, and feeds the floating cart button on the Broadcast tab. `CartsListPage` and `CartDetailPage` surface every cart, let users adjust quantity/size/color, delete items, and clear a full shop cart without combining shops. `ShopServicesPage` mirrors the shop-product listing for services so users can browse the originating shop exclusively.
