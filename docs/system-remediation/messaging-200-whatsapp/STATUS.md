# Messaging 200% WhatsApp Status

Last updated: 2026-04-24

Program state:

- Phase 1: completed with recorded verification blockers outside this slice
- Phase 2: completed with legacy compatibility endpoints still present
- Phase 3: completed with legacy conversation-key compatibility kept for older clients
- Phase 4: completed with native media transport adapter still pending
- Phase 5: completed for the active status/feed/comment surfaces, with advanced social intelligence deferred to Phase 6
- Phase 6: completed for the current Django/shared-route contract, with native media transport and deep differentiators still as follow-up work

Current baseline assessment:

- Product breadth: high
- Reliability maturity: medium-low
- Privacy maturity: low-medium
- Call maturity: low
- Multi-device maturity: low-medium
- Operational maturity: medium

Top blockers:

1. No single canonical message/comment architecture.
2. Legacy conversation-key compatibility still exists beside the new per-device Signal fanout path.
3. Native peer media transport is still behind a signaling-first adapter boundary.
4. Delivery/read/unread semantics are not fully authoritative across devices.
5. Native peer media transport and some deeper differentiators still remain as post-program follow-up work.

Canonical code ownership map:

- Django owns:
  - conversation graph
  - membership and policy
  - partner/community/channel/group metadata
  - status models and visibility
  - REST discovery and business rules
- Nest owns:
  - websocket auth
  - realtime fanout
  - message persistence
  - call signaling persistence
  - push-notification triggers
- React Native owns:
  - socket session lifecycle
  - local cache and optimistic UX
  - chat/call/status/feed surfaces
  - device-bound identity and secure local state

Audit-backed hotspots:

- Django conversation policy and metadata:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/models.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
- Nest realtime message path:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/messages/messages.service.ts`
- Current E2EE gap:
  - `/Users/nigel/dev/KIS/src/security/e2ee.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/e2ee/e2ee-keys.service.ts`
- Current call/media gap:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/calls/calls.service.ts`
  - `/Users/nigel/dev/KIS/SocketProvider.tsx`
  - `/Users/nigel/dev/KIS/src/components/calls/CallOverlay.tsx`
