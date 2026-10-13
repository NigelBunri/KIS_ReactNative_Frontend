# UX/UI Audit — Broadcast Channel Studio

**Batch:** `src/screens/broadcast/channels/studio/*` (24 files)
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility/trust audit of the Channel Studio creator admin console (reachable via `FeedManagementModal` → `ChannelStudioScreen`), not a file inventory. A prior engineering pass already fixed serious backend bugs here (crashes, missing moderation gates, uncapped ad spend, copyright-claim impersonation, credential leaks) and is out of scope. This UX pass was itself interrupted by a session limit after auditing and fixing 15 of the 24 files; this document completes the remaining 9 (`ChannelAnalyticsPanel`, `ChannelBrandingEditor`, `ChannelContentManager`, `ChannelStudioScreen`, `LiveGuestRedeemScreen`, `MembershipPerksEditor`, `ProductTagStudio`, `RevenueAnalyticsPanel`, `SimulcastPanel`) and summarizes the 15 completed earlier (by reading their diffs) so the batch reads as one audit. **24/24 files audited.**

## Summary

The dominant defect across this entire batch — found and fixed in 17 of the 24 files total — is the same root cause: `getRequest`/`patchRequest`/`postRequest` **resolve an `ApiResult` wrapper on failure, they never throw**. Nearly every panel's original code checked `res?.data` (or fell back to `res` itself) without checking `res.success` first. Since a failed response's error body is still a truthy object/array-shaped value, this made every one of these panels **indistinguishable from a genuinely empty/zero state on a load failure** — the exact "fabricate success on failure" / silent-error-swallowing pattern this audit program has flagged repeatedly in other domains (e.g. the Health Engines batch). For a creator-facing console with ad spend, revenue, copyright-claims, and monetization-settings screens, this is not cosmetic: `MonetizationPanel` could have let a failed load silently overwrite real settings with blank defaults on Save (fixed in the prior session), and this session found the identical bug independently in two previously-unreached files (`ProductTagStudio`, `SimulcastPanel`) plus a structurally different variant in `ChannelAnalyticsPanel`.

**The single most important finding in this session's half of the work:** three of the nine remaining files — `MembershipPerksEditor`, `ProductTagStudio`, and `SimulcastPanel` — are **fully built, fully functional components with zero entry point anywhere in the app.** A repo-wide grep confirms none of the three is imported by any screen, navigator, or route; `ChannelStudioScreen`'s 20-tab system (grouped into 5 categories: Content, Live, Growth, Brand, Protect) has no "Perks," "Products," or "Simulcast" tab at all. A creator cannot reach product tagging for shoppable video, membership-tier perks editing, or multi-platform simulcast targets through any discoverable path. This is a journey-integration gap, not a code bug — wiring it in means adding tabs/routes, which is explicitly out of this pass's "don't change navigation structure" guardrail, so it is documented, not fixed, for all three files.

Of the 9 files freshly audited this session: 6 required and received fixes (`ChannelAnalyticsPanel`, `ChannelContentManager`, `ChannelStudioScreen`, `MembershipPerksEditor`, `ProductTagStudio`, `SimulcastPanel`); 3 already met the bar as-is (`ChannelBrandingEditor`, `LiveGuestRedeemScreen`, `RevenueAnalyticsPanel` — the latter already contained the exact `res.success` fix pattern, apparently from an earlier commit predating this sweep). Combined with the 15 from the prior session, **total for the batch: 24/24 audited, 21/24 touched with a fix at some point across both sessions, 3/24 required no changes.** `npm run typecheck` is clean after this session's edits; ESLint shows only pre-existing warnings (inline styles, `no-void`) and one pre-existing unused-import error in `ChannelContentManager.tsx` that predates this session's edits (verified via `git stash`) and was left untouched per the "don't fix what you didn't break" rule.

---

# Part 1 — Files completed in the prior session (summarized from diffs)

All 15 follow the same `res?.success` load-failure fix unless noted; see each file for the specific user-facing consequence that was fixed.

## AdCampaignPanel (`src/screens/broadcast/channels/studio/AdCampaignPanel.tsx`)
Fixed: a failed ad-campaign load silently rendered "No ad campaigns yet" instead of an error.
**Status:** AUDITED-FIXED

## AudienceDemographicsPanel (`src/screens/broadcast/channels/studio/AudienceDemographicsPanel.tsx`)
Fixed: a failed demographics load's error body passed through as the payload, showing "No age/country data yet" instead of an error.
**Status:** AUDITED-FIXED

