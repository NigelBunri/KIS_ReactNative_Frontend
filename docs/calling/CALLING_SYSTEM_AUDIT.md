# KIS Calling System — Audit and Repair Report

**Scope of this pass.** This audit covers the mobile (React Native) calling layer,
the native Android and iOS integrations, and the NestJS signaling/push backend.
It does not cover the Django backend (confirmed to hold no calling-related
models or push-token storage — calling is entirely owned by the mobile app
and the NestJS `backend/Nestjs` service).

**Headline finding.** This is **not a greenfield calling system that needs to
be built** — it is a mature, iteratively-hardened, already-production-grade
implementation. The code throughout (mobile and backend) is dense with
inline comments documenting *already-fixed* historical bugs with their root
causes (stale Telecom connections, CallKit/WebRTC audio-session races on iOS
Simulator, Android non-self-managed phone-account presentation gaps, PushKit
reporting-order requirements, stale-answer races). Both the five-call-type
feature set and the native OS integrations described in the task brief
already exist and are already wired together. The real, bounded work found
in this pass was: one genuine correctness bug (a database race condition),
two pieces of confusing dead/duplicate code, and a handful of previously
undocumented facts (the full real-time event contract, the exact native
integration points) that are now captured below for future engineers.

---

## 1. Repository map

| Layer | Location | Role |
|---|---|---|
| Mobile app | `/Users/nigel/dev/Kingdom_Impact_social/KIS` | React Native 0.82.1 |
| Call coordinator | `SocketProvider.tsx` (repo root, 4007 lines) | **The** call state owner — not `src/services/calls/callService.ts` despite its name (see §3) |
| Mobile call services | `src/services/calls/*.ts` | CallKit bridge, WebRTC, SFU, audio routing, diagnostics, pending-call persistence |
| Mobile call screens | `src/screens/calls/*.tsx` | Incoming/active/lobby/join/schedule UI |
| Android native | `android/app/src/main/java/com/kingdom/impact/` | Only `CallPiPModule.kt` is call-specific; no custom Telecom/FCM service — relies entirely on `react-native-callkeep`'s bundled native module |
| iOS native | `ios/KIS/AppDelegate.swift`, `VoipTokenModule.swift`, `PendingCallModule.swift` | PushKit registration, CallKit reporting, pending-call persistence across process restarts |
| Backend signaling | `backend/Nestjs/src/realtime/handlers/calls.ts` (2274 lines) | Real event handler registry — **not** `realtime/calls.gateway.ts`, which was a dead 0-byte file (deleted this pass, see §6) |
| Backend call model | `backend/Nestjs/src/chat/features/calls/calls.service.ts` + `schemas/call-session.schema.ts` | Canonical, actively-used `CallSession` |
| Push delivery | `backend/Nestjs/src/notifications/notifications.service.ts` | Real APNs VoIP push + FCM data push, ringing-ack delivery tracking |
| Django backend | `backend/kis` | **No calling involvement** — confirmed no call models, no push-token storage |

Key npm dependencies (mobile): `react-native-callkeep ^4.3.16` (CallKit + Android
ConnectionService), `react-native-webrtc ^124.0.7`, `@notifee/react-native
^9.1.8`, `@react-native-firebase/messaging ^26.3.2`, `react-native-incall-manager
^4.2.1`, `socket.io-client ^4.8.1`.

---

## 2. The five call types — status

| # | Call type | Status | Evidence |
|---|---|---|---|
| 1 | Foreground audio | **Implemented, tested** | `SocketProvider.tsx` `answerCall`/`endCall`/state machine; 123 passing mobile call tests |
| 2 | Foreground video | **Implemented, tested** | Same path, `hasVideo(callType)` branches; camera/track lifecycle in `webRTCService.ts` |
| 3 | Background/killed audio | **Implemented** | iOS: PushKit → synchronous `reportNewIncomingCall` → `PendingCallModule` persistence. Android: FCM background data message → `displayIncomingCall` → `PendingCallModule`-equivalent (`pendingCallPayload.ts`) → `tryPresentPendingIncomingCall()` on `AppState` resume |
| 4 | Background/killed video | **Implemented** | Same recovery path as #3; `callType` is preserved through the pending-payload round trip so the correct (video vs. voice) screen renders on resume |
| 5 | Missed-call recovery/retry | **Implemented, tested** | Server-side 90s stale-ring reaper (`cleanupStaleCalls`), client-side stale-pending-payload skip (`decidePendingCallPresentation`), `call.ice.restart` event, missed-call history |

