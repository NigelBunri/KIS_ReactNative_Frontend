# Chat Room Core — UX/UI Audit

**Scope:** the 17 files that make up the core 1:1/group chat room surface (`src/Module/ChatRoom/*.tsx|ts`, `componets/MessageBubble.tsx`, `componets/MessageTabs.tsx`, `componets/chatMapping.ts`, `src/Module/Community/CommunityRoomPage.tsx`) — ~15,300 lines total, the highest-traffic rendering surface in the app. This is a genuine per-screen/per-file review against visual hierarchy, touch targets, confirmations on destructive actions, error-state honesty, and accessibility — not an inventory. 17 files audited: 10 carried real findings, 7 were already solid as-is. Of the findings, 10 were fixed directly (all low-risk, additive: missing confirmations, silent-error-swallowing, a dead feature on Android, missing accessibility labels, a color-contrast gap on a failed-send indicator) and verified with `tsc --noEmit` (clean) and `eslint` (zero new errors/warnings — all remaining lint output is pre-existing and unrelated to this diff). Two findings in `MessageBubble.tsx`/`chatTypes.ts` were deliberately left as documentation-only per the audit's caution directive for that recently-hardened code. **Headline answer to the standing question:** a failed-to-send message is visually distinguishable from a sent one inside the chat room itself (`MessageBubble.tsx` already renders a distinct red alert icon plus an explicit "Tap to retry" link) — but it was **not** distinguishable in the Messages tab's conversation-list preview (`MessageTabs.tsx` rendered the failed-state glyph in the same neutral grey as every other status), which is now fixed.

---

## ChatRoomPage.tsx (`src/Module/ChatRoom/ChatRoomPage.tsx`)
**Used by:** `AppNavigator.tsx`, `DetachedChatOverlayContext.tsx`, `TabletDialogOverlay.tsx` (the chat room screen itself — orchestrates `ChatRoomBody`/`ChatRoomOverlays`/`ChatRoomEditors`/`ChatRoomSheets`)

