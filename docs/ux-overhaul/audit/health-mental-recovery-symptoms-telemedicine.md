# UX/UI Audit — Mental Health, Recovery, Symptoms, Telemedicine

**Batch:** `src/screens/health/mental/*`, `src/screens/health/recovery/*`, `src/screens/health/symptoms/*`, `src/screens/health/telemedicine/*` (9 screens)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility/emotional-tone audit, not a file inventory (a prior pass already covered file purpose/route/basic state-handling).

## Summary

All nine screens are structurally sound — consistent use of theme palette tokens, sensible loading/empty/error states, 44pt back-button hit areas (via `hitSlop`), and genuinely good anonymity/privacy affordances in `AddictionRecoveryScreen` (anonymous group join toggle, no addiction type shown to other members by default). The single most important finding in this batch is in `SobrietyTrackerScreen`: **there is no in-app or backend path anywhere in the codebase for a user to log a slip/relapse or reset their sobriety streak.** The prior inventory pass noted the existing copy is non-shaming — that's true but beside the point, because the "slip/reset" path doesn't exist to frame one way or the other. A days-sober counter with milestones and no humane way to handle a setback is a known-harmful pattern in real recovery products: it either silently keeps counting through a relapse (false data, feels like lying) or traps the user behind a number they can't change without leaving the app, at exactly the moment they most need in-app support. This needs a product + backend + clinical-copy decision, not a unilateral frontend patch — documented below as a P0 finding, with a safe compensating control (an always-visible compassionate crisis-support link) added to the tracker in the meantime. Beyond that, the batch's other real issues were: a widespread accessibility gap (icon-only back buttons with no `accessibilityLabel`, fixed on all 5 affected screens), two semantically-wrong color-token uses (`danger`/red applied to ordinary low mood scores, and two different symptom-checker triage severities rendered in the identical color), a stale-`call_url` logic bug in `ConsultDetailScreen` that could offer a "Join Video Call" button on a cancelled/completed consult, a `mode` param (`instant`/`book`/`browse`) that `DoctorDirectoryScreen` silently ignores so all three "Telemedicine" quick actions behave identically, and no cross-link between the two recovery screens (now fixed). 9 screens audited, 19 findings documented, 17 fixed in code (fixes are additive/corrective only — no API contracts, navigation structure, or clinical/diagnostic copy changed).

---

## MentalHealthScreen (`src/screens/health/mental/MentalHealthScreen.tsx`)
**Entry point:** `MentalHealthHub` route (registered `App.tsx:2163`), reached from the Health Extended grid in `BroadcastHealthcarePage`.
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, touch targets, cognitive load, loading/empty states, accessibility, emotional tone, small-screen sizing, journey integration.
**Not applicable:** forms/validation (no text input on this screen), offline-specific handling (relies on generic `getRequest`/`postRequest` success flags, consistent with the rest of the app).

### Findings
1. **Semantically wrong color token (P2).** The 7-day mood chart colored any day scoring below 4 with `palette.danger` (red) — the same token used elsewhere in this exact batch for crisis/emergency framing (`CrisisResourcesScreen` header, symptom-checker "emergency" triage). Rendering an ordinary low-mood day in alarm-red risks making a bad day look like a crisis, which is the wrong emotional register for a mental-health check-in tool. Matters because color is read faster and more viscerally than text in these self-report tools.
2. **Touch targets below 44pt (P2).** The 1–10 mood-score row used `minHeight: 36` on 10 `flex:1` buttons — both dimensions land under the 44×44pt minimum (width is ~30px on a typical phone). A sub-44pt target on the screen's primary daily interaction increases mis-tap risk, which matters more for an age-inclusive app (per KIS's own age-mode system) and for anyone checking in while distressed.
3. **No accessibility state on selection controls (P3).** Mood-score buttons and emotion-tag chips had no `accessibilityRole`/`accessibilityLabel`/`accessibilityState`, so VoiceOver/TalkBack users got an unlabeled numeral or icon with no indication of which value was currently selected.

### Fixes implemented
- Changed the low-mood bar color from `palette.danger` to `palette.warning` (distinct existing token, amber not red) — same visual "lower tier" signal without borrowing the app's emergency color.
- Raised `scoreBtn.minHeight` from 36 to 44.
- Added `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{ selected }}` to the mood-score buttons and emotion tags.

