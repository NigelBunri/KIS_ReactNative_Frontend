#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/docs/engineering-sweep/artifacts/phase-05"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG="$ARTIFACT_DIR/phase5_${STAMP}.log"

BACKEND_ROOT="/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis"
BACKEND_PY="/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/env/bin/python"

mkdir -p "$ARTIFACT_DIR"

run_step() {
  local title="$1"
  shift
  {
    echo
    echo "========== $title =========="
    "$@"
  } >> "$LOG" 2>&1 || true
}

echo "# Phase 05 E2E Tier/Billing/Profile Reliability Sweep" > "$LOG"
echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "frontend_root: $ROOT_DIR" >> "$LOG"
echo "backend_root: $BACKEND_ROOT" >> "$LOG"

run_step "Frontend TypeScript" bash -lc "cd \"$ROOT_DIR\" && npx tsc --noEmit --pretty false"
run_step "Frontend ESLint (quiet, full src)" bash -lc "cd \"$ROOT_DIR\" && npx eslint --quiet src"
run_step "Frontend Contract Checks (wallet + profile-phone)" bash -lc "cd \"$ROOT_DIR\" && rg -n 'phoneChanged|Please log in again with your new phone number|submitDisabled = saving \\|\\| \\(transferMode && !walletRecipientVerification\\?\\.verified\\)|verifyWalletRecipient|Receiver:|Number:' src/screens/tabs/profile/useProfileController.ts src/screens/tabs/profile-screen/WalletModal.tsx src/screens/tabs/ProfileScreen.tsx"
run_step "Frontend Runtime Tests (phase-05 wallet/profile flows)" bash -lc "cd \"$ROOT_DIR\" && npx jest --watchman=false --runInBand --silent --config jest.phase5.config.js __tests__/phase5.wallet-modal.test.tsx __tests__/phase5.profile-controller.test.tsx"
run_step "Backend Billing Reliability Tests" bash -lc "\"$BACKEND_PY\" \"$BACKEND_ROOT/manage.py\" test apps.billing.tests --verbosity 2"

echo "Phase 5 sweep complete. Log: $LOG"
