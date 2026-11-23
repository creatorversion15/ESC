export type UserRole = 
  | 'visitor'
  | 'student' 
  | 'member' 
  | 'project_lead'
  | 'lead' 
  | 'mentor' 
  | 'reviewer' 
  | 'admin' 
  | 'superadmin';

export type MembershipStatus = 
  | 'unregistered'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'approved'
  | 'rejected'
  | 'more_info_required';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'expired';

export type MemberVerificationStatus =
  | 'Active'
  | 'Inactive'
  | 'Suspended'
  | 'Expired'
  | 'Invalid Member ID';

export interface MemberVerificationResult {
  found: boolean;
  status: MemberVerificationStatus;
  escMemberId: string;
  fullName?: string;
  designation?: string;
  college?: string;
  branch?: string;
  academicYear?: string;
  approvalDate?: string;
  profilePhotoUrl?: string;
  memberCardGeneratedAt?: string;
  message: string;
}

export interface UserProfile {
  id?: string;
  userId: string;
  fullName: string;
  email: string;
  photoURL?: string;
  profilePhotoUrl?: string;
  profilePhotoUpdatedAt?: string;
  memberCardGeneratedAt?: string;
  phone?: string;
  college?: string;
  city?: string;
  state?: string;
  branch?: string;
  academicYear?: string;
  technicalSkills?: string[];
  nonTechnicalSkills?: string[];
  customSkills?: string[];
  interests?: string[];
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  bio?: string;
  weeklyAvailability?: string;
  role: UserRole;
  membershipStatus: MembershipStatus;
  escMemberId?: string;
  accountStatus?: AccountStatus;
  approvalDate?: string;
  approvedBy?: string;
  lastActiveAt?: string;
  startupTeamId?: string;
  teamRole?: 'leader' | 'member' | '';
  createdAt: string;
  lastLoginAt?: string;
  updatedAt: string;
}

export interface ServerAuthVerification {
  verified: boolean;
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isProjectLead: boolean;
  escMemberId?: string;
  accountStatus?: AccountStatus;
  membershipStatus?: MembershipStatus;
  permissions: {
    canManageAllUsers: boolean;
    canChangeAdminRoles: boolean;
    canManageSiteSettings: boolean;
    canManageApplications: boolean;
    canManageContent: boolean;
    canManageChallenges: boolean;
    canManageEvents: boolean;
    canManageOpportunities: boolean;
    canManageCertificates: boolean;
    canManageAssignedProjects: boolean;
  };
}

