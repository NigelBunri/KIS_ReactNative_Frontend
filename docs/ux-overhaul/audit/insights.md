# UX/UI Audit — Insights (`src/screens/insights/**`, `src/components/insights/**`)

**Scope:** 20 files in `src/screens/insights/**` (18 screens + `components/InsightLayout.tsx` + `useInsightsHooks.ts`), 9 files in `src/components/insights/**` (8 components + `index.ts` barrel). 29 files total.

**Status:** 29 / 29 audited. 12 files were audited and fixed in a prior pass (independently re-verified via `git diff` + typecheck) — left untouched here, summarized below from their diffs. The remaining 17 files are audited in full in this pass.

---

## Cross-cutting findings (apply to multiple files — read first)

### Finding A — P1 — Most of the `AdminToolsScreen` hub-and-spoke cluster has no entry point anywhere in the live app

`AdminToolsScreen.tsx` ("Developer tools") is a pure navigation menu linking to 12 screens: `AnalyticsDashboard`, `EventsDashboard`, `ContentDashboard`, `SurveysDashboard`, `MediaDashboard`, `BridgeDashboard`, `TiersDashboard`, `NotificationsDashboard`, `AIIntegration`, `MediaAssetManager`, `SurveyManager`, `AdminUserManagement`.

A full-codebase search (`grep -rn "'<RouteName>'"` for every route name, outside `navigation/types.ts` and the insights folder itself) found:
- **Zero callers** of `navigation.navigate('AdminTools', ...)` anywhere in the app. The screen is registered in `App.tsx` (`presentation: 'modal'`) but nothing links to it — no button, menu item, settings row, or search entry.
- Of its 12 destinations, only **two** have a real entry point elsewhere: `ModerationConsole` and `AdminUserManagement`, both linked directly from the Admin tab in `src/screens/tabs/ProfileScreen.tsx` (~line 2912–2960), bypassing `AdminToolsScreen` entirely.
- The other **10** — `AnalyticsDashboard`, `EventsDashboard`, `ContentDashboard`, `SurveysDashboard`, `MediaDashboard`, `BridgeDashboard`, `TiersDashboard`, `NotificationsDashboard`, `AIIntegration`, `MediaAssetManager`, `SurveyManager` — have **no caller anywhere in the app**, including `AdminToolsScreen` itself since nothing opens it. (`SurveyManager` is also reachable from `SurveysDashboardScreen`'s "Manage" button and `BridgeManagement` from nowhere either — but that's moot since `SurveysDashboardScreen` itself is unreachable.)

This is distinct from, and larger than, the two orphaned-screen findings already on record (`ProfileInsightsScreen` — not registered at all; `AdminDashboardScreen` — registered but never navigated to). Here the screens **are** registered and individually functional, but the entire menu that was built to reach them is itself dead weight: a working "Developer tools" hub that nothing links to, fronting 10 fully-built admin consoles/dashboards (several hundred lines each, including three already hardened in the prior audit pass — `AIIntegrationScreen`, `BridgeManagementScreen`, `TiersDashboardScreen`, `NotificationsDashboardScreen`, `BridgeDashboardScreen`) that no admin can currently discover in the live app.

**Not fixed** — wiring a menu entry to `AdminTools` is a navigation-structure change, out of bounds for this pass. Flagged for a follow-up phase: either surface `AdminToolsScreen` from the Admin tab (cheapest fix — one button) or confirm intentional and schedule removal.

### Finding B — P1 — Silent-failure/fabricated-success bug, same root cause as prior Bridge/Tiers/Notifications fixes, found in 4 more screens

The prior audit pass fixed this exact bug in `BridgeDashboardScreen.tsx`, `TiersDashboardScreen.tsx`, and `NotificationsDashboardScreen.tsx`: `getRequest()` **resolves** (never throws) on a failed HTTP response, returning `{ success: false, message, status }` with `data` left `undefined`. Code that reads `res.data` without checking `res.success` silently treats a real 4xx/5xx failure as "no data" and renders a calm empty state ("No events found", "No media files found", etc.) instead of an error with retry.

