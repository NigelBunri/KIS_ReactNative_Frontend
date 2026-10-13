# Audit: Broadcast Market, Media Extended, Pages, and Playlists

**Scope:** `src/screens/broadcast/market/**` (3 live files — `ProductDetailsPage.tsx` plus `pages/ShopProductsPage.tsx` and `pages/ShopServicesPage.tsx`; the other 12 files in this folder were confirmed dead and deleted earlier this session, and are not covered here), `src/screens/broadcast/media_extended/*.tsx` (6 files), `src/screens/broadcast/pages/*.tsx` (5 files, including `BroadcastMarketPage.tsx` — the real live Market tab — and `BroadcastHealthcarePage.tsx`), `src/screens/broadcast/playlists/*` (4 files, including the non-UI `playlistManager.ts` data module). **18/18 files audited.**

Total actionable findings: 42 (0 P0, 10 P1, 13 P2, 19 P3), plus 15 explicitly-noted positive observations (correct patterns worth calling out, not defects). Fixes were applied across 13 of the 18 files (status AUDITED-FIXED); 3 files needed no changes at all (AUDITED-NO-ISSUES); 2 files' findings were documented but intentionally left unfixed because the fix would touch backend contracts or shared/out-of-scope infrastructure (AUDITED-FINDINGS-DOCUMENTED). Within the 13 fixed files, 10 lower-risk findings were deliberately left as documented-only recommendations rather than fixed — each one touches a backend data-sharing default, a feature build (real audio playback), unrendered-but-fetched image fields, or a reversible seller-only action — with the reasoning given in that file's "Fixes implemented" section. `npm run typecheck` is clean; `npx eslint` is clean on every edit made in this pass (the few pre-existing errors/warnings it surfaces on these files — e.g. an unused `tokens` destructure in three playlist files, an unused `active` closure flag in two media_extended files — predate this pass and were not introduced by it).

**The single most important issue:** `BroadcastMarketPage.tsx` — the real, live implementation behind the app's Market tab — silently swallowed every load failure (`catch { setMarketItems([]) }`) and rendered the exact same "No broadcast products match the current filters" empty state for a network failure as for a genuinely empty marketplace, with no retry affordance anywhere on the screen. This is the "fabricate-success/silent-failure" anti-pattern called out in the task brief, on the single highest-traffic screen in this batch. It is now fixed: a `marketLoadError` state distinguishes the two cases and renders a distinct error message with a Retry button. The identical pattern was also found and fixed in all six `media_extended` screens and in `BroadcastJobsPage.tsx`.

A secondary, recurring trust issue: both `ShopProductsPage.tsx` and `BroadcastMarketPage.tsx` had a button labeled **"Buy now"** that did not buy anything — it just navigated to the product detail screen, identically to the adjacent "View details" button. Both were relabeled to "View & buy" (string-only change, no logic/nav touched).

---

## ProductDetailsPage (`src/screens/broadcast/market/ProductDetailsPage.tsx`)
**Entry point:** `RootStackParamList['ProductDetail']` — pushed from `ShopProductsPage`, `BroadcastMarketPage`'s product cards ("View details"/"View & buy"), and other market surfaces, with a `productId` route param.
**Criteria evaluated:** Visual hierarchy, typography/spacing, color/contrast vs. `theme/constants.ts`, touch targets, icon-only control accessibility, loading/error/empty states, destructive-action confirmation (none needed here), purchase-adjacent pre-submit clarity, long/missing data, marketplace trust (seller/review/fulfillment tiles).
**Not applicable:** Offline queueing specifics (handled by `shopCartManager`/`queueableJsonRequest`, outside this file); permission states (none requested here).

### Findings
1. **Icon-only header controls had no accessibility label.** The back button and the wishlist heart toggle were bare `Pressable`s with only a `KISIcon` child — no `accessibilityLabel`/`accessibilityRole`, so a screen-reader user got nothing meaningful from either. Severity: **P2**.
2. **Quantity stepper `-`/`+` buttons were icon/glyph-only with no label.** Same gap as #1 — a screen reader announces nothing beyond a bare `-`/`+` glyph. Severity: **P2**.
3. **Image-gallery thumbnails had no accessible description** of which image they select or whether it's currently active. Severity: **P3**.
4. **Header icon buttons were 42×42**, just under the app's own `KIS_TOKENS.accessibility.minTouchTarget` (44pt) token. Severity: **P3**.
5. **Positive finding — purchase flow is well-built.** `handleAddToCart` validates size/color selection, out-of-stock variants, quantity bounds, and missing shop id, each with a specific `Alert` before anything is sent; `loadProduct` and `handleToggleWishlist` both surface real errors via `Alert`/retry rather than swallowing them. No fabricate-success pattern here. Severity: N/A (positive).
6. **No link from the "Seller" trust tile to the shop/seller profile.** The tile shows the seller name and verified badge but isn't tappable — a missed discoverability/trust opportunity, not a bug. Severity: **P3** (documented only — would require adding a navigation target, out of this pass's "don't change navigation structure" guardrail).

