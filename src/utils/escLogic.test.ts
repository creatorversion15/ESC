import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateApplicationStep,
  calculateProfileCompletion,
  generateCertificateHash,
  filterStartupIdeas,
  hasPermission,
  buildUserLoginUpsert,
  sanitizeUserProfileUpdate,
  computeAdminMetrics,
  exportToCSV,
  sanitizeCertificateFilename,
  formatCertificateId,
  resolveCertificateRenderData,
  validateCertificateForPdf,
  isChallengePubliclyVisible,
  canRegisterForChallenge,
  canSubmitToChallenge,
  isEventPubliclyVisible,
  canRegisterForEvent,
  isOpportunityPubliclyVisible,
  canApplyToOpportunity,
  validateChallengeForm,
  validateEventForm,
  validateOpportunityForm,
  computeChallengeMetrics,
  computeEventMetrics,
  computeOpportunityMetrics,
  formatEscMemberId,
  formatStartupTeamCode,
  resolveAccountStatus,
  filterMembersByCategory,
  validateStartupTeamInput,
  canMemberJoinOrCreateTeam,
  evaluateTaskOverdue,
  computeExtendedAdminMetrics,
  validateFullApplication,
  isValidEmailAddress,
  buildCombinedSkillPool,
  searchSkillsCatalog,
  findDuplicateOrSimilarSkills,
  normalizeIdeaReviewStatus,
  getIdeaStatusLabel,
} from './escLogic';
import {
  TECHNICAL_SKILL_CATEGORIES,
  NON_TECHNICAL_SKILL_CATEGORIES,
  ALL_PREDEFINED_SKILLS,
  IDEA_REVIEW_DISCLAIMER,
} from '../data/skillsCatalog';
import {
  buildTermsDocument,
  buildPrivacyDocument,
  POLICY_VERSION,
  POLICY_LAST_UPDATED,
  DEFAULT_ESC_CONTACT_EMAIL,
} from '../data/policies';

test('validateApplicationStep step 1 fails on empty required fields', () => {
  const result = validateApplicationStep(1, {});
  assert.equal(result.isValid, false);
  assert.ok(result.errors.fullName);
  assert.ok(result.errors.college);
  assert.ok(result.errors.branch);
});

test('validateApplicationStep step 1 succeeds with complete data', () => {
  const result = validateApplicationStep(1, {
    fullName: 'Alex Rivera',
    college: 'MIT College of Engineering',
    city: 'Pune',
    state: 'Maharashtra',
    branch: 'Computer Science',
    academicYear: '3rd Year',
  });
  assert.equal(result.isValid, true);
  assert.equal(Object.keys(result.errors).length, 0);
});

test('validateApplicationStep step 4 validates startup idea summary when flagged and requires terms acceptance', () => {
  const badResult = validateApplicationStep(4, {
    hasExistingIdea: true,
    existingIdeaSummary: 'short',
    teamGoal: 'build_team',
    termsAccepted: true,
  });
  assert.equal(badResult.isValid, false);
  assert.ok(badResult.errors.existingIdeaSummary);

  const missingTerms = validateApplicationStep(4, {
    hasExistingIdea: false,
    teamGoal: 'join_team',
    termsAccepted: false,
  });
  assert.equal(missingTerms.isValid, false);
  assert.ok(missingTerms.errors.termsAccepted);

  const goodResult = validateApplicationStep(4, {
    hasExistingIdea: true,
    existingIdeaSummary: 'Autonomous solar rover for precision farming in drylands',
    teamGoal: 'build_team',
    termsAccepted: true,
  });
  assert.equal(goodResult.isValid, true);
});

test('calculateProfileCompletion computes proportional percentage', () => {
  const empty = calculateProfileCompletion({});
  assert.equal(empty, 0);

  const half = calculateProfileCompletion({
    fullName: 'Jane Doe',
    college: 'Stanford',
    branch: 'Robotics',
    academicYear: '2nd Year',
    technicalSkills: ['ROS', 'Python'],
  });
  assert.equal(half, 50);
});

test('generateCertificateHash creates deterministic verification code', () => {
  const hash1 = generateCertificateHash('CERT-001', 'USER-123', '2026-11-12');
  const hash2 = generateCertificateHash('CERT-001', 'USER-123', '2026-11-12');
  assert.equal(hash1, hash2);
  assert.ok(hash1.startsWith('ESC-'));
});

