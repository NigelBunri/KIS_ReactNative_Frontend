#!/usr/bin/env bash
set -euo pipefail

# KIS controlled three-phone iOS launcher.
# Opens exactly one iPhone 17, one iPhone 17 Pro, and one iPhone 17 Pro Max.
# Re-running keeps these three lab devices booted and closes every other simulator.

RESET_OTHER_SIMULATORS="${RESET_OTHER_SIMULATORS:-1}"
REFRESH_SIMULATOR_APP_WHEN_EXTRAS_FOUND="${REFRESH_SIMULATOR_APP_WHEN_EXTRAS_FOUND:-1}"
METRO_WAIT_SECONDS="${METRO_WAIT_SECONDS:-8}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-org.reactjs.native.example.KIS}"
IOS_RUNTIME="${IOS_RUNTIME:-}"

if command -v pnpm >/dev/null 2>&1; then
  RN_CMD=(pnpm exec react-native)
else
  RN_CMD=(npx react-native)
fi

find_latest_ios_runtime() {
  xcrun simctl list runtimes | awk '
    $0 ~ /iOS/ && $0 ~ /com\.apple\.CoreSimulator\.SimRuntime\.iOS/ && $0 !~ /unavailable/ { print $NF }
  ' | tail -n 1
}

if [[ -z "$IOS_RUNTIME" ]]; then
  IOS_RUNTIME="$(find_latest_ios_runtime)"
fi
if [[ -z "$IOS_RUNTIME" ]]; then
  echo "ERROR: No available iOS simulator runtime found."
  exit 1
fi

# Dedicated names stop React Native/Xcode from choosing your old generic simulators.
DEVICE_SPECS=(
  "KIS Lab iPhone 17|iPhone 17|$IOS_RUNTIME"
  "KIS Lab iPhone 17 Pro|iPhone 17 Pro|$IOS_RUNTIME"
  "KIS Lab iPhone 17 Pro Max|iPhone 17 Pro Max|$IOS_RUNTIME"
)

matching_udids_by_exact_name() {
  local name="$1"
  xcrun simctl list devices available \
    | grep -F "$name (" \
    | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
}

all_booted_udids() {
  xcrun simctl list devices booted \
    | sed -nE 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/p'
}

contains_udid() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

ensure_single_device() {
  local name="$1"
  local type_name="$2"
  local runtime="$3"
  local udids=()
  local udid

  while IFS= read -r udid; do
    [[ -n "$udid" ]] && udids+=("$udid")
  done < <(matching_udids_by_exact_name "$name")

  if [[ "${#udids[@]}" -eq 0 ]]; then
    echo "Creating simulator: $name ($type_name, $runtime)" >&2
    xcrun simctl create "$name" "$type_name" "$runtime"
    return 0
  fi

  # Keep only the first exact KIS lab simulator for this target. Extra lab devices
  # are not deleted, but they are shut down so only one of each can appear.
  echo "${udids[0]}"
  if [[ "${#udids[@]}" -gt 1 ]]; then
    for duplicate in "${udids[@]:1}"; do
      echo "Duplicate $name found; shutting down duplicate [$duplicate]" >&2
      xcrun simctl shutdown "$duplicate" 2>/dev/null || true
    done
  fi
}

TARGETS=()
TARGET_UDIDS=()
for spec in "${DEVICE_SPECS[@]}"; do
  IFS='|' read -r name type_name runtime <<< "$spec"
  udid="$(ensure_single_device "$name" "$type_name" "$runtime")"
  TARGETS+=("$name|$udid")
  TARGET_UDIDS+=("$udid")
done

EXTRAS_CLOSED=0
if [[ "$RESET_OTHER_SIMULATORS" == "1" ]]; then
  echo "Closing every booted simulator except the three KIS lab iPhones..."
  while IFS= read -r booted; do
    [[ -z "$booted" ]] && continue
    if ! contains_udid "$booted" "${TARGET_UDIDS[@]}"; then
      echo "Closing extra simulator [$booted]"
      xcrun simctl shutdown "$booted" 2>/dev/null || true
      EXTRAS_CLOSED=1
    fi
  done < <(all_booted_udids)
fi

# If old duplicate windows were already open, refresh Simulator.app after closing
# extras. This does not delete devices and does not shut down the three targets.
if [[ "$EXTRAS_CLOSED" == "1" && "$REFRESH_SIMULATOR_APP_WHEN_EXTRAS_FOUND" == "1" ]]; then
  osascript -e 'tell application "Simulator" to quit' >/dev/null 2>&1 || true
  sleep 1
fi

for target in "${TARGETS[@]}"; do
  IFS='|' read -r name udid <<< "$target"
  echo "Booting $name [$udid]"
  xcrun simctl boot "$udid" 2>/dev/null || true
done

open -a Simulator || true

METRO_PID=""
cleanup() {
  if [[ -n "$METRO_PID" ]]; then
    echo ""
    echo "Stopping Metro ($METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Metro bundler..."
"${RN_CMD[@]}" start --reset-cache &
METRO_PID=$!
sleep "$METRO_WAIT_SECONDS"

for target in "${TARGETS[@]}"; do
  IFS='|' read -r name udid <<< "$target"
  echo "Installing and launching KIS on $name [$udid]"
  if ! "${RN_CMD[@]}" run-ios --udid "$udid" --no-packager; then
    echo "WARNING: run-ios reported an issue on $name [$udid], continuing..."
    continue
  fi
  xcrun simctl launch "$udid" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
done

echo ""
echo "KIS install/launch attempted on exactly these three simulator targets:"
for target in "${TARGETS[@]}"; do
  IFS='|' read -r name udid <<< "$target"
  echo "   - $name [$udid]"
done
echo "   Keep this terminal open for Metro. Press Ctrl+C when finished."
wait "$METRO_PID"
