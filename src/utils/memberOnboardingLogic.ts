import type {
  AccountStatus,
  ChallengeItem,
  EventItem,
  MemberVerificationStatus,
  MembershipStatus,
} from '../types/index.ts';
import { canRegisterForChallenge, canRegisterForEvent, isChallengePubliclyVisible, isEventPubliclyVisible } from './escLogic.ts';

export const OFFICIAL_ESC_WHATSAPP_URL = 'https://chat.whatsapp.com/J0zOXM0OvBbCRtKfin5tmS';
export const OFFICIAL_ESC_WEBSITE = 'escstartup.ai.studio';
export const OFFICIAL_ESC_WEBSITE_URL = 'https://escstartup.ai.studio';
export const OFFICIAL_ESC_LOGO = '/assets/aistudio/IMG_20261112_135951_2ec3259f.png';

const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_PHOTO_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB source file limit before client crop/compress

/**
 * Resolves the active ESC WhatsApp group invitation URL, always falling back to the
 * official ESC WhatsApp group link so submitted applicants never see a dead/missing link.
 */
export function resolveWhatsappCommunityUrl(configuredUrl?: string | null): string {
  const trimmed = (configuredUrl || '').trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return OFFICIAL_ESC_WHATSAPP_URL;
}

/**
 * Students gain immediate access to the official ESC WhatsApp group invitation link
 * right after submitting their fellowship application (no need to wait for admin approval).
 * Suspended accounts do not retain community access.
 */
export function canAccessWhatsappCommunity(
  applicationStatus?: MembershipStatus | null,
  membershipStatus?: MembershipStatus | null,
  accountStatus?: AccountStatus | null
): boolean {
  if (accountStatus === 'suspended') return false;
  const submittedStatuses: MembershipStatus[] = [
    'submitted',
    'under_review',
    'shortlisted',
    'more_info_required',
    'approved',
  ];
  return Boolean(
    (applicationStatus && submittedStatuses.includes(applicationStatus)) ||
      (membershipStatus && submittedStatuses.includes(membershipStatus))
  );
}

export function getApplicationDisplayStatus(
  status?: MembershipStatus | null
): 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Shortlisted' | 'More Info Required' | 'Not Submitted' {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'shortlisted':
      return 'Shortlisted';
    case 'more_info_required':
      return 'More Info Required';
    default:
      return 'Not Submitted';
  }
}

/**
 * Filters published events to strictly active events available for member registration
 * within their registration period (or already registered by the student while still active).
 */
export function filterDashboardActiveEvents(
  events: EventItem[],
  registeredEventIds: string[] = [],
  now: Date = new Date()
): EventItem[] {
  const regSet = new Set(registeredEventIds);
  return events.filter((ev) => {
    if (!ev || !ev.id) return false;
    if (!isEventPubliclyVisible(ev)) return false;
    if (ev.status === 'completed' || ev.status === 'archived' || ev.status === 'draft') {
      return false;
    }
    if (regSet.has(ev.id)) {
      return true;
    }
    return canRegisterForEvent(ev, now).allowed;
  });
}

/**
 * Filters published challenges to strictly active challenges open for registration
 * or participation (or already registered by the student while still active).
 */
export function filterDashboardActiveChallenges(
  challenges: ChallengeItem[],
  registeredChallengeIds: string[] = [],
  now: Date = new Date()
): ChallengeItem[] {
  const regSet = new Set(registeredChallengeIds);
  return challenges.filter((ch) => {
    if (!ch || !ch.id) return false;
    if (!isChallengePubliclyVisible(ch)) return false;
    if (ch.status === 'completed' || ch.status === 'archived' || ch.status === 'draft') {
      return false;
    }
    if (regSet.has(ch.id)) {
      return true;
    }
    return canRegisterForChallenge(ch, now).allowed;
  });
}

export type DashboardActivityVisibilityCase = 'BOTH' | 'EVENTS_ONLY' | 'CHALLENGES_ONLY' | 'NONE';

