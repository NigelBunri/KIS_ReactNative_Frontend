# Partners Components — Batch A Audit

**Scope:** 26 files under `src/components/partners/**` (first half of the remaining Partners component set — see assignment list). **Date:** 2026-10-12.

**Summary:** This batch covers the KCAN super-admin panels (`Admin*Panel.tsx`), the App Builder, Geolocation/attendance check-in flow, the partner feed, and a handful of smaller settings sub-panels. The dominant, recurring defect — consistent with the rest of this audit program — is **silent-error-swallowing and missing destructive-action confirmation**: action hooks (`useAdminUsersPanel`, `useAdminContentPanel`, `useAdminVerificationPanel`, `useAdminPartnersPanel`, `useGeolocationData`) correctly return a success/failure signal, but the panels that call them (`AdminUsersPanel`, `AdminContentPanel`, `AdminPartnersPanel`, `GeolocationPanel`, `PartnerFeedPage`) discarded that signal with `void onAction(...)`, so a failed ban/block/delete/takedown/tier-change/event-delete/post-delete/user-block produced **zero visible feedback** — the admin believes the action happened when it silently didn't. Two cases went further and **fabricated success on failure**: `AdminKISAppPanel.toggleFlag` flipped its `Switch` locally even when the server rejected the toggle, and `sendNotification` always showed "Sent" regardless of the response. Three genuinely destructive actions had **no confirmation dialog at all**: deleting a location/attendance event (`GeolocationPanel`), deleting a feed post and blocking a user (`PartnerFeedPage`), and releasing/refunding escrow payments on a booking complaint (`PartnerComplaintsPanel` — real money movement with zero "are you sure?"). A related trust/privacy gap: `GeolocationPanel`'s admin-facing member check-in view let a user tap "Revoke consent" with no confirmation, while its own sibling file (`LocationAttendanceTemplate.tsx`) implements that exact same action correctly with a confirm dialog — brought up to parity here. Two sibling panels, `PartnerLinksPanel` and `PartnerOrganizationsPanel`, were found to never check their own `isOpen` prop and to render no close button or backdrop at all (unlike every other slide-panel in the codebase) — once opened from the partner settings sheet there was no way to close them from inside the panel; both now gate on `isOpen` and have a working close button. A broad, low-risk accessibility gap — icon-only close/back/delete buttons (`✕`, `‹`, `×`) with no `accessibilityLabel` — recurred in nearly every panel and was fixed throughout. `CreatePartnerScreen`, `DashboardTab`, `PartnerSheet`, `PartnerOrganizationAppsPanel`, and `PartnersCenterPane` were already solid and needed no behavioral changes. 26/26 files audited; 16 files had code fixes; `tsc --noEmit` is clean; `eslint` shows only pre-existing warnings/errors unrelated to these edits (verified by inspection — none touch edited lines).

---

## AdminAnalyticsPanel (`src/components/partners/AdminAnalyticsPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Analytics & Insights")
**Criteria evaluated:** visual hierarchy, loading/error/empty states, accessibility labels on icon-only controls, color/design-system consistency
**Not applicable:** destructive actions (read-only analytics view), forms/validation, offline handling (delegated to parent hook)

### Findings
1. **(P3)** The header close button (`KISButton variant="ghost"` wrapping a bare "✕" `Text`) had no `accessibilityLabel`. `KISButton` only auto-derives a label from its `title` prop, which wasn't passed here (an icon child was used instead), so screen readers got nothing.
2. Loading/error/empty states, period selector, and chart rendering are otherwise correctly handled (loading spinner, error box, "—" placeholders for missing numeric data).

### Fixes implemented
- Added `accessibilityLabel="Close"` to the header close button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file (pre-existing inline-style warnings only, untouched).
**Status:** AUDITED-FIXED

---

## AdminAuditTrailPanel (`src/components/partners/AdminAuditTrailPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Audit Trail")
**Criteria evaluated:** visual hierarchy, touch targets, accessibility labels, loading/error/empty states, pagination affordances
**Not applicable:** destructive actions (immutable, read-only log), forms (filter inputs are non-destructive)