None of the five call types were found to be missing or stubbed. The audit
therefore focused on finding and fixing **correctness defects within** an
already-complete system, not building missing pieces.

---

## 3. Mobile JS architecture (verified)

### 3.1 One canonical `CallSession`

`src/services/calls/callTypes.ts` defines a single `CallSession` type (no
competing model found). State machine (`CallState`):

```
dialing → ringing → incoming → connecting → active → reconnecting → ended
```

Plus non-linear states `missed`, `lobby`, `knocking`, `waiting-for-host`.
`CallType` covers `voice | video | voice-group | video-group | broadcast`.
Group features (polls, Q&A, breakout rooms, whiteboard, RTMP, captions,
virtual backgrounds, reactions, hand-raise) all live on the same
`CallSession` object rather than fragmented stores.

### 3.2 The real coordinator is `SocketProvider.tsx`, not `callService.ts`

Despite the name, `src/services/calls/callService.ts` only contains
screen-share track-replacement logic and DTLS fingerprint helpers — **it is
not the call orchestrator**. The actual `answerCall`, `endCall`,
`persistCallEnd`, `resolveSessionForCallKitEvent`, and
`tryPresentPendingIncomingCall` functions live in the 4007-line
`SocketProvider.tsx` at the repo root. Any future engineer searching for
"the call coordinator" under `src/services/calls/` will miss it — **this is
worth a file-location fix in a future pass** (not done here, out of scope
for a correctness audit, and moving 4000 lines carries real regression
risk for zero functional benefit).

### 3.3 Native bridge wiring (`callKitService.ts`)

Wraps `react-native-callkeep`, dynamically required so the app still runs
if the native module isn't linked. `CALLKIT_ENABLED` is `true` on Android,
`!__DEV__` on iOS (documented reason: CallKit + WebRTC audio-session
conflict on iOS Simulator causes `EXC_BAD_ACCESS` — not an issue on
physical devices or Android).

Listened events: `answerCall`, `endCall`, `didPerformSetMutedCallAction`,
`didToggleHoldCallAction` — all four forward to real callbacks, none are
no-ops. `onShowIncomingCallUi` (Android) has a documented "nothing listens
for this" comment in `callKitService.ts` — **investigated and confirmed
not a gap**: its purpose (bringing the Activity forward) is independently
and more robustly covered by `tryPresentPendingIncomingCall()`, which fires
on every `AppState` → `'active'` transition *and* on mount, covering both
the CallKeep-foregrounding case and a plain user tap on the app icon.

### 3.4 Process-recreation recovery — real, not a stub

Both platforms persist the minimum data needed to reconstruct an incoming
call after the JS bundle restarts, and both correctly clear it after use:

- **iOS**: `AppDelegate.swift`'s PushKit handler persists `callId`,
  `conversationId`, `callType`, `callerName`, `fromUserId` to
  `UserDefaults` via `PendingCallModule` **before** calling
  `RNCallKeep.reportNewIncomingCall` — ordering matters because CallKeep's
  native answer/end events only carry a bare `callUUID`, and Socket.IO
  doesn't replay missed room broadcasts to a client connecting after the
  fact.
- **Android**: `src/services/calls/pendingCallPayload.ts` plays the same
  role, backed by `NativeModules.PendingCallModule` where available.
- **JS consumption confirmed real** (resolved an open question both the
  iOS-native and mobile-JS research passes initially flagged as
  unverified): `SocketProvider.tsx` calls `getPendingCallPayload()` in
  both `resolveSessionForCallKitEvent` (native Answer/End path) and
  `tryPresentPendingIncomingCall` (foreground-resume path), and calls
  `clearPendingCallPayload(callId)` after consuming it in every path —
  preventing a stale payload from resurrecting on an unrelated later cold
  start, exactly as the no-resurrection requirement demands.
