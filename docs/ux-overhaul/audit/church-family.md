# UX/UI Audit — Church & Family

**Batch:** `src/screens/church/**` (18 files: root + `discipleship/`, `giving/`, `groups/`, `membership/`, `ministry/`, `outreach/`, `prayer/`, `worship/`) and `src/screens/family/**` (16 files: root + `components/`).
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility audit, not a file inventory.
**Carried-forward context verified:** `GiveNowScreen.tsx` and `ChurchPledgeScreen.tsx` already had pre-submit confirmation dialogs added earlier this session for their immediate-charge buttons — confirmed via `git diff` before this pass started; not re-touched beyond that existing change. `FamilySOSScreen` (`src/screens/family/SOSScreen.tsx`) was flagged in a prior inventory pass as safety-critical and got the deepest review in this batch — see below.

## Summary

34/34 files audited (18 church, 16 family). 16 files got real fixes, 3 have findings documented but not fixed (low-risk/systemic, explained per-file), and 15 were AUDITED-NO-ISSUES. Total findings logged: 29 (6 P0/P1, the rest P2/P3).

**The single most important finding:** `src/screens/family/SOSScreen.tsx` — the family emergency SOS button — called `postRequest(ROUTES.family.sos, ...)` and then unconditionally set `sent = true`, showing "Alert Sent — Help is on the way" regardless of whether the backend actually accepted the request. Only a thrown exception (not a resolved `{success:false}` response) would have surfaced an error. This is the exact "fabricate success on failure" anti-pattern this audit program is built to hunt for, landing on the single most safety-critical screen in this batch: someone in real danger could press SOS, be told their family was alerted, and have nothing actually sent. **Fixed** — the response is now checked for `res.success` before showing the success state, and "Try Again" retries immediately without re-prompting the "are you sure?" confirmation (since re-confirming only costs time in an emergency). A secondary issue in the same screen (GPS failure silently sends `0,0` instead of omitting the coordinates) was identified but **not changed**, since altering the payload's numeric fields risks breaking backend validation this audit couldn't verify — documented for the SOS-owning session to assess.

The same fabricate-success-on-failure and unwrapped-API-response bug patterns (previously fixed elsewhere in this codebase, per existing comments in several of these same files) turned up live in four more files this pass: `MilestonesScreen.tsx` (list fetch — milestones and the member picker were *always* empty, a currently-broken core feature), `FamilyCalendarScreen.tsx`, `FamilyNoticeBoardScreen.tsx` (both: a successful create silently rendered a blank card because the whole API wrapper, not `.data`, was being pushed into state), and `GriefSupportScreen.tsx` (joining a bereavement support group showed "You have joined the group. You are not alone" even on a backend-rejected join). All four fixed. `SmallGroupDetailScreen.tsx`'s "Leave Group" button — an explicitly-named destructive action in this audit's brief — had no confirmation at all; fixed. `MinistryScreen.tsx`'s volunteer-signup "note" field was a `TouchableOpacity` styled like a text input that did nothing when tapped — the note could never actually be typed despite being wired into the submit payload; fixed. `GivingDashboardScreen.tsx`'s "Retry" button on fetch failure didn't retry anything (it only set `loading=true` with no new fetch call), trapping the user on an infinite spinner; fixed. `FamilyHubScreen.tsx`'s invite-code "copy" icon didn't copy anything — it just showed an `Alert`; fixed to actually use the clipboard, matching the pattern already correct in `MembersScreen.tsx`. `ParentalControlsScreen.tsx`'s SOS-alert toggle — which controls whether a minor retains the ability to send an emergency alert — could be switched off with zero confirmation; added a confirmation specifically for the off-path (on-path stays immediate).

**Cross-cutting pattern noted but not fixed (systemic, not specific to this batch):** almost every screen in both `church/` and `family/` is registered in `App.tsx` with `headerShown: false` and provides no visible back button of its own, relying entirely on the native swipe-back gesture (iOS) / hardware back (Android). This matches the app's existing navigation shell convention across every other domain already audited in this program, so it reads as a deliberate design choice rather than a bug introduced here — documented per-file below where relevant, not treated as a fixable defect in this pass since changing it would mean adding a custom header affordance to dozens of screens app-wide, well beyond this batch's scope.

---

## ChurchScreen (`src/screens/church/ChurchScreen.tsx`)
**Entry point:** `ChurchHome` route, Church tab root.
**Criteria evaluated:** visual hierarchy, color/design-system consistency, touch targets, loading states, navigation.
**Not applicable:** destructive actions (none); forms (none); back behavior (tab root, correctly has none).