export function computeDashboardActivityVisibility(
  activeEvents: EventItem[],
  activeChallenges: ChallengeItem[]
): {
  showEvents: boolean;
  showChallenges: boolean;
  caseCode: DashboardActivityVisibilityCase;
} {
  const showEvents = activeEvents.length > 0;
  const showChallenges = activeChallenges.length > 0;
  let caseCode: DashboardActivityVisibilityCase = 'NONE';
  if (showEvents && showChallenges) caseCode = 'BOTH';
  else if (showEvents) caseCode = 'EVENTS_ONLY';
  else if (showChallenges) caseCode = 'CHALLENGES_ONLY';
  return { showEvents, showChallenges, caseCode };
}

/**
 * Events and Challenges are accessible to submitted applicants even while their fellowship
 * application is pending, unless an admin explicitly restricts an item to approved members only.
 */
export function checkAdminEligibilityRestriction(
  eligibilityText: string | undefined,
  isApprovedMember: boolean
): { restricted: boolean; reason?: string } {
  if (isApprovedMember) return { restricted: false };
  const text = (eligibilityText || '').toLowerCase();
  if (
    text.includes('approved esc members only') ||
    text.includes('approved members only') ||
    text.includes('verified esc members only')
  ) {
    return {
      restricted: true,
      reason: 'Restricted to approved ESC members by administrator eligibility rules.',
    };
  }
  return { restricted: false };
}

/**
 * Validates profile photo upload format (JPG, JPEG, PNG, WebP) and file size.
 */
export function validateProfilePhotoFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): { valid: boolean; error?: string } {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').trim();
  const hasAllowedMime = mime ? ALLOWED_PHOTO_MIME_TYPES.has(mime) : false;
  const hasAllowedExt = name ? ALLOWED_PHOTO_EXTENSIONS.test(name) : false;

  if (!hasAllowedMime && !hasAllowedExt) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a JPG, JPEG, PNG, or WebP photo.',
    };
  }
  if (typeof file.size === 'number' && file.size > MAX_PROFILE_PHOTO_BYTES) {
    return {
      valid: false,
      error: 'Image file is too large (maximum 10 MB). Please choose a smaller photo.',
    };
  }
  return { valid: true };
}

export type MemberCardEligibilityCode =
  | 'not_logged_in'
  | 'pending_approval'
  | 'rejected'
  | 'inactive_or_suspended'
  | 'missing_member_id'
  | 'missing_profile_photo'
  | 'eligible';

export interface MemberCardEligibilityResult {
  eligible: boolean;
  reasonCode: MemberCardEligibilityCode;
  message: string;
}

/**
 * Evaluates strict eligibility for generating an official ESC Digital Member Card.
 * Conditions:
 *  1. Logged into own account
 *  2. Application approved by admin (and official ESC Member ID issued)
 *  3. Membership account status is active (not inactive, suspended, or expired)
 *  4. Valid member-uploaded profile photo exists
 */
