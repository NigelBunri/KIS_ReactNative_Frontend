# UX/UI Audit — Market

**Batch:** `src/screens/market/**` (32 files: root x9, `__tests__/` x1 [excluded — not touched], `addresses/` x1, `admin/` x1, `cart/` x3, `fulfillment/` x1, `orders/` x3, `returns/` x3, `wishlist/` x1)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility audit of the commerce/payment domain, not a file inventory. This batch was split across two passes. A prior pass already audited and fixed 22 files (listed under "Previously audited" below) and was independently re-verified against `git diff` + `npm run typecheck` before this pass began — those files were **not re-touched**; their diffs are summarized briefly here for completeness of the consolidated record. This pass covers the remaining 9 files that the first pass did not reach: `HowRewardsWorkScreen.tsx`, `InvoiceListScreen.tsx`, `LoyaltyScreen.tsx`, `ReferralScreen.tsx`, `ServiceBookingScreen.tsx`, `ShopDashboardScreen.tsx`, `TransactionHistoryScreen.tsx`, `cart/shopCartManager.ts`, `market.constants.ts`.

## Summary

32/32 files audited (22 in the prior pass, 9 in this pass, 1 test file correctly excluded). Across the full batch, destructive-action confirmation and payment-feedback clarity were the two recurring themes — both the prior pass and this one found and fixed real instances of the same two bug classes: **missing confirmation before a destructive action** (remove cart item at quantity 0, confirm-satisfied/release-payment, cancel booking, delete address, mark-completed — all fixed in the prior pass; shop-member removal — fixed in this pass) and **silent failure on a user-initiated action** (manual payment-status checks returning no feedback, a parse failure that could silently wipe product variant data, an off-by-one date bug in availability display — all fixed in the prior pass; a "Pay now" button that could silently do nothing if the device had no URL handler — fixed in this pass). The single most important issue across the whole batch is payment/trust-related: **`ServiceBookingScreen.tsx`'s "Pay now" button on the booking-success screen called `openDirectPaymentUrl` and discarded its return value** — the same helper that three sibling files (`ServiceBookingDetailsPage.tsx`, `CartDetailPage.tsx`, `MarketplaceOrderDetailPage.tsx`) already wrap with an `if (!opened) throw` + `Alert.alert` in the prior pass, because the helper *can* resolve `false` silently (e.g. no URL handler on the device) — on this screen it was the one place in the booking-deposit-payment flow left unguarded, meaning a customer who had already committed to paying a deposit could tap "Pay now" and see nothing happen with zero explanation. Fixed in this pass using the exact pattern already established in the sibling files. A second real gap was found in `ShopDashboardScreen.tsx`: the "Remove" button for a shop team member was wired directly to the delete call with no confirmation, unlike every other destructive action in this file (`confirmProductDelete`/`confirmServiceDelete` both confirm correctly) — fixed with the same confirm-then-destroy pattern. All other files in this pass (`HowRewardsWorkScreen`, `InvoiceListScreen`, `LoyaltyScreen`, `ReferralScreen`, `TransactionHistoryScreen`, `market.constants.ts`) were already solid: no destructive actions without confirmation, no silent failures, correct pricing-transparency language throughout the KIS Coins/rewards screens, and `cart/shopCartManager.ts` (a pure state/sync module, not a rendered screen) uses an intentional offline-first local-write + background-retry design that is correct, not a bug.

### Previously audited (22 files — summarized from `git diff`, not re-verified line-by-line in this pass)

