#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/docs/engineering-sweep/artifacts/phase-02"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG="$ARTIFACT_DIR/phase2_${STAMP}.log"

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

echo "# Phase 02 Security Sweep" > "$LOG"
echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "frontend_root: $ROOT_DIR" >> "$LOG"
echo "backend_root: $BACKEND_ROOT" >> "$LOG"
echo "backend_python: $BACKEND_PY" >> "$LOG"

run_step "Backend Django check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check
run_step "Backend Django deploy check" "$BACKEND_PY" "$BACKEND_ROOT/manage.py" check --deploy
run_step "Frontend TypeScript" bash -lc "cd \"$ROOT_DIR\" && npx tsc --noEmit --pretty false"

echo "Phase 2 sweep complete. Log: $LOG"
