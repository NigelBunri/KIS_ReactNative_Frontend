# Audit: Image/Video/Sticker Editors, Chat Hooks/Utils, AddContacts, Video Module, Chat Storage

Scope spans 36 files across six areas of confirmed-active chat infrastructure: the
FroCamer image/video editors, the FroSticker sticker editor, nine chat
hooks/utils (including the 2,746-line `useChatMessaging.ts`, documented rather
than touched), the remaining AddContacts components, the remaining `vieo`
(video player) module, and four Chat `Storage`/root-level storage files. The
single most consequential finding was in `VideoEditor.tsx`: every editing
control (trim, rotate, flip, aspect ratio, filter) was cosmetic only —
`buildEditedAsset()` was a literal `// TODO` stub that always returned the
untouched original asset, so a user who trimmed and rotated a video got back
the unedited original with zero indication anything was dropped. A close
second was in `useImageEditor.ts`/`ImageEditor.tsx`: the "Clear text" button's
fallback path (`handleClearText` was never implemented in the hook, so the
fallback *always* fired) silently invoked a full `handleReset()`, wiping
rotation/flip/scale/filter/brush strokes/mosaic blocks/crop whenever a user
meant to clear only their text overlay. Both are now fixed. Elsewhere,
`StickerEditor.tsx`'s save/pick failure paths reset UI state with no
user-facing message (fixed with `Alert.alert`), and `AddContactForm.tsx`
conflated "registration check failed" with "confirmed not registered" (fixed
by threading a `checkFailed` flag through). The hooks/utils layer
(`uploadFileToBackend.ts`, `voiceAttachment.ts`, `voicePlaybackResolver.ts`,
`attachmentDownload.ts`, `useConversationBootstrap.ts`,
`useBulkMessageActions.ts`, `useMessageTranslation.ts`) was uniformly
excellent — typed errors, consistent `Alert.alert` surfacing, destructive-action
confirmations, documented invariants — and needed no fixes. `useChatMessaging.ts`
was surveyed at a high level per the conservative-on-logic-heavy-hooks
instruction and is documented only. All edits pass `tsc --noEmit` clean; `eslint`
shows zero new errors (only pre-existing inline-style/shadow warnings
unrelated to these changes).

---

## EditorCanvas (`src/Module/ChatRoom/componets/main/FroCamer/EditorCanvas.tsx`)
**Used by:** `ImageEditor.tsx`

### Findings
1. Purely presentational canvas (image + SVG overlay for brush/mosaic/text/crop guide). No data fetching, no error paths to surface. P3: no `accessibilityLabel`/role on the touch overlay, but it's a full-bleed gesture surface, not a discrete control, so this is low value to add.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made; file unaffected by other edits in this batch.

**Status:** AUDITED-NO-ISSUES

---

## ImageEditor.styles (`src/Module/ChatRoom/componets/main/FroCamer/ImageEditor.styles.ts`)
**Used by:** `ImageEditor.tsx`, `EditorCanvas.tsx`

### Findings
1. Pure `StyleSheet.create` definitions. No logic, no issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
N/A.

**Status:** AUDITED-NO-ISSUES

---

## ImageEditor (`src/Module/ChatRoom/componets/main/FroCamer/ImageEditor.tsx`)
**Used by:** `MediaEditModal.tsx` (image branch)

### Findings
1. **P1 — "Clear text" silently reset the entire edit session.** The component calls `editor.handleClearText` with a fallback to `handleReset()` if the hook doesn't implement it. `useImageEditor.ts` never implemented `handleClearText`, so the fallback *always* ran — tapping "Clear text" (meant to clear only text overlays) actually reset rotation, flip, scale, filter, brush strokes, mosaic blocks, and crop with no warning. Fixed at the hook level (see `useImageEditor.ts` below); this file's existing optional-chaining logic now picks up the real implementation automatically, no changes needed here beyond item 2.
2. **P2 — color swatches (text color picker) had no accessibility label.** Four `Pressable` color dots carried only a `backgroundColor`, nothing a screen reader could announce. Fixed: added `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState={{selected}}`.
3. **P3 — unsupported-type fallback in the sibling `MediaEditModal` returns `null` with no message** (see that file) — noted here because this component is one of the two branches affected.
4. All icon+label toolbar buttons (Brush, Blur/Hide, Rot L/R, Text, Flip H/V, Zoom+, Clear pen, Filter, Crop, Remove BG) already pair an icon with a visible text label, so screen readers get usable names — no fix needed there.

### Fixes implemented
- Added `accessibilityRole`/`accessibilityLabel`/`accessibilityState` to the four text-color swatch buttons.
- (No direct code change needed for item 1 — fixed upstream in `useImageEditor.ts` / `ImageEditor.types.ts`.)

