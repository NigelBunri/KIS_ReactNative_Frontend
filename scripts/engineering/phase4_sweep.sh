#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/docs/engineering-sweep/artifacts/phase-04"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG="$ARTIFACT_DIR/phase4_${STAMP}.log"

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

echo "# Phase 04 Frontend Architecture & Cleanup Sweep" > "$LOG"
echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "frontend_root: $ROOT_DIR" >> "$LOG"

run_step "Frontend TypeScript" bash -lc "cd \"$ROOT_DIR\" && npx tsc --noEmit --pretty false"
run_step "Frontend ESLint (quiet, full src)" bash -lc "cd \"$ROOT_DIR\" && npx eslint --quiet src"
run_step "Frontend ESLint (phase-04 critical touched files)" bash -lc "cd \"$ROOT_DIR\" && npx eslint --quiet src/Module/ChatRoom/ChatInfoPage.tsx src/Module/Community/CommunityFeedPage.tsx src/Module/Community/CommunityInfoPage.tsx src/components/Bible/BibleCourseDetailSheet.tsx src/components/broadcast/BroadcastFeedSection.tsx src/components/feeds/FeedScreen.tsx src/components/partners/PartnerFeedPage.tsx src/navigation/AppNavigator.tsx"

echo "Phase 4 sweep complete. Log: $LOG"