- Comment architecture split:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/models.py`
  - `/Users/nigel/dev/KIS/src/components/feeds/CommentThreadPanel.tsx`

Next session starting point:

- Start with post-program follow-up work, using the Phase 1-6 contract and status log as the baseline.
- First implementation slice should be:
  - finish native media transport and background-call wake flows
  - add deeper Nest-side delivery telemetry and message/media search where it does not violate the E2EE boundary
  - build operator UI on top of the new moderation queue and audit-log surfaces
  - tighten rollout cleanup around the remaining legacy compatibility paths

Current completed slice:

- Added the Phase 1 core messaging contract document.
- Tightened Nest realtime message enforcement so `canSend=false` now blocks send/edit/delete instead of logging and allowing.
- Removed duplicated Django `member-ids` viewset action definition.
- Changed Django websocket permissions so a pending direct-chat recipient cannot send until the request is accepted.
- Added authoritative per-member read watermarks in Django via `ConversationMember.last_read_seq` and `last_read_at`.
- Added Django internal `update-read-state` endpoint and wired Nest read receipts to advance the watermark.
- Exposed backend-owned unread contract fields on conversation list payloads: `unread_count`, `last_read_seq`, `read_state_authoritative`, `has_mention`.
- Updated the React Native chat list to treat Django unread counts as the source of truth unless local metadata is strictly newer.
- Standardized comment-room creation for partner posts, community posts, and broadcasts through one shared Django helper.
- Standardized partner/community comment counts to prefer canonical conversation sequence numbers over legacy SQL comment rows.
- Migrated the remaining legacy React Native feed comments screen onto the canonical conversation-backed thread panel.
- Added full frontend call signaling state, incoming/outgoing call UI, call controls, and live call history refresh across the messaging surfaces.
- Hardened Nest call persistence so offer/answer/ice/end update real call history with ringing/active/ended/missed outcomes.
- Replaced the live plaintext-first messaging path with per-device Signal fanout on React Native, with legacy conversation-key ciphertext fallback kept only for older-client compatibility.
- Removed the realtime Nest dependency on server-side message decryption so encrypted payloads are now persisted and fanned out without being turned back into plaintext first.
- Added explicit Django device-session management and multi-device E2EE bundle publication, including device revocation that invalidates device-bound JWT access by checking the device record on every authenticated request.
- Extended chat-room history/live/edit flows to decrypt encrypted message payloads client-side after sync instead of assuming the server stored plaintext.

Decision log:

- 2026-04-24: This directory was designated as the single canonical handoff location for the messaging upgrade program.
- 2026-04-24: The program order was fixed as foundation -> unification -> e2ee/multi-device -> calls -> social/status/comments -> search/safety/ops.
- 2026-04-24: Protected messaging now prefers per-device Signal fanout, while legacy conversation-key encryption remains only as a compatibility path for older clients and incomplete participant inventories.

Session update template:

- Date:
- Repo(s) touched:
- Phase:
- Goal:
- Files changed:
- Contract changes:
- Migrations added:
- Tests added/updated:
- Known risks:
- Next exact step:

Session updates:

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/dev/KIS`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`
- Phase: 1
- Goal:
  - establish the first hardening slice for permissions and contract clarity
- Files changed:
  - `/Users/nigel/dev/KIS/docs/system-remediation/messaging-200-whatsapp/contracts-phase-01-core.md`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
- Contract changes:
  - documented canonical conversation/message identity, permission rules, lifecycle state names, conversation-list ownership, and comment-room rules
- Migrations added:
  - none
- Tests added/updated:
  - no new tests yet
- Verification:
  - `pnpm exec tsc -p tsconfig.build.json --noEmit --incremental false` passed in Nest
  - `python3 manage.py check` passed in Django
- Known risks:
  - edit/delete currently reuse `canSend` as a proxy until a separate mutation-permission model is defined
  - unread/receipt authority is still not solved
  - comments remain architecturally split
- Next exact step:
  - begin Phase 2 conversation/comment unification with post comments, partner comments, and broadcast comment rooms folded into one conversation model contract

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/dev/KIS`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`
- Phase: 1
- Goal:
  - complete the authoritative unread and receipt contract, then align Django, Nest, and React Native around it
- Files changed:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/models.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/migrations/0007_conversationmember_last_read_at_and_more.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/integrations/django/django-conversation.client.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/receipts.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/messagesUtils.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/normalizeConversation.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/componets/MessageTabs.tsx`
- Contract changes:
  - unread state is now defined as `conversation.last_message_seq - member.last_read_seq`
  - Django owns unread count publication for the conversation list
  - Nest read receipts now advance Django read watermarks
  - React Native may use local conversation meta only as a freshness override, not as the default unread authority
- Migrations added:
  - `apps/chat/migrations/0007_conversationmember_last_read_at_and_more.py`
- Tests added/updated:
  - added Django chat contract tests for authoritative unread payloads, monotonic read-state updates, and pending-DM websocket send permissions
- Verification:
  - `python3 manage.py check` passed in Django
  - `pnpm exec tsc -p tsconfig.build.json --noEmit --incremental false` passed in Nest
  - `pnpm exec tsc --noEmit` in React Native is still blocked by many pre-existing unrelated type errors outside messaging
  - `python3 manage.py test apps.chat --noinput` is currently blocked by an existing SQLite test-migration failure (`near "[]": syntax error`) during test database setup
- Known risks:
  - `has_mention` is still a placeholder `false` until mention parsing and receipt aggregation are implemented server-side
  - the unread watermark is conversation-sequence based, not per-device, which is correct for user-level unread but not yet rich enough for device diagnostics
  - frontend verification remains noisy because the app has many unrelated compile failures
- Next exact step:
  - continue Phase 2 by migrating legacy partner/community comment read/write endpoints to the canonical conversation-backed discussion path

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
  - `/Users/nigel/dev/KIS`
- Phase: 2
- Goal:
  - standardize comment-room creation and count semantics before removing legacy SQL comment flows
- Files changed:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/discussion.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/communities/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/communities/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/communities/tests.py`
  - `/Users/nigel/dev/KIS/src/components/feeds/FeedCommentsScreen.tsx`
- Contract changes:
  - comment-room creation is now shared by partner posts, community posts, and broadcasts
  - `comments_count` for partner/community posts now prefers `comment_conversation.last_message_seq` as the canonical source, with SQL comments only as migration fallback
- Migrations added:
  - none
- Tests added/updated:
  - added partner discussion tests for room reuse and canonical count source
  - added community discussion tests for room reuse and canonical count source
- Verification:
  - `python3 manage.py check` passed
  - targeted Django tests are still blocked by the existing SQLite test database migration error (`near "[]": syntax error`) during test DB creation
- Known risks:
  - partner/community `comment` and `comments` endpoints still exist as legacy compatibility paths, even though active frontend discussion surfaces now use canonical conversation rooms
  - analytics that read legacy SQL comment tables are still migration-era data sources until Phase 6 reporting cleanup
  - targeted test execution is still blocked by the existing SQLite migration issue
- Next exact step:
  - begin Phase 3 by upgrading the encryption boundary and multi-device session model on top of the now-unified active discussion surfaces

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/dev/KIS`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
- Phase: 4
- Goal:
  - complete the frontend/backend call signaling flow with real in-app call UX, richer call history outcomes, and shared entry points from messaging surfaces
