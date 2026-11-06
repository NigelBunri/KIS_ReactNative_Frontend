# KIS Physical-Device Test Matrix — 2026-11-06

Covers the fixes in `KIS` commits `11601b9`, `3192059` and `backend/Nestjs`
commits `4c6e713`, `328b37c`. Everything in this document requires real
(or at minimum real-simulator) devices — none of it was, or can be,
verified by TypeScript/Jest/Django checks or static code inspection. Those
automated checks prove the code is internally consistent and calls the
right APIs in the right order; they do not prove a keyboard actually
avoids a nav bar, a remote screen actually renders, or a call actually
survives being backgrounded on real hardware.

**Minimum device set**: one Android phone with gesture navigation, one
Android phone (or the same phone switched) with 3-button navigation, one
iPhone. At least two physical/simulated devices are required for every
call/screen-share/encryption test — a single-device test proves nothing
about what the *other* participant actually receives.

For every test below: **Expected** is pass/fail criteria, **Failure
symptoms** is what you'll actually observe if it's broken (so a tester
unfamiliar with the fix can still recognize a regression), and **Evidence**
is what to capture before moving on.

---

## 1. Composer positioning — Android gesture navigation

**Setup**: Android phone, Settings → System → Gestures → System navigation
→ Gesture navigation. Open any chat room.

**Steps**:
1. Open a chat room with the keyboard closed. Observe composer position.
2. Tap the message input to open the keyboard.
3. Type a message, send it.
4. Dismiss the keyboard (back gesture / tap outside).
5. Repeat steps 2–4 five times in a row, quickly.
6. Open the emoji picker (if present) and attachment picker from the
   composer, close each.
7. Rotate the device to landscape and back with the keyboard open, then closed.

**Expected**: Composer is always fully visible and tappable — never behind
the gesture pill, never covered by the keyboard, no blank gap, no visible
jump/flicker on open or close.

**Failure symptoms**: Composer renders partially or fully below the
gesture-nav pill; send button not tappable without first scrolling/
dismissing something; a blank strip appears between the message list and
composer after closing the keyboard; composer height "jumps" twice instead
of animating once.

**Evidence**: Screen recording of steps 2–5 (the intermittent bug this
fix targets needs several repetitions to catch). Screenshot of any bad
state immediately on reproduction.

## 2. Composer positioning — Android 3-button navigation

**Setup**: Same phone, switch Settings → System navigation → 3-button
navigation. Repeat test 1, steps 1–7.

**Expected / Failure symptoms / Evidence**: Same as test 1. This is a
separate pass because the system nav bar's height/behavior differs from
gesture navigation — a fix verified only under gesture nav is not verified
under 3-button nav.

## 3. Keyboard + safe-area — iOS

**Setup**: iPhone, any model with a home indicator (safe-area bottom
inset > 0, e.g. iPhone 12 or later).

**Steps**: Repeat test 1's steps 1–7 (skip the Android-specific nav-mode
framing).

**Expected**: Composer sits immediately above the keyboard when open, and
immediately above the home indicator when closed — never overlapping the
indicator, never leaving a gap.

**Failure symptoms**: Composer overlaps the home-indicator swipe-up area;
gap appears above the composer when the keyboard closes.

**Evidence**: Screen recording, both orientations.

---

## 4. Screen sharing — voice call

**Setup**: Two devices (A, B) in a 1:1 voice call.

**Steps**:
1. A taps "Share Screen", grants the OS permission.
2. B observes their screen.
3. A navigates around their home screen / opens another app briefly.
4. A taps "Stop Sharing".

**Expected**: B sees A's actual screen content within a few seconds of A
granting permission, updating live as A navigates. After stop, B's view
reverts to A's normal voice-call tile (no video) with no leftover frozen
frame. A's own "Sharing" indicator clears on both start and stop.

**Failure symptoms**: B sees nothing, a black tile, or a frozen single
frame instead of live updates (this is the exact bug this round fixed —
confirm it's actually resolved, not just locally-previewing on A's side).
B still shows A as "sharing" after A stopped.

**Evidence**: Screen recording on B's device showing A's live screen
content changing in real time, plus a recording of the stop transition.

## 5. Screen sharing — video call

Repeat test 4 in a 1:1 **video** call. Additionally confirm: A's own
camera tile remains visible to B in a secondary/small position while the
shared screen occupies the main area (per the required layout), and
switching back from screen-share to camera restores A's live camera feed
to B (not a frozen frame).

## 6. Screen sharing — voice-group and video-group calls

Repeat with **3+ participants** (enough to realistically test group
behavior; if your test account population is small, repeat once at a
size below the SFU participant-count upgrade threshold and once above it
if you can gather enough devices/accounts — ask the maintainer for the
current `SFU_THRESHOLD` value if you need to target this precisely).

**Steps**: One participant (A) shares. All other participants (B, C, …)
must independently confirm they see the live share — not just the
loudest/most-active one.

