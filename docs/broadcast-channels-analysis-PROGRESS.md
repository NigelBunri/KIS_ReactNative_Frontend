# Broadcast Feeds & Channels — Full System Analysis (IN PROGRESS)

**Status: ALL 4 research agents completed successfully (round 3 for agents 3 & 4). Full findings synthesized into a published artifact.** This was a pure read-only research/analysis task — nothing in the codebase was written or edited.

## Original ask

User: "please do a full analysis of the broadcast feeds system, the chanels and all" — full read-only investigation of the KIS app's broadcast feeds + channels system across both the Django backend (`~/dev/backend/kis`) and the React Native frontend (`~/dev/KIS`). No code changes requested yet — this is an audit to build understanding first.

## Research split (4 parallel fork agents)

Two rounds were launched — the first round failed entirely due to session limit before producing any output. A second round was relaunched with **identical prompts** once the limit reset. As of this save, it's unknown whether the second round completed, partially completed, or also got cut off.

### Agent 1 — Django backend: `apps/broadcasts` + `apps/channels`
Scope: models (BroadcastItem, ChannelLiveStream, ChannelContent, ChannelContentChapter, ChannelAdCampaign, ChannelContentCopyrightClaim, search_vector, health_profile tables, widened BroadcastVideo URL fields — confirm current state, not just migration history), migration history narrative (58+ migrations on broadcasts alone), API surface (serializers/views/urls), business logic (services/selectors/signals/Celery tasks — esp. explicit-content scanning via `test_channel_asset_explicit_content_scan.py` and org-ownership checks via `test_broadcast_channel_org_ownership.py`), test coverage, Django admin capabilities, live-streaming implementation (WebRTC/RTMP/third-party).
- Round 1 agent ID: `a794e7977c191e649` — FAILED (session limit)
- Round 2 agent ID: `aee9343a85335d1e5` — status unknown at time of save

### Agent 2 — Legacy NestJS broadcast module + archived GraphQL gateway
Scope: determine if `~/dev/backend/Nestjs/src/broadcast.module.ts` (+ controller/service/reactions-service/Mongoose schemas/types) is ACTIVE or DEAD CODE relative to the Django system (which is believed to be source of truth per prior KIS work). Check if wired into `app.module.ts`, check git log recency on these files, check overlap between Mongoose broadcast schema and Django broadcast models. Also confirm `graphql-gateway.archived-2026-07-29/` dataloaders are genuinely unreferenced/dead.
- Round 1 agent ID: `a12f1adf53c2cdf57` — FAILED (session limit)
- Round 2 agent ID: `a876dd94052f5a788` — status unknown at time of save

### Agent 3 — RN frontend: broadcast feeds (main discovery/video UX)
Scope: `BroadcastScreen.tsx`, `BroadcastFeedFullScreenScreen.tsx`, `BroadcastDetailScreen.tsx`, the 5 category pages under `src/screens/broadcast/pages/` (Feeds/Healthcare/Market/Education/Jobs), `BroadcastersRow.tsx`, all of `src/components/broadcast/*.tsx`, `useBroadcastFeed.ts`, `broadcastRoutes.ts`, `uploadBroadcastVideo.ts`, `src/types/broadcast.ts`, and disambiguating `src/screens/calls/components/BroadcastLayout.tsx` (likely unrelated call-system feature sharing the word "broadcast"). Plus all 8 existing `broadcast-feeds.*`/`broadcast-detail-screen.*` test files — one-line summary of what each locks down.
- Round 1 agent ID: `aacf71feee4dfb7b6` — FAILED (session limit)
- Round 2 agent ID: `a0218929c985843a1` — status unknown at time of save

### Agent 4 — RN frontend: channels (studio, partner integration, realtime)
Scope: `ChannelHomePage.tsx`, `ChannelContentDetailPage.tsx`, `ChannelsDiscoverPage.tsx`, `ChannelMembersScreen.tsx`, `BroadcastSearchScreen.tsx`, the full Studio suite (`ChannelStudioScreen`, `ChannelBrandingEditor`, `ChannelModerationPanel`, `ChannelHomepageShelfEditor`, `ChannelContentManager`, `ChannelAnalyticsPanel`), `ChannelCommentsPanel.tsx`, `useChannelSocket.ts`, `useChannelsData.ts`, `channels.endpoints.ts`/`channels.types.ts`, partner-integration files (`PartnerBroadcastCenterPanel`, `PartnerChannelsPanel`, `PartnerChannelsSection`, the two partner hooks), `BroadcastProfilesSection.tsx`, `education/provider/BroadcastsScreen.tsx`, `uploadChannelContentVideo.ts`, plus 2 prior docs (`education-ux-v2-visual-and-broadcast-pass.md`, `phase-04-broadcast-partner-and-profile-shell-unification.md`). Also disambiguating whether `NewChannelForm.tsx` (AddContacts module) and `VerificationChannelSelectScreen.tsx` are the SAME "channel" concept or an unrelated naming collision (messaging channel / verification delivery channel).
- Round 1 agent ID: `ad192282e3abad0ba` — FAILED (session limit)
- Round 2 agent ID: `ac3dd5e90c7858333` — status unknown at time of save