### Findings
1. **(P1) "Block chat" had zero confirmation.** `handleBlockChat` called `Handlers.handleBlockRequest` and flipped the UI to locked the instant the menu item was tapped — no "Are you sure?" step, unlike the adjacent `handleClearChat` (which already confirms) and the message-delete paths elsewhere in chat. A mis-tap permanently blocks the other participant and locks the conversation.
2. **(P1) "Edit thread subject" was non-functional on Android.** `handleEditThreadSubject` branched on `Platform.OS === 'ios'` to use `Alert.prompt` (which supports a text field) but on Android fell back to a plain `Alert.alert` with the same copy — "Enter a new subject for this thread" — even though RN's `Alert.alert` has no text-input capability on Android at all. Pressing "Save" simply re-ran the rename with the thread's *existing, unchanged* title, so the feature silently did nothing while visually implying it worked.
3. **(P2) Silent swallow on "Message" quick action.** The member quick-action sheet's "Message" button wrapped its `postRequest` call in `try { ... } catch { /* best-effort */ }` with no fallback and no error surfaced — if creating/opening the DM failed (network/server error), the sheet closed and nothing happened, with no indication to the user that anything went wrong.
4. **(P2) Mute toggle could show an optimistic lie.** `handleToggleMute` called `setMuteOverride(next)` unconditionally after awaiting the mute request, regardless of whether the request actually succeeded — a failed mute/unmute still flipped the on-screen toggle.
5. (P3, documented only) Several `react-hooks/exhaustive-deps` lint findings pre-exist in this file (lines unrelated to this audit's edits — `runSearch`, `handleScheduleSend`, a couple of `useEffect`s) and a few unused imports (`ActivityIndicator`, `answerCall`, `dismissCallUi`). Left alone: fixing hook dependency arrays in a 2,800-line socket/messaging orchestrator is exactly the kind of "internal logic" change this audit is scoped to avoid making blind.

### Fixes implemented
- Added an `Alert.alert('Block chat', ...)` destructive confirmation (Cancel / Block) before `handleBlockChat` does anything, matching `handleClearChat`'s existing pattern.
- Replaced the fake Android prompt with a real in-app `Modal` + `TextInput` (`renameSubRoomTarget`/`renameSubRoomText` state, `commitThreadRename` helper) so Android users can actually type a new thread subject; iOS keeps its working `Alert.prompt` path unchanged.
- The "Message" quick action's catch block now shows `Alert.alert('Message', 'Could not open a chat with this member. Please try again.')`, and a resolved-but-empty response is also now treated as a failure instead of a silent no-op.
- `handleToggleMute` now only calls `setMuteOverride(next)` when `Handlers.handleMuteConversation` resolves `true` (see ChatRoomHandlers.tsx below).

### Verification
`npx tsc --noEmit` — clean. `npx eslint ChatRoomPage.tsx` — 4 pre-existing errors (unused vars, hook deps), none touching the edited lines; no new errors or warnings introduced by this diff.
**Status:** AUDITED-FIXED

---

## ChatRoomHandlers.tsx (`src/Module/ChatRoom/ChatRoomHandlers.tsx`)
**Used by:** `ChatRoomPage.tsx`, `ChatRoomMenu.tsx`, `ChatInfoPage.tsx`

### Findings
1. **(P1) Fabricated success on failure across six handlers.** `postRequest` (see `src/network/post`) never throws on an HTTP/network failure — it always resolves `{ success: false, message, ... }`. `handleArchiveRequest`, `handleLockConversation`, `handleMuteConversation`, `handleAddGroupMember`, `handleRemoveGroupMember`, and `handleSetGroupMemberRole` all awaited `postRequest` and **never checked `.success`**, so a failed archive/lock/mute/add-member/remove-member/role-change request looked identical to a successful one from the user's perspective: the menu/modal just closed as if it worked, with the actual state unchanged server-side and zero feedback that anything failed. This is the exact "silent-error-swallowing / fabricate success" pattern this audit was asked to hunt for, and it spans every group-management and chat-settings action in the file.
2. `handleReportMessage` was already correct for comparison — it returns a boolean the caller can check, which is the right pattern; the six functions above just never adopted it.

### Fixes implemented
- `handleArchiveRequest`, `handleLockConversation`: now check `res?.success === false` and show `Alert.alert('Error', ...)` with the server's message (or a sensible default) before returning, instead of proceeding to the broadcast call as if it succeeded.
- `handleAddGroupMember`, `handleRemoveGroupMember`, `handleSetGroupMemberRole`: same pattern, each with an action-specific title/message (mirrors the existing `Alert.alert('Add member', ...)` convention already used in `ChatInfoPage.tsx`).
- `handleMuteConversation`: now returns `Promise<boolean>` (`true` only on confirmed success) and shows an `Alert.alert('Error', ...)` on failure; its caller in `ChatRoomPage.tsx` was updated to only flip the local mute-override state when this resolves `true` (see above).

### Verification
`npx tsc --noEmit` — clean. `npx eslint ChatRoomHandlers.tsx` — 0 errors, 0 new warnings.
**Status:** AUDITED-FIXED

---

## ChatInfoPage.tsx (`src/Module/ChatRoom/ChatInfoPage.tsx`)
**Used by:** `AppNavigator.tsx`, `DetachedChatOverlayContext.tsx`, `TabletDialogOverlay.tsx`, `VoiceMessageMiniBadge.tsx`

### Findings
1. **(Positive finding, no fix needed)** This file is the best-guarded screen in the whole module for destructive-action confirmation: "Leave group," "Delete group," "Remove member," "Ban member," and "Transfer ownership" all already show a proper `Alert.alert` confirm with a `destructive` style button before acting. This is the standard the rest of the module should be held to (and `ChatRoomPage.tsx`'s "Block chat" gap, fixed above, now matches it).
2. **(P2) Icon-only back button had no accessibility label and an undersized hit target.** Of 35 `Pressable`s in this 2,143-line file, only one (`Add member`) carried an `accessibilityLabel`. The highest-traffic one — the header back arrow, used on every single visit to this screen — was a bare icon with `padding: 6` (≈34×34pt effective target, below the ~44pt guideline) and nothing for a screen reader to announce.
3. (P3, documented only) The same 1-of-35 pattern holds for several other icon-only rows in this file (e.g. the mute/disappearing-timer/wallpaper settings rows). Given the file's size and that its confirmation logic is otherwise exemplary, only the single highest-value, universally-hit control (back button) was fixed directly; the rest is noted here for a follow-up accessibility pass rather than touched piecemeal in this session.

### Fixes implemented
- Added `accessibilityRole="button"`, `accessibilityLabel="Back"`, and `hitSlop={8}` to the header back button. `hitSlop` (rather than changing the `backBtn` style's padding) was used deliberately to avoid any risk of shifting the header's layout/alignment with the title text — it brings the effective tappable area to roughly 50×50pt without changing anything visually.

### Verification
`npx tsc --noEmit` — clean. `npx eslint ChatInfoPage.tsx` — 1 pre-existing error (`useRef` unused import, confirmed present in `HEAD` before this audit, unrelated to the edited lines); no new errors/warnings.
**Status:** AUDITED-FIXED

---

## componets/MessageBubble.tsx (`src/Module/ChatRoom/componets/MessageBubble.tsx`)
**Used by:** `componets/main/MessageList.tsx` (rendered once per message, the single largest and highest-traffic file in chat)

Per the audit's explicit caution for this file (adjacent to the hardened "4 root-cause chat structural fixes"), this review deliberately stayed on the UX/interaction surface — bubble-variant consistency, status-icon legibility, and icon-only control labeling — rather than touching encryption/persistence/reconciliation logic.

### Findings
1. **(Answering the standing question) A failed-to-send message does NOT look like a sent one.** `renderStatusIcon` gives `'failed'` a distinct red (`#DC2626`) `alert-circle` icon versus grey checkmarks for `sent`/`delivered` and blue for `read`, and `renderRetry()` additionally renders an explicit "Tap to retry" link in `palette.danger` directly under the bubble. This is solid, deliberate UX and required no fix.
2. **(P2, fixed) Read-receipt tap target was inconsistent across bubble variants.** `onShowReadReceipts` is a top-level prop of this component, but it was only ever wired to a `Pressable` on the default text/contacts/poll/event bubble (the 5th of 5 render branches). The sticker, styled-text-card, voice, and deleted-message bubble variants rendered the exact same status-tick row inside a plain, non-interactive `<View>` — so tapping the checkmark/clock/failed icon on a sticker or voice message did nothing, while the identical-looking icon on a text message opened read receipts. A real, confirmed interaction inconsistency a user would hit constantly (stickers and voice notes are common message types).
3. **(P2, fixed) Several genuinely icon-only controls had no `accessibilityLabel`.** Of 42 `Pressable`/`TouchableOpacity` elements in this 4,510-line file, zero carried an `accessibilityLabel` before this pass. Most have adjacent visible text (e.g. the attachment download button's "Download"/"Retry download" label, the "Tap to retry" link) so a screen reader still gets useful content, but two are pure icon-with-no-text: the voice message play/pause toggle, and the read-receipts status-tick button addressed in #2.
4. **(P3, documented only)** The `onStar` prop is destructured as `_onStar` and never called anywhere in the file — `isStarred` is read to render a static ⭐ badge, but nothing on the bubble itself can toggle it (starring happens via the long-press action sheet in `InteractiveMessageRow.tsx`, outside this file's scope, which calls the parent's star handler directly). This looks like dead/vestigial prop wiring rather than a bug — the badge is correctly non-interactive by design — but it's worth a follow-up to either wire it up or remove the prop, which is exactly the kind of "not fully confident, so document rather than touch" call this file's audit asked for.
5. Reply/forward/delete/select/pin actions for a message are **not** implemented in this file at all — they live in the long-press action sheet (`componets/InteractiveMessageRow.tsx`, outside this audit's file list), which was spot-checked read-only for context: "Delete for everyone" already shows a proper confirm (a comment in that file documents this was itself a prior fix), "Delete for me" has none (device-local-only, lower stakes, reasonable as-is). Flagging this only so the next audit pass of `InteractiveMessageRow.tsx` doesn't need to rediscover where these actions actually live.

### Fixes implemented
- Wrapped the status-icon row in the sticker, styled-text-card, voice, and deleted-message bubble variants in a `Pressable` wired to `onShowReadReceipts` (previously only the default bubble had this), each with `accessibilityRole="button"` and `accessibilityLabel="View message status"`, matching the pre-existing default-bubble pattern exactly (which also received the same label).
- Added `accessibilityRole="button"` and a dynamic `accessibilityLabel` (`"Play voice message"` / `"Pause voice message"`) to the voice-note play/pause `Pressable`.
- No changes to rendering/decryption/status-derivation logic, message state shape, or anything flagged as hardened.

### Verification
`npx tsc --noEmit` — clean. `npx eslint MessageBubble.tsx` — 0 new errors; remaining warnings are pre-existing `react-native/no-inline-styles` style warnings, unrelated to this diff.
**Status:** AUDITED-FIXED

---

## componets/MessageTabs.tsx (`src/Module/ChatRoom/componets/MessageTabs.tsx`)
**Used by:** `screens/tabs/MessagesScreen.tsx`, `screens/tabs/CommunitiesTab.tsx`, `screens/tabs/BlockedContactsScreen.tsx` (the Messages tab's conversation list — chat row previews, not the chat room itself, but directly answers the standing "does failed look like sent" question for the list surface)

### Findings
1. **(P1, fixed) A failed-to-send message's status DID look like a normal one in the conversation list.** `getStatusSymbol('failed')` correctly returns a distinct `'!'` glyph (vs `'✓'`/`'✓✓'` for sent/delivered/read), but the color logic (`statusColor`) only special-cased `'read'` and `'delivered'` — every other status, including `'failed'`, fell through to the same neutral `palette.subtext` used for a normal pending/sent message. In the actual chat room, `MessageBubble.tsx` gives a failed send a dedicated red icon; in the list row showing that same conversation's last message, the only signal was a tiny, same-colored `"!"` character — easy to miss at a glance, and visually inconsistent with how the chat room itself treats the same state.
2. (Minor, not fixed) `'delivered'` and `'read'` both render the same `'✓✓'` glyph with only a color difference (grey-ish primary vs. `palette.readStatus`) — a legitimate WhatsApp-style convention, not a bug, just noted for completeness.

### Fixes implemented
- Added a `meta?.lastStatus === 'failed'` branch to the `statusColor` calculation that resolves to `palette.danger`, so a failed last-message now shows in red in the conversation list, consistent with the red failed-state treatment already used inside the chat room.

### Verification
`npx tsc --noEmit` — clean. `npx eslint MessageTabs.tsx` — 0 new errors; pre-existing `react-native/no-inline-styles` warnings and two `no-void` warnings are unrelated to the edited lines.
**Status:** AUDITED-FIXED

---

## ChatRoomMenu.tsx (`src/Module/ChatRoom/ChatRoomMenu.tsx`)
**Used by:** `ChatRoomOverlays.tsx` → `ChatRoomPage.tsx`

### Findings
1. No missing-confirmation issues found directly in this file — "Clear chat" is correctly wired to a handler that already confirms (`ChatRoomPage.handleClearChat`), and "Block chat" is now also confirmed at the call site (see ChatRoomPage.tsx fix above); this file itself just calls the props it's given, so the fix for Block chat lives upstream rather than here.
2. (P3, documented only) Menu items are plain text `Pressable`s with no `accessibilityRole="menuitem"`/`accessibilityLabel` — low severity since every item already has visible text a screen reader will read, but a true menu role would improve the experience for assistive tech users navigating by landmark/role rather than linear text.
3. (P3, documented only) `menuItem` touch targets (`paddingVertical: 12` + 14px text) land close to but may be slightly under 44pt depending on font metrics; not clearly broken, not changed to avoid any unnecessary risk to this shared overlay's layout.

### Fixes implemented
None — the one real issue found (Block chat confirmation) is fixed upstream in `ChatRoomPage.tsx`, which is the correct place for it since this component just renders props.

### Verification
No code changes to this file; `npx eslint ChatRoomMenu.tsx` — 0 errors (pre-existing state).
**Status:** AUDITED-NO-ISSUES

---

## ChatRoomModals.tsx (`src/Module/ChatRoom/ChatRoomModals.tsx`)
**Used by:** `ChatRoomOverlays.tsx` → `ChatRoomPage.tsx`

### Findings
1. No destructive actions live here (add/remove/set-role member modal, message search) — "Confirm" on the group-action modal is itself the confirmation step, which is appropriate.
2. (P3, documented only) The group-action modal's "User ID" `TextInput` has no validation/format hint beyond a placeholder — a malformed ID just silently fails server-side (now at least surfaced via the ChatRoomHandlers.tsx fix above, which this modal's actions ultimately call into).
3. Good patterns worth preserving: the search filter chips and per-sender filter row are clear, have adequate touch targets (36×36 avatars, pill chips), and the "No results" / "No {filter} results." empty-state copy correctly distinguishes "nothing matched this filter" from "no results at all."

### Fixes implemented
None — meets the bar as-is; the one related gap (silent failure on the member actions this modal submits) is fixed at the handler layer in `ChatRoomHandlers.tsx`.

### Verification
No code changes to this file; typecheck/lint unaffected.
**Status:** AUDITED-NO-ISSUES

---

## ChatRoomOverlays.tsx (`src/Module/ChatRoom/ChatRoomOverlays.tsx`)
**Used by:** `ChatRoomPage.tsx`

### Findings
None. This is a pure composition/prop-forwarding component (renders `ChatRoomMenu` + `ChatRoomModals` with no logic, styling, or state of its own). Nothing to evaluate against the UX criteria beyond what's already covered in its two children above.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes; not applicable.
**Status:** AUDITED-NO-ISSUES

---

## ChatRoomSheets.tsx (`src/Module/ChatRoom/ChatRoomSheets.tsx`)
**Used by:** `ChatRoomPage.tsx`

### Findings
None. Also a pure composition component — forwards props to `PinnedMessagesSheet`, `SubRoomsSheet`, `ForwardChatSheet`, `StarredMessagesSheet`, `ReadReceiptsSheet`, `DisappearingTimerSheet`, and `WallpaperPickerSheet` (all outside this audit's scope). No rendering, state, or styling of its own to audit.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes; not applicable.
**Status:** AUDITED-NO-ISSUES

---

## ChatRoomEditors.tsx (`src/Module/ChatRoom/ChatRoomEditors.tsx`)
**Used by:** `ChatRoomPage.tsx`

### Findings
None. A third pure composition component (44 lines) — conditionally renders `TextCardComposer` and `StickerEditor` based on props, with no logic of its own.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes; not applicable.
**Status:** AUDITED-NO-ISSUES

---

## ChatRoomBody.tsx (`src/Module/ChatRoom/ChatRoomBody.tsx`)
**Used by:** `ChatRoomPage.tsx`

### Findings
1. (P3, documented only) The scheduled-messages modal's "Send now" / "Cancel" row buttons (`paddingHorizontal: 10, paddingVertical: 6` around 12px text) land under the ~44pt touch-target guideline — roughly 26-28pt tall. Low traffic surface (only appears when the user has scheduled messages pending) and visually paired closely together, so a width/height change risked crowding two adjacent action buttons without a layout pass; documented rather than changed blind.
2. (P3, documented only) "Cancel" on a scheduled message has no confirmation — arguably fine, since the message simply reverts to sitting in the composer/drafts rather than being destroyed, but worth a second look if product intent differs.
3. Positive: the announcement-mode banner and "only admins can post" banner give clear, distinct copy for two different restricted-posting states, and the `KeyboardAvoidingView`'s `automaticOffset` usage is well-reasoned (documented in the file's own comment) for correctly offsetting above a header whose height this component doesn't itself know.

### Fixes implemented
None — findings are low-severity and the fixes available (resizing two adjacent small buttons) carry more layout risk than the issue warrants without a visual pass; documented for a follow-up instead.

### Verification
No code changes to this file; typecheck/lint unaffected.
**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## Community/CommunityRoomPage.tsx (`src/Module/Community/CommunityRoomPage.tsx`)
**Used by:** `screens/tabs/CommunitiesTab.tsx`, `components/shell/TabletDialogOverlay.tsx`, `components/partners/PartnerActivityPanel.tsx`

### Findings
None of consequence. This file is in good shape:
- The header's close button already has `accessibilityRole="button"`, `accessibilityLabel="Close"`, and `hitSlop={8}` on a 34×34 target (effective ~50×50 with hitSlop) — exactly the pattern the rest of the module should follow.
- Loading state uses skeletons (not a bare spinner) for both the feed card and the group list.
- Error state is explicit and actionable: a red-bordered banner with "Could not load community data." plus a "Tap to retry" link, distinguished from the separate empty state ("No groups yet.") — this is the correct three-way split (loading / error-with-retry / confirmed-empty) that other files in this module (e.g. `normalizeConversation.ts`) had to be retrofitted to get right.
- `Promise.allSettled` for posts+groups means one failing endpoint doesn't block the other from rendering.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## chatTypes.ts (`src/Module/ChatRoom/chatTypes.ts`)
**Used by:** `ChatRoomBody.tsx`, `ChatRoomHandlers.tsx`, `ChatRoomPage.tsx`, `ChatRoomSheets.tsx`, `Storage/chatStorage.ts`, `Storage/decryptedMessageStorage.ts`, and effectively every file in this module

### Findings
This file is pure type/interface definitions (`ChatMessage`, `MessageStatus`, `VoiceAttachment`, etc.) with zero rendering or runtime logic — there is nothing here to evaluate against visual/interaction UX criteria directly. Per the audit's explicit caution for this file (adjacent to the hardened receipt-shape/status-rank fixes), it was read in full rather than skimmed, specifically checking whether the `MessageStatus` union or any comment hinted at an unresolved status-ordering ambiguity that could resurface the original "failed looks like sent" class of bug. It does not: the type is a clean closed union (`'local_only' | 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'`) with no ambiguity, and the file's own header comments document the WhatsApp/Signal-style invariants (`id` always defined, `clientId` always defined, `serverId` assigned only on ACK) that the earlier structural-fix session hardened elsewhere (`chatStorage.ts`, `useChatPersistence.ts`).

### Fixes implemented
documented only — no runtime logic to safely touch, and nothing found that warranted it

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## messagesUtils.ts (`src/Module/ChatRoom/messagesUtils.ts`)
**Used by:** `AddContactsPage.tsx`, `ChatInfoPage.tsx`, `ChatRoomBody.tsx`, `ChatRoomMenu.tsx`, `ChatRoomOverlays.tsx`, `ChatRoomPage.tsx`, and the shared `styles` export used across several list/menu/modal components in this module

### Findings
1. No UX-surface bugs found — this file is participant-wire-shape normalization helpers (`directConversationName`, `directConversationAvatar`, `participantsToIds`, etc.) plus a shared `StyleSheet.create` block. The helper functions' own comments document a real bug that was already fixed here previously (the self-exclusion check used to live inside a branch it didn't cover, so a DM's own participant list could show a user their own name/avatar as "the other participant" — now fixed with an unconditional `participantUserId` check up front).
2. (P3, documented only) The shared `checkboxBox` style (20×20) in the exported `styles` object is below the 44pt guideline if used as a standalone tap target anywhere; not verified whether any current call site wraps it in a larger `Pressable` with adequate padding/hitSlop, since this file only defines the style and doesn't render it. Flagged for whoever audits the consumer(s) of this style object.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## normalizeConversation.ts (`src/Module/ChatRoom/normalizeConversation.ts`)
**Used by:** `AddContactsPage.tsx`, `componets/MessageTabs.tsx`, `screens/tabs/MessagesScreen.tsx`, `components/broadcast/ShareToChatModal.tsx`

### Findings
This is a data/caching layer with no rendering of its own, but it directly determines what empty/error/offline state the Messages tab can show — exactly the class of thing this audit was asked to hunt for. It's already in excellent shape: `ConversationsFetchStatus` (`'fresh' | 'cache_fallback' | 'error_no_cache'`) is a three-way result specifically introduced (per its own header comment) to stop collapsing "confirmed empty account," "refresh failed but cache exists," and "refresh failed and nothing is cached" into one indistinguishable `Chat[]`. `fetchAllConversationPages` also documents and fixes a prior silent-pagination-truncation bug (any account with >25 conversations used to lose everything past page 1 with no error). No further findings.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## safeChatText.ts (`src/Module/ChatRoom/safeChatText.ts`)
**Used by:** `ChatRoomPage.tsx`, `componets/MessageBubble.tsx`, `componets/MessageTabs.tsx`, `componets/chatMapping.ts`, `normalizeConversation.ts`

### Findings
None. This 110-line file exists specifically to prevent a UX failure mode: `normalizeChatDisplayText`/`looksLikeJsonObject`/`looksLikeObjectString` detect when a raw JSON metadata blob would otherwise be rendered as literal message text (e.g. `"[object Object]"` or a stray `{"conversationId": ...}` string leaking into a bubble), and blank it instead of showing garbage to the user. `resolveChatPreviewText` correctly falls back through text → media-type label (e.g. "🖼️ Photo") → previous value → fallback, and explicitly treats the literal string `"encrypted message"` as non-display-worthy at every fallback tier so a conversation-list preview never gets stuck showing that placeholder forever once real content is available.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## componets/chatMapping.ts (`src/Module/ChatRoom/componets/chatMapping.ts`)
**Used by:** `screens/tabs/MessagesScreen.tsx`

### Findings
None. Pure backend-payload → `ChatMessage` mapping with no rendering. Status is hardcoded to `'sent'` for every mapped message, which is correct for this path specifically (it only ever maps messages that already arrived from the server, so "sent" is the only status that could apply). Attachment/voice field-name fallback chains are extensive (`url`/`downloadUrl`/`publicUrl`/`fileUrl`/`secureUrl`/`signedUrl` etc.) but that reflects real backend inconsistency being defended against, not a UX gap.

### Fixes implemented
none — meets the bar as-is

### Verification
No code changes to this file.
**Status:** AUDITED-NO-ISSUES

---

## Summary table

| File | Status |
|---|---|
| ChatRoomPage.tsx | AUDITED-FIXED |
| ChatRoomHandlers.tsx | AUDITED-FIXED |
| ChatInfoPage.tsx | AUDITED-FIXED |
| componets/MessageBubble.tsx | AUDITED-FIXED |
| componets/MessageTabs.tsx | AUDITED-FIXED |
| ChatRoomMenu.tsx | AUDITED-NO-ISSUES |
| ChatRoomModals.tsx | AUDITED-NO-ISSUES |
| ChatRoomOverlays.tsx | AUDITED-NO-ISSUES |
| ChatRoomSheets.tsx | AUDITED-NO-ISSUES |
| ChatRoomEditors.tsx | AUDITED-NO-ISSUES |
| ChatRoomBody.tsx | AUDITED-FINDINGS-DOCUMENTED |
| Community/CommunityRoomPage.tsx | AUDITED-NO-ISSUES |
| chatTypes.ts | AUDITED-NO-ISSUES |
| messagesUtils.ts | AUDITED-NO-ISSUES |
| normalizeConversation.ts | AUDITED-NO-ISSUES |
| safeChatText.ts | AUDITED-NO-ISSUES |
| componets/chatMapping.ts | AUDITED-NO-ISSUES |

**Verification (whole diff):** `cd /Users/nigel/dev/KIS && npm run typecheck` — clean. `npx eslint` on all five edited files — 9 pre-existing errors confirmed present in `HEAD` before this audit (unused imports, `react-hooks/exhaustive-deps` on unrelated hooks) and unrelated to any edited line; zero new errors or warnings introduced.