## ChannelHomepageShelfEditor (`src/screens/broadcast/channels/studio/ChannelHomepageShelfEditor.tsx`)
Fixed: failed shelf/shelf-item loads showed fabricated empty states; additionally, `handleToggleActive`'s optimistic `Switch` update applied even when the PATCH failed, showing a shelf as active/inactive when the server never changed it. Added explicit error states and gated the optimistic update on `res.success`.
**Status:** AUDITED-FIXED

## ChannelModerationPanel (`src/screens/broadcast/channels/studio/ChannelModerationPanel.tsx`)
Fixed: the "Remove" moderation action (hard-to-undo, unlike Keep/Hide/Restrict) had no confirmation. Added an `Alert.alert` confirm gate on "Remove" only, leaving the other three single-tap for fast triage.
**Status:** AUDITED-FIXED

## ChapterEditorPanel (`src/screens/broadcast/channels/studio/ChapterEditorPanel.tsx`)
Fixed: failed chapter/auto-chapter loads fell through to the same empty-array fallback as a genuinely empty list.
**Status:** AUDITED-FIXED

## ContentCardsEditor (`src/screens/broadcast/channels/studio/ContentCardsEditor.tsx`)
Fixed: same load-failure-as-empty-state pattern for content cards.
**Status:** AUDITED-FIXED

## CopyrightClaimsPanel (`src/screens/broadcast/channels/studio/CopyrightClaimsPanel.tsx`)
Fixed: a failed claims load rendered the reassuring "Your content is in good standing" empty state — actively misleading for a copyright-claims screen specifically.
**Status:** AUDITED-FIXED

## EndScreenEditor (`src/screens/broadcast/channels/studio/EndScreenEditor.tsx`)
Fixed: a failed load's error body passed through as the end-screen config, showing "No end screen elements configured" instead of an error.
**Status:** AUDITED-FIXED

## GuestInviteSheet (`src/screens/broadcast/channels/studio/GuestInviteSheet.tsx`)
Fixed: guest-list load failures were indistinguishable from "No guests yet" (added error state); "Remove guest" (the one destructive action vs. "Activate") had no confirmation (added one).
**Status:** AUDITED-FIXED

## ImpressionsAnalyticsPanel (`src/screens/broadcast/channels/studio/ImpressionsAnalyticsPanel.tsx`)
Fixed: a failed load rendered confident "0" impressions/views/CTR, indistinguishable from a genuine zero-traffic period.
**Status:** AUDITED-FIXED

## KeywordFilterPanel (`src/screens/broadcast/channels/studio/KeywordFilterPanel.tsx`)
Fixed: same load-failure pattern, plus `handleToggleActive`/`handleChangeType` applied optimistic UI updates even on a failed PATCH.
**Status:** AUDITED-FIXED

## LiveControlRoom (`src/screens/broadcast/channels/studio/LiveControlRoom.tsx`)
Fixed: several icon-only controls (OBS guide expand/collapse, credential reveal/copy, recordings refresh, connection-error dismiss, flip camera, live-streams refresh) lacked `accessibilityLabel`; "Schedule," "Start," and "End" stream actions could silently no-op on failure (the underlying helpers resolve `null` rather than throwing) with zero feedback — added explicit failure alerts.
**Status:** AUDITED-FIXED

## MonetizationPanel (`src/screens/broadcast/channels/studio/MonetizationPanel.tsx`)
Fixed: the most severe instance of the pattern in the whole batch — a failed settings load defaulted every toggle to OFF/0 and the threshold/schedule to blank/monthly; tapping "Save Settings" on that fabricated state would have overwritten the creator's real monetization settings with blank defaults. Fixed by blocking Save entirely while a load is known to have failed, with an explicit on-screen note.
**Status:** AUDITED-FIXED

## SubtitleEditorPanel (`src/screens/broadcast/channels/studio/SubtitleEditorPanel.tsx`)
Fixed: same load-failure-as-empty-state pattern for subtitle tracks.
**Status:** AUDITED-FIXED

## TrafficSourcesPanel (`src/screens/broadcast/channels/studio/TrafficSourcesPanel.tsx`)
Fixed: a failed load's error body passed through as the traffic-source list, indistinguishable from a genuinely empty period.
**Status:** AUDITED-FIXED

---

# Part 2 — Files audited this session

