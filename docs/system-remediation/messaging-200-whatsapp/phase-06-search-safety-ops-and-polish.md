# Phase 6: Search, Safety, Operations, and Release Readiness

Objective:

- Finish the platform-level capabilities that make the system production-safe and clearly beyond WhatsApp.

Primary outcomes:

- powerful search
- serious moderation and trust tooling
- operational observability
- release-grade migration and rollout discipline

Workstreams:

## 6.1 Search

Implement:

- conversation search
- message full-text search
- attachment/media search
- participant search
- comment-room search

Must define interaction with E2EE:

- searchable metadata only
- device-side indexing
- optional secure search modes

## 6.2 Safety and abuse tooling

Implement:

- unified block/report flows
- spam heuristics
- conversation-level trust scores
- admin moderation queues
- evidence/audit logging

## 6.3 Notifications and delivery quality

Improve:

- notification dedupe
- offline delivery accuracy
- silent vs noisy notification rules
- mention/high-priority notification handling

## 6.4 Performance and resilience

Add:

- socket reconnect metrics
- ack latency metrics
- load/perf tests for rooms and fanout
- cache invalidation strategy
- failure-mode runbooks

## 6.5 Migration and release process

Prepare:

- backfill scripts
- feature flags
- dark launch strategy
- shadow reads
- rollback plan
- QA matrix for messaging, comments, statuses, and calls

## 6.6 200% WhatsApp differentiators

Build after parity-hardening:

- AI thread summaries
- org/community moderation copilots
- knowledge-aware channel assistants
- workflow actions inside conversations
- partner/community governance overlays

Exit criteria:

- production rollout plan exists
- safety and search are credible
- observability and runbooks exist
- parity features are stable before differentiators scale

Implementation status: completed on 2026-04-24 for the current backend contract and shared route layer.

What shipped:

- Search:
  - conversation search endpoint for accessible conversations
  - participant search endpoint scoped to the caller's visible conversations
  - status search endpoint that respects the same visibility, mute, and block rules as the main status feed
- Safety and abuse tooling:
  - moderation flags now support queue filtering by status, target type, severity, and reporter
  - moderation queue summary endpoint now exposes pending counts by target type and severity
  - sensitive actions now create audit logs:
    - status view
    - status mute/unmute
    - status report
    - moderation flag create/review/resolve
    - user block create
- Status analytics and operator visibility:
  - status payloads now include `view_count`
  - owners now get `viewed_by_preview`
  - owner-only `viewers` endpoint returns the full viewed-by list with timestamps
- Shared route layer updates:
  - status search/viewers routes exposed in React Native network routes
  - moderation queue summary and audit log routes exposed in shared misc routes

Files that define the delivered Phase 6 contract:

- Django:
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/chat/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/serializers.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/views.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/statuses/tests.py`
  - `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/moderation/views.py`
- React Native shared routes:
  - `/Users/nigel/dev/KIS/src/network/routes/socialRoutes.ts`
  - `/Users/nigel/dev/KIS/src/network/routes/miscRoutes.ts`

Verification recorded for this phase:

- `python3 manage.py check` passed
- targeted search/safety/status tests were added, but `../env/bin/python manage.py test apps.statuses apps.chat --noinput` again stalled in the existing environment-level test database path after test DB creation began

Runbook / rollout notes:

- Search remains metadata-first and does not attempt to break the E2EE boundary by indexing protected plaintext on the server
- Audit logs now provide a minimum operator trail for social/status safety events, but Phase 6 does not yet introduce a separate admin UI over those logs
- Queue summary endpoints are intended for moderation dashboards and release monitoring, even if the current frontend does not yet render them

Remaining non-blocking follow-ups:

- media/attachment search in Nest/Mongo
- message-body search for encrypted conversations via device-side indexing only
- notification dedupe and delivery telemetry in Nest push flows
- reconnect/ack latency metrics and load/perf harnesses
- full rollout artifacts such as dark-launch flags, QA matrix, and rollback playbooks for every surface