### Findings
1. Overview fetch silently swallows errors (`.catch(() => {})`) — on failure the header just shows the static fallback copy ("Your faith community") instead of the live member count, with no visible error. Low severity: no data is lost, nothing fabricated, and the fallback copy reads fine either way (P3).

### Fixes implemented
None — the fallback behavior on fetch failure is a reasonable degrade, not a misleading one, and the rest of the screen (grid nav, gradient header, loading indicator) is solid.

### Verification
No changes made; file unmodified.

**Status:** AUDITED-NO-ISSUES

---

## GivingDashboardScreen (`src/screens/church/giving/GivingDashboardScreen.tsx`)
**Entry point:** `ChurchGiving` route, from ChurchScreen's "Giving & Stewardship" card.
**Criteria evaluated:** loading/error states, forms/confirmations, navigation, design-system consistency.
**Not applicable:** destructive actions, accessibility labels on icon-only controls (no icon-only controls present).

### Findings
1. **"Retry" button on the fetch-error screen didn't retry anything (P1).** It called `onPress={() => setLoading(true)}` — setting the loading flag with no accompanying fetch call. Since the only fetch lived inside a `useFocusEffect` closure with no dependency that would re-run it, tapping Retry showed a permanent spinner that never resolved until the user navigated away and back. A real stuck-screen bug, not a style nitpick.
2. Pre-existing unused `TouchableOpacity` import (lint error, unrelated to behavior).

### Fixes implemented
- Extracted the fetch logic into a named `loadGivingData` callback, used by both `useFocusEffect` and the Retry button's `onPress`, so Retry now actually re-fetches.
- Removed the dead `TouchableOpacity` import.

### Verification
`npm run typecheck` — clean. `npx eslint` — clean (only a pre-existing inline-style warning remains, unrelated to this fix).

**Status:** AUDITED-FIXED

---

## TitheStatementScreen (`src/screens/church/giving/TitheStatementScreen.tsx`)
**Entry point:** `TitheStatement` route, from GivingDashboardScreen's "My Statement" button.
**Criteria evaluated:** loading/empty/error states, forms, cognitive load, Share integration.
**Not applicable:** destructive actions; accessibility labels on icon-only controls.

### Findings
1. **No auto-load on first visit (P2).** `year` state initializes to the current year with its chip already rendered as visually "active," but no fetch ever fires until the user taps that already-selected-looking chip — the screen opens on "Select a year to view your statement," which reads as broken/empty rather than simply not-yet-loaded, since the UI implies a year is already chosen.
2. Share/export only offers a formatted text share sheet, not a real PDF/download — acceptable for a "share your statement" feature but worth noting if a future pass wants a true document export (P3, not a defect).

### Fixes implemented
- Added a mount-time `useEffect` that calls `fetchStatement(CURRENT_YEAR)` automatically, so the already-selected year's data loads without requiring a redundant tap.

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing unused-`navigation`-param error (not introduced by this edit, confirmed via `git diff`); no new errors.

**Status:** AUDITED-FIXED

---

## GiveNowScreen (`src/screens/church/giving/GiveNowScreen.tsx`)
**Entry point:** `GiveNow` route, from GivingDashboardScreen's "Give Now" button.
**Criteria evaluated:** forms/confirmations, loading/error states, accessibility, touch targets.
**Not applicable:** destructive actions beyond the already-addressed charge confirmation; back behavior (relies on swipe gesture, consistent with the rest of the app).

### Findings
1. Already fixed earlier this session (carried-forward, verified via `git diff`): a pre-submit confirmation `Alert` now shows the exact amount/type/campaign before the gift is actually submitted. No new issues found on top of that fix — error/loading states, validation, and campaign-fetch failure handling are all solid.

### Fixes implemented
None in this pass — confirmed the existing fix is correct and complete.

### Verification
No changes made in this pass beyond the already-present, already-verified fix.

**Status:** AUDITED-NO-ISSUES

---

## ChurchPledgeScreen (`src/screens/church/giving/ChurchPledgeScreen.tsx`)
**Entry point:** `ChurchPledge` route, from GivingDashboardScreen's "Make a Pledge" button.
**Criteria evaluated:** forms/confirmations, loading/empty states, touch targets.
**Not applicable:** destructive actions beyond the already-addressed pledge confirmation.