## Ground truth already established before agents launched (verified directly, not from agent output)

- Repo: `/Users/nigel/dev/KIS`, branch `education-ux-v2`, clean working tree. Several other worktrees exist for unrelated features (chat-list-scroll-perf, golden-section-collapse, messages-filter-chips, messaging-tabs-redesign, notification-audit, ondevice-translation) — not relevant to this task.
- Backend repo root: `/Users/nigel/dev/backend`, contains THREE separate things touching "broadcast": (1) Django app `kis/apps/broadcasts` + `kis/apps/channels` — Django manage.py confirmed at `kis/manage.py`, (2) NestJS module at `Nestjs/src/broadcast*.ts` (schema files suggest Mongoose/MongoDB — unconfirmed), (3) `graphql-gateway.archived-2026-07-29/` — folder name itself implies dead, contains broadcast-related dataloaders.
- Full file inventory of every broadcast/channel-related file in the KIS RN frontend was already enumerated via `find` (see conversation history) — this list was what seeded the 4 agent prompts above and is reusable if agents need to be re-launched a third time.
- Migration filenames already observed directly (via `find`) in `kis/apps/broadcasts/migrations/`: `0041_channelcontentchapter_channelcontent_tags.py`, `0017_broadcast_health_profile_tables.py`, `0058_channelcontent_search_vector_and_more.py`, `0048_widen_broadcastvideo_url_fields.py`, `0034_channellivestream.py`, `0046_channeladcampaign_channelcontentcopyrightclaim_and_more.py`, `0010_add_metadata_to_broadcastitem.py` — confirms the system has live streaming, ads, copyright claims, and full-text search at minimum.
- Also observed: `kis/apps/communities/migrations/0007_communitypost_is_broadcast.py` and `0013_community_broadcast_settings.py` — the Communities app has its own broadcast-adjacent fields, scope/relationship to the main broadcasts app not yet investigated.
- Also observed: `kis/apps/media/test_channel_content_video_upload_context.py` and `kis/apps/notifications/test_email_channel_reachability.py` — the latter is almost certainly the "email channel" (notification delivery channel) meaning of "channel," NOT the broadcast-channel meaning — worth flagging in the final report as a naming collision, similar to the NewChannelForm/VerificationChannelSelectScreen disambiguation already assigned to Agent 4.

## ROUND 2 RESULTS — 2 of 4 agents completed (as of this save)

### Agent 1 (Django backend) — COMPLETED — agent id `aee9343a85335d1e5`

**Scope correction, important:** `apps.channels` (5 migrations, small) is **NOT** the video/content system — it's Discord-style text/announcement/voice messaging channels backed by a chat `Conversation`, owned by a Partner/Community (`Channel` model: partner/community FK, channel_type text/announcement/private/voice, owner, 1:1 conversation with send_policy=ADMINS_ONLY, avatar_url, is_archived; `Subchannel` = nested topic unit). The real YouTube-style broadcast/content platform lives entirely inside **`apps.broadcasts`** (176KB models.py, 1MB views.py, 124KB serializers.py, 66 migrations) under the `BroadcastChannel`/`ChannelContent` family. Two genuinely separate concepts sharing the word "channel" — do not conflate in the final report.

