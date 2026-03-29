# Phase 05 Device E2E Checklist

Generated on: `2026-03-07`

## Scope
- Backend API assertions are covered by `apps.billing.tests` (`29` passing tests).
- This checklist is for device/UI execution and screenshot/video evidence capture.

## Preconditions
- Backend server running with latest migrations.
- React Native app built with latest frontend changes.
- Two real test accounts available:
  - `sender`
  - `receiver`

## Scenarios
1. Wallet transfer receiver verification gate
- Open profile wallet modal.
- Select `transfer`.
- Enter receiver number.
- Confirm submit button is disabled before verification.
- Tap `Verify receiver`.
- Confirm receiver `name + number` are shown.
- Confirm submit button becomes enabled only after successful verification.

2. Wallet transfer value movement integrity
- Record sender and receiver wallet balances.
- Transfer KISC from sender to receiver.
- Confirm sender decreases once and receiver increases once by exact value.
- Confirm no double deduction on sender.

3. Edit profile phone-change forced logout
- Open edit profile.
- Change only `phone_number`.
- Save profile.
- Confirm logout prompt appears with re-login message.
- Confirm session is cleared and user is redirected to auth.
- Confirm login succeeds using new number.

4. Edit profile non-phone update does not force logout
- Change display name/bio only.
- Save profile.
- Confirm profile updates render and session remains active.

5. Upgrade flow with credits
- Ensure account has sufficient credits.
- Upgrade to higher paid tier with `credits`.
- Confirm tier change and credit deduction.

6. Upgrade flow with non-credit payment
- Trigger card checkout path.
- Confirm pending transaction + payment URL are returned.
- Complete or mock completion path and confirm tier activation.

7. Subscription lifecycle
- Cancel at period end and confirm flags are set.
- Resume and confirm flags are cleared.
- Downgrade and confirm pending tier + proration metadata.

## Evidence to Capture
- Screen recording for each scenario.
- API request/response logs for wallet transfer and upgrade calls.
- Before/after balance snapshots for sender and receiver.
- Logout + relogin sequence proof for phone change flow.

## Status
- `Not executed yet` (checklist prepared for run).