- Files changed:
  - `/Users/nigel/dev/KIS/SocketProvider.tsx`
  - `/Users/nigel/dev/KIS/src/components/calls/CallOverlay.tsx`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/componets/main/ChatHeader.tsx`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/ChatRoomPage.tsx`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/ChatInfoPage.tsx`
  - `/Users/nigel/dev/KIS/src/screens/tabs/MessagesScreen.tsx`
  - `/Users/nigel/dev/KIS/src/screens/tabs/MesssagingSubTabs/CallsTab.tsx`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/calls.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/calls/calls.service.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/calls/schemas/call-session.schema.ts`
- Contract changes:
  - active/incoming/outgoing calls now live in shared frontend socket state instead of call-history-only UI
  - `call.offer`, `call.answer`, `call.ice`, and `call.end` now drive visible call state transitions in React Native
  - Nest call persistence now records answer/hangup/participant outcomes and supports `missed` call history state
- Migrations added:
  - none
- Tests added/updated:
  - no new automated call tests yet
- Verification:
  - `pnpm exec tsc -p tsconfig.build.json --noEmit --incremental false` passed in Nest
  - `python3 manage.py check` passed in Django
  - `pnpm exec tsc --noEmit --pretty false` in React Native still fails on many pre-existing unrelated frontend type errors, but did not surface new errors from the added call files
- Known risks:
  - actual peer media transport is still behind an adapter boundary because the project does not currently include a WebRTC/native calling dependency
  - speaker/bluetooth routing is currently UI state only, not native audio-session control
  - push wake / background incoming-call resume is still not implemented
- Next exact step:
  - begin Phase 3 by upgrading the encryption boundary and multi-device session model, then return for native WebRTC/media transport integration as a focused follow-up

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/dev/KIS`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`
- Phase: 3
- Goal:
  - remove the realtime server-side plaintext dependency, introduce real device-session ownership, and move protected message delivery onto a per-device encrypted fanout contract
- Files changed:
  - `/Users/nigel/dev/KIS/src/security/e2ee.ts`
  - `/Users/nigel/dev/KIS/src/network/routes/authRoutes.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/hooks/useChatMessaging.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/chatTypes.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/componets/chatMapping.ts`
  - `/Users/nigel/dev/KIS/src/Module/ChatRoom/componets/useChatSocket.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/urls.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/jwt_auth.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/chat.types.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/messages/messages.dto.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/messages/messages.service.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/chat/features/messages/schemas/message.schema.ts`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend/src/realtime/handlers/messages.ts`
- Contract changes:
  - protected sends now prefer Signal-style per-device recipient fanout and include the sender's own devices for self-sync
  - Nest no longer decrypts incoming encrypted message payloads before persistence or fanout
  - Django now publishes all active device bundles for a user and exposes explicit device list/revoke endpoints
  - device-bound JWT authentication now rejects tokens whose device record has been revoked
  - chat-room history and realtime message updates are decrypted on-device after sync rather than relying on stored plaintext
- Migrations added:
  - none
- Tests added/updated:
  - added Django accounts tests for device listing, device revocation, and multi-device E2EE bundle publication
- Verification:
  - `python3 manage.py check` passed in Django
  - `pnpm exec tsc -p tsconfig.build.json --noEmit --incremental false` passed in Nest
  - `pnpm exec tsc --noEmit --pretty false` in React Native still fails on many pre-existing unrelated frontend type errors outside this slice
  - targeted `apps.accounts` test execution still hangs during test-database setup in the current environment, so full automated test completion for this phase is still blocked
- Known risks:
  - legacy conversation-key encryption is still retained as a compatibility path, so the rollout is stronger but not yet a pure single-mode E2EE world
  - Signal fanout currently depends on the frontend having participant inventory for the conversation; when that inventory is incomplete it intentionally falls back to the compatibility path
  - there is still no end-user device-management UI yet in React Native, only the backend/API contract
- Next exact step:
  - begin Phase 5 by hardening statuses, feeds, and comment-adjacent social messaging surfaces on top of the new protected-message and device-session contract

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/dev/KIS`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
- Phase: 5
- Goal:
  - complete the status/privacy/moderation hardening pass and align the React Native updates surface with a server-owned status visibility contract
