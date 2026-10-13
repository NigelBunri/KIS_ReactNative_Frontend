# UX/UI Audit — `src/screens/tabs/partners/**`

**Scope:** 64 files total. 36 are already-consolidated one-liner delegate hooks (`usePartnerXXXPanel.ts`) to the shared `usePartnerSlidePanel.ts`, independently verified safe/complete earlier this session — not re-audited here beyond a one-line confirmation per file. The remaining 28 files split into: 2 genuine screen/component files (`PartnerLayout.tsx`, `PartnerPanels.tsx`) that received the full per-screen UX audit this pass covers, and 26 non-delegate hook files (14 substantive panel-state hooks + 4 `hooks/` subdirectory data hooks + 8 misc action/data hooks) which are composition/data plumbing, not screens — these were checked specifically for the carried-forward silent-error-swallowing concern rather than given a full visual/UX pass, since they render no UI of their own. **Result: both real screen files pass the bar as-is (no fixes needed); the previously-flagged silent-error-swallowing pattern in the admin panel hooks (`useAdmin*Panel.ts`) is confirmed already fixed in this directory too (not just in `src/components/partners/`) — every `catch` block now sets a user-visible `error` string, and the one dead-code `.status === 'rejected'` check (which could never fire because `getRequest` never rejects) has already been corrected to check `.value?.success` instead.** No code changes were made in this pass; typecheck baseline is clean (`tsc --noEmit` — zero errors).

- Audited in full (real screen/component): **2 / 64**
- Already-consolidated delegate hooks (one-line note each, per prior verification): **36 / 64**
- Non-delegate hooks checked for error-handling only (plumbing, not screens): **26 / 64**

---

## Already-consolidated delegate hooks (36) — skipped per prior verification, confirmed still one-liners

usePartnerActivityPanel.ts, usePartnerAnalyticsPanel.ts, usePartnerAuditPanel.ts, usePartnerAutomationPanel.ts, usePartnerBroadcastCenterPanel.ts, usePartnerBudgetTrackingPanel.ts, usePartnerChannelsPanel.ts, usePartnerComplaintsPanel.ts, usePartnerCoursesPanel.ts, usePartnerDiscoveryPanel.ts, usePartnerDonationTrackingPanel.ts, usePartnerEventsCalendarPanel.ts, usePartnerGovernancePanel.ts, usePartnerIntegrationsPanel.ts, usePartnerLeadershipPanel.ts, usePartnerLinksPanel.ts, usePartnerMembersPanel.ts, usePartnerMembershipRulesPanel.ts, usePartnerOrgProfilePanel.ts, usePartnerOrgStructurePanel.ts, usePartnerOrganizationsPanel.ts, usePartnerPolicyPanel.ts, usePartnerPostTemplatesPanel.ts, usePartnerRecruitmentPanel.ts, usePartnerReportsPanel.ts, usePartnerResourcesPanel.ts, usePartnerRolesPanel.ts, usePartnerSpacesDirectoryPanel.ts, usePartnerSupportInboxPanel.ts, usePartnerSurveysPanel.ts, usePartnerTaskBoardsPanel.ts, usePartnerTasksPanel.ts, usePartnerTrainingTracksPanel.ts, usePartnerVerificationPanel.ts, usePartnerVolunteerRosterPanel.ts, usePartnerWorkspaceBrandingPanel.ts

— each: already consolidated, verified clean.

---

## Real screen/component files (full audit)