**`apps.broadcasts` core models:**
- `BroadcastChannel` — real creator/org channel. `owner_type` (user/shop/health/education/partner) + polymorphic `owner_id`, `owner_user` FK (only for owner_type=user), unique case-insensitive `handle`, payout fields for BOTH Flutterwave subaccount AND Stripe Connect, `trailer_content`/`featured_content`.
- `ChannelContent` — the post/video/image/poll/live-stream unit. `content_type` enum (video/short_video/image/gallery/text/rich_text/audio/document/link/poll/event/live_stream/replay), `status` (draft/scheduled/published/processing/failed/archived), `visibility` (public/unlisted/private), Postgres `search_vector` (GIN-indexed, kept in sync via post_save signal — real FTS), `age_restriction`/`content_rating`, `legacy_broadcast_item`/`legacy_feed_entry_id` bridge fields to old system.
- `ChannelContentAsset` — per-content media, processing_status, dimensions, transcode metadata.
- `ChannelLiveStream` — provider/provider_stream_id/ingest_url/stream_key_hash/playback_url, latency_mode, DVR window.
- Engagement: `ChannelContentReaction`, `ChannelContentSave`, `ChannelContentComment` (threaded via parent), `ChannelCommentReaction`, `ChannelContentPollVote`.
- Creator tools: `ChannelContentChapter`, `ChannelContentClip`, `ChannelContentSubtitle`, `ChannelContentEndScreen`/`Card`, `ChannelContentAutoChapterSuggestion`, `ChannelHomepageShelf`/`ShelfItem`.
- Monetization: `ChannelMembershipTier`/`ChannelMembership`, `ChannelContentTip` (Super Thanks), `ChannelLiveStreamTip` (Super Chat), `ChannelMonetizationSettings`, `ChannelPayoutRequest`, `ChannelMembershipGift`.
- Ads: `ChannelAdCampaign` → `ChannelAdSlot` (pre/mid/post-roll) → `ChannelAdImpression`.
- Rights/safety: `ChannelContentCopyrightClaim`, `ChannelContentFingerprint` (sha256/perceptual/audio) → `ChannelFingerprintMatch`, `ChannelModerationRecord` (channel/content/comment targets), `ChannelKeywordFilter`.
- Analytics: `ChannelAnalyticsDailyRollup`, `ChannelContentDemographicSnapshot`, `ChannelContentTrafficSource`.
- **Legacy parallel system still live (not removed)**: `BroadcastItem` (polymorphic source_type/source_id, FKs to the *messaging* Channel, expires_at TTL + cleanup job), `BroadcastReaction`, `BroadcastEngagementEvent`, `BroadcastFeature`/`FeatureFlag`.
- **Separate older video model**: `BroadcastVideo` — own moderation_status lifecycle (pending_review/passed/blocked/deleted) with hard expiry on approval — NOT the same gate as `ChannelContent`.
- Also present but out of requested scope: full Health-institution marketplace models + a very large Education LMS (70+ model classes) sharing the same app/file.

**Migrations:** 66 in broadcasts, 5 in channels. 0001–0005 simple BroadcastItem/features/videos/lessons → 0030s engagement events → **0032–0035 big bang**: BroadcastChannel/ChannelContent/ChannelLiveStream/embed policy introduced together → later migrations layer monetization/ads/copyright/fingerprinting/search-vector/widened URL fields → 0061 STILL touches old BroadcastItem (added save_count) confirming legacy system is actively maintained, not dead → 0063–0064 recent Education hierarchy work. Nothing looked reverted/self-contradicting.

**API surface:** 154 URL patterns total, ~95 broadcast/channel-scoped (rest Education). Full CRUD+actions per BroadcastChannel (subscribe/report/moderation-queue/analytics/contents/playlists/live-streams/payout-Stripe-connect) and ChannelContent (publish/schedule/assets/embed-token/react/poll/save/share/view/report/comments/clip/chapters/subtitles/end-screen/cards/geo-restriction/premiere/auto-chapters/fingerprint), live-stream lifecycle (stream-key/start/end/webhook/polls/Q&A), monetization (membership-tiers/tips/gifts), copyright (claims/dispute), ads (campaigns/slots/impressions), discovery (search/categories/queue), public/embed/oEmbed/robots.txt/sitemap SEO views, PLUS parallel legacy `broadcasts/<uuid:pk>/{react,comment-room,share,view,save,hide,report}` set. `views_internal.py` = separate internal-only Nest→Django HMAC-signed callback surface for post-upload video processing.

