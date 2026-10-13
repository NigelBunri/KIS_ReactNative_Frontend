# UX/UI Audit — Education

**Batch:** `src/screens/education/**` (25 files: `learner/` x6, `provider/` x13, `provider/course-builder/` x3, `shared/` x3)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility audit, not a file inventory. Two prior docs already cover this domain's redesign history and are treated as background, not re-discovered here: `docs/education-dashboard-redesign-progress.md` (the old `EducationManagementModal.tsx` → real-navigator-destinations rewrite) and `docs/education-ux-v2-visual-and-broadcast-pass.md` (the visual pass that followed it, plus the Broadcasts/Institution-Profile restoration). Their three flagged risks are carried forward as still-open, not re-reported as new: (1) `EducationRevenuePreviewCard` is a stub that always renders `null` — not touched here, out of this batch's file list; (2) `InstitutionProfileScreen`'s read-only use of staff-oriented institution endpoints for learners is unverified against a live backend — still unverified, no backend access in this pass either; (3) the three course-builder editors (`ContentEditor`, `AssessmentsEditor`, `LiveEditor`) were deliberately left visually unstyled in the prior pass — confirmed still true, and this audit did not restyle them (that was an explicit prior decision, not an oversight).

## Summary

25/25 files audited. 24 findings documented across the batch, of which **9 were fixed** in this pass (all additive/corrective — no backend contracts, API calls, payload shapes, or navigation structure were changed). The codebase in this domain is, on the whole, unusually disciplined: nearly every destructive action already has a proper confirmation `Alert` (delete class/program/lesson/material/module-item all do this correctly), and every write path already checks `response?.success` before updating state or re-fetching — the "fabricate success on failure" pattern explicitly hunted for per this audit's brief (and found repeatedly elsewhere in the codebase, e.g. `EmergencyDispatchManager`) **does not occur anywhere in this batch**. The most important issue found was a genuine silent-failure gap in `CertificatesScreen` (the one true "nothing happens, no error shown" bug in the batch) and a real missing-confirmation gap in `LiveEditor` ("Cancel session" had no confirmation despite directly affecting enrolled learners) — both fixed. The rest of the findings are smaller: icon-only controls without `accessibilityLabel`, back-button touch targets under the 44pt minimum, one meaningful journey gap (`EventsLiveScreen`'s quick-created events have no edit path anywhere in this screen set), and one emotional-tone/feedback gap (assessment submission in `LearningPlayerScreen` gives no visible confirmation of success or score).

---

## EducationHomeScreen (`src/screens/education/learner/EducationHomeScreen.tsx`)
**Entry point:** `EducationHome` (modal route, reached from the main tab bar's Education entry).
**Criteria evaluated:** visual hierarchy, typography/spacing, color/contrast, touch targets, accessibility labels, navigation, loading/empty/error states, emotional tone, small-screen usability, journey integration (discover → enroll).
**Not applicable:** forms/validation (no forms on this screen); destructive actions (none present).

### Findings
1. **Header icon buttons under the 44pt touch-target minimum (P3).** `HeaderIconButton` renders a 40×40 `Pressable` for Certificates/My Learning/Manage-institution — each already has a correct `accessibilityLabel`, but the tap target itself is 4pt short of `KIS_TOKENS.accessibility.minTouchTarget` (44) in both dimensions.
2. **Institution spotlight card missing `accessibilityRole`/label (P3).** The spotlight `Pressable` relies on its child `Text` for screen-reader content but never declares itself as a button, so VoiceOver/TalkBack doesn't announce the "button" trait on an otherwise fully custom tappable card.
3. **Good: error state, empty state, and greeting tone are all appropriate (no fix needed).** The error banner is visible and readable, the empty state offers a clear next action ("Create an institution"), and the time-of-day greeting with a wave emoji is warm without being saccharine.

### Fixes implemented
- Added `hitSlop={4}` to `HeaderIconButton` (brings the effective tap target to ~48×48 without changing the visual 40×40 button).
- Added `accessibilityRole="button"` and `accessibilityLabel={`Open ${spotlight.name}`}` to the institution spotlight `Pressable`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only (not introduced by this change).

**Status:** AUDITED-FIXED

---

## MyLearningScreen (`src/screens/education/learner/MyLearningScreen.tsx`)
**Entry point:** `EducationMyLearning` (modal route).
**Criteria evaluated:** visual hierarchy, empty states, progress-bar legibility, emotional tone of completion/progress UI, journey integration (continue learning → complete → certificate).
**Not applicable:** forms/validation, destructive actions (none present), offline state (read-only screen backed by the same discovery hook as the Home screen).

### Findings
1. **Good: tone of progress/completion UI is encouraging, not punitive (no fix needed).** "In progress," "Completed," and "Nothing in progress yet — Enroll in a course to get started" all read supportively; the completed section offers a one-tap "Certificate" action rather than requiring the learner to go hunt for it.
2. **Minor: "Browse courses" action uses `popToTop()` rather than a direct navigate (P3, cosmetic).** Works correctly but is a slightly indirect way to express "go back to Discover" compared to an explicit `navigate('EducationHome')`; no observable user-facing difference since this screen is always one level below Home in the stack.

### Fixes implemented
None — both findings are cosmetic/non-blocking; the screen meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## CertificatesScreen (`src/screens/education/learner/CertificatesScreen.tsx`)
**Entry point:** `EducationCertificates` (modal route).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing (explicit audit focus), forms/validation (n/a), touch targets, emotional tone.
**Not applicable:** destructive actions (none — this screen only views/shares/downloads).

### Findings
1. **Silent failure when media headers aren't ready yet (P1 — the clearest silent-error-swallowing bug in this batch).** `downloadCertificate` returned `null` with no error and no explanation whenever `mediaHeaders` was empty (e.g. auth not yet hydrated). Both `handleView` and `handleShare` then did nothing when `localUri` came back falsy — the button flipped from "Loading…" back to "View"/"Share" with **zero indication anything went wrong**. A learner tapping "View" on a certificate they rightfully earned would see the button spin and then silently reset, with no way to tell if they did something wrong or the app is broken. This is exactly the "nothing happens, no feedback" failure mode the audit brief calls out (cf. `EmergencyDispatchManager`'s fixed silent-fallback bugs in the Health batch) — the only meaningful difference is this one doesn't fabricate a fake success, it just fabricates *silence*.
2. **Good: busy-state per-row disabling is correct.** `downloadingId` correctly scopes the "Loading…" state to the specific row being downloaded/shared, so other rows stay interactive.