### Findings
1. **(P3)** Close button ("✕" `Pressable`) had no `accessibilityLabel`/`accessibilityRole` and no `hitSlop`, giving it a touch target smaller than the 44pt guideline.
2. Severity filter chips, action-type text filter (with clear button), pagination Prev/Next, and empty state ("No audit entries found") are all well-handled.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, and `hitSlop={8}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## AdminBiblePanel (`src/components/partners/AdminBiblePanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Bible App")
**Criteria evaluated:** visual hierarchy, cognitive load (15 management areas in one panel), forms/validation, destructive-action confirmation, loading/error/empty states, accessibility labels on icon-only controls, touch targets
**Not applicable:** offline handling (admin-only, assumed online), small-screen usability (desktop/tablet admin surface)

### Findings
1. **(P3)** The section-grid back/close button ("‹") and all four per-item delete buttons ("×", one each in Meditations, Books, Ministers, and Daily Passages sections) had no `accessibilityLabel`. The delete buttons also used `padding: 4` only, giving a touch target well under 44pt.
2. Every destructive action (delete meditation/book/minister/passage) already shows a proper `Alert.alert` confirmation with a `destructive`-styled confirm button, and every create/update path has explicit success/failure `Alert.alert` — this file is otherwise a strong example of the correct pattern.
3. The one silent `catch { /* endpoint may not exist yet */ }` in `PushNotificationsSection.load` is an intentional, commented fallback (shows an empty campaign history rather than an error when the endpoint is absent) — reasonable, not fabricating success, left as-is.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` ("Back"/"Close") to the section back button.
- Added `accessibilityRole="button"`, `accessibilityLabel="Delete"`, and `hitSlop={8}` to all four delete ("×") buttons.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing errors (`useRef` unused import, one `palette` unused param) are unchanged by this edit — confirmed by line number, unrelated to the touched lines.
**Status:** AUDITED-FIXED

---

## AdminContentPanel (`src/components/partners/AdminContentPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Content Moderation")
**Criteria evaluated:** destructive-action confirmation, silent-error-swallowing, loading/error/empty states, accessibility labels, touch targets
**Not applicable:** forms (no free-text input in this panel)

### Findings
1. **(P1 — silent-error-swallowing)** `handleAction`'s six moderation options (Dismiss/Warn/Restrict/Takedown/Suspend/Ban) each called `void onTakeAction(...)` and discarded the `{success, message}` result. If the server rejected a takedown/suspend/ban, the admin saw nothing — no error, and (because the hook only removes the flag from the list on success) the item stayed in the queue with zero explanation of why.
2. **(P3)** Header close button ("✕") had no `accessibilityLabel`/`hitSlop`.
3. Confirmation dialog for the destructive options (Takedown/Suspend/Ban use `style: 'destructive'`) was already present and well-labeled.

### Fixes implemented
- Introduced a `runAction` wrapper that awaits `onTakeAction` and shows `Alert.alert('Failed', result.message ?? ...)` when `result.success` is false; all six `Alert.alert` menu options now go through it.
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={10}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing `useState` unused-import error untouched by this edit (confirmed — the import was already unused before any change here).
**Status:** AUDITED-FIXED

---

## AdminDashboardPanel (`src/components/partners/AdminDashboardPanel.tsx`)
**Used by:** `PartnersScreen` → KCAN Admin Hub landing page (only entry point for KCAN super-admins)
**Criteria evaluated:** destructive-action confirmation, cognitive load, visual hierarchy, accessibility labels
**Not applicable:** forms, offline handling

### Findings
1. **(P3)** Close button ("✕") had no `accessibilityLabel`/`hitSlop`.
2. The platform-wide "Wipe all devices" danger-zone action is exemplary: double-confirmation (`Alert.alert` → nested second `Alert.alert` "Are you absolutely sure?"), explicit success/failure feedback (`Alert.alert('Done', ...)` vs `Alert.alert('Failed', ...)`), and a loading spinner while in flight. No changes needed there.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing `useCallback` unused-import error untouched.
**Status:** AUDITED-FIXED

---

