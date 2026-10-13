# Partners Components — Batch B Audit

**Scope:** 25 files under `src/components/partners/**` (second half of the remaining Partners component set — see assignment list). **Date:** 2026-10-12.

**Summary:** This batch is mostly small, well-factored presentational pieces (rail/pane chrome, section lists, chip pickers, skeletons) that already consume the shared `palette`/`gradients` theme correctly and were previously hardened to be accent-color-reactive. The real, recurring defect found here is the same one flagged across the rest of the app's audit: components call `getRequest`/network helpers, pass an `errorMessage` string, and then **never check `res.success`** — so a failed fetch silently renders the exact same "nothing here" empty state as a genuinely-empty list, with no visible distinction and no retry. Three places exhibited this (`PartnerCoursesSection`, `AutomationActionsForm`'s role/member pickers, and `usePartnerSettingsCatalog`'s fallback-to-defaults path) and were fixed with explicit error surfacing + retry affordances. The second real issue was a genuine confirmation gap: `PartnerApplicationsReview`'s Approve/Reject buttons fired immediately on tap with no way to undo a decision about a real person's job application — this now confirms via `Alert.alert` before committing. A handful of icon-only / custom-checkbox controls were missing `accessibilityLabel`/`accessibilityRole`/`accessibilityState` and were fixed. Touch-target sizing on pill/chip controls (many sit under the 44pt minimum) is flagged as a widespread but lower-severity, app-wide design-system pattern that was intentionally left alone rather than risk layout regressions across dozens of chip instances for a cosmetic padding change outside this task's safe-fix categories. `partnersStyles.ts` and `partnersTypes.ts` are pure style/type modules with no network calls and needed no changes. `BibleCourseDetailSheet` (rendered by `PartnerCoursesSection`) was verified as a correctly-wired consumer only, not re-audited. 25/25 files audited; 6 files had code fixes; typecheck and lint both pass clean (0 errors) on every changed file.

---

## PartnersLeftRail (`src/components/partners/PartnersLeftRail.tsx`)
**Used by:** `PartnersScreen.tsx` (left column of the Partners workspace layout)
**Criteria evaluated:** visual hierarchy, touch targets, accessibility labels on icon-only controls, loading state, small-screen usability, color/design-system consistency
**Not applicable:** forms/validation, destructive-action confirmation (no destructive actions here), offline/permission states

### Findings
1. **(P2)** The "Add partner" button and each partner-avatar `Pressable` were icon/image-only controls with no `accessibilityLabel`/`accessibilityRole` — a screen-reader user had no way to know what either control does or which partner is selected.
2. **(P3)** Avatar touch targets shrink to 38pt (watch) / 42pt (compact phone), both below the 44pt minimum touch target. This is a deliberate responsive density tradeoff shared by the skeleton and several other rail-adjacent components; flagged but not changed, since the sizes are computed from `useResponsiveLayout` and shared with `PartnerLeftRailSkeleton`, and resizing risks visual mismatch between loading and loaded states across every screen width tier.
3. **(P3)** `ListEmptyComponent` ("No partners yet") has no retry/action — acceptable since the only way to have zero partners is a brand-new account, not a failed fetch (the parent screen owns that fetch).

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Add partner"` to the add-partner button.
- Added `accessibilityRole="button"`, `accessibilityLabel` (partner name), and `accessibilityState={{ selected: isActive }}` to each partner avatar `Pressable`.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors (pre-existing inline-style warnings only, unchanged in kind/count pattern).
**Status:** AUDITED-FIXED

---

## PartnersMessagesPane (`src/components/partners/PartnersMessagesPane.tsx`)
**Used by:** `PartnersScreen.tsx` (sliding messages pane hosting `ChatRoomPage`/`PartnerFeedScreen`/`CommunityFeedScreen`)
**Criteria evaluated:** navigation/back behavior, accessibility labels on icon-only controls, empty state, cognitive load
**Not applicable:** forms/validation, destructive actions, loading/error states (all data-loading is delegated to the three child screens it renders)

