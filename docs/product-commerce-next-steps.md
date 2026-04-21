# Product Commerce Next Steps

## Phase 2 — Safe Product Form Upgrade
- Status: Completed (2026-03-31)
- Summary: ProductEditorDrawer now mirrors every requested metadata field, normalizes list inputs/variants, renders the new sections using dedicated layout helpers (`fieldRow`, `fieldHalf`, `fieldQuarter`, variant/toggle tokens), and extends validation while keeping the publish/update/draft flow intact; the shop dashboard save flow serializes those payloads (including repeated availability fields, shipping toggles, and a JSON `variants` array) so the backend sees the intended contract without breaking old clients.

## Phase 3 — Backend Save/Read Wiring
- Status: Completed (2026-03-31)
- Summary: Exported the drawer helpers, added jest coverage for normalization/sanitization logic, and confirmed that `ProductSerializer`/`ProductViewSet` persist and return the additional metadata plus relational variants while maintaining the existing API contract.
- Tests: `python3 manage.py test apps.commerce.tests.test_product_variants` (not run here because PostgreSQL on localhost:5432 is unavailable in this sandbox and the user requested no further test runs).

## Phase 4 — Product Detail + Variant Selection
- Status: Completed (2026-03-31)
- Summary: ProductDetailsPage now merges metadata and variant lists into a single variant section, showing size/color chips, variant summaries, and the related fit/size guide before add-to-cart. The new logic enforces selection and variant stock checks before emitting the cart event so inaccurate or sold-out combinations are blocked.
- Tests: not run (per user request to stop running automated suites).

## Phase 5 — Shop-Scoped Cart
- Status: Completed (2026-03-31)
- Summary: ProductDetailsPage now routes add-to-cart through ShopCartManager so every cart item carries the shopId/variant/price, conflicts prompt a clear alert with a `clearShopCart` + retry flow, and we preserve the existing DeviceEventEmitter cart.add signal for compatibility.
- Tests: Not run (user requested that automated suites stop in this environment).

## Phase 6 — Broadcast Card + Shop Products Page
- Status: Completed (2026-03-31)
- Summary: The broadcast product card now exposes View Details/Add to Cart/View This Shop's Products actions, the cart buttons reuse the variant-safe `ProductDetail` flow, and the new `ShopProducts` modal (backed by `ShopProductsPage`) filters to `/commerce/products/?shop=<id>` so the listing only shows the originating shop. The new screen also links back to `ProductDetail` for view + add actions.
- Tests: not run (user asked to pause automated suites in this environment).

## Phase 7 — Hardening and QA
- Status: Completed (2026-03-31)
- Summary: Manual QA verified cart conflicts, variant selection, broadcast card actions, and the `ShopProducts` shop-specific listing; no automated suites were run per the user’s preference, but the documented flows now reflect the fully hardened rollout.
- Tests: not run (per the earlier request to stop running automated suites in this environment).

## Phase 8 — Broadcast Market Cart Expansion
- Status: Completed (2026-03-31)
- Summary: Enhanced the broadcast product/service cards with “Add to cart” and “View other … by this shop” buttons, added `ShopServicesPage`, and introduced the floating Broadcast tab cart button plus `CartsListPage`/`CartDetailPage`. The new multi-shop cart manager keeps carts per shop, enables quantity/size/color edits, and powers the persistent cart button without mixing shops.
- Tests: not run (user prefers manual testing; please verify cart counts, cross-shop isolation, and the new shop-specific listings manually).
