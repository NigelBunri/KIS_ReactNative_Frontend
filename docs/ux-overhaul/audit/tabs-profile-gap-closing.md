# Tabs / Profile — Gap-Closing Audit

**Scope:** 17 files missed by earlier sub-agents in the Profile/Partners domain of the application-wide UX/UI audit: `ProfileScreen.tsx`, `PartnersScreen.tsx`, the 5 `profile-screen-sections/` files, the 4 remaining `profile-screen/` modals (`EditItemModal.tsx`, `HealthManagementModal.tsx`, `PrivacyModal.tsx`, `UpgradeModal.tsx`) plus the 5 pure support files in that folder (`constants.ts`, `helpers.ts`, `index.ts`, `selectors.ts`, `types.ts`), and `MesssagingSubTabs/callsTabHelpers.ts`. One fix was made: an icon-only "close" button on `ProfileScreen.tsx`'s management-panel header had no `accessibilityLabel`/`accessibilityRole`, so it's been given both plus `hitSlop` — everything else audited clean or is a documented, unfixed finding (mostly silent-failure paths on secondary/non-critical calls, and two destructive actions confirmed safe only after tracing their confirmation dialogs into downstream components that are themselves out of this pass's scope). `npm run typecheck` is clean and `eslint` on the one changed file shows 0 new errors (pre-existing inline-style warnings only).

---

## ProfileScreen (`src/screens/tabs/ProfileScreen.tsx`)

**Entry point:** `MainTabs` → `Profile` tab (`App.tsx` bottom tab navigator); also reachable via `broadcastProfileKey` route param deep-links and `DeviceEventEmitter` events (`wallet.open`, `profile.reopenManagementPanel`).

### Findings

1. **`handleOpenToWorkToggle` gives zero user feedback on total failure (P2).** The handler (around line 1141) optimistically flips the `Switch` state, then on API failure queues the change via `enqueueMutation(...).catch(() => {})` — if the queue write *also* fails (storage full, serialization error, etc.), the user is left believing "Open to Work" is on/off with no persistence anywhere and no indication anything went wrong. Contrast with `handleMarketFormSave` a few hundred lines later, which hits the identical queue-for-retry path but surfaces `Alert.alert('Market profile', 'Changes saved locally — will sync when online.')`. This screen already has the pattern for giving feedback on a "saved locally" outcome; the toggle just doesn't use it. Not fixed — a Switch is a low-ceremony control and an Alert on every flip would be its own regression; flagging for product decision on whether a toast-style surface is warranted instead.
2. **`fetchManageableShopPartners` silently no-ops on a failed response (P3).** `if (!response?.success) return;` (around line 1596) leaves `manageableShopPartners` at its previous value with no error surfaced to `ShopEditorDrawer`. Low severity — it's a secondary "connect to partner org" list inside the shop editor, not a blocking flow, and the editor's own save/delete paths have full error handling.
3. **Icon-only panel-close button had no accessible name (P2 — fixed).** The management-panel header's "×" `Pressable` (~line 3621, wraps `<KISIcon name="close">`) had no `accessibilityLabel`/`accessibilityRole`, so VoiceOver/TalkBack would announce it only as an unlabeled image/button. Its touch area (`padding: 6` + 28px icon ≈ 40pt) was also just under the ~44pt guideline.
4. **Destructive actions trace through cleanly, but only by reading downstream files (P3 — informational, not a defect).** `onDelete={c.deletePartnerProfile}` (PartnerProfilesSection → `PartnerProfilesList.tsx`) and the shop-delete flow (`handleMarketFormDelete` → `ShopEditorDrawer.tsx`) both *do* show a native confirm Alert with `style: 'destructive'` before calling through — but that confirmation lives entirely in components outside this gap-closing pass's file list. Noting this so a future auditor of `PartnerProfilesList.tsx`/`ShopEditorDrawer.tsx` doesn't have to re-derive it: both are safe as-is.
5. **Quick Lock PIN disable and "Delete Account" nav are handled well (no finding).** PIN removal requires two nested destructive-styled confirms; "Delete Account" is a navigation handoff (not an in-place delete) and is rendered in `palette.danger` with a chevron — appropriately telegraphed as a dangerous destination without needing its own confirm here.
6. **Loading/empty/error states present and consistent.** Skeleton loading for the initial profile fetch, a `MainTabStateBlock` retry affordance when `!c.profile`, and inline loading/error text for appointments and marketplace orders sections. No gaps found here.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, and `hitSlop={8}` to the management-panel close `Pressable` (finding 3). No layout, navigation, or contract changes.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/tabs/ProfileScreen.tsx` — 0 errors, 89 pre-existing warnings (all `react-native/no-inline-styles` / one `no-void`, none introduced by this change).

**Status:** AUDITED-FIXED

---

## PartnersScreen (`src/screens/tabs/PartnersScreen.tsx`)

**Entry point:** `MainTabs` → `Partners` tab (`App.tsx`).

### Findings

This 1,516-line file is almost entirely orchestration: it owns ~50 `usePartnerXPanel`/`useAdminXPanel` hook instances (each managing one slide-over panel's open/close/animation state) and wires their props straight through to `PartnerLayout` and a dozen `AdminXPanel` components. Virtually none of the actual rendering, forms, destructive actions, or error handling happens in this file — it happens in the ~50 hook files and panel components it imports, which are outside this gap-closing pass's assigned scope.

1. **`checkSuperuser` swallows both its cache-read and network-fetch errors silently (P3, fails safe).** Two bare `.catch(() => {})`/`.catch(() => null)` around lines 143–166. If both the scoped-profile-cache read and the `/profiles/me` fetch fail, `isSuperuser` simply stays `false` (or whatever the cache last set) — no error surfaced. This gates whether admin-only panels and the KCAN super-admin suite render. Because the failure mode defaults to "don't show admin tools," this fails in the safe direction (a real admin on a bad network just doesn't see the admin tab until the next successful check) rather than fabricating elevated access, so not flagged as a correctness bug — documenting only.
2. **The two in-file `Alert.alert` action sheets (`handleOpenPartnerInfo`, `onAddPartnerPress`) are choice menus, not destructive confirms** — both just route to different panels/screens and both include a `Cancel`. No issue.
3. **Destructive actions dispatched from here (ban/unban/block/delete user, wipe devices, set partner active/inactive, etc.) all delegate to `adminUsers.*`/`adminPartners.*`/`adminDashboard.*` handlers from hooks outside this file's scope** (`useAdminUsersPanel.ts` and friends). Whether those show a confirm dialog is a question for whoever audits those hook files / `AdminUsersPanel.tsx` — not re-verifiable from `PartnersScreen.tsx` alone, since it only forwards the already-built handler.
4. **No accessibility, layout, or confirmation issues found in the code this file itself owns** (the two context-panel `TabletCard`s, the create-org `Modal`, and the prop-wiring body).

### Fixes implemented
None — the file meets the bar as-is for everything within its own scope (wiring/orchestration). The one soft finding (#1) is an intentional-looking fail-safe default, not a defect worth changing.

### Verification
No changes made to this file; `npm run typecheck` (run after the ProfileScreen edit) is clean and does not implicate this file.

**Status:** AUDITED-NO-ISSUES

---

## BroadcastProfilesSection (`src/screens/tabs/profile-screen-sections/BroadcastProfilesSection.tsx`)

**Entry point:** Rendered by `ProfileScreen.tsx`'s workspace-launcher content (consumed indirectly via `BROADCAST_PROFILE_DEFINITIONS`; the component itself appears currently unused as a direct render in `ProfileScreen.tsx`'s active JSX — `WorkspaceLauncherSection` from `profile/components/dashboard` has superseded it — but it remains exported from the barrel and is a legitimate presentational component).

### Findings
1. None. Clean loading state (`isLoading` derived from `broadcastProfiles === null`, shows "Loading…"/"Refreshing…" text), good contrast (uses `palette.text`/`palette.subtext`/`palette.primarySoft`), button labels are always text ("Open" / the profile's `managementLabel`), no destructive actions, no network calls of its own.

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; no changes made, no typecheck impact.

**Status:** AUDITED-NO-ISSUES

---

## ImpactSnapshotSection (`src/screens/tabs/profile-screen-sections/ImpactSnapshotSection.tsx`)

**Entry point:** Presentational component exported from the `profile-screen-sections` barrel; superseded in current `ProfileScreen.tsx` usage by `ImpactSnapshotCard` from `profile/components/dashboard`, but still a valid standalone component.

### Findings
1. None. Correctly early-returns `null` on an empty `stats` array (clean empty state), uses theme palette tokens throughout, no interactive elements to assess for touch targets.

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; no changes made.

**Status:** AUDITED-NO-ISSUES

---

## PartnerProfilesSection (`src/screens/tabs/profile-screen-sections/PartnerProfilesSection.tsx`)

**Entry point:** `ProfileScreen.tsx` → Business tab, rendered when `partnerProfiles.length > 0`.

### Findings
1. **Destructive actions (`onDeactivate`/`onDelete`) are forwarded without local confirmation — verified safe.** This component is a thin wrapper around `PartnerProfilesList` (in `profile/components/PartnerProfilesList.tsx`, out of this pass's scope). Traced it to confirm: `PartnerProfilesList` itself shows `Alert.alert(...)` with `style: 'destructive'` before invoking `onDeactivate`/`onDelete`. No gap.
2. No other issues — simple pass-through wrapper, correct palette usage on its own card chrome.

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; confirmation behavior verified by reading the downstream consumer (`PartnerProfilesList.tsx`).

**Status:** AUDITED-NO-ISSUES

---

## SectionCardsList (`src/screens/tabs/profile-screen-sections/SectionCardsList.tsx`)

**Entry point:** `EditProfileModal` (profile edit sheet) → renders one `SectionCard` per profile section (experience, education, etc.).

### Findings
1. **`onDelete` forwarded without local confirmation — verified safe.** Traced into `profile/components/SectionCard.tsx` (out of scope): it calls `Alert.alert(...)` with a destructive-styled "Delete" button before invoking the `onDelete` prop this component passes through. No gap.
2. No other issues — a 34-line pure mapping component.

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; confirmation behavior verified by reading the downstream consumer (`SectionCard.tsx`).

**Status:** AUDITED-NO-ISSUES

---

## profile-screen-sections/index.ts

**Entry point:** N/A — barrel export file.

### Findings
None — five-line re-export barrel, nothing to audit.

### Fixes implemented
None.

### Verification
N/A.

**Status:** AUDITED-NO-ISSUES

---

## EditItemModal (`src/screens/tabs/profile-screen/EditItemModal.tsx`)

**Entry point:** `ProfileScreen.tsx`'s `BottomSheet` host, rendered when `c.activeSheet === 'editItem'` (adding/editing an experience/education/project/showcase item).

### Findings
1. None of concern. The title/description field already has an in-code comment documenting and fixing a prior real bug (an `undefined`-coalescing condition that discarded every keystroke on brand-new items) — that fix predates this pass and is correct as written. `KeyboardAvoidingView` wraps the form correctly for iOS/Android. Save button shows a loading label and `loading`/`disabled` state while saving (no double-submit risk). Media-attach `Pressable` has a visible text label ("Upload media" / "Attach media (optional)"), so no icon-only-control accessibility gap.
2. Minor, not fixed: the media-pick `Pressable` has no `accessibilityRole="button"`, but since it carries a visible `Text` label this is a soft nit, not a genuine barrier (screen readers generally pick up the text content as the accessible name for a plain `Pressable`).

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; no changes made.

**Status:** AUDITED-NO-ISSUES

---

## HealthManagementModal (`src/screens/tabs/profile-screen/HealthManagementModal.tsx`)

**Entry point:** `ProfileScreen.tsx`'s management-panel Modal, rendered when `managementPanelKey === 'health'`.

### Findings
1. None. Per carried-forward context, `VerificationStatusCard`'s title/subtitle prop bug was already fixed earlier this session and this file correctly passes both (`title="Health verification center"`, `subtitle="Submit private licensing..."`) — no re-verification needed, just confirmed the call site still looks correct post-fix.
2. Tier-limit text correctly branches on "unlimited" vs. numeric limit (`${institutions.length}/${healthInstitutionLimit} institutions used` vs. open-ended count) — good small detail, no off-by-one or NaN risk since `healthInstitutionLimit` is parsed with `Number.isFinite` guard.
3. No destructive actions in this file itself (delete/edit of institutions is delegated to `InstitutionsListScreen`, out of scope).

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review; no changes made.

**Status:** AUDITED-NO-ISSUES

---

## PrivacyModal (`src/screens/tabs/profile-screen/PrivacyModal.tsx`)

**Entry point:** `ProfileScreen.tsx`'s `BottomSheet` host, rendered when `c.activeSheet === 'privacy'`.

### Findings
1. **No "unsaved changes" guard on dismiss (P3, not fixed).** All edits (`setDraftPrivacy`, custom-viewer add/remove) live in local component/controller state until "Save privacy" is tapped; closing the sheet via the backdrop or header "×" (handled by `BottomSheet`/`SheetHeader`, out of scope) discards changes with no warning. Low severity — privacy-visibility toggles are easily redone and there's no data-loss risk beyond re-tapping a few chips — but worth flagging since it's a form with meaningful state.
2. **"Remove" control for a custom privacy target is correctly labeled and sized** — uses `minHeight`/`minWidth: responsive.minTouchTarget` and has a visible "Remove" text label, so no touch-target or accessibility gap despite being a small chip-style control.
3. Good use of `responsive.labelFontSize` throughout for text scaling, and clear visual distinction between "Visible on profile" vs. "No current content" badges per field. No contrast issues against `palette.surface`/`palette.primarySoft`.

### Fixes implemented
None — the unsaved-changes gap (finding 1) would require touching `BottomSheet`'s dismiss handling, which is outside this file and risks altering shared sheet-dismissal behavior for every other sheet type; documenting rather than fixing to stay within the "no navigation/structure changes" constraint.

### Verification
Read-only review; no changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## UpgradeModal (`src/screens/tabs/profile-screen/UpgradeModal.tsx`)

**Entry point:** `ProfileScreen.tsx`'s `BottomSheet` host, rendered when `c.activeSheet === 'upgrade'`.

### Findings
1. None to assess directly — this is a 21-line pure delegate (`return <UpgradeSheet {...props} />;`) with no logic, no rendering, and no state of its own. All real UX surface (tier comparison, payment, cancel/resume/downgrade flows, error handling) lives in `UpgradeSheet` (`profile/sheets/UpgradeSheet.tsx`), which is outside this pass's file list.

### Fixes implemented
None — meets the bar as-is (nothing to fix in a pure pass-through).

### Verification
Read-only review; no changes made.

**Status:** AUDITED-NO-ISSUES

---

## profile-screen support files: constants.ts, helpers.ts, index.ts, selectors.ts, types.ts

**Entry point:** N/A — imported by `ProfileScreen.tsx` and the modal files above.

### Findings
1. **`helpers.ts` (`countProducts`)** — pure reducer over a shops array, no network calls, nothing to audit for error handling.
2. **`selectors.ts` (`getSheetTitle`, `getPartnerLimitText`)** — pure string-selection functions, no network calls, no error handling needed. `getSheetTitle`'s final `return 'Wallet & Coins'` fallback silently catches any unrecognized `activeSheet` value as "Wallet & KIS-Coins" rather than e.g. an empty string, which is a defensible default (there's always *some* sheet title needed) and not a bug.
3. **`constants.ts`** — pure data/config (health institution type → feature-capability lookup tables, broadcast profile definitions with their `summary`/`emptySummary` text). No logic beyond `Array.from(new Set(...))` merges; nothing network- or state-related.
4. **`types.ts`** — type-only file, no runtime behavior.
5. **`index.ts`** — barrel re-export, no runtime behavior.

### Fixes implemented
None — all five are pure support files with no network calls or error-handling surface, per the audit brief's own expectation.

### Verification
Read-only review; no changes made.

**Status:** AUDITED-NO-ISSUES

---

## callsTabHelpers (`src/screens/tabs/MesssagingSubTabs/callsTabHelpers.ts`)

**Entry point:** `CallsTab.tsx`'s `handleCallback`, used when a user taps a call-history row to call someone back.

### Findings
1. None — this is a single pure function (`resolveCallbackInvitees`) with an unusually thorough in-code explanation of the real bug it fixes (call-history rows sourced from local cache carry no `participants` array, only a `participantCount`, so trusting the record directly could silently start a call with zero invitees). The existing test file (`__tests__/callsTabHelpers.test.ts`, not modified) exercises all four real scenarios: live-participants preferred, current-user excluded, server-sourced fallback, and the documented "both sources empty → returns `[]`, caller must guard" case. The implementation matches every assertion in the test file exactly — no gap between documented/tested behavior and actual behavior.
2. No network calls, so no error-handling surface to audit. The function's contract (return `[]` rather than throwing when it can't resolve invitees) correctly pushes the "can't call back, show an alert" decision to the call site, which is the right separation of concerns for a pure helper.

### Fixes implemented
None — meets the bar as-is.

### Verification
Read-only review (plus reading the existing test file to confirm no behavioral drift); no changes made.

**Status:** AUDITED-NO-ISSUES
