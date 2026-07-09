#!/usr/bin/env bash
set -euo pipefail

# KIS small iOS device-lab launcher
# Starts the smallest practical iPhone and iPad simulator set for fast responsive QA.

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_ROOT"

IOS_RUNTIME="${IOS_RUNTIME:-}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.kis}"
METRO_WAIT_SECONDS="${METRO_WAIT_SECONDS:-8}"
RESET_SIMULATORS="${RESET_SIMULATORS:-1}"

find_latest_ios_runtime() {
  xcrun simctl list runtimes | awk '
    $0 ~ /iOS/ && $0 ~ /com\.apple\.CoreSimulator\.SimRuntime\.iOS/ && $0 !~ /unavailable/ { print $NF }
  ' | tail -n 1
}

if [[ -z "$IOS_RUNTIME" ]]; then
  IOS_RUNTIME="$(find_latest_ios_runtime)"
fi
if [[ -z "$IOS_RUNTIME" ]]; then
  echo "❌ No available iOS simulator runtime found. Install an iOS runtime in Xcode > Settings > Platforms."
  exit 1
fi

DEVICE_SPECS=(
  "KIS Small iPhone|iPhone SE (3rd generation)|$IOS_RUNTIME"
  "KIS Small iPad|iPad mini (A17 Pro)|$IOS_RUNTIME"
)

sim_udid_by_name() {
  local name="$1"
  xcrun simctl list devices \
    | grep -F "$name (" \
    | head -n 1 \
    | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
}

ensure_device() {
  local name="$1"
  local type_name="$2"
  local runtime="$3"
  local udid
  udid="$(sim_udid_by_name "$name")"
  if [[ -n "$udid" ]]; then
    echo "$udid"
    return 0
  fi
  echo "➡️  Creating simulator: $name ($type_name, $runtime)" >&2
  xcrun simctl create "$name" "$type_name" "$runtime"
}

boot_device() {
  local udid="$1"
  local name="$2"
  echo "➡️  Booting $name [$udid]"
  xcrun simctl boot "$udid" 2>/dev/null || true
}

METRO_PID=""
cleanup() {
  if [[ -n "$METRO_PID" ]]; then
    echo ""
    echo "➡️  Stopping Metro ($METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$RESET_SIMULATORS" == "1" ]]; then
  echo "➡️  Shutting down previously opened simulators so only the small lab opens..."
  xcrun simctl shutdown all 2>/dev/null || true
fi

TARGETS=()
for spec in "${DEVICE_SPECS[@]}"; do
  IFS='|' read -r name type_name runtime <<< "$spec"
  udid="$(ensure_device "$name" "$type_name" "$runtime")"
  boot_device "$udid" "$name"
  TARGETS+=("$name|$udid")
done

open -a Simulator || true

echo "➡️  Starting Metro bundler..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep "$METRO_WAIT_SECONDS"

for target in "${TARGETS[@]}"; do
  IFS='|' read -r name udid <<< "$target"
  echo "➡️  Installing and launching KIS on $name [$udid]"
  if ! npx react-native run-ios --udid "$udid" --no-packager; then
    echo "⚠️  run-ios reported an issue on $name. Continuing."
    continue
  fi
  xcrun simctl launch "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
done

echo ""
echo "✅ Small device lab is ready: one small iPhone and one small iPad."
echo "   Keep this terminal open for Metro. Press Ctrl+C when finished."
wait "$METRO_PID"
