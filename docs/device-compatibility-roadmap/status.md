# KIS Device Compatibility Roadmap Status

## Phase 01 - Responsive Foundation And Global Chrome

Status: implemented locally.

### Scope

- Added a shared responsive device-class foundation for watch-size, compact phone, phone, tablet, and large tablet layouts.
- Updated the main bottom tab bar so it adapts icon size, bar height, label visibility, and padding on very small screens.
- Updated shared main-tab headers and state blocks to use responsive title sizing, padding, radius, action wrapping, and compact behavior.

### Files changed

- `src/theme/responsive.ts`
- `src/components/common/MainTabScaffold.tsx`
- `src/navigation/AppNavigator.tsx`
- `docs/device-compatibility-roadmap/status.md`

### Remaining phases

1. Phase 02 - Messaging device compatibility: chat list, room, composer, attachments, calls, status/update screens.
2. Phase 03 - Broadcast/Channels device compatibility: feed cards, channel studio, content detail, vision modal, market/education/health broadcast tabs.
3. Phase 04 - Bible device compatibility: sticky tabs, reader, highlights, plans, prayer, meditation, settings, offline views.
4. Phase 05 - Profile/Partners compatibility: dashboards, modals, partner rails, admin panels, profile overview.
5. Phase 06 - Commerce/Education/Health compatibility: booking/payment forms, management drawers, institution dashboards, course/player views.
6. Phase 07 - Device lab QA: smallest phone, large phone, tablet portrait/landscape, foldable/tablet split width, watch-size simulator where available.

### Validation

Passed:

```bash
npx eslint src/theme/responsive.ts src/components/common/MainTabScaffold.tsx src/navigation/AppNavigator.tsx --quiet
npm run typecheck -- --pretty false
```


## Phase 02 - Messaging Device Compatibility

Status: implemented locally.

### Scope

- Updated the Messages main screen to use the shared responsive foundation for header sizing, search/filter spacing, popover placement, top-tab label sizing, and the floating add button.
- Updated Add Contacts so the contact list/form shell uses responsive gutters, compact header text, and smaller vertical spacing on watch-size screens.
- Updated Chat Room rendering edges without changing message delivery logic:
  - composer icon/send sizes now adapt on watch-size and compact phones;
  - the camera shortcut hides on tiny widths while typing so the input remains usable;
  - message bubbles and attachment previews use responsive max widths and media sizing;
  - attachment preview modal reduces padding/list height on tiny devices.
- Updated calls overlay to adapt card padding, hero size, action buttons, control buttons, and video placeholder height for compact devices.
- Updated Calls tab row spacing/icon sizes and base padding from the responsive layout.
- Added responsive foundations to chat info and updates/status surfaces where safe while preserving existing behavior.

### Files changed