## ChannelAnalyticsPanel (`src/screens/broadcast/channels/studio/ChannelAnalyticsPanel.tsx`)
**Entry point:** Rendered inside `ChannelStudioScreen`'s "Analytics" tab and again (unconditionally) at the bottom of the default "Dashboard" tab; also embeds `ImpressionsAnalyticsPanel` and `TrafficSourcesPanel` below its own summary grid.
**Criteria evaluated:** loading/empty/error states, trust (analytics data clarity), visual hierarchy, color/contrast.
**Not applicable:** forms/validation (read-only dashboard); destructive actions (none); touch targets (no interactive controls of its own beyond nested panels already covered).

### Findings
1. **Load failure fabricated a confident all-zero dashboard (P2).** The shared `fetchChannelAnalytics()` hook (`hooks/useChannelsData.ts`) resolves `{summary:{}, topContent:[]}` on a failed request rather than signaling failure in any way, so a genuine API error rendered as "0 views, 0 comments, 0h watch time, Analytics will appear after viewers interact with channel content" — confidently indistinguishable from a brand-new channel with real zero activity. This is the same fabricate-success-on-failure class of bug fixed across the rest of the batch, but one level removed: the swallowing happens inside the shared hook, not in this component's own fetch call.

### Fixes implemented
Rather than modify the shared hook (used by other callers outside this file's scope), the component now calls `getRequest` directly against the same endpoint (`ROUTES.broadcasts.channelAnalytics`) that the hook wraps, checks `res.success` itself, and shows an inline red banner ("Could not load channel analytics... pull to refresh or reopen this tab to retry") above the metric cards on failure, while still falling back to the real prop-based subscriber/live/queued counts rather than showing bare zeros. No backend contract or shared-hook behavior was changed.

### Verification
`npm run typecheck` — clean. `eslint` — no new errors (no new warnings introduced).

**Status:** AUDITED-FIXED

---

## ChannelBrandingEditor (`src/screens/broadcast/channels/studio/ChannelBrandingEditor.tsx`)
**Entry point:** `ChannelStudioScreen` → "Branding" tab.
**Criteria evaluated:** forms/validation, loading/error states, dirty-state handling, touch targets, cognitive load.
**Not applicable:** destructive actions (none — this is an identity-edit form, not a delete/revoke flow); accessibility labels (no icon-only controls).

### Findings
1. **Unsaved edits are silently discarded on tab switch (P2, documented only).** `ChannelStudioScreen.renderBody()` conditionally renders this component only while `activeTab === 'branding'`; switching to any other tab unmounts it entirely. If a creator has typed a new display name/handle/description and switches tabs before tapping "Save changes," the edit is lost with zero warning — there is no "discard unsaved changes?" prompt anywhere in the tab-switching flow.
2. Everything else about this form is solid: required-field validation via `Alert.alert` before the request, a `dirty` check that disables Save until something has actually changed, a proper save-failure `Alert`, and correct 44pt touch targets via `useResponsiveLayout().minTouchTarget`.

### Fixes implemented
None. Fixing finding 1 properly requires a cross-file change (tracking dirty state at the `ChannelStudioScreen` tab-switch level, or adding a navigation "beforeRemove"-style guard), which touches the shared tab-switching mechanism used by all 19 other tabs — too invasive for this pass's safe/low-risk bar and adjacent to the "don't change navigation structure" guardrail. Documented as a follow-up recommendation.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ChannelContentManager (`src/screens/broadcast/channels/studio/ChannelContentManager.tsx`)
**Entry point:** `ChannelStudioScreen` → "Content" tab, and again (first 4 items) embedded in the default "Dashboard" tab.
**Criteria evaluated:** accessibility labels on icon-only controls, touch targets, cognitive load, visual hierarchy.
**Not applicable:** loading/error states (purely presentational — receives `contents`/`legacyFeeds` as props; the actual fetch and its error handling live in the parent, see `ChannelStudioScreen` findings below); destructive-action confirmation (tag add/remove here is local-state-only until a parent-level save, and removing a tag is trivially reversible by re-adding it — not destructive enough to warrant a confirm dialog).

### Findings
1. **Two icon-only `Pressable`s lacked `accessibilityLabel`/`accessibilityRole` (P3).** The chevron button that expands/collapses a content item's tags-and-thumbnail section, and the "✕" button that removes an individual tag pill, were both bare icon buttons with no screen-reader text.

### Fixes implemented
Added `accessibilityRole="button"` and a descriptive `accessibilityLabel` to both (state-aware "Expand/Collapse tags and thumbnail options" for the chevron; `"Remove tag: <tag>"` for the pill).

### Verification
`npm run typecheck` — clean. `eslint` — no new errors; one pre-existing unused-import error (`Alert`, unrelated to the changed lines, confirmed via `git stash` to predate this session) was left as-is.

**Status:** AUDITED-FIXED

---

## ChannelStudioScreen (`src/screens/broadcast/channels/studio/ChannelStudioScreen.tsx`)
**Entry point:** The Channel Studio shell itself, opened from `FeedManagementModal`. Owns channel selection, the create-channel form, and the 5-category/20-tab navigation that renders every other file in this batch.
**Criteria evaluated:** navigation/discoverability, cognitive load, forms/validation, destructive-action confirmation, accessibility labels, loading/error states, small-screen usability.
**Not applicable:** color/contrast (consistent use of theme tokens throughout, no raw hex).

### Findings
1. **"Stop broadcasting channel" had no confirmation (P2).** Unlike every other high-stakes toggle found and fixed elsewhere in this batch (End stream, Remove moderation record, Remove guest), flipping a channel from broadcasting to not-broadcasting — which immediately hides the channel and all its public content from every subscriber — fired immediately on tap with no confirm step, inconsistent with the destructive-action pattern already established across sibling files in this very batch.
2. **Two icon-only close buttons lacked `accessibilityLabel` (P3).** The "✕" dismiss on the "channel created" success banner, and the "✕" that closes the create-channel form header, were both bare `KISIcon` children of a `KISButton` with no label (the shared `KISButton` component does support `accessibilityLabel` and falls back to a string `title`, but these buttons have none).
3. **`refreshContent`'s content/playlist load has no error path (P2, documented only).** `Promise.all([fetchChannelContents(...), fetchChannelPlaylists(...)])` has a `finally` but no `catch`; both of those shared hook functions already fail soft (return `{contents: [], nextCursor: null}` / `[]` on a failed request) rather than throwing or signaling failure, so a load failure here is silently indistinguishable from "this channel genuinely has no content yet" — the same architecture-level gap as `ChannelAnalyticsPanel`'s finding, but affecting the primary Content/Dashboard/Playlists tabs. Unlike `ChannelAnalyticsPanel`, there's no single endpoint this screen can call directly in its place (two separate hook calls, both used elsewhere in the app), so a safe component-local fix isn't available without duplicating or modifying the shared hooks — out of this pass's scope.
4. Good pattern already in place and worth calling out: the 20 tabs are grouped into 5 labeled categories (Content, Live, Growth, Brand, Protect), keeping the always-visible tab strip to ~4-5 items instead of all 20 at once — this directly addresses the "can a creator tell where they are in a 20-tab console" risk this audit was asked to hunt for, and it was evidently already fixed in an earlier pass (present in the file before this session, not part of this session's diff).
5. Channel creation form has solid validation (name/handle/owner-type required, specific handle-taken/throttle error messages) and the "Live" tab correctly redirects non-Partner-tier users to a real upgrade path rather than a dead end.

### Fixes implemented
- Added an `Alert.alert` confirmation ("Stop broadcasting this channel?") gating only the broadcast→off direction of `handleToggleChannelBroadcast`; turning broadcast on remains single-tap since it has no immediate subscriber-facing effect.
- Added `accessibilityLabel`s ("Dismiss channel created notice", "Close create channel form") to the two icon-only close buttons.
- Finding 3 documented, not fixed (see rationale above).

### Verification
`npm run typecheck` — clean. `eslint` — no new errors; pre-existing `no-void` and inline-style warnings throughout the file predate this session's edits.

**Status:** AUDITED-FIXED

---

## LiveGuestRedeemScreen (`src/screens/broadcast/channels/studio/LiveGuestRedeemScreen.tsx`)
**Entry point:** The `live-guest/:token` deep link registered in `App.tsx` — the external-guest counterpart to `GiftMembershipRedeemScreen`, reached by someone outside the app tapping a co-stream invite link.
**Criteria evaluated:** loading/empty/error states, navigation/back behavior, visual hierarchy, trust/clarity for a first-touch external-user screen.
**Not applicable:** forms/validation (no form — a single auto-firing redeem action); destructive-action confirmation (redeeming an invite is not destructive); accessibility labels (only icon is the back arrow, which already has adequate `hitSlop`/44pt sizing via `backBtn` and is a standard nav-back affordance).

### Findings
None of consequence. This screen already handles every state correctly: missing token is caught before any request fires, the request checks `res?.success` before trusting `res.data`, both the thrown-exception and the `!res.success` paths set a real error message (preferring the server's own `detail`/`message` over a generic fallback), and the loading/success/error three-way render is clean and legible. The only minor, low-severity gap is the lack of a "Try again" button on the error card — a user must navigate back and re-tap the original link to retry — but for a one-shot invite-redemption deep link (where retrying the same token against an already-consumed or expired invite would just fail again anyway) this is a reasonable, non-confusing design, not a bug.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## MembershipPerksEditor (`src/screens/broadcast/channels/studio/MembershipPerksEditor.tsx`)
**Entry point:** **None found.** A repo-wide grep (`grep -rl "MembershipPerksEditor" src/`) returns only the file itself — it is not imported by `ChannelStudioScreen`, `MonetizationPanel` (the obvious candidate, since it manages membership tiers), any navigator, or any other screen in the app. This is a fully built, self-contained perks-list editor for a membership tier (`patchRequest` to `ROUTES.broadcasts.membershipTier`) with no discoverable path to reach it.
**Criteria evaluated:** journey integration (fails), forms/validation, destructive-action handling, accessibility labels, touch targets.
**Not applicable:** navigation/back (not a routed screen); loading/empty/error states for its own data (it receives `initialPerks` as a prop — there's no fetch of its own to fail).

### Findings
1. **No entry point anywhere in the app (P1).** A creator cannot edit membership perks through any discoverable UI path — the feature exists in code and is otherwise complete, but is unreachable. This matches a pattern seen elsewhere in this audit program (built-but-unwired features); wiring it into `ChannelStudioScreen`'s "Growth" tab category (alongside `MonetizationPanel`, which already lists membership state but has no per-tier perks UI) would be the natural fix, but adding a tab/route is a navigation-structure change explicitly out of scope for this pass.
2. **Remove-perk icon button lacked `accessibilityLabel` (P3).** The "✕" button next to each perk was a bare `Text` glyph inside a `Pressable` with no screen-reader label.
3. Everything else here is solid: perks are only persisted on explicit "Save Perks" (gated by a `dirty` flag), both the add-perk and remove-perk flows update local state immediately with the actual save deferred, and the failure path shows a real `Alert.alert` rather than swallowing it.

### Fixes implemented
Added `accessibilityRole="button"` and `accessibilityLabel={\`Remove perk: ${perk}\`}` to the remove button. Finding 1 (missing entry point) documented, not fixed — out of scope per the navigation-structure guardrail.

### Verification
`npm run typecheck` — clean. `eslint` — no new errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ProductTagStudio (`src/screens/broadcast/channels/studio/ProductTagStudio.tsx`)
**Entry point:** **None found.** Same situation as `MembershipPerksEditor` — a repo-wide grep finds no importer anywhere. This is a complete shoppable-video product-tagging interface (add a product title/URL/thumbnail/price at a timestamp, remove with confirmation) with no tab, route, or parent screen that renders it. `ChannelStudioScreen`'s per-content tabs (Subtitles, Chapters, End Screens, Cards) are the obvious place it belongs, but there is no "Products" tab in the `StudioTab` union.
**Criteria evaluated:** journey integration (fails), loading/empty/error states, destructive-action confirmation, accessibility labels, forms/validation.
**Not applicable:** navigation/back (not a routed screen).

### Findings
1. **No entry point anywhere in the app (P1).** Same class of finding as `MembershipPerksEditor` above — documented, not fixed (navigation-structure change, out of scope).
2. **Silent-error-swallowing on load (P2, matches the batch-wide pattern).** `fetchTags`'s `catch` block was a bare `// silently fail` comment — a failed load rendered the identical "No product tags yet." empty state as a genuinely empty content item, with zero indication of failure. This is the same root-cause bug fixed in 15 files last session, found independently here because this file hadn't been touched yet.
3. **Remove action's failure was doubly swallowed (P2).** `handleRemove`'s confirmed "Remove" action called `postRequest(...).catch(() => {})` — even though the outer `try` already had no `catch`, this inner `.catch` ensured a failed delete request was completely invisible: the code proceeded straight to `fetchTags()` regardless of whether the delete actually succeeded, so a failed removal silently left the tag in place with no explanation to the creator.
4. **One icon-only close button lacked `accessibilityLabel` (P3).** The "✕" that clears a selected-but-not-yet-saved thumbnail preview.
5. The add-product form and its removal confirmation (`Alert.alert('Remove product tag?', ...)`) are otherwise well-built — required-field validation, a numeric-timestamp sanity check, and a destructive-confirm dialog already present for removal (the confirm dialog itself was correct; only the request-failure handling underneath it was broken).

### Fixes implemented
- `fetchTags` now checks `res?.success`, sets a `loadError` state on failure, and the list renders a distinct red "Could not load product tags. Reopen this panel to retry." message instead of the ambiguous empty state.
- `handleRemove`'s inner `.catch(() => {})` was replaced with a proper `res.success` check plus an `Alert.alert('Error', 'Could not remove product tag. Please try again.')` on failure, and the outer `try` now has a matching `catch`.
- Added `accessibilityRole="button"` and `accessibilityLabel="Remove selected thumbnail"` to the thumbnail-clear button.
- Finding 1 documented, not fixed.

### Verification
`npm run typecheck` — clean. `eslint` — no new errors (pre-existing `no-void` and inline-style warnings only).

**Status:** AUDITED-FIXED

---

## RevenueAnalyticsPanel (`src/screens/broadcast/channels/studio/RevenueAnalyticsPanel.tsx`)
**Entry point:** `ChannelStudioScreen` → "Revenue" tab.
**Criteria evaluated:** trust (revenue data clarity — the highest-stakes category for this exact failure mode), loading/empty/error states, visual hierarchy, color/contrast.
**Not applicable:** forms/validation (read-only dashboard, period-selector only); destructive actions (none); accessibility labels (no icon-only controls, just labeled period pills).

### Findings
None. This file already contains the exact `res.success`-check fix pattern applied to the 15 other files in the prior session — including an explanatory code comment calling out that a creator-facing revenue dashboard misreporting a failed load as "$0.00 earned" would be worse than the generic "no data" case elsewhere, and routing a failed load through the existing full-screen error state instead of defaulting every figure to zero. This file was not part of the 15-file diff for this batch, meaning the fix predates this specific sweep (verified via `git diff` showing no uncommitted changes to this file) rather than being something this session needed to do. The period selector, summary cards, total-revenue rollup, and proportional bar chart are all clean, legible, and theme-consistent.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## SimulcastPanel (`src/screens/broadcast/channels/studio/SimulcastPanel.tsx`)
**Entry point:** **None found.** Same situation as `MembershipPerksEditor` and `ProductTagStudio` — a repo-wide grep finds no importer. This is a complete RTMP multi-platform-simulcast target manager (add/remove targets with platform, label, RTMP URL, and a `secureTextEntry`-masked stream key) scoped to a `streamId`, with no tab or parent screen rendering it — not even inside `LiveControlRoom`, the other live-streaming file in this batch, which would be the natural home for it.
**Criteria evaluated:** journey integration (fails), loading/empty/error states, destructive-action confirmation, credential handling, accessibility labels.
**Not applicable:** navigation/back (not a routed screen).

### Findings
1. **No entry point anywhere in the app (P1).** Same class of finding as the other two orphaned files above — a creator cannot configure simulcasting to YouTube/Twitch/Facebook/etc. through any discoverable path, even though the whole feature (including the UI for it) is fully built. Documented, not fixed (navigation-structure change, out of scope).
2. **Identical silent-error-swallowing pattern as `ProductTagStudio` (P2).** `fetchTargets`'s `catch` was a bare `// silently fail — list may be empty on first open` comment, and `handleRemove`'s confirmed removal called `postRequest(...).catch(() => {})` before unconditionally refetching — a failed delete silently left the target in the list with zero explanation, and a failed initial load rendered "No simulcast targets yet" indistinguishable from a genuinely empty configuration.
3. Credential handling is already correct: the stream key input uses `secureTextEntry`, and it is never echoed back anywhere in the target list display (only platform/label/status are shown) — consistent with the credential-leak class of bug already fixed elsewhere in this app by the prior backend-focused pass.
4. The removal confirmation dialog (`Alert.alert('Remove target?', ...)`) was already correctly in place — only the request-failure handling underneath it was broken, same as `ProductTagStudio`.

### Fixes implemented
- `fetchTargets` now checks `res?.success`, sets a `loadError` state on failure, and the list renders a distinct red "Could not load simulcast targets. Reopen this panel to retry." message instead of the ambiguous empty state.
- `handleRemove`'s inner `.catch(() => {})` was replaced with a proper `res.success` check plus an `Alert.alert('Error', 'Could not remove simulcast target. Please try again.')` on failure, with a matching outer `catch`.
- Finding 1 documented, not fixed.

### Verification
`npm run typecheck` — clean. `eslint` — no new errors (pre-existing `no-void` and inline-style warnings only).

**Status:** AUDITED-FIXED
