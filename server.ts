import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { adminAuth, firebaseProjectConfig as firebaseConfig } from './src/lib/firebase-admin.ts';
import {
  type AuthRequest,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireSuperAdmin,
  SUPER_ADMIN_EMAIL,
} from './src/middleware/auth.ts';
import {
  adminUpdateMemberByUid,
  getOrCreateUser,
  getUserByEscMemberId,
  getUserByUid,
  listApprovedMemberDirectory,
  listUsers,
  markMemberCardGenerated,
  updateUserProfileByUid,
  updateUserRoleByUid,
} from './src/db/users.ts';
import {
  adminAddOrRemoveTeamMember,
  adminReviewProgressReport,
  adminUpdateTaskReview,
  approveEscMemberTransaction,
  createAdminTask,
  createNotificationSafe,
  createStartupTeamTransaction,
  createTeamMilestone,
  getMemberFullDetails,
  getMemberTeamsAndInvitations,
  getSiteSettingsSql,
  listActivityLogs,
  listAdminNotifications,
  listAllProgressReports,
  listAllStartupTeams,
  listAllTasksForAdmin,
  listMemberTasks,
  listPublicStartupTeamsDirectory,
  listTeamMessages,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markTeamMessagesRead,
  memberUpdateTaskSubmission,
  postTeamMessage,
  recordActivityLog,
  requestToJoinTeamTransaction,
  respondToInvitationTransaction,
  sendTeamInvitationTransaction,
  submitTeamProgressReport,
  updateStartupTeamDetails,
  upsertSiteSettingsSql,
} from './src/db/teamsAndTasksRepository.ts';
import {
  computeExtendedAdminMetrics,
  normalizeSkillName,
  validateFullApplication,
  validateStartupTeamInput,
} from './src/utils/escLogic.ts';
import {
  evaluateMemberCardEligibility,
  resolveMemberVerificationStatus,
  validateMemberProjectInput,
} from './src/utils/memberOnboardingLogic.ts';
import {
  getSupportStatusLabel,
  isValidSupportStatus,
  validateSupportRequestInput,
} from './src/utils/supportLogic.ts';
import {
  createSupportTicket,
  listAllSupportTicketsForAdmin,
  listUserSupportTickets,
  updateSupportTicketStatus,
} from './src/db/supportRepository.ts';
import { ALL_PREDEFINED_SKILLS } from './src/data/skillsCatalog.ts';
import {
  applyToOpportunity,
  createAdminAuditLog,
  createOrIncrementCustomSkill,
  deleteAnnouncementById,
  deleteChallengeById,
  deleteCustomSkillById,
  deleteEventById,
  deleteOpportunityById,
  getAdminOverviewData,
  getApplicationByUserUid,
  getCertificateByCertId,
  getUserChallengeActivity,
  getUserEventRegistrations,
  getUserOpportunityApplications,
  listAllApplications,
  listAnnouncements,
  listCertificates,
  listChallenges,
  listCustomSkills,
  listEvents,
  listIdeas,
  listOpportunities,
  listProblems,
  listProjects,
  moderateCustomSkill,
  registerForChallenge,
  registerForEvent,
  reviewIdeaById,
  submitToChallenge,
  updateApplicationReview,
  upsertAnnouncement,
  upsertCertificate,
  upsertChallenge,
  upsertEvent,
  upsertIdea,
  upsertMembershipApplication,
  upsertOpportunity,
  upsertProblem,
  upsertProject,
} from './src/db/escRepository.ts';
import { createProblemExchangeRouter } from './src/routes/problemExchangeRoutes.ts';
import {
  createMemberCardOrderSql,
  listAllMemberCardOrdersSql,
  listMemberCardOrdersByUserSql,
  updateMemberCardOrderAdminSql,
} from './src/db/cardOrdersRepository.ts';
import {
  evaluatePhysicalCardOrderEligibility,
  isValidUpiId,
  resolveConfiguredCardPrice,
  VALID_CARD_ORDER_STATUSES,
  VALID_PAYMENT_STATUSES,
  validateConfiguredUpiId,
  validateDeliveryDetails,
  validatePaymentSubmission,
} from './src/utils/physicalCardOrderLogic.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchFirestoreDoc(
  collectionPath: string,
  docId: string,
  idToken: string
): Promise<Record<string, any> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (res.status === 404 || !res.ok) return null;
  const json = (await res.json()) as { fields?: Record<string, any> };
  return json.fields || null;
}

