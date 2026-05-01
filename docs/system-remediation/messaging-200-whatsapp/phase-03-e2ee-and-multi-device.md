# Phase 3: E2EE and Multi-Device

Objective:

- Move from transport-enhanced privacy to real end-to-end encryption and production-grade multi-device behavior.

Current gap:

- Frontend generates Signal-style device keys.
- Nest currently decrypts encrypted payloads server-side.
- That is not WhatsApp-grade E2EE.

Primary outcomes:

- Server cannot read message plaintext.
- Devices can join one account safely.
- Read/delivery/history behavior works across devices.

Workstreams:

## 3.1 Define the target E2EE model

Decide and document:

- per-user-device identity model
- session establishment model
- group sender-key or per-recipient fanout approach
- attachment encryption model
- key rotation and device revocation
- backup and recovery model

## 3.2 Remove server plaintext dependency

Target change:

- Nest should not need plaintext to persist or route messages.

Implications:

- message preview generation must change
- moderation strategy must change
- search indexing must change
- push notification previews must change

Possible approaches:

- privacy-first mode: generic push text and device-side preview
- opt-in secure indexing
- scoped server-visible metadata only

## 3.3 Device management

Implement:

- list active devices
- revoke device
- show last active time
- detect suspicious device changes
- safe rekey behavior

## 3.4 Multi-device message semantics

Need authoritative design for:

- delivery sync
- read sync
- played sync for voice notes
- history catch-up
- conflict handling for edits/deletes
- offline queue replay

## 3.5 Attachment security

Implement:

- client-side attachment encryption
- secure upload metadata
- signed or protected download access
- media decryption on device

Exit criteria:

- server-blind message content for protected conversations
- device/session management UX exists
- multi-device receipt behavior is deterministic
- attachment path supports encrypted media

Implementation status on 2026-04-24:

- completed:
  - React Native protected-message sends now prefer per-device Signal fanout through `/Users/nigel/dev/KIS/src/security/e2ee.ts`
  - chat-room history, live-message, and edit flows now decrypt encrypted payloads on-device in `/Users/nigel/dev/KIS/src/Module/ChatRoom/hooks/useChatMessaging.ts`
  - Django now exposes explicit device list and device revoke endpoints plus all-device E2EE bundle publication in `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/views.py`
  - device-bound JWT auth now rejects revoked devices in `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/jwt_auth.py`
  - Nest realtime message handling no longer decrypts incoming ciphertext before persistence or fanout in `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
  - Nest message persistence now stores ciphertext metadata needed for client-side decrypt replay and history sync
- completed with a compatibility path:
  - legacy conversation-key ciphertext remains available as a fallback when participant device inventory is incomplete or older clients are still present
  - this keeps rollout safety high, but it means the system is not yet in a pure single-mode E2EE posture
- deferred:
  - end-user React Native device-management UI
  - encrypted attachment upload/download contract beyond message-body payloads
  - deterministic multi-device delivery diagnostics beyond the user-level read watermark already completed in Phase 1

Recorded limitation:

- Phase 3 is complete for the protected-message boundary, device-session contract, and realtime plaintext removal.
- The main remaining privacy work is rollout cleanup: retiring the compatibility path and extending the same model to encrypted attachments and device-management UX.