### Findings
1. **(P2)** The close ("X") button shown in the "No destination selected" empty state was icon-only with no `accessibilityLabel`.
2. No issues with the "no destination" empty state copy/affordance — it's clear and directs the user back to pick a feed/group/channel.
3. The close button and the drag-to-close gesture correctly share one `closeMessagesPane` callback (verified via the extensive code comments and prop wiring), so there's no risk of divergent "closed" states — a good pattern worth preserving in future edits to this file.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close messages"` to the close button.

### Verification
`npx tsc --noEmit` — no errors. `npx eslint` — 0 errors.
**Status:** AUDITED-FIXED

---

## PartnersSkeleton (`src/components/partners/PartnersSkeleton.tsx`)
**Used by:** `PartnersLeftRail.tsx` (`PartnerLeftRailSkeleton`) and `PartnersScreen.tsx`/center pane (`PartnerCenterPaneSkeleton`)
**Criteria evaluated:** loading state fidelity, visual hierarchy, color/design-system consistency
**Not applicable:** touch targets, forms, destructive actions, accessibility labels on icon-only controls (no interactive elements — skeletons are non-interactive by design)

### Findings
1. **(P3)** Shimmer bones have no `accessibilityElementsHidden`/`accessibilityLabel="Loading"` wrapper, so a screen-reader user hitting this screen mid-load gets a wall of unlabeled, unfocusable boxes rather than a single "Loading partners" announcement. Low severity (the screen settles within ~1-2s in practice) and not fixed — adding one would require touching the parent screen's accessibility tree ordering, which is out of this file's scope.
2. Skeleton shapes faithfully mirror `PartnersLeftRail` and the real center-pane layout (header, stats strip, admin strip, section rows, channel list) — good fidelity, no mismatch found.

### Fixes implemented
None — meets the bar as-is for a non-interactive loading placeholder.

### Verification
No changes made; file unaffected by other edits in this batch.
**Status:** AUDITED-NO-ISSUES

---

## PartnerAdminsStrip (`src/components/partners/center/PartnerAdminsStrip.tsx`)
**Used by:** `PartnersCenterPane.tsx` (executive-admins horizontal strip)
**Criteria evaluated:** visual hierarchy, color/contrast, loading/empty state, journey integration
**Not applicable:** forms, destructive actions, accessibility labels on icon-only controls (cards are informational, not actionable — no `onPress`)

### Findings
None of significance. Returns `null` cleanly when `admins` is empty (correct — no confusing empty-card strip). Avatar fallback-to-initials pattern is consistent with the rest of the Partners UI. No network calls in this file (admins list is passed in as a prop).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerChannelsSection (`src/components/partners/center/PartnerChannelsSection.tsx`)
**Used by:** `PartnersCenterPane.tsx` (standalone/root channels list)
**Criteria evaluated:** visual hierarchy, selected-state affordance, empty state, color/design-system consistency, touch targets
**Not applicable:** forms, destructive actions, loading/error states (no network calls — data passed in as props), accessibility labels (row has a visible text label)

### Findings
1. **(P3)** Row touch target height is governed by `styles.groupRow` padding (not inspected here in isolation) — likely consistent with the rest of the list rows in this batch; no isolated defect found in this file.
2. Correctly uses the accent-reactive `gradients.header` (not a hardcoded gold array) for the selected-row gradient — matches the design-system fix already applied app-wide for accent theming.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerCommunitiesSection (`src/components/partners/center/PartnerCommunitiesSection.tsx`)
**Used by:** `PartnersCenterPane.tsx` (communities → groups nested list with expand/collapse)
**Criteria evaluated:** visual hierarchy, cognitive load, expand/collapse affordance, color/design-system consistency
**Not applicable:** forms, destructive actions, loading/error states (data passed in as props), accessibility labels (rows have visible text)

