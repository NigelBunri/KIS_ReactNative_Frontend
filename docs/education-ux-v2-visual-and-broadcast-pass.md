# Education UX v2 — Visual Quality + Broadcast Flow Restoration

## Scope

Handoff for the pass that followed the `education-ux-v2` rewrite (see git
log: `EducationManagementModal.tsx` and the old Broadcast-tab discovery
page were deleted and replaced with real navigator destinations under
`src/screens/education/{provider,learner}/`). That rewrite shipped real
navigation but left two problems:

1. Every new provider and learner screen was built with ad hoc inline
   `View`/`Text` styles instead of a shared design language — noticeably
   plainer than the rest of the app.
2. The old modal's **Broadcasts** module (publish institution
   announcements; manually broadcast programs/lessons/class
   sessions/training sessions/events) was cut entirely and never replaced.
   Course publishing got an automatic broadcast-sync (see
   `CourseBuilderScreen.saveDetails`), but nothing else did — there was no
   UI left anywhere to create an `institution_notice` announcement or
   broadcast a non-course item, and no learner-facing place to see an
   institution's updates at all.

## What changed

### Shared component kit relocated
`src/screens/tabs/profile-screen/education-dashboard/components.tsx` (the
Phase 1 premium primitives built for the old modal's redesign —
`EducationScreenScaffold`, `EducationWorkspaceHeader`, `EducationSectionCard`,
`EducationMetricTile`, `EducationStatusBadge`, `EducationActionButton`,
`EducationListCard`, `EducationEmptyState`, `EducationTimelineItem`) had
been orphaned when the old modal was deleted — nothing imported it. Moved
to `src/screens/education/shared/components.tsx` and adopted across the
v2 screens below.

### Visual pass (premium component kit adopted)
- Provider: `InstitutionDashboardScreen`, `InstitutionPickerScreen`,
  `CoursesListScreen`, `LearnersScreen`, `EventsLiveScreen`,
  `InstitutionSettingsScreen`. `CourseBuilderScreen`'s Details tab wrapped
  in a section card; its Curriculum tab and the three course-builder
  editors (`ContentEditor`/`AssessmentsEditor`/`LiveEditor`) were left
  functionally and visually as-is — high-complexity form logic, low risk
  tolerance for a styling-only pass.
- Learner: `EducationHomeScreen`, `MyLearningScreen`, `CertificatesScreen`.
  `CourseDetailScreen` kept its existing structure (payment handoff,
  enrollment sheet, curriculum outline) and only gained the offline-save
  toggle below. `LearningPlayerScreen` untouched.

### Broadcast flow restored
- **`src/screens/education/provider/BroadcastsScreen.tsx`** (new) — list
  broadcasts by status (draft/published/archived), create/edit with the
  same payload shape and field set as the old modal (`broadcast_kind`,
  optional `course_id`/`event_id` link, `status`), archive to remove.
  Route: `EducationBroadcasts`. Wired into `InstitutionDashboardScreen` as
  a quick action and a "Recent broadcasts" timeline section.
- **`src/screens/education/learner/InstitutionProfileScreen.tsx`** (new) —
  the learner-facing half: institution header, published courses,
  published broadcasts as an "Updates" timeline. Reached by tapping an
  institution spotlight card on `EducationHomeScreen` (previously that tap
  only ran a text search — no real institution destination existed).
  Route: `EducationInstitutionProfile`.
- Reuses only existing backend routes (`educationInstitutionBroadcasts`,
  `educationInstitutionBroadcast`, `educationInstitutionCourses`,
  `educationInstitution`) — no backend changes.

### Offline save restored
`useEducationOfflineStore` (AsyncStorage-backed "save for offline"
bookmark) was built for the old discovery page and became orphaned by the
v2 rewrite — nothing referenced it. `CourseDetailScreen` now exposes a
save/remove toggle next to the back button; `MyLearningScreen` shows a
"Saved for offline" section when any exist.

## Known risks / not done

- `EducationRevenuePreviewCard` (`src/components/profitability/...`) is
  currently a stub that always renders `null` — not restored anywhere
  since doing so has no visible effect until that component is
  implemented.
- `InstitutionProfileScreen` calls `educationInstitutionCourses` and
  `educationInstitutionBroadcasts` — endpoints originally built for
  institution staff. Local backend source wasn't available to verify
  these are readable by non-staff learners; the screen degrades to empty
  sections rather than erroring if a call is rejected, so this is a
  soft risk, not a crash risk. Worth confirming against the live backend.
- Course-builder editors (`ContentEditor`, `AssessmentsEditor`,
  `LiveEditor`) and `LearningPlayerScreen` still use their original inline
  styles — functionally complete, visually inconsistent with the rest of
  the pass. Next candidate if more polish is requested.