### Verification
`npm run typecheck` — no errors in this file. `eslint` — 0 errors, 1 pre-existing inline-style warning (unrelated, matches codebase-wide pattern).

**Status:** AUDITED-FIXED

---

## MoodJournalScreen (`src/screens/health/mental/MoodJournalScreen.tsx`)
**Entry point:** Navigated from `MentalHealthHub`'s "My Journal" resource card (`navigation.navigate('MoodJournal')`); also a direct `MoodJournal` route (`App.tsx:2164`).
**Criteria evaluated:** visual hierarchy, typography/spacing, color/token usage, button placement/touch targets, forms/validation, loading/empty states, long-content handling, accessibility, emotional tone, small-screen sizing.
**Not applicable:** none of the listed criteria are inapplicable here — this is a full CRUD-style journal screen.

### Findings
1. **Semantically wrong color token (P2).** Same issue as MentalHealthScreen: `moodColor()` used `palette.danger` for entries scored below 4.
2. **Touch targets below 44pt (P2).** Identical 10-button mood-score row inside the "New Entry" modal, `minHeight: 36`.
3. **Unlabeled icon-only controls (P2).** The header back button, the modal's close (`×`) button, and the floating-action "add entry" button (`KISFab`) all lacked `accessibilityLabel`. `KISFab` already supports an `accessibilityLabel` prop (used correctly elsewhere in the codebase per its own source comments) but wasn't passed one here, so it rendered with no label at all for screen readers — a real gap on the screen's single primary action.
4. **Good:** empty state copy ("No journal entries yet. Tap the button below to start writing.") is warm and non-clinical; `FlatList` windowing props (`initialNumToRender`, `removeClippedSubviews`) are already in place for long entry lists; title-required validation gives a clear, non-blaming `Alert`.

