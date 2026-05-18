# KIS Device Compatibility Device-Lab QA Checklist

Use this checklist after Phase 01-07 changes. It is designed for real devices, simulators, tablet split widths, and low-bandwidth/offline conditions. Do not treat this as a replacement for feature QA; it is a layout and ergonomics pass.

## Device Matrix

| Class | Target size examples | Required result |
| --- | --- | --- |
| Watch / very small | 240x320, 260x360 | No clipped primary actions; nonessential labels may hide; scrolling remains reachable. |
| Compact phone | 320x568, 360x640 | Headers wrap; modals/sheets fit; keyboard does not hide submit actions. |
| Normal phone | 390x844, 430x932 | Default mobile UX remains polished and unchanged behaviorally. |
| Tablet portrait | 768x1024, 820x1180 | Content uses max readable width; cards can use columns; no oversized empty gutters. |
| Tablet landscape | 1024x768, 1180x820 | Split layouts stay readable; rails and detail panes do not overlap. |
| Split/foldable pane | 540x720, 600x960 | Layout behaves like phone/tablet boundary without clipping. |

## Global Pass Criteria

- No primary CTA is clipped, covered by the keyboard, or unreachable.
- Search/filter/header rows wrap or scroll horizontally without overlapping.
- Bottom tabs and badges stay visible and tappable.
- Pull-to-close and sticky-tab behaviors remain smooth.
- Sheets/modals leave close controls reachable on every device size.
- Images, video, PDF, audio, and document previews keep a stable aspect and do not overflow the viewport.
- Touch targets remain at least the responsive minimum unless the control is decorative.
- Light/dark theme contrast remains readable after responsive wrapping.

## Messaging

- Open Messages, Updates, Calls, Add Contacts, one direct chat, one group/subroom, chat info, attachment preview, and call entry points.
- Verify message bubbles preserve sender/receiver alignment after app restart.
- Verify composer icons wrap or hide nonessential labels on tiny widths.
- Verify attachment preview and selected-message action bars do not cover messages.

## Broadcast / Channels

- Open Broadcast main, Feeds, Education, Market, Health, Channels Discover, Channel Home, Content Detail, Studio, comments, playlists, and KCAN Vision.
- Verify horizontal rails scroll without changing tabs accidentally.
- Verify feed detail swipe view remains full-screen and action buttons stay visible.
- Verify channel studio selectors, create/broadcast actions, and content cards wrap cleanly.

## Bible

- Open reader, sticky tabs, filters, notes/highlights, daily meditation, plans, prayer, search, and verse modals.
- Verify top Bible section can collapse while tabs remain sticky.
- Verify highlighted verse text remains readable in dark and light themes.
- Verify filter/action sheets can close on watch-size and compact phone layouts.

## Profile / Partners

- Open profile overview, edit/settings, verification badges, family/accessibility settings, profile management modals, partner workspace, account rail, subrooms/channels, events, roles, members, moderation, and audit panels.
- Verify dashboard cards collapse on tiny widths and widen on tablets.
- Verify partner side rail remains usable and message pane peek/drag behavior does not hide controls.

## Commerce / Education / Health

- Commerce: product list, product detail, cart, order detail, service booking, shop dashboard, product/service/shop drawers, payment state surfaces.
- Education: discovery, course cards, detail sheet, enrollment, lesson/media/PDF previews, institution dashboard.
- Health: dashboard, institution management, appointments, sessions, service catalog, provider/institution admin panels, payment state surfaces.
- Verify forms collapse from grids to single column on tiny widths and keyboard submit controls remain reachable.

## Evidence To Capture

For each device class, capture:

- one screenshot of each main tab at rest;
- one screenshot of one modal/sheet per major module;
- one screenshot after opening keyboard in a form;
- one screenshot of dark theme and one of light theme for Messaging, Broadcast, Bible, and Profile;
- notes for any clipped text, hidden CTA, overlapping media, unreachable close button, or scroll trap.

## Launch Decision

- Go: no clipped primary actions, no unreachable close/submit controls, no broken navigation, and typecheck/lint smoke checks pass.
- Conditional go: only cosmetic wrapping issues remain and are documented with screenshots.
- No-go: any checkout, booking, messaging, login, upload, verification, or emergency health/session action is unreachable on a launch-supported device class.