- `src/screens/tabs/MessagesScreen.tsx`
- `src/Module/AddContacts/AddContactsPage.tsx`
- `src/Module/ChatRoom/componets/main/MessageComposer.tsx`
- `src/Module/ChatRoom/componets/MessageBubble.tsx`
- `src/Module/ChatRoom/componets/main/ForAttachments/AttachmentPreviewPage.tsx`
- `src/components/calls/CallOverlay.tsx`
- `src/screens/tabs/MesssagingSubTabs/CallsTab.tsx`
- `src/screens/tabs/MesssagingSubTabs/UpdatesTab.tsx`
- `src/Module/ChatRoom/ChatInfoPage.tsx`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npx eslint src/screens/tabs/MessagesScreen.tsx src/Module/AddContacts/AddContactsPage.tsx src/Module/ChatRoom/componets/main/MessageComposer.tsx src/Module/ChatRoom/componets/MessageBubble.tsx src/Module/ChatRoom/componets/main/ForAttachments/AttachmentPreviewPage.tsx src/components/calls/CallOverlay.tsx src/screens/tabs/MesssagingSubTabs/CallsTab.tsx src/screens/tabs/MesssagingSubTabs/UpdatesTab.tsx src/Module/ChatRoom/ChatInfoPage.tsx --quiet
npm run typecheck -- --pretty false
```

### Notes / Remaining Device QA

- Runtime behavior was intentionally preserved. This phase did not change message delivery, E2EE, socket events, status creation, call signaling, or contact creation APIs.
- Manual device QA is still needed on a real compact iPhone/Android phone, tablet portrait/landscape, and a split-width tablet window to confirm keyboard/composer ergonomics.


## Phase 03 - Broadcast / Channels Device Compatibility

Status: implemented locally.

### Scope

- Updated the Broadcast main shell to use responsive gutters, compact header padding, smaller filter options, shorter tiny-device KCAN vision copy, and adaptive cart/FAB sizing.
- Updated shared Broadcast header, main tab pills, and search/filter row so labels and controls remain readable on watch-size and compact widths.
- Updated broadcast feed cards and feed section video detail controls:
  - feed cards now reduce padding/radius/avatar/title/body sizes on tiny devices;
  - media slideshow aspect ratio adapts on compact screens;
  - action rows can wrap instead of clipping;
  - fullscreen video controls and floating actions respect responsive gutters.
- Updated Channels discovery for compact hero/recommendation panels, responsive featured-card widths, and list rows that hide nonessential banner art on watch-size widths.
- Updated Channel Home and Channel Content Detail surfaces for responsive hero/stage heights, card gutters, grid column counts, action button sizing, and file list padding.
- Updated Channel Studio header/actions/channel selector/tab rails so channel and broadcast actions fit compact widths while preserving the existing studio workflow.
- Updated KCAN Vision modal cards, hero height, body gutters, close button, and card/grid behavior for compact devices.
- Updated broadcast market product cards so cards stack price/CTA content cleanly on compact widths.

### Files changed

- `src/screens/tabs/BroadcastScreen.tsx`
- `src/components/broadcast/BroadcastHeaderBar.tsx`
- `src/components/broadcast/BroadcastMainTabs.tsx`
- `src/components/broadcast/BroadcastSearchRow.tsx`
- `src/components/broadcast/BroadcastFeedCard.tsx`
- `src/components/broadcast/BroadcastFeedSection.tsx`
- `src/screens/broadcast/channels/ChannelsDiscoverPage.tsx`
- `src/screens/broadcast/channels/ChannelHomePage.tsx`
- `src/screens/broadcast/channels/ChannelContentDetailPage.tsx`
- `src/screens/broadcast/channels/studio/ChannelStudioScreen.tsx`
- `src/components/broadcast/KcanVisionModal.tsx`
- `src/screens/broadcast/market/components/MarketProductCard.tsx`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npx eslint src/screens/tabs/BroadcastScreen.tsx src/components/broadcast/BroadcastHeaderBar.tsx src/components/broadcast/BroadcastMainTabs.tsx src/components/broadcast/BroadcastSearchRow.tsx src/components/broadcast/BroadcastFeedCard.tsx src/components/broadcast/BroadcastFeedSection.tsx src/screens/broadcast/channels/ChannelsDiscoverPage.tsx src/screens/broadcast/channels/ChannelHomePage.tsx src/screens/broadcast/channels/ChannelContentDetailPage.tsx src/screens/broadcast/channels/studio/ChannelStudioScreen.tsx src/components/broadcast/KcanVisionModal.tsx src/screens/broadcast/market/components/MarketProductCard.tsx --quiet
npm run typecheck -- --pretty false
```

### Notes / Remaining Device QA

- Runtime behavior was intentionally preserved. This phase did not change feed loading, channel APIs, studio actions, broadcast/unbroadcast logic, market checkout, comments, playlists, or KCAN vision content.
- Manual QA is still required on compact phone, tablet portrait/landscape, split-width tablet, and a watch-size simulator for rails, modal close buttons, channel studio actions, and feed detail video controls.

## Phase 04 - Bible Device Compatibility

