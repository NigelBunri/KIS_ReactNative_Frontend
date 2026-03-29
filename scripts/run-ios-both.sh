#!/usr/bin/env bash

# Stop on error by default
set -e

# === iOS 17 Simulators ===
# Make sure these EXACT names exist in:  xcrun simctl list devices
SIM_1="iPhone 17 Pro"
SIM_2="iPhone 17 Pro Max"

echo "➡️ Booting simulators: $SIM_1 and $SIM_2"

# Boot both (no-op if already booted)
xcrun simctl boot "$SIM_1" 2>/dev/null || true
xcrun simctl boot "$SIM_2" 2>/dev/null || true

# Ensure Simulator.app is open
open -a Simulator || true

echo "➡️ Starting Metro bundler..."
npx react-native start --reset-cache &
METRO_PID=$!

# Give Metro time to warm up
sleep 8

echo "➡️ Installing & launching app on $SIM_1..."
if ! npx react-native run-ios --simulator "$SIM_1" --no-packager; then
  echo "⚠️ run-ios reported an issue on $SIM_1, but continuing..."
fi

echo "➡️ Installing & launching app on $SIM_2..."
if ! npx react-native run-ios --simulator "$SIM_2" --no-packager; then
  echo "⚠️ run-ios reported an issue on $SIM_2."
fi

echo "✅ Both iOS 17 simulators should now be running the app."

# Keep Metro alive until Ctrl+C
wait $METRO_PID