# Misc Small Domains UX/UI Audit

**Scope:** `src/screens/website-builder/**` (10), `src/screens/profile/**` (7), `src/screens/testimony/**` (6), `src/screens/partners/**` (4), `src/screens/jobs/**` (3), `src/screens/invite/**` (1), `src/screens/chat/**` (1), `src/components/profile/**` (1), `src/components/offline/**` (1), `src/components/messaging/**` (1), `src/components/chat/**` (1).

**Audited: 36 / 36 files.** This batch skews toward CRUD/management screens for website-builder and partner-app admin flows, plus the testimony-sharing network. The single most important class of bug found, repeated across at least nine files in three different domains, is **fabricate-success-on-failure**: `postRequest`/`patchRequest`/`deleteRequest`/`queueableJsonRequest` all resolve `{ success: false, message }` on a backend rejection rather than throwing (by design — see `src/network/post/index.tsx`), but a large number of action handlers only had a `try/catch` with no `if (!res.success)` check, so the `catch` block was dead code and the UI showed "Updated"/"Accepted"/"Application submitted"/etc. and mutated local state optimistically regardless of whether the server actually did anything. This hit real stakes: job applications (`JobsBoardScreen`, `MyApplicationsScreen`), connection requests/accepts (`ConnectionsScreen`, `TalentDiscoverScreen`, `UserProfileScreen`), partner-org-app create/update (`OrganizationAppFormScreen`), and a privacy-relevant contact-link pause/regenerate (`ContactShareLinkScreen`). All found instances were fixed. A second recurring pattern — silently swallowing load failures into an indistinguishable "empty" state (no error, no retry) — was found and fixed in `ConnectionsScreen`, `TestimonyHubScreen`, `TestimonyReachInboxScreen`, `WebsiteWebhooksScreen`, `WebsiteCustomDomainScreen` (which had a worse variant: an infinite spinner with zero error text), and the two files already flagged in the prior inventory pass (`WebsiteFormResponsesScreen`, `WebsiteVisitsScreen` — confirmed and fixed). A third pattern — image/logo upload silently falling back to a device-local file URI on upload failure, which then gets saved as if it were a real remote URL — was found and fixed in `WebsiteBuilderScreen` and `WebsiteThemeScreen`. Numerous icon-only controls were missing `accessibilityLabel`/`accessibilityRole` and were fixed throughout. One missing confirmation (unpublishing a live public website) and one destructive action without confirmation (deleting a saved chat filter) were fixed. Two pairs of files were confirmed as carried-forward, out-of-scope findings (duplicated invite-redemption state machines) and documented but not refactored per instructions.

---

## WebsiteBuilderScreen (`src/screens/website-builder/WebsiteBuilderScreen.tsx`)
**Entry point:** `WebsiteBuilder` (App.tsx:1967)
**Criteria evaluated:** forms/validation/confirmations, destructive actions, loading/error states, fabricate-success-on-failure, accessibility labels, design-system consistency
**Not applicable:** offline/permission states (website publishing inherently requires network); small-screen usability (this is a dense builder console, already uses `ScrollViewContainer` + wrapping chip rows)

### Findings
1. **(P1) Fabricate-success via silent local-URI fallback.** `uploadSectionImage()` caught any upload failure and returned `asset.uri` (the device-local file path) as if it were the uploaded remote URL. A hero-banner/about/gallery image whose upload failed would silently save with a `file://`/`ph://` URI baked into the section — rendering fine only on the uploading device, broken everywhere else (the published public website, every visitor, every collaborator). No error was ever shown.
2. **(P2) Missing confirmation before unpublishing a live website.** `handleUnpublishWebsite` took the organization's public website offline with a single tap and no confirmation, while the structurally similar "Delete page" and "Delete section" actions both have an `Alert.alert` confirm. Taking a live, possibly customer-facing site offline by accident is a real support request waiting to happen.
3. **(P3) Icon-only drag handle has no accessibility label.** The `≡` menu-icon `Pressable` used to reorder page tabs had no `accessibilityLabel`.