Status: implemented locally.

### Scope

- Updated the Bible main screen to use `/Users/nigel/dev/KIS/src/theme/responsive.ts` for page gutters, compact sticky-tab spacing, tiny-device tab labels, floating filter sizing, and non-read tab content spacing.
- Preserved the current sticky Bible behavior: the top Bible section can collapse/disappear and the tab section remains sticky while the tab content continues scrolling.
- Updated the Bible reader for responsive filter sheets, verse action modals, header/action wrapping, offline download panel wrapping, compact swipe hints, and readable verse typography on watch-size and compact phones.
- Preserved dark/light highlight contrast: saved highlights remain dark-text-safe in dark theme while selected verses keep the selected-state contrast behavior.
- Updated daily devotions, meditations, prayer calendar, reading planner, lessons, settings, books, and KCAN message/devotional surfaces so headers wrap, grids/cards adapt, modals use responsive gutters, and compact layouts avoid clipping.

### Files changed

- `src/screens/tabs/BibleScreen.tsx`
- `src/components/Bible/BibleReaderPanel.tsx`
- `src/components/Bible/BibleSectionCard.tsx`
- `src/components/Bible/DailyDevotionsPanel.tsx`
- `src/components/Bible/MeditationPanel.tsx`
- `src/components/Bible/PrayerPanel.tsx`
- `src/components/Bible/BiblePlansPanel.tsx`
- `src/components/Bible/BibleLessonsPanel.tsx`
- `src/components/Bible/BibleSettingsPanel.tsx`
- `src/components/Bible/BibleBooksPanel.tsx`
- `src/components/Bible/BibleMessagesPanel.tsx`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npx eslint src/screens/tabs/BibleScreen.tsx src/components/Bible/BibleReaderPanel.tsx src/components/Bible/DailyDevotionsPanel.tsx src/components/Bible/MeditationPanel.tsx src/components/Bible/BiblePlansPanel.tsx src/components/Bible/PrayerPanel.tsx src/components/Bible/BibleLessonsPanel.tsx src/components/Bible/BibleSettingsPanel.tsx src/components/Bible/BibleBooksPanel.tsx src/components/Bible/BibleMessagesPanel.tsx src/components/Bible/BibleSectionCard.tsx --quiet
npm run typecheck -- --pretty false
```

### Notes / Remaining Device QA

- Runtime behavior was intentionally preserved. This phase did not change Bible APIs, translation loading, reader persistence, notes/highlights/bookmarks, prayer calendar data, plans, lessons, books, media playback links, or offline download logic.
- Manual QA is still required on watch-size simulation, compact phone, normal phone, tablet portrait/landscape, and split-width tablet windows for sticky tab feel, filter-sheet height, verse action modal placement, prayer calendar day cells, and book/message card grids.

## Phase 05 - Profile / Partners Device Compatibility

Status: implemented locally.

### Scope

- Updated the Profile main page to use `/Users/nigel/dev/KIS/src/theme/responsive.ts` for page gutters, card gaps, compact overlay offsets, responsive slide widths, bottom-sheet gutters, and compact profile overview wrapping.
- Updated shared Profile dashboard blocks so hero content, action cards, wallet/promotional-credit summary, timeline rows, stats, workspace launchers, appointments, notifications, and language chips adapt across watch-size, compact phone, normal phone, tablet, and landscape/tablet split widths.
- Updated Profile management surfaces where safe: management panels now use live window width instead of stale static dimensions, management stats wrap, and the shared profile bottom sheet caps width on tablets while staying full-width on phones.
- Updated Partners shell responsiveness:
  - left account rail shrinks on watch-size/compact widths;
  - partner center pane uses responsive gutters, compact right peek spacing, wrapped command headers, and adaptive workspace stat columns;
  - partner messages pane can cap to a readable tablet width while preserving the swipe/peek behavior;
  - partner settings sheet respects responsive gutters and compact height limits;
  - partner settings/admin panels cap width on tablets instead of always taking the full large screen.
- Preserved existing Profile and Partners APIs, navigation, settings, creation flows, verification, partner messaging, and workspace behavior.

### Files changed

- `src/screens/tabs/ProfileScreen.tsx`
- `src/screens/tabs/profile/profile.styles.ts`
- `src/screens/tabs/profile/components/dashboard/ProfileDashboardBlocks.tsx`
- `src/screens/tabs/profile/sheets/BottomSheet.tsx`
- `src/screens/tabs/PartnersScreen.tsx`
- `src/screens/tabs/partners/PartnerLayout.tsx`
- `src/components/partners/PartnersLeftRail.tsx`
- `src/components/partners/PartnersCenterPane.tsx`
- `src/components/partners/PartnerSheet.tsx`
- `src/components/partners/PartnersMessagesPane.tsx`
- `src/components/partners/partnersStyles.ts`
- `src/screens/tabs/partners/usePartnerSettingsPanel.ts`
- `src/screens/tabs/partners/usePartnerCreatePanel.ts`
- `src/screens/tabs/partners/usePartnerDiscoveryPanel.ts`
- `src/screens/tabs/partners/usePartnerRecruitmentPanel.ts`
- `src/screens/tabs/partners/usePartnerAuditPanel.ts`
- `src/screens/tabs/partners/usePartnerPolicyPanel.ts`
- `src/screens/tabs/partners/usePartnerComplaintsPanel.ts`
- `src/screens/tabs/partners/usePartnerReportsPanel.ts`
- `src/screens/tabs/partners/usePartnerLinksPanel.ts`
- `src/screens/tabs/partners/usePartnerAutomationPanel.ts`
- `src/screens/tabs/partners/usePartnerIntegrationsPanel.ts`
- `src/screens/tabs/partners/usePartnerGovernancePanel.ts`
- `src/screens/tabs/partners/usePartnerFeaturePanel.ts`
- `src/screens/tabs/partners/usePartnerCoursesPanel.ts`
- `src/screens/tabs/partners/usePartnerOrganizationAppsPanel.ts`
- `src/screens/tabs/partners/usePartnerOrgProfilePanel.ts`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npx eslint src/screens/tabs/ProfileScreen.tsx src/screens/tabs/profile/profile.styles.ts src/screens/tabs/profile/components/dashboard/ProfileDashboardBlocks.tsx src/screens/tabs/profile/sheets/BottomSheet.tsx src/screens/tabs/PartnersScreen.tsx src/screens/tabs/partners/PartnerLayout.tsx src/components/partners/PartnersLeftRail.tsx src/components/partners/PartnersCenterPane.tsx src/components/partners/PartnerSheet.tsx src/components/partners/PartnersMessagesPane.tsx src/components/partners/partnersStyles.ts src/screens/tabs/partners/usePartnerSettingsPanel.ts src/screens/tabs/partners/usePartnerCreatePanel.ts src/screens/tabs/partners/usePartnerDiscoveryPanel.ts src/screens/tabs/partners/usePartnerRecruitmentPanel.ts src/screens/tabs/partners/usePartnerAuditPanel.ts src/screens/tabs/partners/usePartnerPolicyPanel.ts src/screens/tabs/partners/usePartnerComplaintsPanel.ts src/screens/tabs/partners/usePartnerReportsPanel.ts src/screens/tabs/partners/usePartnerLinksPanel.ts src/screens/tabs/partners/usePartnerAutomationPanel.ts src/screens/tabs/partners/usePartnerIntegrationsPanel.ts src/screens/tabs/partners/usePartnerGovernancePanel.ts src/screens/tabs/partners/usePartnerFeaturePanel.ts src/screens/tabs/partners/usePartnerCoursesPanel.ts src/screens/tabs/partners/usePartnerOrganizationAppsPanel.ts src/screens/tabs/partners/usePartnerOrgProfilePanel.ts --quiet
npm run typecheck -- --pretty false
```

