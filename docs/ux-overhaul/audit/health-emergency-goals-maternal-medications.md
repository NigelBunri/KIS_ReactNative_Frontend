# UX/UI Audit — Emergency, Health Goals, Maternal, Medications

**Batch:** `src/screens/health/emergency/EmergencyScreen.tsx`, `src/screens/health/goals/HealthGoalsScreen.tsx`, `src/screens/health/maternal/BabyMilestonesScreen.tsx`, `src/screens/health/maternal/PregnancyTrackerScreen.tsx`, `src/screens/health/medications/MedicationsScreen.tsx` (5 screens)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility/emotional-tone audit, not a file inventory (a prior pass already covered file purpose/route/basic state-handling for every screen in the app).

## Summary

Five screens audited across four health-feature directories. All five are registered as routes in `App.tsx` (lines 2158–2162) but — per a comment already left in the codebase from an earlier session's fix — had **zero reachable entry point** anywhere in the app until that session added a "Quick Tools" grid to `BroadcastHealthcarePage` (Broadcast tab → Healthcare sub-tab); that grid is still the only way a user reaches any of these five screens today. 29 findings were documented across the batch; 20 were fixed directly in code (all additive/corrective — no API contracts, navigation structure, or backend-owned data changed). 3 findings are flagged as genuinely requiring further investigation because they depend on backend or product context this audit can't verify from the frontend alone.

**The single most important finding:** `EmergencyScreen`'s SOS alert tells the user *"This will also save an alert with your location to your account"* — but the frontend never requests location permission, never calls any geolocation API, and the POST body it actually sends is just `{ alert_type: 'sos' }` with no coordinates. Whether the backend substitutes a real (if imprecise) IP-based location, or whether this sentence is simply untrue, can't be confirmed from the client. This is a safety-relevant honesty question in a life-safety alert screen that was *already* revised once this session specifically to remove false reassurance — this is the same category of problem resurfacing. It needs a backend/product check before anyone relies on it, so it is documented rather than guessed at.

The second-highest-value fix: blood-type registration drove an `Alert.alert` with 9 buttons (8 blood types + Cancel). React Native's Android `Alert.alert` reliably renders only ~3 buttons — most Android users almost certainly could not select most blood types through that dialog. It's been replaced with an inline grid picker (the same pattern the screen already used for donor search) that behaves identically on both platforms.

Other recurring patterns fixed across the batch: every screen conflated a failed network fetch with a genuine "empty" state (all five now distinguish the two with a real error message and retry button, mirroring the pattern already established in `CrisisResourcesScreen`); icon-only buttons (back arrows, modal close buttons, FABs) with no `accessibilityLabel`; selection chips with no `accessibilityState`; and one semantically-wrong color token (`danger`/red applied to a routine "refill due in a week" reminder in `MedicationsScreen`, now split into `warning` for "due soon" and `danger` reserved for actually-overdue). `BabyMilestonesScreen` also had a real functional gap: the UI invites a parent to attach a photo URL to a milestone, but the timeline only ever rendered a generic placeholder icon — the photo was never actually displayed anywhere. That now renders as a real thumbnail.

---

## EmergencyScreen (`src/screens/health/emergency/EmergencyScreen.tsx`)
**Entry point:** `EmergencyHub` route (registered `App.tsx:2158`), reached via the "Quick Tools" grid in `BroadcastHealthcarePage` (Broadcast tab → Healthcare), labeled "Emergency SOS".
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, touch targets, forms/validation, loading/empty/error states, accessibility, emotional tone/trust/privacy, small-screen sizing, journey integration.
**Not applicable:** reduced-motion (no animation on this screen beyond the standard system `Modal`/gradient, neither of which is user-triggered motion); offline-state-specific UI (relies on the generic `getRequest` auto-cache fallback shared app-wide, consistent with the rest of the batch).