test('filterStartupIdeas filters by stage and search query', () => {
  const ideas = [
    { title: 'AeroDrone', industry: 'Aerospace', stage: 'prototype', problemStatement: 'Wildfire surveillance' },
    { title: 'MedPulse', industry: 'HealthTech', stage: 'idea', problemStatement: 'Remote ECG monitoring' },
    { title: 'VoltBattery', industry: 'CleanTech', stage: 'mvp', problemStatement: 'Lithium battery recycling' },
  ];

  const prototypeOnly = filterStartupIdeas(ideas, { stage: 'prototype' });
  assert.equal(prototypeOnly.length, 1);
  assert.equal(prototypeOnly[0].title, 'AeroDrone');

  const searchECG = filterStartupIdeas(ideas, { search: 'ecg' });
  assert.equal(searchECG.length, 1);
  assert.equal(searchECG[0].title, 'MedPulse');
});

test('hasPermission enforces strict RBAC boundaries', () => {
  assert.equal(hasPermission('superadmin', 'change_admin_roles'), true);
  assert.equal(hasPermission('superadmin', 'manage_site_settings'), true);
  assert.equal(hasPermission('admin', 'manage_applications'), true);
  assert.equal(hasPermission('admin', 'change_admin_roles'), false);
  assert.equal(hasPermission('admin', 'manage_site_settings'), false);
  assert.equal(hasPermission('project_lead', 'manage_assigned_projects'), true);
  assert.equal(hasPermission('project_lead', 'manage_users'), false);
  assert.equal(hasPermission('member', 'view_admin_dashboard'), false);
  assert.equal(hasPermission('student', 'manage_events'), false);
});

