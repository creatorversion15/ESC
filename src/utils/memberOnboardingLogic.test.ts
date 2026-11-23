import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_ESC_WHATSAPP_URL,
  resolveWhatsappCommunityUrl,
  canAccessWhatsappCommunity,
  filterDashboardActiveEvents,
  filterDashboardActiveChallenges,
  computeDashboardActivityVisibility,
  checkAdminEligibilityRestriction,
  validateProfilePhotoFile,
  evaluateMemberCardEligibility,
  resolveMemberVerificationStatus,
  buildMemberVerificationUrl,
  sanitizeMemberCardFilename,
} from './memberOnboardingLogic';
import type { ChallengeItem, EventItem } from '../types';

const NOW = new Date('2026-11-20T12:00:00.000Z');

const sampleOpenEvent: EventItem = {
  id: 'ev_open',
  title: 'ESC Robotics Hardware Sprint',
  description: '48-hour robotics prototyping sprint',
  type: 'buildathon',
  date: '2026-12-10',
  location: 'Pune Lab',
  registrationDeadline: '2026-12-05',
  maxParticipants: 100,
  registeredCount: 12,
  status: 'live',
  isPublished: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const sampleExpiredEvent: EventItem = {
  ...sampleOpenEvent,
  id: 'ev_expired',
  title: 'Past Event',
  registrationDeadline: '2026-11-01',
};

const sampleDraftEvent: EventItem = {
  ...sampleOpenEvent,
  id: 'ev_draft',
  title: 'Draft Event',
  status: 'draft',
  isPublished: false,
};

const sampleOpenChallenge: ChallengeItem = {
  id: 'ch_open',
  title: 'Autonomous EV Thermal Challenge',
  description: 'Design a low-cost BMS cooling solution',
  category: 'EV & Mobility',
  eligibility: 'Open to all engineering students',
  requiredSkills: ['CAD', 'Thermal'],
  participationType: 'both',
  minTeamSize: 1,
  maxTeamSize: 4,
  startDateTime: '2026-11-15',
  registrationDeadline: '2026-12-15',
  submissionDeadline: '2026-12-25',
  rules: 'Original designs only',
  submissionInstructions: 'Upload CAD and pitch deck',
  requiredSubmissionFiles: ['Deck'],
  prizeOrRewards: 'Prototyping grant',
  certificateAvailable: true,
  contactInfo: 'esc@escstartup.ai.studio',
  status: 'live',
  isPublished: true,
  registeredCount: 5,
  submissionCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const sampleClosedChallenge: ChallengeItem = {
  ...sampleOpenChallenge,
  id: 'ch_closed',
  status: 'registration_closed',
};

test('WhatsApp group URL defaults to official ESC link and is accessible immediately upon submission', () => {
  assert.equal(resolveWhatsappCommunityUrl(''), OFFICIAL_ESC_WHATSAPP_URL);
  assert.equal(resolveWhatsappCommunityUrl(null), OFFICIAL_ESC_WHATSAPP_URL);
  assert.equal(
    resolveWhatsappCommunityUrl('https://chat.whatsapp.com/customLink'),
    'https://chat.whatsapp.com/customLink'
  );

  // Immediately available for submitted & under_review (no need to wait for approval)
  assert.equal(canAccessWhatsappCommunity('submitted', 'submitted', 'active'), true);
  assert.equal(canAccessWhatsappCommunity('under_review', 'under_review', 'active'), true);
  assert.equal(canAccessWhatsappCommunity('approved', 'approved', 'active'), true);

  // Not available before submission or when suspended
  assert.equal(canAccessWhatsappCommunity('draft', 'draft', 'active'), false);
  assert.equal(canAccessWhatsappCommunity(null, 'unregistered', 'active'), false);
  assert.equal(canAccessWhatsappCommunity('approved', 'approved', 'suspended'), false);
});

test('Dynamic dashboard conditional visibility handles all 4 required cases strictly', () => {
  const activeEvents = filterDashboardActiveEvents([sampleOpenEvent, sampleExpiredEvent, sampleDraftEvent], [], NOW);
  assert.equal(activeEvents.length, 1);
  assert.equal(activeEvents[0].id, 'ev_open');

  const activeChallenges = filterDashboardActiveChallenges([sampleOpenChallenge, sampleClosedChallenge], [], NOW);
  assert.equal(activeChallenges.length, 1);
  assert.equal(activeChallenges[0].id, 'ch_open');

  // Case 1: Both available
  assert.deepEqual(computeDashboardActivityVisibility(activeEvents, activeChallenges), {
    showEvents: true,
    showChallenges: true,
    caseCode: 'BOTH',
  });

  // Case 2: Only Events available -> hide Challenges completely
  assert.deepEqual(computeDashboardActivityVisibility(activeEvents, []), {
    showEvents: true,
    showChallenges: false,
    caseCode: 'EVENTS_ONLY',
  });

  // Case 3: Only Challenges available -> hide Events completely
  assert.deepEqual(computeDashboardActivityVisibility([], activeChallenges), {
    showEvents: false,
    showChallenges: true,
    caseCode: 'CHALLENGES_ONLY',
  });

  // Case 4: Neither available -> hide both completely
  assert.deepEqual(computeDashboardActivityVisibility([], []), {
    showEvents: false,
    showChallenges: false,
    caseCode: 'NONE',
  });
});

test('Pending applicants can access open events/challenges unless admin sets approved-only eligibility', () => {
  assert.equal(checkAdminEligibilityRestriction('Open to all engineering students', false).restricted, false);
  assert.equal(checkAdminEligibilityRestriction('Approved ESC members only', false).restricted, true);
  assert.equal(checkAdminEligibilityRestriction('Approved ESC members only', true).restricted, false);
});

test('Profile photo validation enforces JPG, JPEG, PNG, and WebP formats', () => {
  assert.equal(validateProfilePhotoFile({ type: 'image/jpeg', name: 'avatar.jpg', size: 500_000 }).valid, true);
  assert.equal(validateProfilePhotoFile({ type: 'image/png', name: 'portrait.png', size: 1_200_000 }).valid, true);
  assert.equal(validateProfilePhotoFile({ type: 'image/webp', name: 'pic.webp', size: 300_000 }).valid, true);
  assert.equal(validateProfilePhotoFile({ type: 'image/gif', name: 'anim.gif', size: 100_000 }).valid, false);
  assert.equal(validateProfilePhotoFile({ type: 'application/pdf', name: 'doc.pdf', size: 100_000 }).valid, false);
  assert.equal(validateProfilePhotoFile({ type: 'image/jpeg', name: 'huge.jpg', size: 15_000_000 }).valid, false);
});

test('Member card eligibility enforces exact approval, active status, and uploaded profile photo rules', () => {
  // Pending member gets exact required message
  const pendingRes = evaluateMemberCardEligibility({
    isLoggedIn: true,
    membershipStatus: 'submitted',
    accountStatus: 'active',
    escMemberId: '',
    profilePhotoUrl: 'data:image/jpeg;base64,abc',
  });
  assert.equal(pendingRes.eligible, false);
  assert.equal(
    pendingRes.message,
    'Your ESC membership is awaiting admin approval. Your digital member card will become available after approval.'
  );

  // Rejected applicant cannot generate card
  const rejectedRes = evaluateMemberCardEligibility({
    isLoggedIn: true,
    membershipStatus: 'rejected',
    accountStatus: 'active',
    escMemberId: 'ESC-2026-0001',
    profilePhotoUrl: 'data:image/jpeg;base64,abc',
  });
  assert.equal(rejectedRes.eligible, false);
  assert.equal(rejectedRes.reasonCode, 'rejected');

  // Approved but missing uploaded photo gets exact required message
  const noPhotoRes = evaluateMemberCardEligibility({
    isLoggedIn: true,
    membershipStatus: 'approved',
    accountStatus: 'active',
    escMemberId: 'ESC-2026-0001',
    profilePhotoUrl: '',
  });
  assert.equal(noPhotoRes.eligible, false);
  assert.equal(
    noPhotoRes.message,
    'Please upload your profile photo to generate your ESC Digital Member Card.'
  );

  // Approved + Suspended cannot generate card
  const suspendedRes = evaluateMemberCardEligibility({
    isLoggedIn: true,
    membershipStatus: 'approved',
    accountStatus: 'suspended',
    escMemberId: 'ESC-2026-0001',
    profilePhotoUrl: 'data:image/jpeg;base64,abc',
  });
  assert.equal(suspendedRes.eligible, false);

  // Approved + Active + Member ID + Uploaded Photo = Eligible
  const eligibleRes = evaluateMemberCardEligibility({
    isLoggedIn: true,
    membershipStatus: 'approved',
    accountStatus: 'active',
    escMemberId: 'ESC-2026-0001',
    profilePhotoUrl: 'data:image/jpeg;base64,abc',
  });
  assert.equal(eligibleRes.eligible, true);
  assert.equal(eligibleRes.reasonCode, 'eligible');
});

test('Member verification statuses and verification URL formatting reflect genuine DB states', () => {
  assert.equal(resolveMemberVerificationStatus(null), 'Invalid Member ID');
  assert.equal(
    resolveMemberVerificationStatus({ membershipStatus: 'approved', accountStatus: 'active', escMemberId: 'ESC-2026-0001' }),
    'Active'
  );
  assert.equal(
    resolveMemberVerificationStatus({ membershipStatus: 'approved', accountStatus: 'inactive', escMemberId: 'ESC-2026-0001' }),
    'Inactive'
  );
  assert.equal(
    resolveMemberVerificationStatus({ membershipStatus: 'approved', accountStatus: 'suspended', escMemberId: 'ESC-2026-0001' }),
    'Suspended'
  );
  assert.equal(
    resolveMemberVerificationStatus({ membershipStatus: 'approved', accountStatus: 'expired', escMemberId: 'ESC-2026-0001' }),
    'Expired'
  );
  assert.equal(
    buildMemberVerificationUrl('esc-2026-0042'),
    'https://escstartup.ai.studio/#/verify?member=ESC-2026-0042'
  );
  assert.equal(
    sanitizeMemberCardFilename('Aarav Kulkarni', 'ESC-2026-0042', 'pdf'),
    'ESC_Member_Card_Aarav_Kulkarni_ESC-2026-0042.pdf'
  );
});

import {
  evaluateMembershipJourneyState,
  isSafeHttpUrl,
  validateMemberProjectInput,
  isTeamJoinRequestRecord,
  filterStartupTeamDirectory,
} from './memberOnboardingLogic';

test('evaluateMembershipJourneyState strictly classifies all 5 authenticated user states and logged-out state', () => {
  // Logged out
  const guest = evaluateMembershipJourneyState({ isLoggedIn: false });
  assert.equal(guest.state, 'logged_out');
  assert.equal(guest.canAccessMemberDashboard, false);

  // User A: Logged-in user who has never applied
  const neverApplied = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: null,
    membershipStatus: 'unregistered',
    accountStatus: 'active',
  });
  assert.equal(neverApplied.state, 'not_applied');
  assert.equal(neverApplied.canAccessMemberDashboard, false);
  assert.equal(neverApplied.canPerformMemberActions, false);
  assert.equal(neverApplied.canAccessWhatsapp, false);

  // User B: Submitted / Under Review applicant
  const submitted = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'submitted',
    membershipStatus: 'submitted',
    accountStatus: 'active',
  });
  assert.equal(submitted.state, 'pending_review');
  assert.equal(submitted.statusBadge, 'UNDER REVIEW');
  assert.equal(submitted.canAccessMemberDashboard, false);
  assert.equal(submitted.canPerformMemberActions, false);
  assert.equal(submitted.canAccessWhatsapp, true);

  const underReview = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'under_review',
    membershipStatus: 'under_review',
    accountStatus: 'active',
  });
  assert.equal(underReview.state, 'pending_review');
  assert.equal(underReview.canAccessMemberDashboard, false);

  // User C: Approved & Active ESC member
  const approved = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'approved',
    membershipStatus: 'approved',
    accountStatus: 'active',
    escMemberId: 'ESC-2026-0011',
    role: 'member',
  });
  assert.equal(approved.state, 'approved_active');
  assert.equal(approved.canAccessMemberDashboard, true);
  assert.equal(approved.canPerformMemberActions, true);
  assert.equal(approved.canAccessWhatsapp, true);

  // User D: Rejected applicant
  const rejected = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'rejected',
    membershipStatus: 'rejected',
    accountStatus: 'active',
  });
  assert.equal(rejected.state, 'rejected');
  assert.equal(rejected.canAccessMemberDashboard, false);
  assert.equal(rejected.canPerformMemberActions, false);
  assert.equal(rejected.canAccessWhatsapp, false);

  // User E: Suspended or Inactive member
  const suspended = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'approved',
    membershipStatus: 'approved',
    accountStatus: 'suspended',
    escMemberId: 'ESC-2026-0011',
  });
  assert.equal(suspended.state, 'suspended');
  assert.equal(suspended.canAccessMemberDashboard, false);
  assert.equal(suspended.canPerformMemberActions, false);

  const inactive = evaluateMembershipJourneyState({
    isLoggedIn: true,
    applicationStatus: 'approved',
    membershipStatus: 'approved',
    accountStatus: 'inactive',
    escMemberId: 'ESC-2026-0011',
  });
  assert.equal(inactive.state, 'inactive');
  assert.equal(inactive.canAccessMemberDashboard, false);
  assert.equal(inactive.canPerformMemberActions, false);
});

