import type {
  UserProfile,
  UserRole,
  Application,
  StartupIdea,
  Project,
  ChallengeItem,
  ChallengeRegistration,
  ChallengeSubmission,
  EventItem,
  EventRegistration,
  OpportunityItem,
  OpportunityApplication,
  CertificateRecord,
  CertificateSettings,
  CertificateTemplateStyle,
  AccountStatus,
  MemberCategoryFilter,
  StartupTeam,
  TeamTask,
  TaskStatus,
  ReviewStatus,
} from '../types/index.ts';
import {
  ALL_PREDEFINED_SKILLS,
  type FlattenedSkillEntry,
  type SkillKind,
} from '../data/skillsCatalog.ts';

/**
 * Core pure business logic, RBAC permission evaluators, profile merge & analytics helpers for ESC platform
 */

export interface ApplicationFormData {
  fullName: string;
  email?: string;
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
  teamGoal: 'build_team' | 'join_team' | 'existing_idea' | 'open_to_both' | '';
  weeklyAvailability: string;
  termsAccepted?: boolean;
}

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const VALID_ACTIVE_TEAM_GOALS = ['build_team', 'join_team', 'existing_idea'] as const;

export function isValidEmailAddress(email?: string): boolean {
  return typeof email === 'string' && BASIC_EMAIL_REGEX.test(email.trim());
}