### Fixes implemented
- `uploadSectionImage` now throws instead of swallowing the error; all four call sites (`handlePickSingleImage`, `handlePickSectionBackgroundImage`, `handlePickGalleryImage`, implicitly via the shared helper) already catch and `Alert.alert` on failure, so the failure is now visible instead of silently corrupting saved content.
- `handleUnpublishWebsite` now shows a destructive `Alert.alert` confirmation naming the site before unpublishing, and checks `res.success` before reloading (previously it also skipped the success check entirely).
- Added `accessibilityLabel="Drag to reorder page"` / `accessibilityRole="button"` to the page-tab drag handle.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors (2 pre-existing errors in this file — unused-var-adjacent `react-hooks/exhaustive-deps` on `handleSavePage`'s deps array — predate this pass, not touched).
**Status:** AUDITED-FIXED

---

## WebsiteCollaboratorsScreen (`src/screens/website-builder/WebsiteCollaboratorsScreen.tsx`)
**Entry point:** `WebsiteCollaborators` (App.tsx:1987)
**Criteria evaluated:** destructive actions, fabricate-success-on-failure, design-system consistency
**Not applicable:** forms (invite creation has no free-text fields to validate); accessibility icon labels (all actions here are text buttons, e.g. "Remove"/"Revoke"/"Share")

### Findings
1. **(P1) Fabricate-success on collaborator/invite removal.** `handleRemoveCollaborator` and `handleRevokeInvite` both called `deleteRequest`/`postRequest` and then unconditionally called `load()`, without checking `res.success`. Since these network helpers resolve `{success:false}` rather than throwing, a failed removal/revoke silently refreshed the list with no error — the collaborator or invite code would still be live, with the admin believing it was gone.

### Fixes implemented
- Both handlers now check `res?.success === false` and show `Alert.alert` with the server's message before bailing, instead of unconditionally reloading.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## WebsiteCustomDomainScreen (`src/screens/website-builder/WebsiteCustomDomainScreen.tsx`)
**Entry point:** `WebsiteCustomDomain` (App.tsx:1999)
**Criteria evaluated:** loading/error states, fabricate-success-on-failure, forms/validation
**Not applicable:** accessibility icon labels (no icon-only controls)

### Findings
1. **(P1) Infinite spinner on genuine load failure, with zero error text.** The prior fix noted in-file (comment references "Same fix as WebsiteVisitsScreen") correctly stopped treating the failure-wrapper object as valid data, but the render guard was `loading || !state`, which — on a real failure, with `state` staying `null` and `loading` set `false` in `finally` — left the screen stuck showing *only* a spinner forever, no error message, no retry button, because the spinner branch is also what's shown for `!state`.
2. **(P1) Fabricate-success on domain disconnect.** `handleDisconnect`'s `onPress` called `deleteRequest` then unconditionally `load()`, without checking success — a failed disconnect silently "succeeded" in the UI.

### Fixes implemented
- Added a dedicated `error` state, separated the loading/error/content render branches, and added a "Retry" button on genuine failure.
- `handleDisconnect` now checks `res.success` and alerts on failure before reloading.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors (pre-existing `no-shadow` warning on an unrelated `catch (error)` in `handleConnect`, not touched by this pass).
**Status:** AUDITED-FIXED

---

## WebsiteFormResponsesScreen (`src/screens/website-builder/WebsiteFormResponsesScreen.tsx`)
**Entry point:** `WebsiteFormResponses` (App.tsx:1979)
**Criteria evaluated:** loading/error states, silent-error-swallowing
**Not applicable:** destructive actions (read-only list), accessibility icons (none)

### Findings
1. **(P1, confirmed carried-forward) No error/catch handling at all**, unlike its 8 siblings. `load()`'s `try/finally` had no `catch`, and the call site swallowed via `.catch(() => {})`; a failed request rendered as "No responses yet." — indistinguishable from a website that genuinely has none.

### Fixes implemented
- Added `error` state + retry-button branch, matching the pattern used elsewhere in this domain (`WebsiteBuilderScreen`'s load-error branch, `EmergencyDispatchManager.tsx`'s reference pattern).

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## WebsiteJoinScreen (`src/screens/website-builder/WebsiteJoinScreen.tsx`)
**Entry point:** `WebsiteJoin` (App.tsx:1991)
**Criteria evaluated:** forms/validation, fabricate-success-on-failure, touch targets
**Not applicable:** loading/empty states (no list to load), accessibility icons (no icon-only controls)

### Findings
None. `handleRedeem` correctly checks `res?.success` before showing success vs. error, the submit button is disabled while redeeming and when the code is empty, and the error path is surfaced via `Alert.alert`.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## WebsitePreviewScreen (`src/screens/website-builder/WebsitePreviewScreen.tsx`)
**Entry point:** `WebsitePreview` (App.tsx:1971)
**Criteria evaluated:** loading/error states, navigation/back behavior
**Not applicable:** forms, destructive actions, accessibility icons (none present)

### Findings
None. Missing `previewUrl` is handled with a clear message instead of a blank/crashed WebView; loading spinner overlays correctly during `onLoadStart`/`onLoadEnd`.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## WebsiteTemplatePickerScreen (`src/screens/website-builder/WebsiteTemplatePickerScreen.tsx`)
**Entry point:** `WebsiteTemplatePicker` (App.tsx:2003)
**Criteria evaluated:** loading/error states, silent-error-swallowing
**Not applicable:** destructive actions, accessibility icons

### Findings
1. **(P2) Silent failure on template-list load.** A failed `getRequest` fell through `(res as any)?.data ?? res` to the non-array wrapper object, rendering as "no templates available" with no indication anything went wrong. Not blocking (the "Start From Blank" option still works), but still misleading.

### Fixes implemented
- Added a `templatesError` state with a visible inline notice ("...You can still start from blank below.") rather than silently showing zero templates.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## WebsiteThemeScreen (`src/screens/website-builder/WebsiteThemeScreen.tsx`)
**Entry point:** `WebsiteTheme` (App.tsx:1975)
**Criteria evaluated:** fabricate-success-on-failure, forms/color-picker usability
**Not applicable:** loading/empty states (form is pre-populated from route params, no network GET), accessibility icons (swatches use filled color circles with adjacent labels, not bare icons)

### Findings
1. **(P1) Same local-URI fabricate-success bug as `WebsiteBuilderScreen`.** `uploadLogo()` caught upload failures and returned `asset.uri` (device-local path) as the "uploaded" logo URL, which then gets saved into `branding.logo_url` and would only ever render on the uploading device.

### Fixes implemented
- `uploadLogo` now throws on failure instead of falling back to the local URI; `handlePickLogo` already catches and alerts, so the failure is now visible instead of corrupting saved branding.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## WebsiteVisitsScreen (`src/screens/website-builder/WebsiteVisitsScreen.tsx`)
**Entry point:** `WebsiteVisits` (App.tsx:1995)
**Criteria evaluated:** loading/error states, silent-error-swallowing
**Not applicable:** destructive actions, accessibility icons, forms

### Findings
1. **(P1, confirmed carried-forward) No error/catch handling**, unlike siblings — same pattern as `WebsiteFormResponsesScreen`. The file already had an in-progress fix for the "wrapper object treated as valid data" bug (per its own code comment) but still had no way to show the user an actual error; `!summary` fell through to an indefinite spinner.

### Fixes implemented
- Added `error` state with a retry branch, and tightened the success check (`if (!res?.success) throw ...`) ahead of the existing wrapper-object guard.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## WebsiteWebhooksScreen (`src/screens/website-builder/WebsiteWebhooksScreen.tsx`)
**Entry point:** `WebsiteWebhooks` (App.tsx:1983)
**Criteria evaluated:** loading/error states, destructive actions, fabricate-success-on-failure
**Not applicable:** accessibility icons (text-only controls)

### Findings
1. **(P2) Silent load failure.** Same `?? res` fallback bug as the Form Responses/Visits screens — a failed webhook list load rendered as "No webhooks yet."
2. **(P1) Fabricate-success on webhook delete.** `handleDelete`'s confirm callback called `deleteRequest` then unconditionally `load()` without checking success.

### Fixes implemented
- Added `error` state + retry branch for the list load.
- `handleDelete` now checks `res.success` and alerts on failure before reloading.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors (pre-existing `no-shadow` warning on an unrelated `catch (error)` in `handleCreate`, not touched).
**Status:** AUDITED-FIXED

---

## ConnectionsScreen (`src/screens/profile/ConnectionsScreen.tsx`)
**Entry point:** `Connections` (App.tsx:2071)
**Criteria evaluated:** loading/error states, fabricate-success-on-failure, accessibility labels, touch targets
**Not applicable:** destructive-action confirmation beyond what's already present (Remove already confirms)

### Findings
1. **(P1) Zero error state anywhere in the screen.** None of `fetchMyConnections`, `fetchRequests`, `fetchSuggestions`, or `runSearch` had any error handling; each ended its fallback chain with `?? res`, so a failed request (network down, auth expired, server error) silently rendered as "No connections yet" / "No pending requests" / "No suggestions right now" on all three tabs, with zero retry affordance.
2. **(P1) Fabricate-success on accept/decline/connect.** `handleAccept`, `handleDecline`, and `handleConnect` each wrapped a `patchRequest`/`postRequest` in try/catch with no `res.success` check — since these resolve `{success:false}` rather than throwing, the catch block was dead code, and a connection request would be marked accepted/declined/sent in the UI even if the server rejected it.
3. **(P3) Back button has no accessibility label.**

### Fixes implemented
- Added `listError`/`searchError` state with a Retry button on the "mine"/"requests"/"discover" tabs and the live search.
- All four action handlers now check `res?.success === false` and throw/alert before mutating local state (including `handleRemove`, which already had a confirm dialog but the same dead-catch bug).
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## KISPrinciplesScreen (`src/screens/profile/KISPrinciplesScreen.tsx`)
**Entry point:** `KISPrinciples` (App.tsx:1807)
**Criteria evaluated:** visual hierarchy, typography, color/contrast, accessibility, small-screen usability
**Not applicable:** network/loading/error states (fully static content), destructive actions, forms

### Findings
None. Static content screen; back button already has `accessibilityLabel`/`accessibilityRole`, touch target uses `responsive.minTouchTarget`, cards wrap responsively via `flexBasis: '47%'`.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## ProfileImpactSnapshotScreen (`src/screens/profile/ProfileImpactSnapshotScreen.tsx`)
**Entry point:** `ProfileImpactSnapshot` (App.tsx:1786, modal)
**Criteria evaluated:** loading/error states, forms (filter chips), design-system consistency
**Not applicable:** destructive actions, accessibility icons (filter chips are text-labeled)

### Findings
None. `loadProfile` checks `res.success`, sets a proper `error` state with a Retry button, uses `useKISTheme()` palette tokens throughout, and reloads on `useFocusEffect` so returning to the modal shows fresh data.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## ProfileNotificationDetailScreen (`src/screens/profile/ProfileNotificationDetailScreen.tsx`)
**Entry point:** `ProfileNotificationDetail` (App.tsx:1802, modal)
**Criteria evaluated:** navigation/routing correctness, emotional tone, forms (copy/share actions)
**Not applicable:** loading/error states (renders from route params passed in, no independent fetch), destructive actions

### Findings
None. `buildRouteNotificationData` is deliberately conservative (returns `null`/no "Go to" action rather than guessing a destination for an unrecognized `target_type`), mark-as-read failure is caught and logged without blocking the UI, and the share-link extraction/copy/share actions are well isolated.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## ProfileNotificationsScreen (`src/screens/profile/ProfileNotificationsScreen.tsx`)
**Entry point:** `ProfileNotifications` (App.tsx:1794, modal)
**Criteria evaluated:** loading/error states, accessibility labels, destructive actions
**Not applicable:** forms (toggle-only preferences panel)

### Findings
1. **(P3) Two icon-only controls with no accessibility label** — the chevron "open notification" button and the trash "delete notification" button in each row.
2. **(P3, documented only) Notification delete has no confirmation.** Low severity/deliberately not fixed: deleting a single notification is a common no-confirm "dismiss" pattern elsewhere, and the data lost is low-stakes.

### Fixes implemented
- Added `accessibilityLabel`/`accessibilityRole` to both icon buttons ("Open notification" / "Delete notification").

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## ProfileRecentActivityScreen (`src/screens/profile/ProfileRecentActivityScreen.tsx`)
**Entry point:** `ProfileRecentActivity` (App.tsx:1778, modal)
**Criteria evaluated:** loading/error states, small-screen usability, safe-area handling
**Not applicable:** destructive actions, forms, accessibility icons (chevron is decorative alongside a pressable row, not the sole affordance)

### Findings
1. **(P3) Missing bottom safe-area padding.** Unlike its sibling `ProfileImpactSnapshotScreen` (which adds `insets.bottom` to `contentContainerStyle.paddingBottom`), this screen only applied `topInset` and had no bottom inset — the last activity row could sit flush against the home-indicator area on notched devices.

### Fixes implemented
- Added `useSafeAreaInsets()` and included `insets.bottom` in the scroll content's bottom padding, matching the sibling screen's pattern.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## UserProfileScreen (`src/screens/profile/UserProfileScreen.tsx`)
**Entry point:** `ViewProfile` (App.tsx:2056)
**Criteria evaluated:** loading/error/offline states, fabricate-success-on-failure, accessibility labels
**Not applicable:** destructive actions (no delete-type actions on this screen)

### Findings
1. **(P1) Fabricate-success on skill endorsement.** `handleEndorseSkill` awaited `queueableJsonRequest` and then unconditionally marked the skill "Endorsed" and incremented its count — but `queueableJsonRequest` resolves `{success:false}` on a genuine (non-retryable) backend rejection rather than throwing (see `shouldQueueResult`/`executeAction` in `offlineActionQueue.ts`), so a rejected endorsement (e.g. already endorsed server-side, permission denied) still showed as successful.
2. **(P3) Back button has no accessibility label.**

### Fixes implemented
- `handleEndorseSkill` now checks `res?.success === false` and throws before updating local state (the legitimate offline-queue path, where the request is queued with `success: true, queued: true`, is unaffected and still optimistically marks the skill endorsed, which is correct for that case).
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## DeclareSeasonSheet (`src/screens/testimony/DeclareSeasonSheet.tsx`)
**Entry point:** `DeclareSeasonSheet` (App.tsx:2082, modal)
**Criteria evaluated:** forms/validation, fabricate-success-on-failure, accessibility labels, emotional tone
**Not applicable:** loading/empty states beyond the edit-prefill fetch; small-screen usability (standard scroll form)

### Findings
1. **(P1) Fabricate-success on "Mark as Resolved."** The resolve confirmation's `onPress` called `patchRequest` then unconditionally `navigation.goBack()` without checking `res.success` — a failed resolve silently closed the sheet as if it worked.
2. **(P3) Close icon-only button has no accessibility label.**
3. **(P3, not fixed) Edit-prefill fetch swallows its error** (`.catch(() => {})`), leaving the form blank with no indication load failed; low severity since `canSubmit` stays disabled (category required), so it can't silently create a duplicate/wrong-data season — it can only visibly fail to let the user proceed.

### Fixes implemented
- "Mark as Resolved" now checks `res.success` and alerts on failure instead of unconditionally navigating back.
- Added `accessibilityLabel="Close"` to the close button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## DeclareTestimonySheet (`src/screens/testimony/DeclareTestimonySheet.tsx`)
**Entry point:** `DeclareTestimonySheet` (App.tsx:2083, modal)
**Criteria evaluated:** forms/validation, media upload states, emotional tone, accessibility labels
**Not applicable:** destructive actions beyond what's present (no delete here)

### Findings
1. **(P3) Close icon-only button has no accessibility label.**
2. **(P3, not fixed) Edit-prefill fetch swallows its error**, same low-severity pattern as `DeclareSeasonSheet`.

### Fixes implemented
- Added `accessibilityLabel="Close"` to the close button. (`handleSubmit` already correctly checks `res.success` before declaring success — no fabricate-success bug here, unlike its season sibling.)

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## ReachOutSheet (`src/screens/testimony/ReachOutSheet.tsx`)
**Entry point:** `ReachOutSheet` (App.tsx:2084, modal)
**Criteria evaluated:** forms/validation, emotional tone (connecting someone in crisis with a testimony-holder), accessibility labels
**Not applicable:** destructive actions, loading/error states beyond the testimony-list prefetch (silently empty is acceptable here since the UI already has a distinct, friendly "you haven't shared one yet" empty state that isn't conflated with an error)

### Findings
1. **(P3) Close icon-only button has no accessibility label.**

### Fixes implemented
- Added `accessibilityLabel="Close"` to the close button. (`handleSend` already correctly checks `res.success`.)

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## SeasonsBrowserScreen (`src/screens/testimony/SeasonsBrowserScreen.tsx`)
**Entry point:** `SeasonsBrowser` (App.tsx:2081)
**Criteria evaluated:** loading/error states, accessibility labels, emotional tone
**Not applicable:** destructive actions, forms

### Findings
1. **(P3) Back button has no accessibility label.**

### Fixes implemented
- Added `accessibilityLabel="Go back"` to the back button. (This screen already has the best-in-class error/retry handling in the whole testimony domain — explicit `loadError` state, distinct from the genuine "no one has declared this season yet" empty state — used as the template for fixes applied elsewhere in this domain.)

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## TestimonyHubScreen (`src/screens/testimony/TestimonyHubScreen.tsx`)
**Entry point:** `TestimonyHub` (App.tsx:2080)
**Criteria evaluated:** loading/error states, fabricate-success-on-failure, emotional tone, accessibility labels
**Not applicable:** destructive actions beyond "Resolve" (covered below), forms

### Findings
1. **(P2) Silent failure across all three Promise.allSettled loads.** No error state existed anywhere; if the backend was unreachable, every section fell back to its own "you have nothing yet" empty-state copy ("Your story could change someone's life.", "Sharing what you're going through opens the door..."). For testimony content specifically — people sharing something vulnerable — "we lost your data" and "you genuinely have none" read very differently, and the screen could not tell the user which one happened.
2. **(P1) Fabricate-success on "Mark as Resolved."** Same bug as `DeclareSeasonSheet`: `patchRequest` result was never checked before `setResolvingId(null)` + `loadAll()`.
3. **(P3) Back button has no accessibility label.**

### Fixes implemented
- Added a `loadError` flag (set when *all three* loads failed) with a visible banner + Retry, without blocking partial-success rendering.
- "Mark as Resolved" now checks `res.success` and alerts on failure.
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors (2 pre-existing unused-var errors — `timeAgo`, `topInset` — predate this pass and are unrelated to the edits made).
**Status:** AUDITED-FIXED

---

## TestimonyReachInboxScreen (`src/screens/testimony/TestimonyReachInboxScreen.tsx`)
**Entry point:** `TestimonyReachInbox` (App.tsx:2085)
**Criteria evaluated:** loading/error states, emotional tone, accessibility labels
**Not applicable:** forms; destructive-action confirmation for "Decline" (documented, not fixed — see below)

### Findings
1. **(P2) Silent failure on inbox load.** `loadData` had no `else`/error branch at all — a failed load rendered as "Nothing here yet," which for a reach-out inbox (literally the inbox for people responding to someone's vulnerable testimony) risks reading as "no one reached out" when the real story is "we couldn't check."
2. **(P3) Back button has no accessibility label.**
3. **(P3, documented only) "Decline" has no confirmation.** Low severity by design: it's one of a standard two-button accept/decline binary choice already requiring a deliberate tap, and declining is not data-destructive (the sender's reach-out record isn't deleted, just marked declined).

### Fixes implemented
- Added a `loadError` state with a visible error + Retry branch, distinct from the genuine "Nothing here yet" empty state.
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## OrgAppLaunchScreen (`src/screens/partners/OrgAppLaunchScreen.tsx`)
**Entry point:** `OrgAppLaunch` (App.tsx:1594) — deep-link entry for `kis://org-app/:partnerId/:appId`
**Criteria evaluated:** loading/error states, deep-link robustness
**Not applicable:** forms, destructive actions, accessibility icons

### Findings
None. Handles "app not found" and network failure as two distinct, clearly worded error states, and guards against a race via the `cancelled` flag on unmount.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## OrganizationAppFormScreen (`src/screens/partners/OrganizationAppFormScreen.tsx`)
**Entry point:** `OrganizationAppForm` (App.tsx:1613)
**Criteria evaluated:** forms/validation, fabricate-success-on-failure, accessibility labels
**Not applicable:** loading states (form is seeded synchronously from route params), destructive actions (no delete on this screen)

### Findings
1. **(P1) Fabricate-success on app create/update.** `handleSubmit` awaited `patchRequest`/`postRequest` without checking `res.success` before showing "Updated"/"Created" and navigating back — a validation failure or permission error on this partner-admin screen looked identical to a real save.
2. **(P3) Back button has no accessibility label.**

### Fixes implemented
- Both branches now check `res?.success === false` and throw before showing the success alert, routing into the existing catch-and-alert path instead.
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## OrganizationAppScreen (`src/screens/partners/OrganizationAppScreen.tsx`)
**Entry point:** `OrganizationApp` (App.tsx:1590)
**Criteria evaluated:** loading/error states, accessibility labels, layout-engine correctness (5 layout types × multiple embedded templates)
**Not applicable:** forms (this is a renderer/shell, not a form)

### Findings
1. **(P3) Back chevron (plain `Text` glyph, not `KISIcon`) has no accessibility label.**
2. **(P3, not fixed) `loadLogs` silently ignores its own failure** (`catch { /* silently ignored */ }`), which only affects the data-sharing-consent footer's button label (`Share data` vs `Revoke`). Left as-is because it already fails safe — on a failed logs fetch, `latestConsent` defaults to `undefined`, so the UI defaults to "Share data" (never falsely claims consent was granted when it wasn't).

### Fixes implemented
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors (3 pre-existing unused-var errors — `Platform`, `KISIcon`, `logsLoading` — and 1 pre-existing missing-dep warning, all predating this pass and unrelated to the accessibility fix made).
**Status:** AUDITED-FIXED

---

## PartnerRedeemInviteScreen (`src/screens/partners/PartnerRedeemInviteScreen.tsx`)
**Entry point:** `PartnerRedeemInvite` (App.tsx:1608)
**Criteria evaluated:** forms/validation, state-machine design, journey integration
**Not applicable:** destructive actions, accessibility icons (back is a text link)

### Findings
1. **(P2/P3, carried-forward, documented only per instructions)** This screen independently duplicates the same idle/loading/success/error auto-redeem state machine as `src/screens/invite/InviteJoinScreen.tsx` — both animate in on mount, both auto-trigger the redeem call when a `code`/`token` route param is present, both render a 3-state (loading/success/error) card. Consolidating into a shared hook is a reasonable follow-up but is a larger refactor than this pass's scope.
2. **(P3, not a confirmed bug) Success check `res?.success || res?.detail`** is unusual — `res?.detail` is checked as if it alone could signal success, but `postRequest`'s `ApiResult` shape never actually has a top-level `detail` field (failures put the raw body in `data`, not `detail`), so in practice this clause is dead/vestigial rather than a live bug. Left unchanged since altering it risks behavior change for zero demonstrated benefit.

### Fixes implemented
None — both findings are documented per the task's explicit carry-forward instruction (don't consolidate) and lack of a confirmed live bug, respectively.

### Verification
Not applicable (no changes).
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## InviteJoinScreen (`src/screens/invite/InviteJoinScreen.tsx`)
**Entry point:** `InviteJoin` (App.tsx:1598)
**Criteria evaluated:** forms/validation, state-machine design, journey integration, navigation correctness
**Not applicable:** destructive actions, accessibility icons

### Findings
1. **(P2/P3, carried-forward, documented only)** Duplicates the same state machine as `PartnerRedeemInviteScreen` — see above. Not fixed per instructions (out of scope for this pass).
2. **(P3, not fixed)** `join()` runs inside a `useEffect` with no top-level try/catch; relies entirely on `postRequest`/`getRequest` never throwing. Low practical risk since that invariant holds for the whole network layer, but there's no safety net if an unrelated JS error occurs mid-flow — `status` would get stuck at `'loading'` forever with no error shown.

### Fixes implemented
None — both are documented findings; (1) is explicitly out of scope, (2) is low-probability given the network layer's design.

### Verification
Not applicable (no changes).
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ContactShareLinkScreen (`src/screens/chat/ContactShareLinkScreen.tsx`)
**Entry point:** `ContactShareLink` (App.tsx:1892)
**Criteria evaluated:** loading/error states, fabricate-success-on-failure, privacy/trust, destructive actions
**Not applicable:** forms, accessibility icons (back is a text link)

### Findings
1. **(P1) Silent failure on pause/reactivate/regenerate.** `handleRegenerate` and `handleTogglePause` only updated `link` state `if (res?.success)` — on failure, nothing happened: no alert, no visible change. This is privacy-relevant: a user pausing their contact link (to stop unwanted messages) or regenerating it (because the old link leaked) would see the busy spinner finish and assume the action worked, while the old link was in fact still fully live and usable by anyone who had it.

### Fixes implemented
- Both branches of `handleTogglePause` and the `handleRegenerate` callback now show `Alert.alert` with the server's message on failure, so a failed pause/reactivate/regenerate is never silently indistinguishable from success.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## JobsBoardScreen (`src/screens/jobs/JobsBoardScreen.tsx`)
**Entry point:** `JobsBoard` (App.tsx:2061)
**Criteria evaluated:** fabricate-success-on-failure, forms/validation, accessibility labels
**Not applicable:** destructive actions (applying isn't destructive), loading/error states for the list itself (already handled with a loading spinner / "No jobs found" distinct from genuine search-filter results)

### Findings
1. **(P1) Fabricate-success on job application.** `handleApply`'s confirmation `onPress` awaited `postRequest` without checking `res.success` before showing "Application submitted" — since `postRequest` resolves `{success:false}` rather than throwing on a backend rejection (already applied, job closed, validation error), a job seeker could walk away believing they'd applied when nothing was recorded.
2. **(P3) Back button has no accessibility label.**

### Fixes implemented
- `handleApply` now checks `res?.success === false` and throws into the existing catch-and-alert path before declaring success.
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## MyApplicationsScreen (`src/screens/jobs/MyApplicationsScreen.tsx`)
**Entry point:** `MyApplications` (App.tsx:2066)
**Criteria evaluated:** fabricate-success-on-failure, destructive actions, accessibility labels
**Not applicable:** forms

### Findings
1. **(P1) Fabricate-success on application withdrawal.** `handleWithdraw`'s confirm `onPress` awaited `postRequest` and unconditionally marked the application `WITHDRAWN` locally, regardless of whether the server actually withdrew it.
2. **(P3) Back button has no accessibility label.**

### Fixes implemented
- `handleWithdraw` now checks `res?.success === false` and alerts on failure before mutating local state.
- Added `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## TalentDiscoverScreen (`src/screens/jobs/TalentDiscoverScreen.tsx`)
**Entry point:** `TalentDiscover` (App.tsx:2076)
**Criteria evaluated:** fabricate-success-on-failure, loading/error states, accessibility labels
**Not applicable:** destructive actions, forms

### Findings
1. **(P1) Fabricate-success on "Connect."** `handleConnect` awaited `postRequest` without checking success before marking the connection "Pending" locally — a failed connection request would still show as sent.
2. **(P3) Back button has no accessibility label.**

### Fixes implemented
- `handleConnect` now checks `res?.success === false` and alerts on failure before updating `pendingConnections`.
- Added `accessibilityLabel="Go back"` to the back button. (The profile-list fetch already has excellent error/retry handling via `fetchError` — no changes needed there.)

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## GlobalProfilePreviewProvider (`src/components/profile/GlobalProfilePreviewProvider.tsx`)
**Criteria evaluated:** fabricate-success-on-failure, error handling
**Not applicable:** UI/visual criteria (this is a context provider with no rendered chrome of its own beyond delegating to `BroadcastAuthorProfileSheet`); accessibility (no interactive elements)

### Findings
None. `openProfileByHandle` correctly checks `response?.success` and alerts with the server message (or a clear "no profile matched" message) before returning `false` on every failure path; no fabricate-success risk.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## OfflineDataBadge (`src/components/offline/OfflineDataBadge.tsx`)
**Criteria evaluated:** visual hierarchy, color/contrast, design-system consistency
**Not applicable:** network/loading states (purely presentational, receives `meta` as a prop), destructive actions, accessibility (non-interactive badge), touch targets

### Findings
None. Correctly renders nothing when there's no cached data (`!meta?.fromCache`), distinguishes "stale" from "fresh-but-offline" copy, and uses theme tokens (`palette.primarySoft`, `palette.warning`) rather than hardcoded colors.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable (no changes).
**Status:** AUDITED-NO-ISSUES

---

## Filters / FilterManager (`src/components/messaging/Filters.tsx`)
**Criteria evaluated:** touch targets, destructive actions, accessibility labels, forms/validation
**Not applicable:** network/loading/error states (fully local — filters are passed in and saved via callback props, no network call in this file)

### Findings
1. **(P2) Three touch targets below the 44pt minimum.** `ToggleChip`'s shared `chip` style sets `minHeight: 34`; the per-rule `Checkbox`'s `checkboxRow` has no `minHeight` at all (the visible box is 20×20 with only 8px margin — effective tap height well under 44pt); the "Groups only"/"DMs only" `pillBtn`s also have no `minHeight` (≈36px from padding alone).
2. **(P2) Deleting a saved custom filter has no confirmation.** The trash-icon `Pressable` called `onDelete(f.id)` directly — an irreversible delete of a user-authored filter with a single mistap.
3. **(P3) Checkbox rows and the delete-filter trash icon have no accessibility label/role.**

### Fixes implemented
- `ToggleChip`, the `Checkbox` row, and both `pillBtn` instances now have an inline `minHeight: 44` override (added locally rather than editing the shared `messagesUtils.ts` stylesheet, since `checkboxBox`/`pillBtn`/`chip` are shared across files — `ToggleChip` is also used by `MessagesScreen.tsx`, and enlarging its tap target there is a safe, purely-additive side effect).
- Delete-filter now shows an `Alert.alert` confirmation naming the filter before calling `onDelete`; its hit area was also enlarged via `hitSlop={13}` (kept hitSlop-only, not a layout-affecting `minHeight`, to avoid distorting the saved-filter pill's visual size).
- Added `accessibilityRole`/`accessibilityLabel`/`accessibilityState` to the checkbox rows and `accessibilityLabel` to the delete button.

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED

---

## VoiceMessageMiniBadge (`src/components/chat/VoiceMessageMiniBadge.tsx`)
**Criteria evaluated:** touch targets, accessibility labels, visual distinctness/emotional tone (co-existing with `CallMiniBadge`)
**Not applicable:** network/loading/error states beyond the already-handled `buffering`/`error` player states; forms; destructive actions (dismiss isn't destructive — it just stops local playback)

### Findings
1. **(P3) Play/pause (30×30) and dismiss (26×26) buttons were under the 44pt touch-target minimum even with their existing `hitSlop`** (`hitSlop={6}` on both → effective ~42px and ~38px respectively, both still short of 44pt) on a floating pill that's meant to be tappable while the user may be multitasking elsewhere in the app.

### Fixes implemented
- Increased `hitSlop` to 8 (play/pause) and 9 (dismiss) to clear the 44pt threshold without changing the pill's visual size. (Accessibility labels were already present and correct on all three pressables — no changes needed there.)

### Verification
`npm run typecheck`: clean. `eslint`: no new errors.
**Status:** AUDITED-FIXED