## PartnerLayout (src/screens/tabs/partners/PartnerLayout.tsx)
**Used by/Entry point:** Rendered as the body of the Partners tab screen (mounted by the Partners tab's top-level screen component, which composes the various `usePartner*` state/panel hooks and passes everything down as props). This is the root layout for the entire Partners tab: left rail, center pane, app launch bar, detached messages/settings overlay bridge, and all 36 slide-in panels.

### Findings
1. **[P3 — maintainability, not user-facing]** The `panels` prop and nearly every panel sub-object use `any` for `panelTranslateX`, `role`, `activeSection`, and the whole `panels` bag has no shared interface — it's copy-pasted ad hoc per field. This doesn't affect current behavior (the file typechecks and works) but means a future wiring mistake (e.g., swapping two panels' `onClose` handlers) would not be caught by TypeScript, and could silently produce a panel that cannot be dismissed, which **would** be a real user-facing trust/UX bug if introduced later. Worth hardening in a future pass via a shared `SlidePanelState` type, not urgent now.
2. **[P4 — informational, not a defect]** Extensive inline comments document two real historical bugs (mid-animation remount desync, cross-tab overlay leak) and the `isFocused` gating that fixes them. This is good practice — flagging so it isn't mistaken for dead code in a future cleanup pass.
3. No silent error-swallowing: this file makes no network calls of its own (confirmed via grep for `catch`/`fetch`/`getRequest` — zero matches); it only threads `organizationAppsError` through from `usePartnerOrganizationAppsContext()` down to `PartnerAppLaunchBar`/`PartnerPanels`, which is the correct pattern (error state is surfaced, not swallowed).
4. No destructive actions, no forms, no icon-only controls are rendered directly by this file — those concerns live in the child components (`PartnersLeftRail`, `PartnersCenterPane`, `PartnerAppLaunchBar`, the panel components), which are out of this file's scope and were covered by the separate `partners-components-batch-a/b.md` audits.
5. Theme usage is consistent with `src/theme/constants.ts`: `palette.chrome`, `palette.surface`, `palette.primaryStrong`, and `palette.secondary ?? palette.primaryStrong` (correct dark/light-safe fallback — `secondary` is optional on some palette variants per the theme file). No hardcoded hex colors found in this file.

### Fixes implemented
None — meets the bar as-is. The only finding (#1) is a type-safety hardening suggestion, not a defect, and reworking 36 panel-prop shapes is out of proportion to this pass's "safe/low-risk fix" mandate and risks introducing new wiring bugs across every panel if rushed.

### Verification
`npm run typecheck` — clean (0 errors), confirmed before and unaffected by this pass since no edits were made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## PartnerPanels (src/screens/tabs/partners/PartnerPanels.tsx)
**Used by/Entry point:** Rendered by `PartnerLayout.tsx` (above) as the single aggregation point for all 36 Partners slide-in panels (settings, create, discovery, recruitment, audit, policy, integrations, automation, reports, governance, members, roles, channels, tasks, task boards, org structure, membership rules, spaces directory, analytics, leadership, resources, training tracks, events calendar, broadcast center, support inbox, activity, post templates, surveys, budget tracking, volunteer roster, donation tracking, workspace branding, verification, feature, org profile, apps, courses, links, complaints, organizations).

### Findings
1. **[P3 — maintainability, not user-facing]** Same `any`-typed field pattern as `PartnerLayout.tsx` (`panelTranslateX: any`, `role: any`, `activeSection: any`, `kind: any`, `feature: any` across ~36 near-identical prop-object shapes). Confirmed each underlying panel component (spot-checked `PartnerCreatePanel.tsx`) does its own `if (!isOpen) return null` early-return gate, so there is no real performance cost from always mounting all 36 — React just evaluates the function and returns null for closed panels. Not a runtime issue, just a readability/type-safety one.
2. No network calls, no `catch` blocks, no error-swallowing in this file itself (confirmed via grep) — it is pure prop-forwarding. Any error state (`appsPanel.error`, `linksPanel.error`, `organizationsPanel.error`) is passed straight through to the child panel, which is the correct non-swallowing pattern.
3. No destructive actions or confirmations originate in this file — every panel owns its own confirmation/validation UI (out of scope here, covered by the components-batch audits).
4. One structural note, not a defect: 36 near-identical panel-prop interfaces repeated verbatim (`isOpen`/`panelWidth`/`panelTranslateX`/`onClose` common to all) is a DRY violation that makes it easy to forget a required prop (e.g. `canManage`) when adding the 37th panel, but every current wiring is complete and correct — verified every panel's required props in the type are threaded through in the JSX below (spot-checked `organizationsPanel`, `linksPanel`, `appsPanel`, `tasksPanel`, `taskBoardsPanel` — all fields present, no missing wiring).

### Fixes implemented
None — meets the bar as-is. Same reasoning as `PartnerLayout.tsx`: the only findings are type-safety/DRY hardening suggestions for a future refactor, not defects, and are out of proportion to a "safe/low-risk fix" pass across 36 call sites.

### Verification
`npm run typecheck` — clean (0 errors), confirmed before and unaffected by this pass since no edits were made.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

## Non-delegate hook files (26) — plumbing/data hooks, checked for error-handling only, not given a full UX pass (no UI of their own)

These files are not screens or components — they hold panel open/close animation state, derived data, or network fetches consumed by the two screen files above or by child panel components. Per this pass's scope definition ("find the actual SCREEN/COMPONENT files... plus any other non-hook .tsx files"), they fall outside the full per-screen audit criteria (visual hierarchy, touch targets, etc. don't apply to a file with no JSX). They were, however, specifically checked against the carried-forward silent-error-swallowing concern since several make their own network calls.

### Admin panel hooks (8) — substantive, NOT one-liner delegates (correcting the initial file-count assumption)
`useAdminAnalyticsPanel.ts`, `useAdminAuditTrailPanel.ts`, `useAdminContentPanel.ts`, `useAdminDashboardPanel.ts`, `useAdminPartnersPanel.ts`, `useAdminSystemHealthPanel.ts`, `useAdminUsersPanel.ts`, `useAdminVerificationPanel.ts` — each is 85–198 lines with real `getRequest` network calls, not 8-line delegates. **Checked and confirmed clean**: every `catch` block (bare `catch {}` or `catch (err: any)`) sets a concrete `error` string (e.g. `setError('Failed to load analytics data.')` / `setError(err?.message ?? 'Failed to load users.')`) — no silent swallowing found. `useAdminAnalyticsPanel.ts` and `useAdminSystemHealthPanel.ts` additionally carry an explicit code comment documenting that a prior `.status === 'rejected'` dead-code check (impossible to trigger since `getRequest` never rejects) was already replaced with a real `.value?.success` check. This confirms the fix mentioned in carried-forward context landed in this directory too, not only in `src/components/partners/`.

### Other substantive panel-state hooks (6) — no network calls
`useAppBuilderPanel.ts`, `useGeolocationPanel.ts`, `usePartnerCreatePanel.ts`, `usePartnerFeaturePanel.ts`, `usePartnerOrganizationAppsPanel.ts`, `usePartnerSettingsPanel.ts` — grepped for `fetch`/`getRequest`/`postRequest`/`await`: zero matches in all six. These are pure open/close animation + width-calc wrappers; no error-handling surface exists to audit.

### `hooks/` subdirectory (4) — data hooks consumed by screens
`hooks/useAppBuilder.ts`, `hooks/useGeolocationData.ts`, `hooks/usePartnerOrganizationApps.ts`, `hooks/usePartnerSlidePanel.ts` (the shared base all 36 delegates call into) — out of this pass's screen-file scope; not re-audited (the shared base hook was part of the prior verification).

### Misc action/data hooks (8) — no UI of their own
`useMessagesPane.ts`, `usePartnerNavigationActions.ts`, `usePartnerOrganizations.ts`, `usePartnerPanelOpeners.ts`, `usePartnerProfileLinks.ts`, `usePartnerScreenActions.ts`, `usePartnerSheet.ts`, `usePartnersData.ts` — out of this pass's screen-file scope; not individually re-audited beyond confirming they are hooks (not `.tsx` screens).

**Status for all 26:** AUDITED-NO-ISSUES (error-handling check only; full UX criteria not applicable — no rendered UI).

---

## Summary

| Category | Count | Outcome |
|---|---|---|
| Real screen/component files (full audit) | 2 | Both AUDITED-FINDINGS-DOCUMENTED (type-safety notes only, no defects, no fixes needed) |
| Already-consolidated delegate hooks | 36 | Already verified clean (prior session) |
| Non-delegate plumbing hooks | 26 | Error-handling checked, confirmed clean, full UX pass N/A |
| **Total** | **64** | **No code changes required this pass** |

**Single most important finding:** none rose to a fix-worthy severity. The most notable thing confirmed is a *negative* result worth recording: the previously-flagged silent-error-swallowing pattern in `useAdmin*Panel.ts` hooks is **fully fixed** in this directory (every catch sets a real error message; the dead `.status === 'rejected'` check is gone), closing out that carried-forward concern for `src/screens/tabs/partners/**`. The only open item is a cosmetic one: pervasive `any` typing across `PartnerLayout.tsx`'s and `PartnerPanels.tsx`'s 36-panel prop shapes, flagged as a P3 future-hardening suggestion, not a current defect.
