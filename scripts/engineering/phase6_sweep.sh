#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/docs/engineering-sweep/artifacts/phase-06"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG="$ARTIFACT_DIR/phase6_${STAMP}.log"

BACKEND_ROOT="${KIS_DJANGO_ROOT:-/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis}"
BACKEND_PY="${KIS_DJANGO_PYTHON:-/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/env/bin/python}"
BACKEND_TEST_MEDIA_ROOT="${KIS_TEST_MEDIA_ROOT:-/tmp/kis_phase6_media}"

mkdir -p "$ARTIFACT_DIR" "$BACKEND_TEST_MEDIA_ROOT"

FAILURES=0

run_gate() {
  local title="$1"
  shift
  {
    echo
    echo "========== $title =========="
    echo "command: $*"
  } >> "$LOG"
  if "$@" >> "$LOG" 2>&1; then
    echo "result: PASS" >> "$LOG"
  else
    echo "result: FAIL" >> "$LOG"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "# Phase 06 Release Readiness Sweep" > "$LOG"
echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "frontend_root: $ROOT_DIR" >> "$LOG"
echo "backend_root: $BACKEND_ROOT" >> "$LOG"
echo "backend_python: $BACKEND_PY" >> "$LOG"
echo "backend_test_media_root: $BACKEND_TEST_MEDIA_ROOT" >> "$LOG"

run_gate "Frontend TypeScript" bash -lc "cd \"$ROOT_DIR\" && npx tsc --noEmit --pretty false"
run_gate "Frontend ESLint (quiet, src)" bash -lc "cd \"$ROOT_DIR\" && npx eslint --quiet src"
run_gate "Frontend Runtime Reliability Tests" bash -lc "cd \"$ROOT_DIR\" && npx jest --watchman=false --runInBand --silent --config jest.phase5.config.js __tests__/phase5.wallet-modal.test.tsx __tests__/phase5.profile-controller.test.tsx"

run_gate "Backend Django Check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check
run_gate "Backend Django Deploy Check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check --deploy
run_gate "Backend Migration Drift Check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" makemigrations --check --dry-run
run_gate "Backend Critical Tests (accounts/partners/health_ops/billing)" bash -lc "cd \"$BACKEND_ROOT\" && KIS_TEST_MEDIA_ROOT=\"$BACKEND_TEST_MEDIA_ROOT\" \"$BACKEND_PY\" -c \"import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); media_root = os.environ.get('KIS_TEST_MEDIA_ROOT', '/tmp/kis_phase6_media'); os.makedirs(media_root, exist_ok=True); django.setup(); from django.conf import settings; settings.MEDIA_ROOT = media_root; from django.core.management import call_command; call_command('test', 'apps.accounts.tests', 'apps.partners.tests', 'apps.health_ops.tests', 'apps.billing.tests', verbosity=1)\""

{
  echo
  echo "========== SUMMARY =========="
  echo "failures: $FAILURES"
  if [[ "$FAILURES" -eq 0 ]]; then
    echo "overall: PASS"
  else
    echo "overall: FAIL"
  fi
} >> "$LOG"

if [[ "$FAILURES" -eq 0 ]]; then
  echo "Phase 6 sweep complete (PASS). Log: $LOG"
else
  echo "Phase 6 sweep complete (FAIL). Log: $LOG"
fi

exit "$FAILURES"