### Fixes implemented
- Added `accessibilityRole="button"` + a descriptive `accessibilityLabel` (and `accessibilityState` reflecting selected/disabled where relevant) to: the back button, the wishlist toggle (label flips between "Add to wishlist"/"Remove from wishlist"), the quantity decrease/increase buttons, and each gallery thumbnail (`"View image N of M"`).
- Bumped `headerIconButton` from 42×42 to 44×44 to meet the app's own minimum touch target token.
- Finding 6 left as a documented recommendation (no fix) — it would require adding a navigation destination, which is out of scope for this pass.

### Verification
`npm run typecheck` clean. `npx eslint` on this file: 0 errors introduced by this pass (1 pre-existing unrelated error, `savedItemId` unused — present before this pass, not touched by it).

**Status:** AUDITED-FIXED

---

## ShopProductsPage (`src/screens/broadcast/market/pages/ShopProductsPage.tsx`)
**Entry point:** `RootStackParamList['ShopProducts']` — pushed from `BroadcastMarketPage`'s "View other products by this shop" and from market search/discovery with `{ shopId, shopName }`.
**Criteria evaluated:** Visual hierarchy, button labeling/affordance accuracy, touch targets, loading/error/empty states, pagination, marketplace trust (pricing/stock clarity).
**Not applicable:** Forms (none); destructive actions (none).

### Findings
1. **"Buy now" button did not buy anything.** It called `openProductDetail`, the exact same function wired to the adjacent "View details" button — tapping "Buy now" just opened the product detail screen, identically to "View details." This is a real purchase-adjacent trust/clarity issue: the label promises an action the button doesn't perform. Severity: **P2**.
2. **Icon-only back button had no accessibility label**, and at 40×40 was under the 44pt touch-target token. Severity: **P3**.
3. Error state (`Unable to load shop products.`) and empty state (`No products published by this shop yet.`) are both distinct, with a working Retry button on error — no silent-swallow issue here (the catch clause correctly sets a visible error message, unlike several other files in this batch). Severity: N/A (positive).

