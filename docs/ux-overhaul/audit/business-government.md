# Business & Government Domain Audit

**Scope:** `src/screens/business/**` (13 files) and `src/screens/government/**` (12 files) — 25 files total.
**Audited:** 23 of 25 (2 files — `JobsScreen.tsx` and `MyApplicationsScreen.tsx` — were already deleted earlier this session as confirmed-dead code; see one-line notes below).

**Summary:** This batch surfaced a systemic, severe bug class in the government domain: **every write action across 9 of 12 government screens called `postRequest`/`getRequest` without checking the `success` flag on the response.** Because those helpers resolve (never throw) on a failed request, every one of these handlers treated a rejected vote, petition signature, grant application, compliance deadline, diaspora join, or anonymous whistleblower report as a success — updating local state and showing a success message even when nothing was saved server-side. This is the exact "fabricate success on failure" anti-pattern already found and fixed elsewhere in this codebase (e.g. `EmergencyDispatchManager.tsx`), but it was present in essentially the entire write surface of the government domain, most seriously in the anonymous Whistleblower report flow. All 11 instances across 9 files were fixed. The business domain, by contrast, was already written defensively (all its write paths check `res.success`) and needed no correctness fixes — only consistency/accessibility polish. A second cross-cutting finding, documented but not fixed (out of the authorized "safe fix" categories), is that 11 of 12 government screens have no on-screen back button/header at all, unlike every business screen and unlike the government hub itself.

---

## Already-deleted files (no audit needed)

- `src/screens/business/JobsScreen.tsx` — confirmed dead, deleted earlier this session (superseded by `src/screens/jobs/JobsBoardScreen.tsx`, which the `JobsBoard` route now points to).
- `src/screens/business/MyApplicationsScreen.tsx` — confirmed dead, deleted earlier this session (superseded by `src/screens/jobs/MyApplicationsScreen.tsx`, which the `MyApplications` route now points to).

Note: `BusinessHubScreen`'s section grid still links to `JobsBoard` and `MyApplications` — these route names are live and correctly resolve to the replacement screens in `jobs/`, not to the deleted files. No dangling navigation.

---

## Business domain (11 files audited)

### BusinessHubScreen (`src/screens/business/BusinessHubScreen.tsx`)
**Entry point:** `BusinessHub` (tab/menu entry, `headerShown: false`)
**Criteria evaluated:** visual hierarchy, loading state, touch targets, journey integration, navigation
**Not applicable:** forms/validation (none), back behavior (hub/entry screen — no back affordance needed, same as `GovernmentHubScreen`), destructive actions (none)
### Findings
1. (P3) Dashboard fetch (`getRequest(ROUTES.business.dashboard)`) swallows errors into a silent `.catch(() => {})` and falls back to a generic tagline. This degrades gracefully rather than fabricating data, so it is not a correctness bug — just worth noting as the common "can't tell empty from failed" pattern repeated across most list/dashboard screens in this batch.
### Fixes implemented
none — meets the bar as-is.
### Verification
No changes made to this file; typecheck/lint not affected.
**Status:** AUDITED-NO-ISSUES

### CoWorkingScreen (`src/screens/business/CoWorkingScreen.tsx`)
**Entry point:** `CoWorkingSpaces`
**Criteria evaluated:** visual hierarchy, touch targets, accessibility labels, loading/empty states, filters, external links
**Not applicable:** destructive actions (none — read-only directory + `Linking.openURL`)
### Findings
1. (P3) Back button was icon-only with no `accessibilityLabel`/`accessibilityRole`. (Fixed.)
2. (P3) Unused `ScrollView` import (pre-existing lint error, unrelated to functionality). (Fixed.)
3. (P3) Failed fetch falls back to empty list with "No co-working spaces found" — indistinguishable from a genuinely empty result set.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Go back"` to the back button.
- Removed the unused `ScrollView` import.
### Verification
`npm run typecheck` clean; `npx eslint` — 0 errors (pre-existing inline-style warnings only).
**Status:** AUDITED-FIXED

