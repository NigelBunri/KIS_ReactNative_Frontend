# Education Dashboard Redesign Progress

## Scope

This document is the persistent handoff for the Education Institution Dashboard redesign in the React Native KIS app.

Primary frontend file:
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`

Related route file:
- `/Users/nigel/dev/KIS/src/network/routes/broadcastRoutes.ts`

Backend route source verified during audit:
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/urls.py`

Hard constraints:
- Preserve existing backend routes.
- Preserve API payload shapes and field names unless absolutely necessary.
- Preserve existing actions, permissions, and business logic.
- Refactor UX without removing features.

## Current Architecture

The current education institution flow is implemented as a single large modal controller with this state machine:

`Hub -> Institution Dashboard -> Module List -> Detail View -> Editors/Actions`

In code, the modal currently drives these screen states:
- `hub`
- `form`
- `dashboard`
- `module`
- `detail`

The current screen controller mixes four responsibilities into one file:
- institution workspace dashboard
- academic content management
- enrollment and booking operations
- broadcast and publishing management

This is the main source of UX confusion. The current detail screen is also shared across many object types, which causes unrelated blocks like metrics, enrollments, booking actions, and course modules to appear together when they should be separated by detail type.

## Existing Module Keys

Current module keys found in `EducationManagementModal.tsx`:

- `overview`
- `programs`
- `courses`
- `lessons`
- `classes`
- `materials`
- `exams`
- `events`
- `students`
- `staff`
- `memberships`
- `enrollments`
- `broadcasts`
- `bookings`
- `analytics`
- `settings`

Additional module groups currently encoded in the file:

- Manageable modules:
  - `programs`
  - `courses`
  - `lessons`
  - `classes`
  - `materials`
  - `exams`
  - `events`
  - `broadcasts`
- Broadcastable education modules:
  - `programs`
  - `courses`
  - `lessons`
  - `classes`
  - `events`

## Screens Found During Audit

The current modal contains or orchestrates these UX layers:

### 1. Education Hub
- Lists available education institutions.
- Entry point into institution workspace flow.

### 2. Institution Form
- Used for creating or editing institution records.

### 3. Institution Dashboard
- Loads institution dashboard payload.
- Shows workspace metrics, summaries, quick links, and recent data.

### 4. Module List Screen
- Fetches a list endpoint based on the current module key.
- Renders rows with view, edit, create, and action controls depending on module.

### 5. Shared Detail Screen
- Fetches one detail payload by module.
- Reuses a generic renderer for many different detail types.

### 6. Inline Editors and Action Workflows
- institution edit workflows
- module creation and editing flows
- booking status actions
- enrollment status actions
- broadcast creation entry points
- course module workspace
- course module item creation/editing

## Detail Types Found

The shared detail renderer currently branches on these payload types:

- `program`
- `course`
- `lesson`
- `class_session`
- `material`
- `assessment`
- `event`
- `broadcast`
- `enrollment`
- `booking`
- `membership`

This confirms the redesign should split detail rendering into specific renderers by object type while keeping the same payload contracts.

## Backend Routes Used

Frontend education routes currently referenced from `broadcastRoutes.ts`:

- `educationHub`
- `educationInstitutions`
- `educationInstitution`
- `educationInstitutionDashboard`
- `educationInstitutionMemberships`
- `educationInstitutionMembershipAction`
- `educationInstitutionStudentMembershipDetail`
- `educationInstitutionStaffMembershipDetail`
- `educationInstitutionStaffAssignments`
- `educationInstitutionEnrollments`
- `educationInstitutionEnrollmentDetail`
- `educationInstitutionEnrollmentAction`
- `educationInstitutionBookings`
- `educationInstitutionBookingDetail`
- `educationInstitutionBookingAction`
- `educationInstitutionPrograms`
- `educationInstitutionProgram`
- `educationInstitutionProgramDetail`
- `educationInstitutionCourses`
- `educationInstitutionCourse`
- `educationInstitutionCourseDetail`
- `educationInstitutionCourseModules`
- `educationInstitutionCourseModule`
- `educationInstitutionCourseModuleItems`
- `educationInstitutionCourseModuleItem`
- `educationInstitutionLessons`
- `educationInstitutionLesson`
- `educationInstitutionLessonDetail`
- `educationInstitutionClassSessions`
- `educationInstitutionClassSession`
- `educationInstitutionClassSessionDetail`
- `educationInstitutionMaterials`
- `educationInstitutionMaterial`
- `educationInstitutionEvents`
- `educationInstitutionEvent`
- `educationInstitutionBroadcasts`
- `educationInstitutionBroadcast`
- `educationInstitutionAssessments`
- `educationInstitutionAssessment`

