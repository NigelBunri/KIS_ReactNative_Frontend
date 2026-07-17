# KIS Native Desktop Audit

## Source Reality

The current `KIS_desktop` tree is not a native desktop app. It is a copied React Native mobile/tablet client with:
- `App.tsx`, Metro, Babel, Jest
- `android/` and `ios/` mobile targets
- React Navigation flow orchestration
- many mobile-only dependencies (`react-native-*`, camera/audio/webrtc/contact/file modules)

That copy is still useful, but only as a **reference implementation** for product behavior and visual language.

## What Can Be Reused Conceptually

- Brand system
  - gold / cream / parchment / royal-ink palette from `src/theme/constants.ts`
  - large-screen shell cues from `mockups.png` and `large_screen_size_design.png`
- Product information architecture
  - login/auth gating in `App.tsx`
  - main navigation concepts: Messages, Broadcast, Bible, Partners, Events, Settings
- Screen semantics
  - dashboard summary cards
  - broadcast/event detail flows
  - sidebar + content + context panel desktop-style ideas already explored in `src/components/shell/*`
- API/backend patterns
  - auth/session validation against backend
  - GraphQL gateway + Django/Nest as source of truth
  - network/cache/error-shaping concepts from `src/network/*`
- Domain language
  - broadcasts, events, institutions, learner progress, partner/admin surfaces

## What Must Be Rebuilt Natively

- Entire desktop UI layer
  - all React Native `View`, `Text`, `FlatList`, navigation stacks, overlays, sheets
- Navigation model
  - native macOS sidebar/window navigation rather than React Navigation stacks
- State container and view orchestration
  - SwiftUI observable models / async loading / task lifecycles
- Native persistence layer
  - Keychain / local app support storage / cache strategy
- Native desktop affordances
  - menu commands, keyboard shortcuts, multiple windows/panels, focus model, hover interactions

## What Should Become Shared Specs, Not Shared UI Code

- Color tokens and semantic palette
- Typography sizing scale
- spacing/radius/shadow rules
- API DTO contracts and auth headers
- route naming / screen responsibilities
- copy and empty-state language

## Recommended Delivery Strategy

1. **macOS-first native shell** from this machine using SwiftUI.
2. Use the RN app only to extract:
   - tokens
   - flows
   - DTO shapes
   - screen composition patterns
3. Keep a separate `native/` area so the copied RN app remains untouched as reference.
4. Defer Windows native shell until the macOS architecture is proven.

## Immediate Scope Built In This Phase

- macOS native app foundation
- native desktop shell
- login screen
- dashboard/home screen
- broadcasts overview
- event detail
- broadcast detail
- thin API client scaffold targeting backend / GraphQL gateway later