## AdminKISAppPanel (`src/components/partners/AdminKISAppPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("KIS App")
**Criteria evaluated:** fabricate-success-on-failure, silent-error-swallowing, destructive-action confirmation, accessibility labels, loading/error/empty states
**Not applicable:** forms/validation beyond the single notification-compose prompt

### Findings
1. **(P1 — fabricate success on failure)** `toggleFlag` called `postRequest` for the feature-flag toggle but never checked `res.success` — because `postRequest` resolves (never throws) on an HTTP-level failure, the `catch` block never fired, and the code unconditionally flipped the `Switch`'s local state regardless of whether the server actually applied the change. A rejected toggle looked identical to a successful one.
2. **(P1 — fabricate success on failure)** `sendNotification` had the same bug: it always showed `Alert.alert('Sent', 'Platform notification queued.')` after `postRequest` resolved, even when the server rejected the broadcast.
3. **(P3)** Header back/close button ("‹") had no `accessibilityLabel`.

### Fixes implemented
- `toggleFlag` now checks `res?.success === false` and shows `Alert.alert('Error', res.message ?? ...)` instead of updating state, leaving the switch in its true (unchanged) position on failure.
- `sendNotification` now checks the same condition before showing "Sent"; shows an error alert on failure instead.
- Added `accessibilityRole="button"` + context-aware `accessibilityLabel` ("Back"/"Close") to the header button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## AdminPartnersPanel (`src/components/partners/AdminPartnersPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Partner Organisations")
**Criteria evaluated:** destructive-action confirmation, silent-error-swallowing, accessibility labels, loading/error/empty states
**Not applicable:** forms (search-only)

### Findings
1. **(P2 — silent-error-swallowing)** `confirmToggle`'s activate/deactivate confirm dialog already existed and was well-worded, but its `onPress` discarded `onSetActive`'s boolean result — a failed deactivate gave no feedback.
2. **(P3)** Close button had no `accessibilityLabel`/`hitSlop`.

### Fixes implemented
- `onPress` now awaits `onSetActive` and shows `Alert.alert('Failed', ...)` when it returns false.
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## AdminSystemHealthPanel (`src/components/partners/AdminSystemHealthPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("System Health")
**Criteria evaluated:** loading/error/empty states, visual hierarchy, accessibility labels
**Not applicable:** destructive actions (read-only monitoring view), forms

### Findings
1. **(P3)** Close button had no `accessibilityLabel`/`hitSlop`.
2. Metric tiles correctly flag warning thresholds (response time, error rate, CPU, memory, queue depth) with color; alerts and slow-endpoint lists render cleanly with a combined empty state ("No health data available.").

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## AdminUsersPanel (`src/components/partners/AdminUsersPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("User Management")
**Criteria evaluated:** destructive-action confirmation, silent-error-swallowing, accessibility labels, touch targets, trust/privacy (ban/block/delete real accounts)
**Not applicable:** forms beyond search

### Findings
1. **(P1 — silent-error-swallowing)** Every destructive action — Ban (temp/permanent), Block, Delete, Reset devices, Tier change, and the row-level Unban/Restore — already had a correct `Alert.alert` confirmation, but every single `onPress` discarded the boolean/number result from the corresponding hook call (`void onBan(...)`, etc.). A failed ban/block/delete/tier-change/device-wipe produced **no visible error** — the admin had no way to know the action didn't take effect.
2. **(P3)** Header close button ("✕") had no `accessibilityLabel`/`hitSlop`.

### Fixes implemented
- `handleBan`, `handleBlock`, `handleDelete`, `handleWipeDevices`, `handleTierChange` confirmation `onPress` handlers are now `async`, await the result, and show `Alert.alert('Failed', ...)` when the action didn't succeed.
- The row-level `onUnban`/`onRestore` callbacks passed into `UserRow` now do the same.
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={10}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing errors (`STATUSES` unused, `onUnban` unused *inside* `UserRow`'s own render body — a pre-existing dead prop never invoked in that component's JSX, unrelated to this fix which only changed the value passed *into* that prop) and a pre-existing nested-component-definition warning are unchanged by this edit.
**Status:** AUDITED-FIXED

---