### Findings
1. **Android blood-type registration was effectively broken (P1).** `handleRegisterBlood` built a 9-button `Alert.alert` (8 blood types + Cancel). React Native's Android `Alert.alert` implementation reliably surfaces only ~3 buttons; the rest are dropped or unreachable. A real user on Android opening this dialog could very likely not select most blood types at all — on a feature whose entire purpose is accurate blood-type registration for emergencies, that's a significant functional failure, not a cosmetic one.
2. **Unverifiable honesty claim about location data (P1 — flagged for further investigation, not fixed).** The SOS confirmation copy states "This will also save an alert with your location to your account," but `handleSOS`'s `postRequest` body is only `{ alert_type: 'sos' }` — no `Geolocation` API is imported or called anywhere in this file, and no location permission is ever requested. This may be true if the backend derives location from IP (the file's own comment references `hospital_proximity.py` doing nearby-hospital lookups, which implies *some* server-side location signal exists), but that would be materially less precise than what "your location" implies, and isn't disclosed. This line was already rewritten once this session specifically to stop over-promising in this exact alert (removing "we'll alert your contacts"/"help is on the way"); this is the same failure mode resurfacing in a different sentence. Not fixed here because correcting it requires knowing what the backend actually does — removing "with your location" could be wrong if the backend does IP-geolocate, and adding real device geolocation would mean introducing a new permission flow and API payload field, which is exactly the kind of product decision this audit is scoped not to make unilaterally.
3. **Fetch error indistinguishable from "not registered" (P2 — fixed).** `fetchRegistry` only ever set `bloodRegistry` on success and otherwise did nothing; a network failure rendered an identical "Blood type not registered" card to a user who had, in fact, already registered. That's a bad failure mode specifically because it could prompt a confused duplicate-registration attempt.
4. **Donor contact info not actionable (P3 — documented, not fixed).** Search results render `d.contact` as plain, non-interactive text. The entire point of "Find Blood Donors" is to let someone reach a donor, but there's no tap-to-call/email affordance. Not fixed because the contact field's format (phone vs. email vs. something else) isn't guaranteed from the frontend type alone, and guessing wrong (e.g., wrapping a non-phone string in a `tel:` link) could silently fail — flagged as requiring product/backend confirmation of the field's format.
5. **No privacy disclosure at the point of donor opt-in (P3 — documented, not fixed).** Registering as a donor (`is_donor: true`) makes a user's name, country, and contact info visible to any other user who searches, with zero on-screen disclosure of that fact at the point of opt-in — the registration dialog just says "Select your blood type." This may be a deliberate, already-covered-elsewhere product/ToS decision; flagged rather than asserted as a bug.
6. **SOS button had no accessibility hint (P3 — fixed).** The icon+text "SOS" button was reasonably labeled for sighted users, but a screen-reader user got only the word "SOS" with no indication that this doesn't dial emergency services — an important distinction on a button this consequential.
7. **Fragile hex+alpha-suffix color pattern (P4 — documented, not fixed).** Styles like `palette.primary + '22'` and `palette.danger + '22'` assume the palette value is always a 6-digit hex string; it currently always is (confirmed against `src/theme/constants.ts`), so this isn't an active bug, but it's a latent fragility shared by many screens across the app, not something to patch in a single-screen audit.

### Fixes implemented
- Replaced the 9-button `Alert.alert` blood-type registration flow with an inline grid picker (same visual pattern as the existing donor-search picker), which works identically on iOS and Android. Extracted the registration POST into a reusable `registerBloodType(bt)` callback.
- Added a `registryError` state; `fetchRegistry` now distinguishes success / API failure / thrown error, and the "Blood Type Registry" card renders a dedicated error message + Retry button instead of silently falling through to the "not registered" empty state.
- Added `accessibilityRole="button"` / `accessibilityLabel` to the donor-search blood-type picker trigger and to every blood-type chip (both the search picker and the new registration grid), plus `accessibilityState={{ selected }}` on the search picker's chips.
- Added `accessibilityRole="button"`, `accessibilityLabel="Send SOS alert"`, and an `accessibilityHint` clarifying the SOS button saves an alert rather than dialing emergency services.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors; 1 pre-existing inline-style warning (`paddingBottom: 80`), unrelated to this change and consistent with the rest of the codebase.

