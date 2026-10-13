# Shared Feeds / Sections / Dashboard — UX/UI Audit

**Scope:** `src/components/dashboard/**` (14 files), `src/components/feeds/**` including `composer/**` (20 files — the other 8 live feeds files, already fixed by a prior pass, are summarized at the bottom), `src/components/profitability/**` (4 of the 10 files — the other 6 were audited in an earlier pass, summarized below), `src/components/section-builder/**` (11 files), `src/components/sections/**` (20 files). Total: **69 files** read this pass; **12 files edited**.

**Headline finding.** Two section-builder picker modals (`KisContentPickerModal.tsx`, `KisVideoPickerModal.tsx`) had the exact "fabricate empty-state on failure" bug flagged repeatedly elsewhere in this audit program: a failed search request (`res?.success === false`) rendered byte-for-byte identically to a genuine zero-result search — "No content found." / "No videos found." — with no error text and no retry. A website owner hitting a network blip while picking content for their landing page would see what looks like an empty catalog, not a transient failure, with zero signal that retrying might help. Both are now fixed with a real error state + Retry button. A second theme/structural finding: `RichTextRenderer.tsx`'s `inline_code` and `badge` marks used hardcoded light-mode-only background colors (`#F4F4F5`, `#E0E7FF`) with no corresponding text-color override — in dark mode this produced light text on a near-white chip, a real contrast failure on any feed post using those two formatting marks. Fixed with theme-aware colors for both. Two unconfirmed-destructive-action gaps were also found and fixed: `RevenueEvidenceAdminPanel.tsx`'s "Reject"/"Revoke" evidence actions, and `DynamicSectionForm.tsx`'s "Reset Form For Selected Type" (which silently wiped all drafted fields for the active section with one tap, no undo).

**On `src/components/sections/**`:** confirmed by code comment at five of the fifteen renderers (`EmbedSection`, `FormSection`, `KisContentSection`, `PromoBarSection`, `SlideshowSection`) that these are deliberate static mockups — real interactivity (form submission, embed playback, rotating promo bar, autoplay slideshow) only exists on the separate published-website repo; this native preview intentionally shows a non-interactive summary card instead ("Renders live on your published site" / "Use Preview to see the real layout"). This matches the task brief's note and is treated as by-design, not a bug. `KisVideoSection.tsx` is the one exception — it plays real video via `react-native-video` directly in the editor preview, not a mockup. The other nine static-content renderers (Hero/About/Gallery/Stats/Testimonials/Programs/CTA/Contact/FAQs/Hours/SocialLinks) are consistent, theme-driven, and free of silent-failure or confirmation issues — they have no network calls of their own, so there's nothing to fail silently.

**On already-audited files in this directory tree** (fixed by a prior pass; verified via `git diff`, not re-touched): see the "Previously Fixed" section at the bottom.

---

## Dashboard cards (`src/components/dashboard/`)

### AIAssistanceSafetyCard (`src/components/dashboard/AIAssistanceSafetyCard.tsx`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A (dead file, light note only per task scope).
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### PerformanceOfflineCard (`src/components/dashboard/PerformanceOfflineCard.tsx`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### PublicGrowthReadinessCard (`src/components/dashboard/PublicGrowthReadinessCard.tsx`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### UnifiedDashboardSummaryCard (`src/components/dashboard/UnifiedDashboardSummaryCard.tsx`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### EvidenceWorkflowPlanCard, LaunchOpsReadinessCard, MonetizationSafetyCard, ProfitabilityCommandCenterCard, ProfitabilityLaunchGateCard, ProfitabilitySubscriptionLifecycleCard, RevenueOpsEvidenceCard, SafetyCommandCenterCard, SecurityLaunchGateCard
**Used by:** `src/screens/tabs/ProfileScreen.tsx` (staff-only readiness dashboards).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, color/contrast/design-system consistency, touch targets, accessibility labels.

These nine files are all one template: fetch a redacted readiness summary on mount, show an `ActivityIndicator` while loading, catch failures into an `error` state rendered with the actual message plus a working "Retry" `KISButton`, and render counts/checks/guardrails entirely through `palette` tokens (no hardcoded colors besides the shared critical-red `rgba(185,28,28,...)` tone, used consistently across all nine for "blocked/critical/fail" states). None have destructive actions, forms, or icon-only controls — every icon sits beside a text label. No silent-failure or fabricate-success pattern: all catch blocks set a real `error` string and none claim success they didn't get.