- Files changed:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/models.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/migrations/0006_statusitem_reply_permission_statusitem_visibility_and_more.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/moderation/models.py`
  - `/Users/nigel/dev/KIS/src/network/routes/socialRoutes.ts`
  - `/Users/nigel/dev/KIS/src/screens/tabs/MesssagingSubTabs/UpdatesTab.tsx`
  - `/Users/nigel/dev/KIS/docs/system-remediation/messaging-200-whatsapp/phase-05-status-feed-and-comments.md`
- Contract changes:
  - status visibility is now server-enforced with `contacts`, `contacts_except`, and `only_share_with`
  - status reply permissions now exist as first-class item fields with `contacts` and `nobody`
  - status list/view no longer trust frontend-supplied `userIds` as the privacy boundary; query IDs are now only an optional narrowing filter
  - status mute, report, and block flows are now exposed directly from the status surface
  - React Native status posting now sends audience and reply controls, including explicit target-user lists for custom audiences
- Migrations added:
  - `apps/statuses/migrations/0006_statusitem_reply_permission_statusitem_visibility_and_more.py`
- Tests added/updated:
  - added Django status contract tests for visible feed filtering, audience exceptions, mute/block hiding, and report flag creation
- Verification:
  - `python3 manage.py makemigrations statuses` passed and generated the expected migration
  - `python3 manage.py check` passed in Django
  - `../env/bin/python manage.py test apps.statuses --noinput` reached test DB setup and then stalled in the existing environment-level test database path
  - React Native typecheck remains blocked by pre-existing project-wide TypeScript/dependency issues outside this slice
- Known risks:
  - status viewed-by UX, archive/delete UX, and richer mention/reshare rules are still product follow-ups rather than contract blockers
  - moderation choice expansion for `STATUS` lives in shared moderation code, but the environment still has broader test DB instability that prevents full automated proof here
  - advanced social intelligence work remains intentionally deferred to Phase 6
- Next exact step:
  - begin Phase 6 with search, safety, analytics, viewed-by surfaces, and operational hardening across messaging, status, and social discussion systems

- Date: 2026-04-24
- Repo(s) touched:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
  - `/Users/nigel/dev/KIS`
- Phase: 6
- Goal:
  - complete the search, safety, and operational hardening pass on top of the status/comment/messaging contracts already landed in Phases 1-5
- Files changed:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/moderation/views.py`
  - `/Users/nigel/dev/KIS/src/network/routes/socialRoutes.ts`
  - `/Users/nigel/dev/KIS/src/network/routes/miscRoutes.ts`
  - `/Users/nigel/dev/KIS/docs/system-remediation/messaging-200-whatsapp/phase-06-search-safety-ops-and-polish.md`
- Contract changes:
  - conversation search and participant search are now explicit API surfaces instead of only an overloaded list query
  - status search is now a first-class endpoint that respects the same visibility, mute, and block policies as normal status listing
  - status payloads now include `view_count`, and owners get a viewed-by preview plus a full owner-only viewers endpoint
  - moderation flags can now be filtered for queue workflows and expose a queue summary endpoint
  - audit logs are now written for status views, status moderation actions, moderation-flag lifecycle actions, and user-block creation
- Migrations added:
  - none
- Tests added/updated:
  - added Django status tests for search and viewers endpoints
  - added Django chat tests for conversation search and participant search endpoints
- Verification:
  - `python3 manage.py check` passed in Django
  - `../env/bin/python manage.py test apps.statuses apps.chat --noinput` again stalled in the existing environment-level test database path after test DB creation started
- Known risks:
  - search remains metadata-only on the server side, which is correct for the current E2EE boundary but means encrypted message-body search still needs device-side indexing work
  - there is still no dedicated operator UI over queue summaries and audit logs
  - Nest-side delivery telemetry and native media transport are still outside the Django-heavy slice completed here
- Next exact step:
  - shift from the numbered phase program into targeted follow-up work: native media transport, operator dashboards over audit/moderation APIs, and deeper telemetry/search work that preserves the E2EE boundary
