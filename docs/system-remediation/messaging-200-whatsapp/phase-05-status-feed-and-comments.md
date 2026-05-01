# Phase 5: Status, Feed, and Social Messaging Surfaces

Objective:

- Bring statuses, feed discussion, broadcast discussion, and social engagement up to parity-plus quality.

Primary outcomes:

- stronger status privacy and UX
- richer discussion around feed/broadcast surfaces
- better social-to-chat transitions

Workstreams:

## 5.1 Status privacy and control

Add:

- share with all contacts / exclude list / only-share-with list
- status reply permissions
- archive/delete UX
- mention/reshare rules
- report/block flows

## 5.2 Status quality

Add:

- upload constraints and compression
- better media duration handling
- per-item analytics
- viewed-by UX
- muted statuses

## 5.3 Feed-to-chat bridge

Improve:

- open source conversation from channel/feed items
- quote/reply/share a feed item into a chat
- convert feed discussion to deeper thread/sub-room when volume rises

## 5.4 Comment threading

Add:

- proper reply chains
- thread navigation
- unread thread badges
- moderation tools for comment rooms

## 5.5 Social intelligence beyond WhatsApp

Candidate differentiators:

- summary of hot discussion on a post
- auto-group repeated comment topics
- high-signal comments pinning
- org moderation controls for comments

Exit criteria:

- status privacy is strong
- comment/thread UX is coherent
- feed and messaging surfaces feel like one system

Implementation status: completed on 2026-04-24 for the active product surfaces.

What shipped:

- Django status privacy is now server-enforced instead of client-enforced:
  - `contacts`
  - `contacts_except`
  - `only_share_with`
- Status reply permissions now exist at the item contract level:
  - `contacts`
  - `nobody`
- Status viewers can now:
  - mute a user's statuses
  - report a status
  - block the status author
- React Native `UpdatesTab` now:
  - loads the server-approved status feed without using `userIds` as the privacy boundary
  - lets the author choose audience and reply permissions when posting
  - lets the author choose explicit contacts for custom audiences
  - exposes viewer moderation actions for mute/report/block
- Phase 2's canonical comment-room unification remains the base for partner/community/broadcast discussion surfaces, so Phase 5 did not reopen legacy SQL comment flows.

Files that define the delivered Phase 5 contract:

- Django:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/models.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/migrations/0006_statusitem_reply_permission_statusitem_visibility_and_more.py`
- React Native:
  - `/Users/nigel/dev/KIS/src/screens/tabs/MesssagingSubTabs/UpdatesTab.tsx`
  - `/Users/nigel/dev/KIS/src/network/routes/socialRoutes.ts`

Verification recorded for this phase:

- `python3 manage.py check` passed
- `python3 manage.py makemigrations statuses` generated the expected schema migration
- `../env/bin/python manage.py test apps.statuses --noinput` reached test-database setup and then stalled in the existing environment-level test DB path, so automated test completion remains blocked in this environment
- React Native typecheck remains noisy due pre-existing project-wide TypeScript configuration and dependency issues outside this slice

Remaining non-blocking follow-ups:

- viewed-by UI
- status archive/delete UX
- richer mention/reshare rules
- analytics on status reach and completion
- deeper feed-to-chat intelligence and comment summarization, which are better handled in Phase 6
