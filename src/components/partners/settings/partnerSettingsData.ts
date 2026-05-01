export type PartnerRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'member';

export type PartnerFeature = {
  key: string;
  title: string;
  description: string;
  access: PartnerRole[];
  enabled?: boolean;
  allowed?: boolean;
};

export type PartnerSettingsSection = {
  key: string;
  title: string;
  description: string;
  features: PartnerFeature[];
};

export const normalizePartnerRole = (
  role?: string | null,
  fallback: PartnerRole = 'member',
): PartnerRole => {
  switch ((role ?? '').toLowerCase()) {
    case 'owner':
      return 'owner';
    case 'admin':
    case 'administrator':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'analyst':
      return 'analyst';
    case 'member':
    default:
      return fallback;
  }
};

export const canAccessFeature = (role: PartnerRole, feature: PartnerFeature) =>
  feature.access.includes(role);

const admins = ['owner', 'admin'] as PartnerRole[];
const managers = ['owner', 'admin', 'manager'] as PartnerRole[];
const analysts = ['owner', 'admin', 'manager', 'analyst'] as PartnerRole[];

export const PARTNER_SETTINGS_SECTIONS: PartnerSettingsSection[] = [
  {
    key: 'org_setup',
    title: 'Organization Setup',
    description: 'Structure, units, teams, and core settings.',
    features: [
      {
        key: 'org_profile',
        title: 'Organization Profile',
        description: 'Name, brand kit, mission statement, and public summary.',
        access: admins,
      },
      {
        key: 'units_departments',
        title: 'Departments & Units',
        description: 'Create and manage departments, regions, and divisions.',
        access: managers,
      },
      {
        key: 'org_locations',
        title: 'Locations & Branches',
        description: 'Add offices/branches and assign leaders.',
        access: managers,
      },
      {
        key: 'org_policies',
        title: 'Policies & Guidelines',
        description: 'Publish internal policies, conduct rules, and onboarding.',
        access: admins,
      },
      {
        key: 'org_integrations',
        title: 'Integrations',
        description: 'Connect external tools and data sources.',
        access: admins,
      },
    ],
  },
  {
    key: 'organization_apps',
    title: 'Organization Apps',
    description: 'Manage the KIS, Bible, and external apps for your organization.',
    features: [
      {
        key: 'org_apps_catalog',
        title: 'App catalog',
        description: 'List and launch organization-specific apps.',
        access: admins,
      },
      {
        key: 'org_apps_bible',
        title: 'Bible app',
        description: 'Bible experience maintained by KCAN for partner accounts.',
        access: admins,
      },
    ],
  },
  {
    key: 'community_ops',
    title: 'Communities, Groups & Channels',
    description: 'Create spaces and set posting rules.',
    features: [
      {
        key: 'create_community',
        title: 'Create Community',
        description: 'Open new communities under this partner.',
        access: managers,
      },
      {
        key: 'create_group',
        title: 'Create Group',
        description: 'Create member groups with sub-groups.',
        access: managers,
      },
      {
        key: 'create_channel',
        title: 'Create Channel',
        description: 'Launch broadcast or topic channels.',
        access: managers,
      },
      {
        key: 'content_rules',
        title: 'Posting Policies',
        description: 'Who can post, approval flows, and moderation rules.',
        access: admins,
      },
      {
        key: 'membership_rules',
        title: 'Membership Rules',
        description: 'Join/leave rules, approvals, and thresholds.',
        access: managers,
      },
      {
        key: 'recruitment_pipeline',
        title: 'Recruitment Pipeline',
        description: 'Job posts, screening steps, and auto-assign onboarding.',
        access: admins,
      },
      {
        key: 'spaces_directory',
        title: 'Spaces Directory',
        description: 'Show/hide spaces in the directory.',
        access: admins,
      },
    ],
  },
  {
    key: 'learning_courses',
    title: 'Learning & Courses',
    description: 'Create Bible courses and partner training programs.',
    features: [
      {
        key: 'course_builder',
        title: 'Course Builder',
        description: 'Create structured courses with modules and lessons.',
        access: admins,
      },
      {
        key: 'lesson_library',
        title: 'Lesson Library',
        description: 'Manage lesson content, audio, and study prompts.',
        access: managers,
      },
      {
        key: 'course_pricing',
        title: 'Course Pricing',
        description: 'Set free vs paid access for partner courses.',
        access: admins,
      },
      {
        key: 'course_enrollments',
        title: 'Enrollments',
        description: 'Track member progress and completion.',
        access: managers,
      },
    ],
  },
  {
    key: 'permissions',
    title: 'Permissions & Admins',
    description: 'Roles, approvals, and access gates.',
    features: [
      {
        key: 'role_matrix',
        title: 'Role Matrix',
        description: 'Configure permissions per role and unit.',
        access: admins,
      },
      {
        key: 'assign_admins',
        title: 'Assign Admins',
        description: 'Set admins for communities, groups, and channels.',
        access: admins,
      },
      {
        key: 'approval_flows',
        title: 'Approval Flows',
        description: 'Post, join, and role change approvals.',
        access: admins,
      },
      {
        key: 'access_requests',
        title: 'Access Requests',
        description: 'Review and approve access requests.',
        access: managers,
      },
      {
        key: 'audit_log',
        title: 'Audit Log',
        description: 'See administrative actions and approvals.',
        access: analysts,
      },
      {
        key: 'member_blocks',
        title: 'Member Blocks',
        description: 'Block, restore, and review restrictions.',
        access: admins,
      },
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics & Insights',
    description: 'Business and community intelligence.',
    features: [
      { key: 'engagement_overview', title: 'Engagement Overview', description: 'Daily and weekly engagement summary.', access: analysts },
      { key: 'reaction_trends', title: 'Reaction Trends', description: 'Reactions by content type and period.', access: analysts },
      { key: 'top_contributors', title: 'Top Contributors', description: 'Most active members and teams.', access: analysts },
      { key: 'message_velocity', title: 'Message Velocity', description: 'Messages per hour/day with peaks.', access: analysts },
      { key: 'retention', title: 'Member Retention', description: 'Cohort retention and churn risks.', access: analysts },
      { key: 'growth_funnel', title: 'Growth Funnel', description: 'Join requests → approvals → active.', access: analysts },
      { key: 'content_performance', title: 'Content Performance', description: 'Posts that drive the most activity.', access: analysts },
      { key: 'channel_health', title: 'Channel Health', description: 'Channel activity and drops.', access: analysts },
      { key: 'community_heatmap', title: 'Community Heatmap', description: 'Where engagement is highest.', access: analysts },
      { key: 'campaign_tracking', title: 'Campaign Tracking', description: 'Track promotions and broadcasts.', access: analysts },
      { key: 'response_times', title: 'Response Times', description: 'Average response times per team.', access: analysts },
      { key: 'participation_depth', title: 'Participation Depth', description: 'Depth of conversations by topic.', access: analysts },
      { key: 'sentiment_snapshot', title: 'Sentiment Snapshot', description: 'Tag sentiment from reactions.', access: analysts },
      { key: 'event_uptake', title: 'Event Uptake', description: 'Participation for events and polls.', access: analysts },
      { key: 'resource_downloads', title: 'Resource Downloads', description: 'File and media usage insights.', access: analysts },
    ],
  },
  {
    key: 'leadership_tree',
    title: 'Leadership & Org Tree',
    description: 'Structure, leadership, and reporting lines.',
    features: [
      { key: 'org_tree_view', title: 'Org Tree View', description: 'Interactive org structure map.', access: managers },
      { key: 'leadership_roles', title: 'Leadership Roles', description: 'Define leadership roles by unit.', access: admins },
      { key: 'succession_plan', title: 'Succession Planning', description: 'Assign backups and succession.', access: admins },
      { key: 'team_health', title: 'Team Health', description: 'Pulse of each team unit.', access: analysts },
      { key: 'leadership_directory', title: 'Leadership Directory', description: 'Public leadership contact list.', access: managers },
      { key: 'mentorship_routes', title: 'Mentorship Routes', description: 'Assign mentors for teams.', access: managers },
      { key: 'skills_matrix', title: 'Skills Matrix', description: 'Skill coverage across teams.', access: analysts },
      { key: 'capacity_planning', title: 'Capacity Planning', description: 'Workload capacity per unit.', access: analysts },
      { key: 'role_alignment', title: 'Role Alignment', description: 'Role-to-team alignment checks.', access: managers },
      { key: 'org_announcements', title: 'Org Announcements', description: 'Leadership communications hub.', access: managers },
      { key: 'org_tree_notes', title: 'Org Tree Notes', description: 'Attach notes and rationale to org nodes.', access: managers },
      { key: 'role_requirements', title: 'Role Requirements', description: 'Define requirements and competencies per role.', access: admins },
      { key: 'onboarding_paths', title: 'Onboarding Paths', description: 'Role-based onboarding routes and mentors.', access: managers },
      { key: 'leadership_goals', title: 'Leadership Goals', description: 'Quarterly goals and scorecards by unit.', access: analysts },
      { key: 'cross_team_projects', title: 'Cross-team Projects', description: 'Track multi-team initiatives and owners.', access: managers },
      { key: 'reporting_lines', title: 'Reporting Lines', description: 'Edit reporting lines and dotted-line links.', access: admins },
      { key: 'span_of_control', title: 'Span of Control', description: 'Monitor team size per leader.', access: analysts },
      { key: 'diversity_dashboard', title: 'Diversity Dashboard', description: 'Representation and inclusion insights.', access: analysts },
      { key: 'conflict_resolution', title: 'Conflict Resolution', description: 'Escalations and mediation workflows.', access: admins },
      { key: 'leadership_scorecards', title: 'Leadership Scorecards', description: 'Performance snapshots per leader.', access: analysts },
    ],
  },
  {
    key: 'general_tools',
    title: 'General Tools',
    description: 'Operational tools for organizations.',
    features: [
      { key: 'task_boards', title: 'Task Boards', description: 'Boards for team initiatives.', access: managers },
      { key: 'resource_library', title: 'Resource Library', description: 'Store files and playbooks.', access: managers },
      { key: 'training_tracks', title: 'Training Tracks', description: 'Assign training modules.', access: managers },
      { key: 'events_calendar', title: 'Events Calendar', description: 'Org-wide event scheduling.', access: managers },
      { key: 'broadcast_center', title: 'Broadcast Center', description: 'Schedule broadcasts and updates.', access: managers },
      { key: 'support_inbox', title: 'Support Inbox', description: 'Manage member support tickets.', access: admins },
      { key: 'automation_rules', title: 'Automation Rules', description: 'Automate routine workflows.', access: admins },
      { key: 'templates', title: 'Templates', description: 'Saved templates for posts.', access: managers },
      { key: 'feedback_hub', title: 'Feedback Hub', description: 'Collect structured feedback.', access: analysts },
      { key: 'compliance_center', title: 'Compliance Center', description: 'Track policy acknowledgments.', access: admins },
      { key: 'surveys', title: 'Surveys', description: 'Run internal surveys and polls.', access: managers },
      { key: 'knowledge_base', title: 'Knowledge Base', description: 'Document SOPs and FAQs.', access: managers },
      { key: 'announcement_scheduler', title: 'Announcement Scheduler', description: 'Plan announcements by audience.', access: managers },
      { key: 'helpdesk', title: 'Helpdesk', description: 'Route support questions to teams.', access: admins },
      { key: 'budget_tracking', title: 'Budget Tracking', description: 'Track budgets by department.', access: admins },
      { key: 'volunteer_roster', title: 'Volunteer Roster', description: 'Schedule volunteers and shifts.', access: managers },
      { key: 'donation_tracking', title: 'Donation Tracking', description: 'Track donations and receipts.', access: admins },
      { key: 'security_center', title: 'Security Center', description: 'Security policies and incident logs.', access: admins },
      { key: 'data_exports', title: 'Data Exports', description: 'Export reports for audits.', access: admins },
      { key: 'workspace_branding', title: 'Workspace Branding', description: 'Theme and branding controls.', access: admins },
    ],
  },
  {
    key: 'kcni_complaints',
    title: 'Complaints & disputes',
    description: 'KCAN reviews service booking complaints and escrow releases.',
    features: [
      {
        key: 'complaints',
        title: 'Complaints',
        description: 'Review KCAN-managed booking disputes and resolve funds.',
        access: admins,
      },
    ],
  },
];
