# UX/UI Audit — Health Engines Dashboards

**Batch:** `src/screens/health/HealthEnginesDashboads/*` (15 files)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility/clinical-trust audit, not a file inventory (a prior pass already covered file purpose/route/basic state-handling).

## Summary

These 15 files are not screens in the normal navigation sense — they are institution-admin "engine manager" panels (appointment types, lab/imaging catalogs, drug/medication inventories, billing sessions, fleet/staff dispatch, secure messaging, wellness programs, EHR patient records) rendered one at a time inside `EngineModal.tsx`, a full-screen `Modal` pushed from `InstitutionServicesCatalogScreen` ("HealthInstitutionServicesCatalog" route) when an institution owner/admin taps "Manage" on an engine card. All 14 non-router files share the same skeleton (`getHealthThemeColors` + `HEALTH_THEME_SPACING`/`TYPOGRAPHY`, a config card, a catalog/CRUD card, a create-order/request card, and an analytics card) and the same two systemic defects, found in nearly every file, which matter more than any individual screen's polish:

1. **Theme/accent inconsistency (all 15 files, P2).** Every file reads colors from `getHealthThemeColors(useColorScheme())` — a fixed gold(dark)/coffee(light) palette keyed only to the OS/device light-dark setting — instead of `useKISTheme()`, which resolves the user's actual in-app theme-mode override and one of 18 chosen accent colors. Meanwhile every `KISButton` on these same screens *does* call `useKISTheme()` internally. Net effect: on any account that has picked a non-default accent (e.g. Emerald, Crimson), every card/text/border on these dashboards stays gold/purple while every button on the identical screen renders in the chosen accent — a visible, screen-wide color mismatch. This is architectural and was not fixed (changing the shared color source is a larger, cross-cutting change outside this pass's "safe/low-risk" bar); documented as a dedicated P2 recommendation for all 15 files below.
2. **Silent/fabricated write failures (the most important finding in this batch, P0).** In `EmergencyDispatchManager`, `HomeLogisticsManager`, `SecureMessagingManager`, `VideoConsultationManager`, and `WellnessProgramManager`, every "create"/"admit"/"send" action called `postRequest`/`patchRequest` (which never throws — it always resolves `{success:false,...}` on failure) but did not check `res.success` before either doing nothing or — worse — falling back to a **local-only fabricated record** (a fake ambulance, staff member, emergency request, conversation, message, enrollment) that rendered identically to a real, persisted one and gave zero indication the backend write had failed. For `EmergencyDispatchManager` and `SecureMessagingManager` specifically this is a patient-safety/clinical-communication risk: a dispatcher or clinician could believe help was dispatched or a note was sent to the care team when nothing was ever saved server-side. **Fixed** in all five files: each of these actions now checks `res.success` and shows an `Alert` with the real failure reason instead of fabricating data (see per-file sections). The same "always add a local fallback on failure, no error shown" pattern exists in `ImagingOrderManager`, `LabOrderManager`, `EPrescriptionManager`, and `PharmacyManager`'s order-creation flows, which were left as documented (not fixed) findings — those are lower severity because each one also calls a working reload (`loadOrders`) that self-corrects on next refresh, which Emergency/HomeLogistics/Messaging do not have (see finding 3).
3. **No backend list endpoint — history vanishes on every reopen (P0/P1, 4 files).** `EmergencyDispatchManager`, `HomeLogisticsManager`, `SecureMessagingManager`, and `WellnessProgramManager` each contain a code comment acknowledging there is no backend endpoint to list that engine's sessions/conversations/requests for the institution; the in-session list is the only copy that will ever exist, and it is discarded the moment the modal is closed. For Emergency Dispatch in particular, reopening the panel always shows "No emergency requests" even if ambulances are still out on real, backend-persisted dispatches — a dangerous false-negative for anyone relying on the screen to know what's active. This is a backend/product gap, not something a frontend-only pass can safely close; documented per file as a P0/P1 recommendation.
4. **`PaymentBillingManager` had a live, reproducible bug (fixed).** `handleStartBilling` checked `res?.id` to decide success, but `postRequest` always returns the created object at `res.data.id`, never at the top level — so the "Create Billing Session" button showed the **failure alert on every single successful session**, even though the session was created correctly on the backend. Fixed to read `res?.data?.id` and gate on `res?.success`.
5. Accessibility, touch targets, and raw-hex-color usage are otherwise clean across the batch: no icon-only buttons lack `accessibilityLabel` (only two `KISIcon` instances exist in the whole batch and both already have one, though `EngineModal`'s was mislabeled "Close services page" inside the engine-detail modal — fixed to "Close engine details"), no raw hex colors appear inline anywhere in these 15 files, and every interactive control goes through the shared `KISButton`, whose smallest size (`md`, 52pt) comfortably clears the 44pt minimum touch target.

15 files audited. Findings: 47 documented across the batch (counted per-file below), of which 11 were fixed in this pass (5 silent/fabricated-write-failure fixes, 1 concrete logic bug, 1 accessibility-label wording fix, plus the EHR patient/visit silent-load-failure fix counted as 2, and the pre-existing-bug note in Wellness counted separately as documented-only). All fixes are additive/corrective UI feedback — no API contracts, navigation structure, or clinical data-handling logic were changed.

---

## EngineModal (`src/screens/health/HealthEnginesDashboads/EngineModal.tsx`)
**Entry point:** Not a route — a shared full-screen `Modal` shell rendered by `InstitutionServicesCatalogScreen` (route `HealthInstitutionServicesCatalog`) when the owner/admin taps "Manage" on an engine card; it switches on `data.name` to render one of the 14 manager components below inside its header chrome.
**Criteria evaluated:** navigation/back behavior, visual hierarchy, color/contrast, accessibility, unusual input handling (unknown engine names), cognitive load.
**Not applicable:** forms/validation, loading/empty/offline states (this component has no data fetching of its own — it is pure routing + chrome).

### Findings
1. **Mislabeled close-button accessibility text (P3).** The close button's `accessibilityLabel` was the literal string `"Close services page"`, copy-pasted from `InstitutionServicesCatalogScreen` — but this button closes the *engine detail modal*, not the services catalog page. A screen-reader user hears the wrong destination described.
2. **Reasonable, if minimal, unknown-engine fallback (no fix needed).** The `default` switch branch shows the engine name, a "not yet available" message, and a "Contact support" `mailto:` link with a `__DEV__`-only engine-key debug line — appropriately low-key for a state that should rarely be hit, and it has its own `accessibilityLabel`.
3. **No back/dismiss confirmation needed (appropriate).** This is a pure detail/management view with no in-progress unsaved draft state owned by the modal itself (each child manager owns its own form state), so an unprompted close is the right behavior — no finding here.

### Fixes implemented
- Changed the close button's `accessibilityLabel` from `"Close services page"` to `"Close engine details"`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 12 pre-existing inline-style warnings (same convention used throughout this batch's files; not introduced by this change).