**Business logic highlights:**
- `moderation_gate.py` — single authoritative "may this go public" rule for BroadcastVideo: fail-closed, requires explicit human PASS with revalidation expiry (default 90 days via `BROADCAST_MODERATION_REVALIDATION_DAYS` env), AI scan alone never sufficient. Used from exactly 2 call sites by design (list queryset filter + stream-time re-check). Well-designed.
- `media_pipeline.py` / `scan_channel_asset_payload_for_explicit_content` — closes real gap: channel content assets used to trust client-self-reported processing_status (so a dishonest/buggy client could skip scanning). Now does real scan via `ContentSafetyProvider` reading actual stored object; fails closed on ambiguous verdicts/scan exceptions/unresolvable storage paths.
- `live_stream_providers.py` — live streaming is self-hosted via **kisvideo-live** (MediaMTX-based RTMP+WHIP ingest), the ONLY provider — Mux fully retired for live 2026-09-23. Supports simulcast via `ChannelLiveStreamTarget`. ⚠️ `kisvideo_provider.py`'s docstring (separate VOD-transcode file) still says "live streaming stays on Mux" — STALE/contradictory comment, cosmetic fix needed.
- `kisvideo_provider.py` — VOD transcoding via self-hosted kisvideo, tus resumable-upload protocol server-to-server.
- `tasks.py` (Celery) — `push_asset_to_kisvideo` (retrying, re-checks enable flag at execution time), `purge_expired_broadcasts_task` (scheduled wrapper for `cleanup_expired_broadcast_items`), plus Education-booking sweep tasks (not broadcast-scoped).
- `signals.py` — keeps ChannelContent.search_vector in sync; fires engagement notifications on comments/first reaction. ⚠️ **POTENTIAL BUG**: uses `content.channel.owner_user_id` as notification recipient — that's `None` for every non-`owner_type=user` channel (shop/health/education/partner-owned), so comments/reactions on institution-owned content likely notify NO ONE. Needs confirming whether `notify_engagement` handles None gracefully, and whether institution channels should notify via `BroadcastChannelRole` holders instead.
- `views_internal.py` confirms real, CURRENT Nest↔Django integration: Nest owns direct-to-S3 signed-URL client upload; Django's internal HMAC-authenticated endpoint does server-side work (duration probe/thumbnail/DB row) reading the object back from shared S3 after Nest signals completion.

**Tests:** ~16 dedicated test files outside the 242KB catch-all tests.py (not read in full). Two read fully:
- `test_channel_asset_explicit_content_scan.py` — thorough fail-closed coverage (non-scannable types skip cleanly, safe passes, prohibited rejected pre-persist, ambiguous→human review not auto-reject, scan exceptions/unresolvable paths fail closed, stub-mode fallback correct).
- `test_broadcast_channel_org_ownership.py` — regression-locks a real prior bug (org-owned channel creation for shop/health/education/partner used to be hard-rejected despite model support); verifies role-based auth per owner type, 404 on nonexistent owner, 400 on invalid owner_type, and that owner_id is public for org channels but HIDDEN on serialized response for individual-user channels (privacy: no raw user UUID leak).
Other test file names suggest coverage of: moderation gate, kisvideo integration, video stream range requests, gift-membership email/payment, livestream guest-invite email, content-safety wiring, long-lived broadcast categories, recommendation reasoning, expired-item purge.

**Admin:** Registered — BroadcastChannel, BroadcastChannelRole, BroadcastChannelSubscription, BroadcastPlaylist, ChannelContent, ChannelContentAsset, ChannelModerationRecord, ChannelAnalyticsDailyRollup, Health-marketplace models, legacy BroadcastItem. **GAP**: nothing registered for ChannelLiveStream, ChannelContentComment/Reaction, ChannelContentCopyrightClaim, ChannelAdCampaign/AdSlot, ChannelMembershipTier/Membership, ChannelContentFingerprint, ChannelHomepageShelf — staff have NO Django-admin visibility into live streams, copyright disputes, ad campaigns, or monetization.

**Open questions flagged by this agent:**
1. Confirm the two parallel broadcast systems (legacy BroadcastItem+Channel vs new ChannelContent+BroadcastChannel) is an intentional in-progress migration (old data preserved, new writes go to new system) not two live code paths both still being written to.
2. ChannelContent has no pass/fail moderation lifecycle equivalent to BroadcastVideo's (moderation_gate.py's own docstring flags this asymmetry) — worth same revalidation rigor if ChannelContent is the actively-growing surface.
3. Institution-owned-channel notification gap (signals.py) — confirm against notify_engagement's null-handling.
4. Stale "live streaming stays on Mux" comment — cosmetic fix.
5. Admin coverage gap (live streams/copyright/ads/monetization) — intentional or oversight?

---

### Agent 2 (NestJS legacy module + archived gateway) — COMPLETED — agent id `a876dd94052f5a788`

