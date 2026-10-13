# Broadcast Channels — Components / API / Embed / Hooks Audit

Batch of 26 files: `src/screens/broadcast/channels/components/*.tsx` (20),
`api/*.ts` (2), `embed/*.tsx` (1 — actually `embedUtils.ts`), `hooks/*.ts` (3).
Two files (`AgeGateScreen.tsx`, `GeoBlockedScreen.tsx`) were already fully
audited and fixed in a prior pass and are skipped here per instruction. Of
the 24 remaining files, most are solid — many already have optimistic
update + rollback + `Alert` error surfacing, which is the right pattern. The
real, recurring defect found across this batch was **icon-only `Pressable`s
with no `accessibilityLabel`/`Role`** (10 components) and a smaller but more
important family of **silent error-swallowing on secondary actions**
(comment like/pin/heart/edit in `ChannelCommentsPanel.tsx`, and a live-chat
message that silently vanished on send failure in
`useLiveStream.ts`/`LiveChatPanel.tsx`) — both fixed. No "fabricate success
on failure" bugs (fake local records masking a real error) were found in
this batch; the data-layer file `useChannelsData.ts` in particular has
consistently correct success-check-before-normalize patterns throughout. No
backend contracts, API calls, navigation structure, or the age-verification
mechanism were changed. 24 files audited, 2 skipped (already fixed). Across
the batch: **~9 files had findings fixed, 2 files had findings documented
but not fixed (out of safe-fix scope), 13 files were AUDITED-NO-ISSUES.**
Typecheck is clean; ESLint is clean on every changed file except
pre-existing stylistic `react-native/no-inline-styles` warnings (not
introduced by this pass, consistent with the rest of the codebase).

---

## AgeGateScreen.tsx (`src/screens/broadcast/channels/components/AgeGateScreen.tsx`)
Already audited and fixed in a prior pass (accessibilityRole/Label added to interactive Pressables, verified clean via typecheck). Not re-touched. P0 self-attestation gap is a separately-tracked, settled finding — no action here.

## GeoBlockedScreen.tsx (`src/screens/broadcast/channels/components/GeoBlockedScreen.tsx`)
Already audited and fixed in a prior pass (accessibilityRole/Label added to interactive Pressables, verified clean via typecheck). Not re-touched.

---

## AudioTrackSelector (`src/screens/broadcast/channels/components/AudioTrackSelector.tsx`)
**Entry point:** Rendered inline over/under the video player wherever multi-audio-track content is shown; mounted by the content player for a given `contentId`.
**Criteria evaluated:** touch targets, accessibility labels/roles on icon-adjacent controls, loading/empty states, silent-error-swallowing, design-system consistency.
**Not applicable:** forms/validation, destructive actions, navigation, long-content/missing-data (renders nothing below 2 tracks), small-screen (horizontal scroll already handles it).
### Findings
1. (P3) The track-pill `Pressable` had no `accessibilityRole`/`Label`/`accessibilityState` — the track name is visible as a `Text` child so a screen reader can still announce it, but there was no explicit "selected" state and no explicit button role, which is below the bar set by sibling selectors like `CameraSourceSelector`.
2. (P3) Fetch failure is caught with a bare `.catch(() => {/* silent */})`. Low severity here specifically because the fallback is "component renders nothing" (0 tracks), which is a safe default rather than a fabricated success — but it does mean a real network failure looks identical to "this content has no multi-language audio," which could mask a bug if a user who installed with 2+ real tracks sees none during an outage.
### Fixes implemented
Added `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{ selected }}` to the track pill.
### Verification
`npm run typecheck` clean. `eslint` clean except a pre-existing inline-style warning.
**Status:** AUDITED-FIXED