### CreateCampaignScreen (`src/screens/business/CreateCampaignScreen.tsx`)
**Entry point:** `CreateCampaign`
**Criteria evaluated:** forms/validation, confirmations, loading, accessibility, touch targets
**Not applicable:** empty/offline states (single-purpose form), destructive actions (campaign creation is additive, not destructive)
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. Already correctly guards against the fabricate-success pattern — `handleCreate` throws on `!res?.success` before treating the campaign as created (fixed in an earlier pass, verified still correct).
### Fixes implemented
- Added accessibility label/role to the back button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### CrowdfundDetailScreen (`src/screens/business/CrowdfundDetailScreen.tsx`)
**Entry point:** `CrowdfundDetail`
**Criteria evaluated:** forms/validation, confirmations, loading/empty states, accessibility, progress visualization
**Not applicable:** n/a
### Findings
1. Verified via `git diff` context: the "Confirm Your Contribution" pre-submit `Alert.alert` (P1-1 fix from earlier this session) is present and correctly wraps `performContribute`. No further action needed on that front.
2. (P3) Two icon-only back buttons (not-found state + navBar) had no accessibility label. (Fixed.)
3. `performContribute` already correctly checks `res?.success || res?.id || res?.data?.id` before declaring success — no fabricate-success bug here.
### Fixes implemented
- Added accessibility label/role to both back buttons.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### CrowdfundScreen (`src/screens/business/CrowdfundScreen.tsx`)
**Entry point:** `Crowdfunding`
**Criteria evaluated:** visual hierarchy, filters, loading/empty states, accessibility, FAB affordance
**Not applicable:** forms (list screen only)
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. (P3) Failed fetch collapses to the same empty state as a genuinely empty category filter.
### Fixes implemented
- Added accessibility label/role to the back button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### ImpactReportScreen (`src/screens/business/ImpactReportScreen.tsx`)
**Entry point:** `BusinessImpactReport`
**Criteria evaluated:** forms, loading, tablet/responsive layout, accessibility
**Not applicable:** destructive actions (report generation is read-only/additive)
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. Responsive column count already correctly uses `layout.columns.dense` (fixed in an earlier pass) rather than a hardcoded `2`.
3. `handleGenerate` correctly branches on `data?.metrics` presence rather than assuming success — no fabricate-success bug.
### Fixes implemented
- Added accessibility label/role to the back button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### JobDetailScreen (`src/screens/business/JobDetailScreen.tsx`)
**Entry point:** `JobDetail`
**Criteria evaluated:** forms/validation, loading/empty states, accessibility, salary formatting, trust (Kingdom Certified badge)
**Not applicable:** confirmations (cover-letter requirement already provides submit friction; application is not destructive/irreversible in a way that needs an extra confirm step)
### Findings
1. (P3) Two icon-only back buttons (not-found state + navBar), no accessibility label. (Fixed.)
2. `handleApply` correctly checks `res?.success || res?.id || res?.data?.id` before declaring success — no fabricate-success bug.
### Fixes implemented
- Added accessibility label/role to both back buttons.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### KingdomCertificationScreen (`src/screens/business/KingdomCertificationScreen.tsx`)
**Entry point:** `KingdomCertification`
**Criteria evaluated:** forms, loading, trust/clarity (certification + verification badges), accessibility
**Not applicable:** destructive actions (application + verification lookup are both additive/read-only)
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. `handleVerify`'s dual-shape-response bug (treating a failed lookup as a confident "Not Certified" result) was already fixed in an earlier pass — verified still correct (`res?.success ? res?.data : null`).
### Fixes implemented
- Added accessibility label/role to the back button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### MentorshipScreen (`src/screens/business/MentorshipScreen.tsx`)
**Entry point:** `BusinessMentorship`
**Criteria evaluated:** tabs, confirmations, loading/empty states, accessibility
**Not applicable:** forms (match request has no free-text input)
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. `handleRequestMatch` already wraps the match request in a confirmation `Alert.alert` and correctly checks `res?.success || res?.id || res?.data` before declaring success.
### Fixes implemented
- Added accessibility label/role to the back button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### SavingsGroupDetailScreen (`src/screens/business/SavingsGroupDetailScreen.tsx`)
**Entry point:** `SavingsGroupDetail`
**Criteria evaluated:** visual hierarchy, loading/empty states, accessibility, payout-order clarity
**Not applicable:** forms/confirmations (read-only detail view — joining happens on the list screen)
### Findings
1. (P3) Two icon-only back buttons (not-found state + navBar), no accessibility label. (Fixed.)
2. (P3) Unused `FlatList` import (pre-existing lint error). (Fixed.)
### Fixes implemented
- Added accessibility label/role to both back buttons.
- Removed the unused `FlatList` import.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### SavingsGroupsScreen (`src/screens/business/SavingsGroupsScreen.tsx`)
**Entry point:** `SavingsGroups`
**Criteria evaluated:** filters, confirmations, loading/empty states, accessibility
**Not applicable:** n/a
### Findings
1. (P3) Back button icon-only, no accessibility label. (Fixed.)
2. (P3) Unused `TYPE_COLORS` empty-object constant (pre-existing lint error, dead code). (Fixed.)
3. `handleJoin` already wraps joining in a confirmation `Alert.alert` and correctly checks `res?.success || res?.id || res?.data` before declaring success.
### Fixes implemented
- Added accessibility label/role to the back button.
- Removed the unused `TYPE_COLORS` constant.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