function readStringField(fields: Record<string, any> | null, key: string): string | null {
  if (!fields || !fields[key]) return null;
  return typeof fields[key].stringValue === 'string' ? fields[key].stringValue : null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const healthPayload = () => ({
    status: 'ok',
    service: 'esc-platform',
    uptimeSeconds: Math.floor(process.uptime()),
  });

  app.get('/health', (_req, res) => {
    res.status(200).json(healthPayload());
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json(healthPayload());
  });

  app.post('/api/auth/verify-role', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!token) {
        res.status(401).json({ verified: false, error: 'Missing Authorization Bearer token' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(token);
      const email = (decoded.email || '').toLowerCase();
      const emailVerified = Boolean(decoded.email_verified);
      const signInProvider = decoded.firebase?.sign_in_provider || '';
      const uid = decoded.sub || decoded.uid;

      const isConfiguredSuperAdmin =
        emailVerified &&
        email === SUPER_ADMIN_EMAIL.toLowerCase() &&
        (signInProvider === 'google.com' || signInProvider === '');

      const [adminFields, userFields, sqlUser] = await Promise.all([
        fetchFirestoreDoc('admins', uid, token).catch(() => null),
        fetchFirestoreDoc('users', uid, token).catch(() => null),
        getOrCreateUser({
          uid,
          email: decoded.email || '',
          fullName: typeof decoded.name === 'string' ? decoded.name : 'Engineering Student',
          photoUrl: typeof decoded.picture === 'string' ? decoded.picture : '',
          isSuperAdmin: isConfiguredSuperAdmin,
        }).catch((err) => {
          console.warn('Non-blocking SQL user sync notice:', err);
          return null;
        }),
      ]);

      const adminDocRole = readStringField(adminFields, 'role');
      const userDocRole = readStringField(userFields, 'role') || sqlUser?.role || null;

      let resolvedRole = userDocRole || 'student';
      let isSuperAdmin = false;
      let isAdmin = false;

      if (isConfiguredSuperAdmin || (emailVerified && adminDocRole === 'superadmin')) {
        resolvedRole = 'superadmin';
        isSuperAdmin = true;
        isAdmin = true;
      } else if (emailVerified && adminDocRole === 'admin') {
        resolvedRole = 'admin';
        isAdmin = true;
      } else if (resolvedRole === 'admin' || resolvedRole === 'superadmin') {
        resolvedRole = 'member';
      }

      const isProjectLead =
        isAdmin || resolvedRole === 'project_lead' || resolvedRole === 'lead';

      res.json({
        verified: true,
        uid,
        email: decoded.email || '',
        emailVerified,
        role: resolvedRole,
        isSuperAdmin,
        isAdmin,
        isProjectLead,
        escMemberId: sqlUser?.escMemberId || '',
        accountStatus: (sqlUser?.accountStatus as any) || 'active',
        membershipStatus: (sqlUser?.membershipStatus as any) || (isSuperAdmin ? 'approved' : 'unregistered'),
        permissions: {
          canManageAllUsers: isAdmin,
          canChangeAdminRoles: isSuperAdmin,
          canManageSiteSettings: isSuperAdmin,
          canManageApplications: isAdmin,
          canManageContent: isAdmin,
          canManageChallenges: isSuperAdmin,
          canManageEvents: isSuperAdmin,
          canManageOpportunities: isSuperAdmin,
          canManageCertificates: isAdmin,
          canManageAssignedProjects: isProjectLead,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed';
      res.status(401).json({ verified: false, error: message });
    }
  });

  /* --------------------------------------------------------------------------
   * USERS & PROFILES
   * -------------------------------------------------------------------------- */

  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await getUserByUid(req.user!.uid);
      if (!user) {
        res.status(404).json({ error: 'User profile not found' });
        return;
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch profile' });
    }
  });

  app.put('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      let profilePhotoUrl: string | undefined = undefined;
      let profilePhotoUpdatedAt: string | undefined = undefined;

      if (typeof body.profilePhotoUrl === 'string') {
        const trimmed = body.profilePhotoUrl.trim();
        if (trimmed === '') {
          profilePhotoUrl = '';
          profilePhotoUpdatedAt = '';
        } else {
          const isValidSource =
            /^data:image\/(jpeg|jpg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(trimmed) ||
            /^https?:\/\//i.test(trimmed);
          if (!isValidSource) {
            res.status(400).json({ error: 'Profile photo must be a valid JPG, PNG, or WebP image.' });
            return;
          }
          if (trimmed.length > 750_000) {
            res.status(400).json({ error: 'Profile photo payload is too large. Please re-crop and save.' });
            return;
          }
          profilePhotoUrl = trimmed;
          profilePhotoUpdatedAt = new Date().toISOString();
        }
      }

      const updated = await updateUserProfileByUid(req.user!.uid, {
        fullName: typeof body.fullName === 'string' ? body.fullName.slice(0, 120) : undefined,
        phone: typeof body.phone === 'string' ? body.phone.slice(0, 30) : undefined,
        college: typeof body.college === 'string' ? body.college.slice(0, 150) : undefined,
        city: typeof body.city === 'string' ? body.city.slice(0, 100) : undefined,
        state: typeof body.state === 'string' ? body.state.slice(0, 100) : undefined,
        branch: typeof body.branch === 'string' ? body.branch.slice(0, 100) : undefined,
        academicYear: typeof body.academicYear === 'string' ? body.academicYear.slice(0, 30) : undefined,
        technicalSkills: Array.isArray(body.technicalSkills) ? body.technicalSkills : undefined,
        nonTechnicalSkills: Array.isArray(body.nonTechnicalSkills) ? body.nonTechnicalSkills : undefined,
        customSkills: Array.isArray(body.customSkills) ? body.customSkills : undefined,
        interests: Array.isArray(body.interests) ? body.interests : undefined,
        portfolioUrl: typeof body.portfolioUrl === 'string' ? body.portfolioUrl.slice(0, 250) : undefined,
        githubUrl: typeof body.githubUrl === 'string' ? body.githubUrl.slice(0, 250) : undefined,
        linkedinUrl: typeof body.linkedinUrl === 'string' ? body.linkedinUrl.slice(0, 250) : undefined,
        bio: typeof body.bio === 'string' ? body.bio.slice(0, 800) : undefined,
        weeklyAvailability:
          typeof body.weeklyAvailability === 'string' ? body.weeklyAvailability.slice(0, 60) : undefined,
        profilePhotoUrl,
        profilePhotoUpdatedAt,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update profile' });
    }
  });

  app.post('/api/member-card/generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userRow = await getUserByUid(req.user!.uid);
      if (!userRow) {
        res.status(404).json({ error: 'Member profile not found.' });
        return;
      }

      const eligibility = evaluateMemberCardEligibility({
        isLoggedIn: true,
        membershipStatus: userRow.membershipStatus as any,
        accountStatus: (userRow.accountStatus || 'active') as any,
        escMemberId: userRow.escMemberId,
        profilePhotoUrl: userRow.profilePhotoUrl,
      });

      if (!eligibility.eligible) {
        res.status(403).json({
          eligible: false,
          reasonCode: eligibility.reasonCode,
          error: eligibility.message,
        });
        return;
      }

      const updated = await markMemberCardGenerated(req.user!.uid);
      await recordActivityLog({
        actorUid: req.user!.uid,
        actorName: userRow.fullName || req.user!.email || 'ESC Member',
        memberUid: req.user!.uid,
        activityType: 'member_card_generated',
        title: 'Generated Official ESC Digital Member Card',
        details: `${userRow.fullName} generated their official ESC Digital Member Card (${userRow.escMemberId}).`,
        status: 'completed',
      });

      res.json({
        generated: true,
        memberCardGeneratedAt: updated?.memberCardGeneratedAt || new Date().toISOString(),
        member: {
          escMemberId: userRow.escMemberId,
          fullName: userRow.fullName,
          college: userRow.college || '',
          branch: userRow.branch || '',
          academicYear: userRow.academicYear || '',
          designation: 'ESC MEMBER',
          membershipStatus: userRow.membershipStatus,
          accountStatus: userRow.accountStatus || 'active',
          approvalDate: userRow.approvalDate || '',
          profilePhotoUrl: userRow.profilePhotoUrl || '',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to generate digital member card' });
    }
  });

  app.get('/api/members/verify/:memberId', async (req, res) => {
    try {
      const rawId = String(req.params.memberId || '').trim().toUpperCase();
      if (!rawId) {
        res.json({
          found: false,
          status: 'Invalid Member ID',
          escMemberId: '',
          message: 'Please enter a valid ESC Member ID.',
        });
        return;
      }

      const userRow = await getUserByEscMemberId(rawId);
      if (!userRow) {
        res.json({
          found: false,
          status: 'Invalid Member ID',
          escMemberId: rawId,
          message: `No official ESC member record found for ID "${rawId}".`,
        });
        return;
      }

      const verificationStatus = resolveMemberVerificationStatus({
        membershipStatus: userRow.membershipStatus,
        accountStatus: userRow.accountStatus,
        escMemberId: userRow.escMemberId,
      });

      const statusMessages: Record<string, string> = {
        Active: 'Verified active official member of Engineering Startup Company (ESC).',
        Inactive: 'This ESC membership record is currently marked inactive.',
        Suspended: 'This ESC membership record is currently suspended by ESC Administration.',
        Expired: 'This ESC membership record has expired.',
        'Invalid Member ID': `No official ESC member record found for ID "${rawId}".`,
      };

      // Strictly public verification details ONLY — never expose email, phone, address, or internal notes
      res.json({
        found: true,
        status: verificationStatus,
        escMemberId: userRow.escMemberId,
        fullName: userRow.fullName,
        designation: 'ESC MEMBER',
        college: userRow.college || '',
        branch: userRow.branch || '',
        academicYear: userRow.academicYear || '',
        approvalDate: userRow.approvalDate || '',
        profilePhotoUrl: userRow.profilePhotoUrl || '',
        memberCardGeneratedAt: userRow.memberCardGeneratedAt || '',
        message: statusMessages[verificationStatus] || 'Verified ESC member record.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to verify member ID' });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listUsers();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch users' });
    }
  });

  app.patch('/api/admin/users/:uid/role', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      const { role, membershipStatus } = req.body || {};
      if (!role || typeof role !== 'string') {
        res.status(400).json({ error: 'Valid role is required' });
        return;
      }
      const updated = await updateUserRoleByUid(uid, role, membershipStatus);
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'USER_ROLE_UPDATED',
        targetType: 'User',
        targetId: uid,
        details: `Updated user role to ${role}`,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update user role' });
    }
  });

  /* --------------------------------------------------------------------------
   * MEMBERSHIP APPLICATIONS
   * -------------------------------------------------------------------------- */

  app.get('/api/applications/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const record = await getApplicationByUserUid(req.user!.uid);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch application' });
    }
  });

  app.post('/api/applications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      const nextStatus = body.status === 'submitted' ? 'submitted' : 'draft';
      const verifiedEmail = req.user!.email || String(body.email || '');
      const technicalSkills = Array.isArray(body.technicalSkills) ? body.technicalSkills : [];
      const nonTechnicalSkills = Array.isArray(body.nonTechnicalSkills) ? body.nonTechnicalSkills : [];
      const customSkillsArr = Array.isArray(body.customSkills) ? body.customSkills : [];
      const teamGoal = String(body.teamGoal || '');

      const hasExistingIdea = Boolean(body.hasExistingIdea);
      const termsAccepted = body.termsAccepted === true;

      if (nextStatus === 'submitted') {
        if (!termsAccepted) {
          res.status(400).json({
            error: 'You must read and agree to the ESC Terms & Conditions and Privacy Policy before submitting.',
            errors: {
              termsAccepted:
                'You must read and agree to the ESC Terms & Conditions and Privacy Policy before submitting.',
            },
            firstInvalidStep: 4,
          });
          return;
        }

        const check = validateFullApplication({
          fullName: String(body.fullName || ''),
          email: verifiedEmail,
          phone: String(body.phone || ''),
          college: String(body.college || ''),
          city: String(body.city || ''),
          state: String(body.state || ''),
          branch: String(body.branch || ''),
          academicYear: String(body.academicYear || ''),
          technicalSkills,
          nonTechnicalSkills,
          customSkills: customSkillsArr,
          whyJoin: String(body.whyJoin || ''),
          weeklyAvailability: String(body.weeklyAvailability || ''),
          teamGoal: teamGoal as any,
          hasExistingIdea,
          existingIdeaSummary: String(body.existingIdeaSummary || ''),
          termsAccepted,
        });
        if (!check.isValid) {
          res.status(400).json({
            error: 'Please complete all mandatory application fields before submitting.',
            errors: check.errors,
            firstInvalidStep: check.firstInvalidStep,
          });
          return;
        }
      }

      const acceptedAt = termsAccepted
        ? typeof body.termsAcceptedAt === 'string' && body.termsAcceptedAt.trim()
          ? body.termsAcceptedAt.trim()
          : new Date().toISOString()
        : '';
      const policyVersion = termsAccepted
        ? typeof body.policyVersion === 'string' && body.policyVersion.trim()
          ? body.policyVersion.trim()
          : '1.0'
        : '';

      const appId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `app_${req.user!.uid}`;
      const saved = await upsertMembershipApplication({
        id: appId,
        userUid: req.user!.uid,
        fullName: String(body.fullName || 'Engineering Student'),
        email: verifiedEmail,
        phone: String(body.phone || ''),
        college: String(body.college || ''),
        city: String(body.city || ''),
        state: String(body.state || ''),
        branch: String(body.branch || ''),
        academicYear: String(body.academicYear || ''),
        technicalSkills,
        nonTechnicalSkills,
        customSkills: customSkillsArr,
        portfolioUrl: String(body.portfolioUrl || ''),
        githubUrl: String(body.githubUrl || ''),
        linkedinUrl: String(body.linkedinUrl || ''),
        whyJoin: String(body.whyJoin || ''),
        startupInterests: Array.isArray(body.startupInterests) ? body.startupInterests : [],
        hasExistingIdea,
        existingIdeaSummary: hasExistingIdea ? String(body.existingIdeaSummary || '') : '',
        ideaAiAssisted: false,
        teamGoal:
          teamGoal === 'build_team' || teamGoal === 'join_team' || teamGoal === 'existing_idea'
            ? teamGoal
            : 'build_team',
        weeklyAvailability: String(body.weeklyAvailability || ''),
        termsAccepted,
        termsAcceptedAt: acceptedAt,
        policyVersion,
        status: nextStatus,
      });

      if (nextStatus === 'submitted') {
        await createNotificationSafe({
          recipientType: 'user',
          recipientUid: req.user!.uid,
          title: 'Application Submitted — Under Review',
          description: `Thank you for applying to Engineering Startup Company (Application ID: ${appId}). Your application is now awaiting review by the ESC Admin Team.`,
          senderName: 'ESC Admissions',
          type: 'application_submitted',
          relatedMemberUid: req.user!.uid,
          linkTab: 'overview',
          dedupeKey: `app_submitted_user_${appId}`,
        }).catch(() => {});

        await createNotificationSafe({
          recipientType: 'admin',
          recipientUid: '',
          title: `New Fellowship Application: ${String(body.fullName || 'Student')}`,
          description: `${String(body.fullName || 'Student')} (${String(body.college || 'Engineering')}) submitted Fellowship Application ${appId}.`,
          senderName: String(body.fullName || 'Applicant'),
          type: 'application_submitted',
          relatedMemberUid: req.user!.uid,
          linkTab: 'applications',
          dedupeKey: `app_submitted_admin_${appId}`,
        }).catch(() => {});
      }

      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save application' });
    }
  });

  app.get('/api/admin/applications', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listAllApplications();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch applications' });
    }
  });

  app.patch('/api/admin/applications/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { status, adminNotes } = req.body || {};
      if (!status || typeof status !== 'string') {
        res.status(400).json({ error: 'Application status is required' });
        return;
      }

      // Approving via applications route uses the exact atomic approval transaction (Member ID + Active + Notifications)
      if (status === 'approved') {
        const approvalResult = await approveEscMemberTransaction({
          targetUid: '',
          applicationId: req.params.id,
          adminUid: req.user!.uid,
          adminEmail: req.user!.email || 'Admin',
          adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
        });
        await createAdminAuditLog({
          adminUid: req.user!.uid,
          adminEmail: req.user!.email || '',
          action: 'APPLICATION_APPROVED',
          targetType: 'Application',
          targetId: req.params.id,
          details: `Approved application ${req.params.id} and issued Member ID ${approvalResult.escMemberId}`,
        }).catch(() => {});
        res.json({
          id: req.params.id,
          status: 'approved',
          escMemberId: approvalResult.escMemberId,
          user: approvalResult.user,
        });
        return;
      }

      const updated = await updateApplicationReview({
        id: req.params.id,
        status,
        adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
        reviewedBy: req.user!.email || req.user!.uid,
      });
      if (!updated) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      const statusLabel = status.replace(/_/g, ' ').toUpperCase();
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: updated.userUid,
        title:
          status === 'rejected'
            ? 'ESC Application Update: Not Approved'
            : status === 'under_review'
            ? 'ESC Application Is Under Review'
            : `ESC Application Update: ${statusLabel}`,
        description:
          status === 'rejected'
            ? `Your ESC Fellowship application was not approved at this time.${typeof adminNotes === 'string' && adminNotes.trim() ? ` Reviewer note: ${adminNotes.trim()}` : ''}`
            : `Your ESC Fellowship application status is now ${statusLabel}.${typeof adminNotes === 'string' && adminNotes.trim() ? ` Reviewer note: ${adminNotes.trim()}` : ''}`,
        senderName: req.user!.email || 'ESC Admin',
        type: status === 'rejected' ? 'application_rejected' : 'application_under_review',
        relatedMemberUid: updated.userUid,
        linkTab: 'overview',
      }).catch(() => {});

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `APPLICATION_${status.toUpperCase()}`,
        targetType: 'Application',
        targetId: req.params.id,
        details: `Updated application ${req.params.id} to ${status}${typeof adminNotes === 'string' && adminNotes.trim() ? ` — ${adminNotes.trim()}` : ''}`,
      }).catch(() => {});

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update application' });
    }
  });

  /* --------------------------------------------------------------------------
   * CHALLENGES
   * -------------------------------------------------------------------------- */

  app.get('/api/challenges', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const includeUnpublished = Boolean(req.isSuperAdmin && req.query.all === 'true');
      const rows = await listChallenges(includeUnpublished);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load challenges' });
    }
  });

  app.get('/api/challenges/my-activity', requireAuth, async (req: AuthRequest, res) => {
    try {
      const activity = await getUserChallengeActivity(req.user!.uid);
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load challenge activity' });
    }
  });

  app.post('/api/challenges', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `chal_${Date.now()}`;
      const saved = await upsertChallenge({
        id,
        title: String(b.title || ''),
        description: String(b.description || ''),
        category: String(b.category || 'Engineering'),
        posterUrl: String(b.posterUrl || ''),
        eligibility: String(b.eligibility || ''),
        requiredSkills: Array.isArray(b.requiredSkills) ? b.requiredSkills : [],
        participationType: String(b.participationType || 'both'),
        minTeamSize: Number(b.minTeamSize || 1),
        maxTeamSize: Number(b.maxTeamSize || 4),
        startDateTime: String(b.startDateTime || ''),
        registrationDeadline: String(b.registrationDeadline || ''),
        submissionDeadline: String(b.submissionDeadline || ''),
        rules: String(b.rules || ''),
        submissionInstructions: String(b.submissionInstructions || ''),
        requiredSubmissionFiles: Array.isArray(b.requiredSubmissionFiles)
          ? b.requiredSubmissionFiles
          : [],
        prizeOrRewards: String(b.prizeOrRewards || ''),
        certificateAvailable: Boolean(b.certificateAvailable ?? true),
        contactInfo: String(b.contactInfo || ''),
        status: String(b.status || 'draft'),
        isPublished: Boolean(b.isPublished),
        registeredCount: Number(b.registeredCount || 0),
        submissionCount: Number(b.submissionCount || 0),
        createdBy: req.user!.email || req.user!.uid,
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save challenge' });
    }
  });

  app.put('/api/challenges/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const saved = await upsertChallenge({
        ...b,
        id: req.params.id,
        createdBy: b.createdBy || req.user!.email || req.user!.uid,
      });
      res.json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update challenge' });
    }
  });

  app.delete('/api/challenges/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await deleteChallengeById(req.params.id);
      res.json({ deleted: Boolean(deleted), id: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete challenge' });
    }
  });

  app.post('/api/challenges/:id/register', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const regId =
        typeof b.id === 'string' && b.id.trim()
          ? b.id.trim()
          : `chalreg_${req.user!.uid}_${req.params.id}`;
      const result = await registerForChallenge({
        id: regId,
        challengeId: req.params.id,
        challengeTitle: String(b.challengeTitle || ''),
        userUid: req.user!.uid,
        userName: String(b.userName || req.user!.name || 'Engineering Student'),
        userEmail: req.user!.email || '',
        college: String(b.college || ''),
        branch: String(b.branch || ''),
        participationMode: b.participationMode === 'team' ? 'team' : 'individual',
        teamName: String(b.teamName || ''),
        teamMembers: Array.isArray(b.teamMembers) ? b.teamMembers : [],
        skillsSummary: String(b.skillsSummary || ''),
        status: 'registered',
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to register for challenge' });
    }
  });

  app.post('/api/challenges/:id/submit', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const subId =
        typeof b.id === 'string' && b.id.trim()
          ? b.id.trim()
          : `chalsub_${req.user!.uid}_${req.params.id}`;
      const saved = await submitToChallenge({
        id: subId,
        challengeId: req.params.id,
        challengeTitle: String(b.challengeTitle || ''),
        userUid: req.user!.uid,
        userName: String(b.userName || req.user!.name || 'Engineering Student'),
        userEmail: req.user!.email || '',
        teamName: String(b.teamName || ''),
        projectTitle: String(b.projectTitle || ''),
        summary: String(b.summary || ''),
        repoUrl: String(b.repoUrl || ''),
        demoVideoUrl: String(b.demoVideoUrl || ''),
        deckOrDocUrl: String(b.deckOrDocUrl || ''),
        deliverablesChecklist: Array.isArray(b.deliverablesChecklist)
          ? b.deliverablesChecklist
          : [],
        notes: String(b.notes || ''),
        reviewStatus: 'submitted',
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit challenge project' });
    }
  });

  /* --------------------------------------------------------------------------
   * EVENTS
   * -------------------------------------------------------------------------- */

  app.get('/api/events', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const includeUnpublished = Boolean(req.isSuperAdmin && req.query.all === 'true');
      const rows = await listEvents(includeUnpublished);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load events' });
    }
  });

  app.get('/api/events/my-registrations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await getUserEventRegistrations(req.user!.uid);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load registrations' });
    }
  });

  app.post('/api/events', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `ev_${Date.now()}`;
      const saved = await upsertEvent({
        id,
        title: String(b.title || ''),
        description: String(b.description || ''),
        posterUrl: String(b.posterUrl || ''),
        type: String(b.type || 'workshop'),
        date: String(b.date || ''),
        startDateTime: String(b.startDateTime || ''),
        location: String(b.location || ''),
        meetingLink: String(b.meetingLink || ''),
        registrationDeadline: String(b.registrationDeadline || ''),
        eligibility: String(b.eligibility || ''),
        maxParticipants: Number(b.maxParticipants || 100),
        registeredCount: Number(b.registeredCount || 0),
        instructions: String(b.instructions || ''),
        contactInfo: String(b.contactInfo || ''),
        certificateAvailable: Boolean(b.certificateAvailable ?? true),
        status: String(b.status || 'draft'),
        isPublished: Boolean(b.isPublished),
        prizes: String(b.prizes || ''),
        schedule: String(b.schedule || ''),
        createdBy: req.user!.email || req.user!.uid,
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save event' });
    }
  });

  app.put('/api/events/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const saved = await upsertEvent({
        ...b,
        id: req.params.id,
        createdBy: b.createdBy || req.user!.email || req.user!.uid,
      });
      res.json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update event' });
    }
  });

  app.delete('/api/events/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await deleteEventById(req.params.id);
      res.json({ deleted: Boolean(deleted), id: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete event' });
    }
  });

  app.post('/api/events/:id/register', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const regId =
        typeof b.id === 'string' && b.id.trim()
          ? b.id.trim()
          : `reg_${req.user!.uid}_${req.params.id}`;
      const result = await registerForEvent({
        id: regId,
        eventId: req.params.id,
        eventTitle: String(b.eventTitle || ''),
        userUid: req.user!.uid,
        userName: String(b.userName || req.user!.name || 'Engineering Student'),
        userEmail: req.user!.email || '',
        college: String(b.college || ''),
        phone: String(b.phone || ''),
        notes: String(b.notes || ''),
        status: 'confirmed',
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to register for event' });
    }
  });

  /* --------------------------------------------------------------------------
   * OPPORTUNITIES
   * -------------------------------------------------------------------------- */

  app.get('/api/opportunities', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const includeUnpublished = Boolean(req.isSuperAdmin && req.query.all === 'true');
      const rows = await listOpportunities(includeUnpublished);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load opportunities' });
    }
  });

  app.get('/api/opportunities/my-applications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await getUserOpportunityApplications(req.user!.uid);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load opportunity applications' });
    }
  });

  app.post('/api/opportunities', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `opp_${Date.now()}`;
      const saved = await upsertOpportunity({
        id,
        title: String(b.title || ''),
        category: String(b.category || 'grant'),
        organization: String(b.organization || ''),
        posterUrl: String(b.posterUrl || ''),
        description: String(b.description || ''),
        allocationOrStipend: String(b.allocationOrStipend || ''),
        eligibility: String(b.eligibility || ''),
        requiredSkills: Array.isArray(b.requiredSkills) ? b.requiredSkills : [],
        locationOrMode: String(b.locationOrMode || ''),
        applicationDeadline: String(b.applicationDeadline || ''),
        applyInstructions: String(b.applyInstructions || ''),
        externalApplyUrl: String(b.externalApplyUrl || ''),
        contactInfo: String(b.contactInfo || ''),
        status: String(b.status || 'draft'),
        isPublished: Boolean(b.isPublished),
        applicationsCount: Number(b.applicationsCount || 0),
        createdBy: req.user!.email || req.user!.uid,
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save opportunity' });
    }
  });

  app.put('/api/opportunities/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const saved = await upsertOpportunity({
        ...b,
        id: req.params.id,
        createdBy: b.createdBy || req.user!.email || req.user!.uid,
      });
      res.json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update opportunity' });
    }
  });

  app.delete('/api/opportunities/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await deleteOpportunityById(req.params.id);
      res.json({ deleted: Boolean(deleted), id: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete opportunity' });
    }
  });

  app.post('/api/opportunities/:id/apply', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const appId =
        typeof b.id === 'string' && b.id.trim()
          ? b.id.trim()
          : `oppapp_${req.user!.uid}_${req.params.id}`;
      const result = await applyToOpportunity({
        id: appId,
        opportunityId: req.params.id,
        opportunityTitle: String(b.opportunityTitle || ''),
        userUid: req.user!.uid,
        userName: String(b.userName || req.user!.name || 'Engineering Student'),
        userEmail: req.user!.email || '',
        college: String(b.college || ''),
        branch: String(b.branch || ''),
        portfolioUrl: String(b.portfolioUrl || ''),
        statement: String(b.statement || ''),
        status: 'submitted',
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit opportunity application' });
    }
  });

  /* --------------------------------------------------------------------------
   * IDEAS, PROBLEMS, PROJECTS, CERTIFICATES, ANNOUNCEMENTS, ADMIN OVERVIEW
   * -------------------------------------------------------------------------- */

  app.get('/api/ideas', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await listIdeas(req.user?.uid, req.isAdmin);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load ideas' });
    }
  });

  app.post('/api/ideas', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const title = String(b.title || '').trim();
      const problemStatement = String(b.problemStatement || '').trim();
      const proposedSolution = String(b.proposedSolution || '').trim();
      if (title.length < 3 || problemStatement.length < 10 || proposedSolution.length < 10) {
        res.status(400).json({ error: 'Title, problem statement, and proposed solution are required.' });
        return;
      }

      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `idea_${Date.now()}`;
      const aiAssisted = Boolean(b.aiAssisted);
      // Security & Governance: Student & AI-assisted ideas ALWAYS start as under_review & non-public until Admin approval
      const saved = await upsertIdea({
        id,
        authorUid: req.user!.uid,
        authorName: String(b.authorName || req.user!.name || 'Engineering Student'),
        authorEmail: req.user!.email || '',
        title,
        problemStatement,
        targetAudience: String(b.targetAudience || ''),
        proposedSolution,
        industry: String(b.industry || 'DeepTech'),
        uniqueValueProposition: String(b.uniqueValueProposition || ''),
        stage: String(b.stage || 'idea'),
        demoUrl: String(b.demoUrl || ''),
        skillsRequired: Array.isArray(b.skillsRequired) ? b.skillsRequired : [],
        teamRequirements: String(b.teamRequirements || ''),
        fundingRequirements: String(b.fundingRequirements || ''),
        isPublic: false,
        reviewStatus: 'under_review',
        aiAssisted,
      });

      await recordActivityLog({
        actorUid: req.user!.uid,
        actorName: String(b.authorName || req.user!.name || 'Engineering Student'),
        memberUid: req.user!.uid,
        activityType: 'idea_submitted',
        title: `Startup idea submitted: ${title}`,
        details: aiAssisted
          ? 'Submitted AI-assisted startup proposal (Status: Under Review)'
          : 'Submitted startup proposal (Status: Under Review)',
        status: 'under_review',
      });

      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save startup idea' });
    }
  });

  app.patch('/api/admin/ideas/:id/review', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const allowed = ['under_review', 'changes_requested', 'approved', 'rejected', 'cancelled'];
      const reviewStatus = String(req.body?.reviewStatus || '').trim();
      const adminFeedback = typeof req.body?.adminFeedback === 'string' ? req.body.adminFeedback.trim() : '';

      if (!allowed.includes(reviewStatus)) {
        res.status(400).json({ error: 'Invalid idea review decision status.' });
        return;
      }

      const updated = await reviewIdeaById({
        id: req.params.id,
        reviewStatus: reviewStatus as any,
        adminFeedback,
        adminEmail: req.user!.email || req.user!.uid,
      });

      if (!updated) {
        res.status(404).json({ error: 'Startup idea not found in database.' });
        return;
      }

      await Promise.all([
        createAdminAuditLog({
          adminUid: req.user!.uid,
          adminEmail: req.user!.email || '',
          action: `IDEA_${reviewStatus.toUpperCase()}`,
          targetType: 'StartupIdea',
          targetId: updated.id,
          details: `Marked "${updated.title}" as ${reviewStatus}${adminFeedback ? ` — ${adminFeedback}` : ''}`,
        }),
        recordActivityLog({
          actorUid: req.user!.uid,
          actorName: req.user!.email || 'ESC Admin',
          memberUid: updated.authorUid,
          activityType: 'idea_reviewed',
          title: `Idea "${updated.title}" marked ${reviewStatus.replace('_', ' ')}`,
          details: adminFeedback || `Decision recorded by ${req.user!.email || 'ESC Admin'}`,
          status: reviewStatus,
        }),
      ]);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to record idea review decision' });
    }
  });

  /* --------------------------------------------------------------------------
   * SEARCHABLE CUSTOM SKILLS & ADMIN MODERATION
   * -------------------------------------------------------------------------- */

  app.get('/api/skills/custom', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await listCustomSkills({
        includeAll: Boolean(req.isAdmin),
        viewerUid: req.user?.uid,
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load custom skills' });
    }
  });

  app.post('/api/skills/custom', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawName = String(req.body?.name || '').trim();
      const skillType = req.body?.skillType === 'non_technical' ? 'non_technical' : 'technical';
      const category = typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 80) : '';

      if (rawName.length < 2 || rawName.length > 80) {
        res.status(400).json({ error: 'Skill name must be between 2 and 80 characters.' });
        return;
      }

      const norm = normalizeSkillName(rawName);
      const predefinedMatch = ALL_PREDEFINED_SKILLS.find((s) => s.normalized === norm);
      if (predefinedMatch) {
        res.status(200).json({
          skill: {
            id: `predefined_${predefinedMatch.normalized}`,
            name: predefinedMatch.name,
            normalizedName: predefinedMatch.normalized,
            skillType: predefinedMatch.kind,
            category: predefinedMatch.categoryLabel,
            status: 'approved',
          },
          predefined: true,
        });
        return;
      }

      const result = await createOrIncrementCustomSkill({
        name: rawName,
        skillType,
        category,
        submittedByUid: req.user!.uid,
        submittedByName: req.user!.name || req.user!.email || 'ESC Student',
        autoApprove: Boolean(req.isAdmin),
      });

      res.status(result.existed ? 200 : 201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to add custom skill' });
    }
  });

  app.get('/api/admin/skills/custom', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listCustomSkills({ includeAll: true });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load custom skills' });
    }
  });

  app.patch('/api/admin/skills/custom/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const action = String(req.body?.action || '').trim();
      if (!['approve', 'reject', 'rename', 'merge'].includes(action)) {
        res.status(400).json({ error: 'Invalid moderation action.' });
        return;
      }

      const updated = await moderateCustomSkill(req.params.id, {
        action: action as any,
        newName: typeof req.body?.newName === 'string' ? req.body.newName : undefined,
        skillType:
          req.body?.skillType === 'non_technical'
            ? 'non_technical'
            : req.body?.skillType === 'technical'
              ? 'technical'
              : undefined,
        category: typeof req.body?.category === 'string' ? req.body.category : undefined,
        mergeTargetName: typeof req.body?.mergeTargetName === 'string' ? req.body.mergeTargetName : undefined,
        adminEmail: req.user!.email || req.user!.uid,
      });

      if (!updated) {
        res.status(404).json({ error: 'Custom skill not found.' });
        return;
      }

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `CUSTOM_SKILL_${action.toUpperCase()}`,
        targetType: 'CustomSkill',
        targetId: updated.id,
        details: `Action "${action}" on skill "${updated.name}"${updated.mergedInto ? ` -> "${updated.mergedInto}"` : ''}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to moderate custom skill' });
    }
  });

  app.delete('/api/admin/skills/custom/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deleteCustomSkillById(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Custom skill not found.' });
        return;
      }
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'CUSTOM_SKILL_DELETED',
        targetType: 'CustomSkill',
        targetId: deleted.id,
        details: `Removed custom skill "${deleted.name}"`,
      });
      res.json({ deleted: true, id: deleted.id });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete custom skill' });
    }
  });

  app.get('/api/problems', async (_req, res) => {
    try {
      const rows = await listProblems();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load problem statements' });
    }
  });

  app.post('/api/problems', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `prob_${Date.now()}`;
      const saved = await upsertProblem({
        id,
        authorUid: req.user!.uid,
        authorName: String(b.authorName || req.user!.name || 'Engineering Student'),
        title: String(b.title || ''),
        description: String(b.description || ''),
        industry: String(b.industry || 'Infrastructure'),
        difficulty: String(b.difficulty || 'intermediate'),
        status: String(b.status || 'open'),
        skillsRequired: Array.isArray(b.skillsRequired) ? b.skillsRequired : [],
        interestedUserIds: Array.isArray(b.interestedUserIds) ? b.interestedUserIds : [],
        interestCount: Number(b.interestCount || 0),
        verifiedByAdmin: Boolean(b.verifiedByAdmin && req.isAdmin),
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save problem statement' });
    }
  });

  app.get('/api/projects', async (_req, res) => {
    try {
      const rows = await listProjects();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load projects' });
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = await getUserByUid(req.user!.uid);
      const isActiveApproved =
        Boolean(req.isAdmin) ||
        ((me?.membershipStatus === 'approved' ||
          Boolean(me?.escMemberId) ||
          ['member', 'project_lead', 'lead', 'mentor'].includes(me?.role || '')) &&
          (me?.accountStatus || 'active') === 'active');
      if (!isActiveApproved) {
        res.status(403).json({
          error: 'Only approved and active ESC members can submit or launch engineering projects.',
        });
        return;
      }

      const b = req.body || {};
      const check = validateMemberProjectInput({
        title: String(b.title || ''),
        description: String(b.description || ''),
        category: String(b.category || ''),
        problemStatement: typeof b.problemStatement === 'string' ? b.problemStatement : undefined,
        proposedSolution: typeof b.proposedSolution === 'string' ? b.proposedSolution : undefined,
        stage: typeof b.stage === 'string' ? b.stage : undefined,
        repoUrl: typeof b.repoUrl === 'string' ? b.repoUrl : '',
        demoUrl: typeof b.demoUrl === 'string' ? b.demoUrl : '',
        websiteUrl: typeof b.websiteUrl === 'string' ? b.websiteUrl : '',
        docsUrl: typeof b.docsUrl === 'string' ? b.docsUrl : '',
        imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : '',
      });
      if (!check.isValid) {
        const firstErr = Object.values(check.errors)[0] || 'Please complete all required project fields.';
        res.status(400).json({ error: firstErr, errors: check.errors });
        return;
      }

      const allowedMemberStatuses = new Set(['draft', 'submitted', 'recruiting']);
      const requestedStatus = String(b.status || 'submitted');
      const safeStatus = req.isAdmin
        ? requestedStatus
        : allowedMemberStatuses.has(requestedStatus)
        ? requestedStatus
        : 'submitted';

      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `proj_${Date.now()}`;
      const saved = await upsertProject({
        id,
        leaderUid: req.user!.uid,
        leaderName: String(b.leaderName || me?.fullName || req.user!.name || 'Engineering Student'),
        leaderEmail: req.user!.email || '',
        title: String(b.title || '').trim(),
        description: String(b.description || '').trim(),
        category: String(b.category || 'Engineering').trim(),
        objectives: Array.isArray(b.objectives) ? b.objectives : [],
        requiredSkills: Array.isArray(b.requiredSkills) ? b.requiredSkills : [],
        teamMemberIds: Array.isArray(b.teamMemberIds) ? b.teamMemberIds : [req.user!.uid],
        teamMembers: Array.isArray(b.teamMembers)
          ? b.teamMembers
          : [{ id: req.user!.uid, name: me?.fullName || req.user!.name || 'Project Lead', role: 'Project Lead' }],
        status: safeStatus,
        demoUrl: String(b.demoUrl || b.websiteUrl || '').trim(),
        repoUrl: String(b.repoUrl || '').trim(),
        milestones: Array.isArray(b.milestones) ? b.milestones : [],
        tasks: Array.isArray(b.tasks) ? b.tasks : [],
      });

      if (safeStatus === 'submitted' || safeStatus === 'recruiting') {
        await createNotificationSafe({
          recipientType: 'user',
          recipientUid: req.user!.uid,
          title: `Project Submitted: ${String(b.title || '').trim()}`,
          description: `Your project "${String(b.title || '').trim()}" has been saved and queued for ESC review.`,
          senderName: 'ESC Projects Desk',
          type: 'project_submitted',
          relatedMemberUid: req.user!.uid,
          linkTab: 'projects',
          dedupeKey: `proj_sub_user_${id}`,
        }).catch(() => {});

        await createNotificationSafe({
          recipientType: 'admin',
          recipientUid: '',
          title: `New Member Project: ${String(b.title || '').trim()}`,
          description: `${me?.fullName || req.user!.name || 'ESC Member'} submitted "${String(b.title || '').trim()}" (${String(b.category || 'Engineering')}).`,
          senderName: me?.fullName || req.user!.name || 'ESC Member',
          type: 'project_submitted',
          relatedMemberUid: req.user!.uid,
          linkTab: 'projects',
          dedupeKey: `proj_sub_admin_${id}`,
        }).catch(() => {});
      }

      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save project' });
    }
  });

  app.patch('/api/admin/projects/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const validStatuses = new Set([
        'draft',
        'submitted',
        'under_review',
        'approved',
        'recruiting',
        'in_progress',
        'review',
        'completed',
        'rejected',
      ]);
      const nextStatus = typeof b.status === 'string' && validStatuses.has(b.status) ? b.status : 'approved';
      const existingAll = await listProjects();
      const target = existingAll.find((p) => p.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const updated = await upsertProject({
        id: target.id,
        leaderUid: target.leaderUid,
        leaderName: target.leaderName,
        leaderEmail: target.leaderEmail || '',
        title: typeof b.title === 'string' && b.title.trim() ? b.title.trim() : target.title,
        description: typeof b.description === 'string' && b.description.trim() ? b.description.trim() : target.description,
        category: typeof b.category === 'string' && b.category.trim() ? b.category.trim() : target.category,
        objectives: Array.isArray(b.objectives) ? b.objectives : target.objectives,
        requiredSkills: Array.isArray(b.requiredSkills) ? b.requiredSkills : target.requiredSkills,
        teamMemberIds: target.teamMemberIds,
        teamMembers: target.teamMembers,
        status: nextStatus,
        demoUrl: typeof b.demoUrl === 'string' ? b.demoUrl : target.demoUrl || '',
        repoUrl: typeof b.repoUrl === 'string' ? b.repoUrl : target.repoUrl || '',
        milestones: target.milestones,
        tasks: target.tasks,
      });

      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: target.leaderUid,
        title: `Project Status Updated: ${updated.title}`,
        description: `Your project "${updated.title}" is now marked as ${nextStatus.replace(/_/g, ' ').toUpperCase()}.${typeof b.adminFeedback === 'string' && b.adminFeedback.trim() ? ` Note: ${b.adminFeedback.trim()}` : ''}`,
        senderName: req.user!.email || 'ESC Admin',
        type: 'project_reviewed',
        relatedMemberUid: target.leaderUid,
        linkTab: 'projects',
      }).catch(() => {});

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `PROJECT_${nextStatus.toUpperCase()}`,
        targetType: 'Project',
        targetId: target.id,
        details: `Updated project "${updated.title}" status to ${nextStatus}`,
      }).catch(() => {});

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update project' });
    }
  });

  app.get('/api/certificates/verify/:certId', async (req, res) => {
    try {
      const record = await getCertificateByCertId(req.params.certId);
      if (!record) {
        res.status(404).json({ error: 'Certificate not found' });
        return;
      }
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to verify certificate' });
    }
  });

  app.get('/api/admin/certificates', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listCertificates();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch certificates' });
    }
  });

  app.post('/api/admin/certificates', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const saved = await upsertCertificate({
        certId: String(b.certId || '').toUpperCase(),
        studentUid: String(b.studentId || b.studentUid || 'ESC-STU'),
        studentName: String(b.studentName || ''),
        studentEmail: String(b.studentEmail || ''),
        certificateTitle: String(b.certificateTitle || ''),
        competitionName: String(b.competitionName || ''),
        achievement: String(b.achievement || ''),
        activityName: String(b.activityName || ''),
        organization: String(b.organization || 'Engineering Startup Company (ESC)'),
        issueDate: String(b.issueDate || ''),
        authorizedSigner: String(b.authorizedSigner || ''),
        authorizedSignerTitle: String(b.authorizedSignerTitle || ''),
        logoUrl: String(b.logoUrl || ''),
        signatureUrl: String(b.signatureUrl || ''),
        templateStyle: String(b.templateStyle || 'charcoal_editorial'),
        verificationHash: String(b.verificationHash || ''),
        verificationUrl: String(b.verificationUrl || ''),
        status: b.status === 'revoked' ? 'revoked' : 'valid',
        downloadedAt: b.downloadedAt || null,
        downloadCount: Number(b.downloadCount || 0),
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save certificate' });
    }
  });

  app.get('/api/announcements', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const activeOnly = !(req.isAdmin && req.query.all === 'true');
      const rows = await listAnnouncements(activeOnly);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load announcements' });
    }
  });

  app.post('/api/admin/announcements', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `ann_${Date.now()}`;
      const saved = await upsertAnnouncement({
        id,
        title: String(b.title || ''),
        message: String(b.message || ''),
        type: String(b.type || 'info'),
        linkPath: String(b.linkPath || ''),
        linkLabel: String(b.linkLabel || ''),
        isActive: Boolean(b.isActive ?? true),
        isPinned: Boolean(b.isPinned ?? false),
        createdBy: req.user!.email || req.user!.uid,
      });
      res.status(201).json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save announcement' });
    }
  });

  app.delete('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const deleted = await deleteAnnouncementById(req.params.id);
      res.json({ deleted: Boolean(deleted), id: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete announcement' });
    }
  });

  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const overview = await getAdminOverviewData();
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load admin overview' });
    }
  });

  /* --------------------------------------------------------------------------
   * SITE SETTINGS (WHATSAPP COMMUNITY LINK & GUIDELINES)
   * -------------------------------------------------------------------------- */

  app.get('/api/site-settings', async (_req, res) => {
    try {
      const settings = await getSiteSettingsSql();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch site settings' });
    }
  });

  app.put('/api/admin/site-settings', requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const rawUpiId = typeof b.upiId === 'string' ? b.upiId.trim() : '';
      if (rawUpiId && !isValidUpiId(rawUpiId)) {
        res.status(400).json({
          error: 'Invalid UPI ID format. Use a valid VPA like 9420482152-2@ybl or esc@okaxis.',
        });
        return;
      }
      const upiId = rawUpiId;
      const upiPayeeName =
        typeof b.upiPayeeName === 'string' && b.upiPayeeName.trim()
          ? b.upiPayeeName.trim().slice(0, 60)
          : 'ESC';
      const parsedPrice = Number(b.physicalCardPrice);
      const physicalCardPrice = resolveConfiguredCardPrice(
        Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined
      );

      const saved = await upsertSiteSettingsSql({
        heroBadgeText: String(b.heroBadgeText || 'Think. Engineer. Build. Launch.'),
        heroAnnouncement: String(b.heroAnnouncement || ''),
        applicationsOpen: Boolean(b.applicationsOpen ?? true),
        applicationCycleLabel: String(b.applicationCycleLabel || 'Student-Led Engineering Ecosystem'),
        contactEmail: String(b.contactEmail || 'contact@esc.community'),
        whatsappCommunityUrl: String(b.whatsappCommunityUrl || '').trim(),
        communityGuidelines: String(b.communityGuidelines || '').trim(),
        upiId,
        upiPayeeName,
        physicalCardPrice,
        updatedBy: req.user!.email || req.user!.uid,
      });
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'SITE_SETTINGS_UPDATED',
        targetType: 'SiteSettings',
        targetId: 'public',
        details: `Updated global site settings, WhatsApp link & UPI config (${upiId}, ₹${physicalCardPrice})`,
      });
      res.json(saved);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to save site settings' });
    }
  });

  /* --------------------------------------------------------------------------
   * MEMBER APPROVAL, DIRECTORY & 360 MANAGEMENT
   * -------------------------------------------------------------------------- */

  app.post('/api/admin/members/approve', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { userUid, applicationId, adminNotes } = req.body || {};
      if (!userUid && !applicationId) {
        res.status(400).json({ error: 'userUid or applicationId is required' });
        return;
      }
      const result = await approveEscMemberTransaction({
        targetUid: String(userUid || ''),
        applicationId: applicationId ? String(applicationId) : undefined,
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || 'Admin',
        adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
      });
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'MEMBER_APPROVED',
        targetType: 'User',
        targetId: result.user.uid,
        details: `Approved ${result.user.fullName} with Member ID ${result.escMemberId}`,
      });
      res.json({
        ...result,
        emailDelivery: {
          configured: false,
          note: 'Official approval notification & Member ID delivered to member dashboard (SMTP not configured).',
        },
      });
    } catch (error: any) {
      const msg = error?.message || 'Failed to approve member';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.patch('/api/admin/members/:uid', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      const b = req.body || {};

      // Only Super Admin can assign or modify admin/superadmin roles
      if (b.role && (b.role === 'admin' || b.role === 'superadmin') && !req.isSuperAdmin) {
        res.status(403).json({ error: 'Only Super Admin can assign Admin or Super Admin roles.' });
        return;
      }

      const patch: Record<string, any> = {};
      if (typeof b.fullName === 'string' && b.fullName.trim()) patch.fullName = b.fullName.trim();
      if (typeof b.college === 'string') patch.college = b.college.trim();
      if (typeof b.branch === 'string') patch.branch = b.branch.trim();
      if (typeof b.academicYear === 'string') patch.academicYear = b.academicYear.trim();
      if (Array.isArray(b.technicalSkills)) patch.technicalSkills = b.technicalSkills;
      if (b.accountStatus && ['active', 'inactive', 'suspended', 'expired'].includes(b.accountStatus)) {
        patch.accountStatus = b.accountStatus;
      }
      if (typeof b.role === 'string') patch.role = b.role;
      if (typeof b.membershipStatus === 'string') patch.membershipStatus = b.membershipStatus;

      const updated = await adminUpdateMemberByUid(uid, patch);
      if (!updated) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      await recordActivityLog({
        actorUid: req.user!.uid,
        actorName: req.user!.email || 'Admin',
        memberUid: uid,
        activityType: b.accountStatus === 'suspended' ? 'member_suspended' : 'member_updated',
        title: `Admin updated member profile`,
        details: `${req.user!.email} updated ${updated.fullName} (${Object.keys(patch).join(', ')})`,
        status: updated.accountStatus,
      });

      if (b.accountStatus === 'suspended' || b.accountStatus === 'active') {
        await createNotificationSafe({
          recipientType: 'user',
          recipientUid: uid,
          title: b.accountStatus === 'suspended' ? 'Account Status: Suspended' : 'Account Reactivated',
          description:
            b.accountStatus === 'suspended'
              ? 'Your ESC member access has been suspended by an administrator. Contact ESC support for details.'
              : 'Your ESC member account has been reactivated. Full portal features are restored.',
          senderName: req.user!.email || 'ESC Admin',
          type: 'admin_notice',
          relatedMemberUid: uid,
          linkTab: 'overview',
        });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update member' });
    }
  });

  app.get('/api/admin/members/:uid/details', requireAuth, requireAdmin, async (req, res) => {
    try {
      const details = await getMemberFullDetails(req.params.uid);
      if (!details) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json(details);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load member details' });
    }
  });

  app.get('/api/members/directory', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = await getUserByUid(req.user!.uid);
      const isApproved =
        req.isAdmin ||
        me?.membershipStatus === 'approved' ||
        Boolean(me?.escMemberId) ||
        ['member', 'project_lead', 'lead', 'mentor'].includes(me?.role || '');
      const isAccountActive = (me?.accountStatus || 'active') === 'active';
      if (!isApproved || !isAccountActive) {
        res.status(403).json({ error: 'Only active approved ESC members can browse the member directory.' });
        return;
      }
      const rows = await listApprovedMemberDirectory();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load member directory' });
    }
  });

  /* --------------------------------------------------------------------------
   * STARTUP TEAMS, FIND A TEAM, INVITATIONS & TEAM CHAT (BACKEND ENFORCED)
   * -------------------------------------------------------------------------- */

  app.get('/api/teams/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getMemberTeamsAndInvitations(req.user!.uid);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load startup team data' });
    }
  });

  app.get('/api/teams/directory', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = await getUserByUid(req.user!.uid);
      const isApproved =
        req.isAdmin ||
        me?.membershipStatus === 'approved' ||
        Boolean(me?.escMemberId) ||
        ['member', 'project_lead', 'lead', 'mentor'].includes(me?.role || '');
      const isAccountActive = (me?.accountStatus || 'active') === 'active';
      if (!isApproved || !isAccountActive) {
        res.status(403).json({ error: 'Only active approved ESC members can browse startup teams.' });
        return;
      }
      const rows = await listPublicStartupTeamsDirectory(req.user!.uid);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load startup team directory' });
    }
  });

  app.post('/api/teams/:id/join-request', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = await getUserByUid(req.user!.uid);
      const isApproved =
        req.isAdmin ||
        me?.membershipStatus === 'approved' ||
        Boolean(me?.escMemberId) ||
        ['member', 'project_lead', 'lead', 'mentor'].includes(me?.role || '');
      const isAccountActive = (me?.accountStatus || 'active') === 'active';
      if (!isApproved || !isAccountActive) {
        res.status(403).json({ error: 'Only active approved ESC members can request to join a startup team.' });
        return;
      }
      const { message } = req.body || {};
      const created = await requestToJoinTeamTransaction({
        teamId: req.params.id,
        requesterUid: req.user!.uid,
        message: typeof message === 'string' ? message : undefined,
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to submit team join request';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.get('/api/admin/teams', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const teams = await listAllStartupTeams();
      res.json(teams);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load startup teams' });
    }
  });

  app.post('/api/teams', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const validation = validateStartupTeamInput({
        name: b.name,
        problemStatement: b.problemStatement,
        proposedSolution: b.proposedSolution,
        ideaDescription: b.ideaDescription,
        domain: b.domain,
        stage: b.stage,
        skillsRequired: Array.isArray(b.skillsRequired) ? b.skillsRequired : [],
        expectedOutcome: b.expectedOutcome,
      });
      if (!validation.isValid) {
        const firstErr = Object.values(validation.errors)[0] || 'Invalid startup team input';
        res.status(400).json({ error: firstErr, errors: validation.errors });
        return;
      }
      const created = await createStartupTeamTransaction({
        leaderUid: req.user!.uid,
        name: String(b.name),
        problemStatement: String(b.problemStatement),
        proposedSolution: String(b.proposedSolution),
        ideaDescription: String(b.ideaDescription),
        domain: String(b.domain),
        stage: String(b.stage || 'idea'),
        skillsRequired: Array.isArray(b.skillsRequired) ? b.skillsRequired : [],
        expectedOutcome: String(b.expectedOutcome),
        logoUrl: typeof b.logoUrl === 'string' ? b.logoUrl : '',
        supportingDocs: Array.isArray(b.supportingDocs) ? b.supportingDocs : [],
        isAdminCreator: Boolean(req.isAdmin),
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to create startup team';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.patch('/api/teams/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateStartupTeamDetails({
        teamId: req.params.id,
        actorUid: req.user!.uid,
        isAdmin: Boolean(req.isAdmin),
        patch: req.body || {},
      });
      res.json(updated);
    } catch (error: any) {
      const msg = error?.message || 'Failed to update startup team';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/members', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { userUid, role } = req.body || {};
      if (!userUid) {
        res.status(400).json({ error: 'userUid is required' });
        return;
      }
      const team = await adminAddOrRemoveTeamMember({
        teamId: req.params.id,
        userUid: String(userUid),
        action: 'add',
        role: role === 'leader' ? 'leader' : 'member',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || 'Admin',
      });
      res.json(team);
    } catch (error: any) {
      const msg = error?.message || 'Failed to add member to team';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.delete('/api/teams/:id/members/:uid', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const team = await adminAddOrRemoveTeamMember({
        teamId: req.params.id,
        userUid: req.params.uid,
        action: 'remove',
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || 'Admin',
      });
      res.json(team);
    } catch (error: any) {
      const msg = error?.message || 'Failed to remove member from team';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/invitations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { inviteeUid, message } = req.body || {};
      if (!inviteeUid) {
        res.status(400).json({ error: 'inviteeUid is required' });
        return;
      }
      const inv = await sendTeamInvitationTransaction({
        teamId: req.params.id,
        inviterUid: req.user!.uid,
        inviteeUid: String(inviteeUid),
        message: typeof message === 'string' ? message : undefined,
        isAdmin: Boolean(req.isAdmin),
      });
      res.status(201).json(inv);
    } catch (error: any) {
      const msg = error?.message || 'Failed to send team invitation';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/invitations/:id/respond', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { decision } = req.body || {};
      if (!['accept', 'reject', 'cancel'].includes(decision)) {
        res.status(400).json({ error: 'decision must be accept, reject, or cancel' });
        return;
      }
      const result = await respondToInvitationTransaction({
        invitationId: req.params.id,
        actorUid: req.user!.uid,
        decision,
        isAdmin: Boolean(req.isAdmin),
      });
      res.json(result);
    } catch (error: any) {
      const msg = error?.message || 'Failed to respond to invitation';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.get('/api/teams/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const msgs = await listTeamMessages(req.params.id, req.user!.uid, Boolean(req.isAdmin));
      res.json(msgs);
    } catch (error: any) {
      const msg = error?.message || 'Failed to load team messages';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { content, attachmentName, attachmentUrl } = req.body || {};
      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }
      const sender = await getUserByUid(req.user!.uid);
      const created = await postTeamMessage({
        teamId: req.params.id,
        senderUid: req.user!.uid,
        senderName: sender?.fullName || req.user!.name || req.user!.email || 'Member',
        isAdmin: Boolean(req.isAdmin),
        content,
        attachmentName: typeof attachmentName === 'string' ? attachmentName : '',
        attachmentUrl: typeof attachmentUrl === 'string' ? attachmentUrl : '',
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to send team message';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/messages/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      await markTeamMessagesRead(req.params.id, req.user!.uid, Boolean(req.isAdmin));
      res.json({ ok: true });
    } catch (error: any) {
      const msg = error?.message || 'Failed to mark messages as read';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  /* --------------------------------------------------------------------------
   * TASKS, MILESTONES & PROGRESS REPORTS
   * -------------------------------------------------------------------------- */

  app.get('/api/tasks/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await listMemberTasks(req.user!.uid);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load your tasks' });
    }
  });

  app.get('/api/admin/tasks', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listAllTasksForAdmin();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load tasks' });
    }
  });

  app.post('/api/admin/tasks', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.title || !b.teamId || !b.deadline) {
        res.status(400).json({ error: 'Task title, startup team, and deadline are required.' });
        return;
      }
      const created = await createAdminTask({
        title: String(b.title),
        description: String(b.description || b.title),
        teamId: String(b.teamId),
        assignedToUid: b.assignedToUid ? String(b.assignedToUid) : undefined,
        assignedToName: b.assignedToName ? String(b.assignedToName) : undefined,
        priority: String(b.priority || 'medium'),
        startDate: b.startDate ? String(b.startDate) : '',
        deadline: String(b.deadline),
        expectedDeliverable: String(b.expectedDeliverable || ''),
        instructions: String(b.instructions || ''),
        supportingFiles: Array.isArray(b.supportingFiles) ? b.supportingFiles : [],
        createdBy: req.user!.email || req.user!.uid,
        adminUid: req.user!.uid,
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to create task';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.patch('/api/admin/tasks/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updated = await adminUpdateTaskReview({
        taskId: req.params.id,
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || 'Admin',
        patch: req.body || {},
      });
      res.json(updated);
    } catch (error: any) {
      const msg = error?.message || 'Failed to update task';
      res.status(msg.startsWith('ESC_RULE:') ? 400 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.patch('/api/tasks/:id/member-update', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!['in_progress', 'submitted_for_review'].includes(b.status)) {
        res.status(400).json({ error: 'Status must be in_progress or submitted_for_review' });
        return;
      }
      const actor = await getUserByUid(req.user!.uid);
      const updated = await memberUpdateTaskSubmission({
        taskId: req.params.id,
        actorUid: req.user!.uid,
        actorName: actor?.fullName || req.user!.name || req.user!.email || 'Member',
        status: b.status,
        submissionNotes: typeof b.submissionNotes === 'string' ? b.submissionNotes : undefined,
        submissionUrl: typeof b.submissionUrl === 'string' ? b.submissionUrl : undefined,
        submissionFiles: Array.isArray(b.submissionFiles) ? b.submissionFiles : undefined,
      });
      res.json(updated);
    } catch (error: any) {
      const msg = error?.message || 'Failed to submit task update';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/milestones', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.title || !b.dueDate) {
        res.status(400).json({ error: 'Milestone title and dueDate are required' });
        return;
      }
      const actor = await getUserByUid(req.user!.uid);
      const created = await createTeamMilestone({
        teamId: req.params.id,
        actorUid: req.user!.uid,
        actorName: actor?.fullName || req.user!.name || 'Member',
        isAdmin: Boolean(req.isAdmin),
        title: String(b.title),
        description: String(b.description || ''),
        dueDate: String(b.dueDate),
        progressPercent: Number(b.progressPercent || 0),
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to add milestone';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.post('/api/teams/:id/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.summary || !b.accomplishments) {
        res.status(400).json({ error: 'Progress summary and accomplishments are required' });
        return;
      }
      const actor = await getUserByUid(req.user!.uid);
      const created = await submitTeamProgressReport({
        teamId: req.params.id,
        authorUid: req.user!.uid,
        authorName: actor?.fullName || req.user!.name || 'Member',
        summary: String(b.summary),
        accomplishments: String(b.accomplishments),
        blockers: String(b.blockers || ''),
        nextSteps: String(b.nextSteps || ''),
        progressPercent: Number(b.progressPercent || 0),
        attachments: Array.isArray(b.attachments) ? b.attachments : [],
      });
      res.status(201).json(created);
    } catch (error: any) {
      const msg = error?.message || 'Failed to submit progress report';
      res.status(msg.startsWith('ESC_RULE:') ? 403 : 500).json({ error: msg.replace('ESC_RULE:', '') });
    }
  });

  app.get('/api/admin/reports', requireAuth, requireAdmin, async (req, res) => {
    try {
      const rows = await listAllProgressReports(
        typeof req.query.teamId === 'string' ? req.query.teamId : undefined
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load progress reports' });
    }
  });

  app.patch('/api/admin/reports/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { adminReviewNotes, status } = req.body || {};
      const updated = await adminReviewProgressReport({
        reportId: req.params.id,
        adminEmail: req.user!.email || 'Admin',
        adminReviewNotes: String(adminReviewNotes || ''),
        status: status === 'needs_attention' ? 'needs_attention' : 'reviewed',
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to review progress report' });
    }
  });

  /* --------------------------------------------------------------------------
   * NOTIFICATIONS, ACTIVITY LOGS & EXTENDED ADMIN STATS
   * -------------------------------------------------------------------------- */

  app.get('/api/notifications/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await listUserNotifications(req.user!.uid);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await markNotificationRead(req.params.id, req.user!.uid, Boolean(req.isAdmin));
      res.json(updated || { ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to mark notification read' });
    }
  });

  app.patch('/api/notifications/my/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      await markAllNotificationsRead({ recipientType: 'user', recipientUid: req.user!.uid });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to mark all notifications read' });
    }
  });

  app.get('/api/admin/notifications', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await listAdminNotifications();
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load admin notifications' });
    }
  });

  app.patch('/api/admin/notifications/read-all', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await markAllNotificationsRead({ recipientType: 'admin' });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to mark admin notifications read' });
    }
  });

  app.get('/api/admin/activities', requireAuth, requireAdmin, async (req, res) => {
    try {
      const rows = await listActivityLogs({
        memberUid: typeof req.query.memberUid === 'string' ? req.query.memberUid : undefined,
        teamId: typeof req.query.teamId === 'string' ? req.query.teamId : undefined,
        activityType: typeof req.query.activityType === 'string' ? req.query.activityType : undefined,
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load activities' });
    }
  });

  app.get('/api/admin/dashboard-stats', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [allUsers, allTeams, allTasks, allProjects] = await Promise.all([
        listUsers(),
        listAllStartupTeams(),
        listAllTasksForAdmin(),
        listProjects(),
      ]);
      const stats = computeExtendedAdminMetrics({
        users: allUsers as any[],
        teams: allTeams as any[],
        tasks: allTasks as any[],
        projects: allProjects as any[],
      });
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to compute admin stats' });
    }
  });

  /* --------------------------------------------------------------------------
   * NEED HELP / SUPPORT TICKETS (PRIVATE USER & ADMIN ACCESS ONLY)
   * -------------------------------------------------------------------------- */

  app.post('/api/support/tickets', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const fullName = String(b.fullName || '').trim();
      const email = String(b.email || '').trim();
      const category = String(b.category || '').trim();
      const subject = String(b.subject || '').trim();
      const description = String(b.description || '').trim();
      const attachmentName = typeof b.attachmentName === 'string' ? b.attachmentName.trim().slice(0, 180) : '';
      const attachmentType = typeof b.attachmentType === 'string' ? b.attachmentType.trim().slice(0, 80) : '';
      const attachmentDataUrl = typeof b.attachmentDataUrl === 'string' ? b.attachmentDataUrl.trim() : '';
      const idempotencyKey = typeof b.idempotencyKey === 'string' ? b.idempotencyKey.trim().slice(0, 120) : undefined;

      const validation = validateSupportRequestInput({
        fullName,
        email,
        category,
        subject,
        description,
        attachmentName: attachmentName || undefined,
        attachmentType: attachmentType || undefined,
        attachmentDataUrl: attachmentDataUrl || undefined,
      });

      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0] || 'Please check the required fields.';
        res.status(400).json({ error: firstError, errors: validation.errors });
        return;
      }

      const result = await createSupportTicket({
        idempotencyKey,
        userUid: req.user?.uid,
        fullName,
        email,
        category: category as any,
        subject,
        description,
        attachmentName: attachmentName || undefined,
        attachmentType: attachmentType || undefined,
        attachmentDataUrl: attachmentDataUrl || undefined,
      });

      if (!result.deduplicated) {
        await createNotificationSafe({
          recipientType: 'admin',
          title: `New Support Request (${result.ticket.ticketId})`,
          description: `${result.ticket.fullName} (${result.ticket.category}): ${result.ticket.subject}`,
          senderName: result.ticket.fullName,
          type: 'system',
          linkTab: 'support',
          dedupeKey: `support_new_${result.ticket.id}`,
        }).catch(() => {});
      }

      res.status(result.deduplicated ? 200 : 201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit support request' });
    }
  });

  app.get('/api/support/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tickets = await listUserSupportTickets(req.user!.uid, req.user!.email);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load your support requests' });
    }
  });

  app.get('/api/admin/support', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const tickets = await listAllSupportTicketsForAdmin();
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load support requests' });
    }
  });

  app.patch('/api/admin/support/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const status = String(req.body?.status || '').trim();
      const adminNotes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim().slice(0, 1500) : undefined;

      if (!isValidSupportStatus(status)) {
        res.status(400).json({ error: 'Invalid support ticket status.' });
        return;
      }

      const updated = await updateSupportTicketStatus({
        id: req.params.id,
        status,
        adminNotes,
        adminEmail: req.user!.email || req.user!.uid,
      });

      if (!updated) {
        res.status(404).json({ error: 'Support request not found.' });
        return;
      }

      const label = getSupportStatusLabel(updated.status);
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `SUPPORT_STATUS_${updated.status.toUpperCase()}`,
        targetType: 'SupportTicket',
        targetId: updated.ticketId,
        details: `Updated support ticket ${updated.ticketId} (${updated.subject}) to ${label}`,
      }).catch(() => {});

      if (updated.userUid) {
        await createNotificationSafe({
          recipientType: 'user',
          recipientUid: updated.userUid,
          title: `Support Ticket ${updated.ticketId} — ${label}`,
          description: updated.adminNotes
            ? `Status updated to ${label}. Admin note: ${updated.adminNotes}`
            : `Your support request "${updated.subject}" status is now ${label}.`,
          senderName: 'ESC Support Team',
          type: 'system',
          linkTab: 'support',
          dedupeKey: `support_status_${updated.id}_${updated.status}_${Date.now()}`,
        }).catch(() => {});
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update support ticket' });
    }
  });

  /* --------------------------------------------------------------------------
   * PHYSICAL MEMBER CARD ORDERS (HOME DELIVERY — STRICT MEMBER & ADMIN ACCESS)
   * -------------------------------------------------------------------------- */

  app.post('/api/card-orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userRow = await getUserByUid(req.user!.uid);
      if (!userRow) {
        res.status(404).json({ error: 'Member profile not found. Please refresh and try again.' });
        return;
      }

      const eligibility = evaluatePhysicalCardOrderEligibility({
        isLoggedIn: true,
        membershipStatus: userRow.membershipStatus as any,
        accountStatus: (userRow.accountStatus || 'active') as any,
        escMemberId: userRow.escMemberId,
      });

      if (!eligibility.eligible) {
        res.status(403).json({
          eligible: false,
          reasonCode: eligibility.reasonCode,
          error: eligibility.message,
        });
        return;
      }

      const b = req.body || {};
      const fullName = String(b.fullName || userRow.fullName || '').trim().slice(0, 120);
      const email = String(userRow.email || req.user!.email || '').trim().slice(0, 160);
      const mobileNumber = String(b.mobileNumber || '').trim().slice(0, 20);
      const addressLine1 = String(b.addressLine1 || '').trim().slice(0, 240);
      const streetArea = String(b.streetArea || '').trim().slice(0, 240);
      const cityVillage = String(b.cityVillage || '').trim().slice(0, 120);
      const district = String(b.district || '').trim().slice(0, 120);
      const state = String(b.state || '').trim().slice(0, 100);
      const pinCode = String(b.pinCode || '').trim().slice(0, 10);
      const college = String(b.college || userRow.college || '').trim().slice(0, 180);
      const branch = String(b.branch || userRow.branch || '').trim().slice(0, 120);
      const academicYear = String(b.academicYear || userRow.academicYear || '').trim().slice(0, 40);
      const profilePhotoUrl = String(b.profilePhotoUrl || userRow.profilePhotoUrl || '').trim();
      const transactionId = String(b.transactionId || '').trim().slice(0, 64);
      const paymentScreenshotUrl = String(b.paymentScreenshotUrl || '').trim();
      const paymentConfirmedByMember = b.paymentConfirmedByMember === true;

      if (profilePhotoUrl.length > 2_000_000) {
        res.status(400).json({ error: 'Profile photo payload is too large. Please upload a smaller image.' });
        return;
      }
      if (paymentScreenshotUrl.length > 3_500_000) {
        res.status(400).json({ error: 'Payment screenshot payload is too large. Please upload a smaller JPG or PNG.' });
        return;
      }

      const deliveryCheck = validateDeliveryDetails({
        fullName,
        email,
        mobileNumber,
        addressLine1,
        streetArea,
        cityVillage,
        district,
        state,
        pinCode,
        college,
        branch,
        academicYear,
        profilePhotoUrl,
      });

      if (!deliveryCheck.isValid) {
        const firstErr = Object.values(deliveryCheck.errors)[0] || 'Please complete all required delivery details.';
        res.status(400).json({ error: firstErr, errors: deliveryCheck.errors });
        return;
      }

      const paymentCheck = validatePaymentSubmission({
        transactionId,
        paymentScreenshotUrl,
        paymentConfirmedByMember,
      });

      if (!paymentCheck.isValid) {
        const firstErr = Object.values(paymentCheck.errors)[0] || 'Please complete all required payment details.';
        res.status(400).json({ error: firstErr, errors: paymentCheck.errors });
        return;
      }

      // Authoritative pricing & UPI ID from server-side site_settings (never trust client price)
      const settings = await getSiteSettingsSql();
      const upiValidation = validateConfiguredUpiId(settings?.upiId);
      if (!upiValidation.valid) {
        res.status(503).json({
          error:
            upiValidation.error ||
            'Official ESC UPI ID is not configured. Please contact ESC Administration.',
        });
        return;
      }
      const amountInr = resolveConfiguredCardPrice(settings?.physicalCardPrice);
      const upiIdUsed = upiValidation.upiId;

      // Keep member profile photo synced if updated inside the order flow
      if (profilePhotoUrl && profilePhotoUrl !== (userRow.profilePhotoUrl || '')) {
        await updateUserProfileByUid(req.user!.uid, {
          profilePhotoUrl,
          profilePhotoUpdatedAt: new Date().toISOString(),
        }).catch(() => {});
      }

      const created = await createMemberCardOrderSql({
        userUid: req.user!.uid,
        escMemberId: userRow.escMemberId!,
        fullName,
        email,
        mobileNumber,
        college,
        branch,
        academicYear,
        profilePhotoUrl,
        addressLine1,
        streetArea,
        cityVillage,
        district,
        state,
        pinCode,
        amountInr,
        upiIdUsed,
        transactionId,
        paymentScreenshotUrl,
        paymentConfirmedByMember: true,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit physical member card order.' });
    }
  });

  app.get('/api/card-orders/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orders = await listMemberCardOrdersByUserSql(req.user!.uid);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load your physical member card orders.' });
    }
  });

  app.get('/api/admin/card-orders', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const orders = await listAllMemberCardOrdersSql();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load physical member card orders.' });
    }
  });

  app.patch('/api/admin/card-orders/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const paymentStatus = typeof b.paymentStatus === 'string' ? b.paymentStatus.trim() : undefined;
      const orderStatus = typeof b.orderStatus === 'string' ? b.orderStatus.trim() : undefined;

      if (paymentStatus && !VALID_PAYMENT_STATUSES.has(paymentStatus as any)) {
        res.status(400).json({ error: 'Invalid payment status value.' });
        return;
      }
      if (orderStatus && !VALID_CARD_ORDER_STATUSES.has(orderStatus as any)) {
        res.status(400).json({ error: 'Invalid order status value.' });
        return;
      }

      const updated = await updateMemberCardOrderAdminSql({
        id: req.params.id,
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || req.user!.uid,
        paymentStatus: paymentStatus as any,
        orderStatus: orderStatus as any,
        courierCompany: typeof b.courierCompany === 'string' ? b.courierCompany.slice(0, 120) : undefined,
        trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber.slice(0, 120) : undefined,
        dispatchDate: typeof b.dispatchDate === 'string' ? b.dispatchDate.slice(0, 40) : undefined,
        deliveredDate: typeof b.deliveredDate === 'string' ? b.deliveredDate.slice(0, 40) : undefined,
        adminNotes: typeof b.adminNotes === 'string' ? b.adminNotes.slice(0, 1500) : undefined,
      });

      if (!updated) {
        res.status(404).json({ error: 'Physical member card order not found.' });
        return;
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update physical member card order.' });
    }
  });

  app.use('/api', createProblemExchangeRouter());

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  const distPath = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  const hasProdBuild = fs.existsSync(indexHtmlPath);
  const isExplicitDev = process.env.NODE_ENV === 'development';
  const wantsProd =
    process.env.NODE_ENV === 'production' ||
    (!isExplicitDev && Boolean(process.env.K_SERVICE));
  const serveStaticDist = wantsProd && hasProdBuild;

  if (!serveStaticDist) {
    if (wantsProd && !hasProdBuild) {
      console.warn(
        `Warning: Production frontend build not found at ${indexHtmlPath}. Falling back to Vite middleware.`
      );
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, { index: 'index.html' }));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtmlPath);
    });
  }

  const parsedPort = Number.parseInt(process.env.PORT || '', 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  const host = '0.0.0.0';

  const server = app.listen(port, host, () => {
    console.log(
      `ESC server listening on http://${host}:${port} (mode=${serveStaticDist ? 'production' : 'development'})`
    );
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down ESC server gracefully...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start ESC server:', err);
  process.exit(1);
});
