# Shared Common / Shell / Media / Verification Primitives UX/UI Audit

**Scope:** `src/components/common/**` (11), `src/components/shell/**` (12), `src/components/media/**` (3), `src/components/verification/**` (3), plus root-level `ControlPanelLinkCard.tsx`, `KISFab.tsx`, `SyncQueueBanner.tsx` (3). **Audited: 32 / 32 files.**

This batch is almost entirely true shared design-system plumbing rather than screens, so the review leaned hard on the stated caution: fix only what is unambiguous and additive, document everything else. Two genuine, high-confidence bugs were fixed. The first and most important: `VerificationStatusCard` (in `VerificationCenter.tsx`) accepts `title`/`subtitle` props and computes a `statusLabel`, but the render path silently discarded all three and always painted the hardcoded word "Verification" — every one of its three real call sites (`ProfileScreen`, `MarketManagementModal`, `HealthManagementModal`) passes a distinct, deliberately-written title/subtitle expecting it to show, so a user looking at profile, shop, and health verification cards back-to-back currently sees three identical, undifferentiated cards. This is now fixed to render what callers pass. The second: `KISFab`, confirmed as the app-wide FAB standard, has an optional `accessibilityLabel` prop that **20 of its 30 real call sites never pass**, meaning most floating action buttons across the app are currently unlabeled icon-only controls for screen readers; a non-visual fallback label derived from the icon name was added so no FAB ships fully unlabeled, without touching any of those 20 call sites or changing the prop API. Beyond those two, a cluster of icon-only `Pressable` controls across `ScreenHeader`, `MiniPlayer`, `SyncQueueBanner`, and both verification sheets' close buttons were missing `accessibilityLabel`/`accessibilityRole` and were given one — all zero-risk, purely additive, non-visual changes. The most consequential *documented-only* finding: `ErrorBoundary.tsx` is not dead code — it is mounted once, at the absolute root of `App.tsx`, wrapping the entire app — so its hardcoded, non-theme-aware fallback colors (stark white background/near-black text regardless of dark mode) are what every single user would see if any uncaught render error anywhere in the app's 500+ screens ever fires. It is a class component and cannot call `useKISTheme()` without a larger refactor (a context consumer wrapper), so that part was documented rather than risked blind. A `PermanentRemoteImage` download-failure path that resets to "Download" with zero error text on failure (silent-error-swallowing pattern) was also documented, not fixed, given its 10 consumers and that adding visible error UI is new behavior, not a pure prop-render fix. Everything else in this batch — `SafeAreaViewWithTopPadding` (211 consumers), `KISText` (49), `Skeleton` (27), the whole `shell/` tablet chrome, and the three media loading wrappers — came back clean: `AUDITED-NO-ISSUES`.

---

## ErrorBoundary (`src/components/common/ErrorBoundary.tsx`)
**Used by:** 1 call site, but it is the root of the whole app — `App.tsx:2305` wraps `<LanguageProvider>…<GoldenSectionProvider><AppContent /></GoldenSectionProvider>…</LanguageProvider>` entirely inside this boundary. It is the single app-wide crash fallback.
**Criteria evaluated:** error states, color/contrast/design-system consistency, accessibility labels, cognitive load
**Not applicable:** touch target sizing (button already comfortably sized), reduced motion (no animation), small-screen usability (simple centered column)

### Findings
1. **(P2) Fallback UI is fully hardcoded (`#FFFFFF` bg, `#111111`/`#666666` text, `#111111` button) and ignores `useKISTheme()`/`KIS_COLORS` entirely.** In dark mode, any uncaught render error anywhere in the app flashes a stark white screen rather than anything theme-consistent. Blast radius: every screen in the app, because this is the one and only crash boundary that exists. Low likelihood of being hit often (requires an uncaught error), but when it does hit, 100% of users see it exactly as written here.
2. **(P3, fixed) "Try again" `Pressable` had no `accessibilityRole`/`accessibilityLabel`.**