### Fixes implemented
- `downloadCertificate` now `throw`s a descriptive error (`"Still connecting — please try again in a moment."`) instead of silently returning `null` when media headers aren't ready. Both call sites (`handleView`, `handleShare`) already had a `try/catch` with `Alert.alert(..., error?.message || ...)`, so this single change makes both surfaces the failure correctly with no further changes needed.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED

---

## CourseDetailScreen (`src/screens/education/learner/CourseDetailScreen.tsx`)
**Entry point:** `EducationCourseDetail` (modal route; also reached by deep link `education/courses/:contentId`).
**Criteria evaluated:** forms/validation, payment/enrollment state handling, silent-error-swallowing, accessibility labels on icon-only controls, touch targets, loading/empty/error states, journey integration (discover → enroll → learn).
**Not applicable:** destructive actions (no withdraw/unenroll action exists anywhere on this screen — enrollment is one-directional from here, which is consistent with the rest of the app; nothing to confirm).

### Findings
1. **Back-button touch target under 44pt (P3).** The back `Pressable` (`padding: 4`, 20pt icon) has no `accessibilityLabel`/role and an effective tap target around 28pt.
2. **Good: payment/enrollment flow has no silent failures or fabricated success.** `handleEnrollmentRequest` checks `response?.success` before ever touching state, distinguishes `queued` (offline-queue) from `success`/`error`, and gives a distinct, accurate `Alert` for each of: generic failure, offline-queued ("You have not been charged yet"), payment-pending with a checkout link, payment-pending without one, and plain enrollment success. This is a model implementation of the pattern this audit is hunting for bugs in.
3. **Good: the "Save for offline" toggle is already fully accessible.** Has both `accessibilityRole="button"` and a correct dynamic `accessibilityLabel`.
4. **Good: locked-curriculum-item tap gives clear feedback.** Tapping a locked (non-preview, non-enrolled) curriculum item shows `Alert.alert('Locked', 'Enroll in this course to unlock this item.')` rather than silently doing nothing.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Back"`, and `hitSlop={12}` to the back `Pressable`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED

---