### Verification
`tsc --noEmit` clean. `eslint` on this file: 0 errors (pre-existing inline-style warnings only, unrelated to this change).

**Status:** AUDITED-FIXED

---

## ImageEditor.types (`src/Module/ChatRoom/componets/main/FroCamer/ImageEditor.types.ts`)
**Used by:** `ImageEditor.tsx`, `useImageEditor.ts`, `EditorCanvas.tsx`

### Findings
1. `UseImageEditorReturn` didn't declare `handleClearText`, matching the hook's omission — the type system had no way to catch that the "clear text only" path was dead code. Fixed by adding it as a required member so the hook and its consumer stay in sync going forward.

### Fixes implemented
- Added `handleClearText: () => void;` to `UseImageEditorReturn`.

### Verification
`tsc --noEmit` clean (confirms `useImageEditor.ts` now satisfies the updated interface).

**Status:** AUDITED-FIXED

---

## MediaEditModal (`src/Module/ChatRoom/componets/main/FroCamer/MediaEditModal.tsx`)
**Used by:** camera-capture / attachment-compose flow (routes to `ImageEditor` or `VideoEditor` by MIME type)

### Findings
1. **P3 — silent `null` for unsupported asset types.** If `current.type` is neither `image/*` nor `video/*` (e.g. a picker asset with a missing/odd MIME type), the component renders nothing and the modal appears to just not open, with no message to the user. Low likelihood in practice (all picker assets are expected to carry `image/*` or `video/*`), but if it happens the user gets no explanation.
2. The `handleDoneSingle`/`handleGoPrev`/`handleGoNext` state handling correctly avoids calling `onDoneAll` inside a setState updater (explicitly commented), avoiding a React warning/misbehavior class of bug.

### Fixes implemented
none — the fallback path is a genuine edge case (not reachable through normal picker flows) and risk/reward of adding new user-facing messaging here didn't clear the bar for this pass; flagged for future attention if unsupported-type reports surface.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## VideoEditor (`src/Module/ChatRoom/componets/main/FroCamer/VideoEditor.tsx`)
**Used by:** `MediaEditModal.tsx` (video branch)

### Findings
1. **P0 — every editing control was cosmetic; saved video was always the untouched original.** `buildEditedAsset()` was a literal `// TODO: really export trimmed/filtered video via ffmpeg` stub that unconditionally `return asset;` — the original, unmodified file. The toolbar lets a user trim in/out, rotate 90°, flip horizontally, pick an aspect ratio, and toggle a "cinema" filter, all of which visibly change the in-editor preview, but tapping "Save & Next" discarded every one of those changes with **zero indication** to the user. This is exactly the "fabricate success on failure" pattern this audit was told to hunt for — the UI implies the edit was applied by showing a live, edited preview, then silently reverts to the original on save.
2. No accessibility labels on any of the icon+text toolbar buttons, but all carry visible text labels (Play/Pause, Sound/Muted, 0.5×/1×/1.5×, Set in/Set out, Rotate, Flip, Fit/1:1/4:3/16:9) so this is not a real gap.

### Fixes implemented
- Added a `hasUnappliedEdits()` check (true if trim/rotate/flip/aspect/filter differ from their defaults) and wired it into `handleSaveAndDone`: when the user has touched any of those controls, an `Alert.alert` now explains "Trimming, rotation, flip, aspect ratio, and filters are preview-only right now — the original video will be sent as-is," with Cancel / "Send original" options, before the asset is handed back to `MediaEditModal`. This does not implement real video export (out of scope — needs ffmpeg or a server-side transcode pass, a substantial feature, not a UX fix) but converts a silent, misleading success into an honest, actionable disclosure.
- The underlying `buildEditedAsset()` TODO is unchanged and still returns the original asset; the fix is purely about not misleading the user about what happened.

### Verification
`tsc --noEmit` clean. `eslint` on this file: 0 errors (0 warnings — file has no inline-style usage).

**Status:** AUDITED-FIXED

---

## useImageEditor (`src/Module/ChatRoom/componets/main/FroCamer/useImageEditor.ts`)
**Used by:** `ImageEditor.tsx`