### Fixes implemented
- Added `accessibilityRole="button"` and `accessibilityLabel={translateString('Try again')}` to the retry button — purely additive, zero visual/behavioral change.
- **Did not** change the hardcoded colors. `ErrorBoundary` is a class component; `useKISTheme()` is a hook and cannot be called here without either converting the class to use a `ThemeContext.Consumer` (no such consumer is currently exported from `src/theme/useTheme.ts` — would need to be added) or restructuring into a function-component wrapper around the class. This is the one component in the app that MUST keep working when something else has already gone wrong; changing its render path on a hunch, with no way to force-trigger a real crash here to verify visually, is exactly the kind of risk the brief asks to avoid. Documenting instead: recommend a follow-up task to either thread a plain `{bg, text, button}` triple down as props from `App.tsx` (which *can* call the hook) or add a theme context consumer, verified live by throwing a test error.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## GoldHeaderShell (`src/components/common/GoldHeaderShell.tsx`)
**Used by:** 7 screens (Messages/Bible/Broadcast/Partners/Profile gold headers)
**Criteria evaluated:** visual hierarchy, color/design-system consistency, prop API consistency
**Not applicable:** accessibility labels (purely decorative gradient backdrop, no text/icon-only controls of its own), loading/error/empty states (stateless shell), touch targets (non-interactive)