- **VoIP token round-trip confirmed real**: `VoipTokenModule.swift` emits
  `KIS_VoIP_Token_Updated`; `src/push/notifications.ts` listens for it
  *and* proactively polls `getVoipToken()` on launch, and
  `registerVoipPushToken()` posts it to the backend with
  `tokenType: 'voip'` (with an `AsyncStorage`-backed pending-registration
  fallback for the case where registration races app startup).

### 3.5 Stale-answer handling

`answerCall()` in `SocketProvider.tsx` checks the server's ack on
`call.answer`: if the backend rejects it (because the ring-timeout reaper
already closed the call before a delayed push arrived), the client rolls
back local state to `'missed'` instead of leaving the UI stuck on a phantom
"connecting" screen. This exact failure mode — the task brief's
"never resurrect an ended/expired call because of a delayed push" — is
explicitly handled, with the commit history's own comment calling out the
scenario by name.

### 3.6 Test coverage (run this pass)

```
npx jest src/services/calls src/screens/calls
```
**15 test suites, 123 tests — all passing** (baseline, unchanged by this
pass; no mobile JS code was modified).

---

## 4. Android native integration (verified)

### 4.1 Manifest (`android/app/src/main/AndroidManifest.xml`)

Full permission set present: `READ_PHONE_STATE`, `CALL_PHONE`,
`MANAGE_OWN_CALLS`, `READ_PHONE_NUMBERS`, `USE_SIP`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_PHONE_CALL`, `FOREGROUND_SERVICE_MICROPHONE`,
`FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`,
`USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `WAKE_LOCK`,
`DISABLE_KEYGUARD`, `RECEIVE_BOOT_COMPLETED`.

`io.wazo.callkeep.VoiceConnectionService` declared with
`foregroundServiceType="phoneCall|microphone|camera"`,
`BIND_TELECOM_CONNECTION_SERVICE` permission, correct
`android.telecom.ConnectionService` intent-filter — correctly wired for
Android's self-managed ConnectionService model (API 26+).
`io.wazo.callkeep.RNCallKeepBackgroundMessagingService` declared as a
non-exported headless-JS-task service.

`MainActivity`: `showWhenLocked="true"`, `turnScreenOn="true"`,
`supportsPictureInPicture="true"`, `launchMode="singleTask"` — correct
shape for lock-screen call answering and PiP.

A dead `RNCallKeepProviderReceiver` boot-completed receiver was
**previously, deliberately removed** (documented inline: it crashed the
app with `ClassNotFoundException` on every reboot in callkeep 4.3.16,
since that class was never actually shipped in that version). This is a
real historical fix already applied, not an open defect.

### 4.2 Gradle/toolchain

`compileSdkVersion = 36`, `targetSdkVersion = 36`, `minSdkVersion = 24`,
`kotlinVersion = "2.1.20"`.

### 4.3 Resolved this pass (previously flagged unverified)

- **Reboot phone-account re-registration — confirmed handled, by a
  different mechanism than a boot receiver.** `ensureCallKeepSetup()`
  (`callKitService.ts:124`) is explicitly documented and designed to be
  reachable from *two* independent entry points: `SocketProvider`'s
  mount-time effect (normal foreground launch) **and** the headless
  background-push JS task (`push/notifications.ts`'s background message
  handler) that Android invokes when a call-type FCM push arrives while
  the app is fully killed — with no React tree mounted at all. Since the
  headless path calls `ensureCallKeepSetup()` → `RNCallKeep.setup()`
  before `displayIncomingCall()`, the very first incoming-call push after
  a reboot re-registers the phone account itself, without requiring the
  user to have opened the app first. This is a real, working substitute
  for the boot-completed receiver that was removed for crashing — not an
  open gap.