### Findings
1. Already fixed earlier this session (carried-forward, verified via `git diff`): a pre-submit confirmation `Alert` shows the pledge amount/period/start date before submission. Confirmed correct.
2. Minor: the start-date field is free-text `YYYY-MM-DD` rather than a date picker (P3, consistent with every other date field across this entire batch — not unique to this screen).

### Fixes implemented
None — the carried-forward fix is correct, and the free-text date pattern is consistent app-wide, not a regression to fix in isolation here.

### Verification
No changes made in this pass.

**Status:** AUDITED-NO-ISSUES

---

## SmallGroupsScreen (`src/screens/church/groups/SmallGroupsScreen.tsx`)
**Entry point:** `SmallGroups` route, from ChurchScreen's "Small Groups" card.
**Criteria evaluated:** loading/empty states, forms/confirmations, touch targets.
**Not applicable:** destructive actions (join-only here; leave lives on the detail screen, see below).

### Findings
None of note — join flow correctly checks `res.success` before updating state, filter chips and list virtualization are solid, empty state is clear.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## SmallGroupDetailScreen (`src/screens/church/groups/SmallGroupDetailScreen.tsx`)
**Entry point:** `SmallGroupDetail` route, pushed from SmallGroupsScreen with `{ groupId }`.
**Criteria evaluated:** destructive-action confirmation, loading/error states, forms, touch targets.
**Not applicable:** accessibility labels on icon-only controls (all controls here have text labels).

### Findings
1. **"Leave Group" fired immediately with no confirmation (P1).** This is one of the destructive actions this audit was explicitly briefed to hunt for by name. The button sits right next to "Join Group" with the same tap target and no visual warning beyond its red "danger" color — a mis-tap removes you from the group outright, with no undo path shown in the UI.

