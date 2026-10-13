# KIS UX/UI Overhaul — Master Checklist

Phase 2 output. Source: the 11 Phase 1 inventory files in `docs/ux-overhaul/inventory/*.md`
(1,172 files, 100% inventoried at the "what exists" level — see `STATE.json` for per-batch
counts). This checklist tracks the **real, concrete issues** those inventories surfaced, not a
row-per-file restatement of the inventory itself (that already exists in the per-domain files).

Status values: NOT STARTED / AUDITING / ISSUE IDENTIFIED / FIX IN PROGRESS / FIXED / TESTING /
VERIFIED / BLOCKED.

Scope note: the exhaustive deep UX/visual/psychology/accessibility passes (Phases 3–8) have
**not** been run file-by-file yet — this checklist captures what Phase 1's inventory-level read
already surfaced, which is itself substantial. Phase 3+ will extend this document, not replace it.

---

## P0 — Critical

### P0-1: Age gate has no server-side enforcement
- **Screen:** `src/screens/broadcast/AgeGateScreen.tsx`
- **Problem:** The screen's own header comment admits it is pure client-side self-attestation. There is no birthdate field on the User model and no backend check — a user can simply tap through regardless of actual age.
- **User impact:** Content-safety/compliance gap, not just a UX issue — affects whatever age-restricted content this gate is meant to protect.
- **Proposed correction:** Requires a backend change (birthdate field + server-side check), which is outside pure frontend UX scope and has product/legal policy implications.
- **Status:** ISSUE IDENTIFIED — flagged for explicit decision, NOT implemented this session (needs product/legal sign-off on what "enforcement" should mean, and backend coordination).
- **Severity rationale:** P0 because it's a safety control that currently provides no real protection, not merely a rough edge.

---

## P1 — High

### P1-1: Giving/pledge screens charge immediately with no pre-submit confirmation
- **Screens:** `GiveNowScreen`, `ChurchPledgeScreen`, `CrowdfundDetailScreen` (church/family domain)
- **Problem:** All three fire the monetary charge immediately on button press; the only feedback is a post-hoc "Thank You" alert. No screen shows the amount back to the user for confirmation before the charge is recorded.
- **User impact:** A mistyped amount or accidental tap becomes an unrecoverable charge with no safety net — violates "destructive actions have appropriate safeguards."
- **Status:** VERIFIED. Added a pre-submit `Alert.alert` confirmation (Cancel / "Confirm $X") to all three screens, echoing back amount + type/campaign details. Original submit functions renamed (`performSubmit`/`performCreate`/`performContribute`) with byte-identical bodies — payment/charge logic itself untouched, only gated on explicit confirmation. Verified via `git diff` (matches self-report) and independently re-run `npm run typecheck` (clean, repo-wide).

### P1-2: `profitability/**` components are blank stubs in 6 live screens
- **Files:** all 10 files under `src/components/profitability/**`
- **Problem:** Every file is a byte-identical `return null` stub. 6 are actively mounted inside real screens (Shop, Broadcast, Bible, Channel Studio, Health), so those screens render a silent empty hole where profitability UI should appear.
- **User impact:** Visually broken/incomplete-looking screens; a physical-device tester would immediately notice a blank gap.
- **Status:** VERIFIED. Git history confirmed all 10 were stub-from-day-one (single commit, no removed implementation to resurrect). Of the 10, 6 are live-mounted (`CommerceRevenuePreviewCard`, `ConsumerSpiritualRevenuePreviewCard`, `EnterpriseKcanRevenuePreviewCard`, `HealthRevenuePreviewCard`, `NotificationRetentionPreviewCard`, `TrustPromotionRevenuePreviewCard`) and all consuming call sites pass only `title`/`subtitle`/`label`/`icon` — never real revenue numbers — confirming no fabricated-data risk. Replaced `return null` with an honest visible card (reusing `KISText` + theme palette) showing the existing "coming soon / preview only" messaging instead of a blank hole. The other 4 (`CompactProfitabilityPreviewCard`, `EducationRevenuePreviewCard`, `InstitutionMonetizationPreviewCard`, `PartnerRevenuePreviewCard`) confirmed genuinely dead (zero importers) — left untouched, folded into P2-2's dead-code list. Verified via `git diff` (matches self-report exactly) and independently re-run `npm run typecheck` (clean).

