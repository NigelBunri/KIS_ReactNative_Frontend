# Phase 1: Foundation and Hardening

Objective:

- Stabilize the current system before deep feature expansion.
- Create one authoritative contract for message lifecycle, permissions, unread state, and socket behavior.

Why this phase comes first:

- Every later phase depends on reliable message identity, policy enforcement, unread semantics, and observability.
- Without this, E2EE, calling, and comment unification will amplify current inconsistencies.

Primary outcomes:

- One shared contract for message, conversation, receipt, unread, and presence semantics.
- Strict enforcement of conversation permissions in realtime.
- Removal of duplicated or ambiguous backend behavior.
- Better observability and regression protection.

Workstreams:

## 1.1 Canonical event and state contract

Create a shared contract doc and align code to it.

Must define:

- conversation identity
- message identity
- client idempotency rules
- sequence allocation rules
- delivery states: `queued`, `sent`, `delivered`, `read`, `played`, `failed`
- unread count authority
- typing presence semantics
- push notification trigger rules
- comment-room behavior

Files to align:

- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/models.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/chat.types.ts`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
- `/Users/nigel/dev/KIS/src/Module/ChatRoom/chatTypes.ts`

## 1.2 Tighten realtime permission enforcement

Fix soft enforcement and drift.

Required changes:

- Remove permissive send behavior when `canSend=false`.
- Ensure lock, mute, block, readonly, and admin-only room rules are enforced consistently.
- Decide whether pending direct requests can send both ways or only initiator-to-recipient.
- Centralize enforcement so frontend never becomes the source of truth.

Key code:

- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/moderation/moderation.service.ts`

## 1.3 Clean duplicated or ambiguous endpoints and logic

Known examples:

- duplicate `member_ids` definitions in Django chat viewset
- mixed direct SQL comments and chat-backed comments
- local conversation cache behavior that can drift from backend truth

Key code:

- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
- `/Users/nigel/dev/KIS/src/Module/ChatRoom/normalizeConversation.ts`

## 1.4 Authoritative unread and receipt model

Deliver:

- explicit persistence strategy for unread counts
- per-message receipt semantics
- cross-device reconciliation rules
- backend-owned conversation list metadata contract

Target:

- frontend shows server-truth unread and last message data, not only local-cache best effort

## 1.5 Observability and regression safety

Add:

- structured logging for socket lifecycle, send/edit/delete, receipt, history, join/leave
- metrics for ack latency, reconnects, dropped sends, and unauthorized attempts
- targeted tests around core message flows

Exit criteria:

- shared contract doc checked in
- no known soft-permission bypasses
- message lifecycle semantics documented and enforced
- duplicated Django chat endpoint behavior cleaned up
- baseline tests exist for send/edit/delete/history/join/leave

Implementation status on 2026-04-24:

- completed:
  - shared contract doc added
  - realtime `canSend=false` bypass removed in Nest
  - duplicated Django `member-ids` logic removed
  - pending-DM recipient send restriction enforced in Django websocket permissions
  - authoritative unread/read watermark model added across Django, Nest, and React Native list rendering
- deferred with blockers recorded in `STATUS.md`:
  - broader observability sweep
  - wider automated coverage beyond the new Django contract tests
  - clean frontend typecheck, which is currently blocked by unrelated repo errors

Do not start Phase 2 until:

- conversation/message contract is stable
- unread/receipt direction is decided
- policy enforcement is strict