This exact pattern was present, unfixed, in 4 files in my remaining scope:
- `ContentDashboardScreen.tsx`
- `EventsDashboardScreen.tsx`
- `MediaDashboardScreen.tsx`
- `SurveysDashboardScreen.tsx`

**Fixed** in all four (see individual entries below) — each now checks `res.success` and throws into the existing `catch` block (which already sets the error state correctly), matching the pattern already established in the sibling files.

A **related, deeper** instance of the same bug class lives in `src/api/insights/insights.api.ts` (outside this pass's assigned scope of `src/screens/insights/**` / `src/components/insights/**`, so not edited here):
- `fetchDashboardInsights()` (powers `useInsights` → `InsightScreen`, and therefore `AnalyticsDashboardScreen`, `AdminDashboardScreen`, and the main panel of `PartnerInsightsScreen`/`ProfileInsightsScreen`) never checks `res.success`; on failure it resolves to an empty-but-non-null `InsightPayload`, so `InsightLayout`'s `displayEmpty` check (`!loading && !error && !data`) never fires either — the screen renders header + time-range selector and then **nothing at all**, with no error and no "no data" message.
- `fetchTiersSummary()` has the identical bug already identified and fixed elsewhere in this same file for `fetchNotificationsSummary`/`fetchMarketplaceProducts` (see their "Same fix as..." comments) but was missed here: on failure, `arrayize(plansRes?.data ?? plansRes ?? [])` falls through to wrapping the failure-response object itself as a fake single list entry, so `PartnerInsightsScreen`'s "Tier health" panel can render a fabricated placeholder plan/campaign name on API failure.

**Flagged, not fixed** — both live in `src/api/insights/insights.api.ts`, outside this pass's directory scope. Recommend a immediate follow-up: apply the same one-line `if (!res?.success) return ...;` guard already used twice in that file to `fetchDashboardInsights` and `fetchTiersSummary`.

### Finding C — P3 — Read-only dashboards without a visible back/close affordance (pattern, not a regression)

`ContentDashboardScreen`, `EventsDashboardScreen`, `MediaDashboardScreen`, `SurveysDashboardScreen`, `AdminToolsScreen`, and their already-fixed siblings (`BridgeDashboardScreen`, `TiersDashboardScreen`, `NotificationsDashboardScreen`) are all registered with `presentation: 'modal'` and inherit the stack's global `headerShown: false` — verified intentional (not a duplicate-header bug) via `App.tsx:1495`, `screenOptions={{ headerShown: false }}`. None of them render their own close/back button; dismissal relies entirely on the iOS swipe-down gesture or the Android hardware/gesture back action. This is consistent across every screen in the family (fixed and unfixed alike), so it reads as a deliberate, if minimal, design choice rather than a defect introduced anywhere specific. Documented for awareness, not changed — would require a navigation/options change to add a visible close button, out of scope for this pass.

---

## Already audited & fixed (prior pass — summarized from `git diff`, not re-touched)

| File | Fix applied |
|---|---|
| `src/components/insights/BarChart.tsx` | Guarded `barWidth` against going negative/invisible when `data.length` is large; replaced hardcoded indigo hex fallback color with theme-aware `palette.primary`. |
| `src/components/insights/DonutChart.tsx` | Replaced hardcoded green hex fallback color with theme-aware `palette.success`. |
| `src/components/insights/KpiTile.tsx` | Fixed a falsy-zero bug: `kpi.change && Number(kpi.change) >= 0` treated a genuine `0` (no change) as falsy and colored a flat trend red (danger) instead of neutral/positive; now type-checks before comparing. |
| `src/components/insights/LineChart.tsx` | Replaced hardcoded blue hex default `color` prop with theme-aware `palette.primary` (every real call site omits the prop, so this is the color that actually renders). |
| `src/screens/insights/AIIntegrationScreen.tsx` | Added `accessibilityLabel="New QnA session"` to an icon-only FAB. |
| `src/screens/insights/BridgeDashboardScreen.tsx` | Fixed silent-failure bug: `Promise.allSettled` rejection on the threads/analytics fetch fell through to an empty state with no error shown; now sets `error` from the rejected settlement. |
| `src/screens/insights/BridgeManagementScreen.tsx` | Added `accessibilityLabel`s to two icon-only FABs ("Connect account", "Create automation"). |
| `src/screens/insights/MediaAssetManagerScreen.tsx` | Added `accessibilityLabel`s to an icon-only delete button and the upload FAB. |
| `src/screens/insights/ModerationConsoleScreen.tsx` | **Largest fix in this family:** WARN/SUSPEND/BAN/DELETE moderation actions fired immediately on a single tap with zero confirmation, inconsistent with a suspend-confirmation already present elsewhere in the same file — all four wrapped in a confirm-then-act pattern. Also fixed a severity-color bug where CRITICAL flags displayed in a calmer color than HIGH flags. |
| `src/screens/insights/NotificationsDashboardScreen.tsx` | Fixed the same silent-failure bug as Bridge: a rejected primary list fetch fell through to "No notifications found" instead of an error; summary (secondary) fetch intentionally still degrades quietly. |
| `src/screens/insights/SurveyManagerScreen.tsx` | Added `accessibilityLabel="Create survey"` to an icon-only FAB. |
| `src/screens/insights/TiersDashboardScreen.tsx` | Fixed the same silent-failure bug (both plans+subscriptions fetch failing now surfaces an error instead of "No data available"); also fixed a severity/trust bug where canceled/past_due/unpaid/incomplete subscriptions shared the same neutral gold status color as merely-pending ones — now colored danger. |

These are consistent with, and directly corroborate, Finding B above (the same root-cause bug recurring across the family).

---

## Audited this pass (remaining 17 files)

## AdminDashboardScreen (`src/screens/insights/AdminDashboardScreen.tsx`)
**Entry point:** Route `AdminDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — but **confirmed dead**: no caller anywhere in the app invokes `navigation.navigate('AdminDashboard', ...)`. Carried forward from established context; re-verified in this pass (see Finding A methodology).
**Criteria evaluated:** navigation/entry-point reachability, code-level correctness, redundancy vs. `AnalyticsDashboardScreen`.
**Not applicable:** visual hierarchy/density, forms/validation, destructive-action confirmation, accessibility, small-screen usability — this is a 19-line pass-through wrapper with no UI of its own; all real UI lives in `InsightScreen`/`InsightLayout`, audited separately.
### Findings
1. (P2) Dead route — unreachable in practice, as established. Its only distinguishing feature from `AnalyticsDashboardScreen.tsx` is accepting `target`/`title` route params (defaulting to `target: 'analytics', title: 'Dashboard'`) that nothing ever supplies, making it functionally identical to `AnalyticsDashboardScreen` when reached. Two routes for one screen.
### Fixes implemented
None — deletion is the correct remediation but is blocked by the permission system per task constraints; navigation changes are out of scope for this pass.
### Verification
No code changed. Typecheck already clean project-wide (see summary below).
**Status:** BLOCKED (deletion/consolidation recommended, cannot be executed)

---

## AdminToolsScreen (`src/screens/insights/AdminToolsScreen.tsx`)
**Entry point:** Route `AdminTools`, registered in `App.tsx` (`presentation: 'modal'`) — but **no caller anywhere in the app navigates to it** (new finding this pass, see Finding A).
**Criteria evaluated:** navigation/entry-point reachability, visual hierarchy/layout, typography/spacing, color/design-system consistency, touch targets, cognitive load.
**Not applicable:** forms/validation, destructive-action confirmation (pure nav menu, no mutations), loading/error/offline states (no network calls), accessibility labels on icon-only controls (no icon-only controls — every button has a text title).
### Findings
1. (P1) Orphaned in practice — see Finding A. This is the single biggest issue found in this screen.
2. (P3) Each card's `KISButton` ("Open dashboard") is the only pressable element — the surrounding card (title + description) is not tappable, so the hit target is smaller than the visual card suggests. Minor, and consistent with the rest of the family's button conventions.
3. (P3) Hand-rolled inline styles (not `InsightLayout`/design tokens) — consistent with the already-documented CRUD-console-vs-dashboard split in this folder; not a new defect.
### Fixes implemented
None — orphan status is a navigation-wiring gap (out of scope); the minor findings are cosmetic and consistent with sibling screens, not worth an isolated fix.
### Verification
No code changed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## AnalyticsDashboardScreen (`src/screens/insights/AnalyticsDashboardScreen.tsx`)
**Entry point:** Route `AnalyticsDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — **no caller found anywhere in the app** (see Finding A); only reachable today via deep link or future wiring.
**Criteria evaluated:** navigation/entry-point reachability, code-level correctness, redundancy vs. `AdminDashboardScreen`.
**Not applicable:** all visual/interaction criteria — 13-line pass-through wrapper around `InsightScreen` (audited via `InsightScreen`/`InsightLayout` below), no UI of its own beyond a footer note string.
### Findings
1. (P2) Unreachable in the live app (Finding A) — fully built, zero users can reach it today.
2. (P3) Functionally redundant with `AdminDashboardScreen.tsx` when the latter's `target` defaults to `'analytics'` — both already flagged together in the existing inventory doc as a design question for a later phase, not re-litigated here.
### Fixes implemented
None — navigation reachability and redundancy both require navigation-structure changes, out of scope.
### Verification
No code changed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ContentDashboardScreen (`src/screens/insights/ContentDashboardScreen.tsx`)
**Entry point:** Route `ContentDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — **no caller found anywhere in the app** (see Finding A).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, color/contrast, touch targets, typography/density, small-screen usability.
**Not applicable:** forms/validation, destructive-action confirmation (pure read-only dashboard, no mutations), accessibility labels on icon-only controls (no icon-only controls).
### Findings
1. (P1) **Fabricate-success-on-failure bug** (Finding B): `getRequest()` resolves with `success: false` on a failed HTTP response instead of throwing; this screen read `res.data` directly without checking `res.success`, so a real API failure silently rendered as "No content data available" rather than an error with retry — exactly the bug class already fixed in `BridgeDashboardScreen`/`TiersDashboardScreen`/`NotificationsDashboardScreen` in the prior pass.
2. (P3) Time-range pill buttons (`rangeBtn`: `paddingVertical: 7`) render at roughly ~32px tall, under the ~44pt touch-target guideline. Present identically in the already-audited sibling screens that don't use this selector, so not isolated to this file; documented, not resized (outside the authorized fix list for this pass).
### Fixes implemented
Added a `res.success` check immediately after the fetch that throws into the existing `catch` block (which already sets `error` state correctly), matching the established fix pattern from the prior pass. No behavior change on the success path; only changes what happens on an API failure.
### Verification
`npm run typecheck` — clean. `npx eslint` on the changed file — 0 errors, pre-existing inline-style warnings only (not introduced by this change).
**Status:** AUDITED-FIXED

---

## EventsDashboardScreen (`src/screens/insights/EventsDashboardScreen.tsx`)
**Entry point:** Route `EventsDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — **no caller found anywhere in the app** (see Finding A).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, color/contrast, touch targets, typography/density, code hygiene.
**Not applicable:** forms/validation, destructive-action confirmation (read-only dashboard), accessibility labels on icon-only controls (none present).
### Findings
1. (P1) Same **fabricate-success-on-failure bug** as `ContentDashboardScreen` (Finding B) — `res.data` read without checking `res.success`, turning real API failures into a calm "No events found" empty state.
2. (P3) Pre-existing unused import: `FlatList` imported but never used (the list is rendered via `.map()`, not `FlatList`) — a genuine lint error (`@typescript-eslint/no-unused-vars`), not introduced by this pass.
3. (P3) Same under-sized time-range buttons as `ContentDashboardScreen` — documented there, not repeated in detail.
### Fixes implemented
- Added the same `res.success` check/throw as `ContentDashboardScreen`.
- Removed the pre-existing unused `FlatList` import (trivial, safe cleanup encountered while fixing the lint-clean requirement for this file).
### Verification
`npm run typecheck` — clean. `npx eslint` — 0 errors (down from 1 pre-existing error), pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## InsightScreen (`src/screens/insights/InsightScreen.tsx`)
**Entry point:** Not a route itself — generic shared screen rendered by `AdminDashboardScreen` and `AnalyticsDashboardScreen` (both passing `target`/`title`/`description`); also exports `InsightsFooterNote` used by `AnalyticsDashboardScreen`.
**Criteria evaluated:** code-level correctness, prop delegation, reuse.
**Not applicable:** nearly everything else — this is a 39-line delegate that renders `InsightLayout` with props straight from `useInsights(target)`; all real visual/interaction/error-state surface area lives in `InsightLayout` (audited below) and `useInsightsHooks.ts` (audited below).
### Findings
None at this file's own level. It correctly delegates `data`/`loading`/`error`/`timeRange` to `InsightLayout` with no logic of its own to get wrong.
### Fixes implemented
None — meets the bar as-is.
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## MediaDashboardScreen (`src/screens/insights/MediaDashboardScreen.tsx`)
**Entry point:** Route `MediaDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — **no caller found anywhere in the app** (see Finding A).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, color/contrast (category color-coding), typography/density, small-screen usability (3-column stat grid).
**Not applicable:** forms/validation, destructive-action confirmation (read-only dashboard), accessibility labels on icon-only controls (none present; the colored "kind dot" is decorative, paired with adjacent text).
### Findings
1. (P1) Same **fabricate-success-on-failure bug** as `ContentDashboardScreen`/`EventsDashboardScreen` (Finding B) — a failed `getRequest` silently rendered "No media files found".
2. No issues found with the media-kind color coding (`image`→success, `video`→primary, `audio`→gold, `file`→subtext) — these are category colors, not severity/urgency colors, so no requirement that one be more "alarming" than another; this is different from the CRITICAL/HIGH severity-color bug already fixed in `ModerationConsoleScreen`.
### Fixes implemented
Added the same `res.success` check/throw pattern as the other two dashboards.
### Verification
`npm run typecheck` — clean. `npx eslint` — 0 errors, pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## PartnerInsightsScreen (`src/screens/insights/PartnerInsightsScreen.tsx`)
**Entry point:** Route `PartnerInsights`, registered in `App.tsx`. **Confirmed reachable** — `src/screens/tabs/PartnersScreen.tsx` (`openInsights` callback, ~line 172) calls `rootNavigation?.navigate('PartnerInsights')` from a real on-screen action, gated to superuser/partner-admin context. This is the one screen in the whole "AdminTools cluster" check that has a genuine, direct entry point outside that dead hub.
**Criteria evaluated:** loading/empty/error states per section, trust (admin-facing real revenue/campaign data), typography/density, color/contrast, visual hierarchy across stacked sections.
**Not applicable:** forms/validation, destructive-action confirmation (fully read-only), touch targets (no interactive controls beyond the shared `InsightLayout` time-range selector, audited separately), accessibility labels on icon-only controls (none present).
### Findings
1. (P2) Each sub-section (`TierHealthPanel`, `CampaignsSection`, `TopProductsSection`) correctly surfaces its own `loading`/`error` from its hook — good pattern, no silent-swallowing *in this file*. However, the data feeding `TierHealthPanel` (`useTiersSummary` → `fetchTiersSummary` in `src/api/insights/insights.api.ts`) has the fabricate-on-failure bug described in Finding B: on API failure it can render a **fabricated placeholder plan/campaign name** (e.g. a bare `"Plan"` entry) instead of the error this screen is otherwise well-set-up to display. This is a trust-relevant bug for a partner-facing revenue screen, but the fix belongs in `insights.api.ts`, outside this pass's directory scope.
2. (P3) `formatCurrency` is defined locally in this file rather than imported from a shared utility — minor duplication, not a UX defect.
### Fixes implemented
None in this file — the one real issue (Finding B's `fetchTiersSummary` instance) lives in `src/api/insights/insights.api.ts`, out of this pass's assigned scope (`src/screens/insights/**`, `src/components/insights/**`). Flagged for the follow-up recommended in Finding B.
### Verification
No code changed in this file.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ProfileInsightsScreen (`src/screens/insights/ProfileInsightsScreen.tsx`)
**Entry point:** **Orphaned** — not imported by `App.tsx`, not referenced in `navigation/types.ts`, not navigated to from anywhere in the codebase. Carried forward from established context as a confirmed, documented missing feature; re-verified in this pass (full-codebase grep for the component name and the route string both return nothing outside this file itself).
**Criteria evaluated:** code-level correctness of the UI as built (since it's unreachable, the bar is "would this work correctly if wired up," not live-usage testing).
**Not applicable:** entry-point/navigation criteria (moot — there is no entry point), small-screen live-usability testing (cannot be exercised in the running app).
### Findings
1. (P2) Confirmed orphaned — a fully-built feature (top content list + notifications summary, via the shared `InsightLayout`) with zero path to it. Already documented in the existing inventory; not wired up per task instructions.
2. No code-level defects found in the component itself — `TopContentList` and `NotificationSection` both handle empty/loading states correctly, and the shared `InsightLayout`/`useProfileInsights`/`useNotificationsSummary` plumbing it depends on is otherwise sound (modulo the `fetchDashboardInsights` issue in Finding B, which would also affect this screen's main panel if it were ever wired up).
### Fixes implemented
None — per task constraints, this orphaned screen is documented, not wired up.
### Verification
No code changed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## SurveysDashboardScreen (`src/screens/insights/SurveysDashboardScreen.tsx`)
**Entry point:** Route `SurveysDashboard`, registered in `App.tsx` (`presentation: 'modal'`) — **no caller found anywhere in the app** (see Finding A); its own "Manage" button navigates onward to `SurveyManager`, which is itself only reachable from here or the equally-unreachable `AdminToolsScreen`.
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, navigation affordance ("Manage" button), touch targets, typography/density.
**Not applicable:** forms/validation, destructive-action confirmation (read-only list + one outbound nav button), accessibility labels on icon-only controls (none present — "Manage" has a text label).
### Findings
1. (P1) Same **fabricate-success-on-failure bug** as the other three dashboards in Finding B — `res.data` read without checking `res.success`, so a real API failure rendered as "No surveys yet."
2. (P2) Reachability: this screen (and therefore its gateway to `SurveyManager`) is only reachable via the dead `AdminToolsScreen` hub (Finding A) — compounding that finding.
### Fixes implemented
Added the same `res.success` check/throw pattern as the other three dashboards.
### Verification
`npm run typecheck` — clean. `npx eslint` — 0 errors, pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## InsightLayout (`src/screens/insights/components/InsightLayout.tsx`)
**Entry point:** Not a route — shared layout component rendered by `InsightScreen`, `PartnerInsightsScreen`, and `ProfileInsightsScreen`.
**Criteria evaluated:** visual hierarchy, loading/empty/error states, color/contrast, design-system consistency, cognitive load.
**Not applicable:** entry-point/navigation, forms/validation, destructive-action confirmation, touch targets beyond the embedded `TimeRangeSelector` (audited separately), accessibility labels on icon-only controls (none — the only pressable is a "Retry" text button).
### Findings
1. No issues found. `displayEmpty` logic (`!loading && !error && !data`) is correctly ordered (error takes precedence over empty, loading takes precedence over both), the skeleton shows only on first load (`loading && !data`, so a pull-to-refresh on existing data doesn't flash a skeleton over good content), and each content section (`KpiGrid`, `LineChart`, `BarChart`, `DonutChart`, `TopItemsList`) is independently guarded by its own length check so partial payloads degrade gracefully instead of crashing or rendering empty chart chrome.
2. (P2, downstream) As noted in Finding B, this component's own error-handling is correct, but it can be defeated upstream by `fetchDashboardInsights` resolving to an empty-but-non-null payload on failure — `displayEmpty` would never trip because `data` is non-null, and no section renders because every array inside it is empty, producing a blank page below the time-range selector with zero feedback. This is **not a defect in `InsightLayout` itself** — it does exactly the right thing with the inputs it's given — but it's the component where the symptom would be visible, so documented here too for completeness.
### Fixes implemented
None — meets the bar as-is; the one related issue is upstream and out of scope (Finding B).
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## useInsightsHooks (`src/screens/insights/useInsightsHooks.ts`)
**Entry point:** Not a route — shared hooks module (`useInsights`, `useProfileInsights`, `usePartnerInsights`, `useNotificationsSummary`, `useTiersSummary`, `usePartnerCampaigns`, `useMarketplaceProducts`), no UI of its own.
**Criteria evaluated:** silent-error-swallowing, loading/error state correctness, code-level correctness.
**Not applicable:** everything visual/interactive — pure data-fetching hooks.
### Findings
1. Every hook in this file correctly wraps its fetch in `try/catch`, setting `error` in the `catch` and `loading: false` in `finally` — the hooks themselves do not swallow errors.
2. (P2, downstream, same as `InsightLayout` finding #2) `useInsights`'s `try` block calls `fetchDashboardInsights`, which — per Finding B — resolves successfully (does not throw) even on an API failure, returning an empty payload. Because `fetchDashboardInsights` never throws on failure, `useInsights`'s `catch` block can never fire for an ordinary HTTP failure; `error` stays `null` and `data` becomes a non-null-but-empty object. This hook is not itself buggy — it does the right thing with what it's given — but it's the direct caller of the function responsible for Finding B, so documented here for traceability. The other hooks (`useNotificationsSummary`, `useTiersSummary`, `usePartnerCampaigns`, `useMarketplaceProducts`) call API functions that either already guard on `res.success` (`fetchNotificationsSummary`, `fetchMarketplaceProducts` — both already carry "Same fix as..." comments from an earlier fix) or, in `fetchTiersSummary`'s case, do not yet (the remaining half of Finding B).
### Fixes implemented
None — the actual bug lives in `src/api/insights/insights.api.ts`, outside this pass's assigned scope.
### Verification
No code changed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## InsightSkeleton (`src/components/insights/InsightSkeleton.tsx`)
**Entry point:** Not a route — loading-state primitive, rendered by `InsightLayout` while `loading && !data`.
**Criteria evaluated:** loading-state correctness, visual consistency.
**Not applicable:** everything else — 17-line display-only component with no props beyond none, no interaction, no error states.
### Findings
None. Three `Skeleton` blocks (one large card, one thin bar, two half-width tiles) reasonably approximate the shape of the content that replaces them (`KpiGrid` tiles + a chart), which is the right skeleton design goal (shape-match, not generic shimmer).
### Fixes implemented
None — meets the bar as-is.
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## KpiGrid (`src/components/insights/KpiGrid.tsx`)
**Entry point:** Not a route — rendered by `InsightLayout` when `data.kpis.length > 0`.
**Criteria evaluated:** layout/responsiveness, empty-state handling.
**Not applicable:** color/contrast, forms, accessibility labels on icon-only controls — pure layout wrapper, no colors or icons of its own (delegates entirely to `KpiTile`, already audited/fixed in the prior pass).
### Findings
None. Correctly returns `null` on an empty list (avoiding empty grid chrome), and the `flexBasis: '48%'` two-column wrap with `justifyContent: 'space-between'` is a standard, safe responsive pattern that degrades fine down to small-screen widths.
### Fixes implemented
None — meets the bar as-is.
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## TimeRangeSelector (`src/components/insights/TimeRangeSelector.tsx`)
**Entry point:** Not a route — rendered by `InsightLayout` for every dashboard that uses the shared kit.
**Criteria evaluated:** touch targets, color/contrast, design-system consistency, accessibility.
**Not applicable:** forms/validation, destructive-action confirmation, loading/error/empty states (stateless presentational control).
### Findings
1. (P3) Button hit area (`paddingHorizontal: 16, paddingVertical: 6` plus a `fontWeight: '700'` label) comes out to roughly 30–34px tall depending on font metrics — under the ~44pt guideline, same class of minor touch-target issue as the inline range pills in `ContentDashboardScreen`/`EventsDashboardScreen`. This is the shared component actually used by the "real" dashboard family (`InsightScreen`/`AnalyticsDashboardScreen`/`PartnerInsightsScreen`/`ProfileInsightsScreen`), so fixing it here would have wider positive effect than the one-off pills — but it's still a padding/sizing change outside the authorized fix list for this pass (missing confirmations, silent-error-swallowing, fabricate-success, accessibility labels, color/contrast). Documented, not resized.
2. No contrast issues: active state uses `palette.primarySoft` background with `palette.primaryStrong` text, inactive uses `palette.surface`/`palette.text` — both pairings rely on already-audited theme tokens.
### Fixes implemented
None.
### Verification
No code changed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## TopItemsList (`src/components/insights/TopItemsList.tsx`)
**Entry point:** Not a route — rendered by `InsightLayout` (as "Top Items") and directly by `ProfileInsightsScreen` (as "Top content", via its own `TopContentList` wrapper — note `ProfileInsightsScreen` does not actually import this component directly despite the existing inventory doc's "consumed via ... ProfileInsightsScreen" note; it reimplements a near-identical list inline. Not a bug, just a minor inconsistency worth flagging for a future consolidation pass.)
**Criteria evaluated:** empty-state handling, image/avatar fallback, list virtualization, accessibility.
**Not applicable:** forms/validation, destructive-action confirmation, color/contrast beyond what's already covered by theme tokens.
### Findings
1. (P3) `Image` avatar has no `accessibilityLabel`/`alt`-equivalent, but it's paired with adjacent title/subtitle text that a screen reader will read regardless, and the avatar itself carries no unique information (it's decorative). Low priority.
2. Correctly returns `null` on an empty list; `scrollEnabled={false}` is appropriate since this is always nested inside the outer `ScrollView` from `InsightLayout`.
### Fixes implemented
None — findings are low-priority/cosmetic.
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## index.ts (`src/components/insights/index.ts`)
**Entry point:** Not a route — barrel re-export only (`KpiGrid`, `KpiTile`, `LineChart`, `BarChart`, `DonutChart`, `TimeRangeSelector`, `InsightSkeleton`, `TopItemsList`).
**Criteria evaluated:** code-level correctness.
**Not applicable:** every UX criterion — no logic, no UI, pure re-export.
### Findings
None.
### Fixes implemented
None.
### Verification
No code changed.
**Status:** AUDITED-NO-ISSUES

---

## Summary

- **17 files audited this pass**, 4 fixed (`ContentDashboardScreen.tsx`, `EventsDashboardScreen.tsx`, `MediaDashboardScreen.tsx`, `SurveysDashboardScreen.tsx` — all the same fabricate-success-on-failure fix, plus one pre-existing unused-import lint error removed from `EventsDashboardScreen.tsx`), 13 documented with no safe in-scope fix available (orphan/reachability findings requiring navigation changes, or root causes living in `src/api/insights/insights.api.ts` outside this pass's directory scope).
- **Single most important issue:** Finding A — the `AdminToolsScreen` hub and 10 of its 12 destinations (including several hundred-line admin consoles hardened in the prior audit pass) have no entry point anywhere in the live app. A large amount of built, working, now-polished admin functionality is currently undiscoverable by any real user.
- **Close second:** Finding B — the same silent-failure/fabricated-success bug the prior pass fixed three times (Bridge/Tiers/Notifications) recurred in 4 more screens (now fixed) and has two more live instances in `src/api/insights/insights.api.ts` (`fetchDashboardInsights`, `fetchTiersSummary`) that are out of this pass's directory scope but should be fixed next — one of them can fabricate a placeholder plan/campaign name on a partner-facing revenue screen.
- `npm run typecheck` — clean after all edits.
- `npx eslint` on all 4 edited files — 0 errors, only pre-existing inline-style warnings (not introduced by these changes).