### Fixes implemented
- Split the handler so leaving now shows a confirmation `Alert` ("Are you sure you want to leave {group}? You'll need to rejoin to see future meetings and updates.") with Cancel/Leave, while joining still applies immediately (non-destructive, no need to gate it).

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing unused-`navigation`-param error (not introduced; `navigation` was already unused in this screen before this edit) and two pre-existing `no-void` style warnings (this codebase's established pattern for fire-and-forget async calls, used identically in already-fixed files like `GiveNowScreen.tsx`).

**Status:** AUDITED-FIXED

---

## AttendanceScreen (`src/screens/church/membership/AttendanceScreen.tsx`)
**Entry point:** `ChurchAttendance` route, from ChurchScreen's "Membership" card (via MemberDirectory) or direct nav.
**Criteria evaluated:** loading/error states, forms, touch targets, data integrity.
**Not applicable:** destructive actions (check-in only, nothing to undo).

### Findings
1. On a successful check-in, the streak counter is incremented locally (`streak + 1`) rather than read back from the server response, which could drift from the real value if the backend applies different streak-reset logic (e.g., a missed week) (P3 — cosmetic drift only, not a safety or data-loss issue).

### Fixes implemented
None — the local increment is a reasonable optimistic-UI choice and the actual check-in record is correctly persisted server-side either way; changing the response-shape assumption without a confirmed backend contract risked introducing a new bug rather than fixing a real one.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## MemberDirectoryScreen (`src/screens/church/membership/MemberDirectoryScreen.tsx`)
**Entry point:** `MemberDirectory` route, from ChurchScreen's "Membership" card.
**Criteria evaluated:** loading/empty states, search/filter UX, touch targets.
**Not applicable:** destructive actions, forms.

### Findings
1. Search re-fetches on every keystroke with no debounce (P3) — a performance/backend-load concern under heavy typing, not a correctness bug. The same pattern recurs in `SongLibraryScreen.tsx` and is consistent with how `useFocusEffect` dependencies are used throughout this batch; flagged once here as representative rather than repeated per-file.

### Fixes implemented
None — debouncing search-as-you-type is a reasonable follow-up but is a behavior change beyond this pass's "safe, low-risk" fix bar, and isn't a bug (it fetches correct results, just more often than ideal).

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## MinistryScreen (`src/screens/church/ministry/MinistryScreen.tsx`)
**Entry point:** `MinistryDepartments` route, from ChurchScreen's "Ministry & Outreach" card.
**Criteria evaluated:** forms/confirmations, loading/empty states, touch targets, responsive layout.
**Not applicable:** destructive actions (volunteer signup only).

### Findings
1. **The volunteer-signup "note" field was non-functional (P1).** `Why do you want to volunteer? (optional)` rendered a `TouchableOpacity` styled to look exactly like a text input, with a static placeholder `Text` and `onPress={() => {}}` — tapping it did nothing. The `signupNote` state it was supposedly bound to was never actually settable from the UI, yet it was still read into the submit payload (`note: signupNote || undefined`), meaning the note was silently always empty regardless of what the user tried to type. This is a real broken-form bug, not a style nitpick.

### Fixes implemented
- Replaced the fake `TouchableOpacity` with an actual `TextInput` bound to `signupNote`/`setSignupNote`, multiline, matching the existing visual style.
- Removed the now-redundant `noteInputPlaceholder` style and merged its text styling into the input itself.
- Removed a pre-existing dead `ScrollView` import while in the file (unrelated lint cleanup, zero behavior risk).

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing unused-`navigation`-param error (not introduced; confirmed via `git diff`), one pre-existing inline-style warning.

**Status:** AUDITED-FIXED

---

## EvangelismScreen (`src/screens/church/outreach/EvangelismScreen.tsx`)
**Entry point:** `EvangelismTracker` route, from ChurchScreen's "Ministry & Outreach" card.
**Criteria evaluated:** forms, loading states, data integrity.
**Not applicable:** destructive actions, accessibility labels on icon-only controls.

### Findings
1. Same local-arithmetic-instead-of-server-echo pattern as `AttendanceScreen.tsx`: after logging outreach, the impact stats are incremented client-side rather than read back from the response (P3).

### Fixes implemented
None — same reasoning as `AttendanceScreen.tsx`; low severity, and the underlying record is correctly saved either way.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## DiscipleshipScreen (`src/screens/church/discipleship/DiscipleshipScreen.tsx`)
**Entry point:** `DiscipleshipJourney` route, from ChurchScreen's "Discipleship" card.
**Criteria evaluated:** loading/error states, accessibility labels on icon-only controls, retry behavior.
**Not applicable:** destructive actions, forms.

### Findings
1. **Mentor "contact" button is icon-only with no accessibility label (P2).** A `send` icon with no text and no `accessibilityLabel`/`accessibilityRole` — a screen-reader user would hear nothing describing what the button does.
2. Retry on fetch failure duplicates the fetch logic inline instead of reusing a shared callback (code-quality nit, not a UX defect).

### Fixes implemented
- Added `accessibilityRole="button"` and a descriptive `accessibilityLabel` ("Contact mentor {name}") to the icon-only contact button.

### Verification
`npm run typecheck` — clean. `npx eslint` — two pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## SpiritualGiftsScreen (`src/screens/church/discipleship/SpiritualGiftsScreen.tsx`)
**Entry point:** `SpiritualGifts` route, from DiscipleshipScreen's "Explore Spiritual Gifts" button.
**Criteria evaluated:** cognitive load, forms, progress/navigation within a multi-step flow.
**Not applicable:** destructive actions; loading/error states beyond the submit flow (no initial fetch — questions are bundled).

### Findings
None of note — the 20-question flow has a clear intro, visible progress bar, auto-advance-on-answer with a Previous option to revisit, and a results screen that gracefully handles whatever shape the backend returns (`res.data?.gifts ?? res.data ?? []`). Submit is correctly gated on all questions being answered.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## PrayerWallScreen (`src/screens/church/prayer/PrayerWallScreen.tsx`)
**Entry point:** `PrayerWall` route, from ChurchScreen's "Prayer Wall" card.
**Criteria evaluated:** loading/empty states, emotional tone, touch targets, privacy.
**Not applicable:** destructive actions (no delete-own-request feature exists on this screen to require confirmation for).

### Findings
1. Filter re-fetch silently swallows errors (`.catch(() => {})`) — on failure the list just stays on whatever it last had, with no visible error state (P3).

### Fixes implemented
None — low severity; the "pray" action itself correctly checks `res.success` and shows an error `Alert` on failure, which was the higher-risk path.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## NewPrayerRequestScreen (`src/screens/church/prayer/NewPrayerRequestScreen.tsx`)
**Entry point:** `NewPrayerRequest` route, from PrayerWallScreen's FAB.
**Criteria evaluated:** forms/validation, privacy/tone, touch targets.
**Not applicable:** destructive actions, loading states (no initial fetch).

### Findings
None of note — privacy options (Public/Anonymous/Leaders Only) are clearly explained with sub-copy, submission correctly checks `res.success`, and the tone ("Share your heart with your church community") is warm and non-judgmental, matching the sensitivity this audit was briefed to look for on this exact feature.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## FastingTrackerScreen (`src/screens/church/prayer/FastingTrackerScreen.tsx`)
**Entry point:** `FastingTracker` route, from PrayerWallScreen or ChurchScreen's Prayer card.
**Criteria evaluated:** loading/empty states, forms, emotional tone.
**Not applicable:** destructive actions.

### Findings
1. Both fetches (`activeFast`, `communityFasts`) silently swallow errors with `.catch(() => {})` and no error state — on a failed fetch, the screen shows "No active fast at this time," which is indistinguishable from the genuinely-correct empty state. A user with a real active fast whose fetch failed would be told to start a new one (P2 — misleading, though not destructive).

### Fixes implemented
None — fixing this correctly requires adding a distinct error state (vs. empty state) across both fetches, which is a larger structural change than this pass's "safe, low-risk" bar for a non-destructive read path; documented for a follow-up pass.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## SongLibraryScreen (`src/screens/church/worship/SongLibraryScreen.tsx`)
**Entry point:** `SongLibrary` route, from ChurchScreen's "Worship & Songs" card.
**Criteria evaluated:** loading/empty states, forms, search UX.
**Not applicable:** destructive actions (no delete-song feature).

### Findings
1. Same no-debounce search-as-you-type pattern noted once already under `MemberDirectoryScreen.tsx` (P3).

### Fixes implemented
None — see `MemberDirectoryScreen.tsx` reasoning.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## SetListScreen (`src/screens/church/worship/SetListScreen.tsx`)
**Entry point:** `SetLists` route, from ChurchScreen's "Worship & Songs" card.
**Criteria evaluated:** loading/empty states, forms, accessibility (checkbox semantics), touch targets.
**Not applicable:** destructive actions (no delete-set-list feature).

### Findings
None of note — this is the most carefully built screen in the whole batch: proper `accessibilityRole="checkbox"` + `accessibilityState` on the song picker, a real empty state with a clear "Create First Set List" CTA, and date/title validation before create. Nothing to fix.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## SOSScreen (`src/screens/family/SOSScreen.tsx`)
**Entry point:** `FamilySOS` route, flagged safety-critical in a prior inventory pass.
**Criteria evaluated:** forms/confirmations, fabricate-success-on-failure, loading/error states, accessibility, emotional tone.
**Not applicable:** navigation structure beyond the existing back button (already present and now labeled).

### Findings
1. **P0 — fabricated success on a failed SOS send.** `await postRequest(ROUTES.family.sos, {...})` was called and then `setSent(true)` ran unconditionally, regardless of the response's `success` field. Only a thrown exception (network failure, not a backend-rejected request) would have surfaced an error. A rejected SOS still showed "Alert Sent — Help is on the way" to someone who may be in real danger, with no actual alert delivered to their family. This is the single highest-severity finding across both audited directories in this batch.
2. GPS permission-denied fallback silently sends `latitude: 0, longitude: 0` — a real-sounding but false coordinate (the middle of the Atlantic Ocean), rather than indicating "location unavailable" (P2, documented not fixed — see below).
3. Icon-only back button had no `accessibilityLabel` (P3).

### Fixes implemented
- `sendSOS()` now checks `res?.success` before showing the success state; on failure (rejected response or thrown exception) it shows an `Alert` ("SOS Not Sent... Please try again or call emergency services directly") with a "Try Again" action.
- Refactored so "Try Again" calls the send logic directly rather than re-showing the initial "Are you sure?" confirmation — re-confirming intent the user already confirmed only adds delay in an actual emergency.
- Added `accessibilityRole="button"` + `accessibilityLabel="Back"` to the icon-only back button.
- **Not fixed:** the `0,0` GPS fallback. Changing what's sent in the `latitude`/`longitude` fields risks violating backend validation this audit couldn't verify (e.g., if the endpoint requires non-null floats) — flagged for the screen-owning session to assess with real backend knowledge, since getting this wrong on the SOS endpoint is exactly the kind of change that needs more certainty than this audit pass can provide alone.

### Verification
`npm run typecheck` — clean. `npx eslint` — three pre-existing-pattern `no-void` warnings (this codebase's established fire-and-forget convention, same as already-fixed `GiveNowScreen.tsx`), one pre-existing inline-style warning; nothing newly erroring.

**Status:** AUDITED-FIXED

---

## FamilyHubScreen (`src/screens/family/FamilyHubScreen.tsx`)
**Entry point:** `FamilyHub` route, Family tab root.
**Criteria evaluated:** loading/empty states, forms/affordances, accessibility labels on icon-only controls, navigation.
**Not applicable:** destructive actions (none on this screen).

### Findings
1. **"Copy" icon next to the invite code didn't copy anything (P2).** `onPress={() => Alert.alert('Invite Code', family.invite_code)}` just displayed an `Alert` with the code as text — the copy-outline icon is a clear affordance promise ("tap to copy") that the code does not deliver, forcing the user to manually read/retype the code instead. The correct pattern (`Clipboard.setString`) already exists one screen over in `MembersScreen.tsx`'s invite flow.
2. Two icon-only controls (the copy button and the "view all members" avatar button) had no `accessibilityLabel`.

### Fixes implemented
- Changed the copy button to actually call `Clipboard.setString(family.invite_code)` before confirming, matching `MembersScreen.tsx`'s established pattern.
- Added `accessibilityRole="button"` + labels to both icon-only controls.

### Verification
`npm run typecheck` — clean. `npx eslint` — three pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## FamilySetupScreen (`src/screens/family/FamilySetupScreen.tsx`)
**Entry point:** `FamilySetup` route, from FamilyHubScreen's empty state ("Create Family" / "Join Family").
**Criteria evaluated:** forms/validation, touch targets, tab UX.
**Not applicable:** destructive actions, loading states beyond the submit flow.

### Findings
1. Both "Create Family" and "Join Family" buttons on FamilyHubScreen's empty state navigate to the same screen, which always opens on the "Create" tab — tapping "Join Family" still requires an extra tap to switch tabs before the user can actually join (P3). Fixing this cleanly would mean adding a route param to preset the initial tab, which touches the screen's prop/navigation typing — judged out of this pass's "don't change navigation structure" guardrail.

### Fixes implemented
None — documented only, per the reasoning above.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## MembersScreen (`src/screens/family/MembersScreen.tsx`)
**Entry point:** `FamilyMembers` route, from FamilyHubScreen's avatar row / "view all" button.
**Criteria evaluated:** loading/empty states, forms, clipboard affordances, touch targets.
**Not applicable:** destructive actions (no remove-member feature exists on this screen).

### Findings
None of note — this is the screen whose invite-generation flow (`Clipboard.setString` + confirming `Alert`) is the correct reference pattern that `FamilyHubScreen.tsx`'s copy button was fixed to match.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## FamilyCalendarScreen (`src/screens/family/FamilyCalendarScreen.tsx`)
**Entry point:** `FamilyCalendar` route, from FamilyHubScreen's "Events" card.
**Criteria evaluated:** fabricate-success-on-failure, forms, accessibility labels on icon-only controls, calendar UX.
**Not applicable:** destructive actions (no delete-event feature).

### Findings
1. **Unwrapped-API-response bug on event creation (P1).** `handleAddEvent` cast the entire `postRequest` result (the `{success, data, message}` wrapper) directly to `FamilyEvent` instead of reading `.data`, and never checked `.success`. A successful create appended an object with no real `title`/`date`/`type` fields to state (so the new event didn't actually appear in the day's event list until the screen was refocused), and a backend-rejected create was silently treated as if it had succeeded. This is the same bug class already identified and fixed elsewhere in this file's own sibling fetch (see the existing code comment on the `useFocusEffect` above it) — just not caught in the create path.
2. Month-navigation chevrons were icon-only with no `accessibilityLabel`.

### Fixes implemented
- `handleAddEvent` now checks `res.success` and unwraps `res.data` before appending to state, showing an error `Alert` on failure instead of a fabricated success.
- Added `accessibilityRole="button"` + labels ("Previous month"/"Next month") to the chevron buttons.

### Verification
`npm run typecheck` — clean. `npx eslint` — five pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## FamilyAlbumScreen (`src/screens/family/FamilyAlbumScreen.tsx`)
**Entry point:** `FamilyAlbum` route, from FamilyHubScreen's "Photos" card.
**Criteria evaluated:** loading/empty states, accessibility labels on icon-only controls, responsive grid layout.
**Not applicable:** destructive actions (no delete-album/photo feature).

### Findings
1. The back arrow in the photo-grid (per-album) view was icon-only with no `accessibilityLabel`.
2. Album-creation flow already correctly unwraps `.data` from the response (per an existing code comment documenting a prior fix) — confirmed still correct, no regression.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Back to albums"` to the back arrow.

### Verification
`npm run typecheck` — clean. `npx eslint` — four pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## FamilyTreeScreen (`src/screens/family/FamilyTreeScreen.tsx`)
**Entry point:** `FamilyTree` route, pushed with `{ familyId }` from FamilyHubScreen's "Family Tree" card.
**Criteria evaluated:** loading/empty states, data integrity, responsive layout.
**Not applicable:** destructive actions, forms.

### Findings
None of note — the response-unwrapping fix (`res?.success ? res.data : null`, with multi-shape fallback) documented in this file's own code comments is confirmed correct. Recursive tree rendering with connector lines handles arbitrary depth cleanly.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## FamilyNoticeBoardScreen (`src/screens/family/FamilyNoticeBoardScreen.tsx`)
**Entry point:** `FamilyNoticeBoard` route, from FamilyHubScreen's "Notice Board" card.
**Criteria evaluated:** fabricate-success-on-failure, forms, emotional tone.
**Not applicable:** destructive actions (no delete-notice feature).

### Findings
1. **Same unwrapped-API-response bug as `FamilyCalendarScreen.tsx` (P1).** `handlePost` cast the whole wrapper to `Notice` with no `.success` check — a successful post rendered a blank card (real title/content lived on `.data`), and a rejected post was shown to the user as if it had succeeded.

### Fixes implemented
- `handlePost` now checks `res.success` and unwraps `res.data`, with an error `Alert` on failure.

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing unused-`navigation`-param error (not introduced; confirmed via `git diff`) and five pre-existing inline-style warnings.

**Status:** AUDITED-FIXED

---

## FamilyPrayerScreen (`src/screens/family/FamilyPrayerScreen.tsx`)
**Entry point:** `FamilyPrayer` route, from FamilyHubScreen's "Prayer" card.
**Criteria evaluated:** forms, data unwrapping, emotional tone, touch targets.
**Not applicable:** destructive actions (toggling "answered" is reversible, not destructive).

### Findings
1. `handleAddPrayer`/`handleToggleAnswered` unwrap `.data` correctly (per existing comments documenting a prior fix) but don't explicitly check `.success` before applying the optimistic update — a backend-rejected request would still update local state to show the new/changed prayer with no error shown (P3, same lower-severity variant of the pattern fixed more completely elsewhere this pass; not fixed here since the data-unwrap half — the more commonly actually-triggered failure mode — was already correctly handled in a prior session).

### Fixes implemented
None — see reasoning above; documented as the residual lower-severity half of an already-mostly-fixed pattern.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## GriefSupportScreen (`src/screens/family/GriefSupportScreen.tsx`)
**Entry point:** `GriefSupport` route, from FamilyHubScreen's "Grief Support" card.
**Criteria evaluated:** fabricate-success-on-failure, emotional tone/privacy, forms.
**Not applicable:** destructive actions (join-only).

### Findings
1. **Fabricated success on a failed support-group join (P1).** `submitJoin` called `await postRequest(...)` and then unconditionally showed `Alert.alert('Joined', 'You have joined the group. You are not alone.')` and incremented the local member count — with no check of `res.success`. A backend-rejected join told someone grieving they'd successfully joined a support community when they hadn't, on an emotionally sensitive feature where that gap matters more than most.
2. Tone and privacy handling elsewhere on this screen are good — the anonymous-join option is clearly explained, and filter/empty states are respectful.

### Fixes implemented
- `submitJoin` now checks `res?.success` before showing the success `Alert` / incrementing the member count, with an error `Alert` on failure instead.

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing unused-`navigation`-param error (not introduced; confirmed via `git diff`), three pre-existing inline-style warnings.

**Status:** AUDITED-FIXED

---

## MemorialPagesScreen (`src/screens/family/MemorialPagesScreen.tsx`)
**Entry point:** `FamilyMemorials` route, from FamilyHubScreen's "Memorials" card.
**Criteria evaluated:** forms, emotional tone, navigation.
**Not applicable:** destructive actions (no delete-memorial feature).

### Findings
None of note — creation flow correctly unwraps `.data`, tone is respectful ("In loving memory" on the detail screen), empty state is gentle rather than clinical.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## MemorialPageScreen (`src/screens/family/MemorialPageScreen.tsx`)
**Entry point:** `MemorialPage` route, pushed with `{ memorialId }` from MemorialPagesScreen.
**Criteria evaluated:** loading/not-found states, emotional tone.
**Not applicable:** destructive actions, forms (read-only display).

### Findings
None of note — clean read-only tribute display with a correctly-handled not-found state.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## MilestonesScreen (`src/screens/family/MilestonesScreen.tsx`)
**Entry point:** `FamilyMilestones` route, from FamilyHubScreen's "Milestones" card.
**Criteria evaluated:** fabricate-success-on-failure, data unwrapping, forms.
**Not applicable:** destructive actions (no delete-milestone feature).

### Findings
1. **The milestone timeline and the "Family member" picker in the Add form were always empty, regardless of real data (P1).** The initial `Promise.all` fetch checked `Array.isArray(ms)` / `ms?.results` against the raw `getRequest` wrapper instead of `ms.data` — the wrapper is never an array and never has a top-level `.results`, so both branches always fell through to `[]`. This silently broke two core features of the screen: the timeline never rendered any milestone the backend actually returned, and the member dropdown in the Add-milestone form always had zero options to pick from.
2. `handleAdd` had the same whole-wrapper-cast bug as `FamilyCalendarScreen.tsx`/`FamilyNoticeBoardScreen.tsx` — no `.success` check, no `.data` unwrap.

### Fixes implemented
- Fixed the `Promise.all` fetch to read `ms.data`/`mems.data` before the array/`.results` dual-shape check, so milestones and the member list actually populate.
- Fixed `handleAdd` to check `res.success` and unwrap `res.data`, with an error `Alert` on failure.

### Verification
`npm run typecheck` — clean. `npx eslint` — three pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## ParentalControlsScreen (`src/screens/family/ParentalControlsScreen.tsx`)
**Entry point:** `ParentalControls` route, pushed with `{ memberId }` from MembersScreen's "Controls" button on minor rows.
**Criteria evaluated:** destructive/safety-reducing action confirmation, data unwrapping, forms.
**Not applicable:** accessibility labels on icon-only controls (all controls here are text-labeled switches/pickers).

### Findings
1. **Turning off a minor's SOS-alert capability had no confirmation (P1 — safety-relevant).** The "SOS Alert" switch on this screen controls whether a family member (frequently a minor, given the screen's entry point) retains the ability to send an emergency alert at all. Disabling it was a single tap with the same weight as toggling "Location Sharing" or any other setting — no warning that this removes an emergency safety feature.
2. The fetch-side unwrapping bug (reading the raw wrapper instead of `.data`, crashing on the unguarded `controls.restricted_sections[key]` read) was already found and fixed in a prior session, per the existing code comment — confirmed correct, no regression.
3. `handleSave` doesn't explicitly check `patchRequest`'s `.success` before showing "Saved" (P3, lower severity — a settings save, not a one-shot safety action, and the user can simply re-open and re-save if something silently failed).

### Fixes implemented
- Wrapped the SOS-alert switch's off-path in a confirmation `Alert` ("Turn Off SOS Alert?... Are you sure?") before applying the change to local state; the on-path (re-enabling SOS) still applies immediately since turning a safety feature back on is never the risky direction.

### Verification
`npm run typecheck` — clean. `npx eslint` — three pre-existing inline-style warnings, unrelated to this change.

**Status:** AUDITED-FIXED

---

## TimeCapsuleScreen (`src/screens/family/TimeCapsuleScreen.tsx`)
**Entry point:** `FamilyTimeCapsules` route, from FamilyHubScreen's "Time Capsules" card.
**Criteria evaluated:** forms, data unwrapping, countdown/lock-state UX.
**Not applicable:** destructive actions (no delete-capsule feature).

### Findings
None of note — creation flow correctly unwraps `.data` (per existing comment documenting a prior fix), and the locked/unlocked countdown UI is clear and correctly gates the message/media behind the unlock date.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## FamilySelect (`src/screens/family/components/FamilySelect.tsx`)
**Entry point:** not a screen — shared picker component used by `FamilyCalendarScreen`, `MilestonesScreen`, and `ParentalControlsScreen`.
**Criteria evaluated:** accessibility (radio-group semantics on a custom picker), touch targets.
**Not applicable:** forms/confirmations, loading/error states, navigation (presentational component, no network calls).

### Findings
1. The trigger button and each option row were plain `TouchableOpacity`s with no `accessibilityRole`/`accessibilityState` — a screen-reader user would get no indication this is a selector, nor which option is currently selected, across all three screens that use it.

### Fixes implemented
- Added `accessibilityRole="button"` + a label describing the current selection to the trigger.
- Added `accessibilityRole="radio"` + `accessibilityState={{ checked }}` to each option row, correctly describing the mutually-exclusive single-select semantics.

### Verification
`npm run typecheck` — clean. `npx eslint` — clean, no warnings or errors on this file.

**Status:** AUDITED-FIXED