export function validateApplicationStep(
  step: number,
  data: Partial<ApplicationFormData>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!data.fullName || data.fullName.trim().length < 2) {
      errors.fullName = 'Full Name is required (minimum 2 characters).';
    }
    if (data.email !== undefined) {
      if (!data.email || !isValidEmailAddress(data.email)) {
        errors.email = 'A valid Google Account Email is required.';
      }
    }
    if (!data.college || data.college.trim().length < 2) {
      errors.college = 'College or University name is required.';
    }
    if (!data.branch || data.branch.trim().length < 2) {
      errors.branch = 'Engineering Branch / Department is required.';
    }
    if (!data.academicYear || data.academicYear.trim().length === 0) {
      errors.academicYear = 'Academic Year is required.';
    }
    if (!data.city || data.city.trim().length < 2) {
      errors.city = 'City is required.';
    }
    if (!data.state || data.state.trim().length < 2) {
      errors.state = 'State is required.';
    }
  } else if (step === 2) {
    const techCount = Array.isArray(data.technicalSkills) ? data.technicalSkills.length : 0;
    const customCount = Array.isArray(data.customSkills) ? data.customSkills.length : 0;
    if (techCount + customCount === 0) {
      errors.technicalSkills = 'Please select or add at least one technical or engineering skill.';
    }
  } else if (step === 3) {
    if (!data.whyJoin || data.whyJoin.trim().length < 20) {
      errors.whyJoin = 'Please provide at least 20 characters explaining why you want to join ESC.';
    }
    if (!data.weeklyAvailability || data.weeklyAvailability.trim().length === 0) {
      errors.weeklyAvailability = 'Please select your weekly availability.';
    }
  } else if (step === 4) {
    const goal = data.teamGoal;
    if (!goal || !(VALID_ACTIVE_TEAM_GOALS as readonly string[]).includes(goal)) {
      errors.teamGoal = 'Please select your immediate goal in ESC.';
    }
    const needsIdeaSummary = Boolean(data.hasExistingIdea);
    if (needsIdeaSummary && (!data.existingIdeaSummary || data.existingIdeaSummary.trim().length < 15)) {
      errors.existingIdeaSummary =
        'Please complete and save your startup or product idea proposal (minimum 15 characters) or uncheck the idea proposal option.';
    }
    if (data.termsAccepted !== true) {
      errors.termsAccepted =
        'You must read and agree to the ESC Terms & Conditions and Privacy Policy before submitting.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateFullApplication(
  data: Partial<ApplicationFormData>
): { isValid: boolean; errors: Record<string, string>; firstInvalidStep: number | null } {
  const combinedErrors: Record<string, string> = {};
  let firstInvalidStep: number | null = null;

  for (const step of [1, 2, 3, 4]) {
    const res = validateApplicationStep(step, data);
    if (!res.isValid) {
      if (firstInvalidStep === null) firstInvalidStep = step;
      Object.assign(combinedErrors, res.errors);
    }
  }

  return {
    isValid: Object.keys(combinedErrors).length === 0,
    errors: combinedErrors,
    firstInvalidStep,
  };
}

export function calculateProfileCompletion(profile: Record<string, any>): number {
  const fields = [
    'fullName',
    'college',
    'branch',
    'academicYear',
    'technicalSkills',
    'portfolioUrl',
    'githubUrl',
    'linkedinUrl',
    'bio',
    'weeklyAvailability',
  ];

  let completed = 0;
  for (const field of fields) {
    const val = profile[field];
    if (Array.isArray(val) && val.length > 0) {
      completed++;
    } else if (typeof val === 'string' && val.trim().length > 0) {
      completed++;
    }
  }

  return Math.round((completed / fields.length) * 100);
}

export function generateCertificateHash(certId: string, studentId: string, issueDate: string): string {
  const combined = `${certId}:${studentId}:${issueDate}:ESC_VERIFIED_KEY`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ESC-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

export function filterStartupIdeas<T extends { title: string; industry: string; stage: string; problemStatement: string }>(
  ideas: T[],
  filters: { stage?: string; industry?: string; search?: string }
): T[] {
  return ideas.filter((idea) => {
    if (filters.stage && filters.stage !== 'all' && idea.stage !== filters.stage) {
      return false;
    }
    if (filters.industry && filters.industry !== 'all' && idea.industry.toLowerCase() !== filters.industry.toLowerCase()) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = idea.title.toLowerCase().includes(q);
      const matchProblem = idea.problemStatement.toLowerCase().includes(q);
      const matchIndustry = idea.industry.toLowerCase().includes(q);
      if (!matchTitle && !matchProblem && !matchIndustry) return false;
    }
    return true;
  });
}

export type PermissionAction =
  | 'manage_users'
  | 'change_admin_roles'
  | 'manage_applications'
  | 'manage_ideas'
  | 'manage_events'
  | 'manage_certificates'
  | 'manage_site_settings'
  | 'manage_announcements'
  | 'manage_assigned_projects'
  | 'view_admin_dashboard';

export function hasPermission(role: UserRole | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;

  if (role === 'superadmin') return true;

  if (role === 'admin') {
    return action !== 'change_admin_roles' && action !== 'manage_site_settings';
  }

  if (role === 'project_lead' || role === 'lead') {
    return action === 'manage_assigned_projects';
  }

  return false;
}

/**
 * Builds an update/create payload for `/users/{userId}` on login WITHOUT overwriting
 * existing student-provided profile fields (college, branch, skills, bio, createdAt, role).
 */
export function buildUserLoginUpsert(
  existingProfile: Partial<UserProfile> | null | undefined,
  authInfo: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
  verifiedIsSuperAdmin: boolean,
  nowIso: string = new Date().toISOString()
): { isNew: boolean; payload: Partial<UserProfile>; mergedProfile: UserProfile } {
  if (!existingProfile) {
    const created: UserProfile = {
      userId: authInfo.uid,
      fullName: authInfo.displayName || 'Engineering Student',
      email: authInfo.email || '',
      photoURL: authInfo.photoURL || '',
      college: '',
      branch: '',
      academicYear: '',
      technicalSkills: [],
      nonTechnicalSkills: [],
      customSkills: [],
      interests: [],
      portfolioUrl: '',
      githubUrl: '',
      linkedinUrl: '',
      bio: '',
      role: verifiedIsSuperAdmin ? 'superadmin' : 'student',
      membershipStatus: verifiedIsSuperAdmin ? 'approved' : 'unregistered',
      createdAt: nowIso,
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };
    return { isNew: true, payload: created, mergedProfile: created };
  }

  // Repeat login: NEVER overwrite college, branch, academicYear, skills, bio, createdAt, or custom fullName
  const patch: Partial<UserProfile> = {
    lastLoginAt: nowIso,
    updatedAt: nowIso,
  };

  if (!existingProfile.userId) patch.userId = authInfo.uid;
  if (!existingProfile.email && authInfo.email) patch.email = authInfo.email;
  if (!existingProfile.fullName && authInfo.displayName) patch.fullName = authInfo.displayName;
  if (authInfo.photoURL && authInfo.photoURL !== existingProfile.photoURL) {
    patch.photoURL = authInfo.photoURL;
  }

  if (verifiedIsSuperAdmin) {
    if (existingProfile.role !== 'superadmin') patch.role = 'superadmin';
    if (existingProfile.membershipStatus !== 'approved') patch.membershipStatus = 'approved';
  }

  const mergedProfile: UserProfile = {
    userId: existingProfile.userId || authInfo.uid,
    fullName: existingProfile.fullName || authInfo.displayName || 'Engineering Student',
    email: existingProfile.email || authInfo.email || '',
    photoURL: patch.photoURL ?? existingProfile.photoURL ?? '',
    profilePhotoUrl: existingProfile.profilePhotoUrl || '',
    profilePhotoUpdatedAt: existingProfile.profilePhotoUpdatedAt || '',
    memberCardGeneratedAt: existingProfile.memberCardGeneratedAt || '',
    phone: existingProfile.phone,
    college: existingProfile.college,
    city: existingProfile.city,
    state: existingProfile.state,
    branch: existingProfile.branch,
    academicYear: existingProfile.academicYear,
    technicalSkills: existingProfile.technicalSkills || [],
    nonTechnicalSkills: existingProfile.nonTechnicalSkills || [],
    customSkills: existingProfile.customSkills || [],
    interests: existingProfile.interests || [],
    portfolioUrl: existingProfile.portfolioUrl,
    githubUrl: existingProfile.githubUrl,
    linkedinUrl: existingProfile.linkedinUrl,
    bio: existingProfile.bio,
    weeklyAvailability: existingProfile.weeklyAvailability,
    role: (patch.role || existingProfile.role || 'student') as UserRole,
    membershipStatus: patch.membershipStatus || existingProfile.membershipStatus || 'unregistered',
    escMemberId: existingProfile.escMemberId,
    accountStatus: existingProfile.accountStatus || 'active',
    approvalDate: existingProfile.approvalDate,
    approvedBy: existingProfile.approvedBy,
    lastActiveAt: nowIso,
    startupTeamId: existingProfile.startupTeamId,
    teamRole: existingProfile.teamRole,
    createdAt: existingProfile.createdAt || nowIso,
    lastLoginAt: nowIso,
    updatedAt: nowIso,
  };

  return { isNew: false, payload: patch, mergedProfile };
}

/**
 * Strips privileged and immutable fields before a user saves their own profile.
 */
export function sanitizeUserProfileUpdate(patch: Partial<UserProfile>): Partial<UserProfile> {
  const {
    role: _role,
    membershipStatus: _status,
    userId: _uid,
    id: _id,
    createdAt: _createdAt,
    escMemberId: _escMemberId,
    accountStatus: _accountStatus,
    approvalDate: _approvalDate,
    approvedBy: _approvedBy,
    memberCardGeneratedAt: _memberCardGeneratedAt,
    startupTeamId: _startupTeamId,
    teamRole: _teamRole,
    ...safeFields
  } = patch;
  return safeFields;
}

export interface AdminMetricsSummary {
  totalUsers: number;
  newRegistrations7d: number;
  newRegistrations30d: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalIdeas: number;
  totalActiveProjects: number;
  totalEvents: number;
  totalCertificates: number;
  applicationStatusBreakdown: { key: string; label: string; count: number }[];
  branchDistribution: { branch: string; count: number }[];
  registrationTrend7d: { date: string; label: string; users: number; applications: number }[];
}

export function computeAdminMetrics(
  input: {
    users: UserProfile[];
    applications: Application[];
    ideas: StartupIdea[];
    projects: Project[];
    events: EventItem[];
    certificates: CertificateRecord[];
  },
  referenceNow: Date = new Date()
): AdminMetricsSummary {
  const msDay = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = referenceNow.getTime() - 7 * msDay;
  const thirtyDaysAgo = referenceNow.getTime() - 30 * msDay;

  const newRegistrations7d = input.users.filter((u) => {
    const t = Date.parse(u.createdAt || '');
    return !Number.isNaN(t) && t >= sevenDaysAgo;
  }).length;

  const newRegistrations30d = input.users.filter((u) => {
    const t = Date.parse(u.createdAt || '');
    return !Number.isNaN(t) && t >= thirtyDaysAgo;
  }).length;

  const pendingStatuses = new Set(['submitted', 'under_review', 'shortlisted', 'more_info_required']);
  const pendingApplications = input.applications.filter((a) => pendingStatuses.has(a.status)).length;
  const approvedApplications = input.applications.filter((a) => a.status === 'approved').length;
  const rejectedApplications = input.applications.filter((a) => a.status === 'rejected').length;

  const totalActiveProjects = input.projects.filter(
    (p) => p.status === 'recruiting' || p.status === 'in_progress' || p.status === 'review'
  ).length;

  const statusDefs = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'more_info_required', label: 'More Info' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const applicationStatusBreakdown = statusDefs.map((s) => ({
    ...s,
    count: input.applications.filter((a) => a.status === s.key).length,
  }));

  // Branch breakdown across users + applications
  const branchCounts = new Map<string, number>();
  for (const u of input.users) {
    const b = (u.branch || '').trim();
    if (b) {
      branchCounts.set(b, (branchCounts.get(b) || 0) + 1);
    }
  }
  const branchDistribution = Array.from(branchCounts.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 7-day trend buckets
  const registrationTrend7d: { date: string; label: string; users: number; applications: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceNow.getTime() - i * msDay);
    const isoDay = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const usersCount = input.users.filter((u) => (u.createdAt || '').slice(0, 10) === isoDay).length;
    const appsCount = input.applications.filter((a) => (a.createdAt || '').slice(0, 10) === isoDay).length;
    registrationTrend7d.push({ date: isoDay, label, users: usersCount, applications: appsCount });
  }

  return {
    totalUsers: input.users.length,
    newRegistrations7d,
    newRegistrations30d,
    totalApplications: input.applications.length,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    totalIdeas: input.ideas.length,
    totalActiveProjects,
    totalEvents: input.events.length,
    totalCertificates: input.certificates.length,
    applicationStatusBreakdown,
    branchDistribution,
    registrationTrend7d,
  };
}

export function exportToCSV(data: Record<string, any>[], fields: { key: string; label: string }[]): string {
  if (!data || data.length === 0) return '';
  const header = fields.map((f) => `"${f.label.replace(/"/g, '""')}"`).join(',');
  const rows = data.map((item) =>
    fields
      .map((f) => {
        let val = item[f.key];
        if (Array.isArray(val)) {
          val = val.join('; ');
        } else if (val === null || val === undefined) {
          val = '';
        } else {
          val = String(val);
        }
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [header, ...rows].join('\n');
}

export const DEFAULT_CERTIFICATE_LOGO = '/assets/aistudio/IMG_20261112_135951_2ec3259f.png';

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  id: 'default',
  organizationName: 'Engineering Startup Company (ESC)',
  issuerName: 'ESC Founding Committee',
  issuerDesignation: 'Founder, Engineering Startup Company',
  logoUrl: DEFAULT_CERTIFICATE_LOGO,
  signatureUrl: '',
  backgroundTemplate: 'charcoal_editorial',
  defaultCertificateTitle: 'Certificate of Engineering Excellence',
  defaultCompetitionName: 'ESC DeepTech Innovation & Buildathon Program',
  defaultIssueDate: '',
  certIdFormat: 'ESC-{YYYY}-{XXXX}',
  updatedAt: '',
};

/**
 * Generates a clean, cross-OS safe PDF filename containing the participant's name.
 * Example: "Viraj Bansod" -> "ESC_Certificate_Viraj_Bansod.pdf"
 */
export function sanitizeCertificateFilename(studentName: string, fallbackCertId?: string): string {
  const cleaned = (studentName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const suffix = cleaned || (fallbackCertId ? fallbackCertId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Participant');
  return `ESC_Certificate_${suffix}.pdf`;
}

/**
 * Generates a unique formatted Certificate ID honoring template tokens:
 * {YYYY}, {YY}, {XXXX} (4 random alphanumeric), {SEQ} (001-padded).
 */
export function formatCertificateId(
  formatTemplate: string = 'ESC-{YYYY}-{XXXX}',
  year: number = new Date().getFullYear(),
  existingIds?: Set<string>,
  seqNumber: number = 1
): string {
  const template = (formatTemplate || 'ESC-{YYYY}-{XXXX}').trim().toUpperCase();
  const yy = String(year).slice(-2);
  const yyyy = String(year);
  const seqStr = String(Math.max(1, seqNumber)).padStart(3, '0');

  for (let attempt = 0; attempt < 25; attempt++) {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    let candidate = template
      .replace(/\{YYYY\}/g, yyyy)
      .replace(/\{YY\}/g, yy)
      .replace(/\{XXXX\}/g, String(randNum))
      .replace(/\{SEQ\}/g, seqStr);

    if (!template.includes('{XXXX}') && !template.includes('{SEQ}')) {
      candidate = `${candidate}-${randNum}`;
    }

    // Ensure valid Firestore document ID characters only
    candidate = candidate.replace(/[^A-Z0-9_-]/g, '-');
    if (!existingIds || !existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `ESC-${yyyy}-${Date.now().toString().slice(-6)}`;
}

export interface ResolvedCertificateData {
  certId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  certificateTitle: string;
  competitionName: string;
  achievement: string;
  activityName: string;
  organization: string;
  issueDate: string;
  authorizedSigner: string;
  authorizedSignerTitle: string;
  logoUrl: string;
  signatureUrl: string;
  templateStyle: CertificateTemplateStyle;
  verificationHash: string;
  verificationUrl: string;
  status: 'valid' | 'revoked';
}

/**
 * Merges a certificate record with Super Admin defaults so logo, issuer name,
 * designation, title, competition, achievement, and verification URL are never blank.
 */
export function resolveCertificateRenderData(
  cert: Partial<CertificateRecord>,
  settings?: Partial<CertificateSettings> | null,
  originUrl: string = 'https://esc.community'
): ResolvedCertificateData {
  const s = { ...DEFAULT_CERTIFICATE_SETTINGS, ...(settings || {}) };
  const certId = (cert.certId || cert.id || formatCertificateId(s.certIdFormat)).trim().toUpperCase();
  const studentId = (cert.studentId || 'ESC-STU-001').trim();
  const issueDate =
    (cert.issueDate || s.defaultIssueDate || '').trim() ||
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const competitionName = (cert.competitionName || cert.activityName || s.defaultCompetitionName).trim();
  const achievement = (cert.achievement || cert.activityName || 'Verified Engineering Excellence & Completion').trim();
  const certificateTitle = (cert.certificateTitle || s.defaultCertificateTitle || 'Certificate of Engineering Excellence').trim();
  const rawOrganization = (cert.organization || s.organizationName || DEFAULT_CERTIFICATE_SETTINGS.organizationName).trim();
  const organization = rawOrganization.replace(/Engineering Startup Community/gi, 'Engineering Startup Company');
  const authorizedSigner = (cert.authorizedSigner || s.issuerName || DEFAULT_CERTIFICATE_SETTINGS.issuerName).trim();
  const rawAuthorizedSignerTitle = (
    cert.authorizedSignerTitle ||
    s.issuerDesignation ||
    DEFAULT_CERTIFICATE_SETTINGS.issuerDesignation
  ).trim();
  const authorizedSignerTitle = rawAuthorizedSignerTitle.replace(
    /Engineering Startup Community/gi,
    'Engineering Startup Company'
  );
  const logoUrl = (cert.logoUrl || s.logoUrl || DEFAULT_CERTIFICATE_LOGO).trim();
  const signatureUrl = (cert.signatureUrl ?? s.signatureUrl ?? '').trim();
  const templateStyle: CertificateTemplateStyle =
    cert.templateStyle || s.backgroundTemplate || 'charcoal_editorial';
  const verificationHash = (cert.verificationHash || generateCertificateHash(certId, studentId, issueDate)).trim();

  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const verificationUrl = (cert.verificationUrl || `${cleanOrigin}/#/verify?id=${encodeURIComponent(certId)}`).trim();

  return {
    certId,
    studentId,
    studentName: (cert.studentName || '').trim(),
    studentEmail: (cert.studentEmail || '').trim(),
    certificateTitle,
    competitionName,
    achievement,
    activityName: (cert.activityName || `${competitionName} — ${achievement}`).trim(),
    organization,
    issueDate,
    authorizedSigner,
    authorizedSignerTitle,
    logoUrl,
    signatureUrl,
    templateStyle,
    verificationHash,
    verificationUrl,
    status: cert.status === 'revoked' ? 'revoked' : 'valid',
  };
}

export function validateCertificateForPdf(data: ResolvedCertificateData): { valid: boolean; error?: string } {
  if (!data.studentName || data.studentName.length < 2) {
    return { valid: false, error: 'Participant full name is required to generate a valid PDF certificate.' };
  }
  if (!data.certId) {
    return { valid: false, error: 'Unique Certificate ID is missing.' };
  }
  if (!data.authorizedSigner) {
    return { valid: false, error: 'Issuer / Authorized Signer name must be configured before generating PDF.' };
  }
  if (!data.organization) {
    return { valid: false, error: 'Organization name is missing.' };
  }
  if (!data.issueDate) {
    return { valid: false, error: 'Certificate issue date is missing.' };
  }
  return { valid: true };
}

/* ============================================================================
 * SUPER ADMIN CHALLENGE, EVENT & OPPORTUNITY MANAGEMENT LOGIC
 * ============================================================================ */

function parseOptionalDateMs(raw?: string): number | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  // If date-only YYYY-MM-DD, treat deadline as end of that calendar day UTC/local safely
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parsed + 24 * 60 * 60 * 1000 - 1;
  }
  return parsed;
}

export function isChallengePubliclyVisible(challenge: Partial<ChallengeItem>): boolean {
  if (!challenge) return false;
  if (challenge.status === 'draft' || challenge.status === 'archived') return false;
  return Boolean(challenge.isPublished);
}

export function canRegisterForChallenge(
  challenge: Partial<ChallengeItem>,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!isChallengePubliclyVisible(challenge)) {
    return { allowed: false, reason: 'This challenge is not currently published.' };
  }
  if (challenge.status === 'registration_closed') {
    return { allowed: false, reason: 'Registrations are closed for this challenge.' };
  }
  if (challenge.status === 'completed') {
    return { allowed: false, reason: 'This challenge has already completed.' };
  }
  const deadlineMs = parseOptionalDateMs(challenge.registrationDeadline);
  if (deadlineMs !== null && now.getTime() > deadlineMs) {
    return { allowed: false, reason: 'The registration deadline has passed.' };
  }
  return { allowed: true };
}

export function canSubmitToChallenge(
  challenge: Partial<ChallengeItem>,
  hasRegistered: boolean,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!isChallengePubliclyVisible(challenge)) {
    return { allowed: false, reason: 'This challenge is not currently published.' };
  }
  if (!hasRegistered) {
    return { allowed: false, reason: 'Register for this challenge before submitting a project.' };
  }
  if (challenge.status === 'completed') {
    return { allowed: false, reason: 'Submissions are closed because the challenge has completed.' };
  }
  const subDeadlineMs = parseOptionalDateMs(challenge.submissionDeadline);
  if (subDeadlineMs !== null && now.getTime() > subDeadlineMs) {
    return { allowed: false, reason: 'The submission deadline has passed.' };
  }
  return { allowed: true };
}

export function isEventPubliclyVisible(event: Partial<EventItem>): boolean {
  if (!event) return false;
  if (event.status === 'draft' || event.status === 'archived') return false;
  return Boolean(event.isPublished);
}

export function canRegisterForEvent(
  event: Partial<EventItem>,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!isEventPubliclyVisible(event)) {
    return { allowed: false, reason: 'This event is not published.' };
  }
  if (event.status === 'registration_closed') {
    return { allowed: false, reason: 'Registrations are closed for this event.' };
  }
  if (event.status === 'completed') {
    return { allowed: false, reason: 'This event has already ended.' };
  }
  const maxP = Number(event.maxParticipants || 0);
  const regCount = Number(event.registeredCount || 0);
  if (maxP > 0 && regCount >= maxP) {
    return { allowed: false, reason: 'Maximum participant capacity has been reached.' };
  }
  const deadlineMs = parseOptionalDateMs(event.registrationDeadline);
  if (deadlineMs !== null && now.getTime() > deadlineMs) {
    return { allowed: false, reason: 'The registration deadline has passed.' };
  }
  return { allowed: true };
}

export function isOpportunityPubliclyVisible(opp: Partial<OpportunityItem>): boolean {
  if (!opp) return false;
  if (opp.status === 'draft' || opp.status === 'archived') return false;
  return Boolean(opp.isPublished);
}

export function canApplyToOpportunity(
  opp: Partial<OpportunityItem>,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!isOpportunityPubliclyVisible(opp)) {
    return { allowed: false, reason: 'This opportunity is not currently published.' };
  }
  if (opp.status === 'closed') {
    return { allowed: false, reason: 'Applications for this opportunity are closed.' };
  }
  const deadlineMs = parseOptionalDateMs(opp.applicationDeadline);
  if (deadlineMs !== null && now.getTime() > deadlineMs) {
    return { allowed: false, reason: 'The application deadline has passed.' };
  }
  return { allowed: true };
}

export function validateChallengeForm(
  data: Partial<ChallengeItem>,
  targetPublish: boolean = false
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length < 3) {
    errors.title = 'Challenge title is required (min 3 characters).';
  }
  if (!data.category || data.category.trim().length < 2) {
    errors.category = 'Category / Track is required.';
  }
  if (!data.description || data.description.trim().length < 15) {
    errors.description = 'Description is required (min 15 characters).';
  }
  if (data.participationType === 'team' || data.participationType === 'both') {
    const minSize = Number(data.minTeamSize || 1);
    const maxSize = Number(data.maxTeamSize || 1);
    if (minSize < 1 || maxSize < minSize) {
      errors.teamSize = 'Max team size must be greater than or equal to min team size.';
    }
  }
  if (targetPublish) {
    if (!data.registrationDeadline || !data.registrationDeadline.trim()) {
      errors.registrationDeadline = 'Registration deadline is required before publishing.';
    }
    if (!data.submissionDeadline || !data.submissionDeadline.trim()) {
      errors.submissionDeadline = 'Submission deadline is required before publishing.';
    }
    if (!data.rules || data.rules.trim().length < 5) {
      errors.rules = 'Challenge rules are required before publishing.';
    }
    if (!data.submissionInstructions || data.submissionInstructions.trim().length < 5) {
      errors.submissionInstructions = 'Submission instructions are required before publishing.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateEventForm(
  data: Partial<EventItem>,
  targetPublish: boolean = false
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length < 3) {
    errors.title = 'Event title is required (min 3 characters).';
  }
  if (!data.type) {
    errors.type = 'Event type is required.';
  }
  if (!data.description || data.description.trim().length < 15) {
    errors.description = 'Event description is required (min 15 characters).';
  }
  if (!data.date || !data.date.trim()) {
    errors.date = 'Event date & schedule display is required.';
  }
  if (Number(data.maxParticipants ?? 0) <= 0) {
    errors.maxParticipants = 'Maximum participants must be greater than 0.';
  }
  if (targetPublish) {
    if (!data.location || !data.location.trim()) {
      errors.location = 'Venue or online mode is required before publishing.';
    }
    if (!data.registrationDeadline || !data.registrationDeadline.trim()) {
      errors.registrationDeadline = 'Registration deadline is required before publishing.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateOpportunityForm(
  data: Partial<OpportunityItem>,
  targetPublish: boolean = false
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length < 3) {
    errors.title = 'Opportunity title is required (min 3 characters).';
  }
  if (!data.category) {
    errors.category = 'Opportunity category is required.';
  }
  if (!data.organization || data.organization.trim().length < 2) {
    errors.organization = 'Sponsoring organization or host name is required.';
  }
  if (!data.description || data.description.trim().length < 15) {
    errors.description = 'Description is required (min 15 characters).';
  }
  if (targetPublish) {
    if (!data.eligibility || !data.eligibility.trim()) {
      errors.eligibility = 'Eligibility criteria is required before publishing.';
    }
    if (!data.applicationDeadline || !data.applicationDeadline.trim()) {
      errors.applicationDeadline = 'Application deadline is required before publishing.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function computeChallengeMetrics(
  challenges: ChallengeItem[],
  registrations: ChallengeRegistration[],
  submissions: ChallengeSubmission[]
) {
  return {
    total: challenges.length,
    live: challenges.filter((c) => c.isPublished && c.status === 'live').length,
    drafts: challenges.filter((c) => c.status === 'draft' || !c.isPublished).length,
    completed: challenges.filter((c) => c.status === 'completed').length,
    totalRegistrations: registrations.length,
    totalSubmissions: submissions.length,
  };
}

export function computeEventMetrics(
  events: EventItem[],
  registrations: EventRegistration[]
) {
  const activeRegistrations = registrations.filter((r) => r.status !== 'cancelled').length;
  return {
    total: events.length,
    published: events.filter((e) => isEventPubliclyVisible(e)).length,
    drafts: events.filter((e) => !isEventPubliclyVisible(e)).length,
    totalRegistrations: activeRegistrations,
    attended: registrations.filter((r) => r.status === 'attended').length,
  };
}

export function computeOpportunityMetrics(
  opportunities: OpportunityItem[],
  applications: OpportunityApplication[]
) {
  return {
    total: opportunities.length,
    live: opportunities.filter((o) => isOpportunityPubliclyVisible(o) && o.status === 'live').length,
    drafts: opportunities.filter((o) => o.status === 'draft' || !o.isPublished).length,
    closed: opportunities.filter((o) => o.status === 'closed').length,
    totalApplications: applications.length,
    shortlistedOrApproved: applications.filter(
      (a) => a.status === 'shortlisted' || a.status === 'approved'
    ).length,
  };
}

/* ============================================================================
 * MEMBER APPROVAL, STARTUP TEAMS (MAX 4), TASKS & EXTENDED ADMIN METRICS
 * ============================================================================ */

export const MAX_STARTUP_TEAM_MEMBERS = 4;

/**
 * Generates a unique formatted ESC Member ID e.g. ESC-2026-0001
 */
export function formatEscMemberId(
  year: number = new Date().getFullYear(),
  existingIds?: Set<string>,
  seqNumber?: number
): string {
  const yyyy = String(year);
  if (typeof seqNumber === 'number' && seqNumber > 0) {
    let seq = seqNumber;
    for (let i = 0; i < 500; i++) {
      const candidate = `ESC-${yyyy}-${String(seq).padStart(4, '0')}`;
      if (!existingIds || !existingIds.has(candidate)) {
        return candidate;
      }
      seq++;
    }
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const candidate = `ESC-${yyyy}-${rand}`;
    if (!existingIds || !existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `ESC-${yyyy}-${Date.now().toString().slice(-4)}`;
}

/**
 * Generates a unique formatted Startup Team code e.g. TEAM-2026-001
 */
export function formatStartupTeamCode(
  year: number = new Date().getFullYear(),
  existingCodes?: Set<string>,
  seqNumber?: number
): string {
  const yyyy = String(year);
  if (typeof seqNumber === 'number' && seqNumber > 0) {
    let seq = seqNumber;
    for (let i = 0; i < 500; i++) {
      const candidate = `TEAM-${yyyy}-${String(seq).padStart(3, '0')}`;
      if (!existingCodes || !existingCodes.has(candidate)) {
        return candidate;
      }
      seq++;
    }
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.floor(100 + Math.random() * 900);
    const candidate = `TEAM-${yyyy}-${rand}`;
    if (!existingCodes || !existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `TEAM-${yyyy}-${Date.now().toString().slice(-3)}`;
}

/**
 * Resolves effective account status ('active' | 'inactive' | 'suspended')
 * accounting for explicit suspension and >30d inactivity threshold.
 */
export function resolveAccountStatus(
  user: Partial<UserProfile>,
  referenceNow: Date = new Date()
): AccountStatus {
  if (user.accountStatus === 'suspended') return 'suspended';
  if (user.accountStatus === 'expired') return 'expired';
  if (user.accountStatus === 'inactive') return 'inactive';

  const lastSeenIso = user.lastActiveAt || user.lastLoginAt || user.updatedAt || user.createdAt;
  if (lastSeenIso) {
    const parsed = Date.parse(lastSeenIso);
    if (!Number.isNaN(parsed)) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (referenceNow.getTime() - parsed > thirtyDaysMs) {
        return 'inactive';
      }
    }
  }
  return 'active';
}

export function filterMembersByCategory(
  users: UserProfile[],
  category: MemberCategoryFilter,
  referenceNow: Date = new Date()
): UserProfile[] {
  const reviewStatuses = new Set(['submitted', 'under_review', 'shortlisted', 'more_info_required']);

  return users.filter((u) => {
    const acct = resolveAccountStatus(u, referenceNow);
    const memStatus = u.membershipStatus || 'unregistered';

    switch (category) {
      case 'all':
        return true;
      case 'under_review':
        return reviewStatuses.has(memStatus);
      case 'approved':
        return memStatus === 'approved' || Boolean(u.escMemberId);
      case 'active':
        return (memStatus === 'approved' || u.role === 'admin' || u.role === 'superadmin') && acct === 'active';
      case 'inactive':
        return acct === 'inactive';
      case 'suspended':
        return acct === 'suspended';
      case 'rejected':
        return memStatus === 'rejected';
      default:
        return true;
    }
  });
}

export function validateStartupTeamInput(
  input: Partial<StartupTeam>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.name || input.name.trim().length < 2) {
    errors.name = 'Startup Team Name is required (min 2 characters).';
  }
  if (!input.problemStatement || input.problemStatement.trim().length < 15) {
    errors.problemStatement = 'Problem Statement is required (min 15 characters).';
  }
  if (!input.proposedSolution || input.proposedSolution.trim().length < 15) {
    errors.proposedSolution = 'Proposed Solution is required (min 15 characters).';
  }
  if (!input.ideaDescription || input.ideaDescription.trim().length < 15) {
    errors.ideaDescription = 'Idea Description is required (min 15 characters).';
  }
  if (!input.domain || input.domain.trim().length < 2) {
    errors.domain = 'Domain / Category is required.';
  }
  if (!input.stage) {
    errors.stage = 'Stage is required.';
  }
  if (!input.skillsRequired || input.skillsRequired.length === 0) {
    errors.skillsRequired = 'Select or enter at least one required skill.';
  }
  if (!input.expectedOutcome || input.expectedOutcome.trim().length < 10) {
    errors.expectedOutcome = 'Expected Outcome is required (min 10 characters).';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canMemberJoinOrCreateTeam(params: {
  userProfile?: Partial<UserProfile> | null;
  existingActiveTeamCount: number;
  targetTeamMemberCount?: number;
  maxMembers?: number;
  allowMultiTeamOverride?: boolean;
}): { allowed: boolean; reason?: string } {
  const profile = params.userProfile;
  if (!profile) {
    return { allowed: false, reason: 'Member profile not found.' };
  }
  if (profile.accountStatus === 'suspended') {
    return { allowed: false, reason: 'Account is suspended from Startup Team actions.' };
  }
  const isApproved =
    profile.membershipStatus === 'approved' ||
    profile.role === 'member' ||
    profile.role === 'project_lead' ||
    profile.role === 'lead' ||
    profile.role === 'admin' ||
    profile.role === 'superadmin';
  if (!isApproved) {
    return { allowed: false, reason: 'Only approved ESC members can participate in Startup Teams.' };
  }

  const cap = Math.min(MAX_STARTUP_TEAM_MEMBERS, params.maxMembers || MAX_STARTUP_TEAM_MEMBERS);
  if (typeof params.targetTeamMemberCount === 'number' && params.targetTeamMemberCount >= cap) {
    return { allowed: false, reason: `Maximum team limit reached (${cap} members including Team Leader).` };
  }

  if (params.existingActiveTeamCount >= 1 && !params.allowMultiTeamOverride) {
    return {
      allowed: false,
      reason: 'An approved ESC member can belong to one active startup team unless an administrator grants an override.',
    };
  }

  return { allowed: true };
}

export function evaluateTaskOverdue(
  task: Pick<TeamTask, 'status' | 'deadline'>,
  referenceNow: Date = new Date()
): TaskStatus {
  if (task.status === 'completed') return 'completed';
  const deadlineMs = parseOptionalDateMs(task.deadline);
  if (deadlineMs !== null && referenceNow.getTime() > deadlineMs) {
    return 'overdue';
  }
  return task.status;
}

export interface ExtendedAdminMetricsSummary {
  totalMembers: number;
  approvedMembers: number;
  activeMembers: number;
  membersUnderReview: number;
  totalStartupTeams: number;
  teamsUnderReview: number;
  activeStartupTeams: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export function computeExtendedAdminMetrics(
  input: {
    users: UserProfile[];
    teams: StartupTeam[];
    tasks: TeamTask[];
    projects?: Project[];
  },
  referenceNow: Date = new Date()
): ExtendedAdminMetricsSummary {
  const approvedList = filterMembersByCategory(input.users, 'approved', referenceNow);
  const activeList = filterMembersByCategory(input.users, 'active', referenceNow);
  const underReviewList = filterMembersByCategory(input.users, 'under_review', referenceNow);

  const teamsUnderReview = input.teams.filter(
    (t) => t.status === 'under_admin_review' || (!t.isApproved && t.status !== 'rejected' && t.status !== 'completed')
  ).length;

  const activeStartupTeams = input.teams.filter(
    (t) => t.status === 'active' || t.status === 'in_progress' || t.status === 'recruiting' || t.status === 'team_formed'
  ).length;

  const completedTeams = input.teams.filter((t) => t.status === 'completed').length;
  const completedProjectsOnly = (input.projects || []).filter((p) => p.status === 'completed').length;

  const normalizedTaskStatuses = input.tasks.map((t) => evaluateTaskOverdue(t, referenceNow));
  const completedTasks = normalizedTaskStatuses.filter((s) => s === 'completed').length;
  const overdueTasks = normalizedTaskStatuses.filter((s) => s === 'overdue').length;

  return {
    totalMembers: input.users.length,
    approvedMembers: approvedList.length,
    activeMembers: activeList.length,
    membersUnderReview: underReviewList.length,
    totalStartupTeams: input.teams.length,
    teamsUnderReview,
    activeStartupTeams,
    completedProjects: completedTeams + completedProjectsOnly,
    totalTasks: input.tasks.length,
    completedTasks,
    overdueTasks,
  };
}

/* ============================================================================
 * SEARCHABLE SKILLS, DUPLICATE / SIMILARITY DETECTION & IDEA REVIEW HELPERS
 * ============================================================================ */

export function normalizeSkillName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function cleanSkillDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export interface SearchableSkillOption {
  name: string;
  normalized: string;
  kind: SkillKind;
  categoryLabel: string;
  isCustom?: boolean;
}

export function buildCombinedSkillPool(
  approvedCustomSkills: { name: string; skillType: SkillKind; category?: string }[] = []
): SearchableSkillOption[] {
  const seen = new Map<string, SearchableSkillOption>();
  for (const s of ALL_PREDEFINED_SKILLS as FlattenedSkillEntry[]) {
    seen.set(s.normalized, {
      name: s.name,
      normalized: s.normalized,
      kind: s.kind,
      categoryLabel: s.categoryLabel,
      isCustom: false,
    });
  }
  for (const c of approvedCustomSkills) {
    const norm = normalizeSkillName(c.name);
    if (!norm || seen.has(norm)) continue;
    seen.set(norm, {
      name: cleanSkillDisplayName(c.name),
      normalized: norm,
      kind: c.skillType === 'non_technical' ? 'non_technical' : 'technical',
      categoryLabel: c.category || 'Community Custom Skill',
      isCustom: true,
    });
  }
  return Array.from(seen.values());
}

export function searchSkillsCatalog(
  query: string,
  pool: SearchableSkillOption[],
  options?: { kindFilter?: SkillKind | 'all'; limit?: number; excludeSelected?: string[] }
): SearchableSkillOption[] {
  const q = normalizeSkillName(query);
  const excludeSet = new Set((options?.excludeSelected || []).map(normalizeSkillName));
  const kindFilter = options?.kindFilter || 'all';
  const limit = options?.limit ?? 14;

  const filtered = pool.filter((item) => {
    if (excludeSet.has(item.normalized)) return false;
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    if (!q) return true;
    return (
      item.normalized.includes(q) ||
      item.categoryLabel.toLowerCase().includes(q)
    );
  });

  if (!q) return filtered.slice(0, limit);

  return filtered
    .sort((a, b) => {
      const aExact = a.normalized === q ? 0 : a.normalized.startsWith(q) ? 1 : 2;
      const bExact = b.normalized === q ? 0 : b.normalized.startsWith(q) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return a.name.length - b.name.length;
    })
    .slice(0, limit);
}

export function findDuplicateOrSimilarSkills(
  rawInput: string,
  pool: SearchableSkillOption[]
): {
  exactMatch: SearchableSkillOption | null;
  similarMatches: SearchableSkillOption[];
} {
  const norm = normalizeSkillName(rawInput);
  if (!norm) return { exactMatch: null, similarMatches: [] };

  let exactMatch: SearchableSkillOption | null = null;
  const similar: { item: SearchableSkillOption; score: number }[] = [];

  for (const item of pool) {
    if (item.normalized === norm) {
      exactMatch = item;
      break;
    }
    const maxLen = Math.max(norm.length, item.normalized.length);
    const dist = levenshteinDistance(norm, item.normalized);
    const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

    const isSubstring =
      norm.length >= 3 && (item.normalized.includes(norm) || norm.includes(item.normalized));

    if (similarity >= 0.72 || isSubstring) {
      similar.push({ item, score: isSubstring ? Math.max(similarity, 0.78) : similarity });
    }
  }

  similar.sort((a, b) => b.score - a.score);
  return {
    exactMatch,
    similarMatches: similar.slice(0, 4).map((s) => s.item),
  };
}

export function normalizeIdeaReviewStatus(status?: string | null): ReviewStatus {
  const s = (status || '').toLowerCase().trim();
  if (s === 'approved') return 'approved';
  if (s === 'changes_requested') return 'changes_requested';
  if (s === 'rejected') return 'rejected';
  if (s === 'cancelled') return 'cancelled';
  return 'under_review';
}

export function getIdeaStatusLabel(status?: string | null): string {
  const norm = normalizeIdeaReviewStatus(status);
  switch (norm) {
    case 'approved':
      return 'Approved';
    case 'changes_requested':
      return 'Changes Requested';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Under Review';
  }
}