### Notes / Remaining Device QA

- Runtime behavior was intentionally preserved. This phase did not change profile APIs, partner APIs, partner creation, partner messaging, verification submission, dashboard data, settings mutations, or workspace navigation.
- Manual QA is still required for profile hero cropping, bottom sheet keyboard behavior, partner rail ergonomics, settings panel widths, partner message pane peek/drag behavior, and admin panels on tiny devices, tablets, landscape, and split-width windows.

## Phase 06 - Commerce / Education / Health Device Compatibility

Status: implemented locally.

### Scope

- Updated commerce/shop editor drawers to use `/Users/nigel/dev/KIS/src/theme/responsive.ts` for drawer width, gutters, compact footer stacking, and tiny-device full-width behavior.
- Improved product, service, and shop management forms so dense actions and form controls wrap instead of clipping on watch-size, compact phone, tablet split, and landscape widths.
- Updated education course/content cards and detail/enrollment sheets so media, buttons, metadata chips, and footer actions collapse cleanly on very small widths while preserving tablet-sized presentation.
- Updated health institution dashboard and institution-specific module panels so care cards, schedule cards, module metrics, and dashboard gutters adapt by device class.
- Updated health institution management screen gutters, header wrapping, and save/delete action layout for compact devices and tablet max-width layouts.
- Preserved existing commerce, education, and health API behavior, payment state behavior, data loading, and navigation behavior.