export interface Announcement {
  id?: string;
  title: string;
  message: string;
  type: 'info' | 'event' | 'deadline' | 'highlight';
  linkPath?: string;
  linkLabel?: string;
  isActive: boolean;
  isPinned: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  id?: string;
  heroBadgeText: string;
  heroAnnouncement: string;
  applicationsOpen: boolean;
  applicationCycleLabel: string;
  contactEmail: string;
  whatsappCommunityUrl?: string;
  communityGuidelines?: string;
  upiId?: string;
  upiPayeeName?: string;
  physicalCardPrice?: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface UserNotification {
  id?: string;
  recipientId: string;
  senderName: string;
  title?: string;
  message: string;
  type?: 'application' | 'idea' | 'event' | 'system';
  read?: boolean;
  createdAt: string;
}

export interface Application {
  id?: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  college: string;
  city: string;
  state: string;
  branch: string;
  academicYear: string;
  technicalSkills: string[];
  nonTechnicalSkills: string[];
  customSkills?: string[];
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  whyJoin: string;
  startupInterests: string[];
  hasExistingIdea: boolean;
  existingIdeaSummary?: string;
  ideaAiAssisted?: boolean;
  teamGoal: 'build_team' | 'join_team' | 'existing_idea' | 'open_to_both';
  weeklyAvailability: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  policyVersion?: string;
  status: MembershipStatus;
  adminNotes?: string;
  reviewedBy?: string;
  approvalDate?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActiveTeamGoal = 'build_team' | 'join_team' | 'existing_idea';

export type StartupStage = 'idea' | 'research' | 'prototype' | 'mvp' | 'launched';
export type ReviewStatus =
  | 'under_review'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface IdeaDecisionRecord {
  status: ReviewStatus;
  feedback?: string;
  adminEmail: string;
  timestamp: string;
}

export interface StartupIdea {
  id?: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  proposedSolution: string;
  industry: string;
  uniqueValueProposition: string;
  stage: StartupStage;
  demoUrl?: string;
  skillsRequired: string[];
  teamRequirements?: string;
  fundingRequirements?: string;
  isPublic: boolean;
  authorId: string;
  authorName: string;
  authorEmail: string;
  reviewStatus: ReviewStatus;
  aiAssisted?: boolean;
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionHistory?: IdeaDecisionRecord[];
  createdAt: string;
  updatedAt: string;
}

export type CustomSkillStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export interface CustomSkillRecord {
  id: string;
  name: string;
  normalizedName: string;
  skillType: 'technical' | 'non_technical';
  category: string;
  status: CustomSkillStatus;
  mergedInto?: string;
  submittedByUid?: string;
  submittedByName?: string;
  usageCount: number;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProblemDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ProblemStatus = 'open' | 'team_formation' | 'in_progress' | 'solved' | 'archived';

export interface ProblemStatement {
  id?: string;
  title: string;
  description: string;
  industry: string;
  difficulty: ProblemDifficulty;
  status: ProblemStatus;
  skillsRequired: string[];
  interestCount: number;
  interestedUserIds: string[];
  authorId: string;
  authorName: string;
  verifiedByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'recruiting'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'rejected';

export interface ProjectTask {
  id: string;
  title: string;
  assignee?: string;
  completed: boolean;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface Project {
  id?: string;
  title: string;
  description: string;
  category: string;
  problemStatement?: string;
  proposedSolution?: string;
  stage?: StartupStage;
  leaderId: string;
  leaderName: string;
  leaderEmail?: string;
  objectives: string[];
  requiredSkills: string[];
  teamMemberIds: string[];
  teamMembers?: { id: string; name: string; role: string }[];
  status: ProjectStatus;
  demoUrl?: string;
  repoUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  imageUrl?: string;
  needsMentorship?: boolean;
  adminFeedback?: string;
  milestones?: ProjectMilestone[];
  tasks?: ProjectTask[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectApplication {
  id?: string;
  projectId: string;
  projectTitle: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  roleDesired: string;
  pitch: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type ChallengeStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'registration_closed'
  | 'completed'
  | 'archived';

export type ChallengeParticipationType = 'individual' | 'team' | 'both';

export interface ChallengeItem {
  id?: string;
  title: string;
  description: string;
  category: string;
  posterUrl?: string;
  eligibility: string;
  requiredSkills: string[];
  participationType: ChallengeParticipationType;
  minTeamSize: number;
  maxTeamSize: number;
  startDateTime: string;
  registrationDeadline: string;
  submissionDeadline: string;
  rules: string;
  submissionInstructions: string;
  requiredSubmissionFiles: string[];
  prizeOrRewards: string;
  certificateAvailable: boolean;
  contactInfo: string;
  status: ChallengeStatus;
  isPublished: boolean;
  registeredCount: number;
  submissionCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeRegistration {
  id?: string;
  challengeId: string;
  challengeTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  college?: string;
  branch?: string;
  participationMode: 'individual' | 'team';
  teamName?: string;
  teamMembers?: string[];
  skillsSummary?: string;
  status: 'registered' | 'submitted' | 'shortlisted' | 'winner' | 'disqualified';
  registeredAt: string;
}

export interface ChallengeSubmission {
  id?: string;
  challengeId: string;
  challengeTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  teamName?: string;
  projectTitle: string;
  summary: string;
  repoUrl?: string;
  demoVideoUrl?: string;
  deckOrDocUrl?: string;
  deliverablesChecklist?: string[];
  notes?: string;
  reviewStatus: 'submitted' | 'under_review' | 'needs_revision' | 'accepted' | 'winner';
  score?: number;
  reviewerFeedback?: string;
  submittedAt: string;
  updatedAt: string;
}

export type EventType =
  | 'buildathon'
  | 'workshop'
  | 'competition'
  | 'challenge'
  | 'seminar'
  | 'mentorship'
  | 'networking';

export type EventStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'registration_closed'
  | 'completed'
  | 'archived';

export interface EventItem {
  id?: string;
  title: string;
  description: string;
  posterUrl?: string;
  type: EventType;
  date: string;
  startDateTime?: string;
  location: string;
  meetingLink?: string;
  registrationDeadline: string;
  eligibility?: string;
  maxParticipants: number;
  registeredCount: number;
  instructions?: string;
  contactInfo?: string;
  certificateAvailable?: boolean;
  status?: EventStatus;
  isPublished: boolean;
  prizes?: string;
  schedule?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EventRegistration {
  id?: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  college?: string;
  phone?: string;
  notes?: string;
  status: 'confirmed' | 'waitlist' | 'attended' | 'cancelled';
  registeredAt: string;
}

export type OpportunityCategory =
  | 'grant'
  | 'internship'
  | 'fellowship'
  | 'lab_access'
  | 'mentorship'
  | 'ip_legal'
  | 'other';

export type OpportunityStatus = 'draft' | 'live' | 'closed' | 'archived';

export interface OpportunityItem {
  id?: string;
  title: string;
  category: OpportunityCategory;
  organization: string;
  posterUrl?: string;
  description: string;
  allocationOrStipend: string;
  eligibility: string;
  requiredSkills: string[];
  locationOrMode: string;
  applicationDeadline: string;
  applyInstructions: string;
  externalApplyUrl?: string;
  contactInfo: string;
  status: OpportunityStatus;
  isPublished: boolean;
  applicationsCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityApplication {
  id?: string;
  opportunityId: string;
  opportunityTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  college?: string;
  branch?: string;
  portfolioUrl?: string;
  statement: string;
  status: 'submitted' | 'under_review' | 'shortlisted' | 'approved' | 'rejected';
  adminNotes?: string;
  appliedAt: string;
}

export type CertificateTemplateStyle = 'charcoal_editorial' | 'obsidian_grid' | 'ivory_executive';

export interface CertificateSettings {
  id?: string;
  organizationName: string;
  issuerName: string;
  issuerDesignation: string;
  logoUrl: string;
  signatureUrl: string;
  backgroundTemplate: CertificateTemplateStyle;
  defaultCertificateTitle: string;
  defaultCompetitionName: string;
  defaultIssueDate: string;
  certIdFormat: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CertificateRecord {
  id?: string;
  certId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  certificateTitle?: string;
  competitionName?: string;
  achievement?: string;
  activityName: string;
  organization: string;
  issueDate: string;
  authorizedSigner: string;
  authorizedSignerTitle: string;
  logoUrl?: string;
  signatureUrl?: string;
  templateStyle?: CertificateTemplateStyle;
  verificationHash: string;
  verificationUrl?: string;
  status: 'valid' | 'revoked';
  downloadedAt?: string;
  downloadCount?: number;
  createdAt: string;
}

export interface AdminAuditLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export type MemberCategoryFilter =
  | 'all'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'rejected';

export type StartupTeamStatus =
  | 'draft'
  | 'recruiting'
  | 'team_formed'
  | 'under_admin_review'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'rejected';

export interface StartupTeamMember {
  id: string;
  teamId: string;
  userUid: string;
  role: 'leader' | 'member';
  title?: string;
  joinedAt: string;
  fullName?: string;
  email?: string;
  escMemberId?: string;
  college?: string;
  branch?: string;
  academicYear?: string;
  technicalSkills?: string[];
  accountStatus?: AccountStatus;
}

export interface StartupTeam {
  id: string;
  teamCode: string;
  name: string;
  problemStatement: string;
  proposedSolution: string;
  ideaDescription: string;
  domain: string;
  stage: StartupStage;
  skillsRequired: string[];
  expectedOutcome: string;
  logoUrl?: string;
  supportingDocs?: { name: string; url: string }[];
  leaderUid: string;
  leaderName: string;
  status: StartupTeamStatus;
  isApproved: boolean;
  maxMembers: number;
  allowMultiTeamOverride: boolean;
  nextDeadline?: string;
  progressPercent: number;
  adminNotes?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  members?: StartupTeamMember[];
  memberCount?: number;
}

export interface DirectoryStartupTeam {
  id: string;
  teamCode: string;
  name: string;
  problemStatement: string;
  proposedSolution: string;
  ideaDescription: string;
  domain: string;
  stage: StartupStage;
  skillsRequired: string[];
  expectedOutcome: string;
  leaderUid: string;
  leaderName: string;
  leaderCollege?: string;
  status: StartupTeamStatus;
  isApproved: boolean;
  maxMembers: number;
  memberCount: number;
  memberColleges?: string[];
  isCurrentUserMember?: boolean;
  userJoinRequestStatus?: 'pending' | 'accepted' | 'rejected' | 'cancelled' | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  inviterUid: string;
  inviterName: string;
  inviteeUid: string;
  inviteeName: string;
  inviteeEmail: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  respondedAt?: string;
}

export interface TeamMessage {
  id: string;
  teamId: string;
  senderUid: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachmentName?: string;
  attachmentUrl?: string;
  readBy: string[];
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted_for_review'
  | 'revision_required'
  | 'completed'
  | 'overdue';

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  teamId: string;
  teamName?: string;
  assignedToUid?: string;
  assignedToName?: string;
  priority: TaskPriority;
  startDate?: string;
  deadline: string;
  expectedDeliverable?: string;
  instructions?: string;
  supportingFiles?: { name: string; url: string }[];
  status: TaskStatus;
  submissionNotes?: string;
  submissionUrl?: string;
  submissionFiles?: { name: string; url: string }[];
  adminFeedback?: string;
  createdBy: string;
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMilestone {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  progressPercent: number;
  createdAt: string;
}

export interface ProgressReport {
  id: string;
  teamId: string;
  authorUid: string;
  authorName: string;
  summary: string;
  accomplishments: string;
  blockers?: string;
  nextSteps?: string;
  progressPercent: number;
  attachments?: { name: string; url: string }[];
  adminReviewNotes?: string;
  reviewedBy?: string;
  status: 'submitted' | 'reviewed' | 'needs_attention';
  createdAt: string;
  updatedAt: string;
}

export interface PlatformNotification {
  id: string;
  recipientType: 'user' | 'admin';
  recipientUid?: string;
  title: string;
  description: string;
  senderName?: string;
  type:
    | 'application_submitted'
    | 'application_under_review'
    | 'application_rejected'
    | 'member_approved'
    | 'team_created'
    | 'team_invite'
    | 'invite_accepted'
    | 'invite_rejected'
    | 'join_request'
    | 'join_request_accepted'
    | 'join_request_rejected'
    | 'project_submitted'
    | 'project_reviewed'
    | 'challenge_registered'
    | 'event_registered'
    | 'team_message'
    | 'task_assigned'
    | 'task_submitted'
    | 'task_reviewed'
    | 'deadline_reminder'
    | 'announcement'
    | 'admin_notice'
    | 'card_order_update'
    | 'system';
  relatedMemberUid?: string;
  relatedTeamId?: string;
  linkTab?: string;
  isRead: boolean;
  createdAt: string;
}

export interface MemberActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  memberUid?: string;
  teamId?: string;
  activityType: string;
  title: string;
  details: string;
  status?: string;
  createdAt: string;
}

export type SupportCategory =
  | 'Fellowship Application'
  | 'Startup / Project'
  | 'Website / Technical Issue'
  | 'College Collaboration'
  | 'General Enquiry'
  | 'Other';

export type SupportTicketStatus =
  | 'new'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface SupportStatusHistoryEntry {
  status: SupportTicketStatus;
  changedBy: string;
  note?: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketId: string;
  userUid?: string;
  fullName: string;
  email: string;
  category: SupportCategory;
  subject: string;
  description: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
  status: SupportTicketStatus;
  adminNotes?: string;
  statusHistory: SupportStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------------------------------------------------
 * ESC PROBLEM EXCHANGE TYPES
 * -------------------------------------------------------------------------- */

export type ExchangeProblemDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'deep_tech';
export type ExchangeProblemImpact = 'critical' | 'high' | 'medium';
export type ExchangePublicationStatus = 'published' | 'pending_review' | 'rejected' | 'archived';
export type ExchangeValidationStatus = 'research_needed' | 'under_validation' | 'validated';
export type ExchangeSourceType = 'esc_original' | 'member_submission' | 'csv_import';

export interface OpportunityScoreCriteria {
  severity: number;
  peopleAffected: number;
  frequency: number;
  urgency: number;
  potentialImpact: number;
  feasibility: number;
}

export interface ExchangeProblem {
  id: string;
  problemCode: string;
  title: string;
  description: string;
  category: string;
  industry: string;
  affectedUsers: string;
  realWorldContext: string;
  currentChallenges: string;
  currentWorkarounds: string;
  whyItMatters: string;
  potentialImpact: string;
  impactLevel: ExchangeProblemImpact;
  difficulty: ExchangeProblemDifficulty;
  skillsRequired: string[];
  location: string;
  developmentOpportunities: string;
  suggestedResearchQuestions: string[];
  evidenceLinks: string[];
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
  scoreCriteria: OpportunityScoreCriteria;
  opportunityScore: number;
  publicationStatus: ExchangePublicationStatus;
  validationStatus: ExchangeValidationStatus;
  isFeatured: boolean;
  topTenRank: number | null;
  sourceType: ExchangeSourceType;
  viewsCount: number;
  savesCount: number;
  solverInterestCount: number;
  submittedByUid?: string;
  submittedByName?: string;
  submittedByEmail?: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  isSaved?: boolean;
  userSolverStatus?: ExchangeSolverInterest['status'] | null;
}

export interface ExchangeSolverInterest {
  id: string;
  problemId: string;
  problemTitle: string;
  userUid: string;
  userName: string;
  userEmail: string;
  proposedApproach: string;
  skillsOffered: string[];
  lookingForTeammates: boolean;
  neededRoles?: string;
  teamPreference: 'solo' | 'form_new_team' | 'join_team';
  linkedTeamId?: string;
  status: 'pending_review' | 'under_review' | 'approved_for_team_formation' | 'declined';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeProblemReport {
  id: string;
  problemId: string;
  problemTitle: string;
  reporterUid?: string;
  reporterName: string;
  reporterEmail?: string;
  reason: 'duplicate' | 'inaccurate' | 'spam' | 'out_of_scope' | 'other';
  details: string;
  duplicateOfId?: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  adminNotes?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeOverviewResponse {
  totalPublished: number;
  totalCategories: number;
  categoryCounts: { category: string; count: number }[];
  featuredProblems: ExchangeProblem[];
  topTenProblems: ExchangeProblem[];
  facets: {
    industries: string[];
    locations: string[];
    skills: string[];
  };
}

export interface ExchangePaginatedResponse {
  items: ExchangeProblem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* --------------------------------------------------------------------------
 * PHYSICAL ESC MEMBER CARD ORDER TYPES
 * -------------------------------------------------------------------------- */

export type CardOrderPaymentStatus =
  | 'pending_verification'
  | 'verified'
  | 'rejected';

export type CardOrderStatus =
  | 'order_received'
  | 'payment_verification_pending'
  | 'payment_verified'
  | 'card_processing'
  | 'card_printed'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivered'
  | 'rejected';

export interface CardOrderStatusHistoryEntry {
  orderStatus: CardOrderStatus;
  paymentStatus: CardOrderPaymentStatus;
  changedBy: string;
  note?: string;
  timestamp: string;
}

export interface MemberCardOrder {
  id: string;
  orderId: string;
  userUid: string;
  escMemberId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  college: string;
  branch: string;
  academicYear: string;
  profilePhotoUrl: string;
  addressLine1: string;
  streetArea: string;
  cityVillage: string;
  district: string;
  state: string;
  pinCode: string;
  amountInr: number;
  upiIdUsed: string;
  transactionId: string;
  paymentScreenshotUrl: string;
  paymentConfirmedByMember: boolean;
  paymentStatus: CardOrderPaymentStatus;
  orderStatus: CardOrderStatus;
  courierCompany?: string;
  trackingNumber?: string;
  dispatchDate?: string;
  deliveredDate?: string;
  adminNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  statusHistory: CardOrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}