**VERDICT: ACTIVE code, but functionally DEAD at the HTTP layer.** Not abandoned in the "nobody maintains this" sense — current code in the live chat-service deployment, wired into `AppModule` right now. But untouched since the single commit that created it (`56d456a`, 2026-03-29, author BahNigel) across 77 subsequent commits / ~6 months of repo history. Both entry points gated behind feature flags (`FF_BROADCAST_CORE` on BroadcastController, `FF_FEEDS_BROADCAST` on FeedsController) that do NOT appear in `.env`, `.env.example`, or `docker-compose.yml` anywhere in the repo — `FeatureFlagGuard` defaults an unset flag to `'0'` (off), so every route behind both controllers 403s/no-ops in any environment using these files as-is.

**Repo identity:** This is NOT "kis-auth" (separate sibling repo/service at `backend/kis-auth`). `package.json` names THIS repo `"chat-service"` — Fastify+Socket.IO NestJS service whose canonical module is `ChatModule` (realtime messaging/presence), with `BroadcastModule`+`FeedsModule` as smaller side-features sharing its MongoDB connection (`@nestjs/mongoose`+`mongoose` confirmed, `@Schema` decorators throughout — genuinely Mongoose/MongoDB, not Postgres).

**Scope vs Django:** Much thinner, different concept than Django's apps/broadcasts. Two Mongo collections only:
- `BroadcastItem` — tenant-scoped feed-post wrapper: vertical/sourceType/sourceId/title/body/attachments/visibility/engagement counters, cursor-paginated by broadcastedAt.
- `BroadcastReaction` — userId+type, unique-indexed per item.
`BroadcastVertical` enum has exactly ONE member (`FEEDS`). Reads as infrastructure stubbed out to let a chat/feed post get "broadcast" (republished) into a public tenant-wide feed, emitting `broadcast.created` Socket.IO event to room `broadcast:tenant:{tenantId}`. NOT a channel/live-streaming/content-publishing system like Django's — no live streaming, no ads, no copyright, no moderation, no search here at all. Reads as early scaffolding for a "share this chat message to the public feed" feature, built once and shelved — not a competing implementation of Django's domain.

