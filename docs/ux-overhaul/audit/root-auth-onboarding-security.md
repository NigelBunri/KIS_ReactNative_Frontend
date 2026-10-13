# UX/UI Audit — Auth / Onboarding / Account Security (root `src/screens/*.tsx`)

**Batch:** 28 files in `src/screens/` that make up the authentication, onboarding, and account-security surface — the app's first-run experience and its highest-trust screens.
**Date:** 2026-10-12
**Scope:** Deep per-screen UX/UI/accessibility audit, not a file inventory. A prior pass already audited and fixed 11 files with small, safe accessibility-label additions on icon-only buttons (verified via `git diff` + typecheck in this pass — re-confirmed clean, left exactly as-is): `AccountDeletionScreen.tsx`, `AdminUserManagementScreen.tsx`, `CacheManagementScreen.tsx`, `ComplianceSettingsScreen.tsx`, `DeviceManagementScreen.tsx`, `EventsScreen.tsx`, `LinkedDevicesScreen.tsx`, `PasswordChangeScreen.tsx`, `QuickLockScreen.tsx`, `SearchScreen.tsx`, `TwoFactorScreen.tsx`. This pass covers the remaining 17 files: `DeviceVerificationScreen.tsx`, `EmailVerificationScreen.tsx`, `GlobalSearchScreen.tsx`, `KisAuthLinkScreen.tsx`, `KisAuthRegisterPhoneScreen.tsx`, `LoginScreen.tsx`, `NotificationSettingsScreen.tsx`, `ParentRecoveryScreen.tsx`, `PrivacyPolicyScreen.tsx`, `QRScanLoginScreen.tsx`, `RegisterScreen.tsx`, `SetupPINScreen.tsx`, `SplashScreen.tsx`, `SubscriptionManagementScreen.tsx`, `TermsAndConditionsScreen.tsx`, `VerificationChannelSelectScreen.tsx`, `WelcomeScreen.tsx`.

## Summary

28/28 files in this surface now have an audit record. Of the 17 files audited in this pass: 6 got trivial, safe fixes (accessibility role/label on icon-only back buttons, one checkbox missing its accessibility role/state, one delete-key icon missing a label, one error-message clarity fix); 11 had no issues worth changing, several of them notably well-built already (see below).

**The single most important finding in this batch is a non-finding, and it matters because of what the brief asked to specifically hunt for:** `SubscriptionManagementScreen.tsx` — flagged in the task brief as needing extra scrutiny because cancelling a subscription is a high-consequence, hard-to-reverse account action — **already has a correct two-step confirmation flow.** Tapping "Cancel Subscription" does not cancel anything; it opens a `CancelModal` that requires picking a cancellation reason, shows "Your subscription will remain active until the end of the current billing period," and only then offers an explicit "Confirm Cancellation" button alongside "Keep My Subscription." Resuming, downgrading, and viewing the receipt are all handled with equal care (native `Alert` confirm for resume, a tier-picker sheet for downgrade, graceful "no receipt link" / "can't open this link" messaging). Nothing was missing here; this is documented as a clean pass specifically because the brief asked to verify it.

**Second finding worth calling out — not a bug, but a recurring, trivial accessibility gap across the KIS-Auth and account-recovery screens:** four screens built with an identical hand-rolled header pattern (`ParentRecoveryScreen.tsx`, `KisAuthLinkScreen.tsx`, `KisAuthRegisterPhoneScreen.tsx`, `QRScanLoginScreen.tsx`) all had an icon-only back `Pressable` with no `accessibilityRole`/`accessibilityLabel`, unlike every other screen in this surface that already uses the shared `ScreenHeader` component (which has correct accessibility baked in). These are exactly the kind of account-recovery and device-linking screens where getting stuck with no way back matters most. All four are fixed in this pass.

The rest of the surface — `SplashScreen`, `WelcomeScreen`, `LoginScreen`, `DeviceVerificationScreen`, `EmailVerificationScreen`, `VerificationChannelSelectScreen`, `NotificationSettingsScreen`, `PrivacyPolicyScreen`, `TermsAndConditionsScreen`, `GlobalSearchScreen` — is in genuinely good shape: every login/registration/verification/recovery failure path in this codebase surfaces a specific, actionable `Alert` rather than failing silently or pretending success, which was explicitly called out in the brief as the most common recurring bug class found elsewhere in this app. No instance of silent-error-swallowing or fabricate-success-on-failure was found in this batch.