### Findings
1. None. All nine meet the bar as a direct consequence of sharing one well-built template.

### Fixes implemented
None — meets the bar as-is.

### Verification
No changes made; `npm run typecheck` passes with the rest of the batch.

**Status:** AUDITED-NO-ISSUES (all nine)

---

### RevenueEvidenceAdminPanel (`src/components/dashboard/RevenueEvidenceAdminPanel.tsx`)
**Used by:** `src/screens/tabs/ProfileScreen.tsx`.
**Criteria evaluated:** destructive-action confirmation, touch targets/affordances, accessibility labels, visual hierarchy.

### Findings
1. **(P1, fixed)** The "Reject" and "Revoke" buttons in the evidence review action row ran immediately on tap with zero confirmation. "Revoke" withdraws an already-approved piece of launch evidence and pushes monetization readiness back to blocked for that area — a real, consequential, hard-to-walk-back action, styled identically (`variant="outline"`) to the harmless "Submit"/"Approve"/"Changes" buttons next to it, with no visual signal it's different in kind.
2. **(P3, fixed)** The tappable record-title `<Text onPress={...}>` used to select which evidence record the action row operates on had no `accessibilityRole`/`accessibilityLabel` — a screen-reader user would hear plain text, not learn it's an actionable selector.

### Fixes implemented
- Split `runAction` into a confirmation gate (`runAction`) and the actual network call (`performAction`). `reject`/`revoke` now show an `Alert.alert` naming the specific record by title before proceeding (`Cancel` / destructive-styled confirm); `submit`/`approve`/`needs_changes` are unaffected and still run immediately.
- Changed "Reject" and "Revoke" to `variant="danger"` so they're visually distinct from the three safe actions.
- Added `accessibilityRole="button"` + a descriptive `accessibilityLabel` to the record-title selector.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only, unrelated lines).

**Status:** AUDITED-FIXED

---

## Feeds (`src/components/feeds/`)