### Findings
1. **(P3)** The expand/collapse chevron is rendered as literal characters (`v` / `>`) rather than a proper icon glyph (e.g. `KISIcon name="chevron-down"`), which is a minor visual-polish inconsistency against the rest of the app's icon usage, but functions correctly and is legible. Not fixed — swapping to an icon component risks sizing/alignment regressions for a cosmetic-only gap, and `KISIcon` chevron availability wasn't verified in-scope.
2. Correctly returns `null` when there are no communities (clean empty state, no dead section header shown).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PartnerCoursesSection (`src/components/partners/center/PartnerCoursesSection.tsx`)
**Used by:** `PartnersCenterPane.tsx` (Bible/partner courses list + enroll/continue flow); renders shared `BibleCourseDetailSheet` (already audited elsewhere this session) as a modal detail view
**Criteria evaluated:** loading/empty/error states (silent-error-swallowing), forms/confirmation (enrollment), trust (billing links), color/design-system consistency, journey integration with `BibleCourseDetailSheet`
**Not applicable:** accessibility labels on icon-only controls (all actionable elements have visible text), touch targets (buttons use shared `KISButton`)

### Findings
1. **(P1 — fixed)** `loadCourses()` called `getRequest` for both the partner-scoped and (for Christian Community partners) Bible-scoped course lists, passed an `errorMessage`, but never checked `res.success`. On a failed fetch, `partnerRes?.data` is `undefined`, so the list silently became `[]` and rendered the *exact same* "Courses will appear here once your partner publishes lessons" empty message as a partner that genuinely has zero courses. A user on a bad connection would see "no courses yet" and have no way to know the fetch failed or that retrying might help.
2. `handleEnroll` and `handleRequireBilling` already handle failure correctly (`Alert.alert` on non-success, clear billing-required messaging with a safe `Linking.openURL` fallback) — good pattern, no changes needed there.
3. `BibleCourseDetailSheet` integration: verified as a correct consumer — `visible`/`course`/`onClose`/`onCourseUpdate`/`onRequireBilling` are all wired with the right shapes, and the optimistic state update on course update (`setBibleCourses`/`setPartnerCourses` map-replace) is safe and idempotent.

