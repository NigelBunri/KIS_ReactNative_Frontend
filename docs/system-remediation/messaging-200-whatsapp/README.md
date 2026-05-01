# Messaging 200% WhatsApp Program

This directory is the canonical handoff record for the cross-repo messaging upgrade.

Repos in scope:

- React Native frontend: `/Users/nigel/dev/KIS`
- Django backend: `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`
- Nest realtime backend: `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/Nestjs/CC_Node_Backend`

Goal:

- Upgrade the messaging stack from a broad but uneven system into a reliable, secure, multi-device communications platform that materially exceeds WhatsApp in breadth and execution.

Definition of "200% WhatsApp":

- Match WhatsApp on trust, reliability, privacy, message lifecycle, and call quality.
- Exceed WhatsApp on channels, communities, partner/org workflows, threaded comments, moderation, search, AI assistance, and domain-specific collaboration.

Working rules:

- Use this directory as the single source of truth for roadmap, current status, and handoff notes.
- Do not start a later phase before the hard dependencies listed in earlier phases are complete.
- Update `STATUS.md` after every substantial session.
- If implementation decisions change, append them under the "Decision Log" section in `STATUS.md`.

Start order:

1. `STATUS.md`
2. `phase-01-foundation-and-hardening.md`
3. `phase-02-conversation-unification.md`
4. `phase-03-e2ee-and-multi-device.md`
5. `phase-04-calls-and-video.md`
6. `phase-05-status-feed-and-comments.md`
7. `phase-06-search-safety-ops-and-polish.md`

Current diagnosis summary:

- Strengths:
  - Strong breadth across direct chat, groups, channels, partner spaces, communities, statuses, feed comments, and moderation hooks.
  - Good split of responsibility: Django for policy and room graph, Nest for realtime and message persistence, React Native for rich client UX.
- Main gaps:
  - Calls and video are not end-to-end product complete.
  - Encryption is not WhatsApp-grade end-to-end; server still decrypts message payloads.
  - Comments are split across SQL-native comments and chat-native comment rooms.
  - Multi-device state, unread state, and delivery semantics are not authoritative enough.
  - Policy enforcement has soft spots and implementation drift.

Program success criteria:

- One canonical message architecture across chats, comments, partner posts, community posts, and broadcast discussions.
- Authoritative unread, delivered, read, played, and presence semantics across devices.
- Real E2EE with server-blind message content.
- Real audio/video calling with stable signaling, UX, recovery, and history.
- Strong moderation, reporting, search, observability, and release gating.