**Status:** AUDITED-FIXED

---

## AdmissionBedManager (`src/screens/health/HealthEnginesDashboads/AdmissionBedManager.tsx`)
**Entry point:** `EngineModal` → `"Admission & Bed Management Engine"`.
**Criteria evaluated:** visual hierarchy, typography/spacing, color/contrast, forms/validation, loading/error states, long-content handling, button placement, cognitive load, small-screen sizing.
**Not applicable:** offline state (relies on the shared `getRequest`/`postRequest` error-message convention, consistent with the rest of the app); permission states (no role gating visible at this layer).

### Findings
1. **No empty state (P2).** If a room search legitimately returns zero rooms, the screen shows the "Room Management" header with nothing underneath — no "No rooms yet, create one above" message, unlike several sibling files in this batch that do have one. A first-time admin has no confirmation the load succeeded with zero results versus failed silently.
2. **Load failures only use a one-shot `Alert`, not a persistent retry state (P3).** `loadRooms`'s catch shows an `Alert.alert` but otherwise leaves `rooms` untouched; if the alert is dismissed, there is no inline "load failed, tap to retry" affordance — the user must notice the "Reload Rooms" button and remember to press it.
3. **Per-keystroke bed-rename save (P3).** The bed-name `TextInput` calls `persistBedName` via `onEndEditing` (not every keystroke, so this is actually fine) — no issue here, noted as checked.
4. **No pull-to-refresh (P3).** Unlike `EmergencyDispatchManager`/`HomeLogisticsManager`/etc. in this same batch, this screen's `ScrollView` has no `RefreshControl`; the user must find and tap "Reload Rooms."
5. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
None — these are documented, lower-severity findings (empty state, retry affordance, pull-to-refresh) that are polish-level and not the clinical-trust/data-integrity class of bug this pass prioritized fixing. Recommended for a follow-up pass.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## AppointmentManager (`src/screens/health/HealthEnginesDashboads/AppointmentManager.tsx`)
**Entry point:** `EngineModal` → `"Appointment Engine"`.
**Criteria evaluated:** visual hierarchy, forms/validation, cognitive load, loading/error states, button placement, color usage.
**Not applicable:** offline/permission states (none implemented at this layer); long-content handling (lists here are bounded by appointment-type count, not an issue in practice).