test('buildUserLoginUpsert creates new profile and never overwrites existing profile fields on repeat login', () => {
  const created = buildUserLoginUpsert(
    null,
    { uid: 'u1', displayName: 'Student Name', email: 'stu@edu.in', photoURL: 'https://pic/1.png' },
    false,
    '2026-11-01T10:00:00.000Z'
  );
  assert.equal(created.isNew, true);
  assert.equal(created.mergedProfile.role, 'student');
  assert.equal(created.mergedProfile.createdAt, '2026-11-01T10:00:00.000Z');
  assert.equal(created.mergedProfile.lastLoginAt, '2026-11-01T10:00:00.000Z');

  const repeat = buildUserLoginUpsert(
    {
      userId: 'u1',
      fullName: 'Custom Edited Name',
      email: 'stu@edu.in',
      college: 'IIT Bombay',
      branch: 'Aerospace',
      academicYear: '3rd Year',
      technicalSkills: ['ROS2'],
      role: 'member',
      membershipStatus: 'approved',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    { uid: 'u1', displayName: 'Google Raw Name', email: 'stu@edu.in', photoURL: 'https://pic/2.png' },
    false,
    '2026-11-12T12:00:00.000Z'
  );
  assert.equal(repeat.isNew, false);
  assert.equal(repeat.mergedProfile.fullName, 'Custom Edited Name');
  assert.equal(repeat.mergedProfile.college, 'IIT Bombay');
  assert.equal(repeat.mergedProfile.branch, 'Aerospace');
  assert.equal(repeat.mergedProfile.createdAt, '2026-11-01T10:00:00.000Z');
  assert.equal(repeat.mergedProfile.lastLoginAt, '2026-11-12T12:00:00.000Z');
  assert.equal(repeat.payload.college, undefined);
  assert.equal(repeat.payload.role, undefined);
});

test('sanitizeUserProfileUpdate strips privileged fields from self-updates', () => {
  const sanitized = sanitizeUserProfileUpdate({
    fullName: 'Safe Name',
    bio: 'Building robotics',
    role: 'superadmin',
    membershipStatus: 'approved',
    userId: 'other_user',
    createdAt: '1999-01-01T00:00:00.000Z',
  });
  assert.equal(sanitized.fullName, 'Safe Name');
  assert.equal(sanitized.bio, 'Building robotics');
  assert.equal('role' in sanitized, false);
  assert.equal('membershipStatus' in sanitized, false);
  assert.equal('userId' in sanitized, false);
  assert.equal('createdAt' in sanitized, false);
});

test('computeAdminMetrics calculates accurate live dashboard metrics', () => {
  const now = new Date('2026-11-12T12:00:00.000Z');
  const metrics = computeAdminMetrics(
    {
      users: [
        {
          userId: 'u1',
          fullName: 'A',
          email: 'a@x.com',
          branch: 'Mechanical',
          role: 'member',
          membershipStatus: 'approved',
          createdAt: '2026-11-10T10:00:00.000Z',
          updatedAt: '2026-11-10T10:00:00.000Z',
        },
        {
          userId: 'u2',
          fullName: 'B',
          email: 'b@x.com',
          branch: 'CS',
          role: 'student',
          membershipStatus: 'submitted',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      applications: [
        { status: 'submitted', createdAt: '2026-11-10T10:00:00.000Z' } as any,
        { status: 'approved', createdAt: '2026-11-08T10:00:00.000Z' } as any,
        { status: 'rejected', createdAt: '2026-11-07T10:00:00.000Z' } as any,
      ],
      ideas: [{ title: 'Idea 1' } as any],
      projects: [
        { status: 'in_progress' } as any,
        { status: 'completed' } as any,
      ],
      events: [{ title: 'Buildathon' } as any],
      certificates: [{ certId: 'ESC-1' } as any, { certId: 'ESC-2' } as any],
    },
    now
  );

  assert.equal(metrics.totalUsers, 2);
  assert.equal(metrics.newRegistrations7d, 1);
  assert.equal(metrics.totalApplications, 3);
  assert.equal(metrics.pendingApplications, 1);
  assert.equal(metrics.approvedApplications, 1);
  assert.equal(metrics.rejectedApplications, 1);
  assert.equal(metrics.totalIdeas, 1);
  assert.equal(metrics.totalActiveProjects, 1);
  assert.equal(metrics.totalEvents, 1);
  assert.equal(metrics.totalCertificates, 2);
  assert.equal(metrics.registrationTrend7d.length, 7);
});

test('exportToCSV converts tabular data to valid CSV string', () => {
  const data = [
    { name: 'John Doe', branch: 'Mechanical', skills: ['CAD', 'Robotics'] },
    { name: 'Alice Smith', branch: 'Computer Science', skills: ['React', 'Go'] },
  ];
  const csv = exportToCSV(data, [
    { key: 'name', label: 'Full Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'skills', label: 'Skills' },
  ]);
  assert.ok(csv.includes('"Full Name","Branch","Skills"'));
  assert.ok(csv.includes('"John Doe","Mechanical","CAD; Robotics"'));
});

test('sanitizeCertificateFilename produces clean Windows/Android/macOS PDF filenames', () => {
  assert.equal(sanitizeCertificateFilename('Viraj Bansod'), 'ESC_Certificate_Viraj_Bansod.pdf');
  assert.equal(sanitizeCertificateFilename('  Dr. Alex / Rivera*  '), 'ESC_Certificate_Dr_Alex_Rivera.pdf');
  assert.equal(sanitizeCertificateFilename('', 'ESC-2026-HW01'), 'ESC_Certificate_ESC-2026-HW01.pdf');
});

test('formatCertificateId honors template tokens and avoids collisions', () => {
  const existing = new Set<string>(['ESC-2026-001']);
  const id = formatCertificateId('ESC-{YYYY}-{SEQ}', 2026, existing, 2);
  assert.equal(id, 'ESC-2026-002');

  const randId = formatCertificateId('ESC-{YY}-{XXXX}', 2026);
  assert.match(randId, /^ESC-26-\d{4}$/);
});

test('resolveCertificateRenderData fills issuer, logo, designation, competition, and verification URL without blanks', () => {
  const resolved = resolveCertificateRenderData(
    {
      certId: 'ESC-2026-9911',
      studentId: 'u_99',
      studentName: 'Viraj Bansod',
      activityName: 'National Robotics Buildathon — Winner',
    },
    {
      issuerName: 'Soviraj Bansod',
      issuerDesignation: 'Founder, Engineering Startup Company',
      organizationName: 'Engineering Startup Company (ESC)',
      logoUrl: '/assets/aistudio/IMG_20261112_135951_2ec3259f.png',
      signatureUrl: 'data:image/png;base64,AAA',
      backgroundTemplate: 'obsidian_grid',
    },
    'https://esc.community'
  );

  assert.equal(resolved.authorizedSigner, 'Soviraj Bansod');
  assert.equal(resolved.authorizedSignerTitle, 'Founder, Engineering Startup Company');
  assert.equal(resolved.organization, 'Engineering Startup Company (ESC)');
  assert.equal(resolved.logoUrl, '/assets/aistudio/IMG_20261112_135951_2ec3259f.png');
  assert.equal(resolved.signatureUrl, 'data:image/png;base64,AAA');
  assert.equal(resolved.templateStyle, 'obsidian_grid');
  assert.equal(resolved.verificationUrl, 'https://esc.community/#/verify?id=ESC-2026-9911');
  assert.equal(validateCertificateForPdf(resolved).valid, true);
});

test('validateCertificateForPdf rejects blank participant names cleanly', () => {
  const invalid = resolveCertificateRenderData({ studentName: '' });
  const check = validateCertificateForPdf(invalid);
  assert.equal(check.valid, false);
  assert.ok(check.error?.includes('Participant full name'));
});

test('Challenge visibility, registration, and submission rules enforce Super Admin status and deadlines', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');
  assert.equal(isChallengePubliclyVisible({ status: 'draft', isPublished: true }), false);
  assert.equal(isChallengePubliclyVisible({ status: 'archived', isPublished: true }), false);
  assert.equal(isChallengePubliclyVisible({ status: 'live', isPublished: false }), false);
  assert.equal(isChallengePubliclyVisible({ status: 'live', isPublished: true }), true);

  const openReg = canRegisterForChallenge(
    { status: 'live', isPublished: true, registrationDeadline: '2026-11-20' },
    now
  );
  assert.equal(openReg.allowed, true);

  const expiredReg = canRegisterForChallenge(
    { status: 'live', isPublished: true, registrationDeadline: '2026-11-10' },
    now
  );
  assert.equal(expiredReg.allowed, false);

  const needRegSub = canSubmitToChallenge(
    { status: 'live', isPublished: true, submissionDeadline: '2026-11-25' },
    false,
    now
  );
  assert.equal(needRegSub.allowed, false);

  const validSub = canSubmitToChallenge(
    { status: 'live', isPublished: true, submissionDeadline: '2026-11-25' },
    true,
    now
  );
  assert.equal(validSub.allowed, true);
});

test('Event and Opportunity visibility, capacity, and deadline rules work accurately', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');
  assert.equal(isEventPubliclyVisible({ status: 'draft', isPublished: true }), false);
  assert.equal(isEventPubliclyVisible({ status: 'live', isPublished: true }), true);

  const fullEvent = canRegisterForEvent(
    { status: 'live', isPublished: true, maxParticipants: 50, registeredCount: 50, registrationDeadline: '2026-12-01' },
    now
  );
  assert.equal(fullEvent.allowed, false);

  const availableEvent = canRegisterForEvent(
    { status: 'scheduled', isPublished: true, maxParticipants: 50, registeredCount: 12, registrationDeadline: '2026-12-01' },
    now
  );
  assert.equal(availableEvent.allowed, true);

  assert.equal(isOpportunityPubliclyVisible({ status: 'archived', isPublished: true }), false);
  assert.equal(isOpportunityPubliclyVisible({ status: 'live', isPublished: true }), true);

  const closedOpp = canApplyToOpportunity({ status: 'closed', isPublished: true }, now);
  assert.equal(closedOpp.allowed, false);

  const openOpp = canApplyToOpportunity(
    { status: 'live', isPublished: true, applicationDeadline: '2026-11-30' },
    now
  );
  assert.equal(openOpp.allowed, true);
});

test('Form validators and stats calculators for Challenge, Event, Opportunity work deterministically', () => {
  const invalidPublishChallenge = validateChallengeForm(
    { title: 'AI Rover', category: 'Robotics', description: 'Autonomous navigation challenge for campus rovers.', participationType: 'team', minTeamSize: 4, maxTeamSize: 2 },
    true
  );
  assert.equal(invalidPublishChallenge.isValid, false);
  assert.ok(invalidPublishChallenge.errors.teamSize);
  assert.ok(invalidPublishChallenge.errors.registrationDeadline);

  const validPublishEvent = validateEventForm(
    {
      title: 'ESC Robotics Sprint',
      type: 'buildathon',
      description: 'Hardware prototyping buildathon with mentor reviews.',
      date: 'Dec 15, 2026',
      location: 'Main Maker Lab',
      registrationDeadline: '2026-12-10',
      maxParticipants: 100,
    },
    true
  );
  assert.equal(validPublishEvent.isValid, true);

  const invalidOpp = validateOpportunityForm({ title: 'X', category: 'grant', organization: '', description: 'Short' }, true);
  assert.equal(invalidOpp.isValid, false);
  assert.ok(invalidOpp.errors.title);
  assert.ok(invalidOpp.errors.eligibility);

  const cMetrics = computeChallengeMetrics(
    [
      { status: 'live', isPublished: true } as any,
      { status: 'draft', isPublished: false } as any,
      { status: 'completed', isPublished: true } as any,
    ],
    [{ id: 'r1' } as any, { id: 'r2' } as any],
    [{ id: 's1' } as any]
  );
  assert.equal(cMetrics.total, 3);
  assert.equal(cMetrics.live, 1);
  assert.equal(cMetrics.drafts, 1);
  assert.equal(cMetrics.totalRegistrations, 2);
  assert.equal(cMetrics.totalSubmissions, 1);

  const eMetrics = computeEventMetrics(
    [{ status: 'live', isPublished: true } as any, { status: 'draft', isPublished: false } as any],
    [{ status: 'confirmed' } as any, { status: 'attended' } as any, { status: 'cancelled' } as any]
  );
  assert.equal(eMetrics.total, 2);
  assert.equal(eMetrics.published, 1);
  assert.equal(eMetrics.totalRegistrations, 2);
  assert.equal(eMetrics.attended, 1);

  const oMetrics = computeOpportunityMetrics(
    [{ status: 'live', isPublished: true } as any, { status: 'closed', isPublished: true } as any],
    [{ status: 'shortlisted' } as any, { status: 'submitted' } as any]
  );
  assert.equal(oMetrics.live, 1);
  assert.equal(oMetrics.closed, 1);
  assert.equal(oMetrics.shortlistedOrApproved, 1);
});

test('formatEscMemberId and formatStartupTeamCode create unique sequential IDs without collisions', () => {
  const existingIds = new Set<string>(['ESC-2026-0001', 'ESC-2026-0002']);
  assert.equal(formatEscMemberId(2026, existingIds, 1), 'ESC-2026-0003');

  const existingTeams = new Set<string>(['TEAM-2026-001']);
  assert.equal(formatStartupTeamCode(2026, existingTeams, 1), 'TEAM-2026-002');
});

test('resolveAccountStatus and filterMembersByCategory classify all 7 requested categories', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');
  const users: any[] = [
    { userId: 'u1', fullName: 'Active Approved', membershipStatus: 'approved', role: 'member', escMemberId: 'ESC-2026-0001', accountStatus: 'active', lastActiveAt: '2026-11-16T10:00:00.000Z' },
    { userId: 'u2', fullName: 'Under Review', membershipStatus: 'under_review', role: 'student', accountStatus: 'active', lastActiveAt: '2026-11-16T10:00:00.000Z' },
    { userId: 'u3', fullName: 'Inactive Approved', membershipStatus: 'approved', role: 'member', escMemberId: 'ESC-2026-0002', accountStatus: 'active', lastActiveAt: '2026-09-01T10:00:00.000Z' },
    { userId: 'u4', fullName: 'Suspended Member', membershipStatus: 'approved', role: 'member', escMemberId: 'ESC-2026-0003', accountStatus: 'suspended', lastActiveAt: '2026-11-16T10:00:00.000Z' },
    { userId: 'u5', fullName: 'Rejected Applicant', membershipStatus: 'rejected', role: 'student', accountStatus: 'active', lastActiveAt: '2026-11-10T10:00:00.000Z' },
  ];

  assert.equal(resolveAccountStatus(users[0], now), 'active');
  assert.equal(resolveAccountStatus(users[2], now), 'inactive');
  assert.equal(resolveAccountStatus(users[3], now), 'suspended');

  assert.equal(filterMembersByCategory(users, 'all', now).length, 5);
  assert.equal(filterMembersByCategory(users, 'under_review', now).length, 1);
  assert.equal(filterMembersByCategory(users, 'approved', now).length, 3);
  assert.equal(filterMembersByCategory(users, 'active', now).length, 1);
  assert.equal(filterMembersByCategory(users, 'inactive', now).length, 1);
  assert.equal(filterMembersByCategory(users, 'suspended', now).length, 1);
  assert.equal(filterMembersByCategory(users, 'rejected', now).length, 1);
});

test('validateStartupTeamInput and canMemberJoinOrCreateTeam enforce approved status, single active team, and max 4 members', () => {
  const invalidTeam = validateStartupTeamInput({ name: 'A' });
  assert.equal(invalidTeam.isValid, false);
  assert.ok(invalidTeam.errors.problemStatement);

  const validTeam = validateStartupTeamInput({
    name: 'VoltGrid Labs',
    problemStatement: 'Campus microgrids lose 18% power due to uncoordinated inverter switching.',
    proposedSolution: 'Solid-state telemetry controller with predictive load shedding.',
    ideaDescription: 'Modular campus smart-grid controller built for university engineering labs.',
    domain: 'CleanTech',
    stage: 'prototype',
    skillsRequired: ['Embedded C', 'Power Electronics'],
    expectedOutcome: 'Deploy functional 5kW prototype across 2 campus labs.',
  });
  assert.equal(validTeam.isValid, true);

  assert.equal(
    canMemberJoinOrCreateTeam({
      userProfile: { membershipStatus: 'submitted', role: 'student', accountStatus: 'active' },
      existingActiveTeamCount: 0,
    }).allowed,
    false
  );

  assert.equal(
    canMemberJoinOrCreateTeam({
      userProfile: { membershipStatus: 'approved', role: 'member', accountStatus: 'suspended' },
      existingActiveTeamCount: 0,
    }).allowed,
    false
  );

  assert.equal(
    canMemberJoinOrCreateTeam({
      userProfile: { membershipStatus: 'approved', role: 'member', accountStatus: 'active' },
      existingActiveTeamCount: 0,
      targetTeamMemberCount: 4,
      maxMembers: 4,
    }).allowed,
    false
  );

  assert.equal(
    canMemberJoinOrCreateTeam({
      userProfile: { membershipStatus: 'approved', role: 'member', accountStatus: 'active' },
      existingActiveTeamCount: 1,
      targetTeamMemberCount: 2,
      allowMultiTeamOverride: false,
    }).allowed,
    false
  );

  assert.equal(
    canMemberJoinOrCreateTeam({
      userProfile: { membershipStatus: 'approved', role: 'member', accountStatus: 'active' },
      existingActiveTeamCount: 1,
      targetTeamMemberCount: 2,
      allowMultiTeamOverride: true,
    }).allowed,
    true
  );
});

test('evaluateTaskOverdue and computeExtendedAdminMetrics calculate all 11 KPI metrics cleanly', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');
  assert.equal(evaluateTaskOverdue({ status: 'in_progress', deadline: '2026-11-10' }, now), 'overdue');
  assert.equal(evaluateTaskOverdue({ status: 'completed', deadline: '2026-11-10' }, now), 'completed');
  assert.equal(evaluateTaskOverdue({ status: 'in_progress', deadline: '2026-11-25' }, now), 'in_progress');

  const stats = computeExtendedAdminMetrics(
    {
      users: [
        { userId: 'u1', membershipStatus: 'approved', role: 'member', accountStatus: 'active', lastActiveAt: '2026-11-17T10:00:00.000Z' } as any,
        { userId: 'u2', membershipStatus: 'under_review', role: 'student', accountStatus: 'active', lastActiveAt: '2026-11-17T10:00:00.000Z' } as any,
      ],
      teams: [
        { id: 't1', status: 'active', isApproved: true } as any,
        { id: 't2', status: 'under_admin_review', isApproved: false } as any,
        { id: 't3', status: 'completed', isApproved: true } as any,
      ],
      tasks: [
        { id: 'k1', status: 'completed', deadline: '2026-11-10' } as any,
        { id: 'k2', status: 'in_progress', deadline: '2026-11-10' } as any,
        { id: 'k3', status: 'not_started', deadline: '2026-11-25' } as any,
      ],
      projects: [{ status: 'completed' } as any],
    },
    now
  );

  assert.equal(stats.totalMembers, 2);
  assert.equal(stats.approvedMembers, 1);
  assert.equal(stats.activeMembers, 1);
  assert.equal(stats.membersUnderReview, 1);
  assert.equal(stats.totalStartupTeams, 3);
  assert.equal(stats.teamsUnderReview, 1);
  assert.equal(stats.activeStartupTeams, 1);
  assert.equal(stats.completedProjects, 2);
  assert.equal(stats.totalTasks, 3);
  assert.equal(stats.completedTasks, 1);
  assert.equal(stats.overdueTasks, 1);
});