### Findings
None. Gradient source defaults to the theme's `gradients.header`, direction/colors are overridable in a documented, narrow way (only for the one seam-matching case called out in the comment), and the component correctly separates "absolutely-filled backdrop" from "normal-flow content" as documented.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## ImagePlaceholder (`src/components/common/ImagePlaceholder.tsx`)
**Used by:** 14 call sites (avatar/thumbnail fallbacks)
**Criteria evaluated:** color/design-system consistency, touch targets (n/a — non-interactive), accessibility, prop API consistency
**Not applicable:** loading/error states (this *is* the fallback state for other components' loading/error handling), reduced motion (static)

### Findings
1. **(P3) Decorative image icon is exposed to screen readers with no explicit `accessibilityElementsHidden`/`importantForAccessibility="no"`.** Low severity — it has no text and most consumers already sit inside a parent that has its own label — but a screen reader will still announce a generic "image" icon.

### Fixes implemented
None — this is a genuine judgment call on 14 unverified consumers' surrounding context (some may rely on this being independently focusable/announced for a reason not visible from this file alone); documenting rather than guessing.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## KISText (`src/components/common/KISText.tsx`)
**Used by:** 49 consumers per prior inventory (49 confirmed as a very-high-reuse primitive; this pass's own grep found 16 direct-import call sites, the gap most likely explained by additional re-export/barrel indirection not walked here)
**Criteria evaluated:** typography, color/design-system consistency, prop API consistency, cognitive load
**Not applicable:** touch targets (text, not a control, except the opt-in handle-link spans), loading/error states (stateless), reduced motion

### Findings
None found that meet the fix bar. `autoLinkHandles` wrapping every string/number child in `translateString()` + handle-splitting on every render is the one thing worth flagging as a **watch item, not a bug**: it means any screen passing a raw numeric ID, code, or other non-prose string through `<KISText>` gets it run through the translation layer and handle-parser whether or not that was intended. This is pre-existing, applies identically to all 49 consumers today, and changing it would be a behavior change to a component with that much reach — exactly the case the brief says to leave alone.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## MainTabScaffold (`src/components/common/MainTabScaffold.tsx`)
**Used by:** 1 direct import found by grep, but it exports two widely-styled pieces (`MainTabPageHeader`, `MainTabStateBlock`) used across the five main-tab screens
**Criteria evaluated:** visual hierarchy, responsive/small-screen (explicit watch/compact-phone breakpoints), touch targets, accessibility labels, color/design-system consistency
**Not applicable:** reduced motion (no animation), offline/permission states (purely presentational header/empty-state components, no data fetching)

### Findings
None. `accessibilityRole="header"` on the header container, `accessibilityLabel`/`accessibilityRole="button"` on both header actions, loading vs. icon swap in `MainTabStateBlock`, and watch/compact-phone responsive sizing are all handled correctly and consistently with `KIS_TOKENS`.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## MiniPlayer (`src/components/common/MiniPlayer.tsx`)
**Used by:** mounted once, globally, inside `MiniPlayerProvider` at `App.tsx:2234` — a single render site but app-wide in effect (appears over any screen whenever media is playing)
**Criteria evaluated:** touch targets, accessibility labels on icon-only controls, reduced motion, color/design-system consistency, gesture affordance
**Not applicable:** loading/error/empty states (no network fetch of its own — `contentId` null is its only "empty" state and is handled by returning `null`), small-screen usability (fixed 64pt bar, already minimal)

### Findings
1. **(P2, fixed) Play/pause and close icon-only `Pressable` controls had no `accessibilityRole`/`accessibilityLabel`.** Both are 44×44 (correct touch target) but screen-reader users had no way to know what either icon did. Blast radius: every screen in the app whenever a video/audio session is active, for the lifetime of this component.
2. **(P3) No reduced-motion guard on the slide-in/slide-out `Animated.spring`/`Animated.timing`.** Pre-existing pattern shared with several other animated primitives in this batch (`NetworkStatusPill`, `Skeleton`, `ContextPanel`, `Sidebar`'s press-scale); not fixed here as a blanket, unverified change to motion behavior across many components is outside the "obvious, zero-risk" bar.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` (`"Play"`/`"Pause"` dynamically, `"Close mini player"`) to the two icon-only controls.

### Verification
`npm run typecheck`: clean. `eslint`: 1 pre-existing inline-style warning on an unrelated line (112, the fallback-thumbnail `View`), not introduced by this change.
**Status:** AUDITED-FIXED

---

## NetworkStatusPill (`src/components/common/NetworkStatusPill.tsx`)
**Used by:** 2 call sites (rendered inside the shared Golden Section header host)
**Criteria evaluated:** accessibility (live region), color/state semantics, reduced motion, touch targets (n/a — `pointerEvents="none"`)
**Not applicable:** loading/error/empty states (this component *is* a connectivity state indicator), small-screen usability (compact self-sized pill)

### Findings
None of fix-worthy severity. `accessibilityLiveRegion="polite"` + a correct `accessibilityLabel` ("No internet connection" / "Back online") are both present. The offline pulse animation has no reduced-motion guard — same pre-existing, shared pattern noted under MiniPlayer above; documenting rather than fixing in isolation on one of several components that share it.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## SafeAreaViewWithTopPadding (`src/components/common/SafeAreaViewWithTopPadding.tsx`)
**Used by:** 211 consumers per prior inventory — the single highest-reuse file in this entire batch
**Criteria evaluated:** layout/prop-forwarding correctness, prop API consistency
**Not applicable:** accessibility labels (pure layout wrapper, no text/controls), color/design-system consistency (no visual styling of its own), touch targets, loading/error states, reduced motion

### Findings
None. `includesTopEdge()` correctly handles all three `edges` shapes (`undefined`, array, object-with-`top:'off'`), and the extra padding is only applied when the top edge is actually included. Given 211 consumers, this was checked extra carefully for any case where `style` could be clobbered rather than merged — it is always merged via array composition, never overwritten.

### Fixes implemented
None — meets the bar as-is. Given the blast radius, no speculative change was made here even though none was found necessary.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## SafeCountryPicker (`src/components/common/SafeCountryPicker.tsx`)
**Used by:** 5 call sites (phone-number country selectors)
**Criteria evaluated:** modal presentation, safe-area correctness, accessibility
**Not applicable:** color/design-system consistency (delegates entirely to the third-party `CountryPicker`'s own theming), loading/error states (synchronous, local list), reduced motion

### Findings
1. **(P3) `Modal` has no explicit `accessibilityViewIsModal`.** Minor — iOS/Android both generally handle focus-trapping for a full-screen `Modal` reasonably well by default, and this is a narrow, well-scoped wrapper (5 consumers) around a third-party component whose own internal accessibility behavior wasn't audited here.

### Fixes implemented
None — meets the bar as-is; the one finding is low-severity and touches modal-focus behavior that's risky to change without live screen-reader verification on a component this wraps rather than owns.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ScreenHeader (`src/components/common/ScreenHeader.tsx`)
**Used by:** 7 direct consumers (non-main-tab screen headers)
**Criteria evaluated:** touch targets, accessibility labels on icon-only controls, typography, color/design-system consistency, cognitive-load (discoverability hint)
**Not applicable:** loading/error states (stateless header), reduced motion (the optional `animateBackHint` nudge is opt-in, off by default, and is itself a deliberate motion-based affordance, not an unguarded ambient animation)

### Findings
1. **(P2, fixed) Back-arrow icon-only `Pressable` had no `accessibilityRole`/`accessibilityLabel`.** `hitSlop={12}` on a 32×32 `sideSlot` gives a reasonable effective touch target, but there was no accessible name for the control at all. Blast radius: all 7 screens using `ScreenHeader` with `onBack`.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## Skeleton (`src/components/common/Skeleton.tsx`)
**Used by:** 27 consumers per prior inventory — second-highest reuse in this batch
**Criteria evaluated:** color/design-system consistency, reduced motion, prop API consistency
**Not applicable:** accessibility labels (no text/icon content to label — it is a pure shape placeholder), touch targets (non-interactive), loading/error/empty states (this component *is* the loading-state primitive)

### Findings
1. **(P3) Shimmer loop has no reduced-motion check (`AccessibilityInfo.isReduceMotionEnabled`).** Given 27 consumers rendering this continuously during every loading state across the app, a user with reduced-motion preferences gets a permanently pulsing opacity animation on every single skeleton, everywhere, with no opt-out respected. This is a real finding, but implementing a fix means adding an async `AccessibilityInfo` check plus a listener for runtime preference changes — a non-trivial behavior change to a component with this much reach, and one that should be verified live (does the shimmer actually stop? does a static skeleton still read as "loading" without motion?) rather than shipped blind. Documenting, not fixing.

### Fixes implemented
None, for the reason above.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ContextPanel (`src/components/shell/ContextPanel.tsx`)
**Used by:** tablet/desktop shell only (rendered by `TabletLayout`)
**Criteria evaluated:** empty state, color/design-system consistency, reduced motion
**Not applicable:** accessibility labels (no icon-only controls — it only renders whatever each screen registers), touch targets, loading/error states (nothing fetched here), small-screen usability (tablet/desktop-only by construction)

### Findings
None of fix-worthy severity. Empty state ("Nothing to show here yet") is clear and themed correctly. Fade/slide transition on content change has no reduced-motion guard — same shared pattern noted elsewhere in this audit.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## ContextPanelContext (`src/components/shell/ContextPanelContext.tsx`)
**Used by:** shell-internal plumbing (`ContextPanel` reads, 5 main-tab screens write via `useContextPanelContent`)
**Criteria evaluated:** state-management correctness (owner-token race safety), prop API consistency
**Not applicable:** every visual/UX criterion — this file renders no UI at all, it is a context provider/hook pair

### Findings
None. The owner-token pattern correctly prevents a blurring screen's cleanup from clobbering a newly-focused screen's freshly-set content (a real race this guards against), and the setter/payload context split is a legitimate, documented perf optimization.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## DesktopLayout (`src/components/shell/DesktopLayout.tsx`)
**Used by:** `ResponsiveContainer` (desktop breakpoint)
**Criteria evaluated:** prop API consistency
**Not applicable:** all other criteria — this is a 5-line passthrough to `TabletLayout` with a `desktop` flag, no visual logic of its own

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## MobileLayout (`src/components/shell/MobileLayout.tsx`)
**Used by:** `ResponsiveContainer` (phone breakpoint)
**Criteria evaluated:** prop API consistency
**Not applicable:** all other criteria — deliberate no-op passthrough (`<>{children}</>`), phone UI is explicitly not touched by this file by design

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## ResponsiveContainer (`src/components/shell/ResponsiveContainer.tsx`)
**Used by:** `AppNavigator`'s `MainTabs` (the single decision point for phone/tablet/desktop shell mode)
**Criteria evaluated:** state-management correctness (provider mount stability across breakpoint changes), prop API consistency
**Not applicable:** visual criteria — this file renders no chrome of its own, it only selects between the three layout components

### Findings
None. `ContextPanelProvider` is correctly mounted unconditionally outside the three-way branch, exactly as the comment states, so rotating/resizing across the phone/tablet/desktop breakpoint never remounts it and drops in-flight panel registrations.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## Sidebar (`src/components/shell/Sidebar.tsx`)
**Used by:** 2 direct consumers (`TabletLayout`/`DesktopLayout`'s shared tablet/desktop nav rail)
**Criteria evaluated:** touch targets, accessibility labels on icon-only controls, color/design-system consistency, responsive collapse state, cognitive load
**Not applicable:** loading/error states (no data fetching — `useAuth()` is read synchronously from context), reduced motion (press-scale feedback is a standard, bounded interaction animation, not ambient)

### Findings
None of fix-worthy severity. Every single icon-only control in this file — nav items, profile row, both theme toggles, both collapse/expand buttons — already has correct `accessibilityRole="button"` + `accessibilityLabel`, plus `accessibilityState={{selected}}` on nav items. This is the best-instrumented file in the entire batch and a good reference example for the gaps found elsewhere (`ScreenHeader`, `MiniPlayer`, `SyncQueueBanner`).

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## TabletCard (`src/components/shell/TabletCard.tsx`)
**Used by:** tablet/desktop shell sections and reflowed content cards
**Criteria evaluated:** color/design-system consistency, prop API consistency
**Not applicable:** accessibility (pure container, no text/controls of its own — labeling is the child content's responsibility), touch targets, loading/error states, reduced motion

### Findings
None. Pulls exclusively from `KIS_COMPONENT_TOKENS`/`useKISTheme()` with no hardcoded colors, as its own header comment requires.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## TabletDialogOverlay (`src/components/shell/TabletDialogOverlay.tsx`)
**Used by:** 5 call sites (chat room / chat info / community room / community info overlays in `AppNavigator`)
**Criteria evaluated:** layout/responsive behavior, color/design-system consistency, dismiss affordance
**Not applicable:** accessibility labels (wraps an entire pre-existing screen as `children` unmodified — no icon-only controls of its own), reduced motion (progress-driven interpolation is caller-controlled, not an ambient loop), touch targets

### Findings
1. **(P3) No tap-outside-to-dismiss on the tablet/desktop centered-dialog backdrop.** The `backdrop` `Animated.View` is explicitly `pointerEvents="none"` with no `onPress`, so on tablet/desktop the only way to close one of these floating dialogs is whatever explicit close control the wrapped screen (`ChatRoomPage`, etc.) provides. This may be entirely intentional — the phone variant has no backdrop-tap-to-dismiss either, since it's a full-bleed slide-in — but it's worth flagging since floating centered dialogs conventionally support backdrop-tap-dismiss on larger screens. Not fixed: adding a dismiss handler here would need a close callback threaded through a prop this component doesn't currently have, which is an API change, and risks double-handling dismissal if the wrapped screen already has its own close button wired to pop navigation rather than toggle `visible`.

### Fixes implemented
None, for the reason above.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## TabletLayout (`src/components/shell/TabletLayout.tsx`)
**Used by:** `ResponsiveContainer` (tablet breakpoint) and `DesktopLayout`
**Criteria evaluated:** responsive layout correctness, color/design-system consistency
**Not applicable:** accessibility labels (delegates all interactive chrome to `Sidebar`, which was already checked clean), touch targets, loading/error states, reduced motion

### Findings
None. The `MIN_CONTENT_WIDTH` gate that hides the context panel rather than always reserving its width is a sound, well-reasoned piece of defensive layout math (explained in detail in the file's own comment), and `overflow: 'hidden'` on `mainColumn` correctly contains phone-era content that sizes off raw device width.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## TabletShell (`src/components/shell/TabletShell.tsx`)
**Used by:** `AppNavigator`'s `MainTabs` (single import point)
**Criteria evaluated:** prop API consistency
**Not applicable:** all other criteria — a 4-line re-export of `ResponsiveContainer`, no logic of its own

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## shell/index.ts (`src/components/shell/index.ts`)
**Used by:** barrel re-export for the shell module
**Criteria evaluated:** export correctness
**Not applicable:** all visual/UX criteria — no UI, no logic

### Findings
None. Every exported name matches an actual export in its source file.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## shellTypes.ts (`src/components/shell/shellTypes.ts`)
**Used by:** `TabletLayout`, `DesktopLayout`, `ResponsiveContainer`, `TabletShell`
**Criteria evaluated:** type-contract consistency
**Not applicable:** all visual/UX criteria — type-only file, no UI, no runtime logic

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## LoadingImage (`src/components/media/LoadingImage.tsx`)
**Used by:** 1 direct import found by grep (low measured reuse relative to its sibling `PermanentRemoteImage`)
**Criteria evaluated:** loading state, color/design-system consistency, error-state handling (silent-failure hunt)
**Not applicable:** accessibility labels (no icon-only controls — just an `Image` + spinner), touch targets, reduced motion (spinner is a native `ActivityIndicator`, not a custom animation)

### Findings
1. **(P3) `onError` only hides the spinner; there is no built-in broken-image fallback visual.** If the image fails and the consumer's own `onError` doesn't render a fallback, the user sees a blank area with no indication anything went wrong — a mild version of the "silent failure" pattern called out in the audit brief. Not fixed: this is a deliberate "drop-in `<Image>` replacement" (per the file's own header comment) — plain `<Image>` has the exact same blank-on-error behavior, and the component already forwards `onError` so every consumer can (and in a healthy codebase should) handle it themselves. Adding a default fallback visual here would be new behavior for every consumer, not a bug fix.

### Fixes implemented
None, for the reason above.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## LoadingPdf (`src/components/media/LoadingPdf.tsx`)
**Used by:** 1 direct import found by grep
**Criteria evaluated:** loading state, color/design-system consistency, error-state handling
**Not applicable:** accessibility labels, touch targets, reduced motion — same reasoning as `LoadingImage`

### Findings
1. **(P3) Same pattern as `LoadingImage`:** `onError` hides the spinner with no default fallback UI, forwarding the error to the caller. Same reasoning for not fixing applies.

### Fixes implemented
None, for the reason above.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PermanentRemoteImage (`src/components/media/PermanentRemoteImage.tsx`)
**Used by:** 10 consumers per grep
**Criteria evaluated:** loading/offline state, fabricate-success/silent-error-swallowing hunt, accessibility labels, color/design-system consistency
**Not applicable:** reduced motion (native `ActivityIndicator` + progress text only), small-screen usability (self-contained, size comes entirely from caller's `style`)

### Findings
1. **(P2) `handleDownload`'s `catch` block silently resets `downloading` to `false` with no error message shown anywhere.** If `queueMediaDownload` throws (network failure, storage failure, quota, etc.), the UI simply reverts to showing the "Download" button again with zero indication that the previous attempt failed — a direct match for the "silent-error-swallowing" pattern the audit brief calls out as the most common bug class found this session. A user could tap "Download" repeatedly and never learn why it isn't working. Blast radius: 10 known consumers, all permanent-media download flows. Not fixed: surfacing this requires adding a new piece of visible UI (an error message or toast) that doesn't exist today — this is new behavior, not a dropped-prop render fix like the `VerificationStatusCard` case elsewhere in this audit, and should be verified live (what does the error message say, where does it sit relative to the download button, does it clear on retry) rather than guessed at blind given the component's reach.
2. **(P3) Online/offline button label correctly communicates offline state (`"Offline"` vs `"Download"`), but there is no live update if connectivity changes while the "Download" button is idle and un-tapped** — `online` state does update via the `NetInfo` listener, so this is actually handled correctly; noting it here only because it was the first thing checked given the file's offline-related `NetInfo` usage, and it passed.

### Fixes implemented
None — finding #1 documented per the reasoning above; #2 was not a bug.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## VerificationBadgeRow / VerificationStatusCard / VerificationCenterSheet / normalizeVerificationSummary (`src/components/verification/VerificationCenter.tsx`)
**Used by:** `VerificationBadgeRow` + `VerificationStatusCard` — 3 real consumers each (`ProfileScreen`, `MarketManagementModal`, `HealthManagementModal`); `VerificationCenterSheet` — 3 consumers (same three, as the modal each status card opens)
**Criteria evaluated:** prop-handling correctness, loading/error states (fabricate-success hunt), accessibility labels on icon-only controls, color/design-system consistency, forms/validation
**Not applicable:** reduced motion (standard `Modal` slide, no custom animation), small-screen usability (bottom sheet already scrolls and wraps)

### Findings
1. **(P1, fixed) `VerificationStatusCard` silently discarded its own `title`, `subtitle`, and computed `statusLabel`.** The function accepted `title = 'Verification'` and `subtitle` as props and computed `statusLabel` (e.g. "Verified and badge-ready" / "Ready to start" / humanized case status) via `resolveTone`/`toneColors`, but the actual JSX never rendered any of the three — it always painted the literal string `"Verification"` with no subtitle or status line at all. All 3 real call sites pass distinct, purpose-written `title`/`subtitle` pairs ("Profile verification" / "Shop verification center" / "Health verification center", each with its own subtitle) specifically so a user can tell these cards apart across different screens — none of that text was ever visible. This is a pure prop-handling bug with zero other interpretation: the props exist, are typed, are passed by every consumer, and were simply never wired into render. Fixing it is strictly additive for every known consumer (none currently see any benefit from the suppressed values, so there is no "correct existing usage" this could regress).
2. **(P2, fixed) Icon-only close button (`✕`) on `VerificationCenterSheet` had no `accessibilityRole`/`accessibilityLabel`.**
3. **(P3) Status/error message color-coding uses fragile string-matching** (`message.includes('submitted') || message.includes('added') ? success-color : danger-color`) rather than a dedicated success/error flag — works today because the two success-path messages happen to contain those words, but a future wording tweak could silently flip a success message to the danger color. Not fixed: this is a judgment call on a data-flow refactor (introducing an explicit `messageTone` state) rather than a one-line bug, and the current behavior is not actually wrong today.
4. Evidence-upload (`pickEvidenceFile`) and submission (`submit`) flows correctly surface every failure via `setMessage(error?.message || ...)` in a `catch`/`finally` — no fabricate-success-on-failure pattern found here; this is a good example of the inverse of the bug class the brief asked to hunt for.

### Fixes implemented
- `VerificationStatusCard` now renders `title`, the computed `statusLabel`, and `subtitle` (when present) in a proper icon-badge + text-column + chevron layout, replacing the single dead-end row that only ever showed the hardcoded word "Verification." Added `accessibilityRole="button"` + a composed `accessibilityLabel` to the card's `Pressable`. Added two new style entries (`statusIconBadge`, `statusTextWrap`) and `padding: 14` on `statusCard` (which previously had no padding of its own — it had been relying entirely on the inner icon row's `padding: 5`) so the new multi-line text column isn't flush against the card border.
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the sheet's close button.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file (6 pre-existing inline-style warnings on unrelated lines, not introduced here).
**Status:** AUDITED-FIXED

---

## VerificationStaffConsole (`src/components/verification/VerificationStaffConsole.tsx`)
**Used by:** 1 consumer (internal staff-only review console)
**Criteria evaluated:** loading/error states (fabricate-success hunt), accessibility labels on icon-only controls, forms/validation (reject-reason requirement), color/design-system consistency
**Not applicable:** small-screen usability (staff-only admin tool, not phone-optimized by design), reduced motion

### Findings
1. **(P2, fixed) Icon-only close button had no `accessibilityRole`/`accessibilityLabel`** — same pattern as `VerificationCenterSheet` above.
2. Every mutating action (`load`, `issueBadge`, `revokeBadge`, `updateStatus`, `reviewCase`) correctly wraps its request in `try/catch/finally`, surfaces `error?.message` via `setMessage`, and only shows a success message inside the `try` block after the request actually resolved — no fabricate-success-on-failure found. `reviewCase('reject')` also correctly blocks submission client-side when no reason note is entered, matching the comment's own documented backend constraint.
3. Same fragile message-color string-matching as `VerificationCenter.tsx` (`message.includes('updated')`) — same reasoning for not fixing (judgment call, not a bug, isolated to this one staff tool).

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file (9 pre-existing inline-style warnings on unrelated lines, not introduced here).
**Status:** AUDITED-FIXED

---

## verification/index.ts (`src/components/verification/index.ts`)
**Used by:** barrel re-export for the verification module
**Criteria evaluated:** export correctness
**Not applicable:** all visual/UX criteria

### Findings
None. Every exported name matches an actual export in its source file.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## ControlPanelLinkCard (`src/components/ControlPanelLinkCard.tsx`)
**Used by:** 2 consumers (tier-gated "manage from a computer" card, surfaced to Business Pro/Partner/Partner Pro/GO)
**Criteria evaluated:** color/design-system consistency, feedback on action (copy-to-clipboard), touch targets
**Not applicable:** loading/error states (synchronous clipboard write, cannot meaningfully fail), accessibility labels (the only control is a labeled `KISButton`, not icon-only), reduced motion

### Findings
None of fix-worthy severity. `Alert.alert('Copied', ...)` gives clear, immediate feedback on the copy action — a good example of *not* silently succeeding without telling the user anything. `KISButton size="xs"` touch-target sizing is `KISButton`'s own concern (out of this audit's scope) rather than this file's.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-check needed.
**Status:** AUDITED-NO-ISSUES

---

## KISFab (`src/components/KISFab.tsx`)
**Used by:** 30 call sites confirmed by grep (app-wide FAB standard, per prior inventory ~31)
**Criteria evaluated:** accessibility labels on icon-only controls, touch targets, color/design-system consistency, prop API consistency across the wider FAB/button family
**Not applicable:** loading/error states (stateless presentational control — no data fetching), reduced motion (press-opacity feedback only, no ambient animation), small-screen usability (fixed circular size, scales via `size`/`iconSize` props already)

### Findings
1. **(P1, fixed) `accessibilityLabel` is optional with no fallback, and 20 of the 30 real call sites never pass one** (`MessageList.tsx`, `CommunityRoomPage.tsx`, `BroadcastScreen.tsx`, `UpdatesTab.tsx`, `PetitionsScreen.tsx`, `ComplianceTrackerScreen.tsx`, `ChurchPledgeScreen.tsx`, `PrayerWallScreen.tsx`, `SongLibraryScreen.tsx`, `MemorialPagesScreen.tsx`, `CrowdfundScreen.tsx`, `MembersScreen.tsx`, `FamilyAlbumScreen.tsx`, `FamilyNoticeBoardScreen.tsx`, `TimeCapsuleScreen.tsx`, `MilestonesScreen.tsx`, `FamilyPrayerScreen.tsx`, `FamilyCalendarScreen.tsx`, `FeedScreen.tsx`, `PartnerFeedPage.tsx`). Since this is confirmed the one app-wide FAB standard, that means roughly two-thirds of the floating action buttons in the app are currently announced to a screen reader with no accessible name at all. This is the single most important finding in this entire batch by blast radius: one component, ~30 screens, most of them silently broken for assistive technology today.
2. **(P3) `icon: string` is untyped** (every other icon prop audited in this batch uses the stricter `KISIconName` union from `@/constants/kisIcons`) — a minor prop-API consistency gap, not fixed here since tightening the type could surface pre-existing call sites passing an invalid icon name as new type errors across ~30 files outside this audit's scope.

### Fixes implemented
- Added a non-visual fallback: when `accessibilityLabel` is not supplied, it now derives one from the `icon` name (e.g. `"add"` → `"add button"`) rather than leaving the control unlabeled. This does not change the prop API (still optional, same type), does not touch any of the 20 call sites directly, and cannot change anything visually — it only ensures *some* accessible name exists where today there is none. The underlying, better fix (adding explicit, context-correct labels at each of the 20 call sites — e.g. "Add contact," "Add petition," "New prayer request") is out of this batch's scope and is called out here for a follow-up pass.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## SyncQueueBanner (`src/components/SyncQueueBanner.tsx`)
**Used by:** mounted once, globally, at `App.tsx:1423` — a single render site but app-wide in effect (can appear over any screen whenever the offline action queue has pending/failed items)
**Criteria evaluated:** accessibility labels on icon-only controls, loading/error/retry states, color/design-system consistency, auto-hide/timing behavior
**Not applicable:** reduced motion (slide/fade is a single bounded transition tied to a real state change, not an ambient loop), small-screen usability (self-sized, capped at `maxWidth: 480`)

### Findings
1. **(P2, fixed) Icon-only dismiss (`✕`) button had no `accessibilityRole`/`accessibilityLabel`.** The main card itself correctly has `accessibilityLiveRegion="polite"` + a composed `accessibilityLabel`, but the separate dismiss `Pressable` nested inside it did not.
2. Retry/error flow is correctly handled: `handleRetry` calls `flushOfflineActionQueue()` inside `try/finally`, the auto-hide timer is explicitly suspended while `retrying` is true, and the "failed" state shows a `warning` icon + "Tap to retry" subtitle rather than silently clearing — a good example of the inverse of the fabricate-success pattern.
3. `palette.warningStrong` is referenced but is not a defined key in `KISPalette` (only `warning` exists) — it always evaluates to `undefined` at runtime, silently falling through to the hardcoded `'#B45309'` fallback already written right next to it (`palette.warningStrong ?? '#B45309'`). Functionally harmless today (the fallback is a reasonable amber), but worth noting as a dead/wrong palette reference. Not fixed: the type's `[key: string]: string | undefined` catch-all means this compiles silently, and guessing whether the intent was a new palette token (`warningStrong`) that should be added to `theme/constants.ts`, or simply removing the dead reference, is a judgment call outside a single-file fix.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Dismiss"` to the dismiss button.

### Verification
`npm run typecheck`: clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED
