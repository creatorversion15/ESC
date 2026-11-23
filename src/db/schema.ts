import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default('Engineering Student'),
  photoUrl: text('photo_url').default(''),
  phone: text('phone').default(''),
  college: text('college').default(''),
  city: text('city').default(''),
  state: text('state').default(''),
  branch: text('branch').default(''),
  academicYear: text('academic_year').default(''),
  technicalSkills: jsonb('technical_skills').$type<string[]>().notNull().default([]),
  nonTechnicalSkills: jsonb('non_technical_skills').$type<string[]>().notNull().default([]),
  customSkills: jsonb('custom_skills').$type<string[]>().notNull().default([]),
  interests: jsonb('interests').$type<string[]>().notNull().default([]),
  portfolioUrl: text('portfolio_url').default(''),
  githubUrl: text('github_url').default(''),
  linkedinUrl: text('linkedin_url').default(''),
  bio: text('bio').default(''),
  weeklyAvailability: text('weekly_availability').default(''),
  role: text('role').notNull().default('student'),
  membershipStatus: text('membership_status').notNull().default('unregistered'),
  escMemberId: text('esc_member_id'),
  accountStatus: text('account_status').notNull().default('active'),
  approvalDate: text('approval_date').default(''),
  approvedBy: text('approved_by').default(''),
  profilePhotoUrl: text('profile_photo_url').default(''),
  profilePhotoUpdatedAt: text('profile_photo_updated_at').default(''),
  memberCardGeneratedAt: text('member_card_generated_at').default(''),
  startupTeamId: text('startup_team_id').default(''),
  teamRole: text('team_role').default(''),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const applications = pgTable('applications', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  college: text('college').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  branch: text('branch').notNull(),
  academicYear: text('academic_year').notNull(),
  technicalSkills: jsonb('technical_skills').$type<string[]>().notNull().default([]),
  nonTechnicalSkills: jsonb('non_technical_skills').$type<string[]>().notNull().default([]),
  customSkills: jsonb('custom_skills').$type<string[]>().notNull().default([]),
  portfolioUrl: text('portfolio_url').default(''),
  githubUrl: text('github_url').default(''),
  linkedinUrl: text('linkedin_url').default(''),
  whyJoin: text('why_join').notNull(),
  startupInterests: jsonb('startup_interests').$type<string[]>().notNull().default([]),
  hasExistingIdea: boolean('has_existing_idea').notNull().default(false),
  existingIdeaSummary: text('existing_idea_summary').default(''),
  ideaAiAssisted: boolean('idea_ai_assisted').notNull().default(false),
  teamGoal: text('team_goal').notNull().default('build_team'),
  weeklyAvailability: text('weekly_availability').notNull(),
  termsAccepted: boolean('terms_accepted').notNull().default(false),
  termsAcceptedAt: text('terms_accepted_at').default(''),
  policyVersion: text('policy_version').default(''),
  status: text('status').notNull().default('submitted'),
  adminNotes: text('admin_notes').default(''),
  reviewedBy: text('reviewed_by').default(''),
  approvalDate: text('approval_date').default(''),
  approvedBy: text('approved_by').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ideas = pgTable('ideas', {
  id: text('id').primaryKey(),
  authorUid: text('author_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  title: text('title').notNull(),
  problemStatement: text('problem_statement').notNull(),
  targetAudience: text('target_audience').notNull().default(''),
  proposedSolution: text('proposed_solution').notNull(),
  industry: text('industry').notNull(),
  uniqueValueProposition: text('unique_value_proposition').notNull().default(''),
  stage: text('stage').notNull().default('idea'),
  demoUrl: text('demo_url').default(''),
  skillsRequired: jsonb('skills_required').$type<string[]>().notNull().default([]),
  teamRequirements: text('team_requirements').default(''),
  fundingRequirements: text('funding_requirements').default(''),
  isPublic: boolean('is_public').notNull().default(false),
  reviewStatus: text('review_status').notNull().default('under_review'),
  aiAssisted: boolean('ai_assisted').notNull().default(false),
  adminFeedback: text('admin_feedback').default(''),
  reviewedBy: text('reviewed_by').default(''),
  reviewedAt: text('reviewed_at').default(''),
  decisionHistory: jsonb('decision_history')
    .$type<{ status: string; feedback?: string; adminEmail: string; timestamp: string }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const problems = pgTable('problems', {
  id: text('id').primaryKey(),
  authorUid: text('author_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  industry: text('industry').notNull(),
  difficulty: text('difficulty').notNull().default('intermediate'),
  status: text('status').notNull().default('open'),
  skillsRequired: jsonb('skills_required').$type<string[]>().notNull().default([]),
  interestedUserIds: jsonb('interested_user_ids').$type<string[]>().notNull().default([]),
  interestCount: integer('interest_count').notNull().default(0),
  verifiedByAdmin: boolean('verified_by_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  leaderUid: text('leader_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  leaderName: text('leader_name').notNull(),
  leaderEmail: text('leader_email').default(''),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  objectives: jsonb('objectives').$type<string[]>().notNull().default([]),
  requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
  teamMemberIds: jsonb('team_member_ids').$type<string[]>().notNull().default([]),
  teamMembers: jsonb('team_members')
    .$type<{ id: string; name: string; role: string }[]>()
    .notNull()
    .default([]),
  status: text('status').notNull().default('recruiting'),
  demoUrl: text('demo_url').default(''),
  repoUrl: text('repo_url').default(''),
  milestones: jsonb('milestones')
    .$type<{ id: string; title: string; targetDate: string; completed: boolean }[]>()
    .notNull()
    .default([]),
  tasks: jsonb('tasks')
    .$type<{ id: string; title: string; assignee?: string; completed: boolean }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const challenges = pgTable('challenges', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  posterUrl: text('poster_url').default(''),
  eligibility: text('eligibility').notNull().default(''),
  requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
  participationType: text('participation_type').notNull().default('both'),
  minTeamSize: integer('min_team_size').notNull().default(1),
  maxTeamSize: integer('max_team_size').notNull().default(4),
  startDateTime: text('start_date_time').notNull().default(''),
  registrationDeadline: text('registration_deadline').notNull().default(''),
  submissionDeadline: text('submission_deadline').notNull().default(''),
  rules: text('rules').notNull().default(''),
  submissionInstructions: text('submission_instructions').notNull().default(''),
  requiredSubmissionFiles: jsonb('required_submission_files').$type<string[]>().notNull().default([]),
  prizeOrRewards: text('prize_or_rewards').notNull().default(''),
  certificateAvailable: boolean('certificate_available').notNull().default(true),
  contactInfo: text('contact_info').notNull().default(''),
  status: text('status').notNull().default('draft'),
  isPublished: boolean('is_published').notNull().default(false),
  registeredCount: integer('registered_count').notNull().default(0),
  submissionCount: integer('submission_count').notNull().default(0),
  createdBy: text('created_by').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const challengeRegistrations = pgTable('challenge_registrations', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  challengeTitle: text('challenge_title').notNull(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  college: text('college').default(''),
  branch: text('branch').default(''),
  participationMode: text('participation_mode').notNull().default('individual'),
  teamName: text('team_name').default(''),
  teamMembers: jsonb('team_members').$type<string[]>().notNull().default([]),
  skillsSummary: text('skills_summary').default(''),
  status: text('status').notNull().default('registered'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
});

export const challengeSubmissions = pgTable('challenge_submissions', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  challengeTitle: text('challenge_title').notNull(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  teamName: text('team_name').default(''),
  projectTitle: text('project_title').notNull(),
  summary: text('summary').notNull(),
  repoUrl: text('repo_url').default(''),
  demoVideoUrl: text('demo_video_url').default(''),
  deckOrDocUrl: text('deck_or_doc_url').default(''),
  deliverablesChecklist: jsonb('deliverables_checklist').$type<string[]>().notNull().default([]),
  notes: text('notes').default(''),
  reviewStatus: text('review_status').notNull().default('submitted'),
  score: integer('score'),
  reviewerFeedback: text('reviewer_feedback').default(''),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  posterUrl: text('poster_url').default(''),
  type: text('type').notNull().default('workshop'),
  date: text('date').notNull(),
  startDateTime: text('start_date_time').default(''),
  location: text('location').notNull(),
  meetingLink: text('meeting_link').default(''),
  registrationDeadline: text('registration_deadline').notNull().default(''),
  eligibility: text('eligibility').default(''),
  maxParticipants: integer('max_participants').notNull().default(100),
  registeredCount: integer('registered_count').notNull().default(0),
  instructions: text('instructions').default(''),
  contactInfo: text('contact_info').default(''),
  certificateAvailable: boolean('certificate_available').notNull().default(true),
  status: text('status').notNull().default('draft'),
  isPublished: boolean('is_published').notNull().default(false),
  prizes: text('prizes').default(''),
  schedule: text('schedule').default(''),
  createdBy: text('created_by').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventRegistrations = pgTable('event_registrations', {
  id: text('id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  eventTitle: text('event_title').notNull(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  college: text('college').default(''),
  phone: text('phone').default(''),
  notes: text('notes').default(''),
  status: text('status').notNull().default('confirmed'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
});

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull().default('grant'),
  organization: text('organization').notNull(),
  posterUrl: text('poster_url').default(''),
  description: text('description').notNull(),
  allocationOrStipend: text('allocation_or_stipend').notNull().default(''),
  eligibility: text('eligibility').notNull().default(''),
  requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
  locationOrMode: text('location_or_mode').notNull().default(''),
  applicationDeadline: text('application_deadline').notNull().default(''),
  applyInstructions: text('apply_instructions').notNull().default(''),
  externalApplyUrl: text('external_apply_url').default(''),
  contactInfo: text('contact_info').notNull().default(''),
  status: text('status').notNull().default('draft'),
  isPublished: boolean('is_published').notNull().default(false),
  applicationsCount: integer('applications_count').notNull().default(0),
  createdBy: text('created_by').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const opportunityApplications = pgTable('opportunity_applications', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id')
    .notNull()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  opportunityTitle: text('opportunity_title').notNull(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  college: text('college').default(''),
  branch: text('branch').default(''),
  portfolioUrl: text('portfolio_url').default(''),
  statement: text('statement').notNull(),
  status: text('status').notNull().default('submitted'),
  adminNotes: text('admin_notes').default(''),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
});

export const certificates = pgTable('certificates', {
  certId: text('cert_id').primaryKey(),
  studentUid: text('student_uid').notNull(),
  studentName: text('student_name').notNull(),
  studentEmail: text('student_email').notNull().default(''),
  certificateTitle: text('certificate_title').default(''),
  competitionName: text('competition_name').default(''),
  achievement: text('achievement').default(''),
  activityName: text('activity_name').notNull(),
  organization: text('organization').notNull().default('Engineering Startup Company (ESC)'),
  issueDate: text('issue_date').notNull(),
  authorizedSigner: text('authorized_signer').notNull(),
  authorizedSignerTitle: text('authorized_signer_title').notNull(),
  logoUrl: text('logo_url').default(''),
  signatureUrl: text('signature_url').default(''),
  templateStyle: text('template_style').default('charcoal_editorial'),
  verificationHash: text('verification_hash').notNull(),
  verificationUrl: text('verification_url').default(''),
  status: text('status').notNull().default('valid'),
  downloadedAt: text('downloaded_at'),
  downloadCount: integer('download_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  linkPath: text('link_path').default(''),
  linkLabel: text('link_label').default(''),
  isActive: boolean('is_active').notNull().default(true),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  adminUid: text('admin_uid').notNull(),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  details: text('details').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications),
  ideas: many(ideas),
  problems: many(problems),
  projects: many(projects),
  challengeRegistrations: many(challengeRegistrations),
  challengeSubmissions: many(challengeSubmissions),
  eventRegistrations: many(eventRegistrations),
  opportunityApplications: many(opportunityApplications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  applicant: one(users, {
    fields: [applications.userUid],
    references: [users.uid],
  }),
}));

export const ideasRelations = relations(ideas, ({ one }) => ({
  author: one(users, {
    fields: [ideas.authorUid],
    references: [users.uid],
  }),
}));

export const problemsRelations = relations(problems, ({ one }) => ({
  author: one(users, {
    fields: [problems.authorUid],
    references: [users.uid],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  leader: one(users, {
    fields: [projects.leaderUid],
    references: [users.uid],
  }),
}));

export const challengesRelations = relations(challenges, ({ many }) => ({
  registrations: many(challengeRegistrations),
  submissions: many(challengeSubmissions),
}));

export const challengeRegistrationsRelations = relations(challengeRegistrations, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeRegistrations.challengeId],
    references: [challenges.id],
  }),
  user: one(users, {
    fields: [challengeRegistrations.userUid],
    references: [users.uid],
  }),
}));

export const challengeSubmissionsRelations = relations(challengeSubmissions, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeSubmissions.challengeId],
    references: [challenges.id],
  }),
  user: one(users, {
    fields: [challengeSubmissions.userUid],
    references: [users.uid],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRegistrations.userUid],
    references: [users.uid],
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ many }) => ({
  applications: many(opportunityApplications),
}));

export const opportunityApplicationsRelations = relations(opportunityApplications, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityApplications.opportunityId],
    references: [opportunities.id],
  }),
  user: one(users, {
    fields: [opportunityApplications.userUid],
    references: [users.uid],
  }),
}));

export const siteSettings = pgTable('site_settings', {
  id: text('id').primaryKey(),
  heroBadgeText: text('hero_badge_text').notNull().default('Think. Engineer. Build. Launch.'),
  heroAnnouncement: text('hero_announcement').default(''),
  applicationsOpen: boolean('applications_open').notNull().default(true),
  applicationCycleLabel: text('application_cycle_label').notNull().default('Student-Led Engineering Ecosystem'),
  contactEmail: text('contact_email').notNull().default('contact@esc.community'),
  whatsappCommunityUrl: text('whatsapp_community_url').default('https://chat.whatsapp.com/J0zOXM0OvBbCRtKfin5tmS'),
  communityGuidelines: text('community_guidelines').default(''),
  upiId: text('upi_id').default('9420482152-2@ybl'),
  upiPayeeName: text('upi_payee_name').default('Engineering Startup Company (ESC)'),
  physicalCardPrice: integer('physical_card_price').notNull().default(151),
  updatedBy: text('updated_by').default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const startupTeams = pgTable('startup_teams', {
  id: text('id').primaryKey(),
  teamCode: text('team_code').notNull().unique(),
  name: text('name').notNull(),
  problemStatement: text('problem_statement').notNull(),
  proposedSolution: text('proposed_solution').notNull(),
  ideaDescription: text('idea_description').notNull(),
  domain: text('domain').notNull(),
  stage: text('stage').notNull().default('idea'),
  skillsRequired: jsonb('skills_required').$type<string[]>().notNull().default([]),
  expectedOutcome: text('expected_outcome').notNull().default(''),
  logoUrl: text('logo_url').default(''),
  supportingDocs: jsonb('supporting_docs').$type<{ name: string; url: string }[]>().notNull().default([]),
  leaderUid: text('leader_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  leaderName: text('leader_name').notNull(),
  status: text('status').notNull().default('recruiting'),
  isApproved: boolean('is_approved').notNull().default(false),
  maxMembers: integer('max_members').notNull().default(4),
  allowMultiTeamOverride: boolean('allow_multi_team_override').notNull().default(false),
  nextDeadline: text('next_deadline').default(''),
  progressPercent: integer('progress_percent').notNull().default(0),
  adminNotes: text('admin_notes').default(''),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const startupTeamMembers = pgTable(
  'startup_team_members',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => startupTeams.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    title: text('title').default(''),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('startup_team_members_team_user_uidx').on(table.teamId, table.userUid)]
);

export const teamInvitations = pgTable('team_invitations', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => startupTeams.id, { onDelete: 'cascade' }),
  teamName: text('team_name').notNull(),
  inviterUid: text('inviter_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  inviterName: text('inviter_name').notNull(),
  inviteeUid: text('invitee_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  inviteeName: text('invitee_name').notNull(),
  inviteeEmail: text('invitee_email').notNull(),
  message: text('message').default(''),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});

export const teamMessages = pgTable('team_messages', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => startupTeams.id, { onDelete: 'cascade' }),
  senderUid: text('sender_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role').notNull().default('member'),
  content: text('content').notNull(),
  attachmentName: text('attachment_name').default(''),
  attachmentUrl: text('attachment_url').default(''),
  readBy: jsonb('read_by').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  teamId: text('team_id')
    .notNull()
    .references(() => startupTeams.id, { onDelete: 'cascade' }),
  assignedToUid: text('assigned_to_uid').default(''),
  assignedToName: text('assigned_to_name').default(''),
  priority: text('priority').notNull().default('medium'),
  startDate: text('start_date').default(''),
  deadline: text('deadline').notNull(),
  expectedDeliverable: text('expected_deliverable').default(''),
  instructions: text('instructions').default(''),
  supportingFiles: jsonb('supporting_files').$type<{ name: string; url: string }[]>().notNull().default([]),
  status: text('status').notNull().default('not_started'),
  submissionNotes: text('submission_notes').default(''),
  submissionUrl: text('submission_url').default(''),
  submissionFiles: jsonb('submission_files').$type<{ name: string; url: string }[]>().notNull().default([]),
  adminFeedback: text('admin_feedback').default(''),
  createdBy: text('created_by').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectMilestones = pgTable('project_milestones', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => startupTeams.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('upcoming'),
  progressPercent: integer('progress_percent').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const progressReports = pgTable('progress_reports', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => startupTeams.id, { onDelete: 'cascade' }),
  authorUid: text('author_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  summary: text('summary').notNull(),
  accomplishments: text('accomplishments').notNull(),
  blockers: text('blockers').default(''),
  nextSteps: text('next_steps').default(''),
  progressPercent: integer('progress_percent').notNull().default(0),
  attachments: jsonb('attachments').$type<{ name: string; url: string }[]>().notNull().default([]),
  adminReviewNotes: text('admin_review_notes').default(''),
  reviewedBy: text('reviewed_by').default(''),
  status: text('status').notNull().default('submitted'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientType: text('recipient_type').notNull().default('user'),
  recipientUid: text('recipient_uid').default(''),
  title: text('title').notNull(),
  description: text('description').notNull(),
  senderName: text('sender_name').default('ESC System'),
  type: text('type').notNull().default('system'),
  relatedMemberUid: text('related_member_uid').default(''),
  relatedTeamId: text('related_team_id').default(''),
  linkTab: text('link_tab').default(''),
  dedupeKey: text('dedupe_key').unique(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorName: text('actor_name').notNull(),
  memberUid: text('member_uid').default(''),
  teamId: text('team_id').default(''),
  activityType: text('activity_type').notNull(),
  title: text('title').notNull(),
  details: text('details').notNull(),
  status: text('status').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const startupTeamsRelations = relations(startupTeams, ({ one, many }) => ({
  leader: one(users, {
    fields: [startupTeams.leaderUid],
    references: [users.uid],
  }),
  members: many(startupTeamMembers),
  invitations: many(teamInvitations),
  messages: many(teamMessages),
  tasks: many(tasks),
  milestones: many(projectMilestones),
  reports: many(progressReports),
}));

export const startupTeamMembersRelations = relations(startupTeamMembers, ({ one }) => ({
  team: one(startupTeams, {
    fields: [startupTeamMembers.teamId],
    references: [startupTeams.id],
  }),
  user: one(users, {
    fields: [startupTeamMembers.userUid],
    references: [users.uid],
  }),
}));

export const customSkills = pgTable('custom_skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  skillType: text('skill_type').notNull().default('technical'),
  category: text('category').notNull().default('Other Engineering Skills'),
  status: text('status').notNull().default('pending'),
  mergedInto: text('merged_into').default(''),
  submittedByUid: text('submitted_by_uid').default(''),
  submittedByName: text('submitted_by_name').default(''),
  usageCount: integer('usage_count').notNull().default(1),
  reviewedBy: text('reviewed_by').default(''),
  reviewedAt: text('reviewed_at').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  team: one(startupTeams, {
    fields: [tasks.teamId],
    references: [startupTeams.id],
  }),
}));

export const supportTickets = pgTable('support_tickets', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().unique(),
  idempotencyKey: text('idempotency_key').unique(),
  userUid: text('user_uid').default(''),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  category: text('category').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  attachmentName: text('attachment_name').default(''),
  attachmentType: text('attachment_type').default(''),
  attachmentDataUrl: text('attachment_data_url').default(''),
  status: text('status').notNull().default('new'),
  adminNotes: text('admin_notes').default(''),
  statusHistory: jsonb('status_history')
    .$type<{ status: string; changedBy: string; note?: string; timestamp: string }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* --------------------------------------------------------------------------
 * ESC PROBLEM EXCHANGE TABLES (1,000+ Real-World Problems, Saves, Solvers, Reports)
 * -------------------------------------------------------------------------- */

export const exchangeProblems = pgTable(
  'exchange_problems',
  {
    id: text('id').primaryKey(),
    problemCode: text('problem_code').notNull().unique(),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    industry: text('industry').notNull(),
    affectedUsers: text('affected_users').notNull(),
    realWorldContext: text('real_world_context').notNull(),
    currentChallenges: text('current_challenges').notNull(),
    currentWorkarounds: text('current_workarounds').notNull().default(''),
    whyItMatters: text('why_it_matters').notNull(),
    potentialImpact: text('potential_impact').notNull(),
    impactLevel: text('impact_level').notNull().default('high'),
    difficulty: text('difficulty').notNull().default('intermediate'),
    skillsRequired: jsonb('skills_required').$type<string[]>().notNull().default([]),
    location: text('location').notNull().default('Pan-India'),
    developmentOpportunities: text('development_opportunities').notNull().default(''),
    suggestedResearchQuestions: jsonb('suggested_research_questions').$type<string[]>().notNull().default([]),
    evidenceLinks: jsonb('evidence_links').$type<string[]>().notNull().default([]),
    attachmentName: text('attachment_name').default(''),
    attachmentType: text('attachment_type').default(''),
    attachmentDataUrl: text('attachment_data_url').default(''),
    scoreSeverity: integer('score_severity').notNull().default(70),
    scorePeopleAffected: integer('score_people_affected').notNull().default(70),
    scoreFrequency: integer('score_frequency').notNull().default(70),
    scoreUrgency: integer('score_urgency').notNull().default(70),
    scorePotentialImpact: integer('score_potential_impact').notNull().default(70),
    scoreFeasibility: integer('score_feasibility').notNull().default(70),
    opportunityScore: integer('opportunity_score').notNull().default(70),
    publicationStatus: text('publication_status').notNull().default('published'),
    validationStatus: text('validation_status').notNull().default('research_needed'),
    isFeatured: boolean('is_featured').notNull().default(false),
    topTenRank: integer('top_ten_rank'),
    sourceType: text('source_type').notNull().default('esc_original'),
    viewsCount: integer('views_count').notNull().default(0),
    savesCount: integer('saves_count').notNull().default(0),
    solverInterestCount: integer('solver_interest_count').notNull().default(0),
    submittedByUid: text('submitted_by_uid').default(''),
    submittedByName: text('submitted_by_name').default('ESC Research Desk'),
    submittedByEmail: text('submitted_by_email').default(''),
    adminNotes: text('admin_notes').default(''),
    reviewedBy: text('reviewed_by').default(''),
    reviewedAt: text('reviewed_at').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_exchange_problems_pub_score').on(table.publicationStatus, table.opportunityScore),
    index('idx_exchange_problems_category').on(table.category),
    index('idx_exchange_problems_industry').on(table.industry),
    index('idx_exchange_problems_validation').on(table.validationStatus),
    index('idx_exchange_problems_topten').on(table.topTenRank),
    index('idx_exchange_problems_norm_title').on(table.normalizedTitle),
  ]
);

export const exchangeSavedProblems = pgTable(
  'exchange_saved_problems',
  {
    id: text('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    problemId: text('problem_id')
      .notNull()
      .references(() => exchangeProblems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uidx_exchange_saved_user_problem').on(table.userUid, table.problemId),
    index('idx_exchange_saved_user').on(table.userUid),
  ]
);

export const exchangeSolverInterests = pgTable(
  'exchange_solver_interests',
  {
    id: text('id').primaryKey(),
    problemId: text('problem_id')
      .notNull()
      .references(() => exchangeProblems.id, { onDelete: 'cascade' }),
    problemTitle: text('problem_title').notNull(),
    userUid: text('user_uid').notNull(),
    userName: text('user_name').notNull(),
    userEmail: text('user_email').notNull(),
    proposedApproach: text('proposed_approach').notNull(),
    skillsOffered: jsonb('skills_offered').$type<string[]>().notNull().default([]),
    lookingForTeammates: boolean('looking_for_teammates').notNull().default(true),
    neededRoles: text('needed_roles').default(''),
    teamPreference: text('team_preference').notNull().default('form_new_team'),
    linkedTeamId: text('linked_team_id').default(''),
    status: text('status').notNull().default('pending_review'),
    adminNotes: text('admin_notes').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uidx_exchange_solver_problem_user').on(table.problemId, table.userUid),
    index('idx_exchange_solver_user').on(table.userUid),
  ]
);

export const exchangeProblemReports = pgTable(
  'exchange_problem_reports',
  {
    id: text('id').primaryKey(),
    problemId: text('problem_id')
      .notNull()
      .references(() => exchangeProblems.id, { onDelete: 'cascade' }),
    problemTitle: text('problem_title').notNull(),
    reporterUid: text('reporter_uid').default(''),
    reporterName: text('reporter_name').notNull(),
    reporterEmail: text('reporter_email').default(''),
    reason: text('reason').notNull().default('inaccurate'),
    details: text('details').notNull(),
    duplicateOfId: text('duplicate_of_id').default(''),
    status: text('status').notNull().default('open'),
    adminNotes: text('admin_notes').default(''),
    resolvedBy: text('resolved_by').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_exchange_reports_status').on(table.status),
    index('idx_exchange_reports_problem').on(table.problemId),
  ]
);

/* --------------------------------------------------------------------------
 * PHYSICAL ESC MEMBER CARD ORDERS (HOME DELIVERY ACROSS INDIA)
 * -------------------------------------------------------------------------- */

export const memberCardOrders = pgTable(
  'member_card_orders',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull().unique(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    escMemberId: text('esc_member_id').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    mobileNumber: text('mobile_number').notNull(),
    college: text('college').notNull(),
    branch: text('branch').notNull(),
    academicYear: text('academic_year').notNull(),
    profilePhotoUrl: text('profile_photo_url').notNull(),
    addressLine1: text('address_line_1').notNull(),
    streetArea: text('street_area').notNull(),
    cityVillage: text('city_village').notNull(),
    district: text('district').notNull(),
    state: text('state').notNull(),
    pinCode: text('pin_code').notNull(),
    amountInr: integer('amount_inr').notNull().default(151),
    upiIdUsed: text('upi_id_used').notNull(),
    transactionId: text('transaction_id').notNull(),
    paymentScreenshotUrl: text('payment_screenshot_url').notNull(),
    paymentConfirmedByMember: boolean('payment_confirmed_by_member').notNull().default(false),
    paymentStatus: text('payment_status').notNull().default('pending_verification'),
    orderStatus: text('order_status').notNull().default('order_received'),
    courierCompany: text('courier_company').default(''),
    trackingNumber: text('tracking_number').default(''),
    dispatchDate: text('dispatch_date').default(''),
    deliveredDate: text('delivered_date').default(''),
    adminNotes: text('admin_notes').default(''),
    verifiedBy: text('verified_by').default(''),
    verifiedAt: text('verified_at').default(''),
    statusHistory: jsonb('status_history')
      .$type<
        {
          orderStatus: string;
          paymentStatus: string;
          changedBy: string;
          note?: string;
          timestamp: string;
        }[]
      >()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_member_card_orders_user').on(table.userUid),
    index('idx_member_card_orders_status').on(table.orderStatus),
    index('idx_member_card_orders_payment').on(table.paymentStatus),
    index('idx_member_card_orders_member_id').on(table.escMemberId),
  ]
);