### CommunityCommentThreadPanel (`src/components/feeds/CommunityCommentThreadPanel.tsx`)
**Used by:** `FeedScreen.tsx`, as the HTTP-based comment thread for community-feed posts (the socket-based `CommentThreadPanel` is used everywhere `commentsListEndpoint`/`commentCreateEndpoint` aren't supplied).
**Criteria evaluated:** loading/empty/error states, silent-error-swallowing, accessibility labels, touch targets.

### Findings
1. **(P2, fixed)** A failed initial comment load (`loadComments`) rendered the error text with no way to retry except unmounting the panel (scrolling the post off-screen and back).
2. **(P3, fixed)** The "Post" send button and its icon-adjacent affordance had no `accessibilityRole`/`accessibilityLabel`.
3. Verified **not** a bug: the comment-post path already checks `response?.success` before appending to the thread and clearing the draft (comment in the code explicitly documents this was fixed previously) — a failed post correctly surfaces an error instead of fabricating a posted comment.

### Fixes implemented
- Added a `Retry` control next to the error text, wired to the existing `loadComments`.
- Added `accessibilityRole="button"` + `accessibilityLabel` to the send `Pressable`.

### Verification
`npm run typecheck`: 0 errors. `npx eslint --quiet`: 0 errors.

**Status:** AUDITED-FIXED

---

### CommunityFeedScreen (`src/components/feeds/CommunityFeedScreen.tsx`)
**Used by:** `src/Module/Community/CommunityRoomPage.tsx`, `src/components/partners/PartnersMessagesPane.tsx`.
**Criteria evaluated:** N/A — this is a thin configuration wrapper around `FeedScreen` (already audited/fixed in the prior pass); it supplies endpoints/labels/live-socket-refresh wiring and renders no UI of its own.

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

### PartnerFeedScreen (`src/components/feeds/PartnerFeedScreen.tsx`)
**Used by:** `src/components/feeds/FeedScreen.tsx`'s own import graph is unrelated here — actual consumers are `src/components/partners/PartnersMessagesPane.tsx`.
**Criteria evaluated:** N/A — same thin `FeedScreen` wrapper pattern as `CommunityFeedScreen.tsx`.

### Findings
None.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

### RichTextRenderer (`src/components/feeds/RichTextRenderer.tsx`)
**Used by:** `BroadcastDetailScreen.tsx`, `FeedManagementModal.tsx`, `ChannelContentDetailPage.tsx`, `TextComposerPage.tsx` (preview), `FeedScreen.tsx`, `PartnerFeedPage.tsx`, `FeedItemCard.tsx`, `BroadcastFeedCard.tsx` — the shared rich-text-doc-to-UI renderer used across feeds and broadcast.
**Criteria evaluated:** color/contrast/design-system consistency, accessibility labels on tap targets.

### Findings
1. **(P2, fixed)** The `inline_code` and `badge` marks hardcoded light-mode-only background colors (`#F4F4F5`, `#E0E7FF`) with no matching text-color override. In dark mode the surrounding text color is the theme's light cream (`#F0EBE1`), so either mark rendered as light text on a near-white/pale-blue chip — a real, reproducible contrast failure for any post using those two formatting marks, visible wherever this renderer is used.
2. **(P3, fixed)** The tappable `@handle` segments (in both the rich-doc path and the plain-text fallback path) had no `accessibilityRole`/`accessibilityLabel` — a profile-preview link that a screen reader would announce as plain text.

### Fixes implemented
- `computeMarkStyle` now takes an `isDark` flag and uses theme-aware colors for both marks (`#2A2838`/`#F0EBE1` text in dark, `#F4F4F5`/`#1F2024` text in light for inline_code; similarly for badge), threaded through from `useKISTheme()` at the render root.
- Added `accessibilityRole="link"` + a descriptive `accessibilityLabel` to all `@handle` press targets.

### Verification
`npm run typecheck`: 0 errors. `npx eslint --quiet`: 0 errors.

**Status:** AUDITED-FIXED

---

### ShareRenderer (`src/components/feeds/ShareRenderer.tsx`)
**Used by:** `FeedScreen.tsx`, `PartnerFeedPage.tsx` — an off-screen `ViewShot`-captured card used only to generate a shareable image, never visible to the user directly.
**Criteria evaluated:** N/A (not user-facing interactive UI; positioned off-screen by design for capture).

### Findings
None.

**Status:** AUDITED-NO-ISSUES

---

### commentThreadUtils (`src/components/feeds/commentThreadUtils.ts`)
**Used by:** `CommentThreadPanel.tsx` (already audited/fixed).
**Criteria evaluated:** N/A — pure payload-normalization helpers, no UI.

**Status:** AUDITED-NO-ISSUES

---

### feedUtils (`src/components/feeds/feedUtils.ts`)
**Used by:** `FeedScreen.tsx`.
**Criteria evaluated:** N/A — one pure formatter (`formatCompactCount`), no UI.

**Status:** AUDITED-NO-ISSUES

---

### richTextValue (`src/components/feeds/richTextValue.ts`)
**Used by:** `CommunityInfoPage.tsx`, `CommunityRoomPage.tsx`, `CommunitiesTab.tsx`, `FeedManagementModal.tsx`, `BroadcastDetailScreen.tsx`, `BroadcastFeedFullScreenScreen.tsx`, `CommunityFeedScreen.tsx`, `PartnerFeedPage.tsx`, `FeedItemCard.tsx`, `BroadcastFeedCard.tsx`.
**Criteria evaluated:** N/A — pure parsing helpers (`getFeedRichTextValue`/`getFeedPlainText`/`hasFeedRichText`), no UI.

**Status:** AUDITED-NO-ISSUES

---

### videoAttachmentHelpers (`src/components/feeds/videoAttachmentHelpers.ts`)
**Used by:** `ProfileScreen.tsx`, `FeedScreen.tsx`, `PartnerFeedPage.tsx`.
**Criteria evaluated:** silent-error-swallowing / fabricate-success-on-failure (checked specifically since this gates whether a video post actually gets created).

### Findings
None — `prepareBroadcastVideoPayload` already does the right thing: on an upload failure it shows `Alert.alert('Video upload failed', ...)` and returns `null` rather than a payload. Verified all three call sites (`ProfileScreen.tsx`, `FeedScreen.tsx`, `PartnerFeedPage.tsx`) check for `null` and abort the post instead of proceeding — no silent "fabricate success" gap.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES

---

### composer/FeatureToolbar (`src/components/feeds/composer/FeatureToolbar.tsx`)
**Used by:** confirmed dead, zero importers (verified via grep across `src/**`, not just the composer folder).
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### composer/featuresRegistry (`src/components/feeds/composer/featuresRegistry.ts`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

### composer/richTextTypes (`src/components/feeds/composer/richTextTypes.ts`)
**Used by:** confirmed dead, zero importers.
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED

---

### composer/UI/DropButton (`src/components/feeds/composer/UI/DropButton.tsx`)
**Used by:** `TextComposerPage.tsx` (the Format/Blocks/Align/Colors/Padding/Font menu triggers).
**Criteria evaluated:** accessibility labels, touch targets.

### Findings
1. **(P3, fixed)** No `accessibilityRole`/`accessibilityLabel`/selected-state on an otherwise plain `Pressable`.

### Fixes implemented
Added `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityState={{ selected: active }}`.

### Verification
`npm run typecheck`: 0 errors. `npx eslint --quiet`: 0 errors.

**Status:** AUDITED-FIXED

---

### composer/attachments (`src/components/feeds/composer/attachments.ts`)
**Used by:** nowhere else inside `feeds/composer` directly — `makeAttachment` is a tiny pure constructor. (Note: a same-named but unrelated `attachments.ts`-adjacent import graph exists for chat; this file specifically has no additional consumers found.)
**Criteria evaluated:** N/A — pure helper, no UI, no network, nothing to fail silently.

**Status:** AUDITED-NO-ISSUES

---

### composer/pages/EventComposerPage (`src/components/feeds/composer/pages/EventComposerPage.tsx`)
**Used by:** `composer/FeedComposerSheet.tsx`.
**Criteria evaluated:** forms/validation, touch targets, design-system consistency.

### Findings
None — three controlled inputs (title/datetime/location), no async calls of its own, `minHeight: 48` on text inputs, theme-driven colors throughout.

**Status:** AUDITED-NO-ISSUES

---

### composer/pages/LinkComposerPage (`src/components/feeds/composer/pages/LinkComposerPage.tsx`)
**Used by:** `composer/FeedComposerSheet.tsx`.
**Criteria evaluated:** forms/validation, touch targets, design-system consistency.

### Findings
None — same pattern as EventComposerPage, no issues found.

**Status:** AUDITED-NO-ISSUES

---

### composer/pages/PollComposerPage (`src/components/feeds/composer/pages/PollComposerPage.tsx`)
**Used by:** `composer/FeedComposerSheet.tsx`.
**Criteria evaluated:** accessibility labels, touch targets.

### Findings
1. **(P3, fixed)** "Add option" `Pressable` had no `accessibilityRole`/`accessibilityLabel`.

### Fixes implemented
Added `accessibilityRole="button"` + `accessibilityLabel="Add poll option"`.

### Verification
`npm run typecheck`: 0 errors. `npx eslint --quiet`: 0 errors.

**Status:** AUDITED-FIXED

---

### composer/pages/TextComposerPage (`src/components/feeds/composer/pages/TextComposerPage.tsx`)
**Used by:** `composer/FeedComposerSheet.tsx` (the rich-text post composer — formatting toolbar, @mention search, color/padding/font-size pickers, live preview).
**Criteria evaluated:** accessibility labels on icon-only controls, silent-error-swallowing, touch targets.

### Findings
1. **(P2, fixed)** The dropdown-panel close button was icon-only (`KISIcon name="close"`) with no `accessibilityLabel` at all.
2. **(P3, fixed)** Four `±` increment/decrement `Pressable`s (text padding, font size) were single-glyph icon-equivalent controls with no `accessibilityLabel` — a screen reader would announce "−" or "+" with no context for what they adjust.
3. **(P3, fixed)** The @mention result row `Pressable` had no `accessibilityLabel` naming which user it inserts.
4. Verified **not** a bug: the @mention search's pagination handling (`res?.data?.results` vs. a bare array) already has an explicit code comment documenting a prior fix for the exact "paginated response treated as a flat array" bug class flagged elsewhere in this audit — confirmed already correct, not re-touched.
5. Verified **not** a bug: the mention search's `catch { setMentionResults([]) }` degrades silently to "no results" on a network failure rather than showing an error — judged acceptable here since this is a soft, debounced autocomplete (not a primary action), and showing an alert on every failed keystroke-triggered search would be worse UX than quietly showing no suggestions.

### Fixes implemented
Added `accessibilityRole="button"` + descriptive `accessibilityLabel`s to: the menu close button ("Close menu"), the four padding/font-size `±` buttons ("Decrease/Increase text padding", "Decrease/Increase font size"), and the mention row ("Mention {name}").

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing `no-undef-init` and `react-native/no-inline-styles` warnings only, unrelated to this change).