### P1-3: Systemic silent error-swallowing in admin/partner panel data hooks
- **Files:** majority of `usePartnerXXXPanel`/`useAdmin*Panel` hooks in `src/screens/tabs/partners/**`, plus similar pattern in `src/components/partners/**`
- **Problem:** Nearly every network request uses `catch {}` with `errorMessage: ''` — a failed fetch (analytics, audit trail, system health, verification, etc.) just leaves stale/empty state with zero user-visible feedback or retry affordance.
- **User impact:** Admins/partners have no way to know a panel failed to load vs. is legitimately empty — directly violates "users can recover from failed network requests."
- **Status:** VERIFIED — now COMPLETE across all identified instances (34 files total, fixed in two batches this session). Batch 1 (8 highest-traffic panels mounted from `PartnersScreen.tsx`): `PartnerMembersPanel`, `PartnerChannelsPanel`, `PartnerDiscoveryPanel`, `PartnerEventsCalendarPanel`, `PartnerSupportInboxPanel`, `PartnerResourcesPanel`, `PartnerTasksPanel`, `PartnerTaskBoardsPanel`. Batch 2 (remaining 26): `PartnerActivityPanel`, `PartnerAnalyticsPanel`, `PartnerAuditPanel`, `PartnerAutomationPanel`, `PartnerBibleScreen`, `PartnerBroadcastCenterPanel`, `PartnerBudgetTrackingPanel`, `PartnerCoursesPanel`, `PartnerDonationTrackingPanel`, `PartnerGovernancePanel`, `PartnerLeadershipPanel`, `PartnerMembershipRulesPanel`, `PartnerMessagingView`, `PartnerOrgStructurePanel`, `PartnerOrganizationProfilePanel`, `PartnerPolicyPanel`, `PartnerPostTemplatesPanel`, `PartnerRecruitmentPanel`, `PartnerReportsPanel`, `PartnerRolesPanel`, `PartnerSurveysPanel`, `PartnerTrainingTracksPanel`, `PartnerVerificationPanel`, `PartnerVolunteerRosterPanel`, `PartnerWorkspaceBrandingPanel`, `TabTemplateManager`. Each now sets an `error` state on request failure and renders an inline error box + "Tap to retry", reusing the same established pattern — no new API contracts, no success-path changes. Critically verified: `PartnerAnalyticsPanel`'s and `PartnerLeadershipPanel`'s pre-existing "unavailable_metrics" honest-empty-state pattern (for data that's genuinely not computed server-side, as opposed to a failed request) was correctly left untouched — confirmed via `git diff` that the distinction was honored, not conflated. `PartnersCenterPane.tsx`'s one intentional "stale data is fine" swallow correctly left alone too. Verified via `git diff` spot-checks (matches self-reports) and independently re-run `npm run typecheck` (clean, repo-wide, confirmed on retry after one transient classifier block).

### P1-4: Content-safety-adjacent orphaned screens are fully built but unreachable
- **Files:** `HealthcareScreen.tsx` (4,228 lines, tabs domain — largest file in the app), `CommentThreadScreen.tsx`, `MesssagingSubTabs/HubTab.tsx` (439 lines, fully-built channels hub), `ProfileInsightsScreen.tsx`, `HealthInstitutionsScreen.tsx`, `InstitutionOnboardingScreen.tsx`
- **Status:** INVESTIGATED individually (re-verified zero importers on all 6, then read each in full to judge wired-up vs. superseded vs. ambiguous). Resolution per file:
  - **`CommentThreadScreen.tsx`** — CONFIRMED SUPERSEDED. `CommentThreadPanel` (the component it wraps) is already rendered inline as a modal/sheet from `FeedScreen.tsx`/`BroadcastFeedCard.tsx` — the live comment-viewing path. This full-screen-route variant is dead weight. **Recommended for deletion — not deleted**: the permission system blocked further file deletions this session (both via a subagent and via my own direct `rm`) after the earlier large dead-code-deletion batch, as a deliberate safety response to that batch. I did not attempt to route around this block. Needs either explicit user approval to delete, or a permission-settings change, to complete.
  - **`HealthInstitutionsScreen.tsx`** — CONFIRMED SUPERSEDED. `src/screens/tabs/profile-screen/HealthManagementModal.tsx` (rendered from `ProfileScreen.tsx`) already wraps the same `InstitutionsListScreen` as a modal, with its own equivalent data-fetching/handlers. Same deletion-blocked status as above.
  - **`ProfileInsightsScreen.tsx`** — GENUINE MISSING FEATURE, not wired up. It's a complete "my profile insights" dashboard (top content + recent notifications, using the shared `InsightLayout` pattern) but only `PartnerInsightsScreen` is registered in `App.tsx` — there is no "my own insights" screen for a regular user currently reachable. NOT wired up this session: adding the route itself is low-risk, but finding the *right* place to link it from `ProfileScreen.tsx` without reading that screen's full layout risks guessing wrong on product IA. Recommend a dedicated small follow-up: register the route, then decide the entry point deliberately.
  - **`InstitutionOnboardingScreen.tsx`** — GENUINELY AMBIGUOUS, left untouched. It's a much richer multi-step onboarding wizard (identity/location/contact/media/compliance docs) than the live `HealthInstitutionManagementScreen.handleSave` flow (bare name/type/employee-count), and posts to a different endpoint. Could be a more-complete feature that should replace the current simple flow, or an abandoned early design that was deliberately simplified. Could not confidently tell which without product input — documented rather than guessed.
  - **`MesssagingSubTabs/HubTab.tsx`** — GENUINE MISSING FEATURE, high confidence, not wired up. It's a complete "Channels & Broadcasts hub" (WhatsApp-style discovery + subscribed feed) built as a sibling to `UpdatesTab.tsx`/`CallsTab.tsx`, both of which ARE wired into `MessagesScreen.tsx`'s tab bar — `HubTab` alone was never added. No live equivalent exists anywhere else. NOT wired up this session: `MessagesScreen.tsx` is a 2,700+ line, actively-evolving file (Messages-tab redesign work has been in flight from other sessions this same day) and correctly wiring a new tab (icon, label, scroll-ref forwarding matching the `ref={updatesTabRef}` pattern) risks colliding with that in-flight work or getting a detail wrong without reading the whole tab-bar implementation. Flagged as the single highest-confidence "ship this" item in the whole checklist, pending either a dedicated session or the user's go-ahead.
  - **`HealthcareScreen.tsx`** (4,228 lines) — NOT a simple orphaned screen at all. It's a complete, major EHR-style patient health-record feature (telemedicine sessions, medications, vitals, immunizations, patient-access grants/revocation, document creation) — genuinely different in scope from the live `BroadcastHealthcarePage.tsx` (a healthcare content feed), not superseded by it. Deliberately NOT wired into navigation: this is health-record privacy/compliance surface area and a major feature shipment, not a bug fix — exactly the kind of consequential, not-easily-reversible decision that needs the user's explicit review before going live, not something to activate unilaterally while they're away.

---

## P2 — Medium

### P2-1: Massive duplicated boilerplate across 34+ partner slide-panel hooks
- **Files:** `src/screens/tabs/partners/**` — 34 of 46 `usePartnerXXXPanel.ts`/`useAdmin*Panel` hooks are byte-for-byte identical slide-panel open/close/animate logic (~1,600 lines).
- **Problem:** Any future UX change to panel animation/behavior currently requires copy-pasting the fix 34+ times.
- **Status:** VERIFIED. Extracted shared logic into `src/screens/tabs/partners/hooks/usePartnerSlidePanel.ts`. 36 hooks (3 more than originally estimated, found via byte-level comparison) now delegate to it as one-line wrappers, exact same exported name/signature/return shape — zero consumer changes needed. 8 `useAdmin*Panel` hooks and several others (`useGeolocationPanel`, `usePartnerCreatePanel`, `usePartnerSettingsPanel`, etc.) deliberately left alone after confirming real behavioral differences, not forced into the abstraction. Verified: spot-checked 2 of 36 original hook bodies via `git show HEAD:<path>` against the new shared hook — byte-for-byte identical logic, just relocated. Independently re-ran `npm run typecheck` (clean, repo-wide).

### P2-2: Confirmed dead files across multiple domains
- **Files (non-exhaustive, see individual inventory files for complete lists):** `business/JobsScreen.tsx`, `business/MyApplicationsScreen.tsx` (diverged stale duplicates of live `src/screens/jobs/**`), `components/partners/partnersMockData.ts`, `components/broadcast/BroadcastFeedSection.tsx` + `MarketStudioSection.tsx` + `RecommendationsSection.tsx`, `src/screens/broadcast/market/**` (9 of 15 files), `components/calls/CallOverlay.tsx`, `section-builder/SectionBuilder.tsx`, `feeds/FeedCommentsScreen.tsx`, 4 of 14 `dashboard/` cards, `Module/Community/CommunityFeedPage.tsx`, `Module/ChatRoom/componets/main/MediaGallery.tsx` + `VoiceLockedActionsRow.tsx` + `VoicePreviewRow.tsx`.
- **Status:** VERIFIED. Deleted 25 files total: all 13 originally-listed files/groups, plus the 4 dead `profitability/**` stubs (folded in from P1-2's investigation), plus 12 of 15 files in the `broadcast/market/**` cluster (the other 3 — `ProductDetailsPage.tsx`, `pages/ShopProductsPage.tsx`, `pages/ShopServicesPage.tsx` — confirmed live via real `App.tsx` route imports, kept). Every deletion independently re-verified by me (not just trusted from the implementing agent's self-report) via repo-wide grep for both the component/file name and, for `CallOverlay.tsx` specifically, its exported types — zero importers found in every case, including confirming `BroadcastScreen.tsx` actually renders `BroadcastMarketPage.tsx` (a separate, real file) for its live Market tab rather than any of the deleted `MarketSection.tsx` chain. Nothing committed — all deletions are working-tree changes, reversible via `git checkout` if anything surfaces during device testing. Independently re-ran `npm run typecheck` after all 4 implementation agents' combined changes: clean, zero errors, repo-wide.

### P2-3: Duplicated logic/constants that should be shared
- **Examples:** `feeds/composer/richUtils.ts` vs `richTextUtils.ts` (near-identical `computeEditDelta`/`shiftSpans`); identical `CATEGORY_LABELS`/`CATEGORY_EMOJI` maps independently redeclared in all 6 `src/screens/testimony/**` files; `InviteJoinScreen.tsx` and `PartnerRedeemInviteScreen.tsx` independently duplicating the same idle/loading/success/error auto-action state machine.
- **Status:** VERIFIED (testimony + richUtils parts). Testimony maps extracted to new `src/screens/testimony/testimonyCategories.ts`, all 6 screens now import from it. `richUtils.ts` vs `richTextUtils.ts`: traced real importers first — only one genuinely-shared function (`splitParagraphs`) was duplicated; `richTextUtils.ts` is the real canonical file (richer, used by the composer's full feature set) and `richUtils.ts`'s other functions had zero external callers. Redirected `docConversion.ts`'s one import and deleted `richUtils.ts` entirely. Did NOT force-merge the two files' divergent `computeEditDelta`/`shiftSpans`-adjacent logic since richTextUtils's versions are meaningfully more capable (ordering-counter semantics, `stateToDoc`) — correctly left as one canonical file rather than a risky merge. `InviteJoinScreen`/`PartnerRedeemInviteScreen` state-machine duplication NOT addressed this session — lower priority, deferred. Verified via `git status`/`grep` (matches self-report) and independently re-run `npm run typecheck` (clean).

### P2-4: `chatMediaMigration.ts`'s migration function is never called
- **File:** `src/Module/ChatRoom/Storage/chatMediaMigration.ts`
- **Problem:** `runChatMediaMigrationIfNeeded()` exists to move stray chat-media files back to the canonical directory on startup, but nothing imports/calls it — referenced only in a comment.
- **User impact:** Unknown — could mean some users have media files sitting in the wrong location indefinitely.
- **Status:** VERIFIED. Read the function in full before acting: it's idempotent (guarded by an `AsyncStorage` DONE flag), copy-only (never deletes/moves the original stray files, so zero data-loss risk even if something goes wrong), and every operation is wrapped in `.catch(() => {})` / an outer try/catch that never throws — its own header comment says "Safe to call on every launch." Wired it into `App.tsx`'s existing one-time startup effect (same block that already calls `startOfflineActionQueue()`/`loadConsentPreferences()`), via `void runChatMediaMigrationIfNeeded();`. Verified via `npm run typecheck` (clean, repo-wide, after a transient classifier block cleared on retry).

### P2-5: Emergency screen is red/alarming throughout, not just the SOS action
- **Screen:** `src/screens/health/emergency/EmergencyScreen.tsx`
- **Problem:** Good trust-design pattern already in place (explicit code comment about avoiding false reassurance), but `palette.danger` is used for the whole screen chrome, not reserved for the SOS button itself — could read as alarming to someone already in crisis.
- **Status:** NOT STARTED — emotional-design judgment call worth discussing with the user rather than silently restyling a safety-critical screen.

---

## P3 — Low

### P3-1: Inconsistent route-naming conventions
- Example: `PregnancyTrackerScreen` registered under its full component name while sibling health screens use short route names (`BabyMilestones`, `Medications`, etc.). Cosmetic/internal, no user-facing impact.
- **Status:** REVIEWED, deliberately left as-is. Renaming would require touching the `RootStackParamList` type, `App.tsx` registration, and the `BroadcastHealthcarePage.tsx` caller — for a purely internal naming inconsistency with zero user-facing effect. Given this frontend repo can't rule out a server-side push-notification payload also referencing the exact string `'PregnancyTrackerScreen'`, the risk of a silent deep-link/notification breakage outweighs the cosmetic benefit. Not worth it at P3 priority.

### P3-2: `AdminDashboardScreen` / `AnalyticsDashboardScreen` redundancy
- Near-identical thin wrappers around the same `InsightScreen`, registered as two separate routes.
- **Status:** VERIFIED — resolved, not a false alarm. `AdminDashboardScreen` is a generic wrapper taking `target`/`title` as route params; `AnalyticsDashboardScreen` is a specific hardcoded instance. Traced the real navigation source (`AdminToolsScreen.tsx`'s dashboard menu): every dashboard type (Analytics, Events, Content, Surveys, Media, Bridge, Tiers, Notifications) is navigated to via its OWN dedicated route name, never through the generic `AdminDashboard` with a `target` param — so `AdminDashboardScreen.tsx` is genuinely unreached from anywhere (confirmed via repo-wide grep), while `AnalyticsDashboardScreen.tsx` is the real live file. Not two legitimate entry points for the same thing — one live, one orphaned generic wrapper. **Recommended for deletion — not deleted**: same permission-classifier block on further file deletions as the other orphaned-screen findings above.

### P3-3: Insights folder has two visually inconsistent component families
- `InsightLayout`-based dashboards vs. 5 large hand-rolled admin CRUD consoles (`AIIntegrationScreen`, `BridgeManagementScreen`, `MediaAssetManagerScreen`, `ModerationConsoleScreen`, `SurveyManagerScreen`) using raw inline styles/Modal, never touching the shared chart kit.
- **Status:** NOT STARTED — design-system consistency target for Phase 4.

### P3-4: Bible content/games have no age-inclusive accessibility modes
- 30 Bible games use raw uncurated KJV text (archaic English) at adult-literacy difficulty (timed countdowns, brief flash windows) with no reading-level toggle or reduced-motion/easy mode.
- **Status:** NOT STARTED — real finding, but a content/difficulty-design decision for the user, not a code fix to make unilaterally.

---

## Progress Summary — UPDATED, Phase 1 + Phase 3 both complete

**This section originally reflected only Phase 1 (inventory). The user then explicitly required
the full exhaustive per-screen audit (Phase 3+), which has since been completed and independently
verified. Numbers below are final as of audit close-out.**

| Metric | Count |
|---|---|
| Files inventoried (Phase 1) | 1,172 (original estimate) / reconciled to 895 live files (see note below) |
| Files individually audited (Phase 3 — real UX/UI/accessibility pass, not just inventory) | **895 / 895 — 100%** |
| Domains fully audited | 17 (health, broadcast, calls, market/commerce, education, insights, church/family, business/government, misc small domains, partners components, Bible components, shared common/shell/media/verification, shared feeds/sections/dashboard/profitability, src/Module chat infrastructure, tabs/partners, root auth/onboarding/security, tabs/profile+bible+messaging+root) |
| Real findings discovered across the whole audit | ~700 |
| Fixes implemented and independently verified (git diff + typecheck, not trusted from self-report) | ~390 |
| Files touched across the whole session | 543 (per `git status --short`), **0 committed — everything is reversible working-tree state** |
| Final `npm run typecheck` | Clean, 0 errors, repo-wide |

**Reconciling the file count:** the original 1,172 estimate predates this session and was never
internally consistent with its own screens+components+Module sub-counts (520+307+109=936, not
1,172 — an unexplained discrepancy that existed before any work started). The reconciled, verified
current count is 895 live files (`src/screens` + `src/components` + `src/Module`, excluding
`__tests__`), after this session's own confirmed dead-code deletions reduced the real total. Every
one of those 895 has been through the actual audit — not just read for inventory purposes.

**The handful of most consequential findings** (full detail in the relevant `docs/ux-overhaul/audit/*.md`
file and in `STATE.json`'s `screen_audit_batches`):
- **Family SOS screen** showed "Help is on the way" even when the backend rejected the alert (fixed).
- **5 clinical admin screens** (emergency dispatch, secure messaging, etc.) fabricated fake success
  records on backend failure — a dispatcher could believe help was sent when nothing was created (fixed).
- **Anonymous whistleblower report screen** could silently discard a submitted report with zero
  error feedback (fixed).
- **A chat "send payment" button** moved real money with no review step; a "delete for everyone"
  action was the one place in the whole chat system with no confirmation (both fixed).
- **`useProfileController.ts`'s `deleteItem()`** — the single function behind every profile-content
  delete button — had neither a confirmation dialog nor a success check (fixed at the one shared
  source, propagating the fix to every caller for free).
- **Partner escrow payment release/refund buttons** fired on a single tap with zero confirmation (fixed).
- **Two admin panels had no way to close them** once opened — the close button/backdrop logic was
  simply never wired up, despite the data needed to do so already being passed in (fixed).

**Deliberately NOT fixed — flagged for explicit product/legal/user decision, not oversights:**
- **Age-gate screen** is pure client-side self-attestation with zero server-side enforcement — a
  real content-safety/compliance gap requiring a policy decision, not a frontend patch.
- **`HealthcareScreen.tsx`** (4,228 lines, a full EHR-style patient-record feature) is built but has
  zero navigation entry point — deliberately left unwired since activating a major health-data
  feature isn't a call to make unilaterally.
- **`MesssagingSubTabs/HubTab.tsx`** (a complete "Channels & Broadcasts hub") is similarly built but
  never added to the tab bar — a real missing feature, not wired up to avoid colliding with other
  sessions' in-flight Messages-tab redesign work.
- 3 confirmed-dead files (`CommentThreadScreen.tsx`, `HealthInstitutionsScreen.tsx`,
  `AdminDashboardScreen.tsx`) recommended for deletion but blocked by the permission system after an
  earlier large batch deletion — harmless to leave, real cleanup debt.
- A handful of P2/P3 design-system-consistency and content-difficulty items (Bible game reading
  levels, insights visual-consistency redesign) that are genuine product decisions, not bugs.

**What "100% audited" means here:** every one of the 895 files was read in full and evaluated
against the complete UX/UI/accessibility/trust criteria list (visual hierarchy, contrast, touch
targets, confirmations on destructive actions, loading/error/empty states, accessibility labels,
emotional tone, journey integration). Fixes were applied wherever safe and verifiable; everything
else was documented with a clear reason it wasn't touched. Every batch was independently
re-verified by the coordinating session against the actual code (`git diff`) and a repo-wide
`npm run typecheck` — not accepted on a subagent's word alone.