---

## Government domain (12 files audited)

### GovernmentHubScreen (`src/screens/government/GovernmentHubScreen.tsx`)
**Entry point:** `GovernmentHub` (tab/menu entry, `headerShown: false`)
**Criteria evaluated:** visual hierarchy, navigation, journey integration, data-fetching
**Not applicable:** forms, loading/error states, confirmations
### Findings
1. **Verified the carried-forward flag:** this screen genuinely has zero data-fetching — it is a static grid of 9 hardcoded `SECTION_CARDS` that only navigate to sub-screens. This is confirmed **not a gap**: it is a pure directory/menu screen (identical in kind to `BusinessHubScreen`'s section grid, minus the dashboard-tagline fetch), and every one of its 9 destination routes exists and is correctly wired in `App.tsx`. No backend data is needed to render a menu of fixed labels/icons/routes.
### Fixes implemented
none — meets the bar as-is.
### Verification
No changes made; not applicable.
**Status:** AUDITED-NO-ISSUES

### PetitionsScreen (`src/screens/government/PetitionsScreen.tsx`)
**Entry point:** `Petitions`
**Criteria evaluated:** filters, loading/empty states, forms-adjacent actions (sign), FAB, navigation/back behavior
**Not applicable:** n/a
### Findings
1. **(P1) Fabricate-success-on-failure:** `handleSign` called `postRequest(...)` and, because `postRequest` resolves (never throws) with `{success:false}` on a rejected request, unconditionally marked the petition as signed (`user_signed: true`, incremented `signature_count`) with no check of the response's `success` flag. A backend rejection (already-signed-elsewhere, closed petition, network failure) was silently presented to the user as a successful signature. (Fixed.)
2. (P2) No on-screen back button/header — relies entirely on OS gesture/hardware back. Inconsistent with every business-domain screen. (Documented, not fixed — see cross-cutting finding below.)
3. (P3) "Sign" is a single, un-confirmed tap with real-world civic consequence; `SavingsGroupsScreen.handleJoin` and `MentorshipScreen.handleRequestMatch` (similar weight) both show a pre-submit confirmation, but petition signing does not. Inconsistent, not critical.
### Fixes implemented
- `handleSign` now checks `res?.success` and throws (routing to the existing error `Alert.alert`) on failure instead of optimistically marking the petition signed.
### Verification
`npm run typecheck` clean; `npx eslint` 0 errors.
**Status:** AUDITED-FIXED

### PetitionDetailScreen (`src/screens/government/PetitionDetailScreen.tsx`)
**Entry point:** `PetitionDetail`
**Criteria evaluated:** forms, confirmations, sharing, loading/empty states, navigation/back behavior
**Not applicable:** n/a
### Findings
1. **(P1) Fabricate-success-on-failure:** same bug as `PetitionsScreen` — `handleSign` incremented `signature_count` and showed a "Success" alert unconditionally, regardless of the actual `postRequest` result. (Fixed.)
2. (P2) No on-screen back button/header at all — not even for the "Petition not found" error state. (Documented, not fixed.)
3. (P3) Pre-existing unused `STATUS_COLORS` empty-object constant (dead code, lint error). (Fixed.)
4. Fetch handler's dual-shape-response bug (treating the ApiResult wrapper itself as the petition record) was already fixed in an earlier pass — verified correct (`res?.success && res?.data ? res.data : null`).
### Fixes implemented
- `handleSign` now checks `res?.success` and throws on failure instead of optimistically recording a signature.
- Removed the unused `STATUS_COLORS` constant.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### CreatePetitionScreen (`src/screens/government/CreatePetitionScreen.tsx`)
**Entry point:** `CreatePetition`
**Criteria evaluated:** forms/validation, loading, navigation/back behavior
**Not applicable:** empty/offline states (single-purpose form)
### Findings
1. **(P1) Fabricate-success-on-failure:** `handleSubmit` called `postRequest(...)` and, ignoring the response's `success` flag, always showed "Petition Created" and navigated back — even when the backend rejected the submission. The creator would believe their petition is live when nothing was saved. (Fixed.)
2. (P2) No on-screen back/cancel button on this form — only the native back gesture. (Documented, not fixed.)
### Fixes implemented
- `handleSubmit` now checks `res?.success` and throws on failure, routing to the existing error alert instead of the false-success alert + navigation.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### CivicPollsScreen (`src/screens/government/CivicPollsScreen.tsx`)
**Entry point:** `CivicPolls`
**Criteria evaluated:** tabs, voting flow, results visualization, loading/empty states, navigation/back behavior
**Not applicable:** forms (single-choice selection, not free text)
### Findings
1. **(P1) Fabricate-success-on-failure:** `handleVote` applied its optimistic vote-count update (`user_vote`, `total_votes`, per-option `vote_count`) unconditionally after `await postRequest(...)`, without checking `success`. A rejected vote (already voted, poll closed server-side, network failure) was displayed to the user as "You voted: X" with no indication the write failed. This directly undermines trust in a civic-voting feature. (Fixed.)
2. (P2) No on-screen back button/header. (Documented, not fixed.)
### Fixes implemented
- `handleVote` now checks `res?.success` and throws on failure before applying the optimistic UI update, routing to the existing error alert.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### BoardGovernanceScreen (`src/screens/government/BoardGovernanceScreen.tsx`)
**Entry point:** `BoardGovernance`
**Criteria evaluated:** tabs (elections/resolutions), voting flow, results visualization, loading/empty states, navigation/back behavior
**Not applicable:** forms
### Findings
1. **(P1) Fabricate-success-on-failure:** `handleVote` marked the election `user_voted: true` and showed "Vote Recorded" unconditionally after `postRequest(...)`, with no `success` check. Same class of bug as `CivicPollsScreen`, applied to board elections — a rejected vote (already voted, election closed, network error) was confidently reported as cast. (Fixed.)
2. (P2) No on-screen back button/header. (Documented, not fixed.)
### Fixes implemented
- `handleVote` now checks `res?.success` and throws on failure before updating `user_voted` or showing the success alert.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### ComplianceTrackerScreen (`src/screens/government/ComplianceTrackerScreen.tsx`)
**Entry point:** `ComplianceTracker`
**Criteria evaluated:** filters, modal form, FAB, loading/empty states, accessibility, navigation/back behavior
**Not applicable:** n/a
### Findings
1. **(P1) Fabricate-success-on-failure + garbage data:** `handleAddDeadline` cast `apiResult?.data ?? apiResult` to `ComplianceItem` with no `success` check. On a rejected save, `apiResult.data` is `undefined`, so the code fell back to inserting the raw `{success: false, message: ...}` wrapper into the deadlines list as if it were a real compliance item, then silently closed the "Add Deadline" modal — presenting a corrupted row and implying success for a regulatory/legal deadline that was never actually saved. This is a business-critical risk: a missed compliance deadline due to a false "saved" state. (Fixed.)
2. (P3) Icon-only modal-close button had no accessibility label. (Fixed.)
3. (P2) No on-screen back button/header on the main list view. (Documented, not fixed.)
### Fixes implemented
- `handleAddDeadline` now checks `apiResult?.success && apiResult?.data` before inserting the new item, throwing on failure to route to the existing error alert.
- Added `accessibilityRole="button"` + `accessibilityLabel="Close add deadline"` to the modal close button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### DiasporaScreen (`src/screens/government/DiasporaScreen.tsx`)
**Entry point:** `DiasporaCommunities`
**Criteria evaluated:** filters, join flow, loading/empty states, navigation/back behavior
**Not applicable:** forms
### Findings
1. **(P2) Fabricate-success-on-failure:** `handleJoin` marked the community `is_member: true` and incremented `member_count` unconditionally, without checking `postRequest`'s `success` flag. A rejected join was shown as a successful membership with no error surfaced. (Fixed.)
2. (P2) No on-screen back button/header. (Documented, not fixed.)
### Fixes implemented
- `handleJoin` now checks `res?.success` and throws on failure before updating local membership state.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### LegalAidScreen (`src/screens/government/LegalAidScreen.tsx`)
**Entry point:** `LegalAid`
**Criteria evaluated:** filters, contact actions (`tel:`/`mailto:`), loading/empty states, navigation/back behavior
**Not applicable:** forms, destructive actions (purely a read-only directory)
### Findings
1. (P2) No on-screen back button/header. (Documented, not fixed.)
2. Read-only screen — no write actions, so no fabricate-success risk here. Dual-shape response fix for the fetch (`res?.data` vs `res`) was already applied in an earlier pass; verified correct.
### Fixes implemented
none — no safe-fix-category issues beyond the cross-cutting back-button gap, which is documented rather than fixed in this pass.
### Verification
No changes made to this file.
**Status:** AUDITED-NO-ISSUES

### LegalTemplatesScreen (`src/screens/government/LegalTemplatesScreen.tsx`)
**Entry point:** `LegalTemplates`
**Criteria evaluated:** filters, modal detail view, clipboard action, loading/empty states, accessibility, navigation/back behavior
**Not applicable:** forms, destructive actions (read-only templates + local clipboard copy)
### Findings
1. (P3) Icon-only modal-close button had no accessibility label. (Fixed.)
2. (P2) No on-screen back button/header on the main list view. (Documented, not fixed.)
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close template detail"` to the modal close button.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### NGOToolsScreen (`src/screens/government/NGOToolsScreen.tsx`)
**Entry point:** `NGOTools`
**Criteria evaluated:** forms (profile + grant application), loading, navigation/back behavior
**Not applicable:** destructive actions (both forms are additive/save operations)
### Findings
1. **(P1) Fabricate-success-on-failure + garbage data (profile):** `handleSaveProfile` cast `apiResult?.data ?? apiResult` to `NGOProfile` with no `success` check, then showed "Saved" unconditionally. On failure this set `profile` to the raw wrapper object (not a real profile) and told the user their NGO profile was saved when it was not. (Fixed.)
2. **(P1) Fabricate-success-on-failure + garbage data (grant):** `handleSubmitGrant` had the identical bug — casting the unchecked wrapper to `Grant` and prepending it to the grants list, closing the application form as if the grant request had actually been submitted. (Fixed.)
3. (P2) No on-screen back button/header. (Documented, not fixed.)
### Fixes implemented
- Both handlers now check `apiResult?.success && apiResult?.data` before touching local state, throwing on failure to route to the existing error alerts.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

### WhistleblowerScreen (`src/screens/government/WhistleblowerScreen.tsx`)
**Entry point:** `WhistleblowerReport`
**Criteria evaluated:** forms, privacy/trust messaging, tabs (submit/check status), navigation/back behavior
**Not applicable:** destructive actions (anonymous one-way submission has no "undo" by design)
### Findings
1. **(P0) Fabricate-success-on-failure — most severe instance in this batch:** `handleSubmit` cast `apiResult?.data ?? apiResult` to `{case_ref: string}` with no `success` check. On a rejected submission, the cast falls back to the wrapper object (which has no `case_ref` field), so the UI rendered the "Your Case Reference" confirmation box with an **undefined** reference, told the reporter to "save this reference," and cleared the report text box — for a report that was never actually recorded server-side. Given the privacy-note framing ("Your identity is not stored. Only your message and a case reference are saved."), a whistleblower reporting corruption, fraud, abuse, or a safety issue would walk away believing their report is safely filed when it is not, and has no way to retry because the content field was already cleared. This is the highest-stakes bug found in this batch. (Fixed.)
2. **(P2) Masked failure as "Unknown" status:** `handleCheckStatus` had the same unchecked-wrapper-cast bug; on a failed lookup it rendered `caseStatus = 'Unknown'` instead of surfacing that the lookup itself failed (vs. a real case whose status happens to be unset). Less severe than #1 since it doesn't fabricate a positive outcome, but still misleading. (Fixed.)
3. (P2) No on-screen back button/header — notable here because this screen handles sensitive anonymous reports and would benefit most from an unambiguous, trustworthy navigation affordance. (Documented, not fixed.)
### Fixes implemented
- `handleSubmit` now requires `apiResult?.success && apiResult?.data?.case_ref` before showing the case-reference confirmation and clearing the form; otherwise throws to the existing error alert, leaving the report content intact for retry.
- `handleCheckStatus` now requires `apiResult?.success && apiResult?.data` before reading `status`; otherwise throws to the existing "Not Found" alert.
### Verification
Clean typecheck/lint.
**Status:** AUDITED-FIXED

---

## Cross-cutting findings (apply across multiple files, documented but not fixed in this pass)

1. **(P2) Missing back navigation on 11 of 12 government screens.** `BoardGovernanceScreen`, `CivicPollsScreen`, `ComplianceTrackerScreen`, `CreatePetitionScreen`, `DiasporaScreen`, `LegalAidScreen`, `LegalTemplatesScreen`, `NGOToolsScreen`, `PetitionDetailScreen`, `PetitionsScreen`, and `WhistleblowerScreen` all render directly under `headerShown: false` with no on-screen back button, title bar, or header of any kind — only the content (filters/list/form) starting at the very top of the safe area. Every one of the 11 audited business-domain screens, by contrast, has an explicit `navBar` with a back button and centered title. Functionally these government screens remain reachable via the OS back gesture (iOS edge-swipe) or hardware back button (Android), so this is not a dead-end, but it is a real, consistent inconsistency within the same app: users get no on-screen orientation (what screen am I on, how do I leave) in a domain the brief specifically calls out as needing to "feel authoritative and clear." Recommended follow-up: add the same `navBar` pattern used in `business/*` to all 11 files. Not fixed in this pass because it requires restructuring each screen's top-level layout and promoting several `_props: Props` destructures to `{ navigation }: Props`, which is a larger, more structural change than the "safe/low-risk" categories (missing confirmations, silent-error-swallowing, fabricate-success, accessibility labels, color/contrast) authorized for direct fixing here.
2. **(P3) Indistinguishable "empty" vs. "failed" list states.** Nearly every list/dashboard screen across both domains (`BusinessHubScreen`, `CoWorkingScreen`, `CrowdfundScreen`, `MentorshipScreen`, `SavingsGroupsScreen`, `ImpactReportScreen`'s previous-reports list, and effectively all government list screens) catches fetch errors into an empty array with no distinct error/retry affordance, so a genuine network failure renders identically to "there's nothing here." Lower severity than the write-path bugs above since no false success is reported, but worth a dedicated pass (likely a shared empty/error-state component) rather than ad hoc per-file fixes.
3. **(P3) Inconsistent use of pre-submit confirmation for similar-weight one-way actions.** `SavingsGroupsScreen.handleJoin` and `MentorshipScreen.handleRequestMatch` both show a confirmation dialog before submitting; `PetitionsScreen`/`PetitionDetailScreen`'s sign actions and `DiasporaScreen`'s join action do not, despite being comparable one-tap, no-undo civic/community actions. Not fixed here to avoid scope creep into new interaction design within what was framed as a correctness-and-accessibility pass; flagged for a follow-up consistency pass.

---

## Totals

- **Files in scope:** 25 (13 business, 12 government)
- **Already deleted, no audit needed:** 2
- **Audited:** 23
- **Findings:** 29 numbered findings across 23 files (not counting the 3 cross-cutting findings listed once above but touching ~14 files)
- **Fixed:** 19 files (10 business, 9 government) — all 11 fabricate-success-on-failure bugs, 15 accessibility-label additions, 2 modal-close accessibility labels, and 4 pre-existing dead-code lint errors
- **AUDITED-NO-ISSUES:** 3 files (`BusinessHubScreen`, `GovernmentHubScreen`, `LegalAidScreen`)
- **AUDITED-FIXED:** 19 files
- **BLOCKED:** 0
- **Verification:** `npm run typecheck` clean (0 errors) and `npx eslint` on all 20 touched files reports 0 errors (only pre-existing `react-native/no-inline-styles` warnings remain, consistent with the rest of the codebase's style).
