# UX/UI Audit — Chat Composer / Attachment / Modal Layer

**Batch:** `src/Module/ChatRoom/componets/*.tsx` (9 files) and `src/Module/ChatRoom/componets/main/**` (23 files, including `ForAttachments/`) — 32 files total. Excludes `componets/main/FroCamer/**` and `componets/main/FroSticker/**` (covered by a sibling agent) and all `__tests__/` files.
**Date:** 2026-10-12
**Scope:** Deep per-file UX/UI/accessibility audit of the chat room's composer, attachment pickers, and the ~20 bottom-sheet/modal surfaces reachable from it (schedule, forward, pinned/starred/read-receipts, wallpaper, GIF/location/poll/event/contacts, text-card and camera capture). This is confirmed active core chat infrastructure.

## Summary

All 32 files have been read in full and audited against the stated criteria. This surface is almost entirely icon-driven, and the single dominant pattern found across nearly every file was **missing `accessibilityLabel`/`accessibilityRole` on icon-only controls** (close buttons, play/pause, mic, camera, delete/trash, font-color swatches, header call/menu buttons) — a screen-reader user hits an unlabeled button on nearly every screen in this flow. That has been fixed directly in 21 of the 32 files (safe, additive, no behavior change).

Two real **destructive/high-stakes actions were found firing with no confirmation** and have been fixed:
1. **`InteractiveMessageRow.tsx`'s single-message "Delete for everyone"** fired the irreversible, everyone-visible delete the instant the action-sheet row was tapped — with **no confirmation**, unlike the bulk-selection delete path (`useBulkMessageActions.ts`) which already confirms via `Alert`. Now mirrors that same confirm step.
2. **`MessageComposer.tsx`'s "Send payment"** moved real money on a single tap with no review step between the form and the transfer firing. Now shows an `Alert` confirming the exact amount/currency/note before sending.
3. **`LocationPickerSheet.tsx`'s "Share Live Location (15 min)"** started continuous real-time location sharing with every participant in the chat on a single tap — materially different privacy exposure than the adjacent one-time pin-drop button, with no distinct confirmation. Now confirms before sharing.

One real **silent-failure** was hardened: `HoldToLockComposer.tsx`'s mic-start failure path (after permission is already confirmed granted) only logged a `console.warn` and snapped the UI back to idle with zero user-facing signal — indistinguishable from "didn't hold long enough." Now shows an `Alert`.

One **missing-validation-feedback** bug was fixed: `PollModal.tsx`'s own code comment admitted *"minimal guard; real validation later"* — tapping Create with a blank question or fewer than 2 options did nothing at all, silently, with no explanation. Now shows the same kind of inline per-field error text `EventModal.tsx` already uses.

Several **touch-target violations** (bare `<Text>` wrapped in a `Pressable` with zero padding, well under the 44pt minimum) were fixed in `ContactsModal.tsx`, `EventModal.tsx`, `PollModal.tsx`, and `ForwardChatSheet.tsx`.