---

## SplashScreen (`src/screens/SplashScreen.tsx`)
**Entry point:** rendered directly by `App.tsx` while the app's initial auth/bootstrap check is in flight (`return <SplashScreen />` at App.tsx:1252).
**Criteria evaluated:** visual hierarchy, color/contrast/design-system consistency, cognitive load, small-screen usability.
**Not applicable:** touch targets/accessibility labels (no interactive elements — pure branding screen); forms/validation; navigation/back; loading/error/offline states (nothing to fetch — purely a timed branding screen); journey integration beyond "first thing shown."

### Findings
1. **Fixed 8-second minimum splash duration (P3, informational only).** `DEFAULT_SPLASH_DURATION_MS = 8000` with an inline comment inviting a future change — long for a splash screen by platform convention (iOS/Android guidance is closer to 1–2s), but this is a deliberate, already-flagged design choice rather than a bug, and changing timing is outside this audit's "accessibility/confirmation/error-clarity" fix scope.
2. **Good: theme-aware (light/dark logo swap), animations are all cleaned up correctly on unmount** (every `Animated.loop` has a matching `.stop()` in the effect's cleanup) — no orphaned-timer risk here.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## WelcomeScreen (`src/screens/WelcomeScreen.tsx`)
**Entry point:** `RootStack.Screen name="Welcome"` (App.tsx:2180–2183), the first screen in the unauthenticated stack.
**Criteria evaluated:** visual hierarchy, typography, color/contrast, navigation, cognitive load, error/offline states, journey integration (Splash → Welcome → Register/Login).
**Not applicable:** forms/validation (no form on this screen); destructive-action confirmations (none present); touch targets (no icon-only controls — all buttons are text-labeled `KISButton`/`KISText` links).

### Findings
1. **Good: the "already logged in → auto-redirect" check fails safe in every branch.** `checkAndRedirectIfLoggedIn` is careful to distinguish "no token at all" (stay on Welcome) from "token exists but the network/status check failed" (keep the user logged in rather than bouncing them back to Welcome) — exactly the right posture, and the kind of "don't fabricate a logout on a network hiccup" care this audit was told to look for the absence of.
2. **Good: 429 backoff and in-flight/throttle guards** prevent this auth-check from hammering the backend on repeated focus events (app foregrounding, screen refocus, etc.).
3. Minor (P3, not fixed): the "Privacy" / "Terms" footer links are `KISText` with an `onPress`, not wrapped in a `Pressable` with `accessibilityRole="link"` — functionally fine (tap area is the text itself, which is accessible by default since it has visible text), but not using the semantic `link` role a screen-reader user would expect.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## LoginScreen (`src/screens/LoginScreen.tsx`)
**Entry point:** `RootStack.Screen name="Login"` (App.tsx:2194).
**Criteria evaluated:** visual hierarchy, forms/validation, error/success states, destructive/sensitive actions (forgot-password flow), accessibility labels, touch targets, navigation, journey integration (Welcome → Login → Verification/TwoFactor/ParentRecovery/QRScanLogin).
**Not applicable:** offline-state handling beyond what's already covered by generic request error messages (no bespoke offline UI on this screen, consistent with the rest of the surface).

### Findings
1. **Good: every login failure path is distinct and actionable, not generic.** `onLogin` separately handles `phone_not_found`, `wrong_password`, `account_disabled` (with a careful, safe "Try to Reactivate" option scoped to not accidentally un-ban a moderation case — the reactivate endpoint itself no-ops for anything but a self-deletion grace period), `secondary_device_qr_required` (offers both "Recover Account" and "Scan QR" rather than stranding a reinstalled-phone user with only the QR option, which they may not be able to complete), `phone_not_verified` (routes to `VerificationChannelSelect`), and `two_factor_required` (routes to `TwoFactor`). This is a genuinely well-thought-through error taxonomy — exactly the opposite of the "silent failure / fabricated success" pattern this audit was told to hunt for.
2. **Good: the forgot-password modal correctly resets its own state** on both successful completion and explicit "Cancel," so a half-filled reset flow never leaks into a later attempt.
3. Minor (P3, not fixed): the top-of-screen "Back" `Pressable` (icon + adjacent visible "Back" text) has no explicit `accessibilityRole`/`accessibilityLabel`. Because it has visible text, a screen reader will still announce something, but not with the semantic `button` role. Left undisturbed since the established fix pattern in this audit program (and the prior 11-file pass) targets genuinely *icon-only* controls, which this is not.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## RegisterScreen (`src/screens/RegisterScreen.tsx`)
**Entry point:** `RootStack.Screen name="Register"` (App.tsx:2195–2198); also reachable from `InviteJoinScreen`'s referral deep-link branch.
**Criteria evaluated:** forms/validation, password-strength feedback, confirmations, accessibility labels/roles, touch targets, error states, journey integration (Welcome/Login → Register → VerificationChannelSelect).
**Not applicable:** destructive-action confirmation (registration is not a destructive action); offline states (generic request-error handling only).

### Findings
1. **Accessibility gap: the "I agree to the Terms & Conditions and Privacy Policy" checkbox had no `accessibilityRole="checkbox"` or `accessibilityState` (P2).** It's a custom `View` styled to look like a checkbox inside a `Pressable`, with no semantic role or checked-state exposed — a screen-reader user tapping it would hear the terms text read as a link-like label with no indication it is a checkbox or what its current state is. This sits directly on the account-creation consent gate, so it's a meaningful accessibility bug on a legally-relevant control, not a cosmetic one.
2. **Good: real-time, per-rule password-requirement feedback** (length / uppercase / lowercase / digit, each independently colored success/danger) rather than a single pass/fail message — strong cognitive-load design for a first-run form.
3. **Good: the SIM-number-mismatch warning during registration** (`"Number doesn't match this device's SIM"`) explains *why* it matters (recognizing this device as primary later without a QR code) and lets the user either fix the number or proceed anyway — informative, not a silent block.
4. **Good: Google sign-up (KIS Auth) and password sign-up failure paths are both specific** (`already_registered`, state-mismatch, generic failure) rather than generic "something went wrong."

### Fixes implemented
- Added `accessibilityRole="checkbox"`, `accessibilityState={{ checked: termsAgreed }}`, and `accessibilityLabel="I have read and agree to the Terms & Conditions and Privacy Policy"` to the terms-agreement `Pressable` (src/screens/RegisterScreen.tsx, the `onPress={() => setTermsAgreed(v => !v)}` row). Accessibility-only change, no logic touched.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/RegisterScreen.tsx` — only pre-existing `no-void` and `react-native/no-inline-styles` warnings remain (confirmed against `git diff` that none were introduced by this change).

**Status:** AUDITED-FIXED

---

## SetupPINScreen (`src/screens/SetupPINScreen.tsx`)
**Entry point:** `RootStack.Screen name="SetupPIN"` (App.tsx, `getComponent`), reached from account setup / Quick Lock onboarding.
**Criteria evaluated:** cognitive load (two-step enter/confirm flow), error recovery, accessibility labels on icon-only controls, touch targets, small-screen usability.
**Not applicable:** forms/network error states (this screen only calls the local `setPIN` service — no network round trip to fail); destructive-action confirmation (setting a PIN is not destructive — the destructive "forgot PIN → sign out" action lives in the already-audited `QuickLockScreen.tsx`, which already has its confirmation per the prior pass's fix).

### Findings
1. **Accessibility gap: the delete/backspace key ("⌫") on the number pad had no `accessibilityLabel` (P2).** Every digit key is self-describing via its visible number text, but the delete key is a bare Unicode glyph with no semantic label — exactly the icon-only-control gap this audit program has been fixing throughout.
2. **Good: mismatch recovery is well-handled.** Entering a confirm-step PIN that doesn't match the first entry shakes the dot row, shows "PINs do not match. Try again," clears the current entry, and offers an explicit "Start over" link back to step one — no dead end, no silent failure, no lost context.
3. **Good: numeric keys are disabled during the `saving` request** so a slow `setPIN` call can't be double-submitted by rapid tapping.

### Fixes implemented
- Added `accessibilityRole="button"` and `accessibilityLabel="Delete digit"` to the backspace/delete key.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/SetupPINScreen.tsx` — only a pre-existing `no-void` warning remains.

**Status:** AUDITED-FIXED

---

## QRScanLoginScreen (`src/screens/QRScanLoginScreen.tsx`)
**Entry point:** `RootStack.Screen name="QRScanLogin"` (App.tsx:2221–2225, `presentation: 'fullScreenModal'`), reached from LoginScreen's "Log in as a secondary device" button and from the "secondary_device_qr_required" error branch.
**Criteria evaluated:** error/failure clarity, accessibility labels on icon-only controls, touch targets, trust/security clarity, forms/validation, journey integration.
**Not applicable:** destructive-action confirmation (linking a secondary device via a short-lived, single-use, primary-device-generated QR token is not itself destructive from this screen's side).

### Findings
1. **Accessibility gap: the icon-only back button had no `accessibilityRole`/`accessibilityLabel` (P2)** — same pattern as the other KIS-Auth/recovery screens below, on a screen that is itself an account-security-adjacent flow (device linking).
2. **Error-clarity gap: a denied/unavailable camera permission was indistinguishable from a successful photo capture (P2).** `handleCameraCapture`'s only non-cancel branch unconditionally showed "Enter the QR token" / "Copy the token shown below the QR code..." regardless of whether `launchCamera` actually succeeded or returned an `errorCode` (e.g. permission denial). A user who denied camera access would see the exact same "go find the token" prompt as someone who successfully took a photo, with no indication *why* they're being asked to switch to manual entry — cognitive-load/trust problem on a security-sensitive screen, though not a silent crash since the fallback path (manual entry) still works.
3. **Good: every login-completion failure path is specific** ("QR code is invalid or has expired," "server linked the device but did not return an access token," etc.) rather than generic, and the security note ("expires every 3 hours... never share it with anyone") is clear and prominent.

### Fixes implemented
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.
- `handleCameraCapture` now checks `result.errorCode` before presenting the "enter the token" prompt: a permission-denial shows a distinct "Camera unavailable... Enable it in your device Settings, or enter the token manually" message, any other camera error surfaces `result.errorMessage`, and only an actual successful capture (no error, not cancelled) shows the original "copy the token" prompt. Both paths still land on the same manual-entry fallback — this only clarifies *why* the user is there, no behavior/flow change.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/QRScanLoginScreen.tsx` — one pre-existing `react-hooks/exhaustive-deps` error in the unrelated `handleToken` callback (confirmed via `git diff` this already existed before this pass's edits — not introduced here) plus pre-existing inline-style/`no-void` warnings.

**Status:** AUDITED-FIXED

---

## DeviceVerificationScreen (`src/screens/DeviceVerificationScreen.tsx`)
**Entry point:** `RootStack.Screen name="DeviceVerification"` (App.tsx:2203–2210, receives `setLoad` from App.tsx), reached from Register/Login/VerificationChannelSelect's OTP-channel flows.
**Criteria evaluated:** forms/validation, error/success states, cognitive load, accessibility, resend/cooldown UX, journey integration.
**Not applicable:** destructive-action confirmation (none present); icon-only controls (none — all controls are `KISButton`/`KISText` with visible labels).

### Findings
1. **Good: auto-submit on 6th digit, with an explicit comment explaining why `onVerify` is deliberately excluded from the effect's dependency array** (to avoid re-triggering on every keystroke) — careful, documented, not accidental.
2. **Good: resend cooldown is server-driven** (`retry_after` / `cooldown` from the response) rather than a hardcoded client timer, and the countdown is visually reflected in the button's own label ("Resend in Ns").
3. **Good: "too many attempts" is handled distinctly** from a generic wrong-code error, clearing the input and telling the user to request a new code rather than leaving them retrying a code the backend has already locked.
4. **Good: dev-only debug branch is correctly gated** behind `__DEV__ && res?.data?.debug` and never reachable in a production build.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## EmailVerificationScreen (`src/screens/EmailVerificationScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => EmailVerificationScreen}` (App.tsx:1820), reached from Settings/account-security as a proactive "add a recovery email" flow (not part of the mandatory first-run path).
**Criteria evaluated:** forms/validation, error states, accessibility labels, trust/security clarity, step-based cognitive load.
**Not applicable:** destructive-action confirmation (adding/verifying an email is additive, not destructive); touch targets on icon-only controls (the one icon-only control — the back button — already has correct accessibility, see below).

### Findings
1. **Good: back button already has `accessibilityRole="button"` and `accessibilityLabel="Go back"`** — this screen was already built to the bar this audit program has been raising the other 10+ screens to.
2. **Good: the screen explains *why* it exists up front** ("A verified email lets you recover your account if you ever lose access to your primary device. It's not used for anything else.") — directly addresses the trust/cognitive-load concern this audit was asked to check for on every auth-adjacent screen.
3. **Good: email-change-before-send ordering is correct and explained in a comment** — a changed email address is persisted via `PATCH` before the OTP is requested, since the OTP always mails whatever's on file; skipping this would silently mail the *old* address.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## VerificationChannelSelectScreen (`src/screens/VerificationChannelSelectScreen.tsx`)
**Entry point:** `RootStack.Screen name="VerificationChannelSelect"` (App.tsx:2211–2215), reached from Register's post-signup verification step and Login's "phone not verified" branch.
**Criteria evaluated:** forms/validation, error-recovery, accessibility, loading states, journey integration (Register/Login → VerificationChannelSelect → DeviceVerification).
**Not applicable:** destructive-action confirmation (none present).

### Findings
1. **Good: back button already has `accessibilityRole`/`accessibilityLabel`**, and each channel option card has its own `accessibilityLabel` matching its visible label.
2. **Good: a failed "start verification" call doesn't strand the user.** If initiating the OTP send fails, the alert offers "Enter code anyway" (in case an override/previously-sent code is still valid) alongside "Cancel" — rather than either blocking progress entirely or silently pretending the send succeeded.
3. **Good: channel list loading failure degrades gracefully** to a safe default (`email` only) rather than showing an empty/broken screen.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## ParentRecoveryScreen (`src/screens/ParentRecoveryScreen.tsx`)
**Entry point:** `RootStack.Screen name="ParentRecovery"` (App.tsx:2226–2229), reached from LoginScreen's "Lost your primary device?" link and the "secondary_device_qr_required" error branch's "Recover Account" option.
**Criteria evaluated:** forms/validation, accessibility labels on icon-only controls, trust/security clarity, high-consequence-action messaging (this flow immediately signs out the user's previous primary device), journey integration, deep-link replay/CSRF handling.
**Not applicable:** a confirmation dialog before the final "Verify & Recover" tap — the action is already gated behind a secret code that only reaches a verified email/phone the account owner controls, which functions as the confirmation step itself; the screen also states the device-transfer consequence up front on both the identify and done steps, so a dedicated extra "are you sure" dialog would be redundant rather than protective.

### Findings
1. **Accessibility gap: the icon-only back button had no `accessibilityRole`/`accessibilityLabel` (P2)** — notable given this is specifically the account-recovery escape hatch; a user stuck here with no accessible way back is a worse outcome than on an ordinary screen.
2. **Good: the irreversible consequence of this flow is stated clearly, twice** — once on the identify step ("Verifying it makes this device your primary immediately and signs your previous primary device out") and again on the done step ("Your previous primary device has been signed out immediately") — no surprise device-transfer.
3. **Good: the recovery-initiation response is deliberately treated as "always succeeded" from the user's perspective** ("Always show this message regardless of result — prevents account enumeration") — a well-reasoned, explicitly-commented security tradeoff, not an accidental silent failure.
4. **Good: KIS Auth (Google) deep-link return is guarded against replay/state-mismatch** with the same fail-closed posture used elsewhere in this surface (`KisAuthLinkScreen`, `RegisterScreen`'s Google branch).

### Fixes implemented
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/ParentRecoveryScreen.tsx` — only pre-existing `no-void`/inline-style warnings remain.

**Status:** AUDITED-FIXED

---

## KisAuthLinkScreen (`src/screens/KisAuthLinkScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => KisAuthLinkScreen}` (App.tsx:1857), reached from Settings/account-security — the only entry point that can create a Google-identity link (by explicit design, documented in-file: never inferred from a recovery or registration attempt).
**Criteria evaluated:** accessibility labels on icon-only controls, trust/security clarity, error states, deep-link replay handling.
**Not applicable:** destructive-action confirmation (linking is additive and reversible from Settings, not destructive); forms (no form on this screen, just a single action button).

### Findings
1. **Accessibility gap: the icon-only back button had no `accessibilityRole`/`accessibilityLabel` (P2).**
2. **Good: the security note is specific and reassuring** ("Only your Google account's stable identifier is stored, never your Google password. A Google account can only ever be linked to one KIS account at a time.") — directly addresses the kind of trust-clarity concern this audit was asked to check for.
3. **Good: "already linked to a different KIS account" is a distinct, explained error**, not a generic failure message.

### Fixes implemented
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/KisAuthLinkScreen.tsx` — only pre-existing `no-void`/inline-style warnings remain.

**Status:** AUDITED-FIXED

---

## KisAuthRegisterPhoneScreen (`src/screens/KisAuthRegisterPhoneScreen.tsx`)
**Entry point:** `RootStack.Screen name="KisAuthRegisterPhone"` (App.tsx:2199–2202), a fallback-only screen reached solely when the device has no in-app browser available and the Google OAuth return lands as a cold start via universal link (documented in-file).
**Criteria evaluated:** accessibility labels on icon-only controls, cognitive load (re-explains why the user is re-entering data), state-replay guarding, error states.
**Not applicable:** destructive-action confirmation (completing a sign-up is not destructive).

### Findings
1. **Accessibility gap: the icon-only back button had no `accessibilityRole`/`accessibilityLabel` (P2).**
2. **Good: the screen proactively explains why the user has to re-enter information** ("Your Google account is verified. We lost the details you entered earlier when the browser closed — add them again to finish.") rather than silently presenting an unexplained empty form, which would otherwise look like a bug.
3. **Good: state verification happens once on mount, fails closed, and routes back rather than letting a mismatched/replayed deep link silently proceed.**

### Fixes implemented
- Added `accessibilityRole="button"` / `accessibilityLabel="Go back"` to the back button.

### Verification
`npm run typecheck` — clean. `npx eslint src/screens/KisAuthRegisterPhoneScreen.tsx` — only pre-existing `no-void`/inline-style warnings remain.

**Status:** AUDITED-FIXED

---

## GlobalSearchScreen (`src/screens/GlobalSearchScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => GlobalSearchScreen}` (App.tsx:1634) and the detached `SearchOverlayOutlet` (App.tsx:556).
**Criteria evaluated:** navigation/dismiss behavior, result-routing correctness.
**Not applicable:** everything else — this file is a thin routing wrapper (dismiss handling + a large `switch` mapping a result's `kind` to a navigation target) around the already-audited `SearchScreen.tsx`, which owns 100% of this surface's actual UI, inputs, and accessibility concerns.

### Findings
1. **Good: dismiss behavior correctly branches** between the detached-overlay close callback and a plain `navigation.goBack()` fallback for the legacy registered route, with a comment explaining why the two need different handling.
2. No UI of its own to audit against the visual/accessibility/forms criteria.

### Fixes implemented
None — not applicable (no UI).

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## NotificationSettingsScreen (`src/screens/NotificationSettingsScreen.tsx`)
**Entry point:** `RootStack.Screen name="NotificationSettings"` (App.tsx:2087).
**Criteria evaluated:** forms/validation, error states, save-state feedback, touch targets, color/contrast.
**Not applicable:** destructive-action confirmation (toggling notification preferences is non-destructive and easily reversible); icon-only controls (back button is text-labeled "Back", not icon-only).

### Findings
1. **Good: validates Quiet Hours time format before attempting to save**, with a specific error message per field ("From"/"Until" must be HH:MM) rather than a generic "invalid input."
2. **Good: load failure degrades gracefully** — tries the backend first, falls back to locally-cached `AsyncStorage` values on any failure, and only then falls back to hardcoded defaults; the user is never shown a broken/empty settings screen.
3. **Good: save failure shows a specific, actionable alert** ("Could not save settings. Please try again.") rather than silently discarding the change or claiming success.
4. All touch targets (`Switch` rows, inputs) respect `responsive.minTouchTarget`.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## PrivacyPolicyScreen (`src/screens/PrivacyPolicyScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => PrivacyPolicyScreen}` (App.tsx:1839) and `component={PrivacyPolicyScreen}` (App.tsx:2191); also linked from WelcomeScreen, LoginScreen, and RegisterScreen's terms-agreement text.
**Criteria evaluated:** readability/typography, navigation, accessibility, long-document usability (table of contents, jump-to-section).
**Not applicable:** forms/validation (no form, static legal document); destructive-action confirmation.

### Findings
1. **Good: back button uses the shared `ScreenHeader` component**, which already has correct `accessibilityRole="button"`/`accessibilityLabel="Back"` baked in — this screen inherited correct accessibility by construction.
2. **Good: table-of-contents jump-links** (`scrollRef.current?.scrollTo`) make a long legal document actually navigable rather than requiring a full manual scroll.
3. Minor observation (P3, not fixed — dead code, not a user-facing bug): a `hasScrolledToBottom` state is tracked via `onScroll` but its setter's value is never read anywhere in this file (destructured as `[, setHasScrolledToBottom]`). Harmless — likely a leftover from, or intended precursor to, the "must scroll before agreeing" pattern that `TermsAndConditionsScreen.tsx` actually implements. No functional impact since this screen has no "I Agree" gate to begin with.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## TermsAndConditionsScreen (`src/screens/TermsAndConditionsScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => TermsAndConditionsScreen}` (App.tsx:1834) and `component={TermsAndConditionsScreen}` (App.tsx:2186); also linked from WelcomeScreen, LoginScreen, and RegisterScreen.
**Criteria evaluated:** readability/typography, navigation, accessibility, consent-gate design (`showAgreeButton`/`onAgree` props).
**Not applicable:** forms/validation; destructive-action confirmation.

### Findings
1. **Good: back button uses the shared `ScreenHeader` component** — same inherited-correct accessibility as `PrivacyPolicyScreen`.
2. **Good: the "I Have Read and Agree" gate, when enabled, is well-designed** — the button stays disabled (with a "Scroll to read the full Terms before agreeing" hint) until the user has actually scrolled near the bottom of the document, which is the right way to make a consent checkbox meaningful rather than a rubber stamp.
3. Observation (P3, not fixed): the `showAgreeButton`/`onAgree` props that drive the above gate are never passed by any current caller (confirmed via a repo-wide search) — `App.tsx` always renders this screen with no props, so in practice this screen behaves exactly like `PrivacyPolicyScreen` today (view-only, no agree gate). `RegisterScreen.tsx` implements its own separate terms-agreement checkbox instead (see that screen's findings above) rather than using this gate. Not a bug — the component degrades correctly to "no gate" when the props are absent — but it means a second, more rigorous consent-gate implementation exists in the codebase and is currently unused. Flagged for awareness, not fixed, since wiring it up would be a product/flow decision outside this audit's accessibility/confirmation/error-clarity scope.

### Fixes implemented
None — meets the bar as-is.

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## SubscriptionManagementScreen (`src/screens/SubscriptionManagementScreen.tsx`)
**Entry point:** `RootStack.Screen getComponent={() => SubscriptionManagementScreen}` (App.tsx:1908), reached from account/billing settings.
**Criteria evaluated:** destructive/high-consequence-action confirmation (specifically flagged in the task brief — cancellation must be confirmed), forms/validation, error states, loading/empty states, accessibility, color/contrast (status badges, usage bars).
**Not applicable:** icon-only controls (every icon in this screen is paired with adjacent visible text — Downgrade Plan, Cancel Subscription, Resume Subscription, View Billing Receipt — so none qualify as icon-only per this audit's established criterion).

### Findings
1. **Verified, not a finding: subscription cancellation already has a correct two-step confirmation.** Tapping "Cancel Subscription" opens `CancelModal`, which (a) states the actual consequence up front ("Your subscription will remain active until the end of the current billing period"), (b) requires selecting a reason (with a free-text "Other" option) before the confirm button becomes meaningful, and (c) offers "Keep My Subscription" as an equally prominent way out. This was specifically called out in the task brief as a place to flag ANY missing confirmation — there is none missing.
2. **Good: Resume uses a native `Alert.alert` confirmation** ("Are you sure you want to resume your subscription?") with explicit Cancel/Resume choices.
3. **Good: Downgrade uses its own tier-picker sheet** requiring an explicit tier selection before "Confirm Downgrade" is enabled — same pattern as cancellation.
4. **Good: every mutating action (cancel/resume/downgrade) shows a specific success or failure alert**, never a silent state change.
5. **Good: the receipt-link action degrades gracefully** through three distinct states — no `receipt_url` present, link present but `Linking.canOpenURL` says no, and an unexpected `Linking.openURL` throw — each with its own clear message, never a silent no-op tap.
6. Minor (P3, not fixed): `loadExtras()` (usage + pricing-insight fetch) has a `try { ... } finally { ... }` with no `catch` — if either `getRequest` call throws, the rejection is unhandled (a console warning in RN) rather than explicitly caught, though the `finally` block still correctly flips both loading flags to `false`, so the UI itself falls through to the already-implemented "Usage data unavailable" / insight-hidden states rather than hanging or crashing. No user-visible bug, just a code-hygiene gap.

### Fixes implemented
None — meets the bar as-is. (This screen was deliberately scrutinized hardest given the brief's explicit flag; no missing confirmation was found.)

### Verification
Not touched; no re-verification needed.

**Status:** AUDITED-NO-ISSUES

---

## Already-fixed in a prior pass (brief summaries, re-verified via `git diff` + typecheck — left untouched)

### AccountDeletionScreen.tsx
Added `hitSlop`, `accessibilityRole="button"`, and a dynamic `accessibilityLabel` ("Show password"/"Hide password") to the password-visibility-toggle eye icon on this irreversible-account-deletion screen's password-confirmation field. **Status:** AUDITED-FIXED (prior pass).

### AdminUserManagementScreen.tsx
Added `accessibilityRole`/`accessibilityLabel="Go back"` to the icon-only header back button. **Status:** AUDITED-FIXED (prior pass).

### CacheManagementScreen.tsx
Added `accessibilityRole`/`accessibilityLabel="Go back"` to the icon-only header back button. **Status:** AUDITED-FIXED (prior pass).

### ComplianceSettingsScreen.tsx
Added `accessibilityRole`/`accessibilityLabel="Go back"` to the icon-only header back button (this is the screen hosting "Download My Data" / "Delete All My Data" — a privacy-sensitive settings hub). **Status:** AUDITED-FIXED (prior pass).

### DeviceManagementScreen.tsx
Added `accessibilityRole`/`accessibilityLabel` to the per-device Rename and "Make primary" icon buttons, plus the header back button. **Status:** AUDITED-FIXED (prior pass).

### EventsScreen.tsx
Added `accessibilityLabel` ("Dismiss"/"Close") to three icon-only `KISButton` close controls (header-error banner, event-detail modal, reminder modal). **Status:** AUDITED-FIXED (prior pass).

### LinkedDevicesScreen.tsx
Added `accessibilityRole`/`accessibilityLabel="Go back"` to the icon-only header back button. **Status:** AUDITED-FIXED (prior pass).

### PasswordChangeScreen.tsx
Added `hitSlop`, `accessibilityRole`, and a dynamic `accessibilityLabel` to the password-visibility-toggle eye icon shared by the password fields. **Status:** AUDITED-FIXED (prior pass).

### QuickLockScreen.tsx
The most consequential fix in the prior-pass batch: **"Forgot PIN" previously cleared the device PIN and signed the user out immediately on a single tap, with no confirmation.** Fixed by wrapping it in an `Alert.alert('Log out and remove PIN?', ...)` with explicit Cancel/"Log Out" (destructive-style) choices before the clear-and-sign-out proceeds. This is exactly the class of missing-destructive-confirmation bug this entire audit program has been hunting for, found and fixed in the prior pass. **Status:** AUDITED-FIXED (prior pass).

### SearchScreen.tsx
Added `accessibilityRole`/`accessibilityLabel` to the clear-search-input button and each per-term "remove from recent searches" button. **Status:** AUDITED-FIXED (prior pass).

### TwoFactorScreen.tsx
Replaced a literal `[QR Code — open in authenticator app]` text placeholder with an actual scannable `QRCode` component rendering `status.qr_code`, keeping the manual-entry provisioning URI as a labeled fallback below it. This was a functional gap (2FA setup previously had no real QR code to scan at all, only a text stand-in), not just an accessibility nit. **Status:** AUDITED-FIXED (prior pass).
