# Product Commerce Decisions

## Phase 1 decisions
- Existing `Product` model already stores the requested core and additional metadata (sku, brand, condition, sale_price, compare_at_price, material, fit, size_guide, weight/length/width/height, low_stock_threshold, dimensions, requires_shipping/pickup/allow_backorder). Therefore no new migrations are needed for these attributes in this phase.
- Product serializer already exposes the majority of the fields; future work may wire any missing ones to ensure the editor and detail view get them.
- Cart enforcement is already per-shop via `Cart.user -> Cart.shop` and `CartViewSet` validation; we will respect that constraint when implementing the new cart UX.
- Contract for extended product payload:
  - `variants`: array of objects containing `{ sku?, size?, color?, price_cents?, price?, stock_qty?, image_url? }` along with metadata for `fit`/`size_guide`/`available_sizes`/`available_colors` as strings or arrays.
  - `dimensions`: optional `weight`, `length`, `width`, `height` fields in cents/units; backend stores decimals so the UI should send string/number values.
  - `shipping_controls`: boolean flags (`requires_shipping`, `pickup_available`, `allow_backorder`, `low_stock_threshold`).
- Future variant persistence should be additive to the `Product` table (via separate `ProductVariant` model) and have a serializer that includes the relevant fields while keeping legacy payloads (without `variants`) working.

## Phase 2 decisions
- ProductEditorDrawer now keeps the existing publish/update and draft flows while covering every requested metadata field (direct product attributes or legacy `attributes` fallbacks), normalizing availability lists, and extending validation for pricing bounds, dimensions, thresholds, and variant price/stock requirements.
- The shop dashboard save handler builds a backward-compatible `FormData` payload that appends the new scalars only when provided, emits the boolean shipping toggles on every save, writes availability lists as repeated fields (with an explicit empty value to clear), and serializes the variants array so the API can adopt the shape without breaking legacy clients.
- Layout and helper additions (`fieldRow`, `fieldHalf`, `fieldQuarter`, variant/toggle tokens, `normalizeListInput`, `serializePayload`) keep the drawer rendering consistent and allow us to serialize gallery images, availability arrays, and variants without regressing the existing payload contract.

## Phase 3 decisions
- Product persistence now stores variants both inside the existing `Product.variants` JSON field (for backward compatibility and API responses) and as relational `ProductVariant` rows so downstream services can query them reliably.
- Variant data is normalized during `ProductSerializer.validate` (JSON parsing, price quantization, stock bounds, metadata key mapping) and the cleaned list is exposed via serializer attributes so the view can sync the relational variants without the view needing to re-parse raw input.
- `ProductViewSet` now reconciles variants after each save: update existing `ProductVariant` rows when IDs match, create new rows for new entries, delete variants omitted from the latest payload, and reuse `_decimal_from_value`/stock helpers so the persisted variant rows never store invalid price/stock.
- Added `tests/test_product_variants.py` so `_sync_product_variants` can be validated before shipping further metadata flows.
- Exported the drawer's helper functions and added focused jest coverage, ensuring list normalization and variant sanitization behave before hitting the established API contract even if the backend repository is updated separately.

## Phase 4 decisions
- Product details now merge normalized metadata and variant payloads to build size/color chips, disable invalid combinations, and surface a per-variant summary, keeping price/stock/fit info consistent while still falling back to product-level data.
- Add-to-cart now enforces variant selection (size/color) and stock availability before emitting the cart event so users cannot queue incomplete or out-of-stock combinations.

## Phase 5 decisions
- ProductDetailsPage now derives the correct shop identifier for the current product and hands the item to `ShopCartManager.addToShopCart`, making the local cart tied to a single shop before the cart event fires while still emitting `DeviceEventEmitter` for existing listeners.
- When a conflicting shop cart already exists, the UI surfaces a descriptive alert that can clear the prevailing cart via `clearShopCart` and immediately retry the add, giving users an explicit way to switch shops without mixing products.

## Phase 6 decisions
- Broadcast product cards now show explicit "View details", "Add to cart", and "View this shop's products" buttons; the buttons route to `ProductDetail` when supported variants are missing and open the new `ShopProducts` modal when users want to browse the originating shop, ensuring each button stays shop-scoped.
- Introduced `ShopProductsPage` (and the `ShopProducts` stack route) which queries `/api/v1/commerce/products/?shop=<id>` with pagination, renders each product card with price/stock metadata, and reuses the detail screen for both viewing and cart additions so the cache remains consistent with the phase-4 variant flow.

## Phase 7 decisions
- Hardening focused on guarding the new broadcast buttons, cart modal, and `ShopProductsPage` so the variant picker and cart conflict flows remain shop-scoped; manual QA covered the cart conflict alert, navigation into `ProductDetail`, and the shop-only product list. No automated suites were run per the earlier user request, but the manual validation confirms the flows remain stable.

## Phase 8 decisions
- Introduced a multi-shop `ShopCartManager` that treats each shop as its own cart, keeps each entry keyed by product/variant, and exposes add/update/remove/delete helpers plus totals so the UI can show counts without merging shops.
- Reused the existing product detail flow for “Add to cart” while letting broadcast cards show the new “View other … by this shop” actions; services get a symmetric navigation path via `ShopServicesPage` so only that shop’s services are ever visible.
- Added the floating Broadcast Market cart button (powered by the new totals) and wired in `CartsListPage`/`CartDetailPage`, giving users direct controls for quantity, size, color, item removal, and clearing an entire shop cart without impacting other shops.