**Real callers exist** (why this isn't pure dead code): FeedsController's `POST :id/broadcast` and `POST broadcast-from-channel` both call `BroadcastService.createItem()`; addComment/reaction-toggle paths too — but the whole controller sits behind the unset `FF_FEEDS_BROADCAST` flag, so none of it executes in current config.

**Archived GraphQL gateway:** Confirmed genuinely dead — zero files outside `graphql-gateway.archived-2026-07-29/` reference it anywhere in Nestjs/kis-auth/kis (grep returns nothing); fully standalone package nothing depends on. Bonus finding: its broadcast-detail/institution-broadcasts/broadcast-bookings loaders are about a DIFFERENT "broadcast" domain — education-institution broadcasts/bookings via an EducationSDK (per ADR-0001, gateway aggregated Django+NestJS for mobile screens, retired 2026-07-29, replacement not stated in what was read). Just a third naming collision, not overlapping scope with either the Django content platform or the NestJS chat-service stub.

**NAMING COLLISION TALLY so far (3 distinct "broadcast"/"channel" meanings confirmed unrelated to the main content platform):**
1. `apps.channels` Django app = messaging/announcement channels (not video content).
2. NestJS chat-service `BroadcastModule` = dormant "republish chat post to public feed" stub, unrelated Mongo collections.
3. Archived GraphQL gateway's broadcast loaders = Education-institution broadcasts/bookings, different domain, already fully dead.
(Frontend agents 3 &amp; 4 were also tasked with checking 2 more potential collisions: `NewChannelForm.tsx`/`VerificationChannelSelectScreen.tsx` on the RN side, and `kis/apps/notifications/test_email_channel_reachability.py` — "email channel" almost certainly means notification delivery channel, not broadcast channel. Confirm when those results land.)

---

### Agent 3 (RN frontend — broadcast feeds) — COMPLETED (round 3) — agent id `a826ff9e9d933a69f`

**Most important finding: two entire parallel data-flow stacks exist for broadcast feeds, and only one is actually live.**

Re-verified navigator finding: `App.tsx` imports `BroadcastDetailScreen` directly into its root stack. `FeedsNavigator.tsx` + `FeedsListScreen.tsx` exist but only import each other — zero references from `App.tsx` or anywhere else. **Genuinely orphaned dead code.**

**Dead stack** (reachable only via the orphaned `FeedsListScreen`): `src/hooks/useBroadcastFeed.ts` + `src/types/broadcast.ts` (`BroadcastItem` type). Explicitly designed to prefer the **NestJS** chat-service feeds endpoint (`ROUTES.feeds.list` → `NEST_API_BASE_URL/api/v1/feeds/`) with Django as fallback, and listens for NestJS's `broadcast.created`/`broadcast.reaction` Socket.IO event names. The `BroadcastItem` shape (`vertical:'feeds'`, `sourceType:'feed_post'`, Mongo-style `_doc`/`_id`) is clearly modeled on the dormant NestJS Mongoose schema Agent 2 found feature-flagged off. **Since nothing routes to FeedsListScreen, this entire hook+type+normalization layer is unreachable in the running app.**

**Live stack** (what the app actually uses): `src/screens/broadcast/feeds/hooks/useFeedsData.ts` (682 lines) + a separate `BroadcastFeedItem` type, via `feeds.endpoints.ts` → `FEEDS_ENDPOINT` → resolves to `${API_BASE_URL}/api/v1/broadcasts/` — **Django, exclusively**, no NestJS fallback. Matches the Django backend API surface exactly. Powers `BroadcastFeedsPage.tsx` and `BroadcastDetailScreen.tsx`, confirmed by passing tests `broadcast-feeds.useFeedsData.test.tsx`/`broadcast-feeds.discover-page.test.tsx`.

**Net effect:** `src/types/broadcast.ts` looks like "the" feed item type but is dead. The real contract is `BroadcastFeedItem` from `broadcast/feeds/api`. Future work should build on `useFeedsData.ts`, not `useBroadcastFeed.ts`.

**Video playback hardening** (from `broadcast-detail-screen.video-hardening.test.tsx`): lifecycle-aware play/pause (pauses on focus-loss and app-background, resumes on foreground, never spuriously pauses while focused+active); only one video preview instance ever mounted at a time (singleton-mount guard); full-screen page renders without a transform style — explicitly "the SurfaceView-under-transform fix" for a well-known Android bug where native `SurfaceView` video layers don't respect CSS-style transforms on ancestors. From `video-playback.test.tsx`: safe-source preference, dedup, host-risk metadata, loopback/local-URL rewriting onto the configured backend, stream→file fallback — hardening against mixed-content/local-dev-URL leakage into production.

**Upload flow** (`uploadBroadcastVideo.ts`): direct-to-S3 via NestJS (not multipart POST to Django, to dodge nginx's body-size limit) — only small JSON round-trips (presigned-URL initiate/confirm) hit the request path. Thumbnail upload is best-effort/non-blocking (Django auto-generates a frame-grab if none supplied). Post-confirm, Django does the real work via the same internal webhook Agent 1 found in `views_internal.py` — confirms this Nest↔Django integration point independently from both sides. `mapServerVideoAttachment` surfaces moderation fields (`processing_status`, `quarantined`, `requires_review`, `safety`) directly to the client, consistent with Agent 1's `moderation_gate.py` findings.

**5th naming collision confirmed:** `src/screens/calls/components/BroadcastLayout.tsx` = call-UI grid layout (`CallParticipant[]`, `CallTimer`) used only by `ActiveCallScreen.tsx` — "broadcast" here means a TV-style multi-participant call grid, unrelated to content publishing.

**Test coverage** (8 files, one line each): attachment-preview dedupes repeated attachments; video-playback covers safe-source/dedup/host-risk/loopback-rewrite/fallback/failure-state; feed-card-video shows play cue only on the active card; discover-page covers list+filter+detail+comments+share+save/hide/subscribe w/ error alerts; detail-screen covers react/comment/save/share + shared video contract; useFeedsData covers pagination+optimistic updates (**deliberate asymmetry: hide is never applied optimistically**, unlike react/save/subscribe — treated as too risky to false-positive); trending-card dedupes repeated first attachment; video-hardening covers the 3 lifecycle/mount/transform fixes above. No TODO/FIXME found anywhere in scope.

**Gap flagged by this agent:** the 5 category pages (Healthcare/Market/Education/Jobs/Feeds) and several smaller components (BroadcastersRow, BroadcastMainTabs, BroadcastHeaderBar, BroadcastSearchRow, BroadcastAuthorProfileSheet, ChannelAvatar, resolveBroadcastPosterId) were not read in full — budget went to the data-flow/dead-code investigation, which surfaced the more architecturally important finding. `useFeedsData.ts` does contain an `isHealthcareFeedItem` filter excluding healthcare items from the general trending feed, implying the category pages likely share `useFeedsData.ts` with category-specific filtering rather than separate implementations — inferred, not directly confirmed.

---

### Agent 4 (RN frontend — channels/studio/partners) — COMPLETED (round 3) — agent id `a4f52ee0b5657e0c2`

**⚠️ Working-tree warning this agent surfaced:** `git status --short` in `~/dev/KIS` shows **uncommitted modifications** to `App.tsx`, `src/navigation/types.ts`, `src/network/routes/broadcastRoutes.ts`, `src/screens/market/ProductEditorDrawer.tsx`, `src/screens/market/orders/MarketplaceOrderDetailPage.tsx`, `src/screens/tabs/ProfileScreen.tsx`, plus untracked `src/screens/market/admin/` and `src/screens/market/returns/`. **This means `broadcastRoutes.ts` (and the root navigator) may have drifted from what every agent in this whole analysis read** — treat exact endpoint paths/route wiring cited anywhere in this doc as "as of a slightly stale snapshot" until a `git diff` is reviewed. Not part of this analysis to fix — flagging for whoever resumes work here next.

**Channel data model** (`channels.types.ts`): `BroadcastChannelSummary` (id/handle/display_name/description, **server-computed avatar** — `avatar_kind: 'logo'|'photo'|'initials'` + `avatar_display_url`/`avatar_initials`, never trust raw `avatar_url` directly, category/language/country/verification/subscriber+content counts/`is_subscribed`/`viewer_role`); `BroadcastChannelContent` (content_type/title/description/text+rich-doc/assets/status/visibility/engagement_counts/tags/scheduled_at/age_restriction); full live-stream type (YouTube-parity: status/provider/ingest/playback/DVR/latency-mode); threaded comments/chapters/moderation records. **Owner can be `user | shop | health | education | partner`** — confirmed directly in `ChannelStudioScreen.tsx`'s owner-type picker, which loads options from `commerce.shops`, `healthOps.institutions`, `broadcasts.educationHub`, or `partners.list` (filtered by `can_manage`) depending on the selected type. Partner is one of five owner types, not exclusive.

**Studio feature set**: `ChannelStudioScreen.tsx` is a 20-tab creator workspace (dashboard/content/create/branding/playlists/live/analytics/moderation/revenue/audience/copyright/ads/impressions/traffic/subtitles/chapters/endscreens/cards/shelves/settings) grouped into 5 categories (Content/Live/Growth/Brand/Protect). Multi-channel support via pill switcher. **Real prior bug fix documented inline**: live-streaming tab's tier gate used to read `user?.profile?.tier` (always undefined — `ProfileSerializer` has no tier field) instead of the correct `user?.tier` (top-level on `UserSerializer`), silently blocking every Partner/Partner Pro account from live streaming; now fixed and gates on `isTierAtLeast(user?.tier, 'partner')`. Most monetization/analytics tabs render explicitly-marked "Creator Pro / Growth" locked-preview cards — not real functionality yet, clearly labeled as such (not deceptive).

**Channels ↔ Partners — the real finding, two false friends identified:**
- `PartnerChannelsPanel.tsx` ("Channels & Categories") → actually the Discord-style **messaging** channels (`apps.channels`), posts to `ROUTES.channels.createChannel`. Not broadcast content.
- `PartnerBroadcastCenterPanel.tsx` ("Broadcast Center") → **also not `BroadcastChannel`** — it's `apps.partners.PartnerPost` scheduled announcements (send-now/schedule-later, backed by a `django_celery_beat` 5-min sweep). **A 6th, entirely separate "broadcast" concept.**
- The *actual* Channel↔Partner link is simply: a `BroadcastChannel` can have `owner_type='partner'` + `owner_id`, selected via Channel Studio's owner-type picker. **There is no dedicated "partner's broadcast channels" management surface distinct from Channel Studio itself** — both partner-admin panels that sound like they'd be it are false friends.

**Realtime** (`useChannelSocket.ts`): clean ref-stable `DeviceEventEmitter` listener (not a direct socket subscription — `SocketProvider` forwards server events through `DeviceEventEmitter`). 5 events, each optionally filtered by channelId/streamId: `channel.live.started`, `channel.live.ended`, `channel.viewer.count`, `channel.chat.message`, `channel.content.published`.

**`NewChannelForm.tsx` — definitively resolved:** unrelated to broadcast channels. Posts to `ROUTES.channels.createChannel` with payload `{name, slug, description, partner, community, avatar_url}` — exact shape match for the Discord-style messaging `Channel` model. Lives in `AddContacts` module for exactly that reason. **This closes out naming collision #1's disambiguation** (same concept as `PartnerChannelsPanel`, not a new collision).

**Docs findings — 2 MORE unrelated "broadcast" concepts uncovered (7th and 8th overall):**
7. `education-ux-v2-visual-and-broadcast-pass.md` confirms `src/screens/education/provider/BroadcastsScreen.tsx` = Education-institution announcements (`institution_notice`/`broadcast_kind`, optional course/event link, draft/published/archived) — was deleted in a rewrite and had to be rebuilt from scratch. **Open risk the doc itself flags**: the learner-facing `InstitutionProfileScreen` calls staff-oriented endpoints and the author couldn't verify non-staff read access against a live backend — degrades to empty section rather than crashing, but unverified.
8. `phase-04-broadcast-partner-and-profile-shell-unification.md` confirms `BroadcastProfilesSection.tsx` **IS** correctly in-scope for the real `apps.broadcasts` system (generic JSON "profile shell" data for health/market/education domain profiles, boundary-documented 2026-04-26 vs. true broadcast-feed-owned data) — not a collision, just noting it exists. Also notes the Django `apps.broadcasts` test suite "stalled during the repo's existing test-database setup path" — a pre-existing test-infra issue, not caused by this phase of work.

**`ChannelAvatar.tsx`**: props `{channel: {id?, handle?, avatar_kind, avatar_display_url, avatar_initials} | null, size: number}`. Explicit comment notes it replaces 3 previously-uncoordinated avatar-fallback implementations across `ChannelHomePage`, `ChannelsDiscoverPage`, `BroadcastFeedCard`/`BroadcastAuthorProfileSheet` — a deliberate, well-executed consolidation. `avatar_kind='logo'` uses a bundled local asset (zero network dependency) for GO's official channels.

**Studio stubs** (explicitly labeled, not silently broken): Playlists tab — "prepared for the playlist API; no public playlists are available yet." Settings tab — "will be wired as backend policies are finalized."

## FULL NAMING COLLISION TALLY — 8 confirmed distinct "broadcast"/"channel" meanings unrelated to the real BroadcastChannel/ChannelContent platform

1. `apps.channels` Django app / `PartnerChannelsPanel.tsx` / `NewChannelForm.tsx` = Discord-style messaging/announcement/voice channels, owned by Partner or Community, backed by a chat Conversation. (Same concept across backend + 2 frontend surfaces.)
2. NestJS chat-service `BroadcastModule` = dormant "republish chat post to public feed" stub (Mongoose, 2 collections), feature-flagged off everywhere, untouched ~6 months.
3. Archived GraphQL gateway's broadcast loaders = Education-institution broadcasts/bookings via EducationSDK, fully dead (zero external references).
4. `VerificationChannelSelectScreen.tsx` = OTP delivery channel (sms/email/whatsapp).
5. `src/screens/calls/components/BroadcastLayout.tsx` = TV-style multi-participant call-UI grid layout, unrelated to content publishing.
6. `PartnerBroadcastCenterPanel.tsx` = `apps.partners.PartnerPost` scheduled announcement posts (Celery-beat sweep), not BroadcastChannel.
7. `src/screens/education/provider/BroadcastsScreen.tsx` = Education-institution announcements (`institution_notice`).
8. `kis/apps/notifications/test_email_channel_reachability.py` = notification delivery channel (email) — presumed by naming pattern-match to #4, never explicitly opened/verified by any agent; low-risk to leave unconfirmed given the strong pattern match, but technically still inferred not confirmed.

`BroadcastProfilesSection.tsx` is notably NOT a collision — confirmed genuinely in-scope for the real platform.

## Next step
All research is complete. Ready to synthesize into a single published artifact (visual report) covering: system map disambiguating all 8 naming collisions from the real platform, Django data model, API surface, business logic/moderation highlights, live-streaming architecture, the dead-vs-live NestJS module finding, the dead-vs-live RN frontend data-stack finding, Channel Studio feature set, Channels↔Partners relationship, test coverage, and the consolidated list of open issues/risks flagged across all 4 agents (stale Mux comment, institution-channel notification gap, admin-panel coverage gaps, moderation-lifecycle asymmetry, uncommitted working-tree drift, unverified learner-endpoint access, stalled Django test-db setup).

This is a read-only audit — no code changes are pending or expected until the user reviews the findings and asks for specific fixes/changes.
