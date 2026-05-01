# Phase 2: Privacy and Public Profile Polish

Goal:
- make privacy understandable, enforceable, and fit for user-facing production

Scope:
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/PrivacyModal.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/profile.constants.ts`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/tests.py`

Objectives:
- improve privacy UX from raw identifier entry to safer user-facing control
- verify public-profile payload filtering by viewer type
- ensure custom/contact/private rules actually match the intended product behavior

Work items:
- audit every `field_key` used in privacy rules against the visible profile UI
- tighten custom visibility UX so it is not just comma-separated manual entry
- validate public viewer, contact viewer, owner viewer, and anonymous viewer payloads
- add targeted tests for field-level visibility and article/showcase visibility
- ensure the profile UI can explain what is hidden and why

Exit criteria:
- privacy rules are understandable and consistent
- public profile rendering is aligned with backend filtering
- custom/contact visibility is safe enough for deployment

Implementation status:
- Complete in code on 2026-04-26.
- The privacy modal now supports custom viewers as add/remove chips instead of comma-separated entry in [PrivacyModal.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/PrivacyModal.tsx).
- Backend tests now cover:
  - contacts-only field hidden from anonymous viewers
  - custom field visible to explicitly allowed viewers and hidden from others
- Privacy fields are now presented in a deliberate user-facing order with per-field explanations and clearer visibility descriptions in [profile.constants.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile/profile.constants.ts) and [PrivacyModal.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/PrivacyModal.tsx).
- Privacy saves now avoid storing unnecessary default-public rules, and existing public-reset rules are deleted instead of preserved as backend noise in [useProfileController.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts).
- Privacy controls are now grouped by real profile surface and show whether each field currently has visible profile content in [PrivacyModal.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/PrivacyModal.tsx).
- Privacy saves now keep the sheet open on failure and show an error instead of silently closing in [useProfileController.ts](/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts).
- Backend coverage now also includes article visibility for anonymous viewers and explicit custom allow-target viewers in [accounts/tests.py](/Users/nigel/All%20other%20files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/tests.py).
- Validation:
  - `python3 manage.py check` passed
  - full `apps.accounts` test execution is still blocked by the repo's unstable Django test database setup path

Out of scope:
- wallet and monetization
- partner/market/education launchers