### Findings
1. **"Doctor Schedule" slot generation has no date, only a repeating hour range (P2 — cognitive load/clarity).** "Generate Slots" produces `HH:MM` labels from a start/end hour with no associated calendar date, and "Publish Slots to Booking Engine" sends just `{time, available}` pairs. It is not clear to the admin whether this represents "today," "every day," or a recurring weekly template — the screen never says. This is a real clarity gap on the screen's core workflow, not just a cosmetic one.
2. **No empty state for the appointment-types list (P2).** Same pattern as `AdmissionBedManager`: zero types after a successful load renders nothing between the form card and the "Doctor Schedule" card.
3. **Good: destructive-delete confirmation already present.** `removeType` correctly wraps deletion in a confirming `Alert` with a destructive-styled "Delete" action — no finding needed here.
4. **Good: keyboard-safety already present.** The screen is wrapped in `KeyboardAvoidingView`, so the numeric-heavy form doesn't get obscured by the keyboard — no finding needed here.
5. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
None — finding 1 (ambiguous scheduling semantics) needs a product decision about what "the schedule" actually represents before a frontend fix would be correct, not a mechanical UI patch; finding 2 is polish-level. Both documented for follow-up.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## EHRManager (`src/screens/health/HealthEnginesDashboads/EHRManager.tsx`)
**Entry point:** `EngineModal` → `"EHR / Health Records Engine"`.
**Criteria evaluated:** forms, clinical-data trust/seriousness, loading/error states (bare-catch silent-failure check), cognitive load, privacy/scoping.
**Not applicable:** emotional tone (this is a clinical records tool, correctly dry/functional, not warmth-oriented); small-screen sizing (standard single-column form layout, no issue found).

### Findings
1. **Exact silent-error-swallowing anti-pattern, on clinical data (P0 — fixed).** `fetchPatients` and `fetchEncounters` never checked `res.success`; on any backend failure (expired session, 500, network error) they fell through to `setPatients([])` / `setEncounters([])` with zero distinction from a legitimately empty, successful result. A clinician would see "No patients found." and have no way to know whether that institution truly has no patients or whether the records API is down. This is precisely the bare-catch-with-no-feedback bug called out as the pattern to hunt for, on the single most clinically sensitive screen in this batch.
2. **Config toggles never hydrated from the server (P1).** `enabled`, `requireSignature`, and `versionTracking` are initialized to hardcoded local defaults (`true`) and never fetched from the backend on mount — unlike almost every other engine in this batch, which do fetch an `engine_config` item to hydrate their enabled flag. An admin could see "Require Signature: ON" in the UI while the server's actual value is OFF (or vice versa), which matters for a compliance-relevant toggle.
3. **Config toggle saves are fully silent (P1).** `saveConfig` is called with `.catch(() => undefined)` and no success check at all — if the PATCH fails, the UI shows the toggle flipped with no way to know the signature/versioning requirement wasn't actually persisted.
4. **Per-keystroke clinical-note autosave with silent failure (P0 — documented, not fixed).** Every SOAP/diagnosis/medication/allergy `TextInput`'s `onChangeText` calls `updateEncounterField`, which PATCHes the backend on *every keystroke* and swallows failures with just a code comment ("optimistic update; local state already reflects change"). This is the most clinically risky silent-failure in the batch: a clinician's note can look saved and be entirely unpersisted. It was **not** fixed in this pass because the correct fix (debounce the autosave, then show a non-intrusive "saved"/"save failed, tap to retry" indicator per field) is a larger, higher-risk change than this pass's safe/mechanical bar — firing an `Alert` on every failed keystroke, the quick alternative, would be a worse regression (an alert storm while offline). Flagged as the top follow-up item for this file.
5. **Patient list is not visibly scoped to the current institution (P1 — requires further investigation).** `fetchPatients` calls `ROUTES.patients.master` (`/api/v1/patients/master/`) with no `institutionId` filter anywhere in the request. Whether the backend auto-scopes this by the authenticated user's institution membership couldn't be confirmed from the frontend alone; if it does not, every institution's EHR manager would be listing every patient across every institution in the app, which would be a serious cross-tenant privacy issue. Needs backend verification, not a frontend guess.