**Status:** AUDITED-FIXED

---

### composer/richTextUtils (`src/components/feeds/composer/richTextUtils.ts`)
**Used by:** `docConversion.ts`, `FeedComposerSheet.tsx`, `TextComposerPage.tsx`.
**Criteria evaluated:** N/A — pure span/doc-conversion math, no UI.

**Status:** AUDITED-NO-ISSUES

---

### composer/types (`src/components/feeds/composer/types.ts`)
**Used by:** `FeedScreen.tsx`, `FeedComposerSheet.tsx`, throughout `composer/**`.
**Criteria evaluated:** N/A — pure type definitions.

**Status:** AUDITED-NO-ISSUES

---

## Profitability preview cards (confirmed dead, 4 files)

### CompactProfitabilityPreviewCard, EducationRevenuePreviewCard, InstitutionMonetizationPreviewCard, PartnerRevenuePreviewCard
**Used by:** confirmed dead, zero importers (all four — verified via grep across `src/**`).
**Criteria evaluated:** N/A.
**Status:** CONFIRMED-DEAD-NOT-AUDITED (all four)

---

## Section Builder (`src/components/section-builder/`)

### BackgroundColorSelector (`src/components/section-builder/BackgroundColorSelector.tsx`)
**Used by:** `DynamicSectionForm.tsx`.
**Criteria evaluated:** accessibility labels, selection-state affordance.

