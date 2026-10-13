# Bible Non-Game Components — UX/UI Audit

Scope: the 14 non-game Bible components (17 files counting sub-files) under `src/components/Bible/` not already covered by the prior `BibleCourseDetailSheet.tsx`/`BibleLessonsPanel.tsx` pass and not part of the `games/` subtree (covered separately). This set skews toward two different risk profiles: five content-browsing panels that hit KCAN REST endpoints (Books, Messages, Plans, Settings, and the 3216-line Reader), and a fully-offline, locally-persisted pair (the 12 Pillars discipleship journey) that mirrors the Bible Games' "fixed content, on-device progress" design. The dominant recurring bug across the network-backed panels was the same pattern flagged earlier in this audit program: a failed API call (`res.success === false`) was indistinguishable from "nothing has been published yet," so a server hiccup silently rendered as a permanent-looking empty catalog with no retry — fixed in `BibleBooksPanel.tsx` and `BibleMessagesPanel.tsx` (3 call sites). The single highest-severity finding was an **unconfirmed destructive delete** in `BiblePlansPanel.tsx` — tapping "Delete" on a scheduled reading event removed it (and its reminders) immediately, with no "are you sure," directly analogous to the refund-confirmation gap already fixed in `BibleCourseDetailSheet.tsx` — now fixed with an `Alert.alert` confirmation. `BibleReaderPanel.tsx`, by contrast, was already in excellent shape (delete confirmations, offline-sync reconciliation, 404-as-success handling, and 5 existing `accessibilityLabel`s) — the fixes there are small gap-filling additions (color-swatch labels, undersized touch targets, a silent audio-playback failure) rather than structural repairs. Nine fixes were applied across 8 files; typecheck is clean and lint introduces no new warnings/errors (one pre-existing unused-var error in `BiblePlansPanel.tsx`, at an unrelated line, was confirmed present before this pass via `git diff`).

---

## BibleBooksPanel (`src/components/Bible/BibleBooksPanel.tsx`)
**Used by:** Bible tab → Books sub-screen (KCAN-published book catalog + in-app PDF reader)
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, accessibility labels on icon-only controls, touch targets, visual hierarchy
**Not applicable:** forms/validation (no forms), navigation/back behavior beyond the PDF modal, offline mode (catalog is online-only by design)

### Findings
1. **(P2) Network/server failure rendered as "No books available."** `fetchBooks` only called `setBooks` on `res.success`; when the request failed it fell through doing nothing, leaving `books` at `[]` and showing the exact same empty-catalog copy ("KCAN will publish books here for you to read in-app") as a genuinely empty catalog. A user on a bad connection had no way to distinguish "nothing published yet" from "couldn't reach the server," and no retry affordance. This is the same silent-error-swallowing/fabricate-empty-state pattern flagged repeatedly elsewhere in this audit program.
2. **(P3) Icon-only controls lacked `accessibilityLabel`.** The search-clear button and the PDF reader's back button were bare icons with no screen-reader label.
3. **(P3) PDF reader back button's effective touch target was below 44pt** (`padding: 4` around a 22px icon ≈ 30×30pt).

### Fixes implemented
- Added a `loadError` state; `fetchBooks` now distinguishes `res.success === false` from a truly empty result set, passing `errorMessage` to `getRequest` and surfacing `res.message` in a dedicated error view (warning icon, the specific error text, and a "Try again" retry button that re-runs `fetchBooks`) instead of the generic empty-catalog message.
- Added `accessibilityLabel`/`accessibilityRole="button"` to the search-clear button ("Clear search") and the PDF reader close button ("Close book"), both with `hitSlop={10}`.

### Verification
`npm run typecheck` — clean. `npx eslint` on the changed file — no new errors (pre-existing `react-native/no-inline-styles` warnings only, unrelated to this file).
**Status:** AUDITED-FIXED

---