**Expected**: Every other participant sees the share, regardless of
whether the call is still on the peer-mesh path or has upgraded to the
SFU.

**Failure symptoms**: Some participants see it, others don't (would
indicate the P2P-vs-SFU dual path isn't both working); the sharer's own
tile shows "sharing" but nobody else's screen updates.

## 7. Screen sharing — broadcast calls

Repeat test 4/5's basic start/stop flow in a broadcast-type call with at
least one presenter and one viewer-only participant. Confirm the viewer
sees the shared screen as the primary content area.

## 8. Third participant joins mid-share

**Setup**: A voice-group or video-group call with A and B already
connected; A is actively sharing their screen.

**Steps**: C joins the call while A's share is still active.

**Expected**: C sees A's shared screen **immediately on joining** — not
only after some unrelated renegotiation event later in the call.

**Failure symptoms**: C sees A's camera (or nothing) until A toggles
sharing off and on again.

**Evidence**: Screen recording of C's device from the moment of joining.

## 9. Screen-share ownership conflict and recovery

This specifically exercises this round's ack-based ownership fix.

**Steps**:
1. A starts sharing in a group call with A, B, C.
2. While A is still sharing, B attempts to start sharing.
3. B stops trying; A stops sharing.
4. B now attempts to start sharing — should succeed.
5. **Simultaneous attempt**: with A and B both on the "Share Screen"
   button, have both tap it as close to the same instant as you can
   manage (two testers counting down together, or one device automated
   with a tap macro if available).
6. **Disconnect recovery**: A starts sharing, then force-backgrounds the
   app (or turns on airplane mode) for at least 60 seconds without
   explicitly stopping the share or leaving the call, so the server-side
   disconnect-grace period (45s) expires. Confirm B can now start sharing.

**Expected**:
- Step 2: B sees a clear "Someone else is already sharing" message and
  B's own screen never appears to start sharing (no flash of a local
  preview that then reverts).
- Step 4: B's share starts normally.
- Step 5: Exactly one of A/B ends up sharing; the other sees the same
  clear rejection message. Nobody's screen silently colliates/flickers
  between two different shared sources.
- Step 6: After the grace period, B can share successfully — the lock
  does not stay held by A's now-disconnected device forever.

**Failure symptoms**: B's UI briefly shows "sharing" before reverting
with no explanation; the rejection message never appears; after step 6,
B's attempt is rejected indefinitely ("Someone else is already sharing")
even though A is genuinely gone.

**Evidence**: Screen recording of B's device for steps 2 and 5 (showing
the rejection alert text), and of B's device for step 6 (showing the
previously-blocked share now succeeding).

---

## 10. E2EE recovery after fresh install

This exercises this program's encryption fix (the bad-MAC session-recovery
placeholder) and general multi-device key behavior.

**Setup**: Two accounts/devices (A, B) with existing message history
between them.

**Steps**:
1. A and B exchange a few messages normally; confirm both read them.
2. Fully uninstall and reinstall the app on device A (or use a second
   physical/simulator device logged into the same account as a fresh
   "device" if uninstall/reinstall isn't practical) — this forces a brand
   new local Signal identity/session for A.
3. B sends a new message to A.
4. A sends a new message to B.
5. Scroll both A's and B's chat history.

**Expected**: Step 3's message either decrypts normally on A once the new
device's keys are published, or — if it genuinely can't (a real,
expected cryptographic limitation if B's device still has a stale session
for old-A) — displays the honest **"🔒 This message could not be
decrypted. Ask them to send it again."** placeholder, not a permanent raw
"Encrypted message" with no explanation. Step 4's message must decrypt
normally on B. Step 5's historical messages (sent/received before the
reinstall) remain readable on both sides.

**Failure symptoms**: A message stays showing raw ciphertext or
"Encrypted message" indefinitely with no placeholder and no recovery even
after both sides send follow-up messages; historical messages from before
the reinstall become unreadable (would indicate the fix broke backward
compatibility — report this as a regression immediately, it must not
happen).

**Evidence**: Screenshots of the chat screen on both devices after each
step, specifically capturing either successful decryption or the honest
placeholder text (not a technical error, not raw ciphertext).

---

## 11. Android Picture-in-Picture (video call)

**Setup**: Android phone, active video call.

**Steps**:
1. During an active video call, press the Home button (or swipe to
   switch apps).
2. Observe whether a floating PiP video window appears.
3. Move the PiP window around the screen.
4. Open another app while PiP is active.
5. Tap the PiP window to return to the full call screen.
6. From the full call screen, end the call.

**Expected**: Step 2 — native Android PiP window appears automatically,
showing the remote participant's live video, continuing to update. Step 3
— window is draggable per standard Android PiP behavior. Step 5 — tapping
restores the full KIS call UI with controls. Step 6 — call ends cleanly,
PiP window disappears, no orphaned notification.