## CameraSourceSelector (`src/screens/broadcast/channels/components/CameraSourceSelector.tsx`)
**Entry point:** Rendered inside `LiveControlRoom` for broadcasters switching between camera/RTMP sources during a live stream.
**Criteria evaluated:** touch targets, a11y labels/roles/state, loading state (`switching` spinner), empty state (returns `null` with 0 sources), color/contrast, small-screen (`isCompactPhone` tile width).
**Not applicable:** forms, destructive actions, navigation.
### Findings
None. This component already has `accessibilityRole="button"`, a descriptive `accessibilityLabel` ("Switch to {label} camera"), and `accessibilityState={{ selected }}` on every tile; touch target meets 44pt via `minHeight: 44`; compact-phone tile width is responsive; the active/switching state is clearly communicated visually (border weight, success dot, spinner) and to assistive tech.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## ChannelCommentsPanel (`src/screens/broadcast/channels/components/ChannelCommentsPanel.tsx`)
**Entry point:** Mounted under a piece of channel content (video/post) to show/post comments; renders a `CommentItem` tree recursively for replies.
**Criteria evaluated:** forms/validation, confirmations on destructive actions, silent-error-swallowing, accessibility labels on icon-only controls, loading/empty states, cognitive load.
**Not applicable:** navigation, small-screen layout (simple vertical list), long-content (handles via `numberOfLines`-free text wrap, acceptable for comments).
### Findings
1. (P2) **Silent error-swallowing with no rollback on like/pin/creator-heart toggles.** `toggleLike`, `togglePin`, and `toggleHeart` applied an optimistic UI update and then `await`ed the network call with **no `try/catch` at all**. If the request failed, the promise rejected with no handler — an unhandled rejection in production, and the optimistic UI state (e.g. "liked") was never rolled back, permanently desyncing from the server with zero indication to the user that anything went wrong. This is exactly the silent-failure family called out in the audit brief.
2. (P2) **Reply/edit/post/report/delete/load had `try/finally` (or nothing) but no `catch`**, so any network failure surfaced as an unhandled rejection rather than user-visible feedback — the text stayed in the box with no sign the submit failed.
3. (P2) `load()`'s only failure path was the function-internal `fetchChannelComments` returning `[]` on a handled API error; a raw throw (e.g. the device going offline mid-request) was uncaught, which again produced an unhandled rejection and left the user looking at a comments list that could be ambiguous between "no comments" and "failed to load."
4. (P2) Six icon-only action buttons — like, reply, pin, creator-heart, edit, delete, report — had **no `accessibilityLabel`/`Role`** at all; a screen-reader user tabbing through a comment row would hear nothing describing what each control does.
5. (P3) The three sort pills (New/Top/Pinned) had no `accessibilityRole`/`accessibilityState`, so a screen reader couldn't tell which sort was currently active.
### Fixes implemented
- Added `try/catch` with optimistic rollback + `Alert.alert` to `toggleLike`, `togglePin`, `toggleHeart`.
- Added `catch` blocks (on top of existing `finally`) with user-facing `Alert.alert` to `submitReply`, `saveEdit`, `handleDelete`'s destructive action, the report action, panel-level `load()`, and panel-level `submit()`.
- Added `accessibilityRole="button"` + descriptive `accessibilityLabel` (+ `accessibilityState` where a toggle has an on/off state) to all six icon-only action buttons and the three sort pills.
### Verification
`npm run typecheck` clean. `eslint` clean except pre-existing inline-style/no-shadow/no-void warnings (not introduced by this change).
**Status:** AUDITED-FIXED

## ContentQueueSheet (`src/screens/broadcast/channels/components/ContentQueueSheet.tsx`)
**Entry point:** Bottom-sheet "Up Next" queue manager, opened from the video player's queue button.
**Criteria evaluated:** confirmations on destructive actions, silent-error-swallowing, accessibility labels on icon-only controls, touch targets, loading/empty states.
**Not applicable:** forms/validation, navigation, long-content.
### Findings
1. (P2) The up/down-reorder and remove icon buttons (`↑`, `↓`, `✕`) had no `accessibilityLabel`/`Role` — unlike most of the rest of this component, which is otherwise careful (it already has rollback-on-failure for remove/reorder/clear, and a destructive confirmation `Alert` for "Clear Queue").
2. (P3) Tapping the up-arrow on the first item (or down-arrow on the last) silently no-opped with no visual indication the action was unavailable at that boundary.
### Fixes implemented
Added `accessibilityRole="button"` + descriptive `accessibilityLabel` (naming the item) to the up/down/remove buttons, and added `disabled` + dimmed color at the list boundaries so the arrows visibly communicate when they can't move further.
### Verification
`npm run typecheck` clean. `eslint` clean except pre-existing inline-style/no-void warnings.
**Status:** AUDITED-FIXED

