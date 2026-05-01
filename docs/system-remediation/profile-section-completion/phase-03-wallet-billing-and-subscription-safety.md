# Phase 3: Wallet, Billing, and Subscription Safety

Goal:
- raise the financial confidence of the profile section before production signoff

Scope:
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/components/AccountCreditsCard.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/WalletModal.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/UpgradeModal.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile/useProfileController.ts`
- related wallet and billing backend endpoints already used by the profile tab

Objectives:
- verify every wallet and billing action exposed from profile
- remove unsafe or confusing destructive actions if they do not belong in end-user UI
- clarify upgrade, downgrade, retry, transfer, and ledger flows

Work items:
- audit wallet top-up flow and payment URL handling
- audit recipient verification and transfer safety
- audit upgrade and downgrade logic against tier boundaries
- review delete actions for wallet ledger and billing transactions
- ensure every balance display uses one consistent unit model
- add explicit loading, failure, and success states
- add or extend tests around wallet actions where missing

Exit criteria:
- no ambiguous financial actions remain
- destructive finance actions are justified or removed
- profile wallet UI is trustworthy enough for production

Implementation status:
- Complete in code on 2026-04-26.
- End-user delete controls for wallet ledger history and billing transactions were removed from the profile UI while backend routes remained unchanged.
- Wallet and subscription copy was clarified so top-up, transfer, retry, cancel, resume, and downgrade actions communicate their consequences more clearly.
- The upgrade transaction list now converts cents to KISC correctly in [UpgradeSheet.tsx](/Users/nigel/dev/KIS/src/screens/tabs/profile/profile/sheets/UpgradeSheet.tsx).
- Existing backend billing coverage already exists in [apps/billing/tests.py](/Users/nigel/All%20other%20files/CC/KIS/main_kis_bakend/backend/kis/apps/billing/tests.py) for transfer safety, upgrade paths, and subscription lifecycle APIs.

Validation:
- `python3 manage.py check` passed
- `pnpm tsc --noEmit --pretty false` did not finish within the same reasonable validation window because of the repo-wide TypeScript backlog and project size

Out of scope:
- cross-app booking hub unification