**Failure symptoms**: Call disconnects/ends the moment Home is pressed
(the core bug this round targeted); PiP window appears but shows a frozen
frame instead of live video; PiP window never appears at all (check
whether the one-time Android "allow KIS to manage calls" phone-account
permission was ever accepted — see test 14 below, this is a prerequisite
not a bug).

**Evidence**: Screen recording from pressing Home through returning to
the full call screen.

## 12. iOS Picture-in-Picture (video call)

Repeat test 11's steps on iPhone. Note iOS's PiP model differs
natively (`AVPictureInPictureController`) from Android's Activity-level
PiP — do not assume a pass on Android implies a pass on iOS.

**Failure symptoms specific to iOS**: the call UI simply disappears with
no floating window at all when backgrounding (vs. Android's "call ends"
failure mode) would indicate iOS PiP integration is incomplete, not that
the call itself terminated — note which of the two you actually observe,
they're different bugs.

## 13. Background audio (voice call)

**Setup**: Either platform, active voice-only call.

**Steps**:
1. Press Home / switch to another app during an active voice call.
2. Speak into the device and confirm the other participant hears you.
3. Have the other participant speak and confirm you hear them through
   whatever background-audio UI your platform provides (lock-screen call
   controls, persistent notification, etc.).
4. Return to KIS and confirm the call screen shows the still-active call,
   not a reconnecting/ended state.

**Expected**: Audio flows both directions the entire time the app is
backgrounded; returning to the app shows the call exactly as it was, not
reconnected-from-scratch.

**Failure symptoms**: Audio cuts out the moment the app backgrounds; the
call shows as ended/missed when you return even though it was never
actually hung up.

**Evidence**: A short recording/description of what each participant
heard during backgrounding, and a screenshot of the call screen state
immediately after returning to the foreground.

## 14. Device locking and unlocking during a call

**Steps**:
1. During an active voice call, lock the device (power button). Confirm
   audio continues.
2. Unlock. Confirm the call is still active and controls work.
3. Repeat for a video call — lock, then unlock, and check whether video
   resumes or an appropriate OS-level privacy restriction (no camera while
   locked) was correctly respected rather than crashing or silently
   breaking the call.

**Expected**: Voice continues through a lock/unlock cycle without
interruption. Video calls preserve the call session through lock/unlock;
camera behavior while actually locked should follow whatever the OS
permits (test 14 is about the call *surviving*, not about defeating a
genuine OS camera-while-locked restriction).

**Failure symptoms**: Call ends on lock; call is "active" after unlock but
audio/video never actually resumes (stuck state).

## 15. Call continuity through 30–60 seconds of backgrounding

This specifically exercises this round's 45-second disconnect-grace fix.

**Steps**:
1. Start a call between A and B.
2. Background A's app (Home button, do not force-quit) for roughly 40
   seconds — timed with a stopwatch, deliberately inside the new 45s grace
   window.
3. Bring A back to the foreground.
4. Repeat, this time backgrounding for roughly 50–60 seconds — deliberately
   near/past the 45s window — and observe what happens at both the 45s
   mark and on return.

**Expected**: Step 3 — call is still fully active on both A and B's side,
no "participant left" notification was shown to B during the 40s window.
Step 4 — behavior at the boundary may vary (a connection that's still
alive but merely slow to reconnect could still recover via `call.sync`);
record exactly what you observe rather than assuming pass/fail, since this
is a timing boundary rather than a hard guarantee.

**Failure symptoms**: B sees A marked as having left the call well before
40 seconds of backgrounding has elapsed.

**Evidence**: A stopwatch-timed recording or written timestamp log of
when A backgrounded, when (if ever) B saw a "left" state, and when A
returned.

## 16. Android ConnectionService phone-account approval

This is a one-time platform prerequisite, not a bug by itself, but every
other Android call/PiP/background test depends on it being correctly
accepted — a tester who never did this will see failures that look like
regressions but are actually just this step being skipped.

**Steps**:
1. On a **fresh** Android install (or Settings → Apps → KIS → Phone
   accounts, to check current state), place or receive the first KIS
   call.
2. Watch for a system prompt asking to allow KIS to manage calls /
   register a calling account.
3. Accept it.
4. Verify via Settings → Apps → Calling accounts (path varies by Android
   version/OEM) that KIS's calling account shows as enabled.

**Expected**: The prompt appears on first use and, once accepted, every
subsequent call/PiP/background test in this document behaves as described
above.

**Failure symptoms**: The prompt never appears, or was dismissed
("Not now") — in this state, native ringing, PiP, and backgrounding
protection will all silently fail in a way that looks identical to a code
regression. Before filing a bug from any Android test above, re-check
this setting first.

**Evidence**: Screenshot of the Calling-accounts settings screen showing
KIS enabled.

---

## Reporting results

For each test, record: device model + OS version, pass/fail, and the
evidence described above. If a test fails, note which specific step
failed and attach the recording/screenshot — "screen sharing doesn't
work" is not actionable; "on test 6 (video-group, 4 participants), C's
device never rendered A's shared screen but B's did" is.
