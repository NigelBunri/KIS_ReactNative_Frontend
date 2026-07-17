#!/usr/bin/env bash
set -euo pipefail

# KIS iPad launcher — standalone from run-ios-both.sh (the 3-iPhone lab).
# Boots exactly one dedicated "KIS Lab iPad" simulator and installs/launches
# KIS on it, WITHOUT touching any other booted simulator (unlike
# run-ios-both.sh, which shuts down everything else). Runs its own Metro
# instance on a DIFFERENT port (8082) from run-ios-both.sh's default (8081),
# so the two never share — and never accidentally serve each other a stale
# module graph — a shared Metro instance previously caused exactly that
# (Metro kept running from an iPhone session, resolved modules against an
# older file state, and threw "module doesn't exist" for files the iPad
# session had since changed).
#
# It also builds into its own DerivedData folder (--buildFolder, maps to
# Xcode's -derivedDataPath) instead of Xcode's default per-project one —
# xcodebuild's build database (XCBuildData/build.db) is locked per
# DerivedData folder, not per simulator/scheme, so running this at the same
# time as `ios:both` against the shared default folder throws "database is
# locked... two concurrent builds running in the same filesystem location".
# Different Metro ports alone don't fix that — this is a separate,
# project-level Xcode resource. Safe to run fully in parallel with
# `pnpm run ios:both` now.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RESET_OTHER_SIMULATORS="${RESET_OTHER_SIMULATORS:-0}"
METRO_WAIT_SECONDS="${METRO_WAIT_SECONDS:-8}"
METRO_PORT="${METRO_PORT:-8082}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.kis}"
IOS_RUNTIME="${IOS_RUNTIME:-}"
IPAD_BUILD_FOLDER="${IPAD_BUILD_FOLDER:-$REPO_ROOT/ios/build-ipad}"
IPAD_DEVICE_NAME="${IPAD_DEVICE_NAME:-KIS Lab iPad}"
# Largest current iPad — comfortably clears the 1024dp "desktop" tablet-shell
# breakpoint (src/theme/responsive.ts) as well as the 768dp tablet one.
# Override with e.g. IPAD_DEVICE_TYPE="iPad Pro 11-inch (M4)" for a smaller one.
IPAD_DEVICE_TYPE="${IPAD_DEVICE_TYPE:-iPad Pro 13-inch (M4)}"

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

matching_udids_by_exact_name() {
  local name="$1"
  xcrun simctl list devices available \
    | grep -F "$name (" \
    | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
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

  echo "${udids[0]}"
  if [[ "${#udids[@]}" -gt 1 ]]; then
    for duplicate in "${udids[@]:1}"; do
      echo "Duplicate $name found; shutting down duplicate [$duplicate]" >&2
      xcrun simctl shutdown "$duplicate" 2>/dev/null || true
    done
  fi
}

UDID="$(ensure_single_device "$IPAD_DEVICE_NAME" "$IPAD_DEVICE_TYPE" "$IOS_RUNTIME")"

# Opt-in only — default leaves every other booted simulator (e.g. your 3 KIS
# lab iPhones from run-ios-both.sh) running untouched.
if [[ "$RESET_OTHER_SIMULATORS" == "1" ]]; then
  echo "Closing every booted simulator except $IPAD_DEVICE_NAME..."
  while IFS= read -r booted; do
    [[ -z "$booted" || "$booted" == "$UDID" ]] && continue
    echo "Closing extra simulator [$booted]"
    xcrun simctl shutdown "$booted" 2>/dev/null || true
  done < <(xcrun simctl list devices booted | sed -nE 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/p')
fi

# CoreSimulator boot is asynchronous — `simctl boot` returning doesn't mean
# the device has actually reached "Booted" yet. Racing straight into
# `run-ios` risks CoreSimulator error 405 ("Unable to lookup in current
# state: Shutting Down") if the device is still mid-transition, especially
# with several other simulators (the iPhone lab) and a long Xcode build
# competing for resources at the same time. Poll until it settles.
wait_for_booted() {
  local udid="$1"
  local timeout="${2:-45}"
  local waited=0
  while (( waited < timeout )); do
    if xcrun simctl list devices | grep -F "($udid)" | grep -q "(Booted)"; then
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

echo "Booting $IPAD_DEVICE_NAME [$UDID]"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator || true

if ! wait_for_booted "$UDID"; then
  echo "WARNING: $IPAD_DEVICE_NAME didn't reach Booted state in time — retrying boot once..." >&2
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  sleep 2
  xcrun simctl boot "$UDID" 2>/dev/null || true
  wait_for_booted "$UDID" 60 || echo "WARNING: still not confirmed Booted — proceeding anyway, this may fail." >&2
fi

metro_already_running() {
  lsof -i "tcp:${METRO_PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

METRO_PID=""
cleanup() {
  if [[ -n "$METRO_PID" ]]; then
    echo ""
    echo "Stopping Metro ($METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if metro_already_running; then
  echo "Metro already running on port $METRO_PORT (a previous ios:ipad run) — reusing it."
else
  echo "Starting Metro bundler on port $METRO_PORT..."
  "${RN_CMD[@]}" start --reset-cache --port "$METRO_PORT" &
  METRO_PID=$!
  sleep "$METRO_WAIT_SECONDS"
fi

echo "Installing and launching KIS on $IPAD_DEVICE_NAME [$UDID] (Metro port $METRO_PORT)"
if ! "${RN_CMD[@]}" run-ios --udid "$UDID" --no-packager --port "$METRO_PORT" --buildFolder "$IPAD_BUILD_FOLDER"; then
  echo "WARNING: install/launch failed (often a transient CoreSimulator race, e.g. error 405 'Shutting Down') — re-confirming boot and retrying once..." >&2
  xcrun simctl boot "$UDID" 2>/dev/null || true
  wait_for_booted "$UDID" 60 || true
  "${RN_CMD[@]}" run-ios --udid "$UDID" --no-packager --port "$METRO_PORT" --buildFolder "$IPAD_BUILD_FOLDER"
fi
xcrun simctl launch "$UDID" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true

echo ""
echo "KIS installed/launched on: $IPAD_DEVICE_NAME [$UDID] (Metro port $METRO_PORT)"
if [[ -n "$METRO_PID" ]]; then
  echo "   Keep this terminal open for Metro. Press Ctrl+C when finished."
  wait "$METRO_PID"
else
  echo "   Using the already-running ios:ipad Metro instance on port $METRO_PORT — nothing more to keep open here."
fi