### Fixes implemented
- `moodColor()`: low tier now `palette.warning` instead of `palette.danger`.
- `scoreBtn.minHeight`: 36 → 44 (both the hub and this screen's independent style objects).
- Added `accessibilityRole`/`accessibilityLabel` to the back button ("Go back"), the modal close button ("Close"), and `accessibilityLabel="Add journal entry"` on the `KISFab`.
- Added `accessibilityState={{ selected }}` + labels to the modal's mood-score buttons.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 1 pre-existing inline-style warning.

**Status:** AUDITED-FIXED

---

## CrisisResourcesScreen (`src/screens/health/mental/CrisisResourcesScreen.tsx`)
**Entry point:** Navigated from `MentalHealthHub`'s "Crisis Resources" card; also a direct `CrisisResources` route (`App.tsx:2165`); now also reachable from `SobrietyTrackerScreen`'s new support banner (see below).
**Criteria evaluated:** visual hierarchy, color/token usage, button placement, navigation, cognitive load, forms (country selector), loading/empty/error states, accessibility, emotional tone, small-screen sizing.
**Not applicable:** none.

### Findings
1. **Unlabeled icon-only back button (P2).**
2. **No accessibility semantics on the country picker or its dropdown (P2).** The picker toggle and the 9 country options were plain `TouchableOpacity`s with no `accessibilityRole`, no expanded/selected state — a screen-reader user would hear "US" and a chevron with no indication it opens a list, or which country is currently active.
3. **CBT accordion items have no expanded/collapsed accessibility state (P3).** Visually the chevron flips direction, but nothing communicates that to assistive tech.
4. **Emotional tone — good, no fix needed.** Header copy "You are not alone. Help is available." is warm and direct. The country-scoped hotline list with per-country loading/error/empty states (with a Retry button) is a genuinely solid pattern — this screen already does what the recovery tracker should have for its missing path.
5. **Minor design question, not fixed (P3 — flagged for design review, not a bug).** The "Call" button uses `variant="danger"` (red), the same token-semantic used for errors elsewhere. In a crisis-hotline context red plausibly reads as "urgent, call now," which may be intentional — but it's worth a design sign-off rather than assuming either reading, since the same token is used for distinctly negative/error states on the symptom checker and consult screens in this same batch.

### Fixes implemented
- Back button: added `accessibilityRole="button"` + `accessibilityLabel="Go back"`.
- Country picker toggle: added `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, and `accessibilityState={{ expanded }}`.
- Country dropdown items: added `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ selected }}`.
- CBT accordion items: added `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ expanded }}`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 2 pre-existing inline-style warnings (unrelated).

**Status:** AUDITED-FIXED

---

## AddictionRecoveryScreen (`src/screens/health/recovery/AddictionRecoveryScreen.tsx`)
**Entry point:** `AddictionRecovery` route (`App.tsx:2166`), reached from the Health Extended grid in `BroadcastHealthcarePage`.
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, navigation/discoverability, cognitive load, loading/empty states, accessibility, emotional tone/privacy (priority), small-screen sizing, journey integration.
**Not applicable:** forms/validation (no free-text input on this screen), offline-specific states (generic pattern, consistent with rest of app).

### Findings
1. **No cross-link to SobrietyTrackerScreen (P2 — now fixed).** These are the two halves of the same recovery journey (find a group vs. track your personal streak) but had zero navigation between them; a user in one had to back out to the health grid to find the other. This also meant the screen's `navigation` prop was entirely unused (a real, pre-existing `@typescript-eslint/no-unused-vars` **error**, not just a style nit — this file would already fail a strict lint gate).
2. **No back button on this hub screen (P3, not fixed — consistent, probably intentional pattern).** `MentalHealthHub` and `TelemedicineHub` share the same pattern (header has no back affordance, relies on OS swipe-back/hardware-back). iOS swipe-back remains enabled (no `gestureEnabled: false` found in `App.tsx`'s stack config), so this isn't a dead end, but it is a discoverability gap worth a product call given KIS's stated age-inclusive design goals — less tech-savvy users may not know the gesture exists.
3. **Anonymous-join `Switch` had no `accessibilityLabel` (P3).**
4. **Filter tabs had no selection/role semantics for screen readers (P3).**
5. **Genuinely good, no fix needed:** the "Join anonymously" toggle per-group (not a single global setting) is a strong, specific privacy affordance for an addiction-recovery feature — it lets someone join a gambling or substance-use group without broadcasting that fact to their own profile activity, which is exactly the kind of considered privacy design this category needs. Facilitator/schedule/member-count info is presented plainly and respectfully, no judgmental framing anywhere in copy.

### Fixes implemented
- Added a "View my sobriety tracker and milestones" link below the header that navigates to `SobrietyTracker` — resolves both the unused-`navigation` lint error and the missing cross-link in one change (reuses the existing registered route, no new navigation structure).
- Added `accessibilityLabel="Join anonymously"` to the `Switch`.
- Added `accessibilityRole`/`accessibilityLabel`/`accessibilityState` to the addiction-type filter tabs.

### Verification
`npm run typecheck` — no errors. `eslint` — went from **1 error** (`navigation` unused) to **0 errors**, 1 pre-existing inline-style warning.

**Status:** AUDITED-FIXED

---

## SobrietyTrackerScreen (`src/screens/health/recovery/SobrietyTrackerScreen.tsx`)
**Entry point:** `SobrietyTracker` route (`App.tsx:2167`), reached from the Health Extended grid, and now also from `AddictionRecoveryScreen`'s new tracker link.
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, cognitive load, loading/null-data handling, accessibility, **emotional tone/trust/privacy (the priority criterion for this batch)**, small-screen sizing, journey integration.
**Not applicable:** forms/validation (read-mostly screen; the one write action, requesting an accountability partner, has no fields to validate).

### Findings — this is the headline finding of the whole batch

1. **(P0 — critical) No path anywhere in the app or backend for logging a slip/relapse or resetting the sobriety streak.** I traced this fully, as instructed:
   - This screen only ever calls `GET recoveryStreaks` (read-only `days_sober`/`start_date`) and `POST recoveryAccountabilityRequest`. Grepped the entire route table (`src/network/routes/healthExtendedRoutes.ts`) — there is no reset/slip/relapse endpoint of any kind under `recovery-groups` or anywhere else in `healthExtended`.
   - Grepped the whole `src/` tree for `relapse`, `slip`, and `reset` in any recovery context — zero hits. The word "relapse" does not appear anywhere in the codebase.
   - `AddictionRecoveryScreen` (support groups) has no reset affordance either — it's a different feature (joining groups) entirely.
   - The milestone badges (`Day 1` / `1 Week` / `30 Days` / `90 Days` / `1 Year`) are permanently derived from `days_sober`, which itself has no way to decrease short of a server-side change nobody in the frontend can trigger.
   - **Why this is the real issue, not the framing the brief asked me to check:** the prior inventory pass was right that the *existing copy* (what little there is — "Days Sober", milestone labels) is neutral and non-shaming. But the actual ethical risk in addiction-recovery products isn't usually the wording of a relapse message — it's what happens when there's *no* message and no action at all. A user who slips either (a) sees a counter that keeps climbing through the relapse, which feels dishonest and can undercut the accountability the feature is supposed to build, or (b) has no way to acknowledge the setback in-app and must contact support/leave the app to get their counter "fixed" — precisely the moment they most need the app's support features (sponsor contact, accountability partner, crisis resources), not a dead end.
   - This needs a genuine product decision (does a reset zero the counter, or keep a separate "longest streak" alongside a new current streak? Does logging a slip notify the sponsor/accountability partner, and should it, given consent/privacy implications?) plus a backend schema/endpoint change and clinically-reviewed copy — not something to invent unilaterally in a UI pass. **Documented here as the top finding requiring product + backend + clinical-copy review before this feature should be considered complete.**
2. **(P2, partially mitigated below) No crisis-support affordance visible regardless of streak state.** Before this audit, the only in-screen path to help was the sponsor's phone number (shown only if a sponsor exists) or the "Request Accountability Partner" button (shown only if no partner exists yet, and it's a submit-and-wait request, not immediate support). A struggling user with neither a sponsor nor crisis-resources link visible had no fast path to help from this specific screen.
3. **Unlabeled icon-only back button (P2).**
4. **Good, no fix needed:** the existing "Call sponsor" button already has a correct `accessibilityLabel` (``Call ${sponsor.name}``) — this screen's author clearly knew the pattern, it just wasn't applied to the back button. Milestone lock icons use neutral "locked" styling with a padlock, not red/punitive styling, which is the right call for not-yet-reached milestones.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Go back"` to the back button.
- **Added an always-visible, non-judgmental support banner** ("Having a hard moment? You don't have to face it alone — get support now.") between the header and the main counter, linking to the existing `CrisisResources` route. This does not attempt to invent a relapse-logging feature (which would require backend work and product/clinical sign-off, per finding 1) — it's a safe, additive, zero-new-API-surface compensating control so that, until a real reset/slip flow is designed, nobody using this screen is ever more than one tap from a human/crisis resource regardless of what their counter says.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 1 pre-existing inline-style warning.