### Fixes implemented
- Relabeled "Buy now" → "View & buy" (string-only change — the button's actual behavior, navigation to product detail, is unchanged; the label now accurately describes it as a path to purchase rather than an instant buy).
- Added `accessibilityRole="button"` + `accessibilityLabel="Go back"` to the back button and bumped it to 44×44.

### Verification
`npm run typecheck` clean. `npx eslint` clean (0 errors/warnings on this file).

**Status:** AUDITED-FIXED

---

## ShopServicesPage (`src/screens/broadcast/market/pages/ShopServicesPage.tsx`)
**Entry point:** `RootStackParamList['ShopServices']` — pushed from `BroadcastMarketPage`'s "View other services by this shop" with `{ shopId, shopName }`.
**Criteria evaluated:** Visual hierarchy, button labeling, loading/error/empty states, pagination, marketplace trust.
**Not applicable:** Icon-only control accessibility — this screen has no bare-icon `Pressable`s; every interactive element (`Back`, `Retry`, `Book service`) is a `KISButton` with a text `title`, which auto-derives its own `accessibilityLabel` from that title (confirmed in `src/constants/KISButton.tsx`). Forms/destructive actions: none.

### Findings
1. **"Book service" accurately describes its action** (navigates to `ServiceBooking`) — no mislabeling parallel to the Products page's "Buy now" issue. Severity: N/A (positive).
2. **Price format is inconsistent with sibling screens**: this file renders `"{price} {currency}"` (e.g. "25.00 USD") while `ProductDetailsPage` and `ShopProductsPage` render `"{currency} {price}"` (e.g. "USD 25.00"). Minor, cross-screen consistency only. Severity: **P3**.
3. Error/empty/loading states all distinct and working (no silent-swallow issue).

### Fixes implemented
None — meets the bar as-is. Finding 2 is a cosmetic, one-line inconsistency; fixing it in isolation without a broader currency-formatting convention sweep risks inconsistency in the other direction, so it's documented only.

### Verification
Not modified. (`npm run typecheck`/`eslint` reflect no changes to this file.)

**Status:** AUDITED-NO-ISSUES

---

## CreatorAnalyticsScreen (`src/screens/broadcast/media_extended/CreatorAnalyticsScreen.tsx`)
**Entry point:** `RootStackParamList['CreatorAnalytics']`. No in-app call site currently navigates here (confirmed via repo-wide search) — it is a registered, functional route with no reachable entry point from the live UI, same unwired-screen pattern already documented for other Health Extended screens elsewhere in this app.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, chart accessibility, color usage, currency/number formatting, long content.
**Not applicable:** Forms/destructive actions (none); touch targets (no custom controls beyond the already-compliant back button).

### Findings
1. **Silent error swallowing on the money-adjacent analytics fetch.** The original `.catch(() => {})` meant a failed fetch left the screen showing `$0` revenue, `0` plays, `0` downloads, and "No royalty data yet." — rendering *identically* to a legitimate "you haven't earned anything yet" state. For a creator checking whether their royalties are correct, a silent network failure masquerading as "you earned nothing" is a real trust problem. Severity: **P1**.
2. **Monthly-plays bar chart had no accessible description** — a screen-reader user gets nothing from the bars themselves (the exact month/play-count pairing exists nowhere else on screen in text form). Severity: **P3**.

### Fixes implemented
- Added a `loadError` state, distinct from "no data yet." On fetch failure, a red banner reading "Unable to load analytics. The figures below may be out of date." appears above the stats, with a Retry button that re-runs the fetch — no more silent failure disguised as zero earnings.
- Added `accessible`/`accessibilityLabel` (e.g. `"Mar: 1.2K plays"`) to each chart bar.

### Verification
`npm run typecheck` clean. `npx eslint` clean on this file.

**Status:** AUDITED-FIXED

---

## EbooksScreen (`src/screens/broadcast/media_extended/EbooksScreen.tsx`)
**Entry point:** `RootStackParamList['Ebooks']`. Same unwired-route situation as `CreatorAnalyticsScreen` — no live call site navigates here currently.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, purchase confirmation/pre-submit clarity, long/missing data.
**Not applicable:** Touch targets (tabs and buttons already meet 44pt); icon-only accessibility (no bare-icon controls — "Read"/"Get Free"/"Purchase" are all `KISButton`s with text titles).

### Findings
1. **Silent error swallowing on catalog fetch.** `catch {}` meant a failed fetch rendered "No ebooks available." — identical to an honestly-empty catalog, with zero indication anything went wrong and no retry path. Severity: **P1**.
2. **Purchase flow is correctly built**: a confirmation `Alert` states title and exact price before charging ("Buy 'X' for USD 9.99?"), success/failure are both surfaced via distinct alerts (not fabricated — the success alert only fires after `postRequest` actually resolves), and `purchaseLoading` prevents a double-tap double-purchase. Severity: N/A (positive) — this is the correct pattern the P1 in finding 1 should have matched.
3. **`cover_url` field is defined on the `Ebook` type and presumably returned by the backend, but never rendered** — every book, purchased or not, shows the same generic book icon placeholder regardless of whether real cover art exists. This flattens catalog browsability (every title looks identical at a glance) but isn't a defect in the strict sense. Severity: **P3** (documented only — rendering real cover art is a visual feature addition, not a fix to an existing broken behavior, and was judged outside "safe low-risk fix" scope for this pass).

### Fixes implemented
- Added a `loadError` state. On fetch failure, a red message ("Unable to load ebooks. Check your connection and try again.") plus a Retry button now appears above the grid, and the ambiguous "No ebooks available."/"No purchased ebooks yet." text is suppressed while an error is showing (so the two states can never be confused).

### Verification
`npm run typecheck` clean. `npx eslint`: 0 errors introduced (1 pre-existing unused `active` closure variable in the `useFocusEffect` wrapper, present before this pass and not part of it).

**Status:** AUDITED-FIXED

---

## KingdomMusicScreen (`src/screens/broadcast/media_extended/KingdomMusicScreen.tsx`)
**Entry point:** `RootStackParamList['KingdomMusic']`. Same unwired-route situation — no live call site.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, media-control accessibility (play/pause is explicitly in scope per the task brief), icon-only control labeling, emotional/trust honesty of the "Now Playing" affordance.
**Not applicable:** Forms (none); destructive-action confirmation (adding to a playlist isn't destructive).

### Findings
1. **Silent error swallowing on track-catalog fetch** — identical pattern to the other media_extended screens: `catch{}` → "No tracks found." with no distinction from a real failure. Severity: **P1**.
2. **Play/pause button (the screen's primary media control) had no accessibility label at all** — just a bare `KISIcon`. The task brief specifically flags play/pause/seek controls as needing labels; this is a direct hit on that criterion. Severity: **P2**.
3. **"Add to playlist" icon button and the "Now Playing" dismiss (×) button were also icon-only with no label.** Severity: **P3** each.
4. **The "Play" action doesn't actually play audio.** `handlePlay` posts a play-count increment to the backend and shows a "Now Playing" mini-bar with the track's title/artist — but there is no audio engine anywhere in this file (no `react-native-track-player`, no `Sound`, nothing). Tapping play produces a visual "now playing" state and a silently-incremented play count with no audible result. This is a real expectation-mismatch: the UI claims an action succeeded (now playing!) without the underlying thing (actual playback) happening. Severity: **P1** (documented only — implementing real audio playback is a feature build, not a safe low-risk fix within this pass's scope; flagged here because it's exactly the "claims success without the real effect" shape the audit was asked to hunt for, just in a different guise than a network error).

### Fixes implemented
- Added a `loadError` state + Retry button for the track-catalog fetch, same pattern as the other media_extended screens.
- Added `accessibilityRole="button"` + a dynamic `accessibilityLabel` (`"Play {title}"`/`"Pause {title}"`, with `accessibilityState.selected` reflecting playing state) to the play/pause control, `"Add {title} to playlist"` to the playlist button, and `"Dismiss now playing"` to the mini-player's close button.
- Finding 4 (no real audio engine) is documented only, not fixed — out of scope for a UX audit pass.

### Verification
`npm run typecheck` clean. `npx eslint` clean on this file.

**Status:** AUDITED-FIXED

---

## KingdomNewsScreen (`src/screens/broadcast/media_extended/KingdomNewsScreen.tsx`)
**Entry point:** `RootStackParamList['KingdomNews']`. Same unwired-route situation.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, color-as-signal correctness (the credibility badge is a trust-safety feature), icon-only accessibility, long/missing data.
**Not applicable:** Forms/destructive actions (none); touch targets (category chips and cards are large enough).

### Findings
1. **Silent error swallowing on the articles fetch** — same pattern as the rest of this cluster. Severity: **P1**.
2. **Credibility-score color logic had a real bug: `if (!score) return palette.subtext` treated a genuine 0% credibility score identically to "no score provided," rendering the worst, most-important-to-flag articles with a neutral grey badge instead of the danger/red color the `>= 50`/`>= 80` branches use for everything else.** For a news feed that explicitly surfaces a credibility signal, this silently defeats the signal's purpose for exactly the content it most needs to flag. Severity: **P2**.
3. **Full-article view's back button was icon-only with no accessibility label.** Severity: **P3**.
4. **`thumbnail_url` is defined on the `Article` type but never rendered** — every article, featured or not, shows the same generic newspaper icon. Same pattern as `EbooksScreen`'s unused `cover_url`. Severity: **P3** (documented only).

### Fixes implemented
- Added a `loadError` state + Retry button/message for the article fetch.
- Fixed the credibility color bug: changed the guard to `score == null` so a real 0% score now correctly renders as `palette.danger`, while "no score at all" still falls back to neutral grey.
- Added `accessibilityRole="button"` + `accessibilityLabel="Back to articles"` to the full-article back button.

### Verification
`npm run typecheck` clean. `npx eslint` clean on this file.

**Status:** AUDITED-FIXED

---

## PPVEventsScreen (`src/screens/broadcast/media_extended/PPVEventsScreen.tsx`)
**Entry point:** `RootStackParamList['PPVEvents']`. Same unwired-route situation.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, purchase confirmation/pre-submit clarity, long/missing data.
**Not applicable:** Icon-only accessibility (every action — "Watch"/"Buy Ticket" — is a `KISButton` with a text title).

### Findings
1. **Silent error swallowing on the events-list fetch** — same pattern as the rest of the cluster: `catch {}` → "No events scheduled." indistinguishable from a real failure. Severity: **P1**.
2. **Ticket-purchase flow is correctly built**: confirmation `Alert` states event title and exact price before charging, failure shows a distinct error alert, success only fires after the purchase `postRequest` actually resolves (no fabricated success), and `ticketLoading` prevents double-purchase taps. `handleWatch` correctly tells the user "Stream is not available yet" rather than silently failing when no stream URL is returned. Severity: N/A (positive) — model example other screens in this batch should match.
3. **`thumbnail_url` defined but unrendered**, same pattern as the other two catalog screens above. Severity: **P3** (documented only).

### Fixes implemented
- Added a `loadError` state + Retry button/message for the events fetch, consistent with the rest of the cluster.

### Verification
`npm run typecheck` clean. `npx eslint`: 0 errors introduced (1 pre-existing unused `active` closure variable in the `useFocusEffect` wrapper, same as `EbooksScreen`, present before this pass).

**Status:** AUDITED-FIXED

---

## PodcastsScreen (`src/screens/broadcast/media_extended/PodcastsScreen.tsx`)
**Entry point:** `RootStackParamList['Podcasts']`. Same unwired-route situation.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, media-control accessibility, icon-only accessibility.
**Not applicable:** Forms/destructive actions (none).

### Findings
1. **Silent error swallowing on the channel-list fetch**, same cluster pattern. Severity: **P1**.
2. **Silent error swallowing on the per-channel episode fetch** (`handleChannelPress` → `loadEpisodesFor`): a failed episode load rendered "No episodes yet." identically to a channel that genuinely has none. Severity: **P1**.
3. **Positive finding — this screen already does media-control accessibility correctly**, unlike its siblings: each episode row's `Pressable` already ships `accessibilityRole="button"` and `accessibilityLabel={"Play " + ep.title}` in the pre-existing code. This is the correct pattern; the inconsistency is that `KingdomMusicScreen`'s play button (finding 2 there) didn't follow it. Severity: N/A (positive).

### Fixes implemented
- Added a `loadError` state + Retry button/message for the channel-list fetch.
- Added a separate `episodeError` state + Retry button, scoped to the expanded channel's episode section, for the per-channel episode fetch — distinct from the genuine "No episodes yet." empty state.

### Verification
`npm run typecheck` clean. `npx eslint` clean on this file.

**Status:** AUDITED-FIXED

---

## BroadcastEducationPage (`src/screens/broadcast/pages/BroadcastEducationPage.tsx`)
**Entry point:** Inline sub-tab embedded in `BroadcastScreen`'s own ScrollView (not a stack route) — same contract as its sibling pages in this file (`searchTerm`/`searchContext` props, no own header/SafeAreaView).
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, navigation/discoverability ("See all" catalog browsing), cognitive load.
**Not applicable:** Icon-only accessibility (all buttons here are `KISButton`s with text titles); destructive actions (none).

### Findings
1. **`useEducationDiscovery`'s `error` field is correctly surfaced** in a visible red banner — this page does not swallow its primary discovery-feed error. Severity: N/A (positive).
2. **The institution-directory fetch (`getRequest(ROUTES.education.institutionDirectory, ...)`) has a `.then().finally()` but no `.catch()`.** If that specific call ever rejects (rather than resolving with `success: false`, which `getRequest`'s documented contract elsewhere in this codebase suggests is the normal failure shape), it would produce an unhandled promise rejection; `institutionsLoading` would still clear via `finally`, but no error would be shown for that one section. Severity: **P3** (low-risk, likely never triggered given `getRequest`'s contract — documented, not fixed, to avoid speculative changes to a fetch helper's error contract I didn't have full visibility into).

### Fixes implemented
None — this page already handles its main error path correctly; finding 2 is a low-probability defensive gap, not an observed bug, and is documented only.

### Verification
Not modified.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## BroadcastFeedsPage (`src/screens/broadcast/pages/BroadcastFeedsPage.tsx`)
**Entry point:** Inline sub-tab embedded in `BroadcastScreen`, same contract as above.
**Criteria evaluated:** Structural review only — this file is a 44-line pass-through wrapper around `FeedsDiscoverPage` (not in this audit's scope) with no UI of its own beyond a `marginTop: 10` spacer `View`.
**Not applicable:** Every visual/interaction criterion — there is no rendered content, state, or logic in this file to evaluate; it only forwards props.

### Findings
None — there is nothing in this file to find. All real UX surface area lives in `FeedsDiscoverPage.tsx`, which is out of this batch's assignment.

### Fixes implemented
None.

### Verification
Not modified.

**Status:** AUDITED-NO-ISSUES

---

## BroadcastHealthcarePage (`src/screens/broadcast/pages/BroadcastHealthcarePage.tsx`)
**Entry point:** Inline sub-tab embedded in `BroadcastScreen`, same contract as above.
**Criteria evaluated:** Loading/error/empty/offline states, silent-error-swallowing, destructive/consequential-action confirmation (joining an institution, booking), accessibility, marketplace-adjacent trust (institution verification, pricing, member discounts), long/missing data.
**Not applicable:** Forms (none beyond the join/book buttons, which are simple actions, not data entry).

### Findings
1. **This is the best-built file in the batch for error handling.** `loadHealthcareBroadcasts` reads an offline-first cache (`readOfflineStructuredCache`), shows it immediately, then reconciles with the network via `Promise.allSettled` — and on a real failure, if there's no cache to fall back to, it explicitly `Alert.alert`s the user rather than silently showing an empty list. If there *is* a cache, it marks the cache as stale (`OfflineDataBadge`) rather than alert-spamming. This is the textbook-correct version of the pattern several other files in this batch got wrong. Severity: N/A (positive — model example).
2. **`handleJoinInstitution` and `handleBookNow` both surface failures via `Alert`, never fabricate success, and disable their own trigger while in flight.** Severity: N/A (positive).
3. One `TouchableOpacity` wrapping the institution-landing title text has `accessibilityRole="button"` but no explicit `accessibilityLabel` — low severity since the wrapped `Text` content ("Tap title to open institution page") is itself read by a screen reader as the implicit label. Severity: **P3** (not fixed — functionally already accessible via wrapped text, and touching 45KB of institution-matching logic for a redundant explicit label wasn't worth the risk/cost here).

### Fixes implemented
None — this file already meets the bar. No safe, non-cosmetic improvement was identified that wasn't already redundant with existing behavior.

### Verification
Not modified.

**Status:** AUDITED-NO-ISSUES

---

## BroadcastJobsPage (`src/screens/broadcast/pages/BroadcastJobsPage.tsx`)
**Entry point:** Inline sub-tab embedded in `BroadcastScreen`, same contract as above.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, forms/validation, modal dismissal affordance, privacy-sensitive defaults, destructive-action confirmation (job application isn't destructive, but does send real data to a third party).
**Not applicable:** Icon-only accessibility beyond what's noted below (Apply/Cancel/Submit are all text-labeled).

### Findings
1. **`fetchJobs`'s catch block reset `jobs` to `[]`** with no error indication — a failed load rendered "No jobs found / Check back soon or adjust your search," indistinguishable from a genuinely empty result, though pull-to-refresh at least gave users *a* retry path (unlike several other files in this batch which had none). Severity: **P1**.
2. **The Apply bottom-sheet `Modal` had no dimmed backdrop and no tap-outside-to-dismiss** — `modalWrap` set no background color behind the sheet, so the rest of the screen stayed fully visible/undimmed while the sheet was open, with no way to close it except the in-sheet Cancel button. Every other modal/sheet in this batch (`AddToPlaylistSheet`, `BroadcastMarketPage`'s rating sheet) uses `palette.backdrop` with a tap-to-dismiss `Pressable` — this was the one inconsistent outlier. Severity: **P2**.
3. **"Apply" button on each job card had no explicit accessibility label** beyond its own "Apply"/"Applied" text (which, while adequate, didn't include which job it applied to for a screen-reader user scanning a list of many). Severity: **P3**.
4. **The "Share my profile as your CV" toggle defaults to ON (`shareProfile = true`)** — meaning a user who doesn't notice the toggle and taps Submit sends their full profile (headline, bio, experience, education, skills) to the employer by default, rather than opting in. This is a privacy-sensitive default inversion worth flagging explicitly given the audit's trust/privacy criterion. Severity: **P2** (documented only — changing the default changes actual data-sharing behavior sent to a third party, which is a product/business decision, not a safe cosmetic fix within this pass's guardrails).

### Fixes implemented
- Added a `loadError` state distinguishing a real fetch failure from a genuine empty result, with its own icon/message/Retry button in the `FlatList`'s `ListEmptyComponent`.
- Added a dimmed `palette.backdrop` overlay behind the Apply sheet with a tap-to-dismiss `Pressable`, matching every other modal in this batch.
- Added `accessibilityLabel`/`accessibilityRole`/`accessibilityState` to each job card's Apply button (`"Apply to {title}"` / `"Already applied to {title}"`) and to the new empty-state Retry button.
- Finding 4 left as a documented recommendation only — not fixed, per the reasoning above.

### Verification
`npm run typecheck` clean. `npx eslint` clean on this file.

**Status:** AUDITED-FIXED

---

## BroadcastMarketPage (`src/screens/broadcast/pages/BroadcastMarketPage.tsx`)
**Entry point:** Inline sub-tab embedded in `BroadcastScreen` — this is the real, live Market tab implementation per the task brief, not a dead or secondary file. Also renders two nested presentational components in this same file: `BroadcastProductCard` and `BroadcastServiceCard`.
**Criteria evaluated:** Loading/error/empty states, silent-error-swallowing, purchase-adjacent button-label accuracy, destructive/consequential-action confirmation (broadcast removal, rating submission), icon-only accessibility, marketplace trust (seller ratings, pricing clarity, membership discounts).
**Not applicable:** Forms beyond the rating-comment textarea (simple, optional, no validation needed).

### Findings
1. **`loadMarketBroadcasts` silently reset `marketItems` to `[]` on any failure**, and the screen's only empty state — "No broadcast products match the current filters." — fired identically whether the marketplace was genuinely empty, a filter excluded everything, or the network request outright failed. There is also **no pull-to-refresh and no retry button anywhere on the main feed** (the only `onRefresh` wiring in this file is for the nested `BroadcastServiceCard`'s own re-fetch, not the top-level list), so a failed initial load was a dead end short of leaving and re-entering the tab. This is the Market tab's primary feed — the single highest-impact instance of the "silent failure disguised as empty" pattern in this entire batch. Severity: **P1**.
2. **"Buy now" button did not buy anything** — `handleAddToCart` for the product card just calls `handleOpenDetail()`, navigating to `ProductDetail`, the exact same destination as the adjacent "View details" button one row above it. Same mislabeling bug as `ShopProductsPage.tsx`, but on the Market tab's primary per-item CTA. Severity: **P2**.
3. **The 5-star rating-submission `Pressable`s had no accessibility label or selected-state** — a screen reader got nothing beyond a bare "★" glyph repeated five times, with no way to tell which star corresponds to which score or which is currently selected. Severity: **P3**.
4. **"Remove broadcast" (unpublishing a seller's own service listing) has no confirmation step** — tapping it immediately calls `deleteRequest`. Lower severity than a typical destructive-action gap because it's reversible (re-tapping "Broadcast" republishes it), seller-facing only (not a buyer-destructive flow), and gives immediate success/failure feedback via `Alert`. Severity: **P3** (documented only — adding a confirmation dialog here is a safe, low-risk change in isolation, but was deprioritized below the P1/P2 fixes given the reversibility and seller-only exposure; left as a recommendation for a follow-up pass).
5. **The main product image, each gallery thumbnail, and the full-screen image-preview overlay — in both `BroadcastProductCard` and `BroadcastServiceCard` — were icon/image-only `Pressable`s with no accessibility label**, same gap as `ProductDetailsPage.tsx`'s gallery thumbnails. Severity: **P3**.

### Fixes implemented
- Added a `marketLoadError` state, set on both an explicit `success: false` response and a thrown exception, cleared at the start of every load. The empty-state branch now checks `marketLoadError && !filteredProducts.length` first and renders a distinct "Unable to load the marketplace. Check your connection and try again." message with a Retry button, before falling through to the genuine "No broadcast products match the current filters." message.
- Relabeled "Buy now" → "View & buy" (string-only; behavior unchanged).
- Added `accessibilityRole="button"`, a dynamic `accessibilityLabel` (`"Rate N stars"`), and `accessibilityState.selected` to each of the five rating-star `Pressable`s.
- Added `accessibilityRole="button"` + descriptive `accessibilityLabel`s ("View product image full screen", `"View image N of M"` with `accessibilityState.selected`, and "Close full screen image") to the main image, thumbnails, and fullscreen overlay in both `BroadcastProductCard` and `BroadcastServiceCard`.
- Finding 4 left undone — documented as a follow-up recommendation.

### Verification
`npm run typecheck` clean. `npx eslint` on this file: 0 errors introduced by this pass. (The file carries a large number of pre-existing `react-native/no-inline-styles` warnings consistent with this codebase's established style and a handful of pre-existing `no-void` stylistic warnings — none touch the lines changed in this pass.)

**Status:** AUDITED-FIXED

---

## AddToPlaylistSheet (`src/screens/broadcast/playlists/AddToPlaylistSheet.tsx`)
**Entry point:** Bottom-sheet modal rendered from the broadcast feed's long-press "Add to playlist" action (per `PlaylistDetailScreen`'s empty-state hint text), receiving `{ item, visible, onClose }`.
**Criteria evaluated:** Modal dismissal affordance, loading/success feedback, icon-only accessibility, empty-state clarity.
**Not applicable:** Destructive actions (adding to a playlist isn't destructive); error states (the underlying `addItemToPlaylist` call is a synchronous, always-succeeding local-state write by design — see `playlistManager.ts` below for the sync-layer discussion).

### Findings
1. **Close (×) button was icon-only with no accessibility label.** Severity: **P3**.
2. **Positive finding — this sheet already does backdrop/dismissal correctly**: a dimmed `palette.backdrop` `Pressable` behind the sheet closes it on tap, which is the pattern `BroadcastJobsPage.tsx`'s Apply sheet was missing (now fixed to match). Severity: N/A (positive — reference pattern for the rest of the app).
3. **"Create & Add" flow has a proper loading spinner and disables itself while in flight**, and the "Added" badge only appears once the (synchronous, local) add has actually completed. No fabricated-success concern here given the local-first architecture is itself the intended design (see `playlistManager.ts` notes).

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.

### Verification
`npm run typecheck` clean. `npx eslint`: 2 pre-existing errors on this file (`tokens`, `topInset` both destructured but unused) — present before this pass, not introduced by the one-line accessibility addition made here.

**Status:** AUDITED-FIXED

---

## PlaylistDetailScreen (`src/screens/broadcast/playlists/PlaylistDetailScreen.tsx`)
**Entry point:** `RootStackParamList['PlaylistDetail']`, pushed from `PlaylistsScreen`'s playlist cards with `{ playlistId, startIndex?, autoPlay? }`.
**Criteria evaluated:** Media-control accessibility (play/pause/prev/next are explicitly in scope per the task brief), destructive-action confirmation, icon-only accessibility, cognitive load, long/missing content, loop-mode clarity.
**Not applicable:** Network error states (all data here is local-first via `playlistManager`, no network fetch happens in this screen directly); forms (rename is a single inline text field, already handled).

### Findings
1. **Transport controls (Previous/Shuffle/Next) were icon-only `KISButton`s with no `title` prop — and crucially, `KISButton` only auto-derives its `accessibilityLabel` from a string `title`, not from icon children, so these three had literally no accessible label at all.** This is a direct hit on the task brief's explicit callout that "media controls (play/pause/seek) specifically need labels." Severity: **P2**.
2. **Header back button and header delete (trash) button were icon-only with no label** — the delete button is especially notable since it triggers a destructive confirmation flow, but a screen-reader user wouldn't know what the button *was* before reaching that dialog. Severity: **P2** (delete), **P3** (back).
3. **Per-item reorder (↑/↓) and remove (×) buttons were icon/glyph-only with no label**, same `KISButton`-children gap as finding 1. Severity: **P3** each.
4. **The loop-mode "selected" checkbox per item was icon-only with no `accessibilityRole="checkbox"`/`accessibilityState`** — a screen reader got no indication of what the control was or its checked state. Severity: **P2**.
5. **Positive finding — destructive actions are correctly confirmed.** Both "Delete playlist" (header trash) and "Remove from playlist" (per-item ×) go through an `Alert.alert` with a `style: 'destructive'` Delete/Remove action and a Cancel — this is the correct pattern, including stating item counts where relevant. Severity: N/A (positive).
6. **"Watch Later" and visibility-change actions give clear, non-silent feedback** (`Alert` confirming exactly how many items were added, or that they're already there) — no fabricated-success pattern. Severity: N/A (positive).

### Fixes implemented
- Added `accessibilityLabel`s to the Previous (`"Previous item"`), Shuffle (`"Shuffle on"/"Shuffle off"`), and Next (`"Next item"`) transport controls.
- Added `accessibilityLabel`s to the header back button (`"Go back"`) and header delete button (`` `Delete playlist "{name}"` ``).
- Added `accessibilityLabel`s to the per-item reorder buttons (`"Move up"`/`"Move down"`) and remove button (`` `Remove {title} from playlist` ``).
- Added `accessibilityRole="checkbox"` + `accessibilityState={{ checked }}` + a descriptive label to the per-item loop-selection checkbox.

### Verification
`npm run typecheck` clean. `npx eslint`: 3 pre-existing errors on this file (`tokens` and `activeItems` unused, and an `exhaustive-deps` warning on `items` inside `handleSaveToWatchLater`'s `useCallback`) — all present in code this pass did not touch, not introduced by the accessibility-label additions made here.

**Status:** AUDITED-FIXED

---

## PlaylistsScreen (`src/screens/broadcast/playlists/PlaylistsScreen.tsx`)
**Entry point:** `RootStackParamList['PlaylistsScreen']` (exact route name per navigator registration), reached from the broadcast feed's playlist entry point; also the screen `PlaylistDetailScreen`'s "Go back" returns to.
**Criteria evaluated:** Destructive-action confirmation, icon-only accessibility, empty-state clarity, forms (inline create-playlist field).
**Not applicable:** Network error states (local-first, same as `PlaylistDetailScreen`); loading states beyond what's already handled (list renders from local state synchronously).

### Findings
1. **Back, "create playlist," create-confirm (✓), and create-cancel (×) buttons were all icon-only with no accessibility label.** Severity: **P2** (back/create — primary navigation) / **P3** (confirm/cancel — secondary, inside an already-visible inline form).
2. **Per-playlist delete (trash) button was icon-only with no label.** Severity: **P2** (destructive action with no accessible description of what it does).
3. **Positive finding — delete confirmation is excellent**: the `Alert` explicitly states the playlist name and the exact item count that will be lost ("This will permanently remove the playlist and all 7 items from it."), with a destructive-styled Delete and a Cancel. This is the best-written confirmation copy in the batch. Severity: N/A (positive — reference example).
4. **Empty state is clear and includes a working CTA** ("Create Playlist") rather than a dead-end message. Severity: N/A (positive).

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel`s to: the back button (`"Go back"`), the header add button (`"Create new playlist"`), the inline create-confirm button (`"Confirm new playlist name"`, with `accessibilityState.disabled`), the inline create-cancel button (`"Cancel"`), and each playlist's delete button (`` `Delete playlist "{name}"` ``).

### Verification
`npm run typecheck` clean. `npx eslint`: 1 pre-existing error (`tokens` destructured but unused) — present before this pass, not introduced by the accessibility additions made here.

**Status:** AUDITED-FIXED

---

## playlistManager (`src/screens/broadcast/playlists/playlistManager.ts`)
**Entry point:** Not a screen — a shared, non-UI data module imported by all three playlist screens above (`PlaylistsScreen`, `PlaylistDetailScreen`, `AddToPlaylistSheet`). Included in this audit because the task's file count for this folder (4) includes it alongside the 3 actual screens.
**Criteria evaluated:** Silent-error-swallowing / fabricate-success-on-failure, as it pertains to what the three dependent screens display to the user.
**Not applicable:** Every visual/interaction criterion (visual hierarchy, typography, color, touch targets, loading/empty states, accessibility, small-screen usability) — this module renders nothing and has no UI surface of its own.

### Findings
1. **The optimistic local-first sync architecture is deliberate and well-documented, not a bug.** Every mutation (`createPlaylist`, `deletePlaylist`, `addItemToPlaylist`, etc.) updates local state and `AsyncStorage` immediately — which genuinely did happen — and pushes to the backend in the background, silently retrying on the next hydration if that background call fails. This is explicitly commented as the intended design at the top of the file. Critically, this is *not* the "fabricate success on failure" anti-pattern: the local mutation the UI reports as successful really did complete; only the background server sync is deferred/retried. Severity: N/A (positive design, correctly distinguished from the anti-pattern this audit was told to hunt for).
2. **However, if a background sync permanently fails** (e.g., the backend rejects a delete with a non-network error, not just "offline"), **the user is never told** — the local deletion/mutation stands forever, and the only retry mechanism is "next full hydration," which would retry the same permanently-failing call indefinitely without ever surfacing it. For a personal-playlist feature this is low-stakes (no money, no safety impact), but it's a real gap in the error-surfacing chain. Severity: **P3** (documented only — reworking the sync/retry contract to add permanent-failure surfacing is a data-layer architecture change, explicitly out of this pass's "don't change backend contracts" guardrail).

### Fixes implemented
None — finding 1 isn't a defect, and finding 2 is out of scope for a safe, low-risk UX-audit fix.

### Verification
Not modified.

**Status:** AUDITED-FINDINGS-DOCUMENTED