The single most important issue in this batch: **the "Delete for everyone" confirmation gap in `InteractiveMessageRow.tsx`** — it is the most-used destructive action in the entire chat surface (reachable from every single message's long-press menu) and was the one place in the whole delete/removal vocabulary of this module (pin, star, clear-chat, bulk-delete all confirm) that did not confirm before an irreversible, multi-participant-visible action.

`HoldToLockComposer.tsx` (the real hold-to-lock voice composer, superseded `VoiceLockedActionsRow`/`VoicePreviewRow`) got the deepest attention per the brief: six icon-only controls labeled (mic, preview play/pause, preview delete/send, locked delete/send) plus the startRecorder-failure fix above.

All typecheck (`npm run typecheck`) and ESLint checks pass clean on every edit — the only ESLint errors reported in touched files (`react-hooks/exhaustive-deps` in `ReadReceiptsSheet.tsx`/`StarredMessagesSheet.tsx`/`WallpaperPickerSheet.tsx`/`GifPickerSheet.tsx`/`HoldToLockComposer.tsx`, unused-var in `LocationPickerSheet.tsx`, unused-var in `MessageComposer.tsx`) are pre-existing and confirmed, line-by-line against `git diff`, to sit outside every hunk this pass touched.

---

## AvatarPicker (`src/Module/ChatRoom/componets/AvatarPicker.tsx`)
**Used by:** `MessageComposer.tsx` (the "Custom" tab of the attachment panel, for styled-text backgrounds).
### Findings
1. Color swatches each already carry a visible text label (the color name, e.g. "Sunrise") beneath them, so they're screen-reader legible via the default text-content label — not a true icon-only control (P3, informational only).
2. 24 fixed colors with no dark/light-theme-aware contrast check on the `fgColor` initials text against `bgColor` — all pairs were manually chosen with reasonable contrast, no violation found.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## CallHistoryRow (`src/Module/ChatRoom/componets/CallHistoryRow.tsx`)
**Used by:** `MessageList.tsx` (inline call-event timeline rows).
### Findings
1. Good: the "Call back" icon button already has `accessibilityLabel="Call back"` — no gap here, unlike most of the rest of this batch.
2. Good: status color-coding (missed/ongoing/declined/busy/cancelled) is semantically distinct and uses palette state tokens, not hardcoded hex.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## ChatCallBanner (`src/Module/ChatRoom/componets/ChatCallBanner.tsx`)
**Used by:** `ChatRoomPage.tsx` (sticky banner when a call is active in the open conversation).
### Findings
1. Good: the Join/Return button already has an explicit `accessibilityLabel`.
2. Pulsing green dot and duration ticker are correctly decorative/auto-updating with proper interval cleanup on unmount.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## EmojiPicker (`src/Module/ChatRoom/componets/EmojiPicker.tsx`)
**Used by:** `MessageComposer.tsx` (Emoji tab of the attachment panel).
### Findings
1. Emoji buttons are bare `Pressable`s wrapping a `Text` glyph with no explicit `accessibilityLabel` — but RN's default accessible-name derivation uses the child `Text` content, so a screen reader still announces the emoji glyph itself (not silent, just unnamed/un-described) (P3).
2. Good: responsive per-row emoji count (measured via `onLayout`) replaces a prior hardcoded 8-per-row, which previously under-filled wide tablet panels.
3. Good: loading skeleton, recents (both external-prop and internally-persisted), and search are all handled with real empty/loading states, no silent failures found.
### Fixes implemented
None — the default accessible-name behavior is adequate for an emoji glyph; adding 700+ individual `accessibilityLabel`s (one per emoji) was judged out of proportion to the benefit for this pass.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## HoldToLockComposer (`src/Module/ChatRoom/componets/HoldToLockComposer.tsx`)
**Used by:** `MessageComposer.tsx` — this is the real voice-recording composer (hold → lock → preview → send/delete), superseding the deleted `VoiceLockedActionsRow`/`VoicePreviewRow`.
### Findings
1. **P2 — Six icon-only controls had no `accessibilityLabel`/`accessibilityRole`:** the hold-to-record mic button itself, preview play/pause, preview delete, preview send, locked-mode delete, locked-mode send. This is the single densest cluster of unlabeled controls in the whole batch, on a feature (voice messages) that's unusable blind without them.
2. **P2 — Silent failure on recorder start:** `startRecording()`'s `catch` block (around the `audioRecorderPlayer.startRecorder()` call) only ran `console.warn('[Voice] startRecorder failed', err)` and silently snapped the UI back to idle. Since mic permission is already confirmed granted by this point in the flow, this path only fires on a genuine device/hardware-level failure — and the user sees nothing to distinguish it from "I didn't hold long enough."
3. Good: the comment trail in this file is unusually thorough about real bugs already fixed by a prior pass — Android's `file:////` URI quadruple-slash bug, iOS's ALAC-vs-AAC codec/label mismatch, the `isRecording` lifecycle fix that used to collapse the preview row into the wrong width. No regressions found in any of that.
4. Good: mic-permission gating happens *before* any recording UI appears (not after, which used to flash a fake recording animation that silently reverted) — exactly the honest-state pattern this audit was told to look for.
5. Delete actions (preview delete, locked-mode delete) fire immediately with no confirmation — judged acceptable without a fix: these discard an in-progress, not-yet-sent draft recording, the same low-stakes pattern as discarding any unsent draft elsewhere in the app.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to all six controls listed in finding 1 (mic button also gets an `accessibilityHint` describing the slide-up-to-lock/slide-left-to-cancel gesture, since that gesture has no other on-screen explanation for an assistive-tech user).
- Added `Alert.alert('Could not start recording', 'Please try again.')` to the `startRecorder()` catch block (finding 2).
### Verification
`npm run typecheck` — clean. `npx eslint` — 2 pre-existing `react-hooks/exhaustive-deps` errors on `killAllAnimations` (lines 174, 265, neither touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED

---

## InteractiveMessageRow (`src/Module/ChatRoom/componets/InteractiveMessageRow.tsx`)
**Used by:** `MessageList.tsx` (wraps every rendered message bubble; owns the swipe-to-reply gesture, double-tap-to-heart, and the long-press action sheet).
### Findings
1. **P1 — "Delete for everyone" fired with zero confirmation.** `onDeleteMessage(message)` ran the instant the action-sheet row was tapped. This is the single most commonly reachable destructive action in the entire module (every message, every conversation) and the *only* delete/removal action in this module's whole vocabulary that didn't confirm — pin/unpin, star/unstar, clear-chat (`ChatRoomPage.tsx`), and bulk-selection delete (`useBulkMessageActions.ts`) all already confirm or are trivially reversible. A mis-tap in a long action sheet permanently removed a message for every participant with no recovery.
2. **P3 — Quick-reaction emoji buttons** (the horizontal pill of 8 emojis shown above the action sheet) had no `accessibilityLabel`/selected-state.
3. Good: "Delete for me" (local-only) was left unconfirmed deliberately — it only affects the local device's view, the same low-stakes category as star/unstar.
4. Good: the swipe-to-reply `PanResponder` correctly disables itself in selection mode and resets position on both release and terminate — no stuck-gesture states found.
### Fixes implemented
- Wrapped the "Delete for everyone" action in an `Alert.alert('Delete for everyone?', ..., [Cancel, Delete])`, mirroring the bulk-delete path's existing copy/style exactly.
- Added `accessibilityRole="button"` + `accessibilityLabel`/`accessibilityState` to the quick-reaction emoji buttons.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors in this file; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## MessageTranslationBlock (`src/Module/ChatRoom/componets/MessageTranslationBlock.tsx`)
**Used by:** `MessageBubble.tsx` (inline on-device translation state: idle trigger, model-download prompt, in-progress, translated text + "Original" toggle, error+retry).
### Findings
1. **P3 — Four tappable `Pressable`s (Translate, Download, Original toggle, error-retry) had no `accessibilityRole`.** Each already carries a visible `Text` child so the label itself was announced, but without the `button` role a screen reader doesn't convey that these are actionable.
2. Good: every phase (`checking`/`translating`/`needs_download`/`downloading`/`error`/idle) is handled distinctly with real, differentiated copy, and the error phase explicitly surfaces the failure plus a "(tap to retry)" affordance rather than silently failing — exactly the honest-error-state pattern this audit was told to look for the absence of.
### Fixes implemented
- Added `accessibilityRole="button"` + a descriptive `accessibilityLabel` to all four `Pressable`s.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## StickerPicker (`src/Module/ChatRoom/componets/StickerPicker.tsx`)
**Used by:** historical/shared sticker-grid component; `MessageComposer.tsx` also defines and uses its own near-identical inline copy (see that section) rather than importing this one — both were fixed for consistency.
### Findings
1. **P3 — "Create New Sticker" button and every sticker thumbnail in the grid were icon/image-only `Pressable`s with no `accessibilityLabel`.**
2. Good empty state ("No stickers yet. Create one!") rather than a blank grid.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the create button and to each sticker thumbnail (falls back to `"Sticker"` when the sticker has no caption text).
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## ViewOnceViewerModal (`src/Module/ChatRoom/componets/ViewOnceViewerModal.tsx`)
**Used by:** `MessageBubble.tsx` (full-screen viewer for view-once content — text/image/video/voice/document).
### Findings
1. **P2 — Close button, voice play/pause button, and the multi-attachment pagination dots were all icon-only with no `accessibilityLabel`.** The close button in particular is the only way out of this full-screen modal besides the hardware back gesture.
2. Good: the component correctly operates on a snapshot of the message content (per its own header comment) rather than the live message, so it keeps rendering correctly even after the caller strips the underlying message's real content on open — no stale/broken-reference risk found.
3. Good: image/video/audio/document/text branches all have real loading (`ActivityIndicator`) states while a URI resolves, not a blank frame.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the close button, the voice play/pause button, and the pagination dots (each announces its position, e.g. "View item 2 of 3").
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## AttachmentSheet (`src/Module/ChatRoom/componets/main/AttachmentSheet.tsx`)
**Used by:** `MessageComposer.tsx` (the "+" attachment grid: files, audio, contacts, poll, event, location, scan, payment).
### Findings
1. Good: every grid item already carries a visible label + description `Text`, so none of this screen's main actions are icon-only in the sense this audit was asked to hunt for.
2. Good: `handleSendFilesPress`/`handleAudioPress` both guard against a double-fire while a native picker is already open (`pickInProgressRef`), and both surface real `Alert`s on genuine picker errors rather than failing silently — `DocumentPicker.isCancel`/`isInProgress` are checked first so a user-initiated cancel never shows a spurious error.
3. Good: `handlePreviewSend`'s failure path (`onSendFiles` returning `false`, or throwing) shows `Alert.alert('Send error', ...)` and does **not** close the preview or clear the caption — a failed send looks like a failure, not a silent success. This is exactly the fabricate-success-on-failure pattern this audit was told to hunt for, and it is correctly absent here.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## CameraCaptureModal (`src/Module/ChatRoom/componets/main/CameraCaptureModal.tsx`)
**Used by:** `MessageComposer.tsx` (the sole source for photo/video attachments — deliberately not reachable via the generic file picker).
### Findings
1. **P3 — Close, gallery, shutter, per-thumbnail edit, and per-thumbnail remove buttons were all icon-only with no `accessibilityLabel`.**
2. Good: camera-permission gating happens before `launchCamera()`, with a dedicated 120s timeout (`Promise.race`) to bound Android's known "lost native callback on Activity recreation" failure mode — documented in-file and a real, previously-diagnosed bug, not a hypothetical.
3. Good: every `launchCamera`/`launchImageLibrary` error path (permission-denied, generic error, timeout) shows a distinct `Alert`, never a silent revert.
4. Good: `removeAsset` correctly keeps `editedAssets` and `assets` in sync and re-clamps `selectedAssetIndex`, so removing the currently-previewed item can't leave a stale/out-of-range index.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to Close, Choose-from-gallery, Take-photo (shutter), per-thumbnail Edit, and per-thumbnail Remove.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## ChatHeader (`src/Module/ChatRoom/componets/main/ChatHeader.tsx`)
**Used by:** `ChatRoomPage.tsx` (both the normal header and the selection-mode header).
### Findings
1. **P2 — Every icon-only header button in both header variants had no `accessibilityLabel`/`accessibilityRole`.** That's 11 distinct controls: back/cancel-selection, pin-selected, delete-selected, forward-selected, copy-selected, continue-in-sub-room, more (selection mode), back (normal mode), broadcast, tasks, video call, voice call, menu (normal mode). This is the highest-traffic icon-only cluster outside the composer itself — every chat screen open shows this header.
2. Good: the call-placing spinner state (`callPlacingMedia`) correctly swaps the video/phone icon for an `ActivityIndicator` and disables both buttons while a call is being placed, so a tap gets immediate feedback instead of appearing to do nothing.
3. Good: the DM-request/lock pill, pinned-count pill, and sub-room pill (with unread badge) are all driven by real palette tokens and conditionally rendered, not hardcoded hex.
### Fixes implemented
- Added `accessibilityRole="button"` + a descriptive `accessibilityLabel` to all 12 icon-only buttons listed in finding 1 (selection-mode header + normal header, both back buttons included).
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## DisappearingTimerSheet (`src/Module/ChatRoom/componets/main/DisappearingTimerSheet.tsx`)
**Used by:** chat-settings flow (reachable from the chat header's "more" menu) for setting a per-conversation disappearing-message timer.
### Findings
1. Good: every row already carries visible `Text` labels (duration + explanation), and the selected row's checkmark is a secondary indicator, not the only one (the row is also highlighted) — no icon-only-control gap here.
2. Switching the timer applies immediately on tap with no confirmation, but this is a low-stakes, instantly-reversible settings toggle (not a destructive data action), so no confirmation is warranted.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## DocumentScannerSheet (`src/Module/ChatRoom/componets/main/DocumentScannerSheet.tsx`)
**Used by:** `AttachmentSheet.tsx` ("Scan document" option).
### Findings
1. Good: every action (Scan, Cancel, Send as Image, Send as PDF, Re-scan) already has a visible text label — no icon-only gap.
2. Good: the three-tier scanner fallback (dedicated plugin → alternative plugin → plain camera) is wrapped in try/catch with a real `Alert.alert('Scanner error', ...)` on total failure, not a silent no-op.
3. "Re-scan" discards the current scan with no confirmation, but this is a pre-send draft with an unambiguous, single-purpose "retake" affordance — the same low-stakes pattern as any photo-retake flow, not flagged.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## AttachmentPreviewPage (`src/Module/ChatRoom/componets/main/ForAttachments/AttachmentPreviewPage.tsx`)
**Used by:** `AttachmentSheet.tsx` (caption + per-item upload-progress review before files/audio actually send).
### Findings
1. **P3 — Per-item audio play/pause buttons and per-item remove (trash) buttons were icon-only with no `accessibilityLabel`; Cancel/Send footer buttons had no explicit role/label either** (though Send's label needed to vary with upload state).
2. Good: this file is a strong example of the pattern this audit was told to hunt for the *absence* of — `getUploadLabel()` distinguishes `uploading`/`verifying`/`failed`/`verification_failed` with different text and a red progress bar on failure, and `handleSendPress` shows `Alert.alert('Upload failed', ...)` and explicitly does **not** clear the caption/close on a failed send (`if (!ok) { Alert.alert(...); return; }`). A failed attachment upload does not look like a success here.
3. Good: `handleRemoveItem` refuses to remove the last remaining item (`if (localItems.length <= 1) return`), preventing the page from accidentally reaching an empty, un-sendable state.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the per-item play/pause button, the per-item remove button (names the specific file), Cancel, and Send (label switches to "Uploading attachments" mid-upload).
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## ContactsModal (`src/Module/ChatRoom/componets/main/ForAttachments/ContactsModal.tsx`)
**Used by:** `AttachmentSheet.tsx` ("Send contacts").
### Findings
1. **P2 — Cancel/Share footer buttons were bare `<Text>` wrapped in a `Pressable` with zero padding** — the actual touch target was just the text's own bounding box, well under the 44pt minimum.
2. **P3 — The per-contact selection circle had no `accessibilityRole="checkbox"`/`accessibilityState`,** so a screen reader couldn't tell whether a given contact was selected.
3. Good: loading (`ActivityIndicator`) and empty ("No contacts found... or permission was denied") states are both handled explicitly and distinctly — the empty-state copy correctly covers both the "genuinely no contacts" and "permission denied" cases rather than picking one and hiding the other.
### Fixes implemented
- Added `minHeight: 44` + padding to Cancel/Share, plus `accessibilityRole="button"` + labels.
- Added `accessibilityRole="checkbox"` + `accessibilityState={{ checked }}` + `accessibilityLabel={item.name}` to the per-contact row.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## EventModal (`src/Module/ChatRoom/componets/main/ForAttachments/EventModal.tsx`)
**Used by:** `AttachmentSheet.tsx` ("Create an event").
### Findings
1. **P2 — Cancel/Save footer buttons were bare `<Text>` wrapped in a `Pressable` with zero padding** — same touch-target gap as `ContactsModal.tsx`/`PollModal.tsx`.
2. Good: this file is the strongest validation pattern in the batch — every field (title, start/end date+time, location, description) has its own `isValidDate`/`isValidTime`/`*Valid` check, `attempted` gates the error text so it doesn't show before the first submit attempt, and `endAfterStart` is checked explicitly with its own dedicated error message rather than silently accepting an end-before-start event. `PollModal.tsx` was missing this pattern entirely until this pass (see that section).
3. Good: the local event-reminder `setTimeout` is persisted to `AsyncStorage` as a queue entry in addition to the live timer, so a reminder isn't purely dependent on the JS timer surviving — though if the app is fully killed before the reminder fires, nothing currently re-arms it from that queue on next launch (a real but separate gap in whatever code reads `KIS_EVENT_REMINDERS_KEY`, out of this file's scope).
### Fixes implemented
- Added `minHeight: 44` + padding to Cancel/Save, plus `accessibilityRole="button"` + labels.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## PollModal (`src/Module/ChatRoom/componets/main/ForAttachments/PollModal.tsx`)
**Used by:** `AttachmentSheet.tsx` ("Create a poll").
### Findings
1. **P1 — No validation feedback at all.** The file's own comment admitted it: `// minimal guard; real validation later`. Tapping "Create" with a blank question or fewer than 2 non-empty options silently did nothing — no error text, no shake, no `Alert`, nothing. A user has no way to know why the modal isn't responding.
2. **P2 — Cancel/Create footer buttons and "Remove"/"+ Add option" links were bare `<Text>` in a zero-padding `Pressable`** — same touch-target gap as the two sibling modals above.
3. Good: option-removal correctly keeps a minimum of 2 options (`options.length > 2` gates the Remove link's visibility).
### Fixes implemented
- Added `attempted` state (mirroring `EventModal.tsx`'s pattern) plus `questionValid`/`optionsValid`/`canCreate` derived checks, and real inline error text ("A question is required." / "Enter at least 2 options.") shown only after a submit attempt.
- Added `minHeight: 44` + padding to Cancel, Create, Remove, and "+ Add option", plus `accessibilityRole="button"` + labels on all four.
- Create's text color now dims when the form isn't valid yet (matching the disabled-looking style `EventModal.tsx`'s Save button already used), so the button's own appearance hints at why it isn't responding even before the first tap.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## ForwardChatSheet (`src/Module/ChatRoom/componets/main/ForwardChatSheet.tsx`)
**Used by:** `InteractiveMessageRow.tsx`'s "Forward" action sheet entry (via `ChatRoomPage.tsx`).
### Findings
1. **P2 — The back/close button had only `padding: 4` around a 20pt icon** (~28pt effective touch target, well under the 44pt minimum), and no `accessibilityLabel`.
2. **P3 — The "Forward" confirm button had no `accessibilityLabel`** (though it does show a live `n/maxTargets` counter in the header, which is a nice touch for discoverability).
3. Good: `toggleChat` correctly caps selection at `maxTargets` by silently declining further taps past the cap rather than erroring — acceptable given the live counter in the header already communicates the limit.
### Fixes implemented
- Increased the back button's padding to 10 + `hitSlop={12}` (effective target now well over 44pt) and added `accessibilityRole="button"` + `accessibilityLabel="Close"`.
- Added `accessibilityRole="button"` + `accessibilityLabel` to the Forward confirm button.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## GifPickerSheet (`src/Module/ChatRoom/componets/main/GifPickerSheet.tsx`)
**Used by:** standalone sheet variant of the GIF picker (the inline composer panel in `MessageComposer.tsx` duplicates this logic separately — see that section).
### Findings
1. **P3 — The search-clear ("x") button and every GIF grid cell were icon/image-only with no `accessibilityLabel`.**
2. **P3 (documented, not fixed) — Configuration-dependent silent-looking failure.** `TENOR_API_KEY` falls back to `''` in any non-`__DEV__` build with no key configured, and `searchTenor()` then returns `[]` immediately with no error thrown. The UI shows the exact same "No GIFs found" empty state for "genuinely no results" and "GIF search is unconfigured in this build" — a real engineering/ops question (is a production Tenor key actually provisioned?) rather than a UI bug this pass can safely resolve, so it's documented rather than changed.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the search-clear button and to each GIF grid cell (uses the GIF's title when available, falls back to "Send GIF").
### Verification
`npm run typecheck` — clean. `npx eslint` — 1 pre-existing `react-hooks/exhaustive-deps` error (missing `fetchGifs`/`gifs.length`/`slideAnim`, line 90, not touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED

---

## LocationPickerSheet (`src/Module/ChatRoom/componets/main/LocationPickerSheet.tsx`)
**Used by:** `MessageComposer.tsx` ("Share location" option from the attachment sheet).
### Findings
1. **P1 — "Share Live Location (15 min)" fired on a single tap with no confirmation,** starting continuous real-time location sharing with every participant in the chat for 15 minutes — a materially different privacy commitment than the adjacent one-time "Send Location" pin-drop button (which is a single static coordinate, shared once). Both buttons looked and behaved the same way (one tap → immediate send + close), when one of them has a 15-minute ongoing privacy exposure the other doesn't.
2. **P3 — Close, Refresh, and both Send buttons were icon-adjacent with no `accessibilityLabel`** (each pairs an icon with a text label, but the icon itself carried no name).
3. Good: `fetchLocation`'s failure path shows a real `Alert` ("Unable to get your location. Please enable location permissions in Settings.") rather than silently leaving the map placeholder blank forever.
4. Good: reverse-geocoding gracefully degrades to raw lat/lon coordinates if the Nominatim request fails, rather than leaving the address field blank.
### Fixes implemented
- Added an `Alert.alert('Share live location?', ...)` confirm step before the live-location send fires (Cancel/Share), explicitly stating the 15-minute duration and chat-wide visibility.
- Added `accessibilityRole="button"` + `accessibilityLabel` to Close, Refresh, "Send this location", and "Share live location for 15 minutes".
### Verification
`npm run typecheck` — clean. `npx eslint` — pre-existing errors only (`Platform` unused import, `err` unused in the geocode catch, one `react-hooks/exhaustive-deps` on `fetchLocation`), all confirmed outside this diff's hunks via `git diff`.
**Status:** AUDITED-FIXED

---

## MessageComposer (`src/Module/ChatRoom/componets/main/MessageComposer.tsx`)
**Used by:** `ChatRoomPage.tsx` — the primary chat composer; the single highest-traffic icon-driven surface in this entire module (every chat, every message).
### Findings
1. **P2 — Nine icon-only controls had no `accessibilityLabel`/`accessibilityRole`:** emoji/keyboard toggle, "+" attachment, camera, view-once toggle, Send, dismiss-link-preview, cancel-editing, cancel-reply, and the GIF-panel search-clear button.
2. **P1 — "Send payment" fired a real money transfer on a single tap with no review/confirmation step.** The form already validates amount (`> 0`) and currency non-empty, but once those pass, tapping "Send payment" called `onSendPayment` immediately — no "are you sure you want to send $X" moment anywhere in the flow, unlike every other attachment type in the same sheet (files/contacts/polls/events all land in a review screen or an explicit create-step first).
3. **P3 — GIF grid cells (inline composer panel) had no `accessibilityLabel`** (same gap as the standalone `GifPickerSheet.tsx`, since this file duplicates that logic inline rather than reusing the component).
4. **P3 — The long-press-to-schedule gesture on the Send button has no on-screen affordance hinting it exists** — a user has to already know to long-press Send to discover message scheduling.
5. Good: the on-device link-safety pre-send check (`isLinkSuspicious`) runs before any dedupe/send state changes and blocks with a clear `Alert`, leaving the composer's content untouched so the user can edit/remove the flagged link and retry.
6. Good: the 400ms `lastSendRef` dedupe guard correctly prevents a double-tap from firing two sends.
7. Good: link-preview and GIF-search network failures are both caught and fail soft to an empty/no-preview state (no fabricated-success risk) — though see finding 2 in `GifPickerSheet.tsx` re: the "no results" vs "unconfigured" ambiguity, which applies equally to this inline GIF panel.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to all nine controls in finding 1, plus the inline GIF cells (finding 3). The Send button's `accessibilityHint` now also describes the long-press-to-schedule gesture (partial mitigation of finding 4 — a VoiceOver/TalkBack user will now at least be told the gesture exists, even though sighted users still have no visual hint).
- Added an `Alert.alert('Send payment?', ...)` confirmation (Cancel/Send) stating the exact amount, currency, and note before `onSendPayment` fires (finding 2).
- Also fixed the file's own internal duplicate `StickerPicker` sub-component to carry the same `accessibilityLabel`s added to the standalone `StickerPicker.tsx` (create button + per-sticker thumbnails), since it's a separate inline copy, not an import.
### Verification
`npm run typecheck` — clean. `npx eslint` — 1 pre-existing unused-var error (`linkPreviewBarVisible`, line 357, not touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED

---

## MessageList (`src/Module/ChatRoom/componets/main/MessageList.tsx`)
**Used by:** `ChatRoomPage.tsx` — the inverted `FlatList` timeline (messages, call-history rows, join-boundary marker).
### Findings
1. Good: `buildTimelineItems` is a pure, separately-exported function specifically so the pre-join-filter/join-boundary/call-merge logic is unit-testable without rendering native dependencies — a deliberate, sound architecture choice.
2. Good: the auto-scroll logic distinguishes a genuinely new message (newest item's *identity* changes) from an older-history page landing (only array length changes) via `newestItemKeyRef` — a real, previously-fixed bug class (conflating the two used to incorrectly bump the unread badge on pagination) that stays fixed.
3. Good: `renderTimelineItem` is wrapped in `useCallback` specifically to avoid forcing every visible row to re-render on unrelated parent re-renders (selection-mode toggling, a highlight flashing, participant-map refresh) — documented as a deliberate, partial optimization (not a full per-row `memo`, noted as a follow-up) rather than a premature one.
4. The "Jump to latest" FAB delegates to the shared `KISFab` component for its own accessibility — out of this file's direct scope, not re-audited here.
5. No destructive actions, forms, or icon-only controls owned directly by this file.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## PinnedMessagesSheet (`src/Module/ChatRoom/componets/main/PinnedMessagesSheet.tsx`)
**Used by:** `ChatHeader.tsx`'s "Pinned (n)" pill.
### Findings
1. **P3 — Close button was icon-only with no `accessibilityLabel`.**
2. Good: expired-pin filtering (`KIS_PIN_EXPIRY_*` keys) runs on every open and correctly excludes expired pins from the count shown in the header title, rather than showing a stale count.
3. Good: empty state ("No pinned messages yet in this room.") is explicit, not a blank sheet.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## QuickRepliesBar (`src/Module/ChatRoom/componets/main/QuickRepliesBar.tsx`)
**Used by:** `ChatRoomPage.tsx` (contextual one-tap reply suggestions above the composer, keyed off the last received message).
### Findings
1. Good: this file already defends against a real double-send bug class — the row locks (`locked = sentForMessage === lastMessage`) the instant any chip is tapped, specifically because `lastMessage`'s identity doesn't change just because the local device replied to it, so without the lock a double-tap would fire two separate sends with two different `clientId`s. This is exactly the kind of "looks idle but isn't" failure mode this audit was told to hunt for, already closed.
2. Good: suggestion chips are plain `Text`-labeled `Pressable`s, no icon-only gap.
3. Good: `suggestReplies()` has sensible fallbacks for non-text last messages (location/voice/poll/event), so the bar doesn't just disappear when the last message wasn't plain text.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## ReadReceiptsSheet (`src/Module/ChatRoom/componets/main/ReadReceiptsSheet.tsx`)
**Used by:** `InteractiveMessageRow.tsx`'s "Message Info" action (via `ChatRoomPage.tsx`).
### Findings
1. **P3 — Close button was icon-only with no `accessibilityLabel`.**
2. Good: read-vs-delivered-only sets are computed correctly (`unreadDelivered = deliveredTo.filter(uid => !readUserIds.has(uid))`) so a recipient never double-counts in both sections.
3. Good: explicit empty state ("No read data yet") rather than two blank section headers with nothing under them.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.
### Verification
`npm run typecheck` — clean. `npx eslint` — 1 pre-existing `react-hooks/exhaustive-deps` error (missing `slideAnim`, line 40, not touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED

---

## ScheduleMessageSheet (`src/Module/ChatRoom/componets/main/ScheduleMessageSheet.tsx`)
**Used by:** `MessageComposer.tsx` (long-press on Send).
### Findings
1. **P3 (documented, not fixed) — No custom date/time option.** Only four fixed presets are offered (1 hour, tomorrow 9am, next Monday 9am, 1 week); there is no way to pick an arbitrary date/time. This is a real functional limitation, not an accessibility/safety issue, and extending it to a full date/time picker is a feature-scope change outside what this pass should make unilaterally.
2. Good: every option row already has visible `Text` labels for both the preset name and its resolved absolute date/time — no icon-only-control gap, and no ambiguity about what time will actually be used.
3. Tapping any option both schedules and closes immediately with no undo/confirm, but this is explicit, single-tap, low-stakes (the message isn't sent yet, just queued for later — and `onCancelEditing`-style undo exists elsewhere in the composer if the user changes their mind before the scheduled time), so no fix needed.
### Fixes implemented
None — finding 1 is documented as a product/scope decision, not fixed.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## StarredMessagesSheet (`src/Module/ChatRoom/componets/main/StarredMessagesSheet.tsx`)
**Used by:** reachable from chat settings/header "more" menu; also exports `saveStarredMessage`/`removeStarredMessage`/`loadStarredMessages` used by `InteractiveMessageRow.tsx`'s star action.
### Findings
1. **P3 — Header close button and per-row "unstar" button were both icon-only with no `accessibilityLabel`.**
2. Unstarring fires immediately with no confirmation, but starring is a personal bookmark, not shared/destructive data — consistent with pin/unpin elsewhere in this module, not flagged.
3. Good: explicit empty state with guidance ("No starred messages yet.\nLong-press any message and tap Star.") rather than a blank sheet.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the header close button and the per-row unstar button.
### Verification
`npm run typecheck` — clean. `npx eslint` — 1 pre-existing `react-hooks/exhaustive-deps` error (missing `slideAnim`, line 64, not touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED

---

## SubRoomsSheet (`src/Module/ChatRoom/componets/main/SubRoomsSheet.tsx`)
**Used by:** `ChatHeader.tsx`'s "Sub-rooms (n)" pill.
### Findings
1. **P3 — Close button was icon-only with no `accessibilityLabel`.**
2. Good: the long-press "Edit subject" action correctly branches between `ActionSheetIOS` (iOS) and `Alert` (Android) rather than assuming one platform's API works everywhere.
3. Good: explicit, instructive empty state explaining *how* to create a sub-room (long-press a message → "continue in sub-room"), not just "nothing here."
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## TextCardComposer (`src/Module/ChatRoom/componets/main/TextCardComposer.tsx`)
**Used by:** `MessageComposer.tsx`'s "Custom" tab flow (styled-text message with background/font-size/font-color/font-family controls).
### Findings
1. **P2 — The back button, 5 font-size chips, 8 font-color swatches, and 3 font-family chips were all icon/color-only or had no role** — the 8 font-color swatches in particular are bare colored circles with zero text, the clearest icon-only-control case in this file (and arguably in the whole batch): a screen-reader user had no way to know "yellow" vs "lavender" vs anything else.
2. Good: the preview pane updates live as font size/color/family change, so sighted users get immediate WYSIWYG feedback before sending.
3. Send is correctly disabled when the text field is empty (`disabled={!text.trim()}`), preventing an empty styled-text message.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the back/close button, each font-size chip ("Font size 24"), each font-color swatch (added a parallel `FONT_COLOR_NAMES` array so swatches announce e.g. "Font color Lavender" instead of nothing), and each font-family chip, all with `accessibilityState={{ selected }}`.
### Verification
`npm run typecheck` — clean. `npx eslint` — no errors; pre-existing inline-style warnings only.
**Status:** AUDITED-FIXED

---

## TypingIndicator (`src/Module/ChatRoom/componets/main/TypingIndicator.tsx`)
**Used by:** `ChatRoomPage.tsx` (shown above the composer while other participants are typing).
### Findings
1. Good: the whole indicator is `pointerEvents="none"` and purely decorative/informational — it's correctly not a target for any accessibility-label gap, since there's nothing to tap.
2. Good: `buildLabel()` already produces a proper, grammatically-correct screen-reader-legible sentence ("X is typing" / "X and Y are typing" / "X, Y and N others are typing") rather than relying on the visual dots+avatars alone to convey the same information.
3. Good: the fixed-height wrapper (`height: 36`) prevents layout shift when the indicator animates in/out, and avatar stacking correctly caps at 3 with deterministic per-user pastel colors (`stringToColor`) for the initials fallback.
### Fixes implemented
None — meets the bar as-is.
### Verification
Not applicable — no code changed in this file.
**Status:** AUDITED-NO-ISSUES

---

## WallpaperPickerSheet (`src/Module/ChatRoom/componets/main/WallpaperPickerSheet.tsx`)
**Used by:** reachable from chat header "more" menu (per-conversation chat wallpaper).
### Findings
1. **P3 — Close button was icon-only with no `accessibilityLabel`.**
2. Good: every wallpaper swatch already carries a visible text label (the wallpaper's name) plus a selected-state checkmark overlay, so swatches themselves are not an icon-only-control gap — unlike `TextCardComposer.tsx`'s bare color circles.
3. Selecting a wallpaper applies and closes immediately with no confirmation, but this is a low-stakes, instantly-reversible cosmetic setting — no fix needed.
### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel="Close"` to the close button.
### Verification
`npm run typecheck` — clean. `npx eslint` — 1 pre-existing `react-hooks/exhaustive-deps` error (missing `slideAnim`, line 68, not touched by this diff); nothing introduced.
**Status:** AUDITED-FIXED