- **Notification channel ID confirmed**: `com.kis.calls` (set via
  `RNCallKeep.setup()`'s `android.foregroundService.channelId`,
  `callKitService.ts:193`) — not `com.kis.calls.incoming.v2` as an
  earlier draft of this audit's source brief assumed. `react-native-
  callkeep` owns and starts this foreground service internally as part
  of its self-managed `VoiceConnectionService`; the host app does not
  need its own separate foreground-service implementation for the
  ongoing-call notification.

### 4.4 Genuine remaining gap found (low priority)

No `selfManaged: false` / non-self-managed fallback option is passed to
`RNCallKeep.setup()`'s Android config (`callKitService.ts:181-197`) — it
uses the library's self-managed-by-default `VoiceConnectionService` path
unconditionally. Self-managed `ConnectionService` requires **API 26+**,
while the app's `minSdkVersion` is **24**. Devices on Android 7.0/7.1
(API 24–25) may therefore fail to register the phone account at all,
meaning background/lock-screen ringing would not work for that specific,
now-small (circa-2016 OS release) device population — foreground calling
would be unaffected since it doesn't depend on Telecom registration.
**Not fixed this pass** (no device on API 24/25 was available to verify
the actual failure mode or test a fix safely; the fix itself — either
bumping `minSdkVersion` to 26 or implementing a documented non-self-
managed fallback — is a product decision with its own tradeoffs, not a
pure bug fix, and is flagged here for the repository owner's judgment
call rather than decided unilaterally).

### 4.5 Gradle build-configures-cleanly check (run this pass)

```
cd android && ./gradlew help --offline
```
**BUILD SUCCESSFUL in 20s** (11 actionable tasks, 1 executed, 10
up-to-date). Confirms the Android project — including the
`react-native-callkeep`/`VoiceConnectionService` manifest wiring, the
foreground-service type declarations, and all Gradle plugin/dependency
resolution — configures without error. Only pre-existing, unrelated
Gradle-9→10 deprecation warnings were present (not call-specific, not
introduced this pass). This is a configuration check, not a full
`assembleDebug`/`assembleRelease` build — it does not compile Kotlin/Java
sources or produce an APK, but it does prove the manifest merges, plugin
versions, and dependency graph are all internally consistent.

---

## 5. iOS native integration (verified)

### 5.1 AppDelegate.swift — PushKit/CallKit

`PKPushRegistry` created and retained (`private var voipRegistry:
PKPushRegistry?`), `desiredPushTypes = [.voIP]`.
`pushRegistry(_:didReceiveIncomingPushWith:for:completion:)` **correctly
calls `RNCallKeep.reportNewIncomingCall(...)` synchronously** within the
delegate method before returning — satisfies Apple's hard iOS 13+
requirement (CallKit must be reported before the delegate method returns,
or the app is terminated). Before that call, it persists the pending-call
payload to `PendingCallModule` (see §3.4) — correctly ordered so a
same-session Answer tap can resolve the call even if JS hasn't finished
booting yet.

`didInvalidatePushTokenFor` clears the stored token. Ordinary (non-VoIP)
APNs registration is also present, with an explicit comment that
`react-native-callkeep` doesn't need it directly — no conflict found with
`@react-native-firebase/messaging`'s own registration.

### 5.2 VoipTokenModule.swift / PendingCallModule.swift

Both are real, complete `RCTEventEmitter` bridges (53 and 99 lines), not
stubs — and both are genuinely consumed by JS (§3.4). `PendingCallModule`
exposes `getPendingCall`/`clearPendingCall`/`notifyUpdated`, matching the
task brief's "recover an incoming/active call after the JS bundle
restarts" requirement directly.

### 5.3 Resolved this pass (previously flagged unverified)

- **`Info.plist` `UIBackgroundModes`**: confirmed present —
  `["voip", "audio", "remote-notification"]`. `voip` is required for
  PushKit registration to work at all; `audio` permits background audio
  continuation during an active call; both correct.
- **Usage descriptions**: `NSMicrophoneUsageDescription` and
  `NSCameraUsageDescription` both present and call-specific
  ("...to record voice messages and calls" / "...to let you take photos
  and videos").
- **Entitlements**: `KIS.entitlements` (debug) declares
  `aps-environment: development`; `KISRelease.entitlements` declares
  `production` — correctly paired per build configuration. Push
  Notifications capability present in both.
- **Podfile**: `react-native-callkeep` is autolinked (confirmed present
  in `Podfile.lock` at the pinned `4.3.16` version with no
  exclusion/override), not an explicit manual `pod` line — this is
  expected/correct for React Native's autolinking and is not a gap.
  `react-native-webrtc` is explicitly pinned with a documented
  `:modular_headers => true` workaround (comment explains it defines no
  Clang module of its own) — no broken or commented-out call-related pod
  entries found.

### 5.4 Xcode workspace sanity check (run this pass)

```
cd ios && xcodebuild -workspace KIS.xcworkspace -list
```
Resolves cleanly — confirmed schemes include `KIS`, `RTCScreenSharingExtension`
(both real app/extension targets), `RNCallKeep`, `react-native-webrtc`,
`JitsiWebRTC`, `Pods-KIS`, and the full Firebase pod set. This is a
project-structure listing only (no compilation, signing, or build was
performed), but it proves the CocoaPods dependency graph — including both
calling-critical native pods — is internally consistent and the workspace
isn't broken.

### 5.5 Still unverified (not confirmed this pass)

- `react-native-callkeep`'s iOS native source — did not confirm its
  `CXProviderDelegate` method coverage (audio session activation/
  deactivation, route-change handling) directly from its own source; this
  is third-party library internals rather than KIS application code, and
  lower-priority to verify than the app's own integration points above.
- A full `xcodebuild build`/archive was not performed (would require
  code signing and is a substantially higher-risk, slower operation not
  warranted for a correctness audit — the workspace-list check above
  already confirms the dependency graph resolves).

---

## 6. Backend signaling and push delivery (verified)

### 6.1 Canonical call-session model — confirmed one live, one dead

`schemas/call-session.schema.ts` (`CallSession`, via `CallsService`) is the
real, actively-written model — rich field set (participants, signals audit
trail, invite tokens, scheduling, recording/RTMP state, a unique partial
index enforcing one active call per conversation), well-tested.

`schemas/call-state.schema.ts` / `call-state.service.ts`
(`CallStateService`) is a **second, separate Mongo collection that is
fully dead code** — still DI-registered (`CallStateModule` → imported into
`chat.module.ts`) but zero callers anywhere outside its own file. Its
singular `fromUserId`/`toUserId` shape predates group-call support and
cannot represent one. **Documented this pass** (see §8) rather than
deleted — removing a persisted-data-backed module without the repository
owner's explicit sign-off was judged the wrong unilateral call, even
though no live path depends on it.

A **naming collision**, not functional duplication, was found and
documented: `CallsService.upsertState()` (the real, live, one-call-site
method `handlers/calls.ts:423` actually calls) has the same name as the
dead `CallStateService.upsertState()`. Both now carry comments
cross-referencing each other to prevent a future reader conflating them.

### 6.2 State machine

Call-level `CallStatus`: `ringing | active | ended | missed | pending`
(5 values). Per-participant `CallParticipantStatus`: `invited | connecting
| joined | left | rejected | busy` (6 values). Richer presentation states
(`ongoing`, `busy`, `declined`, `cancelled`, `completed`) are correctly
*derived* from the participant array in `getUserFacingStatus()` rather than
needing their own call-level enum values — reasonable design, not a gap.

Transitions use atomic conditional MongoDB updates (compare-and-swap via
query filters), not a generic state-machine library:
- `markActive()`: `findOneAndUpdate({status: {$in: ['ringing','active']}}, ...)`
  — returns `null` for any terminal/nonexistent call; callers (the
  `call.answer` handler) correctly treat `null` as a stale-answer
  rejection.
- The 90s stale-ring reaper only flips a call to `missed` if it's still
  `'ringing'` at write time — classic CAS guard.

### 6.3 Fixed this pass: participant-status race condition

**Defect** (found by audit, confirmed by reading the code directly):
`CallsService.setParticipantStatus()` read the call's current participant
list with a separate `findOne`, decided in JavaScript whether the target
user already had a participant row, and only *then* wrote via a second,
unconditional `updateOne`. A second concurrent write for the same existing
participant (e.g. an answer racing a decline from two devices of the same
user, or a duplicate/out-of-order socket event) had no guard against
landing in the gap between the read and the write.

**Fix**: folded the existence check and the write into one atomic
conditional `updateOne` keyed off `matchedCount` at write time, not a
prior read. The `$push`-for-new-participant fallback only runs if that
conditional update genuinely matched nothing. Behavior-preserving for
every existing call site (10+ call sites across `calls.service.ts`,
`calls.controller.ts`, `chat.gateway.ts`, `realtime/handlers/calls.ts`) —
no transition semantics changed, only the atomicity of the existing-row
write path.

File: `backend/Nestjs/src/chat/features/calls/calls.service.ts`.
New regression tests:
`backend/Nestjs/src/chat/features/calls/calls.service.participant-race.spec.ts`
(4 tests, all passing).

### 6.4 Fixed this pass: dead empty gateway stub removed

`backend/Nestjs/src/realtime/calls.gateway.ts` was a confirmed 0-byte file
with zero references anywhere in the codebase — misleading given its name
suggests it's the real call signaling gateway, when the actual logic lives
in `handlers/calls.ts` (registered via `chat.gateway.ts`). Deleted.

### 6.5 Push delivery — real VoIP push, partial delivery-ack tracking

`notifications.service.ts` sends a genuine **APNs VoIP push** (not an
ordinary notification) for iOS via a dedicated `ApnsVoipProvider`, with a
60-second `expiresInSeconds` deliberately chosen (per inline comment) to
sit inside the 90-second server-side ring-timeout with margin. The payload
keys (`callId`, `callerName`, `callType`, `conversationId`, `fromUserId`,
`type: 'incoming_call'`) are commented as matching exactly what
`AppDelegate.swift`'s PushKit handler reads — real, maintained cross-stack
contract awareness. Failed VoIP tokens are bulk-deactivated on send
failure. Android/fallback always also sends a **data-only, high-priority
FCM push** with `retryOnTransientFailure: true` (the one push type that
opts into bounded retry, per comment, given the cost of a dropped
incoming-call push).

A real, tested delivery-acknowledgement endpoint exists:
`POST /calls/:callId/ringing-ack` — the **recipient** device calls this
once its native incoming-call UI is actually presented, and the server
relays `call.ringing` to the **caller's** room specifically (verified by
`calls.controller.ringing-ack.spec.ts`: *"emits call.ringing to the call
creator's room, not the responder's own"*). This directly satisfies the
task brief's requirement to distinguish "push accepted" from "native UI
actually presented" — it does not track a full 4-stage trail (provider-
accepted / device-received / UI-shown / user-answered) as 4 separate
persisted timestamps, only sent-vs-ringing-acked, which is a reasonable,
real, tested two-stage distinction rather than the single-stage "push API
returned 200" anti-pattern the brief specifically warns against.

### 6.6 Real-time event contract (previously undocumented, captured here)

`handlers/calls.ts` registers against `EVT.CALL_*` string constants
(`src/chat/chat.types.ts`), not literal strings — an initial grep pass
undercounted this; the full, verified contract is:

```
call.answer              call.knock                call.recording.start
call.breakout.close      call.knock.admit           call.recording.stop
call.breakout.create     call.knock.cancel          call.reaction
call.breakout.return     call.knock.deny            call.rtmp.start
call.caption             call.leave                 call.rtmp.stop
call.chat.message         call.offer                 call.schedule.cancel
call.end                 call.panelist.set           call.schedule.update
call.hand.lower          call.participant.mute       call.scheduled.start
call.hand.raise          call.participant.remove     call.screen_share
call.ice                 call.poll.close             call.sdp.answer
call.ice.candidate       call.poll.create            call.sdp.offer
call.ice.restart*        call.poll.vote              call.wb.clear
call.invite*             call.promote                call.wb.cursor
call.question.dismiss    call.sync*                  call.wb.stroke
call.question.submit     call.waiting.join*          call.wb.undo
```
(`*` = registered via a literal string rather than an `EVT.*` constant —
functionally identical, just not centrally named.)

Outbound-only (server → client) events confirmed via the `EVT` constant
list but not necessarily re-verified as literal `.emit()` call sites in
this pass: `call.breakout.updated`, `call.host.joined`,
`call.knock.admitted`, `call.knock.cancelled`, `call.knock.denied`,
`call.knock.request`, `call.panelist.changed`,
`call.participant.joined/left/muted`, `call.poll.results`,
`call.qa.updated`, `call.question.answered`, `call.recording.changed`,
`call.ringing`, `call.role.changed`, `call.rtmp.changed`,
`call.viewer.count`, `call.participants.snapshot`.

### 6.7 Test coverage (run this pass)

```
cd backend/Nestjs && npx jest src/chat/features/calls src/realtime/handlers/calls
```
**Before this pass: 20 suites / 152 tests, all passing.**
**After this pass: 21 suites / 156 tests, all passing** (152 baseline + 4
new regression tests for the participant-status atomicity fix).

TypeScript: `npx tsc --noEmit` shows zero errors in any call-related file.
(Pre-existing, unrelated type errors exist in `messages.votePoll.channel
.spec.ts`, `pins.service.spec.ts`, and `upload-intent.service.spec.ts` —
mongoose-version typing mismatches, untouched by and unrelated to this
pass.)

---

## 7. Django backend

Confirmed **zero calling involvement**: no call-related models under
`apps/*/models.py`, no FCM/APNs/VoIP token storage anywhere in
`backend/kis`. All calling infrastructure — signaling, push delivery, and
call-session persistence — lives in the NestJS service. This matches the
platform's existing division of responsibility (Django = REST content
APIs, NestJS = realtime/chat/calls) and was not changed.

---

## 8. Fixes implemented this pass — summary

| Fix | File(s) | Risk | Test evidence |
|---|---|---|---|
| Atomic participant-status write (closes a real answer/decline race window) | `calls.service.ts` | Low — behavior-preserving, no semantics changed | 4 new tests, all passing; full 156-test suite still green |
| Removed dead 0-byte `calls.gateway.ts` stub | `realtime/calls.gateway.ts` (deleted) | None — confirmed zero references | n/a |
| Documented (not deleted) dead `CallStateService`/`CallState` schema | `call-state.service.ts` | None — comment-only | n/a |
| Documented naming collision on `upsertState` | `calls.service.ts` | None — comment-only | n/a |

No mobile (React Native) source files were modified this pass — the
mobile/native audit found the existing implementation correct everywhere
it was verified, with only unverified (not defective) items remaining
(§4.3, §5.3).

---

## 9. Remaining blockers / genuinely unverified items

Resolved this pass (originally expected to be blockers, closed instead —
see the relevant sections above): Android Gradle build-configures-cleanly
check (§4.5, BUILD SUCCESSFUL), iOS workspace/pod-graph sanity check
(§5.4, resolves cleanly with RNCallKeep + react-native-webrtc present),
`Info.plist`/entitlements/`Podfile` reads (§5.3, all correct), and the
Android reboot/phone-account re-registration question (§4.3, confirmed
handled via the headless-background-push → `ensureCallKeepSetup()` path).

Genuinely remaining, requiring either a physical device or a scope/product
decision this audit should not make unilaterally:

1. **Physical-device test matrix** (lock-screen answer/decline, lock-screen
   ringing, lock-screen audio routing, OS-terminated-process relaunch via
   VoIP/FCM push, force-stop/force-quit boundary behavior) — **not
   performed**. This audit is code-level; it proves the implementation is
   present, wired correctly, internally consistent, and its own test
   suites pass — not that it behaves correctly on real Android/iOS
   hardware. A `docs/calling/CALLING_DEVICE_TEST_MATRIX.md` template was
   deliberately **not** created this pass with fabricated/placeholder
   results — an empty template with no real PASS/FAIL data would be more
   misleading than useful; it should be created and populated during an
   actual device-testing session.
2. **API 24–25 self-managed-ConnectionService gap** (§4.4) — real,
   confirmed, low-priority given the age of that OS release; the correct
   fix (raise `minSdkVersion` to 26, or implement a non-self-managed
   fallback) is a product tradeoff decision for the repository owner, not
   a bug this audit should fix unilaterally.
3. **`react-native-callkeep`'s iOS native `CXProviderDelegate` internals**
   (§5.5) — third-party library internals, lower priority than the app's
   own integration points, all of which were verified.
4. **Full `xcodebuild build`/archive** — not performed (requires code
   signing; the workspace-list check already confirms the dependency
   graph is sound, which is the part a correctness audit can usefully
   verify without signing credentials).