## BibleGamesPanel (`src/components/Bible/BibleGamesPanel.tsx`)
**Used by:** Bible tab → Games sub-screen (hub for the 30 Bible games, routed to game/journey/stats screens covered by a separate audit)
**Criteria evaluated:** loading/empty states, cognitive load, visual hierarchy, touch targets, emotional tone, journey integration
**Not applicable:** network error handling (fully offline — `getBestScores`/`getAllGameProgress` read bundled AsyncStorage, never the network), forms/validation, the 30 games themselves (separate agent's scope)

### Findings
1. **(P3, informational) `refresh()`'s two AsyncStorage reads have no `.catch`.** If local storage ever threw (corrupt data, platform quirk), the promises would reject silently and `bestScores`/`progress` would just stay at their initial `{}` — functionally harmless (chips just show no "Best" badge) and consistent with how `gameStorage.ts` is used everywhere else in the games subtree, so not fixed here to avoid touching code this agent wasn't asked to own.

### Fixes implemented
None — the hub itself (registry, lazy-loading, coming-soon fallback, overall-stats entry point) is well-built and appropriately scoped; no network/destructive-action/accessibility gaps found inside this file's own code.

### Verification
Not modified; no typecheck/lint run needed.
**Status:** AUDITED-NO-ISSUES

---

## BibleMessagesPanel (`src/components/Bible/BibleMessagesPanel.tsx`)
**Used by:** Bible tab → Messages sub-screen (KCAN topics → ministers → messages drill-down + video player)
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, navigation/back behavior, accessibility labels, touch targets
**Not applicable:** forms/validation, destructive actions (none present), offline mode (online-only catalog by design)

### Findings
1. **(P2) Same silent-error-swallowing pattern as BibleBooksPanel, in three places.** `loadTopics`, `loadMinisters`, and `loadMessages` all ignored `res.success` and derived the list purely from `res.data?.results ?? res.data ?? []`, so a failed request produced the exact same "No topics yet" / "No ministers yet" / "No messages yet" empty state as genuinely empty content, with no retry.
2. **(P3) Icon-only controls lacked `accessibilityLabel`.** The video player's close button, the drill-down back button, and the search-clear button were all bare icons.

### Fixes implemented
- Added a `loadError` state; all three loaders now check `res.success`, surface `res.message` via a dedicated error view (warning icon + message + "Try again" button that re-runs the loader appropriate to the current `viewMode`) instead of silently falling into the wrong empty-state copy.
- Added `accessibilityLabel`s ("Close video", "Back", "Clear search") with `hitSlop={10}` to the three icon-only controls above.

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors/warnings introduced.
**Status:** AUDITED-FIXED

---

## BiblePlansPanel (`src/components/Bible/BiblePlansPanel.tsx`)
**Used by:** Bible tab → Plans sub-screen (reading-event planner calendar + reading-plan enrollment)
**Criteria evaluated:** destructive actions/confirmations, loading/error/offline states, forms/validation, touch targets
**Not applicable:** accessibility labels on icon-only controls (all actionable controls here use `KISButton` with visible text, not bare icons)

### Findings
1. **(P1) Deleting a scheduled reading event had no confirmation.** The "Delete" button inside each event card called `deleteEvent(event)` directly on press — no `Alert.alert`, no undo. This both discards the user's scheduling work and cancels its reminders (`deleteBibleReadingEventReminders`) with a single accidental tap, with zero recovery path. This is the exact same class of gap already fixed in `BibleCourseDetailSheet.tsx` for the paid-course refund action, just in a different screen the prior pass didn't touch.
2. **(Informational, no fix needed)** Every other mutating action in this file (`createEvent`, `updateEvent`, `updateStatus`, `enrollInPlan`) already handles `res.success` correctly and degrades gracefully to a clearly-labeled "saved locally, will sync" state rather than fabricating a false success — this is deliberate offline-first design, not a bug, and matches the pattern already established in `BibleReaderPanel.tsx`'s own local-library sync.

### Fixes implemented
- Added `confirmDeleteEvent(event)`, which shows an `Alert.alert('Delete this reading?', ...)` confirmation (mentioning that reminders will be cancelled when any are set) with Cancel/Delete (destructive-style) actions; only the Delete path calls the existing `deleteEvent`. Wired the "Delete" button to call this instead of `deleteEvent` directly.

### Verification
`npm run typecheck` — clean. `npx eslint` — the file has one pre-existing `@typescript-eslint/no-unused-vars` error (`progressRatio`, line ~552) confirmed via `git diff` to exist before this pass and on a line this change never touched — left as-is since fixing unrelated dead code was out of scope for this audit. No new errors or warnings from the fix itself.
**Status:** AUDITED-FIXED

---

## BibleReadAloudSheet (`src/components/Bible/BibleReadAloudSheet.tsx`)
**Used by:** `BibleReaderPanel.tsx`'s "Listen" header button (on-device TTS mini-player + voice/speed/duration settings sheet)
**Criteria evaluated:** accessibility labels on icon-only controls, touch targets, forms/validation, cognitive load
**Not applicable:** network calls (none — purely a controlled UI driven by `useBibleReadAloud`'s props/callbacks), destructive actions (none), offline mode (device TTS always works offline)

### Findings
1. **(P2) The sheet's close button and all three transport controls (Stop / Play-Pause) were bare icons with no `accessibilityLabel`.** For a feature whose entire purpose is accessibility (reading Scripture aloud), the controls themselves weren't labeled for screen-reader users.

### Fixes implemented
- Added `accessibilityRole="button"` + `accessibilityLabel` to the close button ("Close read aloud"), the Stop button ("Stop"), and the Play/Pause button (label switches between "Play" and "Pause" based on state).

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors/warnings.
**Status:** AUDITED-FIXED

---

## BibleReaderPanel (`src/components/Bible/BibleReaderPanel.tsx`, 3216 lines)
**Used by:** Bible tab → Read sub-screen (the primary high-traffic reading surface: translation/book/chapter navigation, verse selection, highlights/notes/bookmarks library, reading planner hand-off, offline downloads, audio playback, read-aloud)
**Criteria evaluated:** every criterion in the brief — this is the flagship screen
**Not applicable:** none — all criteria apply somewhere in this file

### Findings
This file was already in notably good shape relative to the rest of the directory — it already had `RefreshControl` (the only file in the whole directory that did, per the prior inventory pass), `Alert.alert` confirmations before both destructive actions present (`confirmDeleteLibraryItem` for highlights/notes/bookmarks, and `deleteOfflineDownload` for removing a downloaded translation), 404-treated-as-already-deleted handling, and 5 pre-existing `accessibilityLabel`s on its busiest controls (read-aloud toggle, share, previous/next chapter). The gaps found were narrower:

1. **(P2) The highlight-color picker's 6 color swatches had no `accessibilityLabel`.** Each is a bare colored square (`TouchableOpacity` with only a `backgroundColor` style, no text or icon) — a screen-reader user tapping through "Choose highlight color" would hear nothing distinguishing one swatch from another.
2. **(P2) Two icon-only header buttons ("Listen", "Share chapter") and the previous/next chapter nav dots had touch targets below the 44pt minimum with no `hitSlop` (or insufficient `hitSlop`) to compensate.** `circleIconBtn` is 28×28pt with no `hitSlop` at all; `readerNavArrowDot` is 22×22pt with only `hitSlop={6}` (effective ≈34×34pt).
3. **(P3) The inline retry icon in the "server is starting up" banner** (shown when cached/local verses are displayed while the server wakes up) had no `accessibilityLabel`.
4. **(P2) Silent failure on audio playback start.** `toggleAudioPlayback`'s play path wraps `player.startPlayer(audioUrl)` in a bare `try { ... } catch {}` — if playback fails to start (bad URL, codec issue, permission), `isPlaying` correctly stays `false` (no fabricated success), but the user gets zero feedback: tapping Play visibly does nothing.

### Fixes implemented
- Added a `HIGHLIGHT_COLOR_NAMES` lookup and wired `accessibilityLabel={`Highlight ${name}`}` (plus `hitSlop={6}`) onto each color swatch.
- Added `hitSlop={8}` to the "Listen" and "Share chapter" circular header buttons; increased `hitSlop` on the previous/next chapter nav dots from `6` to `11` (22pt box + 11pt hitSlop on each side = 44pt effective target).
- Added `accessibilityLabel="Retry loading passage"` + `hitSlop={10}` to the inline retry icon in the server-waking banner.
- Added an `Alert.alert('Unable to play audio', ...)` in the `catch` block of the audio-playback start path, so a failed play attempt is now visible to the user instead of silently doing nothing.

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors; pre-existing `react-native/no-inline-styles` warnings throughout the file (unrelated to these edits, consistent with the file's existing style).
**Status:** AUDITED-FIXED

---

## BibleSectionCard (`src/components/Bible/BibleSectionCard.tsx`)
**Used by:** nearly every panel in this directory (shared card shell)
**Criteria evaluated:** responsive layout, design-system consistency
**Not applicable:** everything else — this is a 30-line layout primitive with no state, no network, no interactivity

### Findings
None. Correctly reads `palette.card` and responsive spacing tokens from the shared theme/responsive hooks; nothing hardcoded.

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## BibleSettingsPanel (`src/components/Bible/BibleSettingsPanel.tsx`)
**Used by:** Bible tab → Settings sub-screen (reading preferences, spiritual-growth journey summary, games/discipleship on-device stats rollup, KCAN admin "Control Room")
**Criteria evaluated:** loading/error/offline states, forms/validation, destructive-ish admin actions, touch targets, visual hierarchy
**Not applicable:** accessibility labels on icon-only controls (the admin flag toggles and preference steppers are all text-labeled, not bare icons)

### Findings
1. **(Informational, not fixed) The KCAN Control Room's "Reject" / licensing-flag toggles have no confirmation.** Rejecting a translation or flipping `is_public`/`is_licensed` off happens on a single tap. This is gated behind `controlRoomAllowed` (visible only to accounts with KCAN admin API access) and every toggle is instantly reversible by tapping it again, so the risk profile is materially different from an end-user-facing destructive delete — judged low-severity enough not to need a confirmation dialog, but noting it since "Reject" does cascade (`is_public: false, is_licensed: false` together) and an admin audit log entry is the only record of who did it.
2. The offline-first sync pattern here (`loadPreference`'s handling of `local_pending` vs. server state) is unusually careful — it explicitly avoids overwriting an unsynced local change with stale server data and explains why in a comment. No issues found.

### Fixes implemented
None — every network call already checks `res?.success` and falls back to honest, clearly-labeled messaging ("Bible settings saved locally...", "Unable to sync...will retry") rather than fabricating success.

### Verification
Not modified; no typecheck/lint run needed.
**Status:** AUDITED-NO-ISSUES

---

## DailyDevotionsPanel (`src/components/Bible/DailyDevotionsPanel.tsx`)
**Used by:** Bible tab → Daily sub-screen (presentational — receives `devotionals`/`loading` as props from the parent's `useBibleData` hook)
**Criteria evaluated:** typography/readability (reading-content screen), loading/empty states, visual hierarchy
**Not applicable:** network/error handling (no network calls in this file — fetching and error handling live in the parent hook, out of this file's scope), destructive actions, accessibility labels on icon-only controls (none present — all controls are `KISButton` with text)

### Findings
None. Good typographic hierarchy for a reading-content screen (distinct `eyebrow`/`heroTitle`/`copy` scales, 24px line-height on body copy), a clear empty state when no passage has been published, and a "More/Less" disclosure for history that avoids overwhelming the default view.

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## MeditationPanel (`src/components/Bible/MeditationPanel.tsx`)
**Used by:** Bible tab → Meditations sub-screen (presentational — receives `meditations`/`loading` as props)
**Criteria evaluated:** typography/readability, loading/empty states, silent-error-swallowing, emotional tone
**Not applicable:** network/error handling for the list itself (fetching lives in the parent hook), destructive actions, accessibility labels on icon-only controls (filter chips and "Open video" are all text-labeled)

### Findings
1. **(P2) `Linking.openURL(entry.video_url)` on the "Open video" button had no `.catch`.** If the device has no app/browser able to open the URL (malformed link, unsupported scheme), the promise rejects with no handler — the button visibly does nothing and the rejection surfaces only as an unhandled-promise warning in the dev console, never to the user.

### Fixes implemented
- Added `.catch(() => Alert.alert('Unable to open video', 'This link could not be opened on your device.'))` to the `Linking.openURL` call.

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors/warnings.
**Status:** AUDITED-FIXED

---

## PrayerPanel (`src/components/Bible/PrayerPanel.tsx`)
**Used by:** Bible tab → Prayer sub-screen (monthly KCAN prayer calendar)
**Criteria evaluated:** loading/empty/error states, calendar touch targets, visual hierarchy
**Not applicable:** destructive actions (none — read-only calendar), accessibility labels on icon-only controls (none — all calendar cells carry a visible day number)

### Findings
None of consequence. Unlike `BibleBooksPanel`/`BibleMessagesPanel`, this file already does the right thing: it checks `monthRes?.success` explicitly and sets a dedicated `error` state with the server's own message when the month fetch fails, rather than conflating failure with "no prayer month published." The secondary `dayRes` fetch is allowed to fail silently into an empty list with a fallback to `currentMonth.days` — a reasonable choice since day-level data degrades gracefully rather than blocking the whole screen.

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## TranslationPicker (`src/components/Bible/TranslationPicker.tsx`)
**Used by:** `BiblePlansPanel.tsx`, `BibleSettingsPanel.tsx` (translation-selector chip row)
**Criteria evaluated:** touch targets, design-system consistency
**Not applicable:** everything else — a 33-line stateless wrapper around `KISButton`

### Findings
None. Delegates all sizing/contrast/touch-target behavior to the shared `KISButton` component.

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## TwelvePillarsPanel (`src/components/Bible/TwelvePillarsPanel.tsx`)
**Used by:** Bible tab → Discipleship sub-screen (12-doctrine, 6-day-each sequential journey with MCQ gating, fully offline except for the "share progress" action)
**Criteria evaluated:** every criterion — second-largest file in scope, high journey-integration surface
**Not applicable:** none

### Findings
1. **(P2) Two icon-only header buttons had touch targets below 44pt with no `hitSlop`.** The "Listen" button (`circleIconBtn`, 28×28pt) in the lesson view and the "About this journey" info button (`iconBadge`, 30×30pt) in the step-list header both had zero `hitSlop`, despite already carrying correct `accessibilityLabel`s.
2. **(Informational, no fix needed) `handleSharePicked` already follows the confirmed-success-only pattern** that was the key fix in the prior `BibleCourseDetailSheet.tsx` pass — it awaits `shareDiscipleshipStats(...)` and only shows the "Shared" success alert when `res.ok` is true, showing "Share failed" otherwise. No fabricate-success bug here.
3. Quiz choices are correctly re-shuffled on every attempt (`shuffledChoices`) with a documented rationale (most answer banks happen to list the correct choice first in the source content); locked-day/locked-doctrine gating is enforced in both the data layer (`discipleshipStorage.ts`) and the UI (`openDoctrine`/`openDay` both re-check lock status before navigating, not just visually disabling).

### Fixes implemented
- Added `hitSlop={8}` to the "Listen" button and `hitSlop={7}` to the "About this journey" button, bringing both to an effective ≥44pt touch target without changing their visual size.

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors/warnings.
**Status:** AUDITED-FIXED

---

## discipleshipShare.ts (`src/components/Bible/discipleshipShare.ts`)
**Used by:** `TwelvePillarsPanel.tsx`'s "Share progress to chat" action
**Criteria evaluated:** silent-error-swallowing, fabricate-success-on-failure
**Not applicable:** everything UI-related — this is a 44-line network helper with no rendered output

### Findings
None. Every exit path resolves an explicit `{ ok: boolean; error?: string }` — no socket, no ack, and an explicit `ackResult.ok === false` are all distinguished with their own user-facing error string, and `{ ok: true }` is only reached after a successful ack. Mirrors `games/bibleGameShare.ts`'s pattern exactly, as documented in its own header comment. The caller (`TwelvePillarsPanel.handleSharePicked`) correctly checks `res.ok` before declaring success (see above).

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## DayRoadmap (`src/components/Bible/discipleship/DayRoadmap.tsx`)
**Used by:** `TwelvePillarsPanel.tsx`'s per-doctrine day roadmap view
**Criteria evaluated:** accessibility labels, touch targets, visual hierarchy, emotional tone
**Not applicable:** network/error handling (pure presentational component, no network/storage calls), destructive actions

### Findings
None. Each day plaque already carries a correct `accessibilityLabel` (locked/completed/current state included in the label text) and a 60×48pt touch target with `hitSlop={8}`, comfortably over the 44pt minimum. The pulsing "current day" glow animation is a nice touch for warmth/journey-motivation without being distracting (disabled entirely for non-current days, loop torn down on unmount).

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## DiscipleshipReadAloudSheet (`src/components/Bible/discipleship/DiscipleshipReadAloudSheet.tsx`)
**Used by:** `TwelvePillarsPanel.tsx`'s "Listen" button (single-day TTS mini-player, trimmed-down sibling of `BibleReadAloudSheet.tsx`)
**Criteria evaluated:** accessibility labels on icon-only controls, touch targets
**Not applicable:** network calls, destructive actions, offline mode (same as `BibleReadAloudSheet.tsx` — device TTS, always offline)

### Findings
1. **(P2) Same gap as `BibleReadAloudSheet.tsx`:** the close button and Stop/Play-Pause transport controls were bare icons with no `accessibilityLabel`.

### Fixes implemented
- Added the identical `accessibilityRole="button"` + `accessibilityLabel` set used in `BibleReadAloudSheet.tsx` ("Close read aloud", "Stop", "Play"/"Pause").

### Verification
`npm run typecheck` — clean. `npx eslint` — no new errors/warnings.
**Status:** AUDITED-FIXED

---

## discipleshipStorage.ts (`src/components/Bible/discipleship/discipleshipStorage.ts`)
**Used by:** `TwelvePillarsPanel.tsx`, `BibleSettingsPanel.tsx` (bundled content + AsyncStorage progress persistence for the 12 Pillars journey)
**Criteria evaluated:** silent-error-swallowing (storage layer), data integrity
**Not applicable:** everything UI-related — no rendered output, no network calls

### Findings
None. `readJson`/`writeJson` both wrap `AsyncStorage` in `try/catch` with an explicit, commented rationale for swallowing the error ("corrupt/unreadable local storage is treated as start fresh, never a crash — nothing here is server-recoverable, so failing hard buys nothing" / "a failed write just means this attempt's score isn't saved, not a reason to interrupt study with an error"). This is a deliberate, documented, and correct choice for a fire-and-forget local-only progress store — not the same silent-swallowing problem as a network call whose failure the user actually needs to know about. The strictly-sequential lock logic (`getJourneyDescriptors`) is the same model as the Bible Games' stage-gating and is internally consistent.

### Fixes implemented
None needed.

### Verification
Not modified.
**Status:** AUDITED-NO-ISSUES

---

## Summary of fixes by severity

| Severity | Count | Examples |
|---|---|---|
| P1 | 1 | Unconfirmed destructive delete of a scheduled reading event (BiblePlansPanel) |
| P2 | 8 | Error-as-empty-state fabrication (BibleBooksPanel, BibleMessagesPanel ×3); missing accessibility labels on transport/color controls (BibleReadAloudSheet, DiscipleshipReadAloudSheet, BibleReaderPanel color swatches); undersized touch targets (BibleReaderPanel, TwelvePillarsPanel); silent `Linking.openURL`/audio-playback failures (MeditationPanel, BibleReaderPanel) |
| P3 | 3 | Missing labels on secondary icon buttons (BibleBooksPanel, BibleMessagesPanel, BibleReaderPanel retry icon) |

Files touched: `BibleBooksPanel.tsx`, `BibleMessagesPanel.tsx`, `BiblePlansPanel.tsx`, `BibleReadAloudSheet.tsx`, `BibleReaderPanel.tsx`, `MeditationPanel.tsx`, `TwelvePillarsPanel.tsx`, `discipleship/DiscipleshipReadAloudSheet.tsx` (8 of 17 files). No backend contracts, API calls, or navigation structures were changed; no files were deleted. `npm run typecheck` is clean across the whole project after all edits.