test('Step 1 mandatory validation checks email and blocks advancing with missing fields, and Step 4 rejects open_to_both', () => {
  assert.equal(isValidEmailAddress('student@gmail.com'), true);
  assert.equal(isValidEmailAddress('not-an-email'), false);

  const missingEmail = validateApplicationStep(1, {
    fullName: 'Aarav Kulkarni',
    email: '',
    college: 'COEP',
    branch: 'Mechanical Engineering',
    academicYear: '3rd Year',
    city: 'Pune',
    state: 'Maharashtra',
  });
  assert.equal(missingEmail.isValid, false);
  assert.ok(missingEmail.errors.email);

  const legacyGoal = validateApplicationStep(4, {
    teamGoal: 'open_to_both',
    hasExistingIdea: false,
  });
  assert.equal(legacyGoal.isValid, false);
  assert.ok(legacyGoal.errors.teamGoal);

  const uncheckedIdeaDoesNotForceSummary = validateApplicationStep(4, {
    teamGoal: 'existing_idea',
    hasExistingIdea: false,
    existingIdeaSummary: '',
    termsAccepted: true,
  });
  assert.equal(uncheckedIdeaDoesNotForceSummary.isValid, true);

  const missingTermsOnFull = validateFullApplication({
    fullName: 'Aarav Kulkarni',
    email: 'aarav@gmail.com',
    college: 'COEP Technological University',
    branch: 'Mechanical Engineering',
    academicYear: '3rd Year',
    city: 'Pune',
    state: 'Maharashtra',
    technicalSkills: ['SolidWorks', 'ANSYS'],
    nonTechnicalSkills: ['Video Editing', 'Product Management'],
    whyJoin: 'I want to build autonomous agricultural hardware with cross-disciplinary engineers.',
    weeklyAvailability: '10-15 hrs/week',
    teamGoal: 'build_team',
    hasExistingIdea: false,
    termsAccepted: false,
  });
  assert.equal(missingTermsOnFull.isValid, false);
  assert.equal(missingTermsOnFull.firstInvalidStep, 4);
  assert.ok(missingTermsOnFull.errors.termsAccepted);

  const fullValid = validateFullApplication({
    fullName: 'Aarav Kulkarni',
    email: 'aarav@gmail.com',
    college: 'COEP Technological University',
    branch: 'Mechanical Engineering',
    academicYear: '3rd Year',
    city: 'Pune',
    state: 'Maharashtra',
    technicalSkills: ['SolidWorks', 'ANSYS'],
    nonTechnicalSkills: ['Video Editing', 'Product Management'],
    whyJoin: 'I want to build autonomous agricultural hardware with cross-disciplinary engineers.',
    weeklyAvailability: '10-15 hrs/week',
    teamGoal: 'existing_idea',
    hasExistingIdea: true,
    existingIdeaSummary: 'Low-cost solar precision sprayer with computer vision weed detection.',
    termsAccepted: true,
  });
  assert.equal(fullValid.isValid, true);
  assert.equal(fullValid.firstInvalidStep, null);
});