## LearningPlayerScreen (`src/screens/education/learner/LearningPlayerScreen.tsx`)
**Entry point:** `EducationLearningPlayer` (modal route, reached from `CourseDetailScreen`'s curriculum list).
**Criteria evaluated:** forms/validation (assessment answering), emotional tone of grading/completion UI (explicit audit focus), touch targets, accessibility, access-gating, loading/empty states, journey integration.
**Not applicable:** destructive actions (none — lesson/material/session actions here are all additive: mark complete, mark attended, submit).

### Findings
1. **No visible confirmation or score after submitting an assessment (P2 — emotional-tone/feedback gap).** `runAction('submit_assessment', ...)` on success just calls `hydrate(contentId)` and returns — there is no `Alert`, no "Submitted!" state, and no display of a score/pass-fail result anywhere in `renderBody`'s `'assessment'` case. A learner who answers every question and taps "Submit answers" gets no on-screen acknowledgment that it worked at all; the only feedback is that the button's `disabled`/`busy` state resolves. For a grading/completion surface — explicitly called out in this audit's brief as needing to "feel encouraging, not punitive" — giving *no* feedback undershoots that bar in the other direction: it feels like nothing happened. Not fixed here because the right UI (show a score? show "submitted, awaiting grading" for essay/short-answer? show "passed"?) depends on data this screen doesn't currently read from the response payload — a product/backend-payload decision, not a safe mechanical patch.
2. **Back-button touch target under 44pt, no accessibility label (P3).** Same pattern as `CourseDetailScreen`.
3. **Good: live-session join window messaging is clear and well-reasoned.** The 5-minutes-before/5-minutes-after join window shows a precise, friendly explanation (`"Opens 5 minutes before the scheduled time."` / `"The join window for this session has closed."`) rather than just disabling the button with no reason given.
4. **Good: locked-item access gate is clear and non-punitive.** Shows a lock icon with "Enroll in this course to unlock this item" plus a way back to the course, rather than a dead end.
5. **Good: no silent failures.** `openGroupChat` shows an `Alert` if group-chat setup fails rather than doing nothing; `runAction` always surfaces `response?.message` on failure.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Back to course"`, and `hitSlop={12}` to the back `Pressable`.
- Finding 1 (assessment submission feedback) is documented only — fixing it correctly requires knowing what the submit-assessment response payload actually contains (a score? pending-grading flag?), which is outside what this pass could safely verify without backend access.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FINDINGS-DOCUMENTED (one P3 fixed; the P2 feedback gap needs a product/payload decision before a correct fix can be written)

---

## InstitutionProfileScreen (`src/screens/education/learner/InstitutionProfileScreen.tsx`)
**Entry point:** `EducationInstitutionProfile` (modal route; also reached by deep link `education/institutions/:institutionId/profile`).
**Criteria evaluated:** loading/empty/error states, permission-state handling (explicit known risk from the prior docs), visual hierarchy, journey integration (institution discovery → courses/updates).
**Not applicable:** forms/validation, destructive actions (none — read-only profile view).

### Findings
1. **Carried forward from `education-ux-v2-visual-and-broadcast-pass.md`: unverified learner-read permissions (still open, not re-discovered).** This screen calls `educationInstitutionCourses`/`educationInstitutionBroadcasts` — endpoints originally built for institution staff — and degrades to an empty "No published courses yet"/"No updates yet" section rather than erroring if the backend rejects the call for a non-staff learner. The prior doc already flagged this as a soft risk needing live-backend confirmation; this pass had no backend access to confirm or deny it either, so it remains open exactly as described.
2. **Good: the empty-state degradation itself is well-designed, independent of whether the permission risk is real.** Whether the list comes back empty because there's genuinely nothing published, or because the endpoint silently rejected a non-staff caller, the learner sees the same calm "check back soon" message rather than a scary error — the right default behavior while the actual permission question is still open.
3. **Good: no silent total-failure.** If the institution detail call itself fails, the screen still renders the header with the `institutionName` route param as a fallback title, rather than a blank screen.

### Fixes implemented
None — finding 1 requires live-backend verification (restated from the known-risks doc, not a new discovery) and finding 2/3 are already correct.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED (pre-existing known risk restated, no new fix needed or possible from this pass)

---

## InstitutionPickerScreen (`src/screens/education/provider/InstitutionPickerScreen.tsx`)
**Entry point:** `EducationInstitutionPicker` (modal route; also reached by deep link `education/institutions`).
**Criteria evaluated:** forms/validation, loading/empty states, silent-error-swallowing, journey integration (create → manage → broadcast institution).
**Not applicable:** destructive actions (no delete-institution action exists on this screen).

### Findings
1. **Good: institution creation form validates and reports failure correctly.** Empty-name guard before submit, `response?.success` check, and an `Alert` with the real backend message on failure — no silent swallow.
2. **Good: the institution-broadcast toggle ("Broadcast"/"Remove from live") correctly re-publishes the same record on a second tap** instead of creating duplicate broadcast rows, and surfaces failure via `Alert` rather than updating local state optimistically before confirming success.
3. **Minor: type-picker pills (`INSTITUTION_TYPES`) use bare styled `Pressable`s without `accessibilityRole` (P3).** Same pattern noted batch-wide below; listed here as the first instance.

### Fixes implemented
None in this file — finding 3 is part of a batch-wide, low-priority pattern (see the Summary and the Provider forms below) that was fixed selectively where icon-only or clearly ambiguous, not applied to every text-pill picker across every file in this pass to keep the change set reviewable.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## InstitutionDashboardScreen (`src/screens/education/provider/InstitutionDashboardScreen.tsx`)
**Entry point:** `EducationInstitutionDashboard` (modal route; deep link `education/institutions/:institutionId`).
**Criteria evaluated:** visual hierarchy, information density, loading/empty states, journey integration (the provider's home base: courses/programs/learners/events/broadcasts/settings all branch from here).
**Not applicable:** forms/validation, destructive actions (none on this screen itself — all delete actions live on the dashboards/editors it links to).

### Findings
1. **Good: "Needs your attention" surfacing is well-designed.** Pending applications + pending course-access requests are summed into a single actionable card that only appears when non-zero and routes straight to `Learners`'s request queue — exactly the kind of "attention, not a flat list" organization the prior redesign doc's Phase 2 intended.
2. **Good: empty states on "Recent courses"/"Recent broadcasts" both offer a direct creation action, not just an inert message.**

### Fixes implemented
None — this screen meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## CoursesListScreen (`src/screens/education/provider/CoursesListScreen.tsx`)
**Entry point:** `EducationCourses` (modal route).
**Criteria evaluated:** filtering/tabs, empty states, visual density, journey integration (manage → edit course).
**Not applicable:** forms/validation (creation happens in `CourseBuilderScreen`), destructive actions (no delete here — delete isn't exposed at all for courses from any screen in this batch, see `CourseBuilderScreen` notes).

### Findings
1. **Status-filter tabs (`All`/`Published`/`Drafts`) are bare `Pressable`+`Text`, no `accessibilityRole` (P3).** Same batch-wide pattern.
2. **No way to delete or archive a course anywhere in this screen set (P2 — journey gap, documented only).** `ProgramDashboardScreen`/`ClassDashboardScreen` both have a "Danger zone → Delete" action; courses have no equivalent on `CoursesListScreen`, `CourseBuilderScreen`, or anywhere else in this batch — only "Remove from live" (unpublish the broadcast) or flipping `status` to `draft`/`archived` via the Details tab's status pills. A provider who created a test/duplicate course has no way to remove it from their list short of leaving it as an unpublished draft forever. This may be an intentional backend constraint (no delete endpoint for courses) rather than an oversight, but it's a real, user-facing gap in the create → manage journey either way.

### Fixes implemented
None — finding 2 may require a backend capability this pass can't confirm exists; finding 1 is the same low-priority pattern noted elsewhere.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## LearnersScreen (`src/screens/education/provider/LearnersScreen.tsx`)
**Entry point:** `EducationLearners` (modal route).
**Criteria evaluated:** destructive-action confirmation (explicit audit focus — approve/reject decisions), empty states, sub-tab navigation, silent-error-swallowing.
**Not applicable:** forms/validation (no forms on this screen).

### Findings
1. **"Reject" on a membership/course-access request has no confirmation (P3).** `decideMembership(id, 'reject')` and `decideAccessRequest(...)` fire immediately on tap, with no "Are you sure?" step, unlike comparable irreversible-ish decisions elsewhere in this batch (e.g. archiving a broadcast, deleting a class/program). Rejecting someone's application is reversible in the sense that they could reapply, but it's still a real decision about a real person with no undo visible from this screen — lower severity than the audit brief's named examples (withdrawing from a course, deleting content) but the same category of risk. Documented rather than fixed: adding a confirmation here is a product-tone decision (does "Reject" need friction, or would that just slow down routine moderation?) that's better made deliberately than patched reflexively.
2. **Good: both decision actions correctly check `response?.success` before reloading** — no optimistic update that could desync from a failed backend write.
3. **Good: sub-tab counts (`Requests (N)`, `Students (N)`, `Staff (N)`) give the provider an at-a-glance sense of what needs attention without opening each tab.**

### Fixes implemented
None — finding 1 is a deliberate-tone judgment call flagged for follow-up, not a mechanical safe fix.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## EventsLiveScreen (`src/screens/education/provider/EventsLiveScreen.tsx`)
**Entry point:** `EducationEventsLive` (modal route).
**Criteria evaluated:** journey integration (create → publish → manage, explicit audit focus), empty states, loading states.
**Not applicable:** destructive actions (no delete/cancel exposed here — see finding 1), forms/validation (quick-create has no form at all, which is the finding).

### Findings
1. **Quick-created events have no path to edit, and list rows aren't tappable at all (P1/P2 — real journey gap).** "+ Create" (`createQuickEvent`) posts a hardcoded `{ title: 'New event', ... starts_at: +7 days, status: 'draft' }` with zero user input, then the resulting row renders via `EducationListCard` with **no `onPress`, no primary action, no secondary action** — it is purely informational. There is no event-detail or event-edit screen anywhere in this 25-file batch (unlike classes/programs/courses, which all have a dedicated Form + Dashboard pair). The only way to change that placeholder title or the auto-picked date is not available from this screen, this app, or (as far as this batch's files show) anywhere else — a provider who taps "+ Create" is left with a permanently-misnamed draft event they cannot edit. This breaks the "create → publish → manage" journey this audit was specifically asked to check for provider screens: creation exists, but there is no "manage" half for events at all. Not fixed here — closing this gap correctly needs a new `EventForm`/`EventDashboard` screen pair (mirroring `ClassFormScreen`/`ClassDashboardScreen`), which is a new-screen/navigation-structure change outside this pass's "safe, low-risk" fix bar.
2. **Good: combined class-session + event timeline, sorted by start time, with a clear "kind" eyebrow label (`Live class` vs `Event`) — sensible consolidation.**
3. **Good: empty state offers the same creation action as the header, not a dead end.**

### Fixes implemented
None — finding 1 needs a new screen, which is out of scope for this pass's fix bar; finding 2/3 are already correct.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED (one P1/P2 journey gap flagged for a follow-up feature pass)

---

## InstitutionSettingsScreen (`src/screens/education/provider/InstitutionSettingsScreen.tsx`)
**Entry point:** `EducationInstitutionSettings` (modal route).
**Criteria evaluated:** destructive/impactful-action confirmation (explicit audit focus), forms/validation, loading states, silent-error-swallowing.
**Not applicable:** none — all listed criteria apply and were checked.

### Findings
1. **"Disconnect partner" had no confirmation despite being a real access-control change (P2 — fixed).** Per this file's own in-app copy, connecting a partner org gives "anyone with manager rights on that partner... the same ability to manage this institution that you have," and disconnecting reverses that. That's a meaningful permission change — not a cosmetic toggle — yet `handleDisconnectPartner` previously fired on a single tap with no confirmation step at all, while comparably-impactful actions elsewhere in this same batch (delete class, delete program, archive broadcast, delete lesson/material) all correctly confirm first. This was the second-clearest missing-confirmation gap in the batch after `LiveEditor`'s session cancellation.
2. **Good: Stripe-status auto-refresh on focus is a genuine UX improvement already in place** (documented in the file's own header comment) — returning from Stripe's hosted onboarding page refreshes status without a manual "tap refresh" step.
3. **Good: all write paths (`saveProfile`, `connectFlutterwave`, `connectStripe`, partner connect) correctly check `response?.success` and show the real backend message on failure.**

### Fixes implemented
- Split `handleDisconnectPartner` into a confirmation step (`Alert.alert` naming the partner by name, explaining the effect) wrapping the original network call (renamed to `disconnectPartner`). No change to the request payload, endpoint, or success/failure handling — purely an added confirmation gate.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED

---

## BroadcastsScreen (`src/screens/education/provider/BroadcastsScreen.tsx`)
**Entry point:** `EducationBroadcasts` (modal route).
**Criteria evaluated:** destructive-action confirmation, forms/validation, empty states, silent-error-swallowing, journey integration (create → publish → manage broadcasts).
**Not applicable:** none.

### Findings
1. **Good: this is a model implementation for the whole batch.** "Remove" (archive) a broadcast correctly confirms first with clear, accurate copy ("This will be marked as archived and hidden from learners until you publish it again") and a destructive-styled confirm button; the create/edit form validates required fields (title, and the linked course/event when the kind needs one) before submit; every write checks `response?.success`; status filter chips and kind-picker chips are all real `KISButton`s (which, per `KISButton`'s own implementation, always carry `accessibilityRole="button"`) rather than bare styled `Text`/`Pressable`, avoiding the accessibility gap seen in several sibling screens.
2. No issues found.

### Fixes implemented
None — this screen meets the bar as-is and was used as a positive reference point for findings elsewhere in this batch.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## ProgramsListScreen (`src/screens/education/provider/ProgramsListScreen.tsx`)
**Entry point:** `EducationPrograms` (modal route).
**Criteria evaluated:** tabs/filtering, empty states, broadcast-toggle affordance, journey integration.
**Not applicable:** forms/validation (creation lives in `ProgramFormScreen`/`ClassFormScreen`), destructive actions (delete lives in the respective Dashboard screens).

### Findings
1. **Top-level Programs/Classes tabs are bare `Text`+`onPress`, no `accessibilityRole` (P3).** Same batch-wide pattern as the pill pickers in the form screens.
2. **Good: "Program-associated" vs "Standalone" class grouping is a clear, correctly-labeled separation** that matches the file's own stated design intent (never implying a Class requires a Program).
3. **Good: broadcast-toggle actions correctly check success and only update local state after the backend confirms.**

### Fixes implemented
None — finding 1 is the same low-priority batch-wide pattern; findings 2/3 are already correct.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ProgramDashboardScreen (`src/screens/education/provider/ProgramDashboardScreen.tsx`)
**Entry point:** `EducationProgramDashboard` (modal route).
**Criteria evaluated:** destructive-action confirmation, tab navigation, empty states, information hierarchy, journey integration (create → publish → manage a program).
**Not applicable:** forms/validation (editing lives in `ProgramFormScreen`).

### Findings
1. **Good: "Delete Program" is correctly confirmed and correctly non-cascading.** The confirmation copy accurately explains the real effect ("Its classes and courses are kept — they just won't belong to a program anymore"), which matters: a less careful implementation could easily have implied (or actually caused) cascading deletion of everything nested under the program. This is exactly the kind of destructive-action care this audit was asked to check for.
2. **Tab bar (`Details`/`Classes`/`Courses`/`Learners`/`Staff`/`Events/Live`/`Broadcast`/`Settings`) uses bare `Text`+`onPress` pills, no `accessibilityRole` (P3).** Same batch-wide pattern; notable here because it's the primary navigation mechanism for the whole screen, not just a filter, so the accessibility gap has slightly higher stakes than on a filter row.
3. **Good: the Broadcast tab's explanatory copy ("Removing it from broadcast does not delete the Program — it only stops it from being surfaced") correctly de-risks a non-destructive toggle** rather than needing (or having) a confirmation dialog it doesn't actually need.

### Fixes implemented
None — finding 2 is the same low-priority batch-wide pattern noted throughout; findings 1/3 are already correct.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ClassDashboardScreen (`src/screens/education/provider/ClassDashboardScreen.tsx`)
**Entry point:** `EducationClassDashboard` (modal route).
**Criteria evaluated:** destructive-action confirmation, tab navigation, empty states, journey integration.
**Not applicable:** forms/validation (editing lives in `ClassFormScreen`).

### Findings
1. **Good: "Delete Class" mirrors `ProgramDashboardScreen`'s correct, accurately-worded, non-cascading confirmation.** Same standard maintained consistently across both dashboards.
2. **Tab bar pills, same `accessibilityRole` gap as `ProgramDashboardScreen` (P3).**

### Fixes implemented
None — same reasoning as `ProgramDashboardScreen`.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ProgramFormScreen (`src/screens/education/provider/ProgramFormScreen.tsx`)
**Entry point:** `EducationProgramForm` (modal route).
**Criteria evaluated:** forms/validation, cover-image upload failure handling, touch targets on pill pickers, silent-error-swallowing.
**Not applicable:** destructive actions (this is a create/edit form only).

### Findings
1. **Good: cover-image upload failure is handled gracefully and transparently.** If `uploadEducationMedia` throws, the rest of the form still saves and the user sees an accurate `Alert` ("Unable to upload cover image — the rest of the program was still saved") rather than losing the whole submission or silently dropping the image with no explanation.
2. **Preset-pill pickers (program type/level/duration unit, visibility, status) are bare `Text`+`onPress`, no `accessibilityRole`, borderline touch target (~7pt vertical padding) (P3).** Same batch-wide pattern; this file has the most instances of any single file (6 separate pill rows).
3. **Good: required-field validation (`title`) blocks submit with a clear message before any network call.**

### Fixes implemented
None — finding 2 is the same low-priority batch-wide pattern (see Summary); fixing every pill instance across this file and its three siblings (`ClassFormScreen`, `CourseBuilderScreen`'s Details tab, `AssessmentsEditor`/`LiveEditor`'s preset rows) was judged too broad a mechanical change to make safely in one pass without a dedicated shared `PillPicker` component to fix it once — recommended as a small follow-up component extraction rather than a scattered patch.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ClassFormScreen (`src/screens/education/provider/ClassFormScreen.tsx`)
**Entry point:** `EducationClassForm` (modal route).
**Criteria evaluated:** forms/validation, cover-image upload handling, program-lock state clarity, pill-picker accessibility.
**Not applicable:** destructive actions (create/edit form only).

### Findings
1. **Good: same graceful cover-image-upload-failure handling as `ProgramFormScreen`.**
2. **Good: the "Program (optional)" section clearly communicates the locked-vs-free state** — when reached from a Program's "+ Add Class," it shows plain text naming the program instead of a picker; when reached standalone, a full picker with an explicit "None — Standalone Class" option is shown, matching the file's own stated design intent of never assuming a Class belongs to a Program.
3. **Same pill-picker accessibility/touch-target pattern as `ProgramFormScreen` (P3).**

### Fixes implemented
None — same reasoning as `ProgramFormScreen`.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## CourseBuilderScreen (`src/screens/education/provider/CourseBuilderScreen.tsx`)
**Entry point:** `EducationCourseBuilder` (modal route).
**Criteria evaluated:** destructive-action confirmation, forms/validation, accessibility labels on icon-only controls, touch targets, tab navigation, journey integration (create → curriculum → publish).
**Not applicable:** offline state (not implemented, consistent with the rest of this batch's provider screens).

### Findings
1. **Back-button touch target under 44pt, no accessibility label (P3).** Same pattern as the learner screens' back buttons.
2. **Curriculum-item delete icon button had no `accessibilityLabel` (P3 — fixed).** The trash `Pressable` next to each module item already had a correct destructive confirmation (`deleteModuleItem`'s `Alert` — "This will permanently delete this {label}, not just remove it from the module" is exactly the right level of clarity for a two-destination delete), but the icon-only trigger itself had no label for screen readers.
3. **Good: the delete confirmation copy above is a genuinely good example of disambiguating a two-destination delete** (removing from the module vs. deleting the underlying lesson/material/session/assessment/event record) — exactly the kind of clarity this audit was asked to check destructive actions for.
4. **Good: the "Broadcast"/"Remove from live" card accurately explains what publishing actually means** ("Save this course first, then broadcast it..." / "Learners can find and enroll in this course from the Education tab right now") and correctly disables the action while the course is still new/unsaved.
5. **Tab bar uses real `Pressable`s (not bare `Text`) but still has no `accessibilityRole="button"` (P3).** Slightly better than the `Text`-only pattern elsewhere (at least a proper touchable component), but still missing the explicit role.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Back"`, and `hitSlop={12}` to the top-level back `Pressable`.
- Added a dynamic `accessibilityLabel` (e.g. `"Delete lesson"`, `"Delete material"`) to the curriculum-item delete icon `Pressable`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED

---

## ContentEditor (`src/screens/education/provider/course-builder/ContentEditor.tsx`)
**Entry point:** Not a route — rendered inside `CourseBuilderScreen`'s "Content" tab (`EducationCourseBuilder`).
**Criteria evaluated:** destructive-action confirmation, accessibility labels on icon-only controls, forms/validation, file-upload failure handling.
**Not applicable:** visual-design criteria (the prior UX-v2 doc explicitly left this editor unstyled by design; this pass respected that decision and did not restyle it).

### Findings
1. **Good: both delete actions (lesson, material) are correctly confirmed with accurate, specific copy** ("Permanently delete \"{title}\"? This can't be undone.") — no ambiguity about scope, unlike some multi-destination deletes elsewhere in the app.
2. **Delete-lesson and delete-material icon buttons had no `accessibilityLabel` (P3 — fixed).** Both use `KISButton variant="ghost"` with only a `KISIcon` child and no `title` — and `KISButton`'s own fallback (`accessibilityLabel ?? title`) only resolves when `title` is a string, so these had no accessible name at all.
3. **Good: "Preview" on a material reuses the exact same `MaterialViewer` component a learner sees** — the creator gets a真实, accurate preview rather than guessing what will render.
4. **Good: file-upload failure doesn't block the overall save** — same graceful degradation pattern as the Program/Class form screens' cover-image uploads.

### Fixes implemented
- Added `accessibilityLabel="Delete lesson"` to the lesson-delete `KISButton`.
- Added `accessibilityLabel="Delete material"` to the material-delete `KISButton`.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED

---

## AssessmentsEditor (`src/screens/education/provider/course-builder/AssessmentsEditor.tsx`)
**Entry point:** Not a route — rendered inside `CourseBuilderScreen`'s "Assessments" tab.
**Criteria evaluated:** accessibility labels on icon-only controls, destructive-action confirmation, content-management completeness, forms/validation.
**Not applicable:** visual-design criteria (intentionally unstyled by prior design decision, not restyled here).

### Findings
1. **Reorder (move up/down) icon buttons had no `accessibilityRole` or `accessibilityLabel` (P3 — fixed).** Two bare `Pressable`s with only a rotated chevron `KISIcon` child — a screen-reader user had no way to know what these controls did or that they were buttons at all.
2. **No way to delete a question, or an entire quiz, once created (P2 — documented, not fixed).** Unlike `ContentEditor` (which supports deleting both lessons and materials) and `CourseBuilderScreen`'s curriculum tab (which supports deleting module items), this editor only supports *creating* and *reordering* questions/quizzes — there is no delete action anywhere in the file for either a `question` or an `assessment`. A provider who adds a wrong or duplicate question has no way to remove it short of leaving it in the quiz permanently. This is a real content-management gap and inconsistent with the rest of the course-builder suite's capabilities, but adding a correctly-scoped delete (with the same "does this cascade to learner answers/scores already submitted" care the rest of this batch shows for destructive actions) is more than a mechanical safe fix — it needs a real decision about whether deleting a question after learners have answered it should be allowed at all.
3. **Good: short-answer/essay questions are clearly labeled as manually-graded** ("Free-text answer — graded manually" / "No answer options — learners type a free-text response you grade manually"), setting correct provider expectations up front.

### Fixes implemented
- Added `accessibilityRole="button"` and `accessibilityLabel` ("Move question up" / "Move question down") to both reorder `Pressable`s, plus `hitSlop={8}` for a slightly larger effective tap target.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only.

**Status:** AUDITED-FIXED (one P3 fixed; the P2 missing-delete gap documented for a follow-up pass that includes a product decision on cascading effects)

---

## LiveEditor (`src/screens/education/provider/course-builder/LiveEditor.tsx`)
**Entry point:** Not a route — rendered inside `CourseBuilderScreen`'s "Live" tab.
**Criteria evaluated:** destructive-action confirmation (explicit audit focus), forms/validation, journey integration (schedule → manage a live class).
**Not applicable:** visual-design criteria (intentionally unstyled by prior design decision, not restyled here).

### Findings
1. **"Cancel session" had no confirmation at all (P1 — the clearest missing-confirmation gap in this batch, fixed).** `cancelSession` fired the `PATCH …{status:'cancelled'}` request directly from the button's `onPress`, with no `Alert`, no "are you sure," nothing — a single mis-tap permanently cancels a scheduled live class that enrolled learners are expecting to attend, with no undo path shown anywhere in this file (there's no "reschedule"/"uncancel" action). This is precisely the class of action the audit brief named explicitly ("withdrawing from a course, deleting course content") and it's also the single most consequential action in this file: it directly affects other people's calendars, not just the provider's own draft content.
2. **Good: the "Class group chat" affordance is well-explained** — the copy correctly tells the instructor they are not time-gated to the join window the way students are, preventing confusion about why the button looks the same but behaves differently for them.
3. **Good: date/time entry via day/duration presets instead of a raw text field** is a deliberate, well-reasoned choice documented in the file's own header comment (avoids malformed-date parsing, no new picker dependency) — appropriate given the editor's intentionally-minimal visual treatment.

### Fixes implemented
- Wrapped `cancelSession` in an `Alert.alert` confirmation (`"Cancel this session?"` / `"\"{title}\" will be marked cancelled. Enrolled learners will no longer see it as scheduled."`) with a `destructive`-styled confirm button, matching the confirmation pattern already used correctly elsewhere in this same course-builder suite (`ContentEditor`'s delete actions, `CourseBuilderScreen`'s delete-module-item). No change to the request payload or endpoint — purely an added confirmation gate before the existing `patchRequest` call.

### Verification
`npm run typecheck` — no errors. `eslint` — 0 errors, pre-existing inline-style warnings only (one incidental `@typescript-eslint/no-shadow` warning introduced by an early draft of this fix — a `title` parameter shadowing the outer `title` state — was caught and renamed to `sessionTitle` before finalizing).

**Status:** AUDITED-FIXED

---

## MaterialViewer (`src/screens/education/shared/MaterialViewer.tsx`)
**Entry point:** Not a route — shared component rendered by `LearningPlayerScreen` and `ContentEditor`'s material preview.
**Criteria evaluated:** access-gating, missing-content handling, unsupported-file-type fallback, loading states.
**Not applicable:** forms/validation, destructive actions, navigation (pure presentational viewer).

### Findings
1. **Good: every edge case has an explicit, labeled state instead of a blank view.** No access → clear "Enroll first" message; no resource URL → warning icon + "This material isn't available yet"; unsupported file type → filename + mime type + an explicit "doesn't have an in-app preview yet — use Open to view it" rather than a silent dead end or a confusing blank box. This is a well-built component with no gaps found.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## components.tsx (`src/screens/education/shared/components.tsx`)
**Entry point:** Not a route — the shared premium component kit (`EducationScreenScaffold`, `EducationWorkspaceHeader`, `EducationSectionCard`, `EducationMetricTile`, `EducationStatusBadge`, `EducationActionButton`, `EducationListCard`, `EducationEmptyState`, `EducationTimelineItem`) used across nearly every other file in this batch.
**Criteria evaluated:** design-system consistency against `src/theme/constants.ts`, color/contrast, touch targets, reusability/consistency.
**Not applicable:** forms, navigation, destructive actions (pure presentational primitives).

### Findings
1. **Good: fully theme-token-driven, no hardcoded hex colors.** Every color reads from the `KISPalette` passed in as a prop (`palette.primarySoft`, `palette.goldBorder`, `palette.danger`, etc.) rather than literal hex values — the one domain-wide consistency property this audit checked for against `theme/constants.ts`, and it holds throughout this file.
2. **Good: `EducationActionButton` delegates to `KISButton`**, which means every button built from this kit automatically gets `KISButton`'s baseline accessibility (`accessibilityRole="button"`, label fallback to `title`) and its 48pt (`controlHeights.touch`) minimum height — the reason buttons built from this shared kit never showed up as touch-target findings anywhere else in this batch, only the bespoke bare `Text`/`Pressable` pills built outside it did.
3. **Minor: `EducationListCard`'s whole-card `onPress` and `EducationSectionCard`'s whole-card `onPress` don't set `accessibilityRole="button"` on the wrapping `Pressable` (P3).** Since these cards always contain their own `Text` content, a screen reader still reads something, but doesn't announce the "button"/tappable trait on the whole-card region distinct from its explicit action buttons.

### Fixes implemented
None — finding 3 is minor and touches a shared component used by nearly every screen in this batch; a change here has a wide blast radius for a small accessibility gain, so it's flagged for a deliberate follow-up rather than patched reflexively in this pass.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## courseGroupChat.ts (`src/screens/education/shared/courseGroupChat.ts`)
**Entry point:** Not a route — shared helper used by `LearningPlayerScreen` and `LiveEditor` to find-or-create a course's group chat.
**Criteria evaluated:** silent-error-swallowing (explicit audit focus — this file is pure async logic with no UI of its own, so this is the only applicable criterion), error-handling design.
**Not applicable:** every visual/UX criterion (no UI).

### Findings
1. **`joinCourseGroupChat`'s swallowed failure is correctly intentional, not a bug (no fix needed).** The `try/catch` around the self-join `postRequest` is explicitly commented as "Non-fatal — worst case they can still open the chat/call if the group is otherwise accessible to them," and both call sites (`LearningPlayerScreen.openGroupChat`, implicitly) still separately check whether the group/conversation itself was found before opening the chat UI — so a join failure degrades gracefully rather than blocking or silently failing the whole feature. This is a deliberate, well-reasoned exception to "never swallow errors silently," not an instance of the anti-pattern.
2. **Good: `getOrCreateCourseGroupChat`'s own failure path is not silent** — it returns `null` on an unrecoverable failure, and every caller (`LearningPlayerScreen`, `LiveEditor`) correctly checks for `null` and shows `Alert.alert('Group chat', 'Unable to open the group chat right now.')` before giving up.

### Fixes implemented
None — this file is already correctly designed.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES
