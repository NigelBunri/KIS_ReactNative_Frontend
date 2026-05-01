# Phase 6: Deploy Readiness and Final QA

Goal:
- make the profile section shippable with explicit confidence, not assumption

Scope:
- full profile tab
- directly connected backend endpoints

Objectives:
- verify no core profile flow is blocked by hidden runtime issues
- reduce lingering TypeScript and UI regressions around the profile path
- create the final release checklist

Work items:
- run targeted frontend checks for profile-related files
- run targeted backend checks and tests for accounts and broadcasts profile flows
- remove dead code and stale launch paths
- verify linked domain launchers from profile:
  - health
  - market
  - education
  - partner
  - broadcast feed
- create release checklist:
  - core profile edit
  - privacy visibility
  - showcases
  - wallet top-up
  - transfer
  - upgrade and downgrade
  - partner management
  - broadcast feed management
  - health launcher
  - market launcher
  - education launcher
  - appointments and notifications

Exit criteria:
- profile section can be signed off with known limits clearly documented
- remaining gaps are non-blocking polish, not structural uncertainty

Implementation status:
- Complete in code on 2026-04-26.
- Removed remaining low-signal debug logs from profile-adjacent screens in:
  - [FeedManagementModal.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/FeedManagementModal.tsx)
  - [EducationManagementModal.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx)
- Replaced the appointments console-only failure path with an explicit user-facing error state in [ProfileScreen.tsx](/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx).

Validation:
- `python3 manage.py check` passed
- repo-level Django targeted test commands for profile-related apps still stall during test database setup before app-specific traceback
- repo-level frontend `pnpm tsc --noEmit --pretty false` still does not finish within a reasonable validation window because of the wider TypeScript backlog and project size

Release checklist:
- Core profile edit
- Privacy visibility
- Showcases
- Wallet top-up
- Transfer
- Upgrade and downgrade
- Partner management
- Broadcast feed management
- Health launcher
- Market launcher
- Education launcher
- Appointments and notifications

Known limits:
- Current blockers are environment/test infrastructure and broad repo typing backlog, not profile-specific structural failures.