**Status:** AUDITED-FINDINGS-DOCUMENTED (finding #1 is explicitly not fixable within this pass's guardrails — it requires backend/product/clinical work; everything fixable safely was fixed)

---

## SymptomCheckerScreen (`src/screens/health/symptoms/SymptomCheckerScreen.tsx`)
**Entry point:** `SymptomChecker` route (`App.tsx:2168`), reached from the Health Extended grid.
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, forms/validation, loading/error states, accessibility, **emotional tone/trust — overconfident diagnosis language (priority for this screen)**, small-screen sizing, journey integration.
**Not applicable:** offline state (generic pattern), long-content (results list is naturally short).

### Findings
1. **Two different triage severities rendered identically (P2).** `triageColor()` mapped both `'urgent'` ("See a doctor today") and `'moderate'` ("Schedule appointment soon") to the same `palette.gold`. These are meaningfully different urgency levels per `TRIAGE_LABELS`, but a user skimming the colored banner (which is the first thing anyone reads) couldn't visually tell them apart — only the text differs. In a tool whose whole purpose is triage, color collapsing two severity tiers is a real usability/safety-adjacent gap.
2. **Unlabeled icon-only back button (P2).** The back control is a `KISButton variant="ghost"` wrapping a bare icon with no `title` and no `accessibilityLabel` passed — `KISButton` always sets `accessibilityRole="button"` but falls back to no label at all when there's no string `title`, so this rendered as an unlabeled button for screen readers.
3. **Medical-liability copy — reviewed, not touched, documented per instructions (P3, flagged for product/legal, not a bug I'm asserting).** The "Possible Conditions" result section renders backend-supplied condition names as plain chips with no per-item hedge (e.g., "may be associated with"), relying entirely on the global disclaimer and the "Beta" label in the header to carry the caveat. Whether that's sufficient hedging is a legal/clinical judgment call, not a UI defect — flagging for product/legal review rather than editing the wording myself, per this audit's explicit constraint on clinical/diagnostic copy.
4. **Genuinely good, no fix needed:** the header is labeled "AI Symptom Checker (**Beta**)" with the subtitle "Not a substitute for professional medical advice" directly underneath — that's exactly the kind of upfront, unhedged framing that avoids overconfident diagnosis language. The in-body disclaimer repeats this before any input is collected, and a dynamic `result.disclaimer` field lets the backend inject extra caveats per response. The emergency tier (red) is visually distinct and uses `TRIAGE_LABELS` with explicit action text ("Seek immediate care"), not vague language. This is a well-built disclaimer pattern that other medical-adjacent screens in this batch should probably match.

### Fixes implemented
- `triageColor()`: `'urgent'` now maps to `palette.warning` (previously shared `palette.gold` with `'moderate'`), giving all four tiers (`danger` → `warning` → `gold` → `primary`) distinct, severity-ordered colors.
- Back button: added `accessibilityLabel="Go back"`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 1 pre-existing inline-style warning.

**Status:** AUDITED-FIXED

---

## TelemedicineScreen (`src/screens/health/telemedicine/TelemedicineScreen.tsx`)
**Entry point:** `TelemedicineHub` route (`App.tsx:2155`), reached from the Health Extended grid and from `MentalHealthScreen`'s "Talk to Therapist" card and `SymptomCheckerScreen`'s "Book Consultation" CTA.
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, navigation, cognitive load, loading/empty states, accessibility, trust/clarity of next steps, small-screen sizing, journey integration.
**Not applicable:** forms/validation (no input on this screen).

### Findings
1. **The three "Quick Actions" are cosmetically distinct but functionally identical (P1).** "Instant Consult," "Book Appointment," and "Doctor Directory" each navigate to `DoctorDirectory` with a different `mode` param (`'instant' | 'book' | 'browse'`, a real typed param in `navigation/types.ts:456`) — but `DoctorDirectoryScreen` never reads `route.params` at all (its function signature only destructures `{ navigation }`), and its booking handler always sends `type: 'scheduled'` to the backend regardless of which tile was tapped. A user who taps "Instant Consult" expecting an immediate connection gets the exact same doctor list and the exact same "scheduled" booking flow as someone who tapped "Book Appointment." This is a trust issue specifically called out as a priority for telemedicine in this audit ("feel trustworthy and clear about what happens next") — the UI promises three different things and delivers one. **Not fixed in this pass**, because correcting it would mean changing what gets sent to the booking API for at least the "instant" case (e.g., a different `type` value) and I don't know whether the backend's consult-creation endpoint actually supports or expects an "instant" type — that's a backend-contract question explicitly out of scope for a unilateral frontend fix. Documented as a P1 finding for backend/product follow-up.
2. **Nested touchables (P2, documented, not fixed).** Each upcoming-consult row is a `TouchableOpacity` (navigates to `ConsultDetail`) that, when status is `in_progress`, contains a second `KISButton` ("Join Call") inside it. Nesting a tappable button inside another tappable row is a known React Native footgun — behavior (which handler fires, whether VoiceOver announces one element or two) can be inconsistent and really needs on-device testing rather than a blind code edit, so I'm flagging rather than restructuring it.
3. **Unlabeled quick-action buttons (P2, fixed).** The three quick-action tiles had icon+text but no `accessibilityRole`/`accessibilityLabel` of their own (the text would still be read by itself, but without a combined label/role the three-way group doesn't announce as buttons).
4. **Good, no fix needed:** status badges (`Scheduled`/`In Progress`/`Completed`/`Cancelled`) use clear, correctly-differentiated colors (`primary`/`primaryStrong`/`subtext`/`danger`) — unlike the mood-score and triage-color bugs found elsewhere in this batch, this mapping is semantically correct (cancelled really is a negative/terminal state, unlike a low mood score).

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the three quick-action tiles.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 1 pre-existing inline-style warning.

**Status:** AUDITED-FINDINGS-DOCUMENTED (finding #1 needs a backend/product decision; #2 needs on-device QA before any structural change)

---

## DoctorDirectoryScreen (`src/screens/health/telemedicine/DoctorDirectoryScreen.tsx`)
**Entry point:** `DoctorDirectory` route (`App.tsx:2156`), reached only from `TelemedicineScreen`'s three quick-action tiles (see finding above — this screen is the other half of that bug).
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, navigation, loading/empty states, accessibility, trust (verification badges), small-screen sizing, journey integration.
**Not applicable:** forms (filter-only, no text input).

### Findings
1. **`route.params.mode` is completely unused (P1, same root cause as the TelemedicineScreen finding above — documented once there, cross-referenced here).** Confirmed from this side too: the component signature is `({ navigation }: Props)` — `route` isn't even destructured, so the `mode` param can never be read no matter what's passed.
2. **Unlabeled back button (P2, fixed).**
3. **No selection/role semantics on specialty filter chips (P2, fixed).**
4. **Good, no fix needed.** The in-code comments on this file (lines 26–31 and 72–76) document two real prior bugs that were already fixed before this audit: a serializer-shape mismatch that used to crash on `doc.rating.toFixed(1)` because the live backend never sent `rating`/`review_count`/`avatar_url`, and a dead-end booking flow that used to navigate straight to `ConsultDetail` without ever creating a consult. Both are now handled correctly — `verification_status.is_verified` drives a "Verified practitioner"/"Not yet verified" trust label (good, non-alarming phrasing for the unverified case), and `handleBook` now creates the consult via `POST consults` before navigating. This is good evidence the surrounding code quality here is solid; the `mode` gap is the one real gap left.

### Fixes implemented
- Back button: `accessibilityRole="button"` + `accessibilityLabel="Go back"`.
- Specialty filter chips: `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ selected }}`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 1 pre-existing inline-style warning.

**Status:** AUDITED-FINDINGS-DOCUMENTED (the `mode` gap is a cross-screen finding owned jointly with `TelemedicineScreen`, needs backend/product input)

---

## ConsultDetailScreen (`src/screens/health/telemedicine/ConsultDetailScreen.tsx`)
**Entry point:** `ConsultDetail` route (`App.tsx:2157`), reached by tapping a consult card in `TelemedicineScreen` or after booking in `DoctorDirectoryScreen`.
**Criteria evaluated:** visual hierarchy, color/token usage, button placement/touch targets, forms (star rating + review), loading/null-data/error states, accessibility, trust/clarity of next steps, small-screen sizing, journey integration.
**Not applicable:** none.

### Findings
1. **Stale-data logic bug: a cancelled/completed consult could still show "Join Video Call" (P2, fixed).** `canJoin` was `consult.status === 'in_progress' || !!consult.call_url` — the second half of that `||` has no status guard at all, so if the backend ever returns a `call_url` on a `cancelled` or `completed` consult (a plausible "didn't bother clearing the field" case), the UI would render a prominent, primary-styled "Join Video Call"/"Open Call Link" button for a call that can never connect. That's a trust problem in exactly the area this audit prioritizes for telemedicine ("clear about what happens next") — offering a call action that's guaranteed to fail.
2. **Unlabeled back button (P2, fixed).**
3. **Star rating control has no accessibility labels (P2, fixed).** Each star is a correctly-sized 44×44 `TouchableOpacity` (good touch target) but had no `accessibilityLabel`, so a screen-reader user would hear five identical unlabeled buttons with no indication of what rating each represents or which ones are currently "filled."
4. **Good, no fix needed:** the review section is gated behind `isCompleted`, so a user is never prompted to rate a consult that hasn't happened yet; the "Doctor Notes" section only renders when notes exist (no empty-string placeholder clutter); loading and "Consult not found" states are both handled explicitly rather than falling through to a blank screen.

### Fixes implemented
- `canJoin`: now `(consult.status === 'in_progress' || consult.status === 'scheduled') && !!consult.call_url` — excludes `completed`/`cancelled` regardless of whether a stale `call_url` is present.
- Back button: `accessibilityRole="button"` + `accessibilityLabel="Go back"`.
- Star rating buttons: `accessibilityRole="button"`, `accessibilityLabel={"Rate N out of 5 stars"}`, `accessibilityState={{ selected }}`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, 3 pre-existing inline-style warnings (unrelated, pre-existing on lines untouched by this edit).

**Status:** AUDITED-FIXED