Backend URL patterns verified in Django:
- education hub
- institution dashboard
- memberships and membership actions
- enrollments list, detail, and action
- bookings list, detail, action, and payment flow
- programs, courses, lessons, classes, materials, assessments, events
- course modules and module items
- broadcasts

## Files Touched

### Phase 0
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 1
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/education-dashboard/components.tsx`
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/education-dashboard/index.ts`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 2
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 3
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 5
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 6
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 4
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Phase 7
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/docs/education-dashboard-redesign-progress.md`

### Files Audited
- `/Users/nigel/dev/KIS/src/screens/tabs/profile-screen/EducationManagementModal.tsx`
- `/Users/nigel/dev/KIS/src/network/routes/broadcastRoutes.ts`
- `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis/apps/broadcasts/urls.py`

## Planned Phases

### Phase 0 - Audit and Safety
- Map current architecture, routes, screens, module keys, and risks.
- Create and maintain this progress file.

### Phase 1 - Design System Components
- Add reusable education workspace components:
  - `EducationWorkspaceHeader`
  - `EducationSectionCard`
  - `EducationMetricTile`
  - `EducationStatusBadge`
  - `EducationActionButton`
  - `EducationListCard`
  - `EducationEmptyState`
  - `EducationTimelineItem`
  - `EducationScreenScaffold`

### Phase 2 - Workspace Home Redesign
- Redesign institution dashboard into a premium workspace home while preserving dashboard payload usage.

### Phase 3 - Module List Redesign
- Redesign module list screens with cleaner cards, filters, badges, and simplified actions.

### Phase 4 - Detail Screen Separation
- Split generic detail rendering into type-specific detail renderers:
  - booking
  - course
  - program
  - enrollment
  - broadcast
  - membership
  - generic fallback

### Phase 5 - Bookings and Payments UX
- Redesign booking summaries, filters, list cards, and booking detail actions.

### Phase 6 - Analytics and Settings UX
- Group metrics and settings into simpler premium sections without breaking actions.

### Phase 7 - Cleanup and Regression Check
- Remove duplicated rendering blocks.
- reduce raw backend-heavy labels
- keep route wiring intact
- run TypeScript checks
- fix compile issues introduced by the redesign

## Completed Work

### Phase 0
- Completed a structure and safety audit of the current education dashboard implementation.
- Confirmed the current navigation model is state-driven inside one large modal.
- Confirmed route wiring should remain stable during refactor.
- Confirmed the detail screen is currently too generic and is the main UX problem area.
- Recorded the current module map, route map, and detail types in this document.

### Phase 1
- Added a reusable local education dashboard component layer under `src/screens/tabs/profile-screen/education-dashboard/`.
- Introduced premium dark-theme-first primitives for:
  - `EducationWorkspaceHeader`
  - `EducationSectionCard`
  - `EducationMetricTile`
  - `EducationStatusBadge`
  - `EducationActionButton`
  - `EducationListCard`
  - `EducationEmptyState`
  - `EducationTimelineItem`
  - `EducationScreenScaffold`
- Kept the new component layer presentation-only with no route, payload, action, or business-logic coupling.
- Deferred integration into `EducationManagementModal.tsx` to Phase 2 so the workspace-home redesign can adopt the components incrementally and safely.

### Phase 2
- Replaced the old institution dashboard body in `EducationManagementModal.tsx` with a clearer workspace-home layout.
- Preserved existing dashboard route usage, payload contracts, loading states, back navigation, institution actions, and module-opening behavior.
- Added a premium workspace hero with:
  - institution name
  - current role
  - landing visibility
  - status badges
  - primary actions for courses and learners
  - secondary actions for bookings, editing, visibility, and landing page
- Reduced the dashboard metrics to a cleaner top-level set focused on:
  - courses
  - learners
  - bookings or bookings pending when available
  - KISC revenue if the payload exposes it later, otherwise pending approvals
- Replaced the old broad dashboard-module grid with simpler workspace section cards for:
  - courses
  - learners
  - bookings and payments
  - broadcasts
  - analytics
  - settings
- Added a simple recent-activity timeline using the existing `recent_courses` and `recent_broadcasts` dashboard payload fields.
- Left the module list screen and detail screen untouched for later phases.

### Phase 3
- Redesigned the module list screens inside `EducationManagementModal.tsx` to use the new premium card pattern instead of the older dense row blocks.
- Reworked the top module controls into a cleaner section-control card with:
  - create or close editor
  - add-from-contacts for staff
  - refresh
- Replaced the old repetitive module rows with `EducationListCard`-based records that now show:
  - clearer title
  - cleaner summary
  - compact meta items
  - status badge
  - one obvious primary action
  - a reduced set of secondary actions
- Preserved existing backend actions for:
  - membership approval or rejection
  - enrollment state changes
  - booking confirmation and payment-pending flow
  - content editing
  - broadcasting and broadcast removal
  - deletion where already supported
- Replaced raw loading, error, and empty states with clearer section cards and empty-state UI.

### Phase 4
- Split the shared detail screen internally into type-specific renderers inside `EducationManagementModal.tsx`.
- Added dedicated detail rendering paths for:
  - program detail
  - course detail
  - booking detail
  - enrollment detail
  - broadcast detail
  - membership detail
  - generic fallback detail
- Moved booking actions into a booking-specific layout so booking detail no longer inherits workspace metrics and unrelated academic sections.
- Kept course detail as the only detail type that renders the course module workspace builder.
- Kept enrollment detail focused on enrollment state, related bookings, submissions, and enrollment actions.
- Kept membership detail separated between learner-oriented membership detail and staff-role management detail.
- Preserved all existing payload reads, nested related-record collections, nested detail opening, and backend action wiring.

### Phase 5
- Redesigned the bookings and payments module on top of the Phase 3 module cards and Phase 4 booking detail renderer.
- Added booking summary tiles for:
  - pending payment
  - confirmed
  - waitlist
  - KISC volume
- Added booking filter chips for:
  - all
  - pending
  - confirmed
  - waitlist
  - cancelled
- Updated booking module cards so the primary action is now a clearer `View` action and secondary actions stay focused on the next likely booking state change.
- Expanded booking detail to show a clearer breakdown for:
  - learner
  - booked item
  - item type
  - seats
  - payment and timing
- Preserved all booking backend routes and actions, including:
  - confirm
  - mark payment pending
  - waitlist
  - cancel
  - expire

### Phase 6
- Redesigned analytics and settings into grouped premium sections inside `EducationManagementModal.tsx`.
- Analytics now shows:
  - a cleaner top summary row
  - grouped metric cards for academic content
  - grouped metric cards for people
  - grouped metric cards for engagement
- Settings now shows grouped management cards for:
  - institution profile
  - public visibility
  - landing page
  - policies
  - danger zone
- Preserved the existing settings actions for:
  - edit institution
  - make public or private
  - open landing page
- Kept analytics backed by the existing dashboard payload without changing any backend data contracts.

### Phase 7
- Cleaned up the remaining user-facing backend-style fallbacks in `EducationManagementModal.tsx`.
- Added centralized helpers so module cards and related detail collections prefer friendly names and titles over raw IDs.
- Tightened enrollment, course-outline, question, and submission labels so lists and detail sections read like product UI instead of payload structures.
- Preserved all route wiring, payload reads, actions, permissions, and nested detail-opening behavior.

## Remaining Work

- No numbered redesign phases remain.
- Remaining follow-up work is optional polish plus unrelated repo-wide TypeScript cleanup outside the education dashboard flow.

## Known Risks

- `EducationManagementModal.tsx` is a very large single-controller file with tightly coupled state and rendering.
- Route selection, payload assumptions, and action wiring are embedded in the same screen component.
- The shared detail renderer is overloaded and may unintentionally depend on nested payload fields for multiple object types.
- Course detail contains a course module workspace that must remain available only where relevant.
- Booking and enrollment actions are already wired; redesign must not change their API calls.
- Some module rows likely depend on implicit payload fields rather than a formal frontend contract.
- The wider React Native codebase already has unrelated TypeScript issues, so regression checks need to distinguish new errors from pre-existing ones.
- The new Phase 1 components are intentionally generic; integration work in later phases should avoid forcing backend-heavy labels directly into the new premium UI without normalization.

## Phase Status

- Phase 0: Complete
- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: Complete
- Phase 5: Complete
- Phase 6: Complete
- Phase 7: Complete

## Recommended Next Step

Use the redesigned education workspace as the stable baseline, then fix the broader React Native TypeScript backlog in broadcast, health, market, and profile files before expecting a fully clean frontend typecheck.
