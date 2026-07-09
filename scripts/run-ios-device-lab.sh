#!/usr/bin/env bash
set -euo pipefail

# KIS iOS device-lab launcher
# Boots two iPhones, two iPads, and two Apple Watch simulators when watchOS is installed.
# Installs/runs the React Native iOS app on iPhone/iPad simulators.
# Note: KIS currently has an iOS app target only. Apple Watch simulators are booted for
# environment visibility, but the app cannot be installed on watches until a watchOS target exists.

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_ROOT"

IOS_RUNTIME="${IOS_RUNTIME:-}"
WATCH_RUNTIME="${WATCH_RUNTIME:-}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.kis}"
METRO_WAIT_SECONDS="${METRO_WAIT_SECONDS:-8}"
RESET_SIMULATORS="${RESET_SIMULATORS:-1}"

find_latest_runtime() {
  local platform="$1"
  xcrun simctl list runtimes | awk -v platform="$platform" '
    $0 ~ platform && $0 ~ /com\.apple\.CoreSimulator\.SimRuntime\./ && $0 !~ /unavailable/ { print $NF }
  ' | tail -n 1
}

if [[ -z "$IOS_RUNTIME" ]]; then
  IOS_RUNTIME="$(find_latest_runtime 'iOS')"
fi
if [[ -z "$IOS_RUNTIME" ]]; then
  echo "❌ No available iOS simulator runtime found. Install an iOS runtime in Xcode > Settings > Platforms."
  exit 1
fi

if [[ -z "$WATCH_RUNTIME" ]]; then
  WATCH_RUNTIME="$(find_latest_runtime 'watchOS' || true)"
fi

DEVICE_SPECS=(
  "KIS Lab iPhone Small|iPhone SE (3rd generation)|$IOS_RUNTIME|install"
  "KIS Lab iPhone Large|iPhone 17 Pro Max|$IOS_RUNTIME|install"
  "KIS Lab iPad Small|iPad mini (A17 Pro)|$IOS_RUNTIME|install"
  "KIS Lab iPad Large|iPad Pro 13-inch (M4)|$IOS_RUNTIME|install"
)

if [[ -n "$WATCH_RUNTIME" ]]; then
  DEVICE_SPECS+=(
    "KIS Lab Watch Small|Apple Watch SE 3 (40mm)|$WATCH_RUNTIME|boot-only"
    "KIS Lab Watch Large|Apple Watch Ultra 3 (49mm)|$WATCH_RUNTIME|boot-only"
  )
else
  echo "⚠️  No watchOS simulator runtime found. Watch simulators will be skipped."
  echo "   Install watchOS runtime in Xcode > Settings > Platforms if you need watch simulators."
fi

sim_udid_by_name() {
  local name="$1"
  xcrun simctl list devices     | grep -F "$name ("     | head -n 1     | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
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

launch_simulator_app() {
  if command -v open >/dev/null 2>&1; then
    open -a Simulator || true
  fi
}

METRO_PID=""
cleanup() {
  if [[ -n "$METRO_PID" ]]; then
    echo "\n➡️  Stopping Metro ($METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$RESET_SIMULATORS" == "1" ]]; then
  echo "➡️  Shutting down previously opened simulators so only this device lab opens..."
  xcrun simctl shutdown all 2>/dev/null || true
fi

INSTALL_TARGETS=()
BOOT_ONLY_TARGETS=()

for spec in "${DEVICE_SPECS[@]}"; do
  IFS='|' read -r name type_name runtime mode <<< "$spec"
  udid="$(ensure_device "$name" "$type_name" "$runtime")"
  boot_device "$udid" "$name"
  if [[ "$mode" == "install" ]]; then
    INSTALL_TARGETS+=("$name|$udid")
  else
    BOOT_ONLY_TARGETS+=("$name|$udid")
  fi
done

launch_simulator_app

echo "➡️  Starting Metro bundler..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep "$METRO_WAIT_SECONDS"

for target in "${INSTALL_TARGETS[@]}"; do
  IFS='|' read -r name udid <<< "$target"
  echo "➡️  Installing and launching KIS on $name [$udid]"
  if ! npx react-native run-ios --udid "$udid" --no-packager; then
    echo "⚠️  run-ios reported an issue on $name. Continuing to the next simulator."
    continue
  fi
  xcrun simctl launch "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
done

if [[ "${#BOOT_ONLY_TARGETS[@]}" -gt 0 ]]; then
  echo ""
  echo "ℹ️  Watch simulators booted but app install skipped because KIS has no watchOS app target yet:"
  for target in "${BOOT_ONLY_TARGETS[@]}"; do
    IFS='|' read -r name udid <<< "$target"
    echo "   - $name [$udid]"
  done
fi

echo ""
echo "✅ Device lab is ready. Installed on ${#INSTALL_TARGETS[@]} iPhone/iPad simulators."
echo "   Keep this terminal open for Metro. Press Ctrl+C when finished."
wait "$METRO_PID"