**Status:** AUDITED-FIXED

---

## HealthGoalsScreen (`src/screens/health/goals/HealthGoalsScreen.tsx`)
**Entry point:** `HealthGoals` route (registered `App.tsx:2159`), reached via the "Quick Tools" grid in `BroadcastHealthcarePage`, labeled "Health Goals".
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, button placement/touch targets, forms/validation, loading/empty/error states, long-content handling, accessibility, small-screen sizing, journey integration.
**Not applicable:** emotional tone/trust/privacy (this screen tracks self-chosen wellness metrics like steps/water/sleep — not sensitive medical data in the way the other four screens in this batch are, so there's no alarming-copy or disclosure concern to evaluate); reduced motion (no custom animation).

### Findings
1. **Fetch error indistinguishable from "no goals" (P2 — fixed).** `fetchGoals` left `goals` as `[]` on any failure, rendering the identical "No goals set yet" empty state whether the user truly had none or the request simply failed — risking a user concluding they lost saved goals after a transient network blip.
2. **Goals could be created with a meaningless zero target (P2 — fixed).** `handleSubmitGoal` only validated the title; `target_value: parseFloat(formTarget) || 0` silently became `0` if the field was left blank. `progressPercent` explicitly guards `target_value > 0`, so such a goal would permanently show 0% progress with no way for the user to understand why — a goal-tracking feature that creates goals that can never show progress is a real trust problem, not a cosmetic one.
3. **FAB missing accessibility label (P3 — fixed).** `KISFab icon="add"` — the screen's primary create action — had no `accessibilityLabel`, so a screen-reader user got an unlabeled button.
4. **Modal close button missing accessibility label (P3 — fixed).** The icon-only "X" close button in the "New Health Goal" sheet had no `accessibilityRole`/`accessibilityLabel`.
5. **Selection chips communicated state by color only (P3 — fixed).** Both the category filter row and the in-form category picker indicated the active choice purely via background/border color, with no `accessibilityState` — a screen-reader user had no way to tell which category was currently selected.
6. **Unit field has no length guard (P4 — documented, not fixed).** The free-text "Unit" field (e.g. "ml", "steps") has no length limit; an unusually long value would wrap awkwardly in the `Update (${goal.unit})` placeholder and the progress label. Low-likelihood cosmetic edge case; not fixed because any generic truncation risks silently cutting off a legitimate short unit in a way that would feel more surprising than the rare long-input case it prevents.

### Fixes implemented
- Added a `fetchError` state; `fetchGoals` now distinguishes success / API failure / thrown error and the list's `ListEmptyComponent` renders a dedicated error message + Retry button instead of the generic "No goals set yet" copy when the fetch actually failed.
- Added a target-value validation check (`parseFloat(formTarget) > 0`) to `handleSubmitGoal`, with a clear "Target required" alert, before the zero-default path can be reached.
- Added `accessibilityLabel="Add health goal"` to the FAB.
- Added `accessibilityRole="button"` / `accessibilityLabel="Close"` to the modal close button.
- Added `accessibilityRole="button"` and `accessibilityState={{ selected }}` to the category-filter chips and the in-form category chips.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 new errors; 1 pre-existing unrelated error (`'navigation' is defined but never used` — present in the original file, on a line this audit did not touch) and 1 pre-existing inline-style warning, both unrelated to this change.

**Status:** AUDITED-FIXED

---

## BabyMilestonesScreen (`src/screens/health/maternal/BabyMilestonesScreen.tsx`)
**Entry point:** `BabyMilestones` route (registered `App.tsx:2161`), reached via the "Quick Tools" grid in `BroadcastHealthcarePage`, labeled "Baby Milestones".
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, button placement/touch targets, navigation/back behavior, forms/validation, loading/empty/error states, long-content/missing-data handling, accessibility, emotional tone, small-screen sizing, journey integration.
**Not applicable:** none of the listed criteria are genuinely inapplicable — this is a full CRUD-style timeline screen with a form, images, and navigation.

### Findings
1. **Photo feature was non-functional (P1 — fixed).** The "Add Milestone" form invites a parent to attach a "Photo URL," but the timeline's `renderItem` only ever rendered `<KISIcon name="image">` inside a generic gray placeholder when `item.photo_url` was truthy — the actual photo was never displayed anywhere in the app, regardless of what URL was saved. For a feature whose entire purpose is capturing a baby's first moments, silently never showing the photo a parent saved is the kind of broken promise that erodes trust fast.
2. **Fetch error indistinguishable from "no milestones" (P2 — fixed).** Same pattern as the other screens in this batch: `fetchMilestones` left the list empty on failure with no error signal, rendering identically to a genuinely empty timeline.
3. **Back button missing accessibility label (P3 — fixed).** The icon-only arrow-left back button had no `accessibilityRole`/`accessibilityLabel`.
4. **FAB missing accessibility label (P3 — fixed).** `KISFab icon="add"` had no `accessibilityLabel`.
5. **Modal close button missing accessibility label (P3 — fixed).** Same icon-only "X" pattern as `HealthGoalsScreen`'s modal.
6. **Milestone-type chips communicated selection by color only (P3 — fixed).** No `accessibilityState` on the type picker in the Add Milestone form.
7. **No bound on milestone date (P4 — documented, not fixed).** Nothing prevents entering a future-dated milestone (e.g., "First Step" dated next year). Not fixed because it's a genuine judgment call rather than an obvious bug — a "Birthday" milestone, for instance, might legitimately be logged in advance — flagged as requiring product input rather than assumed wrong.

### Fixes implemented
- Replaced the generic image-icon placeholder with a real `<Image source={{ uri: item.photo_url }} resizeMode="cover" accessibilityLabel={...} />` thumbnail when a milestone has a photo URL, reusing the existing `photoPlaceholder` style (border/background) as the visual frame.
- Added a `fetchError` state; `fetchMilestones` now distinguishes success / failure and the empty-state component renders a dedicated error message + Retry button instead of "No milestones yet." on genuine fetch failure.
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.
- Added `accessibilityLabel="Add milestone"` to the FAB.
- Added `accessibilityRole="button"` / `accessibilityLabel="Close"` to the modal close button.
- Added `accessibilityRole="button"` and `accessibilityState={{ selected }}` plus a readable `accessibilityLabel` to each milestone-type chip.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors; 1 pre-existing inline-style warning, unrelated to this change.

**Status:** AUDITED-FIXED

---

## PregnancyTrackerScreen (`src/screens/health/maternal/PregnancyTrackerScreen.tsx`)
**Entry point:** `PregnancyTrackerScreen` route (registered `App.tsx:2160`), reached via the "Quick Tools" grid in `BroadcastHealthcarePage`, labeled "Pregnancy Tracker".
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, button placement/touch targets, navigation/back behavior, loading/empty/error states, missing-data handling, accessibility, emotional tone/trust, small-screen sizing, journey integration.
**Not applicable:** forms/validation in the traditional sense (the only user input is toggling pre-set symptom chips — there's no free-text field or submission flow with invalid-input states to evaluate); reduced motion (no custom animation).

### Findings
1. **Fetch error indistinguishable from "no profile" (P2 — fixed).** This is the same conflated-error-and-empty pattern as the rest of the batch, but it's uniquely costly here: on a pregnancy tracker specifically, a user seeing "No pregnancy profile found" after what was actually just a dropped network request is a worse false signal than almost anywhere else in this batch — it reads as "your pregnancy data is gone," not "try again."
2. **Back button missing accessibility label (P3 — fixed).** Same icon-only arrow-left pattern as `BabyMilestonesScreen`.
3. **Symptom chips have no accessible "selected" state (P3 — documented, not fixed).** The symptom-logger buttons are plain `KISButton` instances whose selected/unselected state is conveyed only by switching `variant` between `'primary'` and `'outline'`. `KISButton` itself doesn't accept an `accessibilityState` prop, so even though the visual distinction is clear, a screen reader has no "selected" announcement. Not fixed in this pass because doing so properly means extending the shared `KISButton` component (used across the entire app, not just this batch) — out of this audit's scoped, single-screen-risk boundary. Documented as a cross-cutting recommendation for whoever owns that component.
4. **Week-progress marker slightly misaligned at week 0 (P4 — documented, not fixed).** The circular progress marker is positioned via `left: ${progress*100}%` with a fixed `marginLeft: -9`, which places it slightly outside the left edge of the track when `progress` is 0 (a brand-new pregnancy). Purely cosmetic, very low severity.

### Fixes implemented
- Added a `fetchError` state; `fetchPregnancy` now distinguishes success / API failure / thrown error. The screen now renders three distinct states instead of two: a dedicated error message + Retry button, "No pregnancy profile found." (genuine empty case), or the real tracker content — rather than collapsing the first two into one.
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 new errors; 2 pre-existing inline-style warnings on lines already using inline styles before this change, plus the new error-state block (which follows the same inline-style convention already used throughout this file and the rest of the batch) added 1 more inline-style warning — consistent with the existing codebase-wide pattern, not a new category of issue.

**Status:** AUDITED-FIXED

---

## MedicationsScreen (`src/screens/health/medications/MedicationsScreen.tsx`)
**Entry point:** `Medications` route (registered `App.tsx:2162`), reached via the "Quick Tools" grid in `BroadcastHealthcarePage`, labeled "Medications".
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, button placement/touch targets, forms/validation, loading/empty/error states, missing-data handling, accessibility, emotional tone/trust, small-screen sizing, journey integration.
**Not applicable:** reduced motion (no custom animation); navigation/back behavior beyond the standard stack (screen has no custom back button — relies on the default native-stack header, which is hidden via `headerShown: false` at the route level per `App.tsx`, consistent with the other screens in this batch that use a custom gradient header instead).

### Findings
1. **Semantically wrong color token for a routine reminder (P2 — fixed).** A medication refill due within 7 days was rendered entirely in `palette.danger` (red) — the exact same color used elsewhere in this batch for genuine network/API errors. A refill reminder is a routine administrative nudge, not an emergency; coloring it with the app's alarm color overstates urgency and risks alert fatigue on a feature meant to support calm, routine adherence.
2. **Fetch error indistinguishable from "no medications" (P2 — fixed).** Same conflated-error-and-empty pattern as the rest of the batch, arguably worse here: a user who concludes "I have no medications tracked" after a failed request (rather than "try again") could reasonably decide they don't need to log something they actually take.
3. **FAB missing accessibility label (P3 — fixed).** `KISFab icon="add"` had no `accessibilityLabel`.
4. **Modal close button missing accessibility label (P3 — fixed).** Same icon-only "X" pattern as the other two form modals in this batch.
5. **Reminders banner silently caps at 2 items (P4 — documented, not fixed).** `reminders.slice(0, 2)` shows only the first two medication reminders with no "view all" affordance if there are more. Minor information loss for a user with several near-term refills; not fixed because a proper fix (a dedicated reminders list/view) would mean adding new navigation surface area, which this audit is scoped not to introduce unilaterally.

### Fixes implemented
- Replaced the boolean `isRefillSoon()` with a 3-tier `getRefillUrgency()` (`'none' | 'soon' | 'overdue'`). "Due soon" (0–7 days out) now renders in `palette.warning` (amber); `palette.danger` (red) is reserved for a refill that's already overdue — the one case where the stronger color is actually warranted.
- Added a `fetchError` state; `fetchData` now distinguishes success / failure for the primary medications request (reminders failing is treated as secondary — the banner just stays hidden) and the empty-state component renders a dedicated error message + Retry button instead of "No medications tracked." on genuine fetch failure.
- Added `accessibilityLabel="Add medication"` to the FAB.
- Added `accessibilityRole="button"` / `accessibilityLabel="Close"` to the modal close button.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 new errors; 1 pre-existing unrelated error (`'navigation' is defined but never used` — present in the original file, on a line this audit did not touch) and 1 pre-existing inline-style warning, both unrelated to this change.

**Status:** AUDITED-FIXED
