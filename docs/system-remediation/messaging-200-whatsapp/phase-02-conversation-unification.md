# Phase 2: Conversation and Comment Unification

Objective:

- Move all discussion surfaces onto one canonical conversation/message model.

Why this matters:

- Right now comments exist in multiple patterns:
  - SQL-native comments
  - chat-backed comment rooms
  - feed/broadcast comment conversations
- This fragmentation breaks unread, moderation, search, analytics, and future E2EE.

Primary outcomes:

- One discussion architecture for direct chat, groups, channels, partner post comments, community post comments, and broadcast comments.
- One moderation/search/unread path across all message-like content.

Workstreams:

## 2.1 Inventory every discussion surface

Surfaces in scope:

- direct conversations
- groups
- partner main conversations
- channels
- community rooms
- partner post comments
- community post comments
- broadcast comments
- feed comments
- thread/sub-room discussions

Expected result:

- one matrix mapping each surface to:
  - conversation owner
  - membership rule
  - sender rule
  - message persistence path
  - comment count source
  - unread source

## 2.2 Eliminate SQL-native post comments as primary discussion storage

Direction:

- SQL comment rows may remain for legacy migration or analytics, but live discussion should be conversation/message based.

Targets:

- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/partners/models.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/models.py`
- `/Users/nigel/dev/KIS/src/components/feeds/CommentThreadPanel.tsx`

## 2.3 Standardize comment-room creation and membership rules

All comment-capable objects should define:

- comment conversation creation trigger
- automatic membership rule
- visibility rule
- moderation rule
- retention rule
- whether replies use same conversation or child threads

## 2.4 Standardize counts and previews

Comment count must come from one source.

Implement:

- consistent denormalized comment counters
- rebuild jobs for migration/backfill
- reliable last-comment preview and unread semantics

## 2.5 Frontend surface normalization

Frontend should open all discussion surfaces through one path:

- resolve object -> conversation id
- open one discussion screen contract
- reuse message and reply model

Exit criteria:

- one canonical discussion model
- no surface depends on separate live SQL comment logic
- comment unread/count/preview semantics are unified
- feed, partner, community, and broadcast discussion all behave consistently

Implementation status on 2026-04-24:

- completed:
  - shared Django helper now creates comment rooms for partner posts, community posts, and broadcasts through one path
  - partner/community `comments_count` now prefers canonical discussion-room sequence state over SQL comment row counts
  - the remaining React Native feed comments screen now opens the canonical socket-backed thread panel instead of SQL comment endpoints
- compatibility kept intentionally:
  - partner/community legacy `comment` and `comments` endpoints still exist for migration safety, but the active frontend discussion surfaces no longer depend on them
- deferred:
  - reporting and analytics cleanup for legacy SQL comment tables
  - final removal of compatibility-only SQL comment endpoints once migration confidence is high