export function evaluateMemberCardEligibility(input: {
  isLoggedIn: boolean;
  membershipStatus?: MembershipStatus | null;
  accountStatus?: AccountStatus | null;
  escMemberId?: string | null;
  profilePhotoUrl?: string | null;
}): MemberCardEligibilityResult {
  if (!input.isLoggedIn) {
    return {
      eligible: false,
      reasonCode: 'not_logged_in',
      message: 'Sign in with your verified Google account to access your ESC Digital Member Card.',
    };
  }

  if (input.membershipStatus === 'rejected') {
    return {
      eligible: false,
      reasonCode: 'rejected',
      message:
        'Your fellowship application was not approved. Official ESC Digital Member Cards are issued exclusively to approved active members.',
    };
  }

  if (input.membershipStatus !== 'approved') {
    return {
      eligible: false,
      reasonCode: 'pending_approval',
      message:
        'Your ESC membership is awaiting admin approval. Your digital member card will become available after approval.',
    };
  }

  const acct = input.accountStatus || 'active';
  if (acct === 'suspended') {
    return {
      eligible: false,
      reasonCode: 'inactive_or_suspended',
      message:
        'Your ESC membership is currently suspended. Please contact ESC Admin for assistance.',
    };
  }
  if (acct === 'inactive') {
    return {
      eligible: false,
      reasonCode: 'inactive_or_suspended',
      message:
        'Your ESC membership is currently inactive. Active membership is required to generate an official digital member card.',
    };
  }
  if (acct === 'expired') {
    return {
      eligible: false,
      reasonCode: 'inactive_or_suspended',
      message:
        'Your ESC membership has expired. Renew your active membership with ESC Admin to generate a card.',
    };
  }

  if (!input.escMemberId || !input.escMemberId.trim()) {
    return {
      eligible: false,
      reasonCode: 'missing_member_id',
      message:
        'Your ESC membership is awaiting admin approval. Your digital member card will become available after approval.',
    };
  }

  const photo = (input.profilePhotoUrl || '').trim();
  const hasValidPhoto =
    photo.startsWith('data:image/') ||
    photo.startsWith('https://') ||
    photo.startsWith('http://') ||
    photo.startsWith('/');

  if (!hasValidPhoto) {
    return {
      eligible: false,
      reasonCode: 'missing_profile_photo',
      message: 'Please upload your profile photo to generate your ESC Digital Member Card.',
    };
  }

  return {
    eligible: true,
    reasonCode: 'eligible',
    message: 'Your official ESC Digital Member Identity is verified and ready.',
  };
}

/**
 * Resolves the public verification status for an ESC Member ID from a live database row.
 */
export function resolveMemberVerificationStatus(
  userRecord: {
    membershipStatus?: string | null;
    accountStatus?: string | null;
    escMemberId?: string | null;
  } | null
): MemberVerificationStatus {
  if (!userRecord || !userRecord.escMemberId) {
    return 'Invalid Member ID';
  }
  if (userRecord.membershipStatus !== 'approved') {
    return 'Inactive';
  }
  const acct = (userRecord.accountStatus || 'active').toLowerCase();
  if (acct === 'suspended') return 'Suspended';
  if (acct === 'expired') return 'Expired';
  if (acct === 'inactive') return 'Inactive';
  return 'Active';
}

export function buildMemberVerificationUrl(
  escMemberId: string,
  origin: string = OFFICIAL_ESC_WEBSITE_URL
): string {
  const cleanOrigin = (origin || OFFICIAL_ESC_WEBSITE_URL).replace(/\/+$/, '');
  const cleanId = (escMemberId || '').trim().toUpperCase();
  return `${cleanOrigin}/#/verify?member=${encodeURIComponent(cleanId)}`;
}

export function sanitizeMemberCardFilename(
  fullName: string,
  escMemberId: string,
  ext: 'png' | 'pdf'
): string {
  const cleanName = (fullName || 'ESC_Member')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .slice(0, 40);
  const cleanId = (escMemberId || 'ID').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  return `ESC_Member_Card_${cleanName || 'Member'}_${cleanId}.${ext}`;
}

/* ============================================================================
 * SMART MEMBERSHIP JOURNEY STATE & CONDITIONAL ACCESS RULES
 * ============================================================================ */

export type MembershipJourneyState =
  | 'logged_out'
  | 'not_applied'
  | 'pending_review'
  | 'approved_active'
  | 'rejected'
  | 'suspended'
  | 'inactive';

export interface MembershipJourneyEvaluation {
  state: MembershipJourneyState;
  canAccessMemberDashboard: boolean;
  canPerformMemberActions: boolean;
  canAccessWhatsapp: boolean;
  statusBadge: string;
  effectiveApplicationStatus: MembershipStatus;
}

const PENDING_APPLICATION_STATUSES: ReadonlySet<MembershipStatus> = new Set([
  'submitted',
  'under_review',
  'shortlisted',
  'more_info_required',
]);