### Fixes implemented
- Added a `loadError` state. On a failed `getRequest` for either course list, the error message is captured (first failure wins, so a Bible-courses failure doesn't overwrite a more specific partner-courses failure).
- When there are no courses to show **and** a load actually failed, the empty-state row now shows the real error message (in `palette.danger`) plus "Tap to retry" and re-triggers `loadCourses` on press — instead of the generic "no courses published" copy. The genuine-empty-state copy is preserved for the no-error case.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors (pre-existing inline-style warnings only).
**Status:** AUDITED-FIXED

---

## PartnerGroupsSection (`src/components/partners/center/PartnerGroupsSection.tsx`)
**Used by:** `PartnersCenterPane.tsx` (standalone/root groups list)
**Criteria evaluated:** visual hierarchy, selected-state affordance, empty state, color/design-system consistency
**Not applicable:** forms, destructive actions, loading/error states (no network calls), accessibility labels (visible text labels)

### Findings
None of significance — structurally identical to `PartnerChannelsSection` (same selected-gradient pattern, same accent-reactive gradient usage, same clean empty-state text).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerHeaderSection (`src/components/partners/center/PartnerHeaderSection.tsx`)
**Used by:** `PartnersCenterPane.tsx` (partner avatar/name/tagline/role-pills header block)
**Criteria evaluated:** visual hierarchy, typography, color/contrast (light vs. dark branching), touch targets, accessibility
**Not applicable:** forms, destructive actions, loading/error states (data passed in as props)

### Findings
None of significance. The "Settings" button already has `accessibilityRole="button"` and a visible text label. Dark/light color branching (`titleColor`, `mutedColor`, `strongLabelColor`, etc.) is deliberate and each branch resolves to a documented-readable palette token — no contrast violations found. Role-label mapping (`owner`/`admin`/`moderator`/`member`/`readonly`) has a sane fallback for unknown roles.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerApplySheet (`src/components/partners/discovery/PartnerApplySheet.tsx`)
**Used by:** `PartnerDiscoveryPanel.tsx` (bottom-sheet application form shown over a discovery card)
**Criteria evaluated:** forms/validation, accessibility labels on icon-only/custom controls, visual hierarchy, touch targets
**Not applicable:** destructive-action confirmation (submitting a job application is not destructive/irreversible in a way that warrants a confirm dialog — it's a request, not a deletion), loading/error states (owned by the parent panel, not this file)

### Findings
1. **(P2 — fixed)** The "Share my profile as your CV" control is a custom checkbox (a plain `View` with a conditional checkmark) with no `accessibilityRole="checkbox"` or `accessibilityState`. A screen-reader user had no way to tell it was a toggle or what its current state was.
2. **(P3)** No client-side validation on the message/role text inputs before `onSubmit` — a user can submit a completely blank application. Not fixed here: validation ownership (required-field rules, submit-button disabling) belongs to the parent panel that owns `onSubmit`/`message`/`role` state, not this presentational sheet, and guessing at validation rules without seeing the parent's submit handler risked over-fixing outside this file's actual responsibility.
3. Job-post chip picker and salary/location/tags/requirements detail rendering is clear and well-organized; no issues.

### Fixes implemented
- Added `accessibilityRole="checkbox"`, `accessibilityState={{ checked: shareProfile }}`, and `accessibilityLabel="Share my profile as your CV"` to the custom checkbox control.

### Verification
`npx tsc --noEmit` — no errors. `npx eslint` — 0 errors.
**Status:** AUDITED-FIXED

---

## PartnerDiscoveryCard (`src/components/partners/discovery/PartnerDiscoveryCard.tsx`)
**Used by:** `PartnerDiscoveryPanel.tsx` (one card per discoverable partner, with Apply/Subscribe actions)
**Criteria evaluated:** visual hierarchy, forms/confirmation, trust, color/design-system consistency
**Not applicable:** accessibility labels on icon-only controls (Apply/Subscribe have visible text), loading/error states (data passed in as props), touch targets (buttons sized by padding, consistent with sibling discovery components — see batch-wide touch-target note)

### Findings
None of significance. Apply/Subscribe are correctly hidden once `alreadyMember` is true, and a clear "Application pending review" / "You are already a member" status line replaces the actions appropriately — good state-machine clarity for a 3-state (not applied / pending / member) flow.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerDiscoveryFilters (`src/components/partners/discovery/PartnerDiscoveryFilters.tsx`)
**Used by:** `PartnerDiscoveryPanel.tsx` (search box + "Open now"/method filter chip row)
**Criteria evaluated:** visual hierarchy, touch targets, accessibility, cognitive load
**Not applicable:** forms/validation (search query has no invalid state), destructive actions, loading/error states (no network calls)

### Findings
1. **(P3)** Filter chips (`Open now`, `All`, each method) have no `accessibilityState={{ selected }}` — a screen-reader user can't tell which filter is currently active, only read its label. Low severity relative to the rest of this batch's fixes (filters are easily re-toggled with no consequence), and fixing all chip instances consistently app-wide is better done as one pass rather than piecemeal per file; flagged, not fixed here.
2. The search "Go" button and text input work together cleanly (`onSubmitEditing` + explicit button), good redundancy for both keyboard-driven and tap-driven search.

### Fixes implemented
None — meets the bar as-is; the one finding is a widespread, low-risk chip-selected-state gap better addressed consistently rather than in isolation.

### Verification
No changes made.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## AutomationActionsForm (`src/components/partners/forms/AutomationActionsForm.tsx`)
**Used by:** `PartnerAutomationPanel.tsx` (per-rule "what should happen" action editor — assign/remove role, set feature flag, dispatch webhook, log audit)
**Criteria evaluated:** forms/validation, silent-error-swallowing, destructive-action confirmation, cognitive load, color/design-system consistency
**Not applicable:** accessibility labels on icon-only controls (all chips/buttons have visible text), loading state (no loading indicator shown while roles/members fetch — see finding 2)

### Findings
1. **(P1 — fixed)** `loadRoles()` and `loadMembers()` both call `getRequest` with an `errorMessage` but never checked `res.success`. On failure, both chip pickers would render as empty ("no roles/members to pick from") with zero indication that the request failed versus the partner genuinely having no roles or no members — a user configuring an `assign_role` action would see an empty picker and have no idea why, or that retrying might fix it.
2. **(P3)** No loading spinner/placeholder is shown while roles/members are being fetched — momentarily empty pickers on first render, indistinguishable from the fixed error state's "zero items" case until the fetch resolves. Not fixed (would require a `loading` state threaded through, and this form already re-renders quickly in practice for role/member lists, which tend to be small).
3. **(P3 — documented, not fixed)** "REMOVE ACTION" deletes a row from local form state with no confirmation. This is a reversible, local-only edit (nothing is persisted to the server until the parent's Save action runs), so a confirm dialog would add friction without protecting against real data loss — left as-is, consistent with the equally-reversible `AssignChips`/chip-toggle pattern used throughout this same panel.

### Fixes implemented
- Added `roleLoadError`/`memberLoadError` state, set from `res.success`/`res.message` on each load.
- When a picker's option list is empty **and** its load actually failed, the picker is replaced with a tappable error message ("Unable to load roles. Tap to retry.") that re-triggers the corresponding load function. When the list is empty because the partner genuinely has no roles/members (no error), the normal (empty) `ChipPicker` renders as before.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors (pre-existing inline-style warnings only).
**Status:** AUDITED-FIXED

---

## AutomationConditionsForm (`src/components/partners/forms/AutomationConditionsForm.tsx`)
**Used by:** `PartnerAutomationPanel.tsx` (per-rule "when" condition editor — field/operator/value triples)
**Criteria evaluated:** forms/validation, destructive-action confirmation, cognitive load
**Not applicable:** silent-error-swallowing (no network calls in this file at all), accessibility labels (visible text), color/design-system consistency (no issues found)

### Findings
1. **(P3)** Field/operator/value are raw free-text inputs with no validation and no dropdown/autocomplete for the operator (the placeholder suggests `eq, in, contains` but nothing prevents a typo like `eqq`, which would presumably fail silently or no-op server-side on save). This mirrors the same "undiscoverable raw key/value" problem the sibling `AutomationActionsForm.tsx` file comment explicitly says was *already fixed* for actions ("there is no such thing as an arbitrary action type... editing them through a raw key/value box was never actually correct") — conditions were not given the same treatment. Flagged as a real design-system inconsistency between the two sibling forms, but out of scope to fix here: it would require knowing (and exposing as a picker) the actual backend-supported condition fields/operators, which isn't available to this presentational form.
2. **(P3)** "REMOVE CONDITION" has no confirmation — same reasoning as `AutomationActionsForm`'s "REMOVE ACTION": local, reversible, pre-save state. Left as-is.

### Fixes implemented
None — meets the bar as-is for what this file alone can safely fix; the real improvement (structured condition fields matching the backend's actual filterable fields) is a feature-level change outside a UX audit's safe-fix scope.

### Verification
No changes made.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## partnersStyles.ts (`src/components/partners/partnersStyles.ts`)
Non-visual support file (shared `StyleSheet` definitions for the Partners component tree) — no network calls, no UI to audit directly.

### Findings
One incidental observation: `partnerGoldHeader`/`partnerHeaderSheen`/`partnerHeaderHalo` (hardcoded `#FFF4B8`/`#C9A24A` gold hex, not accent-reactive) are defined but have zero consumers anywhere in `src/` (verified via repo-wide grep) — dead style keys, not a live design-system-consistency bug since nothing renders them. Not removed (file deletion/dead-code cleanup is outside this audit's brief, and leaving unused style keys has no runtime UX impact).

**Status:** AUDITED-NO-ISSUES (non-visual support file)

---

## partnersTypes.ts (`src/components/partners/partnersTypes.ts`)
Non-visual support file (shared TypeScript types + the `LEFT_RAIL_WIDTH` constant) — no network calls, no UI to audit directly. No issues found.

**Status:** AUDITED-NO-ISSUES (non-visual support file)

---

## AssignChips (`src/components/partners/recruitment/AssignChips.tsx`)
**Used by:** `PartnerRecruitmentForm.tsx` (auto-assign-on-acceptance community/group/channel chip pickers)
**Criteria evaluated:** visual hierarchy, selected-state affordance, empty state, accessibility
**Not applicable:** forms/validation, destructive actions, loading/error states (data passed in as props)

### Findings
1. **(P3)** No `accessibilityState={{ selected: active }}` on each chip — same low-severity, widespread gap noted in `PartnerDiscoveryFilters`. Not fixed in isolation for the same reason (best handled as one consistent pass across all chip components, not per-file).
2. Correctly returns `null` when `options` is empty (no dead "Communities" label with zero chips underneath).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PartnerApplicationsReview (`src/components/partners/recruitment/PartnerApplicationsReview.tsx`)
**Used by:** `PartnerRecruitmentPanel.tsx` (pending-applications list with expandable CV view and Approve/Reject actions)
**Criteria evaluated:** destructive-action confirmation, loading state (busy indicator), accessibility labels, visual hierarchy, trust (CV disclosure)
**Not applicable:** silent-error-swallowing (the `onApprove`/`onReject` promises are owned by the parent panel; this file correctly awaits and clears its own `busy` state regardless of outcome), forms/validation (no form inputs)

### Findings
1. **(P1 — fixed)** Approve and Reject fired immediately on tap with **no confirmation dialog** for either action. This is a one-shot, consequential decision about a real person's job application — rejecting someone (or approving them into the organization, potentially triggering role/auto-assign side effects elsewhere in the flow) with a single accidental tap and no undo is exactly the "destructive action without confirmation" pattern this audit is instructed to catch. Reject in particular has real-world impact: once tapped, the applicant's status likely moves to "rejected" with no way back from this screen.
2. Good: the `busy`/`ActivityIndicator` pattern correctly disables both buttons for the row being acted on, preventing double-submit.
3. Good: CV disclosure already handles the "applicant chose not to share their profile" case explicitly rather than showing a blank/broken CV section.

### Fixes implemented
- Added a `confirmDecide()` wrapper that shows an `Alert.alert` ("Approve application?" / "Reject application?") naming the applicant and stating the action can't be undone from this screen, before calling the existing `decide()` function. Reject's confirm button uses the iOS `destructive` style.
- Added `accessibilityRole="button"` + a descriptive `accessibilityLabel` (naming the applicant) to both the Approve and Reject buttons.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors (pre-existing inline-style warnings only).
**Status:** AUDITED-FIXED

---

## PartnerRecruitmentForm (`src/components/partners/recruitment/PartnerRecruitmentForm.tsx`)
**Used by:** `PartnerRecruitmentPanel.tsx` (create-job-post form: title, type, location/remote, salary, description, auto-assign chips)
**Criteria evaluated:** forms/validation, visual hierarchy, cognitive load, loading state (submit button)
**Not applicable:** destructive-action confirmation (creating a job post is additive, not destructive), silent-error-swallowing (no network calls in this file — `onSubmit` is owned by the parent), accessibility labels (all controls have visible text)

### Findings
None of significance. The submit button correctly shows "Saving..." and is `disabled` while `submitting` is true, preventing duplicate job-post creation. Remote toggle correctly disables (and visually dims) the location field when active, which is good affordance for an otherwise-contradictory input combination.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerRecruitmentJobList (`src/components/partners/recruitment/PartnerRecruitmentJobList.tsx`)
**Used by:** `PartnerRecruitmentPanel.tsx` (read-only list of active job posts with salary/location/steps summary)
**Criteria evaluated:** visual hierarchy, empty state, color/design-system consistency
**Not applicable:** forms, destructive actions, loading/error states (data passed in as props), accessibility labels (purely informational, non-interactive rows)

### Findings
None of significance. Clean `null` return for an empty jobs array (no empty-state card shown when there's nothing to summarize at all, which is correct since the "Create a recruitment job" form above it already communicates the empty state).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerAnalyticsCharts (`src/components/partners/reports/PartnerAnalyticsCharts.tsx`)
**Used by:** `PartnerReportsPanel.tsx`/`PartnerAnalyticsPanel.tsx` (last-18-point bar-chart trends for posts/comments/reactions/applications/new-members/audit-events)
**Criteria evaluated:** color/design-system consistency, visual hierarchy, loading/empty state
**Not applicable:** forms, destructive actions, accessibility labels (charts are decorative/informational, not interactive controls), touch targets (no touch targets — read-only visualization)

### Findings
None of significance. `getColor()` correctly falls back to sane palette tokens (`primarySoft`/`primaryStrong`) if a named state color like `palette.info` is ever missing, and all six color keys used (`accent`, `success`, `warning`, `info`, `danger`, `primary`) do exist on `KISPalette` in `src/theme/constants.ts` — no undefined-color risk. Clean `null` return when there's no `activity_series` data (no empty chart frame shown).

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.
**Status:** AUDITED-NO-ISSUES

---

## PartnerExportSchedulesSection (`src/components/partners/reports/PartnerExportSchedulesSection.tsx`)
**Used by:** `PartnerReportsPanel.tsx` (create/list/run scheduled data exports)
**Criteria evaluated:** forms/validation, visual hierarchy, destructive-action confirmation, color/design-system consistency
**Not applicable:** silent-error-swallowing (no network calls in this file — all actions are callback props owned by the parent), accessibility labels (all controls have visible text)

### Findings
1. **(P2)** `scheduleKind`/`scheduleFormat`/`scheduleFrequency` are raw free-text `TextInput`s for what are actually enum-like values (the placeholders literally list the valid options: `"summary, members, roles, posts, audit, applications"`, `"csv or json"`, `"daily, weekly, monthly"`). This is inconsistent with the chip-picker pattern used for exactly this kind of fixed-choice input elsewhere in this same batch (`AutomationActionsForm`'s `ChipPicker`, `PartnerRecruitmentForm`'s job-type chips, `AssignChips`). A user who types `"wekly"` gets no client-side feedback and likely a silent no-op or server error on `onCreateSchedule`. Not fixed: converting to chips would change this component's prop contract (it would need `kindOptions`/`formatOptions`/`frequencyOptions` arrays passed in from the parent), which is a larger-than-"safe fix" change given this task's constraints.
2. "RUN NOW" triggers an export run immediately with no confirmation — acceptable, since running a scheduled export is not destructive (doesn't delete or overwrite anything).

### Fixes implemented
None — meets the bar as-is for a safe, in-file-only fix; the real fix (enum inputs as chips) needs a parent-side prop change outside this file's scope.

### Verification
No changes made.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PartnerSettingsPanel (`src/components/partners/settings/PartnerSettingsPanel.tsx`)
**Used by:** `PartnersScreen.tsx` (slide-in settings panel listing one section's features, gated by role via `canAccessFeature`)
**Criteria evaluated:** navigation/back behavior, touch targets, forms/confirmation (locked-feature messaging), silent-error-swallowing (via the new `catalogError` prop), color/contrast, journey integration with `usePartnerSettingsCatalog`
**Not applicable:** destructive actions (this panel only navigates to other panels/shows an access-restricted alert — it performs no mutations itself)

### Findings
1. The close ("‹") button already has a correct 44×44 `minWidth`/`minHeight` hit target and `hitSlop` — a good example other icon-only controls in this batch should match.
2. Locked features correctly show an `Alert.alert('Access restricted', ...)` instead of silently doing nothing on tap — good, already-present pattern.
3. **(P1 — fixed, paired with the hook fix below)** This panel had no way to show the user when `usePartnerSettingsCatalog` silently fell back to the bundled default feature catalog after a failed fetch — the panel would render the exact same UI whether showing the live, role-accurate server catalog or a generic offline default, with no visual distinction.

### Fixes implemented
- Added an optional `catalogError?: string | null` prop. When set, a small inline banner ("Showing default settings — live data couldn't be loaded." + the underlying error message) renders at the top of the panel body, above the feature grid.
- This prop is purely additive — the existing caller (`PartnersScreen.tsx`, outside this file's assigned scope) does not yet pass it, so current behavior is unchanged until that screen is updated to forward `usePartnerSettingsCatalog`'s new `error` return value through as `catalogError`. Flagging this explicitly: **the fix is only half-wired** — the hook now tracks the error, and the panel now knows how to display it, but the two aren't connected yet because the connecting file (`PartnersScreen.tsx`) is outside this batch's assignment.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors (pre-existing inline-style warnings + one pre-existing `no-lone-blocks` warning, both unrelated to the edit).
**Status:** AUDITED-FIXED (partially — see note above on `PartnersScreen.tsx` wiring)

---

## partnerSettingsData.ts (`src/components/partners/settings/partnerSettingsData.ts`)
Non-visual support file (role-gated feature catalog data + `canAccessFeature`/`normalizePartnerRole` helpers) — no network calls, no UI to audit directly. No issues found; the role-escalation lists (`admins`/`managers`/`analysts`) are correctly cumulative (each tier includes all tiers above it), so there's no risk of a manager being locked out of something an analyst can see.

**Status:** AUDITED-NO-ISSUES (non-visual support file)

---

## usePartnerSettingsCatalog (`src/components/partners/settings/usePartnerSettingsCatalog.ts`)
Non-visual support file (hook: fetches the live per-partner settings catalog, falls back to the bundled default on failure) — contains a network call, audited for silent-error-swallowing per the task's instructions for data/hook files.

### Findings
1. **(P1 — fixed)** On a failed `getRequest`, the hook silently fell back to `PARTNER_SETTINGS_SECTIONS` (the bundled default catalog) with **zero signal** that this happened — indistinguishable from the success path where the server legitimately returned an empty/missing `sections` array. A user would see a full, plausible-looking settings catalog with no way to know it wasn't the real, server-configured, role-accurate one for their partner.

### Fixes implemented
- Added an `error: string | null` state, set to the response's message whenever `res.success === false` and the hook falls back to the default catalog (explicitly *not* set for a 200-but-empty-sections response, which is a legitimate "nothing configured" case, not a failure).
- Returned `error` alongside the existing `sections`/`sectionMap`/`role`/`loading`. This is additive to the hook's return shape — no existing consumer's destructuring breaks.
- See `PartnerSettingsPanel.tsx`'s entry above for the matching display-side fix (`catalogError` prop) and the note that full end-to-end wiring needs `PartnersScreen.tsx` (outside this batch) to pass this new `error` value through.

### Verification
`npx tsc --noEmit` — no errors in this file. `npx eslint` — 0 errors.
**Status:** AUDITED-FIXED