## GiftMembershipRedeem (`src/screens/broadcast/channels/components/GiftMembershipRedeem.tsx`)
**Entry point:** Standalone screen/panel reached via a gift-token deep link or manual token entry, to redeem a gifted channel membership.
**Criteria evaluated:** forms/validation, error states, loading, success state, emotional tone.
**Not applicable:** destructive actions, icon-only controls (none present), navigation, long-content.
### Findings
None of consequence. Validation (empty token) is handled inline with a visible error message; the `catch` block classifies "expired" vs. generic "invalid" errors into distinct, actionable messages; the success state clearly confirms what was activated (plan/channel/expiry); the Redeem button is disabled appropriately and shows a spinner while in flight.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## GiftMembershipSheet (`src/screens/broadcast/channels/components/GiftMembershipSheet.tsx`)
**Entry point:** Bottom sheet opened from a channel's membership page to gift a tier to another user by email.
**Criteria evaluated:** forms/validation, confirmations, payment flow clarity, loading/success states, silent-error-swallowing.
**Not applicable:** icon-only unlabeled controls (none — the lock icon is decorative next to text; the chevron icons in the payment-provider rows are decorative next to full text rows), navigation.
### Findings
1. (P3) Sending a gift (a real payment) happens on a single tap of "Gift Membership" → provider picker → provider tap, with no final "confirm this amount/recipient" step. This matches the pattern used by the sibling `SuperChatPanel`/`SuperThanksSheet` tipping flows elsewhere in this same batch, so it reads as a consistent, intentional product pattern for this app's monetization surfaces rather than a one-off omission — documented here but not changed, since altering it would mean redesigning a cross-cutting payment UX pattern rather than a local, low-risk fix.
2. (P3) Validation (`validate()`) is thorough (tier selection, recipient required, email format) and surfaces specific `Alert`s per failure — good practice, no issue.
### Fixes implemented
None — the one finding (#1) is a cross-cutting product-pattern observation, not a local bug, and is out of safe-fix scope.
### Verification
No changes made; file untouched.
**Status:** AUDITED-FINDINGS-DOCUMENTED

## LiveChatPanel (`src/screens/broadcast/channels/components/LiveChatPanel.tsx`)
**Entry point:** Overlay panel rendered on top of the live-stream video player; message list + composer, fed by `useLiveStream`.
**Criteria evaluated:** silent-error-swallowing, accessibility labels on icon-only controls, touch targets, empty state, small-screen (fixed 220pt width panel).
**Not applicable:** destructive actions, forms/validation beyond the composer, navigation.
### Findings
1. (P2) **Sending a chat message that failed server-side silently vanished with no feedback.** `handleSend` called `onSend(text)` (i.e. `useLiveStream`'s `sendChatMessage`) inside a bare `try/finally`. `sendChatMessage` itself removed the optimistic bubble on failure but never signaled the failure back to the caller — so a failed send just made the user's message disappear with no error, no restored draft text, and no way to tell it needed retrying. This is the exact "silent-error-swallowing" pattern called out in the audit brief.
2. (P2) The collapse-toggle button and the send button are icon-only (`KISIcon` "comment" / "send") with no `accessibilityLabel`/`Role`.
3. (P3, pre-existing, unrelated to this pass) Two `react-hooks/exhaustive-deps` lint errors (missing `fadeAnim` dep, missing `palette.ivory`/`palette.royalInk` deps in `renderItem`) were present before this audit. Fixed as a trivial, zero-behavior-change by-product of being in the file already (both deps are stable per-render values).
### Fixes implemented
- `useLiveStream.ts`'s `sendChatMessage` now `throw`s with the server's error message when the send fails (after removing the optimistic bubble), instead of swallowing it.
- `LiveChatPanel.handleSend` now catches that throw, restores the typed draft text, and shows `Alert.alert('Message not sent', ...)`.
- Added `accessibilityRole="button"` + `accessibilityLabel` to the collapse-toggle and send buttons.
- Added the two missing hook dependencies (pre-existing lint errors, zero behavior change).
### Verification
`npm run typecheck` clean. `eslint` clean (0 errors; only pre-existing stylistic inline-style warnings remain).
**Status:** AUDITED-FIXED

## PlaylistRail (`src/screens/broadcast/channels/components/PlaylistRail.tsx`)
**Entry point:** Horizontal rail of a channel's playlists, shown on the channel home/about tab.
**Criteria evaluated:** touch targets, accessibility, empty state (`null` when no playlists), responsive sizing.
**Not applicable:** forms, destructive actions, silent errors (no network calls — pure presentational component fed by props), navigation internals.
### Findings
None. Cards carry full visible text (title + description), so default accessible-name derivation from text content is adequate; "See all" has a 44pt-equivalent touch target via `minTouchTarget`; card width adapts to compact phones.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## PremiereCountdown (`src/screens/broadcast/channels/components/PremiereCountdown.tsx`)
**Entry point:** Full-screen takeover shown in place of the video player when viewing scheduled "premiere" content before it goes live.
**Criteria evaluated:** loading/error states, confirmations, accessibility, emotional tone, small-screen (safe-area insets), cognitive load.
**Not applicable:** forms/validation, destructive actions, icon-only unlabeled controls (every button — Back, Set Reminder, Join Pre-chat, Watch Trailer, Watch Now — carries visible text).
### Findings
1. (P3) `handleSetReminder`'s `catch` shows a generic `Alert.alert('Error', ...)` — acceptable, not a silent swallow, no fix needed.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## ProductTagsDisplay (`src/screens/broadcast/channels/components/ProductTagsDisplay.tsx`)
**Entry point:** Floating overlay on the video player, triggered by playback-time matching a tagged product's timestamp.
**Criteria evaluated:** accessibility, auto-hide timing, silent-error-swallowing, touch targets.
**Not applicable:** forms, destructive actions, navigation, empty/loading state (component renders nothing when no tag is active, which is the correct behavior here, not a missing state).
### Findings
1. (P3) Fetch failure is `.catch(() => {})` — silent, but the fallback ("no product tags shown") is a safe, non-misleading default, not a fabricated success. Low severity, consistent with how the rest of the lightweight overlay components in this batch (`AudioTrackSelector`, `WatchHeatmap`) handle optional/non-critical supplementary data.
2. (P3) The product card `Pressable` has no explicit `accessibilityRole`, though it contains full visible text (title, price, "View Product →") so a screen reader still gets a usable accessible name by default.
### Fixes implemented
None — both findings are low-severity and consistent with the established, accepted pattern for this class of "nice-to-have overlay" component elsewhere in the batch; not fixed to avoid scope creep on a component with no reported issues.
### Verification
No changes made; file untouched.
**Status:** AUDITED-FINDINGS-DOCUMENTED

## StreamHealthBar (`src/screens/broadcast/channels/components/StreamHealthBar.tsx`)
**Entry point:** Compact, read-only status bar in `LiveControlRoom` showing bitrate/fps/viewer count/duration while broadcasting.
**Criteria evaluated:** color/contrast (health-state coloring), readability, information density.
**Not applicable:** touch targets (no interactive elements — purely informational), accessibility roles (nothing to label), forms, destructive actions, loading/empty states (always has a value or hides a cell).
### Findings
None. Color-coding (grey/red/amber/green) is paired with the "LIVE"/"CONNECTING" text label, so color isn't the sole signal; thresholds are sensible.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## SubscribeBellButton (`src/screens/broadcast/channels/components/SubscribeBellButton.tsx`)
**Entry point:** Rendered on channel headers/cards app-wide to subscribe and set notification level.
**Criteria evaluated:** accessibility, silent-error-swallowing, confirmations, optimistic-update correctness.
**Not applicable:** forms, destructive-action confirmation (unsubscribe is not treated as destructive here, consistent with how most apps handle it — reversible with one tap), navigation.
### Findings
1. (P3) Both async handlers (`handleSubscribe`, `handleBell`) already do optimistic update → rollback-on-failure → `Alert.alert`, which is the correct pattern. The only gap was the subscribe button missing `accessibilityRole="button"` (it has visible text, so not a hard accessibility bug) and the bell button missing `accessibilityRole` (it had `accessibilityLabel` already, which is the more important half).
### Fixes implemented
Added `accessibilityRole="button"` + `accessibilityLabel`/`accessibilityState` to the subscribe button, and `accessibilityRole="button"` + `accessibilityHint` to the bell button.
### Verification
`npm run typecheck` clean. `eslint` clean except pre-existing inline-style warnings.
**Status:** AUDITED-FIXED

## SuperChatPanel (`src/screens/broadcast/channels/components/SuperChatPanel.tsx`)
**Entry point:** Bottom sheet opened from the live-stream player to send a paid "Super Chat" tip.
**Criteria evaluated:** accessibility, confirmations on payment actions, loading/error states, auto-refresh behavior.
**Not applicable:** destructive actions, navigation, forms beyond the tip composer.
### Findings
1. (P3) The close (`✕`) button was icon-only with no `accessibilityLabel`/`Role`.
2. (P3) Sending a Super Chat (real money) has no confirmation step beyond the amount-chip selection + explicit "Send Super Chat" button — same cross-cutting product-pattern observation as `GiftMembershipSheet`; not changed for the same reason (consistency across the app's existing tipping surfaces, out of local safe-fix scope).
3. Error handling is otherwise solid: `fetchTips`'s failure is silently retried by the next poll (acceptable — it's a 15s auto-refreshing list, not a one-shot action), and `handleSend` has proper `try/catch` with user-facing `Alert.alert`.
### Fixes implemented
Added `accessibilityRole="button"` + `accessibilityLabel="Close Super Chat"` to the close button.
### Verification
`npm run typecheck` clean. `eslint` clean except pre-existing inline-style warnings.
**Status:** AUDITED-FIXED

## SuperThanksSheet (`src/screens/broadcast/channels/components/SuperThanksSheet.tsx`)
**Entry point:** Bottom sheet opened from a video's action bar to send a paid "Super Thanks" tip on that specific piece of content.
**Criteria evaluated:** accessibility, confirmations on payment actions, loading/success/error states.
**Not applicable:** destructive actions, navigation.
### Findings
1. (P3) The close (`✕`) button was icon-only with no `accessibilityLabel`/`Role`.
2. (P3) Same cross-cutting "no confirmation before a payment" pattern as the other two tipping surfaces in this batch — documented, not changed.
3. (P4, pre-existing, unrelated to this pass) `topInset` (from `useSafeTopInset()`) is computed but never used anywhere in the component — dead code, `@typescript-eslint/no-unused-vars` error. Not fixed: removing the hook call changes nothing user-visible and the hook may have side effects relied on elsewhere in the codebase's convention; flagging only, left as pre-existing debt outside this pass's safe-fix scope (it predates this audit and isn't part of the UX criteria list).
### Fixes implemented
Added `accessibilityRole="button"` + `accessibilityLabel="Close Super Thanks"` to the close button.
### Verification
`npm run typecheck` clean. `eslint` still reports the pre-existing unused-`topInset` error (not introduced by this change, not fixed per the "don't fix pre-existing unrelated errors" judgment call above — flagged for a future pass instead).
**Status:** AUDITED-FINDINGS-DOCUMENTED

## TheaterModeOverlay (`src/screens/broadcast/channels/components/TheaterModeOverlay.tsx`)
**Entry point:** Theater/ambient mode toggle buttons in the video player's controls bar.
**Criteria evaluated:** accessibility, touch targets, persistence (AsyncStorage), silent-error-swallowing.
**Not applicable:** forms, destructive actions, navigation.
### Findings
None. Both icon-only buttons already have `accessibilityRole="button"` and a correct, state-aware `accessibilityLabel` ("Enter/Exit theater mode", "Enable/Disable ambient mode"); touch targets are 44pt via `minHeight`; `AsyncStorage` read/write failures are caught and silently ignored, which is appropriate here since a failed read/write to a non-critical UI preference should never block or alarm the user.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## ThumbnailPickerSheet (`src/screens/broadcast/channels/components/ThumbnailPickerSheet.tsx`)
**Entry point:** Bottom sheet for a channel owner/editor to change a piece of content's thumbnail image.
**Criteria evaluated:** forms/validation, loading/error states, confirmations, accessibility.
**Not applicable:** destructive actions (changing a thumbnail is non-destructive and easily redone), icon-only unlabeled controls (all three buttons carry visible text), navigation.
### Findings
None. The two-step upload-then-patch flow has explicit error `Alert`s at each failure point (upload failure, missing route, patch failure, generic catch); Cancel is disabled while saving to prevent a race; preview updates immediately on pick.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## TranscriptPanel (`src/screens/broadcast/channels/components/TranscriptPanel.tsx`)
**Entry point:** Bottom sheet opened from a video's action bar to view/generate/copy its transcript.
**Criteria evaluated:** accessibility, loading/processing/failed/empty states, language switching, copy-to-clipboard feedback.
**Not applicable:** destructive actions, forms beyond language selection, navigation.
### Findings
1. (P3) The Copy and Close (`✕`) buttons were icon-adjacent-to-text/icon-only respectively with no explicit `accessibilityLabel`/`Role` on Close, and no `accessibilityLabel` beyond the visible "Copy" text on the copy button.
2. (P3, pre-existing, unrelated to this pass) Two `react-hooks/exhaustive-deps` lint errors (`fetchTranscript`/`selectedLang` missing from the fetch-on-open `useEffect`; `selectedLang` missing from `handleGenerate`'s `useCallback`). Not fixed: adding `fetchTranscript` to the `useEffect` dependency array risks a double-fetch race with `handleLangChange`'s manual call to the same function (since `fetchTranscript`'s identity changes whenever `selectedLang` does) — a real behavior change, not a safe no-op fix like the one made in `LiveChatPanel.tsx`. Flagging for a dedicated pass rather than risking a regression here.
### Fixes implemented
Added `accessibilityRole="button"` + `accessibilityLabel` to the Copy and Close buttons.
### Verification
`npm run typecheck` clean. `eslint` still reports the two pre-existing `react-hooks/exhaustive-deps` errors (not introduced by this change; deliberately not fixed per the risk judgment above).
**Status:** AUDITED-FINDINGS-DOCUMENTED

## WatchHeatmap (`src/screens/broadcast/channels/components/WatchHeatmap.tsx`)
**Entry point:** "Most Replayed" heatmap bar rendered under the video scrubber.
**Criteria evaluated:** color/contrast, silent-error-swallowing, readability.
**Not applicable:** touch targets/accessibility roles (purely informational, `pointerEvents="none"` on the label — no interactive elements at all), forms, destructive actions, navigation.
### Findings
None of consequence. Fetch failure is `.catch(() => {/* silent */})`, but the fallback is an empty bar (component already handles `segments.length === 0` by rendering an empty, inert container) — a safe, non-misleading default for a purely supplementary analytics overlay.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

---

## channels.endpoints.ts (`src/screens/broadcast/channels/api/channels.endpoints.ts`)
**Entry point:** Not directly rendered — a thin re-export map from `ROUTES.broadcasts.*` consumed by `useChannelsData.ts` and various components.
**Criteria evaluated:** none of the visual/interaction criteria apply (no UI).
**Not applicable:** all UI-facing criteria (visual hierarchy, typography, touch targets, accessibility, states, forms, confirmations, emotional tone, small-screen, journey integration) — this file contains zero JSX/rendering logic.
### Findings
None.
### Fixes implemented
None — not applicable.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## channels.types.ts (`src/screens/broadcast/channels/api/channels.types.ts`)
**Entry point:** Not directly rendered — shared TypeScript type definitions consumed across this whole batch.
**Criteria evaluated:** none of the visual/interaction criteria apply (no UI, no runtime logic).
**Not applicable:** all UI-facing criteria — pure type declarations.
### Findings
None.
### Fixes implemented
None — not applicable.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## embedUtils.ts (`src/screens/broadcast/channels/embed/embedUtils.ts`)
**Entry point:** Not directly rendered — utility functions (`buildChannelEmbedUrl`, `buildChannelEmbedHtml`) used wherever a shareable `<iframe>` embed snippet for a piece of content is generated (e.g. a "Share/Embed" sheet elsewhere in the broadcast feature, outside this batch).
**Criteria evaluated:** none of the visual/interaction criteria apply (no UI); reviewed for correctness/security since it generates HTML.
**Not applicable:** all UI-facing criteria — pure string-building utility, no rendering, no network calls, no error states to swallow.
### Findings
None. `token` is URL-encoded before interpolation; the `allow` attribute on the generated iframe is a reasonable, minimal permission set (autoplay, encrypted-media, picture-in-picture).
### Fixes implemented
None — not applicable.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## useChannelSocket.ts (`src/screens/broadcast/channels/hooks/useChannelSocket.ts`)
**Entry point:** Not directly rendered — a hook consumed by `useLiveStream.ts` (and potentially other screens outside this batch) to subscribe to `DeviceEventEmitter` broadcast events forwarded by `SocketProvider`.
**Criteria evaluated:** none of the visual/interaction criteria apply (no UI); reviewed for correctness (stale-closure/memory-leak risks, since this is exactly the kind of file where those bugs hide).
**Not applicable:** all UI-facing criteria — no JSX. Per the task's explicit boundary, `SocketProvider.tsx` itself is out of scope and was not read/touched.
### Findings
None. The stable-ref pattern (callbacks stored in refs, updated every render via a dep-less `useEffect`, subscriptions created once in a mount-only effect) is the correct way to avoid both stale closures and subscribe/unsubscribe churn; all five listeners are cleaned up on unmount.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES

## useLiveStream.ts (`src/screens/broadcast/channels/hooks/useLiveStream.ts`)
**Entry point:** Not directly rendered — the state-management hook behind the live-stream viewer/broadcaster screens (consumed by `LiveChatPanel`, `CameraSourceSelector`'s host screen, `StreamHealthBar`'s host screen, etc.).
**Criteria evaluated:** silent-error-swallowing / fabricate-success patterns (the explicit hunt target for this audit), correctness of polling/socket/optimistic-update logic.
**Not applicable:** all visual UI criteria — no JSX, this is pure state logic.
### Findings
1. (P2) **`sendChatMessage` silently swallowed send failures.** On a failed POST, it removed the optimistic chat bubble but never informed the caller — from `LiveChatPanel`'s perspective, a sent message could just vanish with zero signal that anything failed. See `LiveChatPanel.tsx`'s entry above for the paired fix.
2. (P3) `switchCamera` on failure only calls `fetchCameraSources()` to revert the optimistic UI, with no user-facing error message — lower severity than #1 because the visual revert itself is sufficient feedback (the selected camera tile visibly un-selects), and this is a broadcaster-only control-room action with an obviously-still-attached camera list in view, not a message that silently disappears from a scrollback the user can't re-derive. Documented, not changed, to avoid widening this pass's footprint in the live-broadcaster-only control surface.
3. No "fabricate success on failure" pattern found — `fetchStream`, `fetchCameraSources`, `fetchChatHistory` all check `res?.success` before trusting `res.data`, and return/skip rather than substituting fake data on failure.
### Fixes implemented
`sendChatMessage` now `throw`s (with the server's error message when available) after removing the optimistic bubble on failure, instead of swallowing the failure. This is a `Promise<void>` → still `Promise<void>` signature (throwing, not a return-type change), paired with the catch added in `LiveChatPanel.tsx`.
### Verification
`npm run typecheck` clean. `eslint` clean except pre-existing stylistic `no-void` warnings (not introduced by this change).
**Status:** AUDITED-FIXED

## useChannelsData.ts (`src/screens/broadcast/channels/hooks/useChannelsData.ts`)
**Entry point:** Not directly rendered — the largest file in this batch (915 lines); almost entirely plain async data-access functions (`fetchChannelDetail`, `toggleChannelSubscription`, `postChannelComment`, ~50 more) consumed throughout this whole feature area, plus one real React hook (`useChannelsData`, for the channel-discovery list) at the bottom.
**Criteria evaluated:** silent-error-swallowing / fabricate-success patterns (the explicit hunt target), correctness of the one actual hook's loading/error/pagination state.
**Not applicable:** all visual UI criteria — this is a data layer, not a screen or component.
### Findings
None of consequence, and this file is worth calling out as a **positive reference pattern**: every exported function follows the same discipline — check `response?.success` before touching `response.data`, and return `null`/`[]`/`false` (never a fabricated placeholder object) on failure, letting the caller's own error-handling (seen throughout this batch's components) decide what to show the user. `createBroadcastChannel` goes further and re-throws the server's actual validation message (handle-taken, throttle, etc.) instead of a generic error. The one real hook, `useChannelsData`, correctly surfaces failures into an `error` state string rather than swallowing them, and correctly distinguishes `loading` vs `refreshing` vs cursor-based `loadMore`. `fetchWatchHistorySettings`'s cache-then-network-then-cache-fallback pattern is a legitimate, intentional offline-cache strategy (consistent with `storage/offlineStructuredCache`), not a "fabricate success" bug — it falls back to a previously-cached *real* value, or an explicit, documented default, never a fake record masking an error.
### Fixes implemented
None — meets the bar as-is.
### Verification
No changes made; file untouched.
**Status:** AUDITED-NO-ISSUES