/**
 * Pure, deterministic evaluator for the 5 authenticated user states + logged-out state.
 * Drives both the Landing Page status banner and strict Member Dashboard access control.
 */
export function evaluateMembershipJourneyState(input: {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  applicationStatus?: MembershipStatus | null;
  membershipStatus?: MembershipStatus | null;
  accountStatus?: AccountStatus | null;
  escMemberId?: string | null;
  role?: string | null;
}): MembershipJourneyEvaluation {
  if (!input.isLoggedIn) {
    return {
      state: 'logged_out',
      canAccessMemberDashboard: false,
      canPerformMemberActions: false,
      canAccessWhatsapp: false,
      statusBadge: 'GUEST',
      effectiveApplicationStatus: 'unregistered',
    };
  }

  const acct = (input.accountStatus || 'active').toLowerCase() as AccountStatus;
  const appStatus = input.applicationStatus || null;
  const memStatus = input.membershipStatus || 'unregistered';

  // Admins always retain active dashboard access unless explicitly suspended
  if (input.isAdmin && acct !== 'suspended') {
    return {
      state: 'approved_active',
      canAccessMemberDashboard: true,
      canPerformMemberActions: true,
      canAccessWhatsapp: true,
      statusBadge: 'ACTIVE MEMBER',
      effectiveApplicationStatus: 'approved',
    };
  }

  // Suspended accounts are strictly restricted while preserving historical records
  if (acct === 'suspended') {
    return {
      state: 'suspended',
      canAccessMemberDashboard: false,
      canPerformMemberActions: false,
      canAccessWhatsapp: false,
      statusBadge: 'MEMBERSHIP SUSPENDED',
      effectiveApplicationStatus: appStatus || memStatus,
    };
  }

  // Inactive or expired accounts restrict member-only actions
  if (acct === 'inactive' || acct === 'expired') {
    return {
      state: 'inactive',
      canAccessMemberDashboard: false,
      canPerformMemberActions: false,
      canAccessWhatsapp: false,
      statusBadge: acct === 'expired' ? 'MEMBERSHIP EXPIRED' : 'MEMBERSHIP INACTIVE',
      effectiveApplicationStatus: appStatus || memStatus,
    };
  }

  // Approved & active official ESC member
  const isApproved =
    memStatus === 'approved' ||
    appStatus === 'approved' ||
    Boolean((input.escMemberId || '').trim()) ||
    ['member', 'project_lead', 'lead', 'mentor'].includes(input.role || '');

  if (isApproved) {
    return {
      state: 'approved_active',
      canAccessMemberDashboard: true,
      canPerformMemberActions: true,
      canAccessWhatsapp: true,
      statusBadge: 'APPROVED & ACTIVE',
      effectiveApplicationStatus: 'approved',
    };
  }

  // Rejected applicant
  if (appStatus === 'rejected' || memStatus === 'rejected') {
    return {
      state: 'rejected',
      canAccessMemberDashboard: false,
      canPerformMemberActions: false,
      canAccessWhatsapp: false,
      statusBadge: 'REJECTED',
      effectiveApplicationStatus: 'rejected',
    };
  }

  // Pending admin review (submitted / under_review / shortlisted / more_info_required)
  const pendingStatus =
    appStatus && PENDING_APPLICATION_STATUSES.has(appStatus)
      ? appStatus
      : PENDING_APPLICATION_STATUSES.has(memStatus)
      ? memStatus
      : null;

  if (pendingStatus) {
    return {
      state: 'pending_review',
      canAccessMemberDashboard: false,
      canPerformMemberActions: false,
      canAccessWhatsapp: true,
      statusBadge:
        pendingStatus === 'shortlisted'
          ? 'SHORTLISTED'
          : pendingStatus === 'more_info_required'
          ? 'MORE INFO REQUIRED'
          : 'UNDER REVIEW',
      effectiveApplicationStatus: pendingStatus,
    };
  }

  // Logged-in user who has never submitted an application (unregistered or draft only)
  return {
    state: 'not_applied',
    canAccessMemberDashboard: false,
    canPerformMemberActions: false,
    canAccessWhatsapp: false,
    statusBadge: appStatus === 'draft' ? 'DRAFT SAVED' : 'NOT APPLIED',
    effectiveApplicationStatus: appStatus === 'draft' ? 'draft' : 'unregistered',
  };
}

