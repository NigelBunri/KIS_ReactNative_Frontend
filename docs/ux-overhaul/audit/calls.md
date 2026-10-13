# UX/UI Audit — Calls

**Batch:** `src/screens/calls/**` (27 files: root screens, `components/`, `hooks/`) and `src/components/calls/**` (1 file remaining — `CallOverlay.tsx` was confirmed-dead and deleted in a prior pass of this same audit program).
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility audit, not a file inventory. A prior pass already audited and fixed 14 files with accessibility-label-only additions (verified via `git diff` + typecheck in this pass — re-confirmed clean, left exactly as-is): `CallMiniBadge.tsx`, `LobbyScreen.tsx`, `ScheduleCallSheet.tsx`, `WaitingForHostScreen.tsx`, `BreakoutRoomsSheet.tsx`, `InCallPollSheet.tsx`, `InCallQASheet.tsx`, `InCallWhiteboardSheet.tsx`, `InviteLinkCard.tsx`, `NetworkQualityBars.tsx`, `ParticipantTile.tsx`, `RtmpSheet.tsx`, `VirtualBackgroundSheet.tsx`, `WaitingRoomPanel.tsx`. This pass covers the remaining 14 files, summarized at the end for the other 14 for a complete batch record.
**Context:** the calls surface had a recent multi-day bug-fix campaign (incoming-call UI, background/killed-state ringing, participant-identity, device-ack, decline action) landed by another active session — the call code is recently-hardened. This pass was deliberately conservative: trivial accessibility/color-contrast/layering fixes were applied directly; anything touching call logic, signaling, or state handling was documented rather than changed, since no peer session could be reached to coordinate (no `ListAgents` tool was available in this agent's toolset to find one).

## Summary

28/28 files in this directory pair now have an audit record. Of the 14 files audited in this pass: 7 got trivial, safe fixes (accessibility labels/roles, one design-system color-token swap, one z-index layering fix); 5 had no issues worth changing; 2 have real findings that are documented but **not fixed**, flagged for coordination with the calls-owning session because fixing them means touching behavior/state handling in this recently-hardened surface.

The single most important finding in this batch: **`IncomingCallScreen.tsx`'s "Remind me" snooze option starts an indefinitely-repeating `Vibration.vibrate(pattern, true)` on a bare `setTimeout` (1 or 5 minutes out) with no cleanup tied to the component's lifecycle.** The screen's own `useEffect` cleanup (which calls `Vibration.cancel()`) runs on unmount — i.e., the moment the call is answered/declined/dismissed, which in the normal case happens well before the 1–5 minute timer fires. When that timer then fires against an already-unmounted screen, it starts a vibration loop (`repeat: true`) with nothing left anywhere in JS to ever cancel it. The phone keeps vibrating in an endless loop from an action the user has no memory triggered, with no visible UI tied to it, recoverable only by an OS-level restart or the vibration motor's own device-specific timeout. This is a real, reproducible bug, not a style nitpick, but fixing it means changing lifecycle/cleanup behavior inside the call-ringing code the other session just finished hardening — documented, not touched.

The second finding worth flagging: `ParticipantsSheet.tsx`'s host-only "Remove participant" action fires `onRemove(item.userId)` immediately on tap with **no confirmation**, unlike the adjacent "Change role" action on the same row (which already confirms via an `Alert` with explicit choices) and unlike the call's own "End call" flow (which already has a careful host/leave/end-for-everyone confirmation `Alert` wired in `SocketProvider.tsx`). A mis-tap removes someone from the call outright. Documented, not fixed, for the same reason.

---

## ActiveCallScreen (`src/screens/calls/ActiveCallScreen.tsx`)
**Entry point:** mounted imperatively from `SocketProvider.tsx` (repo root) when `isActiveOrConnecting && activeCall && !isIncoming && (!callMinimised || isEnded)`.
**Criteria evaluated:** visual hierarchy/layout, color/contrast/design-system consistency, touch targets, accessibility labels on icon-only controls, forms/confirmations, emotional tone, small-screen/tablet usability, native PiP handling.
**Not applicable:** navigation/back-behavior (full-screen call `Modal`, no back stack); offline state (handled upstream by the socket layer, not this screen).

### Findings
1. **Design-system inconsistency: Android "Add to call" modal used hardcoded hex colors instead of palette tokens (P3).** Every other surface in this 900-line file resolves color from `palette.*`; this one modal (lines ~870–899) used literal `#1B1428`, `#FFF4B8`, `#D9A875`, `#F7F1E3`, `#8A6557`, `#FFFFFF`, and a bare `rgba(0,0,0,0.6)` backdrop — meaning it wouldn't respond to theme/accent changes the rest of the call UI does.
2. **Missing accessibility role/label on "Cancel"/"Invite" buttons and the username `TextInput` in that same modal (P3).**
3. **Good: the end-call confirmation flow is already correct (no fix needed).** `onEnd` is wired from `SocketProvider.tsx` with a proper host/group-admin check and a three-way `Alert` ("Leave call" / "End for everyone" / "Cancel") before any destructive action — exactly the kind of guard this audit was told to hunt for the *absence* of, and it's already present and well-reasoned (fails closed on a failed admin-role fetch).
4. **Good: PiP, ringback, and pulsing-dial animations are all cleaned up correctly on unmount** — no orphaned timers/intervals found in this file (contrast with the `IncomingCallScreen` finding below).

### Fixes implemented
- Swapped the Add-participant modal's hardcoded hex values for the matching `palette.*` tokens (`palette.overlay`, `palette.royalInk`, `palette.goldHighlight`, `palette.inputBorder`, `palette.ivory`, `palette.subtext`, `palette.gold`, `palette.goldDeep`) — visual-only, no behavior change.
- Added `accessibilityRole="button"`/`accessibilityLabel` to the modal's Cancel/Invite buttons and `accessibilityLabel` to its `TextInput`.

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing warnings/errors only (inline-style warnings, one pre-existing `react-hooks/exhaustive-deps` error in an unrelated `SpeakingWave` effect); nothing introduced by this change (confirmed against `git diff`).

**Status:** AUDITED-FIXED

---

## CallDiagnosticsModal (`src/screens/calls/CallDiagnosticsModal.tsx`)
**Entry point:** long-press on the Calls tab header (see `CallsTab.tsx`) — deliberately not a prominent nav item, works in signed release builds (not gated behind `__DEV__`).
**Criteria evaluated:** forms/confirmations, accessibility labels/roles, touch targets, cognitive load.
**Not applicable:** emotional tone / small-screen usability (debug-only utility screen, not part of the normal calling journey); loading/offline states (reads local `AsyncStorage`/in-memory diagnostics only, nothing to fail over network).

### Findings
1. **"Clear" button wipes all recorded call-diagnostic events with no confirmation (P3 — low severity).** This only clears a local debug log (not call state, not a live call), so the blast radius of a mis-tap is low, but it's still a destructive action with zero confirmation on a screen real testers can reach.
2. **No `accessibilityRole`/consistent labeling on any of the Close/Clear/Refresh/Open-App-Settings buttons (P3).**

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to Close, Clear, Refresh, and Open App Settings.
- Did **not** add a confirmation to "Clear" — left as documented-only. Unlike the two coordination-flagged findings below, this isn't part of the hardened call-signaling path (it only touches a local diagnostics array), so it's low-risk, but it's still a user-visible behavior change to an already-ad-hoc debug screen, and the fix is trivial enough that the calls-owning session (or the user) can add it in one line (`Alert.alert('Clear diagnostics?', ..., [{text:'Cancel'}, {text:'Clear', onPress: ...}])`) if desired.

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing warnings only (inline styles, `no-void`); nothing introduced.

**Status:** AUDITED-FIXED

---

## CallJoinScreen (`src/screens/calls/CallJoinScreen.tsx`)
**Entry point:** real navigator route `CallJoin` (`call/join/:token`), registered in `App.tsx` for the `kis://call/join/:token` deep link.
**Criteria evaluated:** loading/empty/error states, forms/confirmations, accessibility labels, touch targets, emotional tone.
**Not applicable:** destructive actions (none — join/leave only); offline state (network failure already mapped to its own error-phase message).

### Findings
1. **Good: all four phases (loading/preview/joining/error) are handled distinctly with real, specific copy (no fix needed)** — "This invite link is invalid or has expired," "This call has already ended," "Could not load call information. Please check your connection," "Unable to join the call right now" are all genuinely different messages mapped to genuinely different failure causes, not one generic catch-all. This is the honest-error-state pattern the audit was told to look for the *absence* of.
2. **Missing `accessibilityRole="button"` on "Join call," "Not now," and "Go Home" (P3).** "Join call" already had a label but no role; the other two had neither.

### Fixes implemented
- Added `accessibilityRole="button"` to all three Pressables, plus `accessibilityLabel` on "Not now" and "Go Home".

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing `no-void`/inline-style warnings only; nothing introduced.

**Status:** AUDITED-FIXED

---

## IncomingCallScreen (`src/screens/calls/IncomingCallScreen.tsx`)
**Entry point:** mounted imperatively from `SocketProvider.tsx` when `isIncoming && activeCall`.
**Criteria evaluated:** accessibility labels/roles on icon-only controls, touch targets (82pt action buttons — well above the 44pt minimum), emotional tone, tablet scaling, timer/vibration lifecycle.
**Not applicable:** forms/validation; navigation/back (full-screen ringing `Modal`, deliberately has no back gesture).

### Findings
1. **P1 — "Remind me" can start a vibration loop that nothing can ever stop.** See Summary above for the full mechanism. To restate the core defect precisely: `onPress` on the "1 minute"/"5 minutes" `Alert` options calls `setTimeout(() => Vibration.vibrate(VIBRATE_PATTERN, true), 60_000 | 300_000)` with no stored timer ID and no mounted-check. The screen's `useEffect` cleanup — the *only* place that ever calls `Vibration.cancel()` — runs at unmount, which for a real call happens long before the delayed callback fires (the user answers, declines, or the call times out within seconds, not minutes). The result: a `true`-repeat vibration starts on a device with no incoming-call screen showing and no way left in JS to cancel it.
   - **This is a logic/lifecycle fix, not a cosmetic one** (needs either a ref tracking live timeout IDs cleared on unmount, or dropping `repeat: true` for the reminder buzz, or gating the delayed callback behind an `isMountedRef` check) — exactly the category of change this audit was told to coordinate on rather than make unilaterally in this recently-hardened file. **Flagged as needing coordination with the calls-owning session; not fixed in this pass.** Attempted to reach that session per the audit brief's `ListAgents`/`SendMessage` protocol — no `ListAgents` tool was available in this agent's toolset, so per the brief's own fallback ("if you can't reach them... document the finding instead"), this is documented only.
2. **Missing `accessibilityRole`/label on "Remind me" and "Answer (no cam)" (P3 — trivial, fixed).** Contrast with `CallActionButton` (Decline/Accept) which already has both.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to "Remind me" and "Answer (no cam)".
- Finding #1 (the vibration-loop bug) is **documented only — needs coordination with the calls-owning session.**

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing `react-hooks/exhaustive-deps`/`no-void` warnings/errors (the deliberate `[!!session]` dependency array predates this pass, per its own inline comment); nothing introduced by the two added props.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## BroadcastLayout (`src/screens/calls/components/BroadcastLayout.tsx`)
**Entry point:** rendered inside `ActiveCallScreen` when `isBroadcast`.
**Criteria evaluated:** visual hierarchy (host/co-host/speaker/audience sectioning), color/contrast, cognitive load.
**Not applicable:** accessibility labels on icon-only controls (none here directly — on-stage/audience tiles delegate to the already-audited `ParticipantTile`); forms/confirmations (no interactive forms); destructive actions (none).

### Findings
None. The LIVE/REC chips, viewer count, on-stage strip, raised-hands strip, and audience bar are all plain `Text`/`View` (already screen-reader-legible by default), palette-driven, and the height math (`mainH`) correctly accounts for every optional section above it.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## CallControls (`src/screens/calls/components/CallControls.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`, pinned to the bottom of every call type.
**Criteria evaluated:** touch targets (65×72 main buttons, 65×72 End button — both well above 44pt), accessibility labels/roles on every icon-only control, "coming soon" honesty (recording/RTMP), emotional tone/visual calm during time pressure.
**Not applicable:** forms/confirmations (End-call confirmation lives upstream in `SocketProvider.tsx`, already verified correct under `ActiveCallScreen` above); destructive actions beyond End (none here).

### Findings
None. Every single button already carries both `accessibilityLabel` and `accessibilityRole="button"`, including the pinned End button. "Record"/"Stream" are explicitly labeled "(soon)" and show an honest `Alert` explaining they aren't wired to a real capture pipeline yet rather than silently no-op'ing or fabricating success — this is exactly the opposite of the "fabricate success on failure" pattern this audit was told to hunt for.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## CallTimer (`src/screens/calls/components/CallTimer.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`'s top HUD, the ended-call card, and `BroadcastLayout`'s LIVE bar.
**Criteria evaluated:** typography/legibility (tabular-nums, letterspacing), color/contrast.
**Not applicable:** everything else — this is a 26-line pure-presentation component with no interactivity.

### Findings
None.

### Fixes implemented
None.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## useCallTimer (`src/screens/calls/hooks/useCallTimer.ts`)
**Entry point:** not applicable — a hook consumed by `CallTimer.tsx`.
**Criteria evaluated:** none of the UX criteria apply directly; reviewed for correctness since it drives on-screen elapsed time.
**Not applicable:** all visual/accessibility criteria (no JSX).

### Findings
None. Interval is correctly cleared on every dependency change and on unmount; the "frozen at final duration" behavior for ended/missed calls is deliberate and well-commented.

### Fixes implemented
None.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## CaptionOverlay (`src/screens/calls/components/CaptionOverlay.tsx`)
**Entry point:** rendered inside `ActiveCallScreen` when `session.captionsEnabled`.
**Criteria evaluated:** honesty of degraded-feature state, accessibility of dynamically-updating text, emotional tone.
**Not applicable:** touch targets/forms (no interactive controls in this component — send/toggle controls live in `CallControls`); destructive actions (none).

### Findings
1. **Good: honest about the disabled STT path (no fix needed).** `VOICE_STT_ENABLED = false` is a clearly-commented, deliberate off switch with exact enablement steps in a code comment — relay-only captioning (seeing others' captions, not sending your own) is the correct and honestly-represented behavior for a build without the native voice module, not a silently-broken feature.
2. **Caption text updates had no live-region hint for screen readers (P3).** New captions appearing at the bottom of the screen wouldn't be proactively announced to a screen-reader user tracking the call without normal sighted attention on that region.

### Fixes implemented
- Added `accessibilityLiveRegion="polite"` to the caption container (Android-only API; no-op elsewhere) so new captions get announced as they arrive, without collapsing the subtree's per-line text (deliberately did not set `accessible`+a static label, which would have hidden the actual caption content from screen readers).

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing errors (`'Pressable' is defined but never used`, `'onToggleSend' is defined but never used`, a missing-`opacity`-dependency warning) all predate this change (confirmed via `git diff` — the one line added is the new prop); nothing introduced.

**Status:** AUDITED-FIXED

---

## InCallChatSheet (`src/screens/calls/components/InCallChatSheet.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`, toggled via the Chat control.
**Criteria evaluated:** touch targets (44×44 close/send buttons), accessibility labels/roles, color contrast (own-message bubble explicitly comments on its 10:1 contrast ratio), empty state, keyboard handling.
**Not applicable:** destructive actions (chat messages aren't deletable from this sheet).

### Findings
None of note. Close and Send both have correct `accessibilityLabel`+`accessibilityRole`, the empty state ("No messages yet. Say hi! 👋") is warm without being saccharine, and the slide-in/out animation correctly defers unmounting until the animation finishes (`mounted` state pattern) rather than popping instantly.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## NetworkQualityBanner (`src/screens/calls/components/NetworkQualityBanner.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`, shown when `quality` is poor or the call has downgraded to audio-only.
**Criteria evaluated:** visual hierarchy/layering, color/contrast per severity level.
**Not applicable:** accessibility labels (plain `Text`, already screen-reader legible); forms (none).

### Findings
1. **P2 — banner's `zIndex: 100` painted it directly over `ActiveCallScreen`'s top HUD.** The banner is `position: 'absolute', top: 0`, full-width, with `zIndex: 100`; `ActiveCallScreen`'s `topHud` (minimize button, call title, timer, state label, encryption padlock, network-quality bars, call-type chip) sits at the same `top: 0` with `zIndex: 10`. Whenever this banner was visible — i.e., exactly when the network is bad or the call just dropped to audio-only — it rendered on top of and obscured the HUD underneath it, hiding the minimize control and the rest of the top-row info for as long as the degraded state lasted. This is precisely the moment a caller is most likely to want the minimize button or to check call info, and it was the one thing getting covered.

### Fixes implemented
- Changed the banner's `zIndex` from `100` to `9` (one below `topHud`'s `10`), so the HUD's controls and text now render on top of the banner's colored strip instead of being hidden behind it. Purely a stacking-order style change — no logic, no API, no state handling touched.

### Verification
`npm run typecheck` — clean. `npx eslint` — one pre-existing `react-hooks/exhaustive-deps` error (missing `opacity` dependency, predates this change per `git diff`); nothing introduced by the zIndex edit.

**Status:** AUDITED-FIXED

---

## ParticipantsSheet (`src/screens/calls/components/ParticipantsSheet.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`, toggled via the People control.
**Criteria evaluated:** forms/confirmations (explicit audit focus on destructive actions), accessibility labels/roles, touch targets (44×44 action buttons).
**Not applicable:** loading/offline states (purely derived from the already-loaded `session.participants` list).

### Findings
1. **P1/P2 — "Remove participant" (host-only) fires immediately with no confirmation.** `onPress={() => onRemove(item.userId)}` — one tap and the participant is gone from the call, no `Alert`, no undo. Compare directly against the two other host actions on the exact same row: "Mute" is a reasonable no-confirm toggle (non-destructive, instantly reversible), but "Change role" *already* confirms via an `Alert` listing the specific role choices before acting — "Remove" is strictly more destructive than a role change (it ends someone's participation outright) yet is the one action in this file with zero confirmation. This is the exact pattern the audit brief called out by name ("flag destructive actions without confirmation, e.g. ending a call for everyone") — this is that pattern's sibling case for a single participant instead of the whole call.
   - **Flagged as needing coordination with the calls-owning session, not fixed in this pass** — adding a confirmation `Alert` here is a straightforward, low-risk change in isolation, but it changes behavior on a host-moderation action inside the same call-state surface the other session just finished hardening (and the right confirmation copy/choices arguably ought to match whatever pattern they're already using for similar guards elsewhere, e.g. the end-call `Alert` in `SocketProvider.tsx`). No `ListAgents` tool was available to actually reach that session, so per the audit brief's fallback, this is documented only.
2. **Missing `accessibilityRole="button"` on "Change role" (P3 — trivial, fixed).** It already had a correct `accessibilityLabel`; only the role was missing.

### Fixes implemented
- Added the missing `accessibilityRole="button"` to "Change role".
- Finding #1 (no confirmation on Remove) is **documented only — needs coordination with the calls-owning session.**

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing errors (`'topInset' is assigned a value but never used`, a missing-`slideAnim`-dependency warning) predate this change (confirmed via `git diff` — only the one `accessibilityRole` line was added); nothing introduced.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## ReactionsLayer (`src/screens/calls/components/ReactionsLayer.tsx`)
**Entry point:** rendered inside `ActiveCallScreen`'s content area, floating over the video/voice layout.
**Criteria evaluated:** accessibility of purely decorative/animated content, emotional tone.
**Not applicable:** touch targets/forms (the whole layer is `pointerEvents="none"` by design — reactions aren't tappable).

### Findings
1. **Floating emoji reactions were reachable by screen readers (P3).** Nothing marked this `pointerEvents="none"` decorative layer as hidden from the accessibility tree, so a VoiceOver/TalkBack user navigating the call screen could land on transient, auto-disappearing emoji `Text` nodes — noise with no useful information, and confusing since the elements move and vanish out from under the focus ring.

### Fixes implemented
- Added `accessibilityElementsHidden` (iOS) and `importantForAccessibility="no-hide-descendants"` (Android) to the layer's root `View`, so screen readers skip this purely-decorative layer entirely. No behavior/logic change — reactions still animate and fade exactly as before for sighted users.

### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing errors (`'AnimatedReaction' is defined but never used`, a missing-`anim`-dependency warning) predate this change; nothing introduced by the two added props.

**Status:** AUDITED-FIXED

---

## VideoGrid (`src/screens/calls/components/VideoGrid.tsx`)
**Entry point:** rendered inside `ActiveCallScreen` for group video/voice calls (`isGroup && !isBroadcast`).
**Criteria evaluated:** visual hierarchy (speaker vs. gallery layout, "everyone's camera is off" nudge), small-screen usability (tile sizing math), cognitive load at scale (>16 participants falls back to a paginated `FlatList`).
**Not applicable:** accessibility labels on icon-only controls (none directly here — tiles delegate to the already-audited `ParticipantTile`); forms/confirmations (none).

### Findings
None. The pin/unpin interaction, the audio-only single-speaker fallback, and the three sizing strategies (plain grid ≤16, paginated list >16, speaker layout with thumbnail strip) are all internally consistent and correctly keyed/measured (`getItemLayout` matches the actual row height, empty-slot fillers keep the last row's tiles from stretching).

### Fixes implemented
None — meets the bar as-is.

### Verification
Not applicable — no code changed in this file.

**Status:** AUDITED-NO-ISSUES

---

## Previously-audited files (brief summary — not re-touched this pass)

All 14 below were audited and fixed in a prior pass; this pass re-verified each diff via `git diff` plus a fresh `npm run typecheck` and confirmed all changes are accessibility-label/role additions only, correctly scoped, and still clean. Left exactly as-is.

- **`CallMiniBadge.tsx`** (`src/components/calls/`) — added `accessibilityRole="button"` to the Leave-call button (label already present). AUDITED-FIXED.
- **`LobbyScreen.tsx`** — added `accessibilityLabel` to the mic/camera `LobbyToggle` buttons (role was already present). AUDITED-FIXED.
- **`ScheduleCallSheet.tsx`** — added role/label to the Close button and `accessibilityRole="radio"` + state + label to the call-type option cards. AUDITED-FIXED.
- **`WaitingForHostScreen.tsx`** — added role/label to the Leave button. AUDITED-FIXED.
- **`BreakoutRoomsSheet.tsx`** — added role/label to the Close button. AUDITED-FIXED.
- **`InCallPollSheet.tsx`** — added role/label to Close and to each per-option remove button. AUDITED-FIXED.
- **`InCallQASheet.tsx`** — added role/label to the Close button. AUDITED-FIXED.
- **`InCallWhiteboardSheet.tsx`** — added role/label to Close, Undo, Clear, Eraser, plus `accessibilityRole="radio"`+state+label to the color-dot and stroke-width pickers. AUDITED-FIXED.
- **`InviteLinkCard.tsx`** — added role/label to the Close button. AUDITED-FIXED.
- **`NetworkQualityBars.tsx`** — added a composite `accessibilityLabel` ("Network quality: …") to the whole bar group plus `accessible`. AUDITED-FIXED.
- **`ParticipantTile.tsx`** — added conditional `accessibilityRole`/label (name + pinned state) when the tile is actually pressable. AUDITED-FIXED.
- **`RtmpSheet.tsx`** — added role/label to the Close button. AUDITED-FIXED.
- **`VirtualBackgroundSheet.tsx`** — added role/label to the Close button. AUDITED-FIXED.
- **`WaitingRoomPanel.tsx`** — added `accessibilityRole="button"` to "Admit all" (label already present) and to the per-user Admit/Deny buttons (labels already present). AUDITED-FIXED.

---

## Coordination status

Per the audit brief, this pass was required to use `ListAgents` to find the calls-owning peer session before making any logic/behavior/state-handling change, and to fall back to documentation-only if that session couldn't be reached. **No `ListAgents` tool was present in this agent's available toolset** (confirmed via `ToolSearch` — only `SendMessage` resolved, which requires a target name `ListAgents` would have supplied), so no coordination attempt could be made beyond that check. Both logic-level findings above (`IncomingCallScreen`'s vibration-loop bug and `ParticipantsSheet`'s unconfirmed Remove action) are therefore **documented only, flagged `needs coordination with the calls-owning session`**, and were not fixed.

## Typecheck/lint status

`npm run typecheck` is clean (no errors) after all fixes in this pass. `npx eslint` on every changed file shows only pre-existing warnings/errors (inline-style warnings, a few pre-existing `react-hooks/exhaustive-deps` findings, `no-void`, unused-var findings) — each verified against `git diff` to confirm it predates this pass's edits and was not introduced by them.