### Findings
1. **(P3, fixed)** The 6 color-swatch `TouchableOpacity` rows had no `accessibilityRole`/`accessibilityLabel`/selected-state, despite visually indicating selection via border color + a "Selected" text label.

### Fixes implemented
Added `accessibilityRole="button"`, a descriptive `accessibilityLabel`, and `accessibilityState={{ selected, disabled }}`.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

### DynamicSectionForm (`src/components/section-builder/DynamicSectionForm.tsx`)
**Used by:** `src/screens/website-builder/WebsiteBuilderScreen.tsx` (the per-section-type field editor — this is the large, 17-section-type form).
**Criteria evaluated:** destructive-action confirmation, forms/validation, accessibility labels.

### Findings
1. **(P1, fixed)** "Reset Form For Selected Type" cleared every field of the section currently being edited (`onDataChange({})`) on a single tap with **no confirmation** — a user could lose everything they'd typed for a hero banner, testimonials list, FAQ set, etc. in one accidental tap, with no undo. This is the same destructive-action-without-confirmation pattern flagged and fixed repeatedly elsewhere in this audit (e.g. `FeedPostActionsSheet.tsx`'s generic confirm step from the prior pass).
2. Noted, not fixed (by design, out of scope to redesign): the `::`-delimited multiline text fields (metrics, testimonials, FAQ items, hours, social links, form fields, slides, promo messages — 8 of the 17 section types) are a terse, error-prone data-entry format with no inline validation or per-row editing UI. This is a legitimate "forms/validation" ergonomics concern, but changing the data-entry model is a scope-breaking redesign of the section-authoring UX, not a safe/low-risk fix — flagged for a future dedicated pass rather than patched here.

### Fixes implemented
Wrapped the reset action in `Alert.alert('Reset this section?', ..., [Cancel, {Reset, style: destructive}])` before calling `onDataChange({})`; added `accessibilityRole`/`accessibilityLabel`/`hitSlop` to the trigger.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style and one pre-existing `no-extra-boolean-cast` warning, unrelated lines).

**Status:** AUDITED-FIXED

---