/**
 * Validates that an optional user-supplied URL uses strictly http:// or https://
 * (blocks javascript:, data:, vbscript:, etc.).
 */
export function isSafeHttpUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface MemberProjectInput {
  title: string;
  description: string;
  category: string;
  problemStatement?: string;
  proposedSolution?: string;
  stage?: string;
  repoUrl?: string;
  demoUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  imageUrl?: string;
  status?: string;
}

export function validateMemberProjectInput(input: MemberProjectInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!input.title || input.title.trim().length < 3) {
    errors.title = 'Project title must be at least 3 characters.';
  }
  if (!input.description || input.description.trim().length < 15) {
    errors.description = 'Project description must be at least 15 characters.';
  }
  if (!input.category || !input.category.trim()) {
    errors.category = 'Please select a project domain or category.';
  }
  if (input.problemStatement !== undefined && input.problemStatement.trim().length > 0 && input.problemStatement.trim().length < 10) {
    errors.problemStatement = 'Problem statement should be at least 10 characters.';
  }
  if (input.proposedSolution !== undefined && input.proposedSolution.trim().length > 0 && input.proposedSolution.trim().length < 10) {
    errors.proposedSolution = 'Solution overview should be at least 10 characters.';
  }
  if (!isSafeHttpUrl(input.repoUrl)) {
    errors.repoUrl = 'GitHub / repository link must be a valid http(s) URL.';
  }
  if (!isSafeHttpUrl(input.demoUrl)) {
    errors.demoUrl = 'Demo link must be a valid http(s) URL.';
  }
  if (!isSafeHttpUrl(input.websiteUrl)) {
    errors.websiteUrl = 'Website link must be a valid http(s) URL.';
  }
  if (!isSafeHttpUrl(input.docsUrl)) {
    errors.docsUrl = 'Document link must be a valid http(s) URL.';
  }
  if (!isSafeHttpUrl(input.imageUrl)) {
    errors.imageUrl = 'Image URL must be a valid http(s) URL.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Distinguishes member-initiated join requests (`req_...`) from leader invitations (`inv_...`)
 * stored in the unified `team_invitations` table.
 */
export function isTeamJoinRequestRecord(record: { id: string }): boolean {
  return Boolean(record && typeof record.id === 'string' && record.id.startsWith('req_'));
}

export function filterStartupTeamDirectory<
  T extends {
    name: string;
    domain: string;
    problemStatement?: string;
    ideaDescription?: string;
    leaderName?: string;
    leaderCollege?: string;
    skillsRequired?: string[];
    memberColleges?: string[];
    stage?: string;
  }
>(teams: T[], filters: { query?: string; domain?: string; onlyOpenSpots?: boolean } & { getMemberCount?: (t: T) => { count: number; max: number } }): T[] {
  const q = (filters.query || '').trim().toLowerCase();
  const domain = (filters.domain || '').trim().toLowerCase();

  return teams.filter((team) => {
    if (domain && domain !== 'all' && team.domain.toLowerCase() !== domain) {
      return false;
    }
    if (filters.onlyOpenSpots && filters.getMemberCount) {
      const { count, max } = filters.getMemberCount(team);
      if (count >= max) return false;
    }
    if (!q) return true;
    const haystack = [
      team.name,
      team.domain,
      team.problemStatement || '',
      team.ideaDescription || '',
      team.leaderName || '',
      team.leaderCollege || '',
      team.stage || '',
      ...(team.skillsRequired || []),
      ...(team.memberColleges || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

