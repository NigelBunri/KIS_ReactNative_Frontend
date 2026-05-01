# Profile Section Completion Program

This is the canonical handoff folder for finishing the KIS profile section.

It covers:
- personal profile core
- privacy and visibility
- showcases and profile content sections
- partner profiles
- broadcast profiles and feed management
- wallet, billing, tiers, and subscription controls
- appointments, notifications, and marketplace-order shortcuts
- domain launchers for health, market, and education

Primary frontend entry:
- `/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts`

Primary backend ownership:
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/accounts/urls.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/views.py`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/urls.py`

Current assessment:
- profile section overall completeness: `72/100`
- safe for broad production deployment: `58/100`
- strongest parts: profile core, partner summary, broadcast feed, education workspace launcher
- weakest parts: wallet and billing confidence, profile-shell architecture, notifications and appointments hub depth, limited visible test coverage for core account/profile flows

Phase order:
1. Core profile hardening
2. Privacy and public profile polish
3. Wallet, billing, and subscription safety
4. Broadcast, partner, and profile-shell unification
5. Appointments, notifications, and order hub
6. Deploy readiness, QA, and cleanup

Start every new session with:
1. `STATUS.md`
2. `phase-01-core-profile-hardening.md`