test('validateMemberProjectInput and isSafeHttpUrl reject unsafe URLs and incomplete inputs', () => {
  assert.equal(isSafeHttpUrl(''), true);
  assert.equal(isSafeHttpUrl('https://github.com/esc/project'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);

  const bad = validateMemberProjectInput({
    title: 'AI',
    description: 'Too short',
    category: '',
    repoUrl: 'javascript:alert(1)',
    demoUrl: 'not-a-url',
  });
  assert.equal(bad.isValid, false);
  assert.ok(bad.errors.title);
  assert.ok(bad.errors.description);
  assert.ok(bad.errors.category);
  assert.ok(bad.errors.repoUrl);
  assert.ok(bad.errors.demoUrl);

  const good = validateMemberProjectInput({
    title: 'Solar Cold-Chain IoT Monitor',
    description: 'Low-cost LoRaWAN thermal telemetry for rural farm produce storage crates.',
    category: 'IoT & Smart Infrastructure',
    problemStatement: '30% produce spoilage during transit due to unmonitored cold boxes.',
    proposedSolution: 'Battery-powered LoRa node with SMS alerts and solar trickle charger.',
    repoUrl: 'https://github.com/esc-builders/solar-cold-chain',
    demoUrl: 'https://demo.escstartup.ai.studio/cold-chain',
  });
  assert.equal(good.isValid, true);
});

test('isTeamJoinRequestRecord and filterStartupTeamDirectory accurately identify requests and search teams', () => {
  assert.equal(isTeamJoinRequestRecord({ id: 'req_12345_ab' }), true);
  assert.equal(isTeamJoinRequestRecord({ id: 'inv_12345_ab' }), false);

  const teams = [
    {
      name: 'VoltGrid Robotics',
      domain: 'Robotics & Mechatronics',
      skillsRequired: ['ROS2', 'PCB Design'],
      leaderCollege: 'COEP Pune',
      memberCount: 2,
      maxMembers: 4,
    },
    {
      name: 'AgroSense AI',
      domain: 'AgriTech',
      skillsRequired: ['PyTorch', 'React'],
      leaderCollege: 'IIT Bombay',
      memberCount: 4,
      maxMembers: 4,
    },
  ];

  const bySkill = filterStartupTeamDirectory(teams, { query: 'ros2' });
  assert.equal(bySkill.length, 1);
  assert.equal(bySkill[0].name, 'VoltGrid Robotics');

  const byCollege = filterStartupTeamDirectory(teams, { query: 'IIT Bombay' });
  assert.equal(byCollege.length, 1);
  assert.equal(byCollege[0].name, 'AgroSense AI');

  const openOnly = filterStartupTeamDirectory(teams, {
    onlyOpenSpots: true,
    getMemberCount: (t) => ({ count: t.memberCount, max: t.maxMembers }),
  });
  assert.equal(openOnly.length, 1);
  assert.equal(openOnly[0].name, 'VoltGrid Robotics');
});