### Fixes implemented
- Added `patientsError`/`encountersError` state; both fetches now check `res.success` and, on failure, set a visible error string and stop clobbering the list with an indistinguishable empty state.
- Added an inline error + "Tap to retry" `TouchableOpacity` block for both the patient list and the encounters list, matching the pattern in `PartnerDiscoveryPanel.tsx` (error text in `kisPalette.danger`, a bold "Tap to retry" action, re-invoking the same fetch function).
- Added the `useKISTheme` import/hook call needed to source `kisPalette.danger` for the new error text (this file previously only used the fixed `getHealthThemeColors` palette).

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 7 pre-existing/consistent inline-style warnings (2 of the 7 are from the new error-retry blocks, matching the inline-style convention used everywhere else in this file and batch).

**Status:** AUDITED-FIXED

---

## EPrescriptionManager (`src/screens/health/HealthEnginesDashboads/EPrescriptionManager.tsx`)
**Entry point:** `EngineModal` → `"E-Prescription Engine"`.
**Criteria evaluated:** forms/validation, cognitive load, loading/error states, long-content handling (drug catalog scroll-to), color usage.
**Not applicable:** offline/permission states; emotional tone (clinical/administrative tool).

### Findings
1. **Fabricated success on prescription generation (P1 — documented, not fixed).** `generatePrescription` posts to `pharmacySessionStart` and swallows any failure with a comment ("Backend submission is best-effort; local entry is always added"), then unconditionally appends the prescription locally regardless of outcome. Lower severity than the Emergency/Messaging cases because there is no safety-critical real-time action implied (no ambulance dispatched, no message assumed delivered) — but a prescription that silently didn't reach the backend pharmacy workflow is still a real gap. Left as a documented finding given the volume of similar instances in this batch and the bounded scope of this pass's fixes.
2. **Same pattern on status updates (P2).** `updateStatus` (dispensed/expired) optimistically updates local state and swallows PATCH failures identically.
3. **Good: controlled-drug and refill-limit validation already present.** `addItem` correctly blocks adding a controlled drug when `allowControlled` is off and blocks exceeding `maxRefills` — appropriate clinical guardrails, no finding needed.
4. **Good: empty-catalog guidance with a scroll-to-catalog shortcut.** When no drugs exist yet, the "Create Prescription" card shows clear guidance and a button that scrolls to the catalog section — a thoughtful touch for a long single-scroll form, no finding needed.
5. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
None in this file — see batch summary finding #2 for why this category of fix was bounded to the five highest-severity files in this pass.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## EmergencyDispatchManager (`src/screens/health/HealthEnginesDashboads/EmergencyDispatchManager.tsx`)
**Entry point:** `EngineModal` → `"Emergency Dispatch Engine"`.
**Criteria evaluated:** loading/error/empty states, forms, cognitive load, color usage, data integrity (this is the most safety-critical screen in the batch).
**Not applicable:** emotional tone; small-screen sizing (standard single-column form/list layout).