- **`AvailabilityScheduler.tsx`** — Added `accessibilityLabel`s to day-availability toggles and a "remove time slot" icon button that had none.
- **`CategoryPickerModal.tsx`** — Added `accessibilityLabel="Close category picker"` to the modal's close control; minor layout/consistency cleanup.
- **`ProductEditorDrawer.tsx`** — Fixed a silent-data-loss risk: a variants string that failed to parse was silently shown as an empty variants list (indistinguishable from "no variants"), risking a seller wiping real variant data on next save. Now warns explicitly via `Alert.alert` instead.
- **`PromoCodeScreen.tsx`** — Fixed a pricing-transparency bug: fixed-amount discounts rendered with no currency unit (e.g. "-10"), leaving the user unsure if that meant 10 cents or 10 dollars off.
- **`ServiceBookingDetailsPage.tsx`** — Largest diff in the batch (301 lines). Added confirmation dialogs before cancel-booking, block/unblock-user, and confirm-satisfied/release-payment actions; added the `opened`-checking pattern around `openDirectPaymentUrl` (the canonical version this pass's `ServiceBookingScreen.tsx` fix now matches); added distinct success/error `Alert`s throughout a flow that previously left several branches with no user feedback.
- **`ServiceEditorDrawer.tsx`** — Added `Alert.alert` feedback for photo-library-open failures (previously silent); added `accessibilityLabel`s to close/remove-category/remove-featured-image/remove-photo icon-only controls.
- **`ShopEditorDrawer.tsx`** — Same photo-library-failure `Alert.alert` fix and close-button `accessibilityLabel` as above, plus one additional confirmation dialog.
- **`addresses/AddressListPage.tsx`** — Fixed a real destructive-action gap: deleting a saved address was previously one tap with zero confirmation, directly adjacent to "Edit" and "Set default" in the same row (easy mis-tap). Added a confirm dialog; added `accessibilityLabel`s to back/close icon buttons.
- **`admin/MarketAdminScreen.tsx`** — Added `accessibilityLabel="Go back"` to the back button; added one missing confirmation `Alert.alert` on an admin action.
- **`availabilityUtils.ts`** — Fixed a genuine date-parsing bug: `"YYYY-MM-DD"` keys were parsed with `new Date(str)`, which the JS spec treats as UTC midnight, so the displayed availability date could be off by one day in any timezone behind UTC. Now parses local calendar components explicitly.
- **`cart/CartDetailPage.tsx`** — Largest fix set in cart/: dropping item quantity to 0 (which deletes the item) now confirms like "Remove item" instead of silently deleting; added a distinct "still processing" vs. "unable to check status" `Alert` for the user's manual "Check payment status" tap (previously: background AppState-triggered polling and the user's own manual tap shared one silent-catch, so a manual tap that failed looked like nothing happened); wrapped `openDirectPaymentUrl` with the `opened`-check pattern.
- **`cart/CartsListPage.tsx`** — Fixed an error-message collision: a real network/load failure and "this shop genuinely has no shipping methods configured" rendered identical empty-state text, so the buyer couldn't tell a bug from an expected state apart; also removed a redundant fallback message that contradicted a more specific one already shown.
- **`fulfillment/FulfillmentQueuePage.tsx`** — Added a missing confirmation `Alert.alert` before a fulfillment-queue action; added `accessibilityLabel="Go back"`.
- **`market.styles.ts`** — Bumped an icon-button style from 34×34 to the ~44pt minimum recommended touch target (flagged as currently unused by any market screen, but corrected so a future consumer doesn't inherit a sub-minimum tap area).
- **`orders/MarketplaceOrderDetailPage.tsx`** — Added `accessibilityLabel="Go back"`; wrapped `openDirectPaymentUrl` with the `opened`-check pattern (one of the three sibling files whose pattern this pass's `ServiceBookingScreen.tsx` fix now also follows).
- **`orders/MyOrdersPage.tsx`** — Added two missing confirmation `Alert.alert`s around order actions.
- **`orders/ProviderOrdersPage.tsx`** — Added one missing confirmation `Alert.alert` (consistent with the "mark completed" / destructive-action pattern established across this batch).
- **`returns/MyReturnsPage.tsx`** — Added a confirmation `Alert.alert` and `accessibilityLabel="Go back"`.
- **`returns/ReturnRequestCreatePage.tsx`** — Added `accessibilityLabel="Go back"`.
- **`returns/ReturnsManagementPage.tsx`** — Added two confirmation `Alert.alert`s and `accessibilityLabel="Go back"`.
- **`useCatalogCategories.ts`** — Fixed a silent-failure/misleading-empty-state bug: a transient network failure previously wiped the categories list to empty, which reads identically to "no categories exist." Now keeps the last-known list on a transient failure and surfaces `error` separately for callers to show.
- **`wishlist/WishlistPage.tsx`** — Fixed a blast-radius bug: a single wishlist item's remove-action failure previously called the page-level `setError()`, which swapped the *entire* list out for a bare error message — so one failed removal made every other saved item disappear from view. Now shows a per-action `Alert` instead, leaving the rest of the list intact.

---

## HowRewardsWorkScreen (`src/screens/market/HowRewardsWorkScreen.tsx`)
**Entry point:** `HowRewardsWork` (modal route, linked from `LoyaltyScreen` and `ReferralScreen`'s "How it works" header links).
**Criteria evaluated:** visual hierarchy/layout, typography/spacing, color/contrast (theme tokens), navigation/back behavior, cognitive load, pricing/redemption transparency, small-screen usability.
**Not applicable:** forms/validation (none — pure informational content); destructive actions (none); loading/empty/error/offline states (static content, no network calls); touch targets beyond the single back button (no other interactive controls); accessibility labels on icon-only controls (there are none — the only control is a labeled text "Back" button).

### Findings
1. **Good: redemption-cap language is deliberately conservative and backend-aligned.** The 40/60/20 caps are stated as the real backend policy (per the file's own header comment, cross-referenced against `apps.rewards.models.RedemptionPolicy`/`apps.billing.services.calculate_redemption`), and the copy explicitly says the real discount is "always calculated by KIS at checkout... never something the app predicts or promises in advance" — this is exactly the kind of pricing-transparency framing the audit brief asks for, not overstating what the app can guarantee.
2. **Good: referral-rate language correctly avoids restating a number that can change.** Unlike the redemption caps (fixed safety rule), referral rates are deliberately not quoted as a fixed percentage here since they're configurable server-side; the screen correctly defers to the live `ReferralScreen` instead and explains the "locked in at qualification time" semantics clearly.
3. **Minor: no error boundary needed, but also no way back if navigation state is ever lost (P3, theoretical).** `navigation.goBack()` on a modal route is safe in all realistic entry paths (always pushed from `Loyalty`/`Referrals`), so this is not a practical gap — noted only for completeness.

### Fixes implemented
None — this screen meets the bar as-is. It is a purely informational, backend-policy-aligned screen with no forms, no destructive actions, and no network calls to fail silently.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## InvoiceListScreen (`src/screens/market/InvoiceListScreen.tsx`)
**Entry point:** `InvoiceList` (modal route).
**Criteria evaluated:** loading/empty/error states, forms/validation (n/a), destructive actions (none — view/download only), silent-error-swallowing, pricing transparency, touch targets, small-screen usability.
**Not applicable:** forms/validation (no input forms); offline/permission states beyond the generic retry-on-error path already present.

### Findings
1. **Good: download failure already surfaces a specific error, not a silent no-op.** `downloadInvoicePdf`'s `catch` block shows `Alert.alert('Error', err?.message ?? 'Could not open the invoice PDF.')` — no silent-failure gap here.
2. **Good: amount/currency formatting is consistent between the list and the detail sheet.** `formatAmount` is used uniformly for the card total, the detail-sheet "Amount" row, and each line item, so there's no risk of the summary and the breakdown disagreeing on currency formatting.
3. **Minor: the bottom-sheet "Close" button and the backdrop-tap-to-dismiss both exist but aren't a touch-target problem (no fix needed).** `closeBtn` is a full-width button with generous padding; fine as-is.

### Fixes implemented
None — this screen meets the bar as-is. It is read-only (view/download), already distinguishes "not yet generated" from "download failed," and has no destructive actions to confirm.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## LoyaltyScreen (`src/screens/market/LoyaltyScreen.tsx`)
**Entry point:** `Loyalty` (modal route, "KIS Coins" home).
**Criteria evaluated:** visual hierarchy, pricing/redemption transparency, loading/empty/error states, journey integration (earn → redeem), color/contrast, cognitive load.
**Not applicable:** forms/validation (no input forms — this screen deliberately has no generic "spend coins" form, by design, since the backend has no generic spend action); destructive actions (none).

### Findings
1. **Good: deliberately avoids re-creating a redemption action the backend doesn't support.** Per the file's own header comment, the only real backend redemption mechanism is applying coins toward a subscription upgrade; this screen correctly routes to `SubscriptionManagement` instead of inventing a free-form "redeem" form that would silently do nothing on submit. This is the right call for the "trust/pricing transparency" criterion — it avoids a worse failure mode than any UI bug would (a form that *looks* functional but isn't wired to anything real on the backend).
2. **Good: three parallel `getRequest` calls (balance/achievements/history) are correctly independent.** Each checks its own `.success` before updating its own piece of state, and the aggregate-failure branch (`!balanceRes?.success && !achievementsRes?.success && !historyRes?.success`) only fires when *all three* fail — a single endpoint being briefly down doesn't blank the whole screen.
3. **Minor: disclaimer copy duplicates `HowRewardsWorkScreen`'s wording almost verbatim (P3, cosmetic).** Not a UX bug, just a content-maintenance note — if the legal/compliance disclaimer ever changes, it needs updating in two places.

### Fixes implemented
None — this screen meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## ReferralScreen (`src/screens/market/ReferralScreen.tsx`)
**Entry point:** `Referrals` (modal route).
**Criteria evaluated:** pricing/rate transparency, loading/empty/error states, trust (share-link correctness), color/contrast, cognitive load.
**Not applicable:** forms/validation (no input forms); destructive actions (none).

### Findings
1. **Good: `Share.share` failure is caught and intentionally silent, which is the right call here (no fix needed).** `.catch(() => {})` after `Share.share` looks like the silent-failure pattern the audit hunts for, but it isn't one in practice: React Native's native share sheet being dismissed by the user (the overwhelmingly common "failure" path) is not an error worth alerting on, and a genuine share-sheet failure leaves the user exactly where they started with no irreversible side effect — there's nothing to "recover" from. This is a correct, deliberate silence, distinct from the manual-payment-check and Pay-now bugs found elsewhere in this batch where a *user-initiated, consequential* action failed with no feedback.
2. **Good: rate-locking language matches `HowRewardsWorkScreen` exactly ("locked in at qualification time... does not change retroactively").** Consistent trust framing across both screens.
3. **Minor: `summary!.history` uses a non-null assertion right after a `.length ?? 0 === 0` check on the same optional (P3, code-quality nit, not user-facing).** Safe in practice (the ternary guarantees `summary` is non-null on that branch) but slightly fragile style; not touched since it carries no observable behavior risk and touching it would be unrelated refactor scope.

### Fixes implemented
None — this screen meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## ServiceBookingScreen (`src/screens/market/ServiceBookingScreen.tsx`)
**Entry point:** `ServiceBooking` (modal route, reached from `ShopDashboardScreen`'s "Book service" button and from broadcast/shop product surfaces).
**Criteria evaluated:** forms/validation, destructive-action confirmations (n/a — see below), pricing transparency (deposit/remaining breakdown), silent-error-swallowing (explicit audit focus — this is where the batch's most important finding is), loading/error states, idempotency on submit, touch targets, journey integration (select slot → review → pay).
**Not applicable:** destructive actions requiring a confirm dialog (the booking-confirm action is itself gated behind an explicit "Review booking" step that shows the full price breakdown before the user can submit — functionally equivalent to a confirmation, so no additional `Alert` confirm was needed there).

### Findings
1. **Silent failure on "Pay now" (P1 — payment/trust, the most important finding in this batch).** On the booking-success step, tapping "Pay now" called `void openDirectPaymentUrl(directPayment.paymentUrl)` and discarded the returned boolean. `openDirectPaymentUrl` (`src/utils/directPaymentHandoff.ts`) resolves `false` without throwing when `Linking.canOpenURL` reports no handler for the URL — in that case the button would show no loading state, show no error, and simply do nothing. A customer who just committed to a deposit for a service booking, with their deposit amount already displayed, could tap "Pay now" and see zero feedback on failure, with no way to tell if the booking even went through. The sibling files `ServiceBookingDetailsPage.tsx`, `cart/CartDetailPage.tsx`, and `orders/MarketplaceOrderDetailPage.tsx` all already guard this exact same helper with `const opened = await openDirectPaymentUrl(...); if (!opened) throw new Error(...)` wrapped in a try/catch that shows `Alert.alert('Checkout', ...)` — this file was the one call site in the deposit-payment flow that the prior audit pass missed.
2. **Good: the Review step is a genuine, complete price breakdown before submission.** Total price, deposit ("Due now" for quote/negotiation flows, "Deposit (Flutterwave)" otherwise), and remaining balance are all shown distinctly and correctly before the "Confirm & pay"/"Confirm booking"/"Confirm request" button — satisfying the "is the final charged amount always clear before submission" criterion.
3. **Good: booking submission already uses an idempotency key and distinguishes a real slot conflict from a network retry.** `generateIdempotencyKey` plus an explicit 409/"already been booked" conflict check means a dropped connection's automatic retry won't be misread as "the slot is taken" when the original request actually succeeded.

### Fixes implemented
- Added a `handlePayNow` callback with its own `paymentOpening` loading state. It awaits `openDirectPaymentUrl`, throws a descriptive error if it resolves `false`, and shows `Alert.alert('Checkout', error?.message || 'Unable to open checkout.')` on failure — matching the exact pattern already used in `ServiceBookingDetailsPage.tsx`. The "Pay now" button now shows a loading spinner while opening and is disabled during that window, so a slow or failed open no longer looks like an unresponsive tap.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 new errors or warnings introduced (file was already warning-free before this change on the lines touched).

**Status:** AUDITED-FIXED

---

## ShopDashboardScreen (`src/screens/market/ShopDashboardScreen.tsx`)
**Entry point:** `ShopDashboard` (modal route, the shop owner's management console — Overview/Products/Services/Members/Analytics/Landing tabs).
**Criteria evaluated:** destructive-action confirmations (explicit audit focus — this is a large, action-dense screen), accessibility labels on icon-only controls, silent-error-swallowing, cognitive load (6-tab console), color/contrast, touch targets.
**Not applicable:** pricing-transparency-before-submission (this screen configures prices/discounts for products and services, it doesn't charge the shop owner anything directly — the actual checkout pricing-clarity criteria apply to the customer-facing screens, not this owner console); offline state (this is an always-online management tool with `useFocusEffect`-driven refreshes, consistent with the rest of the owner-facing surfaces in this codebase).

### Findings
1. **Missing confirmation before removing a shop team member (P1 — destructive action without confirmation, exactly the bug class this audit was briefed to hunt for).** The Members tab's "Remove" button (`variant="danger"`) called `handleRemoveMember(memberId)` directly with no confirmation step — one mis-tap permanently and immediately revokes a real person's access to the shop, with no "are you sure?" anywhere in the path. This is inconsistent with the rest of the same file: `confirmProductDelete` and `confirmServiceDelete` (both a few hundred lines away) correctly show an `Alert.alert` with Cancel/Delete before calling their respective delete handlers. Member removal had no equivalent guard.
2. **Icon-only "add rating" control missing an accessibility label (P3).** The small circular `+` button that opens the star-rating modal on each product/service card (`<KISIcon name="add" .../>` inside a bare `Pressable`) had no `accessibilityRole` or `accessibilityLabel`, so a screen-reader user would hear nothing describing what the control does.
3. **Good: product/service delete, broadcast toggle, landing-visibility toggle, and membership-visibility toggle are all already correct.** Delete actions confirm properly (see above); broadcast/landing/membership toggles are reversible settings (not data-destroying), and each already gives a distinct success/error `Alert` after checking `response?.success` — no fabricate-success-on-failure pattern found anywhere in this 3,500+ line file despite its size and action density.
4. **Good: role-change via the member slider has no confirmation, and correctly doesn't need one.** Unlike removal, changing a member's role (`manager`/`admin`/`member`) is non-destructive and trivially reversible by sliding back — consistent with not over-confirming low-stakes, reversible actions elsewhere in this batch.

### Fixes implemented
- Added a `confirmRemoveMember` wrapper (mirroring `confirmProductDelete`/`confirmServiceDelete`'s existing pattern exactly) that shows `Alert.alert('Remove member', ...)` with Cancel/Remove (destructive style) before calling the existing `handleRemoveMember`. The member's `display_name` is interpolated into the confirmation copy when available. The "Remove" button now calls `confirmRemoveMember(memberId, user.display_name)` instead of `handleRemoveMember(memberId)` directly.
- Added `accessibilityRole="button"` and a dynamic `accessibilityLabel` (`"Rate this service"` / `"Rate this product"`) to the icon-only rating-modal trigger.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 new errors introduced; one pre-existing `@typescript-eslint/no-unused-vars` error on an unrelated line (`responsive` declared but unused, line ~772) was confirmed present on the unmodified file via `git stash` before these edits and is therefore out of this fix's scope. All other eslint output is pre-existing `react-native/no-inline-styles` warnings, untouched by this change.

**Status:** AUDITED-FIXED

---

## TransactionHistoryScreen (`src/screens/market/TransactionHistoryScreen.tsx`)
**Entry point:** `TransactionHistory` (modal route, the permanent in-app wallet-transaction receipt record).
**Criteria evaluated:** pricing/receipt transparency, loading/empty/error states, silent-error-swallowing, destructive actions (none — view/download/email-receipt only), touch targets, forms/validation (n/a).
**Not applicable:** forms/validation (no input forms); destructive actions (none present).

### Findings
1. **Good: receipt-download and email-receipt failures both already surface distinct, specific errors.** `handleDownload`'s `Linking.openURL(...).catch(() => Alert.alert('Error', 'Could not open the receipt.'))` and `handleEmailReceipt`'s try/catch (`Alert.alert('Error', e?.message ?? 'Could not send receipt email.')`) both correctly tell the user what happened rather than failing silently — no gap here.
2. **Good: email-receipt button correctly scopes its loading state per-row.** `emailingId` disables only the tapped transaction's button and shows a spinner in its place, leaving other rows interactive — same correct pattern as `ShopDashboardScreen`'s per-row `removingMemberId`/`broadcastingProductId`.
3. **Good: "not available" vs. "download failed" are correctly distinguished.** A missing receipt URL shows `Alert.alert('Not available', ...)` before ever attempting to open anything; an open failure after a URL exists shows a different, specific message — this is exactly the kind of distinction the batch's `InvoiceListScreen` also gets right and that other already-fixed files in this batch (e.g. `cart/CartsListPage.tsx`'s shipping-methods fix) previously got wrong.

### Fixes implemented
None — this screen meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## shopCartManager (`src/screens/market/cart/shopCartManager.ts`)
**Entry point:** Not a screen — a singleton state/sync module imported by `cart/CartDetailPage.tsx`, `cart/CartsListPage.tsx`, and shop/product surfaces that add items to cart. Audited for correctness of the UX-relevant guarantees it provides to its screen consumers (optimistic local state, background sync, error handling), not against the per-screen UI criteria.
**Criteria evaluated:** silent-error-swallowing / fabricate-success-on-failure (the two patterns this audit was explicitly briefed to hunt for), since this module is where the actual network-sync behavior behind the cart screens' UI lives.
**Not applicable:** all visual/layout/accessibility criteria (no rendered UI in this file); destructive-action confirmation (this module has no user-facing confirmation surface — that responsibility correctly lives in the calling screens, e.g. `CartDetailPage.tsx`'s already-fixed "Remove item" confirm dialog that calls into this module's `removeShopCartItem`/`updateShopCartItem`).

### Findings
1. **Good: the local-first-write-then-background-sync design is intentional and correct, not a fabricate-success bug.** `addToShopCart`/`updateShopCartItem`/`removeShopCartItem` all update local state and `persistState()` to `AsyncStorage` synchronously, then kick off `syncCartItemWithBackend`/`deleteRemoteCartItem` with `void` (fire-and-forget). At first glance this resembles the "fabricate success on failure" pattern flagged elsewhere in the codebase, but it is meaningfully different: the "success" being reported (item added/updated/removed from the *local* cart) is real and immediately observable, and a remote-sync failure is caught and queued for retry via `enqueueMutation` rather than silently dropped — this is a standard, deliberate offline-first cart design, not a bug. The already-audited `CartDetailPage.tsx`/`CartsListPage.tsx` build their own success/error UI on top of this module's return values and don't report this as an issue either.
2. **Good: remote-cart-conflict handling (`ensureRemoteCart`) correctly recovers from a 400/409 "active cart already exists" response** by re-fetching the current active cart rather than failing the whole add-to-cart flow — this protects the calling screens from a confusing "add to cart failed" message in a case that is actually recoverable.
3. **Minor: `console.warn` calls on background-sync failures (`syncCartItemWithBackend`, `fetchActiveCartById`, etc.) are dev-only visibility, not user-facing — correctly so (no fix needed).** Since the UI-facing success already happened via the local write, there is nothing for the user to be alerted about here; surfacing every background sync retry to the user would be noise, not useful feedback.

### Fixes implemented
None — this module's error-handling design is correct for its purpose.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## market.constants (`src/screens/market/market.constants.ts`)
**Entry point:** Not a screen — a shared constants module (currency labels, category-selection limit) imported across the market domain.
**Criteria evaluated:** None of the per-screen UX criteria apply; reviewed only for anything that could cause a downstream pricing/trust bug (since `KIS_COIN_CODE`/`KIS_TO_USD_RATE` feed directly into price displays across this batch).
**Not applicable:** all UI/UX criteria — this file renders nothing and has no user-facing behavior of its own.

### Findings
1. **Good: the `KIS_COIN_CODE = 'USD'` / `KIS_TO_USD_RATE = 1` naming is confusing but not a functional bug.** The file's own comment marks this as "compatibility only; new commerce prices are USD-first" — i.e., this is a deliberate, documented transitional naming artifact from an older coin-denominated pricing model, not a live conversion rate that could silently misprice anything. No screen in this batch multiplies by `KIS_TO_USD_RATE` in a way that would be affected if this were ever cleaned up; flagging only as a code-hygiene note, not a UX/trust issue.

### Fixes implemented
None — out of scope for a UX audit (naming/constants hygiene, not a user-facing bug), and the constraint against touching pricing-calculation logic applies directly to this file.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES
