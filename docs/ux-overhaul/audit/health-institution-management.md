# Health Institution Management — UX/UI Audit

**Scope:** 13 screens in `src/screens/health/` (root level), 8 shared components in `src/components/health/`, and 2 shared components in `src/components/healthcare/`. 23 files total, ~22,200 lines. This is institution/clinical-operations management: onboarding, member/role administration, service catalogs, availability/calendar editing, clinical workflow (tasks/escalations/triage/referrals), patient booking cards, and the large multi-engine booking/session screen. Two files carry forward settled findings from earlier this session: `HealthInstitutionsScreen.tsx` is confirmed dead/superseded code (duplicated by `HealthManagementModal.tsx` wrapping `InstitutionsListScreen`), and `InstitutionOnboardingScreen.tsx` is a genuinely ambiguous richer-but-possibly-superseded onboarding flow — both carried forward, not re-litigated.

**Summary of findings:** The screens are visually consistent (shared `theme/health` tokens, shared `components/health/*` primitives) and most async actions correctly check `res?.success` and show an `Alert` on failure — this batch does **not** have the widespread silent-catch problem found elsewhere in the app. The single most important issue is structural, not cosmetic: **destructive actions had no confirmation step**. Across the batch, 11 different "delete this / cancel this" actions — deleting an entire institution, deleting a service, removing a member, and 9 separate "Cancel \<workflow\>" buttons in `HealthServiceSessionScreen.tsx` (appointment, video, admission, emergency, pharmacy, billing, home logistics, wellness, reminder) — fired immediately on a single tap with zero "are you sure?" step. All 11 are now fixed. Secondary findings: accessibility labels were present only on "close" icon buttons (an established house pattern) and essentially absent everywhere else (star ratings, calendar day cells, pencil/trash icons, modal close in the shared `HealthActionModal`) — the highest-leverage instances are fixed. A few error-swallowing spots were found and fixed (fallback institution list fetch, dashboard load failure rendering a misleadingly "empty" dashboard instead of an error state, solo-practitioner queue refresh failure). `Alert.prompt` (iOS-only, silently no-ops on Android) is used for "Reassign clinician" in the Clinical Command Center — this is a pre-existing, app-wide pattern (also in `ChatRoomPage`, `ChannelContentDetailPage`, `AdminKISAppPanel`, `InstitutionOnboardingScreen`), documented but intentionally not patched in isolation here. 23/23 files audited; 9 files received code fixes; typecheck is clean and no new lint errors were introduced by any edit (pre-existing lint errors in `ClinicalCommandCenterScreen.tsx`, `AvailabilityManagementScreen.tsx`, and `HealthInstitutionCardsScreen.tsx` were confirmed unrelated to the changed lines).

---

## HealthInstitutionsScreen (`src/screens/health/HealthInstitutionsScreen.tsx`)
**Entry point:** Not registered in `App.tsx`'s navigator — unreachable via the live route table. Its functionality (list institutions → view/edit/add) is duplicated by `HealthManagementModal.tsx`, which wraps the same `InstitutionsListScreen` directly.
**Criteria evaluated:** loading/empty/error states, navigation wiring, accessibility
**Not applicable:** visual hierarchy/typography/color/touch-targets — it renders no UI of its own; it's a thin data-fetching wrapper around `InstitutionsListScreen`.

### Findings
1. **[Carried forward, not re-investigated]** Dead/superseded code — duplicated by `HealthManagementModal.tsx` wrapping `InstitutionsListScreen`. Deletion recommended but blocked by the permission system this session. (P2 — dead code, not user-facing risk)
2. Error handling is sound for what it is: `loadInstitutions` wraps its fetch in try/catch and shows `Alert.alert` on failure rather than swallowing it. Close button has a correct `accessibilityLabel`. No additional issues found beyond the dead-code status.

### Fixes implemented
None — carried-forward finding only; no new issues warranting a code change.

### Verification
Not touched this pass; no new typecheck/lint run needed.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## InstitutionsListScreen (`src/screens/health/InstitutionsListScreen.tsx`)
**Entry point:** Not a direct route — a presentational component consumed by `HealthInstitutionsScreen.tsx` (dead) and `HealthManagementModal.tsx` (live, the real integration point).
**Criteria evaluated:** loading/empty/error states, button placement/labels, color/contrast, navigation, cognitive load
**Not applicable:** forms (none on this screen), offline state (no explicit offline handling, falls through to generic error)

### Findings
1. **Silent-error-swallowing**: `loadFallbackInstitutions` had no `catch`, and its single call site used `.catch(() => {})`. A failed fetch rendered the exact same "No institutions yet" empty-state card as a genuinely-empty institution list — no way to tell a real failure from "you have none," and no retry affordance. (P2 — matches the app-wide anti-pattern called out for this audit)
2. The component independently re-fetches `fetchHealthProfileState()` as a fallback whenever the institutions prop is empty, duplicating the parent's own fetch — works, but is a latent source of duplicate network calls and confusing dual-data-source logic (`preferFallbackData` flag). Documented, not changed (would touch data-flow structure, out of the "safe/low-risk" bar for this pass).
3. "Edit" button is `disabled` when the viewer can't manage the institution, but has no `accessibilityHint`/visible explanation of why — minor.

### Fixes implemented
- Added a `fallbackError` state captured in `loadFallbackInstitutions`'s catch block.
- The empty-state card now distinguishes "Couldn't load institutions — tap to retry" (tappable, retries with `forceNetwork: true`) from the genuine "No institutions yet" message.

### Verification
`npm run typecheck` clean. `npx eslint` on this file: 0 errors (pre-existing style warnings only).

**Status:** AUDITED-FIXED

---

## HealthInstitutionDetailScreen (`src/screens/health/HealthInstitutionDetailScreen.tsx`)
**Entry point:** `HealthInstitutionDetail` route in `App.tsx`.
**Criteria evaluated:** loading/error states, access-control-driven UI, navigation/back behavior, accessibility, trust/privacy (role-based section visibility)
**Not applicable:** forms (this screen has none — it's a dashboard shell that delegates to `InstitutionDashboardShell`, out of this batch's scope)

### Findings
1. **Misleading error recovery**: on a failed `loadDashboard()`, the screen showed a transient `Alert` but left `analytics` at `null`. The final render always passed `analytics` straight to `InstitutionDashboardShell`, which null-coalesces every field to 0/empty — so a failed load rendered a dashboard that looked exactly like a legitimately quiet institution (0 bookings, 0 completed consultations) rather than a failed one. In a clinical-ops context, "quiet" and "broken" look identical, which is a real trust problem. (P1)
2. Role-permission mapping (`rolePermissionsmap` → `accessControls`) is well-reasoned and defensively coded — on a `/auth/checkLogin` failure it explicitly keeps the previous access controls instead of downgrading to `staff`, with a code comment explaining why (avoiding false-downgrades during 429 rate-limit windows). No issue.
3. Close button has correct `accessibilityLabel="Close dashboard"` in all three render branches.

### Fixes implemented
- Added a `loadError` state. On failure, `analytics` stays `null` and a distinct "Couldn't load this dashboard" screen with the error message and a "Try again" button now renders, instead of a misleadingly empty-looking dashboard.

### Verification
`npm run typecheck` clean. No new lint errors.

**Status:** AUDITED-FIXED

---

## HealthServiceSessionScreen (`src/screens/health/HealthServiceSessionScreen.tsx`)
**Entry point:** `HealthServiceSession` route in `App.tsx`. Reached from `HealthInstitutionCardsScreen`'s "Book Now" flow. At 7,987 lines this is by far the largest file in the batch — a single screen housing ~9 separate booking/clinical-workflow "engines" (appointment, video, messaging, admission, emergency, pharmacy, billing, home logistics, wellness, reminder), each with its own load/refresh/complete/cancel actions.
**Criteria evaluated:** forms/confirmations/error-recovery (primary focus), loading/error states, button placement, accessibility, emotional tone/trust
**Not applicable:** visual hierarchy/typography (uses the same shared theme tokens as every other screen in the batch, no deviation found in the sampled sections); small-screen sizing (uses flexible spacing tokens throughout, no hardcoded pixel layouts found)

### Findings
1. **[P0] Nine "Cancel \<workflow\>" buttons (plus the appointment canceller) fired immediately on a single tap with zero confirmation.** This included cancelling a hospital admission, an active emergency session, and a billing/pharmacy fulfillment — real clinical actions with real consequences, one mis-tap away. This is the single most important finding across the entire batch.
2. Each `finish*Session(status)` / `cancelBooking()` / `endVideoSession(status)` function internally wraps its own try/catch with an `Alert.alert` on failure — the `.catch(() => undefined)` seen at every call site is a harmless safety net (prevents an unhandled-promise warning), not a silent-swallow; the functions never actually reject uncaught. This is the correct, established pattern used consistently across all ~9 engines.
3. **Zero `accessibilityLabel`/`accessibilityRole` usage across the entire 7,987-line file** (confirmed via grep: 0 matches). Every action in this screen is routed through `KISButton` with a text `title`, which auto-derives an accessible label — so in practice the gap is less severe than the raw count suggests, but any icon-only touchable here has no accessible name.
4. "Reschedule (Next Available)" commits to a new time immediately with no preview of what that time is before confirming — a patient could be rebooked to an inconvenient slot sight-unseen. Documented; fixing this well requires a preview/dry-run step that may need backend support, out of scope for a safe low-risk fix this pass.
5. A large, repeated structural pattern — 10 near-identical engine sections (load/refresh/status-events/complete/cancel) — is a maintenance smell but not a user-facing defect; flagged for a future refactor, not fixed here.

### Fixes implemented
- Added a confirmation `Alert.alert` (Cancel/destructive-confirm) in front of all 10 cancellation actions: appointment cancel, and the 9 "Cancel \<workflow\>" buttons (video, admission, emergency, pharmacy, billing, home logistics, wellness, reminder). Each has a workflow-appropriate message; the underlying cancel calls and their existing internal error handling are unchanged.

### Verification
`npm run typecheck` clean. `npx eslint` on this file: 0 new errors (file has pre-existing `react-native/no-inline-styles` warnings, unrelated to the edited lines).

**Status:** AUDITED-FIXED

---

## InstitutionServicesCatalogScreen (`src/screens/health/InstitutionServicesCatalogScreen.tsx`)
**Entry point:** `HealthInstitutionServicesCatalog` route in `App.tsx`. Reached from institution management and institution detail screens.
**Criteria evaluated:** forms/validation (add-service form), confirmations, loading/error states, accessibility, information density
**Not applicable:** small-screen hardcoded sizing (none found — uses theme spacing tokens throughout)

### Findings
1. **Missing confirmation on service deletion.** The "Delete" button on a custom service called `deleteCustomService(service.id)` directly with no confirm step — deleting a live, bookable service from the catalog on a single accidental tap. (P1 — same class of issue as the institution-delete and cancel-booking findings elsewhere in this batch)
2. `loadServices()` has a good failure-recovery pattern: on error it shows an `Alert` *and* falls back to `HEALTH_DASHBOARD_DEFAULT_SERVICES` so the screen stays usable rather than stuck empty. `loadMediums`/`loadServiceCatalog` show an `Alert` on failure with no fallback data, which is an acceptable degradation (the screen simply keeps whatever it last had).
3. `addCustomService` validates both name-required and at-least-one-engine-selected before submitting — adequate form validation for this screen.
4. Accessibility labels are present only on the two "Close services page" buttons; the screen otherwise routes essentially everything through `KISButton` (auto-labeled from title), so the practical gap is small.

### Fixes implemented
- Wrapped the "Delete" service action in a confirmation `Alert.alert` naming the service and warning that patients won't be able to book it, before calling `deleteCustomService`.

### Verification
`npm run typecheck` clean. No new lint errors.

**Status:** AUDITED-FIXED

---

## HealthInstitutionMembersScreen (`src/screens/health/HealthInstitutionMembersScreen.tsx`)
**Entry point:** `HealthInstitutionMembers` route in `App.tsx`.
**Criteria evaluated:** forms/validation, confirmations, role/permission logic, privacy (who can see/change what), accessibility
**Not applicable:** none — this is a dense permissions-management screen and effectively every criterion applies.

### Findings
1. **Missing confirmation on member removal.** "Remove" called `removeMember(id)` directly — immediately revoking someone's institution access (pending the next save) on a single tap, with no confirm step, even though adjacent actions in the same file ("Owner cannot be removed", single-owner enforcement) already use `Alert.alert` for *soft* guardrails. (P1)
2. Role logic is unusually careful and well thought-through: single-owner enforcement, rank-based "you can't grant a role above your own" checks (`isRoleAssignableByActor`), and an explicit comment documenting a real prior bug (AND-377) around stale-closure state in `saveMembers`. This is some of the best-reasoned code in the batch.
3. **Inconsistent save semantics**: adding a member via "Open Select Contacts" auto-persists immediately (`saveMembers` is called inline), but role changes (Assign role / Quick cycle / Remove role) and the membership Open/Closed + discount settings only mutate local state — the user must remember to tap "Save Members, Roles & Settings." Navigating back (via the header close button or system back) without saving silently discards those edits with no "unsaved changes" warning. (P2 — documented, not fixed: a proper fix needs a `navigation.addListener('beforeRemove', …)` guard, which edges toward "navigation behavior change" and was kept out of scope for this pass.)
4. "Quick cycle" (tap to cycle a member through all roles in order, reading the result off the label below) is a non-standard, error-prone interaction for a permission-changing action, when "Assign role" already exists as a direct picker for the same member. (P3 — UX simplification candidate, not fixed; removing a button is a bigger behavioral call than this pass's mandate covers.)
5. A local, in-memory-only "audit log" (`memberAuditLogs`) is appended to on every role/member change but is never rendered anywhere and never persisted — it vanishes on unmount. This reads as unfinished/vestigial functionality rather than a real audit trail. No end-user-visible defect today (nothing displays it), but worth flagging for whoever picks this up next.
6. Accessibility is good here specifically because almost every action goes through `KISButton`, which auto-labels from its `title` text.

### Fixes implemented
- Wrapped `removeMember` in a confirmation `Alert.alert` naming the member and warning that they'll lose access on save, before applying the removal.

### Verification
`npm run typecheck` clean. No new lint errors.

**Status:** AUDITED-FIXED

---

## AvailabilityManagementScreen (`src/screens/health/AvailabilityManagementScreen.tsx`)
**Entry point:** `AvailabilityManagement` route in `App.tsx`. Reached from institution detail/management and the Solo Practitioner Dashboard's Schedule tab.
**Criteria evaluated:** forms (calendar/slot editing — the heaviest form in this batch), touch targets, accessibility, loading/error states, performance
**Not applicable:** color contrast (uses the same theme tokens as the rest of the batch, no deviation)

### Findings
1. **Zero `accessibilityLabel`/`accessibilityRole` anywhere in 2,368 lines** prior to this pass (confirmed via grep: 0 matches) — notable specifically because, unlike most of this batch, the calendar day-cells are custom `TouchableOpacity`s (not `KISButton`), so they got no auto-label at all. A VoiceOver/TalkBack user tapping a day cell previously heard only an unlabeled button; the day's availability status (Available/Blocked/Holiday/etc.) was conveyed purely through background color. (P2)
2. The 3 "close" icon buttons use `KISButton` with icon-only `children` (no `title` prop) — so the usual auto-label-from-title path didn't apply here either, and they had no `accessibilityLabel`. Inconsistent with the "Close dashboard"/"Close members" pattern used correctly everywhere else in this batch. (P2)
3. **Touch target below 44pt in the compact/year calendar view**: day cells render at 20×20px when `compact=true` (used for the full-year overview), each still wired to the same `handleDayPress` as the 44×44 month-view cells. Fitting 12 months of 7-column grids on one screen genuinely doesn't leave room for 44pt cells — this is an inherent density/accessibility tradeoff in the year view's design, not a one-line fix, and is documented rather than changed.
4. Save flow is solid: validates `res?.success`, shows `Alert.alert` on both success and failure. Like the Members screen, edits live in a local `draft` until a single "Save" — navigating back loses unsaved edits silently (same cross-cutting pattern noted above; not fixed here for the same reason).
5. A `setInterval(() => setNowMs(Date.now()), 1000)` runs for the screen's entire lifetime to drive live slot countdown labels (confirmed as genuinely used, not dead code) — this re-renders the whole calendar tree every second. Functional, but a real performance concern on a screen this size; flagged, not changed (risk of breaking the live countdown outweighs the benefit of a quick fix here).
6. The per-service availability checkbox rows have ~6px vertical padding — likely under the 44pt minimum touch height in a dense checklist; acceptable information-density tradeoff, documented only.

### Fixes implemented
- Added `accessibilityRole`, a descriptive `accessibilityLabel` (date + status + countdown), and `accessibilityState` to the calendar day-cell `TouchableOpacity`.
- Added `accessibilityLabel="Close availability management"` to both icon-only `KISButton` close buttons.

### Verification
`npm run typecheck` clean. `npx eslint`: 1 pre-existing error (`react-hooks/exhaustive-deps`, missing `STATUS_OPTIONS_WITH_COLORS` dependency) at line 1456 — confirmed unrelated to this pass's edits (the dependency was already referenced in the same `useCallback` before this pass touched it; this pass only added uses of already-in-scope local variables).

**Status:** AUDITED-FIXED

---

## ClinicalCommandCenterScreen (`src/screens/health/ClinicalCommandCenterScreen.tsx`)
**Entry point:** `ClinicalCommandCenter` route in `App.tsx`.
**Criteria evaluated:** forms/confirmations/error-recovery, loading/empty/error states (tab-scoped), cross-platform correctness, accessibility
**Not applicable:** none of the listed criteria are inapplicable — this is a dense operational dashboard touching most of them.

### Findings
1. **[P1] Cross-platform bug: `Alert.prompt` is iOS-only.** The "Reassign clinician" action in the Triage detail modal uses `Alert.prompt`, which is undocumented/no-op on Android — tapping "Reassign" on an Android device does nothing, with zero error feedback (looks like a dead button). This is a pre-existing, app-wide pattern — the same API is used in `ChatRoomPage.tsx`, `ChannelContentDetailPage.tsx`, `AdminKISAppPanel.tsx`, and `InstitutionOnboardingScreen.tsx` (also audited in this batch) — not something introduced in this file. Fixing it properly means building one shared cross-platform text-input modal and swapping all 5 call sites, which is a larger, cross-cutting change outside this pass's "safe, single-file, low-risk" mandate. Documented for a dedicated follow-up pass.
2. **Silent-error-swallowing in the Triage modal's "Update Level" and "Reassign" actions.** Both previously did `await patchRequest(...).catch(() => undefined)` and then *unconditionally* applied the optimistic local-state update and closed the modal — on a failed request, the clinician would see the acuity level change and the modal close as if it worked, while the backend silently stayed out of sync. This is exactly the pattern this audit was asked to look for. (P1 — clinical data integrity)
3. Every other data fetch (`fetchOverview`, `fetchTasks`, `fetchEscalations`, `fetchTriage`, `fetchReferrals`, `fetchWorkflowSessions`) follows a consistent, reasonable pattern: `Alert.alert` on initial-load failure, but deliberately silent on pull-to-refresh failure (to avoid spamming the user) — `RefreshControl` just stops spinning with no error toast. This is a common, defensible pattern, not flagged as a defect, though it means a refresh failure is indistinguishable from "nothing changed." (P3)
4. Workflow phase advancement (`handleAdvancePhase`, "Advance to \<Phase\>") is a clearly-labeled, non-destructive forward progression — correctly has no confirmation step, which is the right call.
5. Accept/Decline referral actions are properly wrapped in try/catch with `Alert.alert` on failure. "Decline" has no confirmation, but declining a referral is a standard, reversible-in-practice triage action, not flagged as a defect.
6. Task/escalation/triage/referral list-item `TouchableOpacity`s have no `accessibilityRole`/`accessibilityLabel` of their own (relying on nested `Text` being read by default) — minor gap, not fixed in this pass (the modal they open was fixed via the shared `HealthActionModal` component instead, which is the higher-leverage target).

### Fixes implemented
- "Update triage level": each of the three level options (Routine/Elevated/Urgent) now checks `res?.success`, only applies the optimistic update and closes the modal on success, and shows an `Alert.alert` with the server's error message on failure (modal stays open).
- "Reassign clinician": same fix — checks `res?.success` before applying the optimistic update, shows an error alert on failure instead of silently closing.
- Added a code comment documenting the `Alert.prompt` iOS-only limitation and that it's an existing app-wide pattern, not newly introduced.
- (Indirectly fixed) the shared `HealthActionModal`'s close button now has an `accessibilityLabel`, which benefits all 4 modals in this screen (Task/Escalation/Triage/Referral detail).

### Verification
`npm run typecheck` clean. `npx eslint`: 3 pre-existing errors (`useRef` unused, `institutionId` unused, `borders` unused — all at the top of the file, lines 1/123/126) confirmed unrelated to the edits made in this pass, which were confined to the Triage modal's footer deep in the render function.

**Status:** AUDITED-FIXED

---

## HealthInstitutionCardsScreen (`src/screens/health/HealthInstitutionCardsScreen.tsx`)
**Entry point:** `HealthInstitutionCards` route in `App.tsx`. The patient-facing booking-card browser (today/upcoming/past availability cards, membership join, service ratings).
**Criteria evaluated:** forms/confirmations, loading/error states, touch targets, accessibility, trust/privacy (membership)
**Not applicable:** none

### Findings
1. **Star-rating control used 28×28px icon-only touchables with no accessible name at all** — a screen reader user had no way to know a rating existed, what star they were on, or what tapping would do. `hitSlop` already compensated for the small visual size (effective hit area meets 44pt), so this was purely an accessibility gap, not a touch-target one.
2. Every mutation handler sampled (`saveMembershipSettings`, `handleJoinInstitution`, `submitServiceRating`, `startBookingForCard`/`handleBookNow`) correctly checks `response?.success`, throws with the server's message on failure, and shows `Alert.alert` — no silent swallows found in the sampled sections.
3. There is a "Join" membership action but no corresponding "Leave" action anywhere in this screen — once joined, a member has no visible way to leave from here. Minor completeness gap; not fixed (unclear whether a leave endpoint exists, and adding one without backend confirmation risks touching an API contract, which is out of scope).
4. Empty-state CTAs (e.g., "No \<filter\> health cards" → "Go to Schedule Management") are well-reasoned and correctly route to `AvailabilityManagement` or back, depending on whether an institution type is resolved.
5. Close button and the "Open institution landing page" action both have correct `accessibilityLabel`s already.

### Fixes implemented
- Added `accessibilityRole="button"`, a descriptive `accessibilityLabel` ("Rate N stars"), and `accessibilityState={{selected}}` to each of the 5 star-rating touchables.

### Verification
`npm run typecheck` clean. `npx eslint`: 2 pre-existing errors (`react-hooks/exhaustive-deps` at lines 1184 and 1375) confirmed unrelated — both predate this pass and are far from the edited star-rating block (~line 2511).

**Status:** AUDITED-FIXED

---

## InstitutionLandingPreviewScreen (`src/screens/health/InstitutionLandingPreviewScreen.tsx`)
**Entry point:** `InstitutionLandingPreview` route in `App.tsx`. A read-only preview of an institution's public landing page draft, reached from the website builder flow.
**Criteria evaluated:** visual hierarchy, long/missing content handling, navigation, accessibility
**Not applicable:** forms/validation (no form — this is a pure preview/renderer), loading/error states (synchronous render from `route.params`, no network call), offline/permission states (not applicable to a local-draft preview)

### Findings
1. No defects found. The screen handles unusual input gracefully: unknown section types render a clear "Section '\<type\>' is not yet supported in preview" placeholder instead of crashing or rendering blank; a legacy (pre-section-builder) draft shape is explicitly converted via `fromLegacy()`; missing institution name/logo fall back to initials and a generic label.
2. The sticky section-tab bar correctly tracks scroll position and highlights the active group; tab chips meet the 44pt minimum height (`minHeight: 44` is explicit).
3. Close button has a correct `accessibilityLabel="Close preview"`. The section-tab chips themselves have no `accessibilityRole="tab"`/`accessibilityState` — minor, since they're short-lived preview-only navigation aids, not primary actions.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not modified; no re-run needed.

**Status:** AUDITED-NO-ISSUES

---

## InstitutionOnboardingScreen (`src/screens/health/InstitutionOnboardingScreen.tsx`)
**Entry point:** Not found registered as a direct route in `App.tsx` under its own name — reached, if at all, via a path outside this batch's direct route list. **[Carried forward]** Already flagged earlier this session as a genuinely ambiguous case: richer than the live onboarding flow, unclear whether it's superseded or more-complete. Not re-investigated; audited fresh on everything else.
**Criteria evaluated:** forms/validation (primary focus — this is the richest form in the batch), accessibility, error recovery
**Not applicable:** none

### Findings
1. **No required-field validation before "Next" or "Submit."** The schema (`institutionSchemaMap`) defines `field.required` (surfaced visually only for the `file` field type as a "Required"/"Optional" badge), but `handleNext` advances steps unconditionally, and `handleSubmit` posts the full `formState` to the backend as-is even if required fields are empty — validation is effectively deferred entirely to the server's response message. (P2)
2. Dynamic field renderer (`renderField`) covers text/textarea/number/email/phone/url/select/radio/file/map types, but only the type-chip selector (top of screen) and the `file` upload touchable have `accessibilityLabel`s — `select`/`radio` option touchables and the `map` "tap to use current location" touchable have none. (P2)
3. The `map` field type's geolocation fallback is well-handled: a permission/location failure falls through to an `Alert.prompt` for manual lat/lng entry (same iOS-only `Alert.prompt` limitation noted in the Clinical Command Center finding — documented there, not re-flagged as a separate fix here) rather than failing silently.
4. No `KeyboardAvoidingView` wraps the form — on a long multi-field step, the keyboard can obscure the active input on smaller devices. (P3)
5. Submit success flow is good: offers "Add Another" (resets to step 0 with a fresh draft) or "Done," rather than just dismissing.

### Fixes implemented
None this pass — the required-field validation gap is real but touches form-submission semantics for a screen whose own place in the product (carried-forward ambiguous/superseded status) is still unresolved; fixing validation on a screen that may not be the live onboarding path risks wasted or conflicting effort. Documented for whoever resolves the superseded-or-not question first.

### Verification
Not modified; no re-run needed.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## HealthInstitutionManagementScreen (`src/screens/health/HealthInstitutionManagementScreen.tsx`)
**Entry point:** `HealthInstitutionManagement` route in `App.tsx`. The institution create/edit form and hub linking to Members, Service Catalog, Clinical Command Center, and the landing page.
**Criteria evaluated:** forms/validation, confirmations, access control, accessibility, navigation
**Not applicable:** none

### Findings
1. **[P0] Deleting an entire institution had no confirmation whatsoever.** `handleDelete` checked permission (`canDeleteInstitution`) and then immediately called `updateHealthInstitutions` with the institution filtered out — a single tap on "Delete" permanently removed the institution, its members, services, and schedules, with no "are you sure?" step and no undo. This is the single most severe finding in the batch (worse than the member/service-removal gaps, since it's the whole record, not one entity inside it).
2. "Type: \<type\>" is a tap-to-cycle control (repeatedly tapping cycles through all institution types) rather than a direct picker — same non-standard, low-discoverability interaction pattern flagged in the Members screen's "Quick cycle." For a field that changes which dashboard features apply, a direct selector (matching the type-chip row already used in `InstitutionOnboardingScreen`) would be clearer. (P2 — documented, not fixed; this is a UI pattern change beyond a single safe edit.)
3. Form validation is minimal but adequate for what's here: name is required before save; employee count falls back to a sane minimum via `parseCount`. No destructive consequence from a bad employee-count value.
4. Partner-organization connect/disconnect flows are well-handled: proper `res?.success` checks, `Alert.alert` on both outcomes, loading states on the buttons.
5. Close button and all primary actions correctly route through `KISButton`/explicit `accessibilityLabel`, giving good baseline accessibility.

### Fixes implemented
- Split `handleDelete` into a confirmation gate (`Alert.alert` naming the institution, warning that members/services/schedules go with it, Cancel/destructive-Delete) and a separate `performDelete` that does the actual mutation — only reachable after the user confirms.

### Verification
`npm run typecheck` clean. No new lint errors.

**Status:** AUDITED-FIXED

---

## SoloPractitionerDashboard (`src/screens/health/SoloPractitionerDashboard.tsx`)
**Entry point:** Not a direct `App.tsx` route — a component accepting an `onClose` prop, consumed elsewhere as a modal/panel (the independent-practitioner equivalent of the institution dashboard).
**Criteria evaluated:** loading/error states, forms (profile/service editor), confirmations, accessibility, emotional tone/trust
**Not applicable:** none

### Findings
1. **Silent-error-swallowing on dashboard refresh.** `loadDashboard` uses `Promise.allSettled` for the profile and appointments fetches; a `rejected` appointments fetch was previously indistinguishable from "no appointments" — the Queue tab just showed empty with zero indication the fetch had failed. (P2)
2. **No way to delete a service once added.** The service catalog editor supported "+ Add" and a pencil "Edit" affordance, but no delete — a mistakenly-added or discontinued service could never leave the catalog from this screen. (P2)
3. Commendable existing pattern: `startVideoSession`/`startChatSession` are explicitly short-circuited with a clear, honest `Alert` explaining they aren't wired up yet ("This is a known gap, not a temporary error") rather than attempting a network call that's documented to fail unconditionally (the appointment system here isn't linked to the workflow-session system `HealthServiceSessionScreen` uses). This is exactly the right way to handle a known architectural gap — flagged as a model example, not a defect.
4. `saveProfile`/`saveService` handle the "no backend profile id yet" case gracefully with an honest "saved on this device, will sync" message rather than failing silently.
5. Refresh and edit-service icon buttons had no `accessibilityLabel` (relying on an icon alone).

### Fixes implemented
- Added a `loadError` state set when the appointments fetch is rejected, surfaced as a tappable-to-retry banner below the header, visible across all tabs.
- Added a delete action (trash icon, with a confirmation `Alert.alert`) next to the existing pencil-edit icon in the service catalog list, wired through the same `patchRequest` path `saveService` already uses.
- Added `accessibilityLabel`s to the refresh button and both service-row icon actions (edit/delete).

### Verification
`npm run typecheck` clean. No new lint errors.

**Status:** AUDITED-FIXED

---

## HealthCard (`src/components/health/HealthCard.tsx`)
**Entry point:** Shared primitive — rounded card container consumed by `SoloPractitionerDashboard` and `ClinicalCommandCenterScreen`.
**Criteria evaluated:** visual consistency, color/contrast, platform-specific styling
**Not applicable:** forms, confirmations, loading/error states, accessibility, navigation — this is a pure styling wrapper with no interaction or state of its own.

### Findings
No issues. Clean, well-documented single-purpose component; correctly differentiates iOS/Android shadow rendering (`shadowOpacity` vs `elevation`).

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

## StatusPill (`src/components/health/StatusPill.tsx`)
**Entry point:** Shared primitive — status/priority/severity badge, consumed by `SoloPractitionerDashboard` and `ClinicalCommandCenterScreen`.
**Criteria evaluated:** visual consistency, readability, information density
**Not applicable:** forms, confirmations, loading/error states, accessibility (a decorative label paired with adjacent text elsewhere in its callers — not an interactive element), navigation

### Findings
No issues. Deliberately keeps the color→meaning mapping in the caller (correctly noted in its own doc comment — "urgent" means different things in different contexts) while unifying rendering.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

## StatTile (`src/components/health/StatTile.tsx`)
**Entry point:** Shared primitive — icon/label/value stat tile, consumed by `SoloPractitionerDashboard` and `ClinicalCommandCenterScreen`.
**Criteria evaluated:** visual consistency, readability, long-content handling
**Not applicable:** forms, confirmations, loading/error states, accessibility (non-interactive display element), navigation

### Findings
No issues. `numberOfLines={2}` on the label correctly guards against long stat names overflowing the fixed-width tile.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

## SectionHeader (`src/components/health/SectionHeader.tsx`)
**Entry point:** Shared primitive — section title + optional trailing action, consumed across most screens in this batch.
**Criteria evaluated:** visual hierarchy, typography
**Not applicable:** forms, confirmations, loading/error states, accessibility (a plain label; any interactive `trailing` content's accessibility is the caller's responsibility), navigation

### Findings
No issues.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

## HealthTabBar (`src/components/health/HealthTabBar.tsx`)
**Entry point:** Shared primitive — horizontal tab bar, consumed by `SoloPractitionerDashboard` and `ClinicalCommandCenterScreen`.
**Criteria evaluated:** touch targets, accessibility, visual consistency, color/contrast
**Not applicable:** forms, loading/error states, navigation (tab switching is purely local state)

### Findings
No issues. Deliberately built on the app's one standard `KISButton` component (per its own doc comment, an app-wide button-consistency pass) rather than a bespoke pill — `KISButton` auto-derives `accessibilityLabel`/`accessibilityRole="button"` from its `title`, so every tab is already properly labeled. The badge-count dot correctly uses an explicit white icon color on the active/gold-filled state rather than leaving it to a default that might not read against gold.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

## EmptyState (`src/components/health/EmptyState.tsx`)
**Entry point:** Shared primitive — icon + message + optional CTA empty state, consumed across most screens in this batch (consultation queues, analytics, compliance, etc.).
**Criteria evaluated:** visual consistency, readability, cognitive load, touch targets
**Not applicable:** forms, loading/error states, accessibility beyond the CTA (the CTA itself is a plain `Pressable` — see finding), navigation

### Findings
1. The optional CTA `Pressable` has no `accessibilityLabel`/`accessibilityRole` — relies on its nested `Text` (`ctaLabel`) being read, which generally works in React Native but isn't an explicit guarantee. Low severity given every current caller supplies clear CTA text ("Go Online," etc.).

### Fixes implemented
None — low-severity, no caller currently exercises a case where this would mislead a screen-reader user; documented rather than changed to avoid touching a component used in ~8 places during an already-large pass.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## HealthActionModal (`src/components/health/HealthActionModal.tsx`)
**Entry point:** Shared primitive — full-screen action-modal shell, consumed by all 4 detail modals (Task/Escalation/Triage/Referral) in `ClinicalCommandCenterScreen.tsx`.
**Criteria evaluated:** accessibility, navigation/back behavior, visual consistency
**Not applicable:** forms (body content is fully caller-supplied), loading/error states (caller's responsibility)

### Findings
1. The close `TouchableOpacity` had no `accessibilityLabel`/`accessibilityRole` — every modal built on this shared shell inherited the gap. Given this component is explicitly a de-duplication of 4 previously-separate near-identical modal shells (per its own doc comment), fixing it here is the single highest-leverage accessibility fix available in the whole batch.

### Fixes implemented
- Added `accessibilityRole="button"` and `accessibilityLabel={`Close ${title}`}` to the close button — automatically benefits all 4 consuming modals ("Close Task detail," "Close Escalation detail," etc.).

### Verification
`npm run typecheck` clean. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

## index (`src/components/health/index.ts`)
**Entry point:** Barrel re-export file — not a screen or component itself, just `export { default as X } from './X'` for the other 7 files in this directory plus the `HealthTab` type.
**Criteria evaluated:** none of the UX/UI criteria apply — this file renders nothing and holds no logic.
**Not applicable:** all 13 listed criteria — it is a pure module re-export with zero UI, state, or behavior.

### Findings
None applicable. Confirmed it re-exports exactly the 7 sibling components already audited individually above, with no additional logic, default values, or wrapping behavior to review.

### Fixes implemented
None — not applicable to this file.

**Status:** AUDITED-NO-ISSUES

---

## GlobalShell (`src/components/healthcare/GlobalShell.tsx`)
**Entry point:** **Not consumed by any of the 13 audited screens.** Confirmed via search — its only consumer is `src/screens/tabs/HealthcareScreen.tsx`, a different screen entirely, outside this batch. Audited as assigned regardless.
**Criteria evaluated:** forms (search input), touch targets, accessibility, color/contrast, information density
**Not applicable:** none

### Findings
1. The profile-picker dropdown toggle, emergency on/off toggle, and the horizontal location-card scroller all use plain `Pressable`/`View` with no `accessibilityLabel`/`accessibilityRole` — the emergency toggle in particular changes meaning (ON vs OFF) purely through text color, with no `accessibilityState={{selected}}` to convey that to assistive tech. (P2)
2. Heavy use of `borderWidth: 2` throughout (profile picker, emergency toggle, search row, location cards) is visually dense/heavy compared to the `borderWidth: 1` convention used in the rest of this batch's screens — not wrong, just inconsistent with the sibling screens' lighter border weight.
3. Search input has no visible "search" submit button beyond the keyboard's own submit — acceptable for a simple filter field.
4. Reasonable empty states: "No profiles yet," "Add locations to appear here."

### Fixes implemented
None — this component is not reachable from any of the 13 screens assigned to this audit batch; fixing it belongs with whichever audit pass covers `HealthcareScreen.tsx` and its actual consumers, to keep ownership of the fix with the right context.

### Verification
Not modified; no re-run needed.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## StaffConsole (`src/components/healthcare/StaffConsole.tsx`)
**Entry point:** **Not consumed by any of the 13 audited screens.** Confirmed via search — its only consumer is `src/screens/tabs/HealthcareScreen.tsx`, outside this batch. Audited as assigned regardless.
**Criteria evaluated:** forms (role/scope/shift-note inputs), touch targets, accessibility, long-content handling
**Not applicable:** confirmations (role/shift updates here are reversible, low-stakes edits to a staff record, not destructive)

### Findings
1. `formState` resets entirely from the `staff` prop on every change (`useEffect` keyed on `staff`) — if the parent re-fetches/re-renders `staff` while a user has partially typed a new role/scope/shift-note, their in-progress edit is silently wiped. This is a real but narrow race; it would only bite if the parent refreshes `staff` mid-edit. (P3)
2. `TextInput`s have no `accessibilityLabel` (relying on `placeholder` text alone, which most screen readers do announce, but it's not a guaranteed accessible name). `KISButton` actions ("Save role," "Assign shift") are correctly auto-labeled.
3. Permission tags correctly truncate with a "+N more" overflow treatment rather than wrapping unboundedly.
4. No destructive actions in this component — nothing to confirm.

### Fixes implemented
None — this component is not reachable from any of the 13 screens assigned to this audit batch; the formState-reset race (#1) touches data-flow between this component and its actual parent (`HealthcareScreen.tsx`, outside this batch), which is better fixed with full context on that screen.

### Verification
Not modified; no re-run needed.

**Status:** AUDITED-FINDINGS-DOCUMENTED