### KisContentPickerModal (`src/components/section-builder/KisContentPickerModal.tsx`)
**Used by:** `DynamicSectionForm.tsx` (the "Add KIS Content" section's content browser).
**Criteria evaluated:** silent-error-swallowing / fabricate-empty-state-on-failure, loading/empty/error states.

### Findings
1. **(P2, fixed)** `load()` read `res?.data?.results` without ever checking `res?.success`. A failed search request (network blip, 5xx, auth hiccup) produced `items = []`, which rendered the exact same "No content found." empty state as a genuine zero-result search — the user has no way to tell "nothing matches" from "the request failed," and no retry affordance existed.

### Fixes implemented
Added an `error` state; `load()` now checks `res?.success` and, on failure, sets a real error message (from `res?.message`, defaulting to "Unable to search content.") instead of silently rendering an empty list. The list view now shows the error text + a "Retry" `KISButton` in place of the empty-state text when a real failure occurred.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

### KisVideoPickerModal (`src/components/section-builder/KisVideoPickerModal.tsx`)
**Used by:** `DynamicSectionForm.tsx` (the "KIS Video" section's video browser).
**Criteria evaluated:** silent-error-swallowing / fabricate-empty-state-on-failure, loading/empty/error states.

### Findings
1. **(P2, fixed)** Identical bug to `KisContentPickerModal.tsx` above — same unchecked `res?.success`, same "No videos found." masking a real failure.

### Fixes implemented
Same fix pattern as `KisContentPickerModal.tsx`: added `error` state, `success` check, error+Retry UI in place of the empty state on a real failure.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

### SectionDesignPickerModal (`src/components/section-builder/SectionDesignPickerModal.tsx`)
**Used by:** `WebsiteBuilderScreen.tsx` ("Change Design" on `hero_banner`/`about` sections).
**Criteria evaluated:** accessibility labels (no network calls — purely local, static variant list).

### Findings
1. **(P3, fixed)** Design-option rows had no `accessibilityRole`/`accessibilityLabel`/selected-state.

### Fixes implemented
Added `accessibilityRole="button"`, a descriptive `accessibilityLabel`, and `accessibilityState={{ selected }}`.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

### SectionPreview (`src/components/section-builder/SectionPreview.tsx`)
**Used by:** `WebsiteBuilderScreen.tsx` (renders the live, reorderable list of saved sections + `LiveSectionPreview` for the draft-in-progress section).
**Criteria evaluated:** destructive-action confirmation, accessibility labels on icon-only controls, touch targets.

### Findings
1. Verified **not** a bug: the "Delete" button here calls straight through to a parent-supplied `onDelete` prop with no confirmation of its own — but `WebsiteBuilderScreen.tsx`'s `handleDeleteSection` (the actual handler wired in) already shows an `Alert.alert('Delete section', ...)` confirmation before removing anything. No gap in the real user-facing flow; `SectionPreview` is correctly a dumb delegate here.
2. **(P3, fixed)** The press-and-hold drag handle was a bare `KISIcon name="menu"` with no `accessibilityLabel` explaining what it does or how (long-press to drag).
3. **(P3, fixed)** "Edit"/"Delete" text-only `TouchableOpacity`s had no padding/`hitSlop` (effective touch target = the text's own bounding box, well under 44pt) and no `accessibilityLabel`.

### Fixes implemented
Added `hitSlop={10}` + `accessibilityRole="button"` + a descriptive `accessibilityLabel` to Edit, Delete, and the drag handle.

### Verification
`npm run typecheck`: 0 errors. `npx eslint`: 0 errors (pre-existing inline-style warnings only).

**Status:** AUDITED-FIXED

---

### SectionTypeSelector (`src/components/section-builder/SectionTypeSelector.tsx`)
**Used by:** `WebsiteBuilderScreen.tsx` (the "+ Add New Section" type picker, with per-type mockup thumbnails).
**Criteria evaluated:** visual hierarchy, touch targets, design-system consistency.

### Findings
None — each row already carries a visible radio indicator + "( ) Select This Type" label + title + description, giving it a real accessible name via the text content; rows are full-width `TouchableOpacity`s well over 44pt tall.

**Status:** AUDITED-NO-ISSUES

---

### backgroundOptions (`src/components/section-builder/backgroundOptions.ts`)
**Used by:** `InstitutionLandingPreviewScreen.tsx`, `BackgroundColorSelector.tsx`, `SectionPreview.tsx`.
**Criteria evaluated:** N/A — static data + a pure resolver function, no UI.

**Status:** AUDITED-NO-ISSUES

### sectionTypeMeta (`src/components/section-builder/sectionTypeMeta.ts`)
**Used by:** `WebsiteBuilderScreen.tsx`, `SectionTypeSelector.tsx`.
**Criteria evaluated:** N/A — static data only.

**Status:** AUDITED-NO-ISSUES

### sectionVariants (`src/components/section-builder/sectionVariants.ts`)
**Used by:** `WebsiteBuilderScreen.tsx`, `SectionDesignPickerModal.tsx`, `types.ts`.
**Criteria evaluated:** N/A — static data + two pure resolver functions.

**Status:** AUDITED-NO-ISSUES

### types (`src/components/section-builder/types.ts`)
**Used by:** throughout `section-builder/**` and `sections/**`.
**Criteria evaluated:** N/A — pure type/factory definitions, no UI.

**Status:** AUDITED-NO-ISSUES

---

## Sections (`src/components/sections/`)

**Context (see summary above):** all 20 files in this folder are preview-only renderers used exclusively by `SectionPreview.tsx`/`WebsiteBuilderScreen.tsx`'s in-app editor — none of them are the actual public-facing rendering (that's a separate published-website repo, per repeated code comments referencing `components/website-builder/SectionRenderer.tsx` there). This is corroborated structurally: `SectionPreview.tsx`'s `renderSection()` never passes an `onPressCta` to `HeroSection`, so even that section's one real-looking button is already a no-op in every actual call path — confirming the entire folder's buttons/links are deliberately inert in-app, with real interactivity living on the published site.

### EditableText (`src/components/sections/EditableText.tsx`)
**Used by:** all 14 of the other section renderers below (shared dual-mode text: plain `<Text>` when read-only, a style-matched `<TextInput>` when `onFieldChange` is supplied for inline editing).
**Criteria evaluated:** design-system consistency, forms/validation.

### Findings
None — clean dual-mode implementation, no issues.

**Status:** AUDITED-NO-ISSUES

### HeroSection, AboutSection, CTASection, ContactSection, FaqsSection, GallerySection, HoursSection, ProgramsSection, StatsSection, TestimonialsSection
**Used by:** `SectionPreview.tsx` (via `renderSection()`), plus `InstitutionLandingPreviewScreen.tsx` directly for several of them.
**Criteria evaluated:** visual hierarchy, typography/spacing, color/contrast/design-system consistency, empty states.

### Findings
None across all ten. Each renders through `palette`/`typography`/`spacing` props supplied by the caller (never a hardcoded color), has an honest, specific empty-state message when its data array is empty ("No metrics defined.", "No testimonials added.", "No services added.", "No images selected."), and `HoursSection`/`SocialLinksSection`'s own `if (!items.length && !onFieldChange) return null` correctly skips rendering an empty section entirely in read-only mode while still showing the edit affordance in draft mode.

### Fixes implemented
None — meets the bar as-is.

**Status:** AUDITED-NO-ISSUES (all ten)

---

### SocialLinksSection (`src/components/sections/SocialLinksSection.tsx`)
**Used by:** `SectionPreview.tsx`.
**Criteria evaluated:** affordance correctness (does a tappable-looking control actually do something).

### Findings
1. Noted, not fixed (by-design, consistent with the rest of this folder): each social-platform pill is wrapped in a `TouchableOpacity` with **no `onPress`** at all — it looks tappable (pill shape, accent-colored label) but is inert. Given the folder-wide "preview only, real interactivity lives on the published site" pattern confirmed above (and that `HeroSection`'s CTA button is equally inert in every real call path), this reads as intentional rather than an oversight — but unlike the five explicitly-commented static mockups (Embed/Form/KisContent/PromoBar/Slideshow), there's no code comment here confirming intent, so it's flagged for whoever owns this file to add a confirming comment or make it a plain `View` instead.

### Fixes implemented
None — this one is judgment-call "working as apparently intended" rather than a confirmed safe fix; changing affordance semantics without confirming the designer's intent felt like the wrong risk/value tradeoff for this pass.

**Status:** AUDITED-FINDINGS-DOCUMENTED

---

### EmbedSection, FormSection, KisContentSection, PromoBarSection, SlideshowSection
**Used by:** `SectionPreview.tsx`.
**Criteria evaluated:** confirmed intentional static mockup (per task brief); no further audit performed.

Each carries an explicit code comment confirming it's a deliberate placeholder — e.g. FormSection: *"Read-only preview — real submission only happens on the public website... not inside this editor."* / PromoBarSection: *"the real rotating strip only animates on the published website."* No silent-failure, confirmation, or accessibility concerns apply since none of these render any interactive control.

**Status:** AUDITED-NO-ISSUES (all five — confirmed by-design, not deep-audited per task guidance)

---

### KisVideoSection (`src/components/sections/KisVideoSection.tsx`)
**Used by:** `SectionPreview.tsx`.
**Criteria evaluated:** loading/empty states, media playback correctness.

### Findings
None — unlike its five siblings above, this one is **not** a mockup: it plays real video via `react-native-video` directly from the resolved URL, with a correct empty state ("No video selected yet") when `data.video_url` is unset.

**Status:** AUDITED-NO-ISSUES

---

### index, types (`src/components/sections/index.ts`, `src/components/sections/types.ts`)
**Used by:** `SectionPreview.tsx` and others, re-exporting/typing the above.
**Criteria evaluated:** N/A — barrel export + one shared prop type, no UI.

**Status:** AUDITED-NO-ISSUES (both)

---

## Previously Fixed (prior pass — summarized from `git diff`, not re-touched)

These files were audited and fixed before this pass began; included here for a complete record per the task brief, verified by reading their actual diffs rather than taking the described summary on faith.

- **`CommentThreadPanel.tsx`** — added `accessibilityRole`/`accessibilityLabel` to the reply-cancel and send buttons (previously bare icon/unlabeled).
- **`FeedEditSheet.tsx`** — added accessibility labels to the close/change-thumbnail/remove-thumbnail icon-only buttons.
- **`FeedPostActionsSheet.tsx`** — added a generic `destructive`+`confirmMessage` confirmation step (an `Alert.alert` before `onPress` fires) to this shared action-sheet component, plus `accessibilityLabel` on each row. Any consumer marking an action `destructive: true` now gets a real confirm step for free.
- **`FeedScreen.tsx`** — like now rolls back its optimistic UI state on a real (non-offline-queued) failure instead of silently leaving the toggle stuck in the wrong state; delete/broadcast/block/report now show a real failure `Alert` instead of silently no-oping when `res?.success` is false; block and delete actions were wired into `FeedPostActionsSheet`'s new confirm step with real, specific confirm copy; several icon-only buttons gained accessibility labels.
- **`composer/FeedComposerSheet.tsx`** — dismissing the sheet (backdrop tap, close icon, pull-down, hardware back) now checks for actual drafted content (`hasDraftContent()`) and shows a "Discard post?" confirm only when there's something real to lose; empty/picker-step dismissal is still instant. Added several accessibility labels.
- **`composer/UI/Swatch.tsx`** — added `hitSlop`, `accessibilityRole`, a color-naming `accessibilityLabel`, and `accessibilityState={{ selected }}`.
- **`composer/docConversion.ts`** — fixed a broken import (`./richUtils` → `./richTextUtils`, the actual filename) that would otherwise have been a hard build break; one-line fix.
- **`composer/pages/MediaComposerPage.tsx`** — **note for the record:** the diff for this file is a single added line, `import { Alert } from 'react-native'`, with `Alert` never actually used anywhere else in the file. `npx eslint` on this file currently fails with `'Alert' is defined but never used (@typescript-eslint/no-unused-vars)` — a real, live lint **error**, not a warning. Per this task's explicit instruction not to re-touch already-fixed files, this was left as-is and not corrected here, but it should be cleaned up (either remove the unused import, or finish whatever the intended `Alert.alert(...)` call was supposed to be) in a follow-up pass.

**Also previously handled (separate earlier pass, not re-verified here):** the 6 live `profitability/**` files (`CommerceRevenuePreviewCard.tsx`, `ConsumerSpiritualRevenuePreviewCard.tsx`, `EnterpriseKcanRevenuePreviewCard.tsx`, `HealthRevenuePreviewCard.tsx`, `NotificationRetentionPreviewCard.tsx`, `TrustPromotionRevenuePreviewCard.tsx`) each gained ~50 lines turning them into honest "coming soon" cards; and 3 confirmed-dead files were deleted (`feeds/FeedCommentsScreen.tsx`, `feeds/composer/richUtils.ts`, `section-builder/SectionBuilder.tsx` — all confirmed absent from the current tree).

---

## Summary

| Area | Files | Fixed | No issues | Dead (noted only) | Findings documented (not fixed) |
|---|---|---|---|---|---|
| dashboard/ | 14 | 1 | 9 | 4 | 0 |
| feeds/ (incl. composer) | 20 | 5 | 12 | 3 | 0 |
| profitability/ (this pass's 4) | 4 | 0 | 0 | 4 | 0 |
| section-builder/ | 11 | 6 | 5 | 0 | 0 |
| sections/ | 20 | 0 | 19 | 0 | 1 |
| **Total (this pass)** | **69** | **12** | **45** | **11** | **1** |

Dashboard breakdown: 4 confirmed-dead (`AIAssistanceSafetyCard`, `PerformanceOfflineCard`, `PublicGrowthReadinessCard`, `UnifiedDashboardSummaryCard`) + 9 identical-template no-issue cards + 1 fixed (`RevenueEvidenceAdminPanel`) = 14.

**Single most important issue:** the two section-builder content pickers (`KisContentPickerModal.tsx`, `KisVideoPickerModal.tsx`) silently rendering a failed search as an empty catalog — the same "fabricate-failure-as-empty-state" bug class that has been the single most common defect across this entire audit program, now confirmed present here too and fixed in both places.