test('Skills catalog covers all engineering branches, media/creative/business non-tech skills, and exact/similar duplicate detection', () => {
  assert.ok(TECHNICAL_SKILL_CATEGORIES.length >= 8);
  assert.ok(NON_TECHNICAL_SKILL_CATEGORIES.length >= 5);

  const pool = buildCombinedSkillPool([
    { name: 'Quantum Photonics', skillType: 'technical', category: 'Other Engineering Skills' },
  ]);
  const names = new Set(pool.map((s) => s.name));
  // Spot-check across branches & non-technical categories
  for (const requiredSkill of [
    'Python',
    'SolidWorks',
    'ANSYS',
    'PCB Design',
    'PLC Programming',
    'STAAD.Pro',
    'Vehicle Dynamics',
    'Aspen Plus',
    'Video Editing',
    'Reels Editing',
    'Cinematography',
    'Photography',
    'Adobe Premiere Pro',
    'Social Media Marketing',
    'Pitch Deck Development',
    'Patent Research',
    'Quantum Photonics',
  ]) {
    assert.ok(names.has(requiredSkill), `Missing expected skill: ${requiredSkill}`);
  }

  const videoResults = searchSkillsCatalog('video edit', pool);
  assert.ok(videoResults.some((r) => r.name === 'Video Editing'));
  assert.ok(videoResults.some((r) => r.name === 'Short-Form Video Editing'));
  const editingResults = searchSkillsCatalog('editing', pool);
  assert.ok(editingResults.some((r) => r.name === 'Reels Editing'));

  const exactDup = findDuplicateOrSimilarSkills('  solidworks ', pool);
  assert.equal(exactDup.exactMatch?.name, 'SolidWorks');

  const similarCheck = findDuplicateOrSimilarSkills('Video Editng', pool);
  assert.equal(similarCheck.exactMatch, null);
  assert.ok(similarCheck.similarMatches.some((s) => s.name === 'Video Editing'));
});