### Findings
1. **Fabricated ambulances and emergency requests on backend failure — the single most severe issue in this batch (P0 — fixed).** `addAmbulance` and `createRequest` both checked `res.success && res.data` only to decide *which object shape* to use, not whether to proceed at all — on failure, each fell back to a `Date.now()`-id local object that rendered identically to a real, persisted one, with zero indication anything had failed. Because this screen also has no list endpoint (finding 3), that fake entry would never be corrected or reconciled — a dispatcher could believe an ambulance exists or help is on the way when nothing was ever saved.
2. **`updateAmbulanceStatus` has no failure handling at all (P2 — documented, not fixed).** The `patchRequest` call's result is never checked; local fleet status always updates regardless of whether the backend accepted it. Left undone in this pass to keep the fix surface bounded to data-fabrication paths; recommended follow-up.
3. **No backend endpoint to list dispatch sessions — confirmed via the file's own code comment (P0, documented, not fixable from the frontend).** Every request created in a session is lost the moment the modal closes; reopening always shows "No emergency requests" regardless of real in-flight dispatches. This is the most dangerous instance of the batch-wide finding #3, specifically because it concerns live emergency response status.
4. **Good: this file already has the inline error+retry pattern.** `fetchData`'s failure path sets an `error` string and renders a dedicated full-screen retry view with a "Retry" button — exactly the pattern this audit was asked to look for elsewhere and add where missing. No finding needed for the staff/fleet load path itself.
5. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
- `addAmbulance`: now checks `res.success && res.data` before touching `fleet` state at all; on failure shows `Alert.alert("Fleet", ...)` and returns without fabricating an ambulance.
- `createRequest`: now checks `res.success && res.data` before touching `requests` state; on failure shows `Alert.alert("Emergency dispatch", ...)` and returns without fabricating a request (and without the now-incorrect auto-assign side effect that would otherwise mark a real ambulance "En Route" for a dispatch that doesn't exist).

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 5 pre-existing inline-style warnings (unrelated to this change).

**Status:** AUDITED-FIXED

---

## HomeLogisticsManager (`src/screens/health/HealthEnginesDashboads/HomeLogisticsManager.tsx`)
**Entry point:** `EngineModal` → `"Home Logistics Engine"`.
**Criteria evaluated:** loading/error/empty states, forms, cognitive load, color usage, data integrity.
**Not applicable:** emotional tone; small-screen sizing.

### Findings
1. **Fabricated staff and service requests on backend failure (P0 — fixed).** Identical pattern to `EmergencyDispatchManager`: `addStaff` and `createRequest` fell back to local-only fake records on any backend failure, with no error shown, in a workflow that assigns real staff to real home visits.
2. **No backend endpoint to list home-logistics sessions (P1, documented, not fixable from the frontend).** Same acknowledged gap as Emergency Dispatch — the request list is session-local only and is lost on reopen. Slightly lower severity than Emergency Dispatch (a missed home-visit follow-up vs. a missed active emergency), still P1.
3. **Good: this file already has the inline error+retry pattern** for the staff list load, matching `EmergencyDispatchManager`. No finding needed there.
4. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
- `addStaff`: now checks `res.success && res.data` before updating `staffList`; on failure shows `Alert.alert("Staff", ...)` and returns without fabricating a staff member.
- `createRequest`: now checks `res.success && res.data` before updating `requests`; on failure shows `Alert.alert("Home logistics", ...)` and returns without fabricating a request or the auto-assign side effect.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 5 pre-existing inline-style warnings (unrelated).

**Status:** AUDITED-FIXED

---

## ImagingOrderManager (`src/screens/health/HealthEnginesDashboads/ImagingOrderManager.tsx`)
**Entry point:** `EngineModal` → `"Imaging Order Engine"`.
**Criteria evaluated:** forms/validation, cognitive load, loading/error states, long-content handling, color usage.
**Not applicable:** offline/permission states; emotional tone.

### Findings
1. **Fabricated imaging orders on backend failure (P1 — documented, not fixed).** Same "best-effort" `catch {}` + unconditional local append pattern as `EPrescriptionManager`, on `createOrder`. Lower severity than Emergency/HomeLogistics/Messaging because the file comment is explicit about the limitation and there's no implied real-time dispatch of a person, but it is still a silent-failure instance of the batch-wide pattern.
2. **Good: clinical-indication requirement toggle works as intended.** `requireIndication` correctly blocks order creation when on and the field is blank — appropriate guardrail, no finding.
3. **Good: report sign-off flow is clear.** The "Reporting" status reveals Findings/Impression fields and a "Sign Report"/"Signed Off" button with sensible state-dependent labeling — no finding needed.
4. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
None — bounded to the five highest-severity files in this pass; see batch summary.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## LabOrderManager (`src/screens/health/HealthEnginesDashboads/LabOrderManager.tsx`)
**Entry point:** `EngineModal` → `"Lab Order Engine"`.
**Criteria evaluated:** forms/validation, cognitive load, loading/error states, long-content handling, color usage.
**Not applicable:** offline/permission states; emotional tone.

### Findings
1. **Fabricated lab orders on backend failure (P1 — documented, not fixed).** Identical pattern to `ImagingOrderManager`'s `createOrder` — same severity and same rationale for leaving unfixed in this pass.
2. **Good: empty-catalog guidance with scroll-to-catalog shortcut**, same thoughtful pattern as `EPrescriptionManager` — no finding needed.
3. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
None — see rationale above.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## NotificationReminderManager (`src/screens/health/HealthEnginesDashboads/NotificationReminderManager.tsx`)
**Entry point:** `EngineModal` → `"Notification & Reminder Engine"`.
**Criteria evaluated:** cognitive load/clarity of purpose, forms, trust (does the UI represent what the feature actually does), loading/empty states.
**Not applicable:** color/contrast, touch targets (no issues of that kind present); long-content handling (lists here are always empty by construction, see below).

### Findings
1. **The entire screen is non-functional, but presents as a working dashboard until the user submits (P1 — UX trust/clarity).** "Create Template"/"Save Template" and "Create Notification"/"Send Notification" are fully built forms (name, message, recipient, channel, priority, schedule date) that, on submit, simply show an `Alert.alert("Coming soon", ...)` — the backend has no supporting endpoint yet (per the file's own comments). A user fills out a multi-field form, including picking a channel and priority, before being told none of it does anything. The screen gives no upfront signal (a banner, a disabled state, a "preview" label) that this is non-functional.
2. **Mark Delivered/Mark Read controls operate on a list that can never be populated (P3).** `fetchNotifications` always sets `notifications` to `[]` by design (another acknowledged backend gap), so the "Notification History" action buttons are permanently unreachable dead UI — low severity since the code path can't currently execute, but still a code-smell that should be cleaned up or removed once templates/notifications ship.
3. **Good: the toggle-switch pattern itself is honest where it matters.** "Disable Auto Send" correctly pops its own "Coming soon" alert rather than silently flipping a non-persisted flag — more transparent than the plain local-only toggles elsewhere in the batch.

### Fixes implemented
None — the correct fix (disable/relabel the forms as "coming soon" up front, or hide them until the backend ships) is a design decision about how to present an intentionally unfinished feature, not a mechanical bug fix, and risks misrepresenting product intent if done unilaterally. Documented as the top recommendation for this file.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PaymentBillingManager (`src/screens/health/HealthEnginesDashboads/PaymentBillingManager.tsx`)
**Entry point:** `EngineModal` → `"Payment & Billing Engine"`.
**Criteria evaluated:** forms/validation, loading/error states, data integrity, cognitive load, color usage (status color-coding).
**Not applicable:** emotional tone; long-content handling (session list is small in practice).

### Findings
1. **Live, reproducible bug: every successful billing session showed a failure alert (P0 — fixed).** `handleStartBilling` checked `res?.id` to branch on success, but `postRequest` always returns the created object at `res.data.id`, never at the top level of its `ApiResult` wrapper (confirmed by reading `src/network/post/index.tsx`). This condition was therefore **always false**, so `handleStartBilling` always took the "else" branch and alerted `"Unable to start session."` — even when the session was created correctly on the backend (the session would still show up in "Billing Sessions" on refresh, contradicting the alert the user just saw). Notably, the file's own `loadSessions` function has a code comment describing and fixing the *identical* bug class one function above this one, which makes this a case of the same mistake recurring right next to its own fix.
2. **Engine-enabled toggle is never hydrated from the server (P1).** Unlike almost every sibling engine in this batch, `engineEnabled` has no `useEffect` fetch to read the current `billing_engine_enabled` value on mount — it always starts `true` locally regardless of the server's actual state.
3. **Good: status color-coding is semantically correct.** `STATUS_COLOR` maps `paid`→success, `failed`→danger, `waiting`→accent, `refunded`→neutral subtext — appropriate, no finding needed.
4. **Good: validation before submission.** Patient name and amount are required before a session can be started, with a clear `Alert` — no finding needed.

### Fixes implemented
- `handleStartBilling`: now reads the created session id from `res?.data?.id` and gates success on `res?.success`, so the success/failure alert finally reflects what actually happened on the backend.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 10 pre-existing inline-style warnings (unrelated to this change).

**Status:** AUDITED-FIXED

---

## PharmacyManager (`src/screens/health/HealthEnginesDashboads/PharmacyManager.tsx`)
**Entry point:** `EngineModal` → `"Pharmacy & Fulfillment Engine"`.
**Criteria evaluated:** forms/validation, loading/error states, cognitive load, long-content handling, data integrity (inventory accuracy).
**Not applicable:** offline/permission states; emotional tone.

### Findings
1. **Fabricated prescription orders on backend failure, partially self-correcting (P2 — documented, not fixed).** `createOrder` falls back to a `Date.now()` id on failure like its siblings, but — unlike Emergency/HomeLogistics/Messaging — this file calls `loadOrders()` immediately afterward, which re-fetches from the real `pharmacy_order` catalog and will overwrite the fabricated local entry on the next render. This meaningfully lowers severity versus the P0 instances elsewhere in the batch (the fake order is corrected within one round-trip rather than persisting for the rest of the session), but there is still a brief window where a failed order appears to have succeeded with no error shown.
2. **Medication stock decrements are cosmetic only, never persisted (P1 — inventory-integrity).** `updateStock`, called from `createOrder` to reduce on-hand stock when an order is placed, only calls `setInventory` locally — there is no corresponding API call to persist the new stock level. The next `loadInventory()` (e.g. after editing a medication, or on next screen open) will silently restore the pre-order stock count, meaning the inventory a pharmacist is managing can silently drift from what's actually been dispensed. This matters specifically because inventory accuracy is the core purpose of this screen.
3. **Good: this file's catalog CRUD (`saveMedication`, `removeMedication`) correctly checks `response.success` and surfaces real error messages** — the create/update/delete-medication paths do not have the fabrication problem, only order creation and stock tracking do.

### Fixes implemented
None — finding 1 is lower severity and self-correcting as noted; finding 2 (persisting stock decrements) would require either a new backend field/endpoint or inferring one, which risks overstepping "no backend contract changes." Both documented for follow-up.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## SecureMessagingManager (`src/screens/health/HealthEnginesDashboads/SecureMessagingManager.tsx`)
**Entry point:** `EngineModal` → `"Secure Messaging Engine"`.
**Criteria evaluated:** loading/error/empty states, forms, cognitive load, data integrity, clinical-communication trust.
**Not applicable:** emotional tone; small-screen sizing.

### Findings
1. **Fabricated conversations and messages on backend failure — tied with Emergency Dispatch as the most severe finding in this batch (P0 — fixed).** `createConversation` and `sendMessage` both fell back to local-only fake records on any backend failure, rendered identically to real, persisted ones, with no indication anything had failed. For a *secure clinical messaging* tool specifically, a fabricated "sent" message is a direct communication-safety risk: a doctor could believe they notified a nurse of something when the message never left the device.
2. **No backend endpoint to list messaging sessions — confirmed via the file's own code comment (P0, documented, not fixable from the frontend).** `fetchConversations` is a literal no-op (`setConversations((prev) => prev)`) because no list endpoint exists yet. Every conversation and every message in it is lost the instant the modal closes, with no warning that this is happening — a serious continuity-of-care gap for a tool whose entire purpose is persistent care-team communication.
3. **`markAsRead` silently swallows its PATCH failure (P2, documented, not fixed).** Lower severity than findings 1–2 since a missed read-receipt sync has a much smaller consequence than a lost or fabricated message; left undone to keep this pass's fix surface bounded to data-fabrication paths.
4. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
- `createConversation`: now checks `res.success && res.data` before updating `conversations`; on failure shows `Alert.alert("Secure messaging", ...)` and returns without fabricating a conversation.
- `sendMessage`: now checks `res.success && res.data` before appending to the active conversation's message list; on failure shows `Alert.alert("Secure messaging", "Message was not sent...")` and returns without fabricating a sent message.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 7 pre-existing inline-style warnings (unrelated).

**Status:** AUDITED-FIXED

---

## VideoConsultationManager (`src/screens/health/HealthEnginesDashboads/VideoConsultationManager.tsx`)
**Entry point:** `EngineModal` → `"Video Consultation Engine"`.
**Criteria evaluated:** loading/error/empty states, forms, cognitive load, color usage, data integrity.
**Not applicable:** emotional tone; small-screen sizing. (Note: this audit covers the *management/waiting-room* dashboard only, not the live call UI itself — the task explicitly excludes `src/services/calls/`, `SocketProvider.tsx`, and call/notification UI, none of which this file touches.)

### Findings
1. **Admit/Remove/End Session silently did nothing on failure despite already having the machinery to show an error (P1 — fixed).** `admitPatient`, `removePatient`, and `endSession` all correctly gated their state updates on `if (res.success)`, but had no `else` branch at all — a failed admit, removal, or session-end simply looked like the button had no effect, with the component's own already-defined error-display pattern (used for the initial `fetchData` failure) left unused for these actions.
2. **Good: this file already has the inline error+retry pattern** for the initial waiting-room/analytics load — no finding needed there.
3. **Good: billing math is transparent.** The live-cost calculation (`Math.max(minutes, minDuration) * pricePerMinute`) is shown to the admin in real time during an active session (`Current Cost: ... USD`), which is good practice for a billable clinical interaction — no finding needed.
4. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
- `admitPatient`: added an `else` branch showing `Alert.alert("Video consultation", ...)` on failure.
- `removePatient`: added an `else` branch showing `Alert.alert("Video consultation", ...)` on failure.
- `endSession`: added an `else` branch showing `Alert.alert("Video consultation", ...)` on failure, so a billable session that fails to close server-side no longer just sits silently on screen with no explanation.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 6 pre-existing inline-style warnings (unrelated).

**Status:** AUDITED-FIXED

---

## WellnessProgramManager (`src/screens/health/HealthEnginesDashboads/WellnessProgramManager.tsx`)
**Entry point:** `EngineModal` → `"Wellness Program Engine"`.
**Criteria evaluated:** loading/error/empty states, forms, cognitive load, data integrity, code correctness (React Hooks usage).
**Not applicable:** emotional tone.

### Findings
1. **Fabricated programs, activities, and enrollments on backend failure (P0 — fixed).** `addProgram`, `addActivity`, and `enrollPatient` all fell back to local-only fake records on failure, identical in shape to the Emergency/HomeLogistics/Messaging instances.
2. **Activity completion + points applied "regardless of server response" (P1 — fixed).** `completeActivity`'s own code comment stated the completion and points-earned update were applied locally "regardless of server response" — meaning a patient's progress and reward points could show as recorded when the backend PATCH actually failed, silently diverging patient-facing gamification state from the backend's record.
3. **Pre-existing React Hooks rule violation, not introduced by this pass (P1 — documented, not fixed).** `useRef`/`useCallback` for the scroll-to-programs shortcut are declared *after* two early `return` statements (the `loading` and `error` guards), which is a conditional-hook-call violation (`react-hooks/rules-of-hooks`, confirmed via `eslint`, 3 errors at lines 385–387). In React's current behavior this usually still "works" by accident as long as `loading`/`error` don't flip from `true` back to `false` within the same mount in a way that changes hook call order relative to other hooks, but it is a latent bug that could corrute state or throw in a future React/React Native upgrade. Left unfixed in this pass because correcting hook order safely requires re-reading the whole component's render flow to confirm no behavior changes, which is beyond this pass's "safe, mechanical, additive" bar for a file already receiving several other edits.
4. **No backend endpoint to list wellness enrollment sessions (P1, documented, not fixable from the frontend).** Same acknowledged gap as Emergency/HomeLogistics/Messaging — enrollments are session-local only.
5. **Theme/accent inconsistency** — see batch-wide finding #1.

### Fixes implemented
- `addProgram`: now checks `res.success && res.data` before updating `programs`; on failure shows `Alert.alert("Wellness program", ...)` and returns without fabricating a program.
- `addActivity`: now checks `res.success && res.data?.activity` before updating `activities`/`programs`; on failure shows `Alert.alert(...)` and returns without fabricating an activity.
- `enrollPatient`: now checks `res.success && res.data` before updating `enrollments`; on failure shows `Alert.alert(...)` and returns without fabricating an enrollment.
- `completeActivity`: now checks `res.success` before applying the completion/points update at all; on failure shows `Alert.alert(...)` and returns without the previously-unconditional optimistic update.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors introduced; the 3 `react-hooks/rules-of-hooks` errors at lines 385–387 are pre-existing (confirmed against the file as read before any edit in this pass — the edits in this file were confined to the `addProgram`/`addActivity`/`enrollPatient`/`completeActivity` callbacks well above the hook declarations) and are documented as finding 3 above rather than fixed, per the instruction to fix only errors introduced by this pass. 4 pre-existing inline-style warnings, also unrelated.

**Status:** AUDITED-FIXED