### Findings
1. **P1 — missing `handleClearText` (see ImageEditor.tsx finding #1).** The hook never exported a `handleClearText`, so the consumer's "preferred: clear only text" branch was dead code and the destructive full-reset fallback ran every time.
2. **P2 — `buildEditedAsset()` silently swallowed capture failures.** On a `ViewShot.capture()` throw (e.g. native capture failure), the catch block only did `console.warn` and returned the original, unedited asset — the same "fabricate success on failure" pattern as VideoEditor: the caller (`ImageEditor.tsx`) calls `onSaveAsset`/`onDoneAll` with that original asset exactly as if the save had succeeded, and the user never learns their brush strokes/mosaic/text/crop were lost.

### Fixes implemented
- Added `handleClearText()` — clears only `textTags` and `activeTextId`, leaving rotation/flip/scale/filter/brush/mosaic/crop untouched — and exported it from the hook's return value and its type.
- Added an `Alert.alert('Could not save edits', 'Your edits could not be applied. The original photo will be used instead.')` in `buildEditedAsset`'s catch block, so a capture failure is now disclosed instead of silently handing back the unedited original.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors, 0 warnings on this file.

**Status:** AUDITED-FIXED

---

## StickerBackgroundRemovalScreen (`src/Module/ChatRoom/componets/main/FroSticker/StickerBackgroundRemovalScreen.tsx`)
**Used by:** `ImageEditor.tsx` ("Remove BG" tool) and `StickerEditor.tsx` ("Remove BG" action)

### Findings
1. This file is an exemplar of the right pattern: every async failure path (job-start failure, missing job ID, poll failure, DONE-but-no-url, download failure, FAILED status) sets both `errorMessage`/`jobStatus` state *and* fires `Alert.alert` with a specific, actionable message. Nothing here fabricates success on failure.
2. **P3 — back/close icon button had no accessibility label.** Fixed.
3. **P3 — no confirmation on "Use original image"** when a background-removal result already exists (`hasResult === true`) — tapping it discards the just-computed BG-removed preview in favor of the original with no "are you sure." Low severity: this is a same-session, non-destructive-to-persisted-data choice (nothing was saved yet), and re-running "Remove background" is cheap, so a confirmation dialog would mostly be friction.

### Fixes implemented
- Added `accessibilityRole="button"` and `accessibilityLabel="Close background removal"` to the header back button.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file (pre-existing warnings unrelated).

**Status:** AUDITED-FIXED

---

## StickerEditor (`src/Module/ChatRoom/componets/main/FroSticker/StickerEditor.tsx`)
**Used by:** chat composer's sticker-creation entry point

### Findings
1. **P2 — `handlePickImage` failures were silent.** Three failure branches (`result.assets?.[0]` missing, no usable `uri`, and the outer `catch`) only did `console.warn`; the user saw nothing happen when picking an image failed.
2. **P2 — `handleSave` failure paths reset to idle with no message.** Four early-return branches (`viewShotRef.current` missing, `capture` not a function, `captureUri` falsy, and the outer `catch`) all just flipped `setSaving(false)` and returned — the "Save" button would simply stop showing "Saving…" with zero explanation, indistinguishable from the user's own hesitation to tap it again.
3. **P2 — `persistStickerLocally` failures are invisible but don't block the "success" flow.** If writing the sticker library to `AsyncStorage` throws, the function catches and logs only; `handleSave` continues on to call `onSaveSticker(sticker)` and `onClose()` regardless, so the sticker is used immediately in the current send but silently never makes it into the device's persistent sticker library. Not fixed — the current send path genuinely doesn't depend on this persistence, and surfacing a "your sticker library wasn't updated" dialog on an otherwise-successful save would be confusing out of context; flagged for awareness only.
4. **P3 — back/close icon button and the 12 text-color swatches had no accessibility labels.** Fixed.
5. Good: `canSave` gating, `saving` state disabling the Save button, and the sticker-pack install/uninstall flow are all solid; "Remove" on an installed pack has no confirmation but uninstalling a sticker pack is a low-stakes preference change, not data loss.

### Fixes implemented
- `handlePickImage`: added `Alert.alert('Could not use this image', ...)` for the missing-uri branch, and `Alert.alert('Could not open photos', ...)` in the catch block.
- `handleSave`: added `Alert.alert('Could not save sticker', 'Please try again.')` to all three early-return failure branches and the outer catch block.
- Added `accessibilityRole`/`accessibilityLabel` to the header close button and `accessibilityRole`/`accessibilityLabel`/`accessibilityState` to the 12 text-color swatch buttons.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors, 91 warnings total across this file and others in the batch — all pre-existing `react-native/no-inline-styles` warnings plus one pre-existing `@typescript-eslint/no-shadow` warning on an unrelated local variable (`bgRemoved` at line ~597), none introduced by this change.

**Status:** AUDITED-FIXED

---

## StickerPackStore (`src/Module/ChatRoom/componets/main/FroSticker/StickerPackStore.ts`)
**Used by:** `StickerEditor.tsx` (pack browse/install/uninstall)

### Findings
1. Pure logic/storage module, no UI. `fetchRemotePacks()` falls back to `loadCachedPacks()` on any error — reasonable degraded-but-honest behavior (shows what's cached rather than nothing, and the caller already renders an explicit "No sticker packs available" empty state when both are empty). `installPack`/`uninstallPack` don't surface their own failures to the caller (no return value, no throw caught anywhere upstream), but `StickerEditor.tsx`'s `onPress` handler updates local `installedPackIds` state optimistically regardless of whether the `AsyncStorage` write actually succeeded — if it fails, the UI will show a pack as installed/removed that isn't actually persisted. Minor (P3): would only surface as the pack reverting to its prior state on next app launch, not an immediate visible bug.

### Fixes implemented
none — the risk of changing this shared install/uninstall contract (it has no error channel today) for a low-probability `AsyncStorage` write failure didn't clear the bar for a "low risk" fix in this pass.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## useBulkMessageActions (`src/Module/ChatRoom/hooks/useBulkMessageActions.ts`)
**Used by:** `ChatRoomPage.tsx` / selection-mode action bar

### Findings
1. Destructive actions are handled correctly: `handleDeleteSelected` and `handleDeleteForEveryone` both gate on an `Alert.alert` confirmation (Cancel/Delete) before calling through to `softDeleteMessage`/`onDeleteForEveryone`. This is the right pattern and matches what the audit was told to look for.
2. `handleMoreSelected`'s "Report" action correctly surfaces both success and failure via `Alert.alert('Reported' | 'Report failed', ...)` based on the awaited `onReportMessage` result — no fabricated success.
3. Unwired callbacks (`onContinueInSubRoom`, `onEditMessage`) degrade to an informative `Alert.alert` explaining the feature isn't wired yet, rather than doing nothing silently — good pattern for in-progress features.
4. No accessibility concerns — this is a pure logic hook with no rendered UI of its own.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## useChatAuth (`src/Module/ChatRoom/hooks/useChatAuth.ts`)
**Used by:** `ChatRoomPage.tsx` (auth/token/user bootstrap)

### Findings
1. **P3 — bootstrap failure is console-only.** If `getAccessToken`/`getCache`/`getUserData` throw, the catch block only does `console.warn('[ChatRoomPage] Failed to load auth cache', err)`; the hook returns whatever partial state it had (likely `authToken: null`). There's no explicit error channel back to the caller. In practice this is low severity: a missing/null `authToken` is itself a visible signal that downstream code (message sending, uploads) already checks and surfaces its own "not signed in" errors against (see `useConversationBootstrap.ts`'s `Alert.alert('Not signed in', ...)` and `uploadFileToBackend.ts`'s "Authentication token missing" error) — so a bootstrap failure here doesn't get silently swallowed end-to-end, it surfaces one hop downstream instead.

### Fixes implemented
none — the downstream consumers already convert a failed/empty bootstrap into a user-visible error; adding a redundant error channel here risked double-messaging without a clear benefit.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## useChatMessaging (`src/Module/ChatRoom/hooks/useChatMessaging.ts`, 2,746 lines)
**Used by:** `ChatRoomPage.tsx` — the core send/receive/receipt/retry engine for the whole chat room

### Findings
Per the task's explicit guidance to be conservative here (already-hardened core
infra, part of the "4 root-cause chat structural fixes" closed earlier this
program), this file was surveyed rather than deep-audited line by line:
1. The file maintains an explicit `MessageStatus` lifecycle (`pending` → `sent`/`failed` → `delivered`/`read`) with a dedicated retry queue (`attemptFlushQueue`, triggered on reconnect and periodically) that re-attempts anything still `pending` or `failed` — this is the correct architecture for "does a failure get surfaced to the UI," since a message's `status` field is what `MessageBubble`/`ChatRoomPage` render as the retry/failed indicator. Send failures are not silently dropped; they're tracked as state the UI already renders.
2. Socket event handlers (`chat.message`, `chat.message_receipt`, gap-fill, edit/delete echoes) consistently wrap their bodies in try/catch with `console.warn` on failure, without `Alert.alert` — appropriate for background socket-event processing, since surfacing an intrusive alert for every transient receipt-update hiccup would be worse than logging and letting the next event/reconnect reconcile state.
3. Encrypt/decrypt failure paths (`decryptFailedAtRef`, `encryptErr`/`repairErr` catches around lines 1848/1872) exist specifically to cope with session desync, consistent with this being the hardened area referenced by the program's past "E2EE decrypt fallback bug" fix (see `decryptedMessageStorage.ts` below, which documents that exact incident).
4. Given the size and the number of interacting subsystems (socket lifecycle, encryption, pagination/gap-fill, receipts, queueing, drafts-adjacent state), a confident line-level correctness audit was out of scope for this pass; nothing found during the survey contradicts the "well-engineered" characterization, and no changes were made.

### Fixes implemented
documented only — too close to recently-hardened logic (`useChatMessaging.ts`) to risk blind, per the task's explicit instruction for this file.

### Verification
No changes made; `tsc --noEmit` confirms the file is unaffected by edits elsewhere in this batch.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## useConversationBootstrap (`src/Module/ChatRoom/hooks/useConversationBootstrap.ts`)
**Used by:** `ChatRoomPage.tsx` (resolves/creates the backend conversation id for a chat)

### Findings
1. Excellent error surfacing throughout `ensureConversationId`: missing token → `Alert.alert('Not signed in', ...)`; no peer/phone to start a DM → `Alert.alert('Cannot start chat', ...)`; non-2xx backend response → `Alert.alert('Error', getRequestErrorMessage(res))` (which itself recursively unwraps DRF-style nested error payloads to find a human string); missing `id` in a 2xx response → `Alert.alert('Error', 'Conversation created but id is missing.')`; network/throw → `Alert.alert('Network error', ...)`. No path returns `null` without having told the user why.
2. No UI of its own; no accessibility concerns.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## useDraftState (`src/Module/ChatRoom/hooks/useDraftState.ts`)
**Used by:** `ChatRoomPage.tsx` composer (per-conversation draft persistence)

### Findings
1. `AsyncStorage` read/write/remove calls all use `.catch(() => {})` with no user-facing surfacing. This is appropriate here, not a gap: the in-memory `draft` state (what the composer actually renders) is updated synchronously regardless of whether the debounced disk-persist succeeds, so a persistence failure only risks losing the draft on app relaunch — a low-stakes, silent-degradation case where an `Alert` would be pure noise for something the user isn't actively watching.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## useMessageTranslation (`src/Module/ChatRoom/hooks/useMessageTranslation.ts`)
**Used by:** `InteractiveMessageRow`/`MessageBubble`'s on-demand "Translate" action

### Findings
1. Exemplary explicit state machine (`TranslationPhase`: idle/checking/needs_download/downloading/translating/error) with a distinct `errorMessage` surfaced for every failure branch (unsupported device, detection failure, same-language, unsupported model pair, download failure, generic catch). A `requestIdRef` guard correctly discards stale async responses after row-recycling or a language change — a real correctness detail for FlatList row reuse.
2. Nothing silently swallowed; every `catch` sets `phase: 'error'` with a specific message the caller renders.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## useSelectionState (`src/Module/ChatRoom/hooks/useSelectionState.ts`)
**Used by:** `ChatRoomPage.tsx` (multi-select mode for messages)

### Findings
1. Pure, synchronous state hook — no async, no failure paths to surface. Logic is straightforward (toggle/select-all/deselect-all/exit) and correctly auto-exits selection mode when the last item is deselected.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## uploadFileToBackend (`src/Module/ChatRoom/uploadFileToBackend.ts`)
**Used by:** `ChatRoomHandlers.tsx` and every other attachment-upload call site (chat images/videos/documents/voice via the shared signed-URL and multipart-proxy paths)

### Findings
1. This file is a model of the error-surfacing pattern the rest of the app should follow: a typed `VerificationFailedError` for on-device/server content-safety blocks, specific thrown `Error` messages for every failure mode (file vanished locally, size over limit, auth token missing, network error, timeout, server rejection with parsed backend error text via `safeErrorMessage`), and an `onStatus` callback (`'verifying' | 'uploading' | 'done' | 'failed' | 'verification_failed'`) that calling UI already wires into visible per-attachment state.
2. Re-verifies local file existence twice (once before the token round-trip, again right before the native read) specifically to convert a cryptic native crash into a clean, catchable, user-facing error — a thoughtful defensive detail documented in the code's own comments.
3. Auth-refresh-then-retry-once logic (`isAuthUploadError` + `refreshAccessToken`) is applied uniformly to both the signed-URL and multipart-proxy paths via a shared `authedJsonPost`/`uploadOnce` pattern — no duplicated, drifting retry logic.
4. Media-safety gating (`isMediaSafetyBlocked`/`isMediaSafetyPendingReview`) correctly treats `'not_configured'` as "never block" per its own comment, avoiding a false-positive block when a server's AI scan is simply disabled.

### Fixes implemented
none — meets the bar as-is; this is the reference implementation other files in this batch were measured against.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## voiceAttachment (`src/Module/ChatRoom/voiceAttachment.ts`)
**Used by:** `ChatRoomHandlers.tsx`'s `handleSendVoice` (builder) and `MessageBubble.tsx` (resolver/readiness classifier)

### Findings
1. Pure logic module, explicitly built (per its own header comment) to prevent the exact class of bug this program has repeatedly found elsewhere: field-name drift between what the sender writes and what the receiver reads (`voice.uri` vs `voice.url`). `resolveEmbeddedVoicePlaybackUri` returns `null` (not `''`) when nothing usable is found, specifically so callers can distinguish "still resolving" from "genuinely unavailable" — a correctness detail that prevents a premature "can't play this" error for a voice note still mid-send.
2. `classifyVoicePlaybackReadiness` correctly treats `'local_only'`/`'pending'`/`'sending'` message statuses as `'resolving'` rather than `'unavailable'`, avoiding a false failure state during normal send latency.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## voicePlaybackResolver (`src/Module/ChatRoom/voicePlaybackResolver.ts`)
**Used by:** `MessageBubble.tsx` (resolves/refreshes a voice note's signed playback URL)

### Findings
1. Typed `VoicePlaybackError` with a `kind` discriminant (`unauthorized`/`forbidden`/`not_found`/`network`/`unavailable`) mapped from HTTP status codes, plus `describeVoicePlaybackError()` converting each kind into a specific, actionable user-facing string ("Your session expired. Please sign in again." vs. a generic fallback). No swallowed failures.
2. In-flight request de-duplication (`inFlight` map) and a cache with an `EXPIRY_SAFETY_MARGIN_MS` buffer prevent both duplicate network calls from racing `MessageBubble` instances and starting playback on a URL that's about to expire mid-play — solid correctness engineering, not just error-message polish.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## addContactsStyles (`src/Module/AddContacts/addContactsStyles.ts`)
**Used by:** `AddContactsPage.tsx`, `AddContactForm.tsx`, `ContactRow.tsx`, `EntryActionRow.tsx`, `NewGroupForm.tsx`, `NewCommunityForm.tsx`, `NewChannelForm.tsx`

### Findings
1. Pure `StyleSheet.create` definitions. No logic, no issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
N/A.

**Status:** AUDITED-NO-ISSUES

---

## AddContactForm (`src/Module/AddContacts/components/AddContactForm.tsx`)
**Used by:** `AddContactsPage.tsx`'s "New contact" entry

### Findings
1. **P2 — a failed registration check was reported to the user as a confirmed "not registered."** `checkContactRegistration`'s `catch` block and its non-`res.success` branch both returned `{ registered: false }` with no distinction from a genuine, successful "this phone isn't on KIS" lookup. `handleSave`'s success `Alert.alert` then told the user "They are not yet registered on KIS" even when the check itself had failed (network error, server error) — a misleading claim about a third party's account status caused by swallowing a different failure.
2. Good: inline field validation (`error` state rendered near the form, not just an alert) for empty name/phone; `canSave`/`submitting` properly gate the Save button; `saveContactToDevice`'s own failure correctly re-throws so `handleSave`'s outer catch sets a visible `error` state ("Could not save contact.") instead of proceeding as if the contact had saved.
3. No accessibility gaps — all interactive elements (country picker, label-cycle pill, Save button) carry visible text.

### Fixes implemented
- Added a `checkFailed?: boolean` field to `RegistrationResult`, set it `true` in both the non-success and catch branches of `checkContactRegistration`, and added a third `Alert.alert` branch in `handleSave` for `registration.checkFailed` ("We could not check their KIS status right now — try again later") so a check failure is no longer reported as a confirmed non-registration.

### Verification
`tsc --noEmit` clean. `eslint`: 0 errors on this file.

**Status:** AUDITED-FIXED

---

## ContactRow (`src/Module/AddContacts/components/ContactRow.tsx`)
**Used by:** `AddContactsPage.tsx`'s contact list

### Findings
1. Simple, correct presentational row. Initials fallback (`{initials || '?'}`) correctly handles an empty/whitespace `contact.name`. No destructive actions, no async, no issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## EntryActionRow (`src/Module/AddContacts/components/EntryActionRow.tsx`)
**Used by:** `AddContactsPage.tsx`'s "New group / New channel / New community" entry rows

### Findings
1. Simple, correct presentational row with icon + title + subtitle, all with visible text (icon is decorative, not the only label). No issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## contactsService (`src/Module/AddContacts/contactsService.ts`)
**Used by:** `AddContactsPage.tsx` (device contacts sync / registration lookup)

### Findings
1. **P2 — network/lookup failures are indistinguishable from "confirmed not registered on KIS."** Both `markRegisteredBulk`'s `processChunk` catch and `markRegisteredSequential`'s per-contact catch default to `isRegistered: false` on any thrown error, exactly the same conflation flagged and fixed in `AddContactForm.tsx` above — except here it feeds the main contacts list's "INVITE" pill (`ContactRow`'s `showInvite`), so a transient network blip during sync could cause an already-registered contact to briefly show an incorrect "INVITE" prompt. Not fixed in this pass: the result type (`KISContact`) and its `isRegistered: boolean` field are consumed across the whole AddContacts list/row rendering path, the bulk/sequential/cache/TTL logic is intricate (chunking, concurrency, rate-limit/not-found cooldowns), and introducing a tri-state (`registered | not_registered | unknown`) here is a real behavior change with broader blast radius than the safety bar for this pass — flagged for a dedicated follow-up rather than a blind fix.
2. `getDeviceContactsFromDevice` and `saveContactToDevice` correctly propagate/log permission and native-contacts-API failures; `requestContactsPermission`'s three-way Android result (`granted`/`never_ask_again`/`denied`) is handled distinctly, which matters for whether the caller can re-prompt or must send the user to Settings.
3. Rate-limit (429) and not-found (404) cooldowns in the sequential fallback are a thoughtful, self-protecting detail — avoids hammering a struggling/misconfigured endpoint.

### Fixes implemented
none this pass — documented as a cross-cutting finding needing a wider, deliberate fix (tri-state registration result) rather than a local patch.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## KISVideo (`src/Module/vieo/KISVideo.tsx`)
**Used by:** general-purpose video embed wrapper around `VideoPlayer`

### Findings
1. Thin wrapper (sets `showControls` always on, defaults `muted`/`loop`). No logic of its own to audit; delegates entirely to `VideoPlayer` (out of this audit's scope — "remaining vieo" explicitly excludes `VideoPlayer.tsx`/`VideoControls.tsx`, audited elsewhere).

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## VideoProgressBar (`src/Module/vieo/components/VideoProgressBar.tsx`)
**Used by:** full-screen vertical video viewers (Shorts/Broadcast detail screens) that need just a scrubber, not `VideoControls`' full panel

### Findings
1. Small, correct component. Clamps `progress` into `[0, duration]` defensively before handing to the native `Slider`. No error states to surface (pure UI binding over hook-provided state/actions). `@react-native-community/slider` provides default accessibility behavior for sliders out of the box.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## useVideoPlayer (`src/Module/vieo/hooks/useVideoPlayer.ts`)
**Used by:** `VideoPlayer.tsx`, `VideoProgressBar.tsx`, `VideoControls.tsx` (all out of this audit's direct scope, but this hook is in-scope)

### Findings
1. `onError` correctly extracts a renderable message from the native error payload (string, `localizedDescription`/`localizedFailureReason`/`localizedRecoverySuggestion`/`message`/`error`, or a JSON stringify fallback) into `state.error`, which is the right shape for a consumer to render an error UI — failures are not swallowed.
2. **P3 — verbose, ungated logging.** Nearly every action and handler (`togglePlay`, `play`, `pause`, `seekTo`, `seekForward10`, `seekBackward10`, `setMuted`, `onLoad`, `onProgress`, `onBuffer`) calls `console.log`/`console.debug` unconditionally (not gated behind `__DEV__`), including on every single playback progress tick. This is a production logging-hygiene issue (console noise, minor perf overhead from the string formatting on every tick) rather than a UX bug — not fixed in this pass since it touches many call sites in a hook feeding three downstream components outside this audit's scope, and the risk of a search-and-gate pass introducing a typo across that many lines wasn't worth it for a non-user-facing issue.

### Fixes implemented
none — item 2 documented as a cleanup opportunity, not a user-facing defect.

### Verification
No changes made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## vieo index (`src/Module/vieo/index.ts`)
**Used by:** external modules importing `VideoPlayer`/`VideoControls`/`KISVideo`/`useVideoPlayer`/`normalizeVideoUrl`

### Findings
1. Pure re-export barrel file. No logic, no issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
N/A.

**Status:** AUDITED-NO-ISSUES

---

## urlRedaction (`src/Module/vieo/urlRedaction.ts`)
**Used by:** `VideoPlayer.tsx` (log-line scrubbing)

### Findings
1. Single-purpose, correct, well-documented pure function — strips everything from `?` onward before a video URL hits a log line, specifically to avoid leaking signed-URL signatures/tokens into logs. No issues.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## vieo utils (`src/Module/vieo/utils.ts`)
**Used by:** `VideoPlayer.tsx`, `VideoControls.tsx`, `index.ts` (`normalizeVideoUrl` re-export)

### Findings
1. `normalizeVideoUrl` correctly allowlists only `http:`/`https:` schemes and returns `null` (not a throw, not a passthrough of a malformed/dangerous value) for anything else — a sound defensive default for a value that ultimately feeds a native video player. `formatVideoTime` correctly guards `NaN`/negative input.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## chatMediaMigration (`src/Module/ChatRoom/Storage/chatMediaMigration.ts`)
**Used by:** `App.tsx` startup (one-time migration of stray chat media files)

### Findings
1. Per the task's instruction, not re-investigated — only verified it's still correctly wired. Confirmed via `grep` in `App.tsx`: `import { runChatMediaMigrationIfNeeded } from '@/Module/ChatRoom/Storage/chatMediaMigration';` (line 49) and `void runChatMediaMigrationIfNeeded();` (line 672) are both present and intact.

### Fixes implemented
none — verification only, per task instructions.

### Verification
Confirmed via `grep -n "runChatMediaMigrationIfNeeded" App.tsx` — both the import and the call site are present.

**Status:** AUDITED-NO-ISSUES

---

## decryptedMessageStorage (`src/Module/ChatRoom/Storage/decryptedMessageStorage.ts`)
**Used by:** `useChatMessaging.ts` (caches decrypted message content keyed by user+message id, so a re-render/relaunch doesn't need to re-decrypt)

### Findings
1. This file's own header comment documents a previously-shipped fix matching this program's memory of the "E2EE decrypt fallback bug" (images/videos showing "could not be decrypted" due to a Keychain size-limit throw) — `saveDecryptedMessage` deliberately swallows a storage-write failure (`EncryptedStorage.setItem` can exceed native Keychain/EncryptedSharedPreferences per-item size limits on image/video-heavy payloads) specifically so a caching failure can never be misreported as a decrypt failure to the caller. This is the correct, already-fixed behavior — re-confirmed present and intact.
2. `loadDecryptedMessage` tries every known message identity (`serverId`, `id`, `clientId`, `messageId`) and silently moves to the next on a per-id read failure, returning `null` only if none work — reasonable, since a cache miss correctly falls through to re-decryption elsewhere rather than being treated as an error.

### Fixes implemented
none — meets the bar as-is; this file is explicitly the subject of a prior hardening pass and was reviewed only to confirm it remains correct.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## attachmentDownload (`src/Module/ChatRoom/attachmentDownload.ts`)
**Used by:** `MessageBubble.tsx`/attachment-viewer flows (resolves a short-lived download URL from a stable attachment id)

### Findings
1. Typed `AttachmentDownloadError` with a `kind` discriminant mapped from HTTP status (`unauthorized`/`forbidden`/`not_found`/`expired`/`bad_request`/`network`/`unknown`), letting callers render the right UI per failure mode (e.g. "expired"/view-once-consumed vs. "forbidden"/removed-from-conversation) rather than a single generic error. 401 triggers one token-refresh-and-retry, mirroring `uploadFileToBackend.ts`'s pattern.
2. No silent success-on-failure anywhere; every non-2xx and every malformed-response case throws a typed error with a specific message.

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## chatMediaStorage (`src/Module/ChatRoom/chatMediaStorage.ts`)
**Used by:** `uploadFileToBackend.ts`, `attachmentDownload.ts`-adjacent flows, and anywhere chat media is copied to/read from on-device storage

### Findings
1. `copyUriToChatMedia` is deliberately defensive against a real, previously-painful failure mode (noted in its own comment): it re-checks the destination file actually exists after `RNFS.copyFile` resolves, because a source file disappearing mid-copy (large videos) can let `copyFile` resolve successfully without the destination existing — returning `null` in that case converts what would otherwise be a cryptic native "no such file" crash at the upload layer into a clean, checkable failure the caller can act on.
2. `resolveChatMediaPath`'s legacy-directory fallback (handling the brief period code wrote to `KIS/Media/Chat/*` instead of the canonical `KIS/ChatMedia/*`) is a sound, narrowly-scoped migration shim, not dead code — falls back to the original (possibly-dead) path only if nothing is found anywhere, letting the caller's own CDN fallback handle the final failure case.
3. All failure paths (`mkdir`, `exists`, `copyFile`) are caught and degrade to `null`/no-op rather than throwing uncaught — appropriate for a storage utility whose callers (`uploadFileToBackend.ts`) already have their own typed error handling for "file no longer available on your device."

### Fixes implemented
none — meets the bar as-is.

### Verification
No changes made.

**Status:** AUDITED-NO-ISSUES

---

## chatRoomStyles (`src/Module/ChatRoom/chatRoomStyles.ts`)
**Used by:** `ChatRoomPage.tsx`, `ChatRoomHandlers.tsx`, `ChatRoomBody.tsx`, `ChatRoomModals.tsx`, `ChatRoomSheets.tsx`, `ChatRoomOverlays.tsx`, `ChatRoomMenu.tsx` — the shared style sheet for the whole chat room screen

### Findings
1. Pure `StyleSheet.create` definitions (header, composer, voice-recording banner, message bubbles, bottom sheets). No logic, no issues. `btnPrimary`/`btnSecondary`/`btnDanger` are empty placeholder style objects — presumably intended for per-variant styling applied inline elsewhere; harmless as-is, just worth noting they currently contribute nothing.

### Fixes implemented
none — meets the bar as-is.

### Verification
N/A.

**Status:** AUDITED-NO-ISSUES
