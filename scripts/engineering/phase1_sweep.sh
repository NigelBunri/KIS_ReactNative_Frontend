#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/docs/engineering-sweep/artifacts/phase-01"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG="$ARTIFACT_DIR/phase1_${STAMP}.log"

BACKEND_ROOT="${KIS_DJANGO_ROOT:-/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis}"
BACKEND_PY="${KIS_DJANGO_PYTHON:-/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/env/bin/python}"

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

echo "# Phase 01 Engineering Sweep" > "$LOG"
echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "frontend_root: $ROOT_DIR" >> "$LOG"
echo "backend_root: $BACKEND_ROOT" >> "$LOG"
echo "backend_python: $BACKEND_PY" >> "$LOG"

run_step "Frontend TypeScript" bash -lc "cd \"$ROOT_DIR\" && npx tsc --noEmit --pretty false"
run_step "Frontend ESLint" bash -lc "cd \"$ROOT_DIR\" && npm run -s lint"
run_step "Frontend Jest" bash -lc "cd \"$ROOT_DIR\" && npm test -- --runInBand --watch=false"

run_step "Backend Django check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check
run_step "Backend Django deploy check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check --deploy
run_step "Backend accounts migrations" bash -lc "\"$BACKEND_PY\" \"$BACKEND_ROOT/manage.py\" showmigrations accounts"
run_step "Backend tests (accounts/partners/health_ops)" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" test apps.accounts.tests apps.partners.tests apps.health_ops.tests

echo "Phase 1 sweep complete. Log: $LOG"