### Files changed

- `src/screens/market/ProductEditorDrawer.tsx`
- `src/screens/market/ServiceEditorDrawer.tsx`
- `src/screens/market/ShopEditorDrawer.tsx`
- `src/screens/broadcast/education/components/CourseCard.tsx`
- `src/screens/broadcast/education/components/EducationContentCard.tsx`
- `src/screens/broadcast/education/components/EducationEnrollmentSheet.tsx`
- `src/screens/broadcast/education/components/EducationDetailSheet.tsx`
- `src/features/health-dashboard/ui/InstitutionDashboardShell.tsx`
- `src/features/health-dashboard/ui/TypeSpecificModulesPanel.tsx`
- `src/screens/health/HealthInstitutionManagementScreen.tsx`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npx eslint src/screens/health/HealthInstitutionManagementScreen.tsx src/screens/market/ProductEditorDrawer.tsx src/screens/market/ServiceEditorDrawer.tsx src/screens/market/ShopEditorDrawer.tsx src/screens/broadcast/education/components/CourseCard.tsx src/screens/broadcast/education/components/EducationContentCard.tsx src/screens/broadcast/education/components/EducationEnrollmentSheet.tsx src/screens/broadcast/education/components/EducationDetailSheet.tsx src/features/health-dashboard/ui/InstitutionDashboardShell.tsx src/features/health-dashboard/ui/TypeSpecificModulesPanel.tsx
npm run typecheck -- --pretty false
```

### Notes / Remaining Device QA

- Focused ESLint passed with warnings only. The warnings are inline-style warnings already common in these UI-heavy files; no lint errors remain.
- Manual device QA is still required for commerce drawer keyboard behavior, product/service image previews, cart/order flows, education lesson media/PDF previews, enrollment checkout states, health dashboard chart readability, health booking/session flows, and institution management on watch-size, compact phone, tablet portrait/landscape, and split-width windows.
- This phase did not change backend behavior or payment/booking/enrollment state machines.

### Next prompt

```text
Please implement Phase 07 of the KIS Device Compatibility Roadmap without using git commands. Focus on device-lab QA and final responsive hardening. Use `/Users/nigel/dev/KIS/src/theme/responsive.ts` and all Phase 01-06 changes to run or prepare smoke checks for watch-size/very small widths, compact phones, normal phones, tablets, landscape/tablet split widths, and foldable-like sizes across Messaging, Broadcast/Channels, Bible, Profile, Partners, Commerce, Education, and Health. Add practical QA scripts/checklists, capture blockers, fix only low-risk responsive regressions found during focused validation, preserve existing APIs/UI behavior, run `npm run typecheck -- --pretty false` and targeted lint, update `/Users/nigel/dev/KIS/docs/device-compatibility-roadmap/status.md` and `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`, and give the final close-out prompt/status here in chat.
```

## Phase 07 - Device-Lab QA And Final Responsive Hardening

Status: implemented locally and closed.

### Scope

- Added a practical device-lab QA checklist for watch-size/very small widths, compact phones, normal phones, tablets, tablet landscape, split-width tablet panes, and foldable-like widths.
- Added a dependency-free smoke script that verifies the shared responsive foundation and checks that each major launch surface from Phases 01-06 is covered by `useResponsiveLayout` at the screen or layout-owning component level.
- Added `npm run qa:device-compatibility` to run the device compatibility smoke script.
- Ran the final validation pass for the responsive roadmap and recorded remaining manual device QA requirements.
- No app behavior, backend API, navigation route, payment flow, booking flow, enrollment flow, messaging flow, or content state machine was changed in this close-out phase.

### Files changed

- `scripts/qa/device-compatibility-smoke.cjs`
- `docs/device-compatibility-roadmap/phase-07-device-lab-qa.md`
- `package.json`
- `docs/device-compatibility-roadmap/status.md`
- `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`

### Validation

Passed:

```bash
npm run qa:device-compatibility
npm run typecheck -- --pretty false
npx eslint scripts/qa/device-compatibility-smoke.cjs
npx eslint src/theme/responsive.ts scripts/qa/device-compatibility-smoke.cjs src/components/common/MainTabScaffold.tsx src/screens/tabs/MessagesScreen.tsx src/screens/tabs/BroadcastScreen.tsx src/screens/tabs/BibleScreen.tsx src/screens/tabs/ProfileScreen.tsx src/screens/tabs/PartnersScreen.tsx src/screens/market/ProductEditorDrawer.tsx src/screens/broadcast/education/components/EducationDetailSheet.tsx src/features/health-dashboard/ui/InstitutionDashboardShell.tsx
```

Notes:

- The first smoke-script attempt failed because `.mjs` was using CommonJS `require`; this was fixed by switching the script to `scripts/qa/device-compatibility-smoke.cjs` and updating the package script.
- The broad targeted lint pass completed with warnings only. Remaining warnings are existing inline-style and no-void warnings in UI-heavy files; no lint errors remain.

### Device-Lab Checklist

Use `docs/device-compatibility-roadmap/phase-07-device-lab-qa.md` before release. The launch decision rules are:

- Go: no clipped primary actions, no unreachable close/submit controls, no broken navigation, and typecheck/lint/smoke checks pass.
- Conditional go: only cosmetic wrapping issues remain and are documented with screenshots.
- No-go: any checkout, booking, messaging, login, upload, verification, or emergency health/session action is unreachable on a launch-supported device class.

### Final Maintenance Prompt

```text
Please perform a KIS device compatibility maintenance sweep without using git commands. Run `npm run qa:device-compatibility`, `npm run typecheck -- --pretty false`, and targeted lint for any files changed since the last responsive pass. Use `/Users/nigel/dev/KIS/docs/device-compatibility-roadmap/phase-07-device-lab-qa.md` to manually verify any affected screens on watch-size/very small widths, compact phones, normal phones, tablets, landscape/tablet split widths, and foldable-like sizes. Fix only confirmed responsive regressions, preserve existing APIs/UI behavior, update `/Users/nigel/dev/KIS/docs/device-compatibility-roadmap/status.md` and `/Users/nigel/dev/backend/kis/docs/BUILD_STATE.md`, and summarize remaining manual QA blockers.
```

## Maintenance Sweep - 2026-05-18

Status: completed.

### Scope

- Ran the established device compatibility smoke check after Phase 07 close-out.
- Ran full React Native TypeScript validation.
- Ran targeted responsive lint against the responsive foundation and representative launch surfaces.
- Reviewed `/Users/nigel/dev/KIS/docs/device-compatibility-roadmap/phase-07-device-lab-qa.md` as the manual QA checklist for supported device classes.
- No confirmed responsive regression was found from automated validation, so no UI behavior changes were made in this maintenance sweep.

### Validation

Passed:

```bash
npm run qa:device-compatibility
npm run typecheck -- --pretty false
```

Targeted lint completed with warnings only and no errors:

```bash
npx eslint src/theme/responsive.ts scripts/qa/device-compatibility-smoke.cjs src/components/common/MainTabScaffold.tsx src/screens/tabs/MessagesScreen.tsx src/screens/tabs/BroadcastScreen.tsx src/screens/tabs/BibleScreen.tsx src/screens/tabs/ProfileScreen.tsx src/screens/tabs/PartnersScreen.tsx src/screens/market/ProductEditorDrawer.tsx src/screens/broadcast/education/components/EducationDetailSheet.tsx src/features/health-dashboard/ui/InstitutionDashboardShell.tsx
```

### Remaining Manual QA Blockers

- Real-device/simulator visual QA is still required using `docs/device-compatibility-roadmap/phase-07-device-lab-qa.md`.
- Required device classes: watch-size/very small, compact phone, normal phone, tablet portrait, tablet landscape, split-width tablet, and foldable-like pane.
- Release should remain no-go if manual QA finds unreachable close/submit controls, clipped checkout/booking/messaging actions, broken tab navigation, scroll traps, or unreadable media/detail surfaces.
- Remaining lint warnings are inline-style/no-void warnings in existing UI-heavy files and were not treated as responsive launch blockers.

## Device-Lab Launch Command - 2026-05-18

Status: implemented locally.

### Scope

- Added `scripts/run-ios-device-lab.sh` to create/boot a device-lab simulator set for visual compatibility testing.
- Added `npm run ios:device-lab` as the single command for the simulator device lab.
- The command targets two phone sizes and two iPad sizes for app install/run:
  - `KIS Lab iPhone Small` using `iPhone SE (3rd generation)`
  - `KIS Lab iPhone Large` using `iPhone 17 Pro Max`
  - `KIS Lab iPad Small` using `iPad mini (A17 Pro)`
  - `KIS Lab iPad Large` using `iPad Pro 13-inch (M4)`
- The command also attempts to boot two Apple Watch simulators when a watchOS runtime exists:
  - `KIS Lab Watch Small` using `Apple Watch SE 3 (40mm)`
  - `KIS Lab Watch Large` using `Apple Watch Ultra 3 (49mm)`

### Important watchOS note

- Current installed simulator runtimes show iOS only on this machine. No watchOS runtime was available during setup.
- KIS currently has an iOS React Native target only. The app can be installed on iPhone/iPad simulators, but cannot be installed on Apple Watch simulators until a watchOS app target is added.
- The script therefore boots watch simulators only when watchOS exists and skips app install on watches with a clear message.

### Validation

Passed:

```bash
bash -n scripts/run-ios-device-lab.sh
npm run qa:device-compatibility
```

### Launch command

```bash
cd /Users/nigel/dev/KIS && npm run ios:device-lab
```

## Small Device-Lab Launch Command - 2026-05-18

Status: implemented locally.

### Scope

- Added a smaller first-step launch command for faster device compatibility testing.
- Added `scripts/run-ios-small-device-lab.sh`.
- Added `npm run ios:small-lab`.
- The command creates/boots and installs KIS on:
  - `KIS Small iPhone` using `iPhone SE (3rd generation)`
  - `KIS Small iPad` using `iPad mini (A17 Pro)`

### Validation

Passed:

```bash
bash -n scripts/run-ios-small-device-lab.sh
```

### Launch command

```bash
cd /Users/nigel/dev/KIS && npm run ios:small-lab
```

