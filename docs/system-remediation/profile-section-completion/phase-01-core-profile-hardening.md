# Phase 1: Core Profile Hardening

Goal:
- make the personal profile system solid and clearly owned before refining peripheral launchers

Scope:
- `/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EditProfileModal.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EditItemModal.tsx`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/tests.py`

Objectives:
- make personal profile editing stable and predictable
- reduce controller bloat where it directly affects correctness
- add stronger backend test coverage for profile core
- remove debug-only behaviors from the profile entry screen

Work items:
- verify and tighten `profiles/me` payload expectations
- verify profile update flow for user fields versus profile fields
- verify avatar and cover uploads end to end
- verify showcase and section CRUD behavior
- verify language sync and local draft normalization
- add focused backend tests for:
  - `GET /api/v1/profiles/me/`
  - `PATCH /api/v1/profiles/<id>/`
  - `POST /api/v1/profile-languages/sync/`
  - showcase create/update/delete
- remove low-signal console logging from profile shell code

Exit criteria:
- personal profile editing is reliable
- no known silent failures in avatar, cover, language, or section saves
- core profile account flows have direct automated coverage

Implementation status:
- Complete in code on 2026-04-25.
- Focused backend coverage now exists in [accounts/tests.py](/Users/nigel/All%20other%20files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/tests.py) for:
  - `GET /api/v1/profiles/me/`
  - `PATCH /api/v1/profiles/<id>/`
  - `POST /api/v1/profile-languages/sync/`
  - privacy-aware public profile view
  - showcase create, update, and delete
- Low-signal profile load debug logs were removed from [useProfileController.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts).
- Validation:
  - `python3 manage.py check` passed
  - `../env/bin/python manage.py test apps.accounts --noinput` stalled during test database setup without a profile-specific traceback

Out of scope:
- wallet and billing redesign
- partner and broadcast architecture changes
- appointments and notifications hub redesign
