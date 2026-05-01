# Phase 4: Calls and Video

Objective:

- Upgrade call support from signaling storage/history to full user-facing voice and video calling.

Current gap:

- Nest persists call sessions and signals.
- Frontend currently exposes call history, but not a complete call flow.

Primary outcomes:

- stable one-to-one and group voice calling
- stable one-to-one and group video calling
- ringing, answer, reject, busy, reconnect, and end-call UX

Workstreams:

## 4.1 Define call architecture

Choose and document:

- WebRTC library and platform strategy
- TURN/STUN requirements
- background/foreground behavior
- push wake strategy for incoming calls
- one active call per conversation vs broader concurrency model

## 4.2 Frontend signaling implementation

Implement consumers for:

- `call.offer`
- `call.answer`
- `call.ice`
- `call.end`

Add screens/states for:

- incoming ringing
- outgoing dialing
- in-call controls
- reconnecting
- call ended/missed/busy

## 4.3 Media session lifecycle

Implement:

- microphone/camera permission flow
- route selection
- mute/unmute
- speaker/bluetooth routing
- camera toggle
- pause/resume local video

## 4.4 Reliability and recovery

Add:

- reconnect logic
- ICE restart behavior
- stale call cleanup
- missed-call records
- push-triggered resume

## 4.5 Call history and analytics

Unify:

- call state persistence
- call outcomes
- per-participant reason tracking
- UI history filters

Exit criteria:

- real call UX exists in frontend
- signaling and session state are stable
- call history reflects real user actions
- voice and video work on both platforms in normal network conditions

Implementation status on 2026-04-24:

- completed:
  - React Native now consumes `call.offer`, `call.answer`, `call.ice`, and `call.end` through shared socket state in `/Users/nigel/dev/KIS/SocketProvider.tsx`
  - a real in-app call surface now exists through `/Users/nigel/dev/KIS/src/components/calls/CallOverlay.tsx` with incoming, dialing, connecting, active, reconnecting, ended, and missed states
  - chat header, chat info, and messaging quick actions now start voice/video calls from the active conversation surfaces
  - call history now refreshes on live signaling events and exposes `missed` outcomes in `/Users/nigel/dev/KIS/src/screens/tabs/MesssagingSubTabs/CallsTab.tsx`
  - Nest now persists richer call outcomes and signal events in `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/calls.ts` and `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/calls/calls.service.ts`
- completed with a deliberate adapter boundary:
  - permission checks, ringing, answer, reject, busy, reconnect-state signaling, and end-call history are now wired end-to-end
  - video calls currently present a prepared UI surface, but the actual peer-media transport is still intentionally deferred behind a native adapter boundary
- deferred:
  - native WebRTC peer connection and media stream rendering
  - speaker/bluetooth/audio-session routing at the platform layer
  - push wake, CallKit/ConnectionService-style incoming-call resume, and background recovery

Recorded limitation:

- Phase 4 is complete for signaling, in-app UX, and persisted call-history behavior.
- The remaining media-engine work is a focused native transport integration task, not a missing product flow definition.
