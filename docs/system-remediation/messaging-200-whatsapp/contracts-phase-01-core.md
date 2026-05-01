# Phase 1 Core Messaging Contract

Status: active working contract

Purpose:

- Define the canonical cross-repo contract for conversation identity, message identity, permission checks, receipts, and list metadata before deeper refactors begin.

Repos:

- React Native frontend: `/Users/nigel/dev/KIS`
- Django backend: `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
- Nest realtime backend: `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`

## 1. Conversation contract

Canonical conversation id:

- `conversationId` is the authoritative identifier everywhere.
- Django may serialize `id`.
- Frontend adapters may accept `conversation_id`, `conversationId`, or `id`, but normalized app state must store `conversationId`.

Conversation authority:

- Django owns:
  - conversation existence
  - membership
  - room policy
  - room metadata
- Nest owns:
  - realtime room joins
  - message persistence
  - message fanout

## 2. Message identity contract

Each outbound message has:

- `clientId`: generated on device, stable across retries
- `seq`: allocated by Django conversation sequence endpoint
- `serverId`: authoritative persisted message id from Nest/Mongo

Rules:

- `clientId` is the idempotency key within a conversation.
- `seq` must be unique per conversation.
- `serverId` is the canonical reference for edit/delete/reaction/receipt after persistence.

## 3. Permission contract

Authoritative permission source:

- Django `ws-perms` is the authority.
- Nest must enforce returned permissions strictly.
- Frontend may use permissions for UX, but never for security.

Current required fields from `ws-perms`:

- `isMember`
- `isBlocked`
- `role`
- `canSend`
- `scopes`

Required enforcement:

- `isMember=false` -> deny join/send/edit/delete/react/receipt/typing/calls
- `isBlocked=true` -> deny all interaction
- `canSend=false` -> deny send

## 4. Message lifecycle contract

Canonical states:

- `queued`
- `sent`
- `delivered`
- `read`
- `played`
- `failed`

Meaning:

- `queued`: local-only, not yet acknowledged by Nest
- `sent`: persisted by Nest and acked to sender
- `delivered`: recipient device session confirmed receipt
- `read`: recipient explicitly read/opened
- `played`: recipient played voice/media requiring played semantics
- `failed`: message could not be persisted or retry budget exhausted

Phase 1 note:

- Current implementation has only partial authoritative support.
- Full multi-device semantics are a later phase, but new work must not conflict with these state names.

## 5. Conversation list metadata contract

Conversation list rows should ultimately be backend-authored for:

- `last_message_at`
- `last_message_preview`
- unread count
- mute/block/archive flags

Phase 1 rule:

- frontend local cache may optimize rendering
- backend remains the source of truth for canonical list metadata

## 6. Comment room contract

Discussion surfaces that open message-style comments must resolve to a real conversation id.

Rules:

- partner post comments
- community post comments
- broadcast comments
- feed comments

should converge toward one conversation-backed discussion model.

Phase 1 rule:

- comment-room endpoints may continue to exist
- new discussion features must prefer conversation-backed comments over standalone SQL-live comment logic

## 7. Non-goals for Phase 1

- true server-blind E2EE
- final multi-device read model
- full voice/video call UX

Those are handled in later phases.

