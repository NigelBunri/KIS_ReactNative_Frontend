# KIS UX/UI/Accessibility/Product-Experience Overhaul

Long-form, application-wide UX/UI audit and improvement program for the KIS React Native app
(`~/dev/KIS`). Companion to `docs/engineering-sweep/` (which covers security/architecture/testing,
not UX) — this program is explicitly about usability, visual design, accessibility, emotional
design, and age/ability inclusivity. Checkpointed so work can continue safely across
sessions/model/context resets.

## Scale (established 2026-10-12)

- 520 screen files, 307 component files, 109 `src/Module` files — **1,172 relevant source files**.
- 1,100-line `src/navigation/AppNavigator.tsx`.
- This is a multi-session, multi-week-equivalent effort. No single pass "finishes" it — progress
  is tracked durably here and in `STATE.json` so it can resume from the real remaining state
  instead of restarting or silently claiming completion.

## Phase Plan

## Phase 1: Inventory
- Status: In progress
- Build a complete, file-verified inventory of every screen, reusable component, and
  `src/Module` file: location, purpose, primary actions, related components, visible states,
  dependencies.
- Output: per-domain inventory files under `docs/ux-overhaul/inventory/` (see `STATE.json` for
  the batch breakdown and status of each).

## Phase 2: Master Checklist
- Status: Not started (depends on Phase 1)
- Convert the inventory into a tracked checklist of audit items with explicit status
  (NOT STARTED / AUDITING / ISSUE IDENTIFIED / FIX IN PROGRESS / FIXED / TESTING / VERIFIED / BLOCKED)
  and severity (P0–P3).
- Output: `docs/ux-overhaul/checklist.md` + a progress scorecard.

## Phase 3: Deep UX Audit
- Status: **Complete** (2026-10-12). All 895 live files individually audited and verified —
  see `docs/ux-overhaul/checklist.md`'s Progress Summary for final numbers and the most
  consequential findings/fixes. Full detail per-domain in `docs/ux-overhaul/audit/*.md`.

## Phase 4: Visual UI Audit
- Status: Not started
- Visual hierarchy, design-system/token consistency, responsive/device-aware behavior across the
  whole app.

## Phase 5: Human Psychology Pass
- Status: Not started
- Cognitive load, emotional design, ethical motivation/engagement, trust/privacy/safety — applied
  per-journey, not as a separate cosmetic layer.

## Phase 6: Age-Inclusive & Accessibility Pass
- Status: Not started
- WCAG 2.2-informed native accessibility audit (contrast, screen reader labels/roles, touch
  targets, focus order, reduced motion, etc.) plus age-inclusive usability review.

## Phase 7: Interaction-State Audit
- Status: Not started
- Loading/empty/error/offline/permission-denied/retry/disabled/pressed/long-content/interrupted/
  rapid-input/background-resume/platform-specific/accessibility-focus states, per component.

## Phase 8: High-Impact Surfaces Deep Dive
- Status: Not started
- Launch/perceived performance, auth/onboarding, feed/content creation, messaging/notifications,
  calls (coordinate with whoever owns `src/services/calls/`, `SocketProvider.tsx`, call UI at the
  time — see `STATE.json` ownership note), video/live, payments, privacy/safety.

## Phase 9: Implementation
- Status: In progress
- Fix in prioritized, verifiable batches. Shared components/tokens for systemic issues. No
  backend/contract changes without coordinated, in-scope justification.
- **2026-10-12 batch 1** (4 fixes, each independently verified against real `git diff` + a
  repo-wide `npm run typecheck`, not just trusted from the implementing agent's self-report):
  - P1-1: Added pre-submit `Alert.alert` confirmation to `GiveNowScreen`, `ChurchPledgeScreen`,
    `CrowdfundDetailScreen` — payment/charge logic itself untouched, only gated on confirmation.
  - P1-2: Replaced `return null` in the 6 live `profitability/**` stub components with an honest
    "coming soon" card (reusing `KISText`/theme tokens) instead of a silent blank hole. Confirmed
    via git history + prop analysis that no real data was being dropped (all call sites pass only
    title/subtitle copy, never numbers) — ruled out fabricating fake data.
  - P1-3 (partial): Added error-state + "Tap to retry" to the 8 highest-traffic partner panels
    (all mounted from `PartnersScreen.tsx`). 24 more files confirmed to have the identical
    silent-failure pattern, explicitly logged as remaining for a future pass.
  - P2-2: Deleted 25 confirmed-dead files (zero importers, independently re-verified file-by-file,
    not committed — reversible via `git checkout` if device testing surfaces a problem).
  - Debug APK built successfully after all 4 changes (`BUILD SUCCESSFUL in 46s`,
    `android/app/build/outputs/apk/debug/app-debug.apk`, 412MB) — ready to install once a
    physical device connects (`adb install -r <path>`).

## Phase 10: Verification
- Status: Not started
- Typecheck, lint, tests, build, accessibility checks, regression checks per batch. Explicit about
  what was verified by source inspection vs. automated test vs. build vs. simulator vs. physical
  device (physical device likely unavailable in this environment — flag accordingly).

## Phase 11: Completeness Check
- Status: Not started
- Re-walk the inventory; confirm every item has a real disposition (not just "touched"). Second-pass
  audit for inconsistencies introduced by earlier fixes.

## Phase 12: Documentation & Final Deliverables
- Status: Not started
- Inventory, checklist, findings/remediation report, design-system changes, accessibility report,
  test/build report, remaining-issues register, scorecard with real counts, honest final assessment.