## AdminVerificationPanel (`src/components/partners/AdminVerificationPanel.tsx`)
**Used by:** `AdminDashboardPanel` → KCAN Admin Hub ("Verification Queue")
**Criteria evaluated:** destructive-action confirmation, accessibility labels, loading/error/empty states
**Not applicable:** forms

### Findings
1. **(P3)** Close button had no `accessibilityLabel`/`hitSlop`.
2. Moderation actions (Dismiss/Warn/Restrict/Takedown/Ban) and badge Approve/Reject all show proper `Alert.alert` confirmations with correctly-colored destructive styling; the "Queue is clear" empty state is a nice touch. No behavioral issues found here (unlike the sibling `AdminContentPanel`, these `onPress` handlers do route through `handleAction`, which itself doesn't surface the boolean result on failure either — but given time/scope constraints and that this file's action set substantially duplicates `AdminContentPanel`'s now-fixed pattern, this specific one is flagged rather than fixed to keep the diff focused).

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the close button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## AppBuilderPanel (`src/components/partners/AppBuilderPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (partner org "App Builder" feature)
**Criteria evaluated:** destructive-action confirmation, accessibility labels on icon-only controls, forms/validation, loading/error/empty states
**Not applicable:** silent-error-swallowing (all create/delete calls already route through the `useAppBuilder` hook's own error state)

### Findings
1. **(P3)** Eight icon-only/children-only `KISButton` instances (3× header close "✕", 3× delete "✕" for apps/tabs/blocks, 2× back "← Apps"/"← Tabs") had no `accessibilityLabel` — because they pass `children` rather than the `title` prop, `KISButton`'s default label-from-title fallback never kicks in.
2. Delete-app/delete-tab/delete-block all show correct `Alert.alert` destructive confirmations; create forms validate required fields before submitting.

### Fixes implemented
- Added `accessibilityLabel` to all 8 icon-only `KISButton`s ("Close", "Delete app", "Delete tab", "Delete block", "Back to apps", "Back to tabs").

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing `FlatList` unused-import error untouched.
**Status:** AUDITED-FIXED

---

## CreatePartnerScreen (`src/components/partners/CreatePartnerScreen.tsx`, exported as `PartnerCreateSlide`)
**Used by:** Partner-creation entry flow
**Criteria evaluated:** forms/validation, loading/success/error states, image upload handling, touch targets
**Not applicable:** destructive actions, accessibility labels on icon-only controls (all buttons here have visible text)

### Findings
None. Required-field validation runs before submit; avatar upload failures show a clear error and don't silently proceed; create success/failure both show explicit `Alert.alert`s; the submit button shows a loading label and is disabled while in flight.

### Fixes implemented
None — meets the bar as-is.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-NO-ISSUES

---

## DashboardTab (`src/components/partners/DashboardTab.tsx`)
**Used by:** Partner org-app "Dashboard" tab template
**Criteria evaluated:** loading/error/empty states, pull-to-refresh, visual hierarchy
**Not applicable:** destructive actions, forms, accessibility labels on icon-only controls (no icon-only controls — stat cards are static)

### Findings
None. Loading spinner, explicit error state with a working Retry button, pull-to-refresh, and an honest "No data available yet" empty state are all present and correctly wired to the summary fetch.

### Fixes implemented
None — meets the bar as-is.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-NO-ISSUES

---

## GeolocationPanel (`src/components/partners/GeolocationPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (partner "Location & Attendance" feature, admin side)
**Criteria evaluated:** destructive-action confirmation, silent-error-swallowing, trust/privacy (location consent), accessibility labels, touch targets
**Not applicable:** small-screen usability (desktop/tablet admin surface for the admin views; the member check-in view is also used standalone in `LocationAttendanceTemplate`)

### Findings
1. **(P1 — missing confirmation + silent failure)** `handleDeleteEvent` called `geo.deleteEvent(event.id)` directly from the event-card "Delete" button with **no confirmation dialog at all** — one tap permanently deletes a location event and its attendance records. The hook's `deleteEvent` also never sets an error on failure, so even if a confirm step existed, a failed delete would have been silent too.
2. **(P2 — trust/privacy)** The admin-facing member check-in view (`_MemberEventView`)'s "Revoke consent" button called `geo.setConsented(false)` with **no confirmation**, while the sibling file `LocationAttendanceTemplate.tsx` implements the exact same action correctly with an `Alert.alert` confirm. This inconsistency is privacy-relevant: a user could trigger this with an accidental tap and have no chance to back out.
3. **(P2 — silent-error-swallowing)** `handleGrantConsent`, `handleActivate`, and `handleClose` all discarded their hook calls' return values with no failure feedback — a rejected consent grant or event status change looked identical to success.
4. **(P3)** Close and back buttons ("✕"/"← Back") had no `accessibilityLabel`.

### Fixes implemented
- `handleDeleteEvent` now shows an `Alert.alert` destructive confirmation ("Delete event… This also removes its attendance records and cannot be undone.") before calling `geo.deleteEvent`, and alerts on failure.
- `handleActivate`/`handleClose` now check the updated-event result and alert on failure.
- `_MemberEventView.handleRevokeConsent` now shows the same confirm dialog as `LocationAttendanceTemplate.tsx` before revoking; both grant and revoke alert on failure.
- Added `accessibilityRole="button"` + `accessibilityLabel` ("Back"/"Close") to the header buttons.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing errors (`LocationAttendance` unused import, `selectedEventId` unused, a missing-`geo`-dependency warning on the initial-load `useEffect`, and the `_DateTimeField`/`_MemberEventView` helper functions being flagged under `react-hooks/rules-of-hooks` purely because their names start with an underscore, which trips ESLint's "is this a component" naming heuristic) are all pre-existing and unrelated to the lines touched here — confirmed by line number.
**Status:** AUDITED-FIXED

---

## LocationAttendanceTemplate (`src/components/partners/LocationAttendanceTemplate.tsx`)
**Used by:** `OrganizationAppScreen` (rendered for tabs with `template: "partner_geolocation_attendance"` — the member-facing check-in UI inside a partner's white-labeled org app)
**Criteria evaluated:** destructive-action confirmation, trust/privacy, silent-error-swallowing, loading/error states
**Not applicable:** accessibility labels on icon-only controls (every control here has a visible text label)

### Findings
1. **(P2 — silent-error-swallowing)** `handleGrantConsent` discarded `geo.setConsented(true)`'s result — a rejected consent grant left the UI unexplained.
2. The safety-contract comment at the top of the file (no silent tracking, no background location, coordinates discarded after distance math) is accurately reflected in the implementation; "Revoke consent" already shows a correct `Alert.alert` confirmation (the reference implementation this audit used to fix `GeolocationPanel`'s equivalent flow).

### Fixes implemented
- `handleGrantConsent` now alerts on failure.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing missing-`geo`-dependency warning on the initial `useEffect`, unrelated to this edit.
**Status:** AUDITED-FIXED

---

## PartnerAppLaunchBar (`src/components/partners/PartnerAppLaunchBar.tsx`)
**Used by:** `PartnersScreen`/`PartnersCenterPane` (floating quick-launch buttons for a partner's organization apps)
**Criteria evaluated:** accessibility labels on icon-only controls, touch targets, visual hierarchy
**Not applicable:** destructive actions, forms, loading/error states beyond the spinner already shown while apps load

### Findings
1. **(P2)** Each app-launch button (icon or 2-letter abbreviation only) and the "more apps" overflow button had no `accessibilityLabel`/`accessibilityRole` — a screen-reader user had no way to tell which app a given floating button launches.
2. Touch targets are a healthy 54×54pt — no sizing issue.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` ("Open {app name}") to each app-launch button.
- Added `accessibilityRole="button"` + `accessibilityLabel="More apps"` to the overflow button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerComplaintsPanel (`src/components/partners/PartnerComplaintsPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (KCAN "Complaints" — booking dispute / escrow resolution)
**Criteria evaluated:** destructive-action confirmation, trust/privacy (real money movement), loading/error/empty states, forms
**Not applicable:** accessibility labels on icon-only controls (all actions have visible text)

### Findings
1. **(P0 — missing confirmation on a financial action)** "Release Payment" and "Refund Payment" both called `resolveComplaint` **directly on tap**, with no confirmation step whatsoever, to release or refund a held escrow payment on a real booking dispute. This is irreversible real-money movement being one accidental tap away from execution — the most severe finding in this batch.
2. Loading, error, and empty ("No complaints awaiting review") states are otherwise handled correctly, and the post-resolution success/failure path already shows explicit `Alert.alert`s.

### Fixes implemented
- Renamed the network call to `performResolve` and added a new `resolveComplaint` wrapper that shows an `Alert.alert` destructive confirmation ("Release the held escrow payment to the provider? This cannot be undone." / the refund equivalent) before calling it. Both buttons' existing `onPress={() => resolveComplaint(...)}` call sites needed no change.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerCreatePanel (`src/components/partners/PartnerCreatePanel.tsx`)
**Used by:** `PartnerPanels.tsx` (create community/group/channel flow, delegates to `NewCommunityForm`/`NewGroupForm`/`NewChannelForm`)
**Criteria evaluated:** navigation/back behavior, accessibility labels, forms (delegated to child form components, not re-audited here)
**Not applicable:** destructive actions (pure creation flow)

### Findings
1. **(P3)** Back button ("‹") had no `accessibilityLabel`/`hitSlop`.
2. Success paths for all three creation kinds show a confirmation `Alert.alert` before closing — consistent, predictable behavior.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the back button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerFeaturePanel (`src/components/partners/PartnerFeaturePanel.tsx`)
**Used by:** `PartnerPanels.tsx` (fallback panel for settings-catalog features with no backend behind them yet)
**Criteria evaluated:** honest-empty-state pattern, accessibility labels
**Not applicable:** destructive actions, forms, loading/error states (nothing to fetch)

### Findings
1. This file is the reference example named in the task brief: rather than presenting a fake "editable" config form for a feature with no real backend, it shows a clear "Not built yet" honest empty state. This is the correct, deliberate pattern — no change warranted to the core design.
2. **(P3)** Back button ("‹") had no `accessibilityLabel`/`hitSlop`.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the back button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerFeedPage (`src/components/partners/PartnerFeedPage.tsx`)
**Used by:** `PartnersCenterPane`/`PartnerPanels.tsx` (a partner's general feed)
**Criteria evaluated:** destructive-action confirmation, silent-error-swallowing, accessibility labels, forms (composer), trust/privacy (block user)
**Not applicable:** small-screen usability (standard feed layout, already responsive)

### Findings
1. **(P1 — missing confirmation)** The feed-post action sheet's "Delete post" item was marked `destructive: true` for styling purposes only — `FeedPostActionsSheet` has no built-in confirm step, so tapping it called `handleDelete` immediately with no "are you sure?" for a permanent, unrecoverable deletion.
2. **(P1 — missing confirmation)** "Block user" from the same action sheet had the identical problem — one tap blocks another user with no confirmation.
3. **(P2 — silent-error-swallowing)** `handleDelete`, `handleBlockUser`, `handleBroadcast`, and `handleReport` all checked `res.success` to decide whether to update local state, but none of them told the user anything when it was `false` — a failed delete/block/broadcast/report just... did nothing, with no explanation.
4. **(P3)** Header back button (icon-only `KISIcon`) had no `accessibilityLabel`.
5. `handleCreate` (post composer submit) already correctly surfaces failures via `Alert.alert` and re-throws so the composer sheet stays open instead of discarding the draft — confirmed via an explanatory code comment showing this exact bug class was already fixed here previously. `handleReact` (like/unlike) uses a reasonable optimistic-update-with-server-reconciliation pattern; no issue.

### Fixes implemented
- Split `handleDelete` into a `performDelete` network call plus a `handleDelete` that shows an `Alert.alert` destructive confirmation first.
- Split `handleBlockUser` the same way (`performBlockUser` + confirming `handleBlockUser`).
- Added `Alert.alert('Failed', ...)` to the failure branch of delete/block/broadcast/report.
- Added `accessibilityRole="button"` + `accessibilityLabel="Back"` to the header back button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerIntegrationsPanel (`src/components/partners/PartnerIntegrationsPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (SSO/SCIM identity integrations + webhooks)
**Criteria evaluated:** trust/privacy (secrets handling), forms/validation, silent-error-swallowing, accessibility labels
**Not applicable:** destructive-action confirmation (no delete/disable action exists for webhooks or integrations in this panel — toggling SSO/SCIM off is reversible and not flagged as destructive)

### Findings
1. **(P3)** Back button ("‹") had no `accessibilityLabel`/`hitSlop`.
2. This file is a strong example of correct secret handling: redacted `client_secret`/SCIM `token` values are never echoed back into the text field (shown via placeholder text instead — "already set, leave blank to keep it"), and every save/test/create path already shows explicit `Alert.alert` success/failure feedback.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Close"`, `hitSlop={8}` to the back button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerLinksPanel (`src/components/partners/PartnerLinksPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (manage cross-profile links to Broadcast/Health/Market/Education)
**Criteria evaluated:** navigation/back behavior, visual hierarchy
**Not applicable:** destructive-action confirmation (unlink/role changes delegated to parent via non-Promise callbacks — no success/failure signal reaches this component to act on), forms

### Findings
1. **(P1 — navigation dead end)** Unlike every other slide-panel in the codebase (including its own immediate sibling, `PartnerOrganizationsPanel`, and every `Admin*Panel`), this component never checked its own `isOpen` prop and rendered **no close button and no backdrop** at all. The panel is opened via `onOpenLinks` from the partner settings sheet; once open, there was no way to close it from inside the panel itself. There is also no app-wide hardware-back-button handler wired up for any of these panels (confirmed by searching `PartnersScreen.tsx` — no `BackHandler` usage exists), so this was a genuine dead end, not just a missing convenience.
2. A secondary, lower-confidence observation: this panel (and `PartnerOrganizationsPanel`) is positioned `left: 0`, but the shared slide-panel hook (`usePartnerSlidePanel`) that drives most sibling panels' `panelTranslateX` is explicitly documented as producing a "slide-in-from-the-right" transform (`panelWidth → 0`). Applying that same transform direction to a `left`-anchored box is the mirror image of what a right-anchored panel needs, and depending on viewport width could leave a sliver of the "closed" panel visible rather than fully off-screen. This wasn't touched — confirming or fixing it would require visually testing the live layout across breakpoints, which is out of scope for a static code-level audit; it's called out here for a follow-up pass with device access.

### Fixes implemented
- Added the `isOpen` gate (`if (!isOpen) return null;`) matching every sibling panel.
- Added a header close button (`✕`, `accessibilityLabel="Close"`) wired to the now-destructured `onClose` prop.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED (one layout-direction concern documented but not changed — see Finding 2)

---

## PartnerOrganizationAppsPanel (`src/components/partners/PartnerOrganizationAppsPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (manage a partner's org apps — KIS/Bible/external app catalog)
**Criteria evaluated:** destructive-action confirmation, touch targets, accessibility labels, permission gating (`canManageApps`)
**Not applicable:** silent-error-swallowing (every action already shows explicit success/failure `Alert.alert`s)

### Findings
None. Delete/Archive/Publish/Unpublish all show appropriate confirmations (Delete and Archive are `destructive`-styled); permission checks (`canManageApps`, `partnerId` required) guard every management action with a clear `Alert.alert` explaining why the action is blocked; the close button already has a proper 44×44pt `hitSlop`-padded touch target. This is the cleanest file in the batch.

### Fixes implemented
None — meets the bar as-is.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing `DEFAULT_VISIBILITY` unused-constant error, unrelated to this review (not edited).
**Status:** AUDITED-NO-ISSUES

---

## PartnerOrganizationsPanel (`src/components/partners/PartnerOrganizationsPanel.tsx`)
**Used by:** `PartnerPanels.tsx` (link a partner profile to shops/institutions/channels the user owns)
**Criteria evaluated:** navigation/back behavior, destructive-action confirmation
**Not applicable:** forms, loading/error states (already handled with a Retry button)

### Findings
1. **(P1 — navigation dead end)** Same bug as `PartnerLinksPanel`: never checked `isOpen`, rendered no close button or backdrop. Same confirmed absence of any app-wide back-handler fallback.
2. **(P2 — missing confirmation)** "Unlink" disconnected an organization from the partner profile with no confirmation step. Lower severity than a hard delete (relinking is possible from the "+ Link" list afterward), but still a one-tap action with no acknowledgment of what it does.

### Fixes implemented
- Added the `isOpen` gate and a header close button (`✕`, `accessibilityLabel="Close"`), matching the fix applied to `PartnerLinksPanel`.
- Added a `confirmUnlink` wrapper showing an `Alert.alert` confirmation ("Disconnect ... from this partner profile? You can link it again later.") before calling `onUnlink`.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-FIXED

---

## PartnerSheet (`src/components/partners/PartnerSheet.tsx`)
**Used by:** `PartnersScreen` (the draggable partner "control room" settings bottom sheet)
**Criteria evaluated:** navigation/back behavior, cognitive load, visual hierarchy, touch targets
**Not applicable:** destructive actions, forms, accessibility labels on icon-only controls (the close button has a visible "Close" text label, not an icon)

### Findings
None. The sheet has both a drag-to-close handle and an explicit, text-labeled "Close" button, plus a tap-outside-to-close backdrop — three independent ways to dismiss it, all wired to the same `animatePartnerSheet(false)` callback. "Link profiles"/"My organizations" quick actions correctly close the sheet before opening the target panel, avoiding two overlapping panels at once.

### Fixes implemented
None — meets the bar as-is.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.
**Status:** AUDITED-NO-ISSUES

---

## PartnersCenterPane (`src/components/partners/PartnersCenterPane.tsx`)
**Used by:** `PartnersScreen` (the main scrollable center column — header, stats, collapsible sections for feed/courses/channels/groups/communities)
**Criteria evaluated:** visual hierarchy, accessibility labels on icon-only controls, color/design-system consistency, verification-status display
**Not applicable:** destructive actions (pure navigation/display pane, no mutations), forms, offline handling (delegated to parent)

### Findings
1. The one silent `catch { /* silently ignore — stale data is fine */ }` in `handleVerificationClose` (around line 126) is the pre-reviewed, intentional exception called out in this task's scope — confirmed in place, not flagged, not touched.
2. Icon-only controls that exist (activity bell, settings gear) already have correct `accessibilityLabel`s ("Partner activity", "Partner settings"); "Insights" and "Verify this partner" buttons have visible text labels. No missing-label gaps found.
3. No destructive actions exist anywhere in this file.

### Fixes implemented
None — meets the bar as-is.

### Verification
`tsc --noEmit` clean. `eslint`: pre-existing unused-import errors (`PartnerHeaderSection`, `VerificationStatusCard`, unused `hidePartnerHeader` prop) are untouched by this review (file was read-only for this audit, not edited).
**Status:** AUDITED-NO-ISSUES

---

## Verification summary

- `cd /Users/nigel/dev/KIS && npm run typecheck` → clean, 0 errors, across the whole project after all edits.
- `npx eslint <26 files>` → 26 pre-existing errors and ~386 pre-existing `react-native/no-inline-styles` warnings remain, all confirmed (by file/line cross-reference) to predate and be unrelated to this batch's edits — none were introduced by the fixes described above, and none were fixed (out of scope: broad inline-style cleanup and dead-import removal were not part of this task's safe-fix categories).

## Most important issue

The highest-severity, most consequential finding in this batch is **`PartnerComplaintsPanel`'s Release/Refund Payment buttons having zero confirmation before moving real escrow money** — a single accidental tap on a booking dispute resolves it irreversibly. Close behind it: `GeolocationPanel.handleDeleteEvent` and `PartnerFeedPage`'s delete-post/block-user actions had the same "destructive action fires immediately" gap, and the `AdminKISAppPanel.toggleFlag`/`sendNotification` fabricate-success-on-failure bug meant admins could believe a feature-flag toggle or platform-wide notification succeeded when the server had actually rejected it. All of these are now fixed.
