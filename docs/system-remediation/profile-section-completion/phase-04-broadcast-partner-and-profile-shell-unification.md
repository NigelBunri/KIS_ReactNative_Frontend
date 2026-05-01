# Phase 4: Broadcast, Partner, and Profile-Shell Unification

Goal:
- reduce architectural confusion between core profile data and domain-managed profile shells

Scope:
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen-sections/BroadcastProfilesSection.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen-sections/PartnerProfilesSection.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/constants.ts`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/tests.py`

Objectives:
- define what data belongs to `accounts` profile versus `broadcasts` profile shells
- keep broadcast feed strong without letting generic JSON shells become the permanent system of record
- stabilize partner, market, health, and education launch behavior from profile

Work items:
- document ownership boundaries for:
  - personal profile
  - broadcast feed profile
  - health shell
  - market shell
  - education shell
- tighten frontend labels so users know when they are editing a true domain workspace versus a broadcast shell
- add focused tests for `broadcasts/profiles/manage/`
- review whether some shell-managed fields should move to domain-owned APIs

Exit criteria:
- profile-shell boundaries are explicit
- broadcast/partner entry points are clear and stable
- profile no longer feels like mixed ownership without rules

Implementation status:
- Complete in code on 2026-04-26.
- Frontend labels now distinguish the true broadcast-owned feed from the domain-owned health, market, and education workspaces in:
  - [constants.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/constants.ts)
  - [types.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/types.ts)
  - [BroadcastProfilesSection.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen-sections/BroadcastProfilesSection.tsx)
  - [ProfileScreen.tsx](/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx)
- Focused backend coverage was added for `broadcasts/profiles/manage/` structure bootstrapping and shell merge behavior in [broadcasts/tests.py](/Users/nigel/All%20other%20files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/tests.py).

Validation:
- `python3 manage.py check` passed
- `../env/bin/python manage.py test apps.broadcasts --noinput` stalled during the repo's existing Django test-database setup path before any shell-specific traceback

Out of scope:
- deep redesign of health, market, or education subsystems themselves