test('Idea review status normalization and disclaimer enforce ESC Admin governance', () => {
  assert.ok(IDEA_REVIEW_DISCLAIMER.includes('subject to review by the ESC Admin Team'));
  assert.ok(IDEA_REVIEW_DISCLAIMER.includes('Approval is not guaranteed'));
  assert.equal(normalizeIdeaReviewStatus('pending'), 'under_review');
  assert.equal(normalizeIdeaReviewStatus('under_review'), 'under_review');
  assert.equal(normalizeIdeaReviewStatus('changes_requested'), 'changes_requested');
  assert.equal(normalizeIdeaReviewStatus('approved'), 'approved');
  assert.equal(normalizeIdeaReviewStatus('rejected'), 'rejected');
  assert.equal(normalizeIdeaReviewStatus('cancelled'), 'cancelled');
  assert.equal(getIdeaStatusLabel('changes_requested'), 'Changes Requested');
  assert.equal(ALL_PREDEFINED_SKILLS.length > 180, true);
});

test('ESC Terms & Conditions and Privacy Policy documents have complete numbered sections, official contact details, and PDF filenames', () => {
  const terms = buildTermsDocument();
  assert.equal(terms.pdfFilename, 'ESC_Terms_and_Conditions.pdf');
  assert.equal(terms.version, POLICY_VERSION);
  assert.equal(terms.lastUpdated, POLICY_LAST_UPDATED);
  assert.equal(terms.sections.length, 10);
  assert.ok(terms.title.includes('ENGINEERING STARTUP COMPANY (ESC)'));
  assert.ok(terms.sections[9].paragraphs[0].includes(DEFAULT_ESC_CONTACT_EMAIL));

  const privacy = buildPrivacyDocument();
  assert.equal(privacy.pdfFilename, 'ESC_Privacy_Policy.pdf');
  assert.equal(privacy.version, POLICY_VERSION);
  assert.equal(privacy.lastUpdated, POLICY_LAST_UPDATED);
  assert.equal(privacy.sections.length, 9);
  assert.ok(privacy.title.includes('ENGINEERING STARTUP COMPANY (ESC)'));
  assert.ok(privacy.sections[3].paragraphs.some((p) => p.includes('Firebase Authentication') && p.includes('Cloud SQL')));
  assert.ok(privacy.sections[8].paragraphs[0].includes(DEFAULT_ESC_CONTACT_EMAIL));
});




