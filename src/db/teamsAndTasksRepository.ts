import { and, asc, desc, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activityLogs,
  applications,
  notifications,
  progressReports,
  projectMilestones,
  siteSettings,
  startupTeamMembers,
  startupTeams,
  tasks,
  teamInvitations,
  teamMessages,
  users,
} from './schema.ts';
import {
  canMemberJoinOrCreateTeam,
  evaluateTaskOverdue,
  formatEscMemberId,
  formatStartupTeamCode,
  MAX_STARTUP_TEAM_MEMBERS,
} from '../utils/escLogic.ts';

function wrapRepoError(context: string, error: unknown): never {
  console.error(`Database query failed [${context}]:`, error);
  if (error instanceof Error && error.message.startsWith('ESC_RULE:')) {
    throw error;
  }
  throw new Error('Database operation failed. Please try again later.', { cause: error });
}

/* ============================================================================
 * ACTIVITY LOGS & DEDUPLICATED NOTIFICATIONS
 * ============================================================================ */

export async function recordActivityLog(params: {
  actorUid: string;
  actorName: string;
  memberUid?: string;
  teamId?: string;
  activityType: string;
  title: string;
  details: string;
  status?: string;
}) {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rows = await db
      .insert(activityLogs)
      .values({
        id,
        actorUid: params.actorUid,
        actorName: params.actorName,
        memberUid: params.memberUid || params.actorUid,
        teamId: params.teamId || '',
        activityType: params.activityType,
        title: params.title,
        details: params.details,
        status: params.status || 'completed',
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapRepoError('recordActivityLog', error);
  }
}

export async function createNotificationSafe(params: {
  recipientType: 'user' | 'admin';
  recipientUid?: string;
  title: string;
  description: string;
  senderName?: string;
  type: string;
  relatedMemberUid?: string;
  relatedTeamId?: string;
  linkTab?: string;
  dedupeKey?: string;
}) {
  try {
    const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const values = {
      id,
      recipientType: params.recipientType,
      recipientUid: params.recipientUid || '',
      title: params.title,
      description: params.description,
      senderName: params.senderName || 'ESC Platform',
      type: params.type,
      relatedMemberUid: params.relatedMemberUid || '',
      relatedTeamId: params.relatedTeamId || '',
      linkTab: params.linkTab || '',
      dedupeKey: params.dedupeKey || null,
      isRead: false,
    };

    if (params.dedupeKey) {
      const rows = await db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning();
      return rows[0] || null;
    }

    const rows = await db.insert(notifications).values(values).returning();
    return rows[0];
  } catch (error) {
    wrapRepoError('createNotificationSafe', error);
  }
}

export async function listUserNotifications(userUid: string) {
  try {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientType, 'user'), eq(notifications.recipientUid, userUid)))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  } catch (error) {
    wrapRepoError('listUserNotifications', error);
  }
}

export async function listAdminNotifications() {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientType, 'admin'))
      .orderBy(desc(notifications.createdAt))
      .limit(80);
  } catch (error) {
    wrapRepoError('listAdminNotifications', error);
  }
}

export async function markNotificationRead(id: string, recipientUid?: string, isAdmin: boolean = false) {
  try {
    if (isAdmin) {
      const rows = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();
      return rows[0] || null;
    }
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUid, recipientUid || '')))
      .returning();
    return rows[0] || null;
  } catch (error) {
    wrapRepoError('markNotificationRead', error);
  }
}

export async function markAllNotificationsRead(params: { recipientType: 'user' | 'admin'; recipientUid?: string }) {
  try {
    if (params.recipientType === 'admin') {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.recipientType, 'admin'));
      return true;
    }
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientType, 'user'), eq(notifications.recipientUid, params.recipientUid || '')));
    return true;
  } catch (error) {
    wrapRepoError('markAllNotificationsRead', error);
  }
}

/* ============================================================================
 * SITE SETTINGS (WHATSAPP COMMUNITY LINK & GUIDELINES)
 * ============================================================================ */

export async function getSiteSettingsSql() {
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 'public')).limit(1);
    const officialWhatsapp = 'https://chat.whatsapp.com/J0zOXM0OvBbCRtKfin5tmS';
    const defaultUpiId = '9420482152-2@ybl';
    const defaultUpiPayeeName = 'ESC';
    const defaultCardPrice = 151;
    if (rows[0]) {
      return {
        ...rows[0],
        whatsappCommunityUrl: rows[0].whatsappCommunityUrl?.trim() || officialWhatsapp,
        upiId: typeof rows[0].upiId === 'string' ? rows[0].upiId.trim() : defaultUpiId,
        upiPayeeName: rows[0].upiPayeeName?.trim() || defaultUpiPayeeName,
        physicalCardPrice:
          typeof rows[0].physicalCardPrice === 'number' && rows[0].physicalCardPrice > 0
            ? rows[0].physicalCardPrice
            : defaultCardPrice,
      };
    }
    return {
      id: 'public',
      heroBadgeText: 'Think. Engineer. Build. Launch.',
      heroAnnouncement: '',
      applicationsOpen: true,
      applicationCycleLabel: 'Student-Led Engineering Ecosystem',
      contactEmail: 'contact@esc.community',
      whatsappCommunityUrl: officialWhatsapp,
      communityGuidelines:
        'Respect engineering ethics, keep all build logs transparent, collaborate actively within your Startup Team, and meet ESC review deadlines.',
      upiId: defaultUpiId,
      upiPayeeName: defaultUpiPayeeName,
      physicalCardPrice: defaultCardPrice,
      updatedBy: '',
      updatedAt: new Date(),
    };
  } catch (error) {
    wrapRepoError('getSiteSettingsSql', error);
  }
}

export async function upsertSiteSettingsSql(payload: {
  heroBadgeText: string;
  heroAnnouncement: string;
  applicationsOpen: boolean;
  applicationCycleLabel: string;
  contactEmail: string;
  whatsappCommunityUrl: string;
  communityGuidelines: string;
  upiId?: string;
  upiPayeeName?: string;
  physicalCardPrice?: number;
  updatedBy: string;
}) {
  try {
    const now = new Date();
    const resolvedPayload = {
      ...payload,
      upiId: typeof payload.upiId === 'string' ? payload.upiId.trim() : '9420482152-2@ybl',
      upiPayeeName: payload.upiPayeeName?.trim() || 'ESC',
      physicalCardPrice:
        typeof payload.physicalCardPrice === 'number' &&
        Number.isFinite(payload.physicalCardPrice) &&
        payload.physicalCardPrice >= 1
          ? Math.round(payload.physicalCardPrice)
          : 151,
    };
    const rows = await db
      .insert(siteSettings)
      .values({
        id: 'public',
        ...resolvedPayload,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          ...resolvedPayload,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapRepoError('upsertSiteSettingsSql', error);
  }
}

/* ============================================================================
 * MEMBER APPROVAL & 360 PROFILE DETAILS
 * ============================================================================ */

export async function approveEscMemberTransaction(params: {
  targetUid: string;
  applicationId?: string;
  adminUid: string;
  adminEmail: string;
  adminNotes?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const nowIso = now.toISOString();

      let userRow = (await tx.select().from(users).where(eq(users.uid, params.targetUid)).limit(1))[0];
      if (!userRow && params.applicationId) {
        const appRow = (
          await tx.select().from(applications).where(eq(applications.id, params.applicationId)).limit(1)
        )[0];
        if (appRow) {
          userRow = (await tx.select().from(users).where(eq(users.uid, appRow.userUid)).limit(1))[0];
        }
      }
      if (!userRow) {
        throw new Error('ESC_RULE:Target user profile not found.');
      }

      let escMemberId = userRow.escMemberId || '';
      if (!escMemberId) {
        const allIds = await tx
          .select({ escMemberId: users.escMemberId })
          .from(users)
          .where(isNotNull(users.escMemberId));
        const existingSet = new Set(
          allIds.map((r) => r.escMemberId).filter((val): val is string => Boolean(val))
        );
        escMemberId = formatEscMemberId(now.getFullYear(), existingSet, existingSet.size + 1);
      }

      const preserveElevatedRole = ['superadmin', 'admin', 'project_lead', 'lead', 'mentor'].includes(
        userRow.role
      );
      const nextRole = preserveElevatedRole ? userRow.role : 'member';

      const updatedUsers = await tx
        .update(users)
        .set({
          membershipStatus: 'approved',
          role: nextRole,
          escMemberId,
          accountStatus: 'active',
          approvalDate: userRow.approvalDate || nowIso,
          approvedBy: params.adminEmail,
          updatedAt: now,
        })
        .where(eq(users.uid, userRow.uid))
        .returning();

      if (params.applicationId) {
        await tx
          .update(applications)
          .set({
            status: 'approved',
            adminNotes: params.adminNotes || '',
            reviewedBy: params.adminEmail,
            approvalDate: nowIso,
            approvedBy: params.adminEmail,
            updatedAt: now,
          })
          .where(eq(applications.id, params.applicationId));
      } else {
        await tx
          .update(applications)
          .set({
            status: 'approved',
            reviewedBy: params.adminEmail,
            approvalDate: nowIso,
            approvedBy: params.adminEmail,
            updatedAt: now,
          })
          .where(eq(applications.userUid, userRow.uid));
      }

      const settingsRow = (
        await tx.select().from(siteSettings).where(eq(siteSettings.id, 'public')).limit(1)
      )[0];
      const whatsappUrl = settingsRow?.whatsappCommunityUrl || '';

      await tx
        .insert(notifications)
        .values({
          id: `ntf_${Date.now()}_u_${Math.random().toString(36).slice(2, 6)}`,
          recipientType: 'user',
          recipientUid: userRow.uid,
          title: `ESC Membership Approved (${escMemberId})`,
          description: whatsappUrl
            ? `Welcome to Engineering Startup Company (ESC)! Your official Member ID is ${escMemberId}. Join the official ESC WhatsApp Community and create or join a Startup Team from your dashboard.`
            : `Welcome to Engineering Startup Company (ESC)! Your official Member ID is ${escMemberId}. Your full member dashboard and Startup Team creation tools are now unlocked.`,
          senderName: 'ESC Super Admin',
          type: 'member_approved',
          relatedMemberUid: userRow.uid,
          linkTab: 'team',
          dedupeKey: `member_approved_user_${userRow.uid}_${escMemberId}`,
          isRead: false,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey });

      await tx
        .insert(notifications)
        .values({
          id: `ntf_${Date.now()}_a_${Math.random().toString(36).slice(2, 6)}`,
          recipientType: 'admin',
          recipientUid: '',
          title: `Member Approved: ${userRow.fullName}`,
          description: `${userRow.fullName} (${escMemberId}) was approved by ${params.adminEmail}.`,
          senderName: params.adminEmail,
          type: 'member_approved',
          relatedMemberUid: userRow.uid,
          linkTab: 'users',
          dedupeKey: `member_approved_admin_${userRow.uid}_${escMemberId}`,
          isRead: false,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey });

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: params.adminUid,
        actorName: params.adminEmail,
        memberUid: userRow.uid,
        teamId: '',
        activityType: 'member_approved',
        title: `Approved ESC Member (${escMemberId})`,
        details: `${userRow.fullName} (${userRow.email}) approved as official ESC Member ${escMemberId}.`,
        status: 'approved',
      });

      return {
        user: updatedUsers[0],
        escMemberId,
        whatsappCommunityUrl: whatsappUrl,
      };
    });
  } catch (error) {
    wrapRepoError('approveEscMemberTransaction', error);
  }
}

export async function getMemberFullDetails(targetUid: string) {
  try {
    const userRow = (await db.select().from(users).where(eq(users.uid, targetUid)).limit(1))[0];
    if (!userRow) return null;

    const [appRows, membershipRows, inviteRows, taskRows, reportRows, activityRows] = await Promise.all([
      db.select().from(applications).where(eq(applications.userUid, targetUid)).orderBy(desc(applications.updatedAt)),
      db.select().from(startupTeamMembers).where(eq(startupTeamMembers.userUid, targetUid)),
      db
        .select()
        .from(teamInvitations)
        .where(or(eq(teamInvitations.inviteeUid, targetUid), eq(teamInvitations.inviterUid, targetUid)))
        .orderBy(desc(teamInvitations.createdAt)),
      db.select().from(tasks).where(eq(tasks.assignedToUid, targetUid)).orderBy(desc(tasks.createdAt)),
      db.select().from(progressReports).where(eq(progressReports.authorUid, targetUid)).orderBy(desc(progressReports.createdAt)),
      db
        .select()
        .from(activityLogs)
        .where(or(eq(activityLogs.memberUid, targetUid), eq(activityLogs.actorUid, targetUid)))
        .orderBy(desc(activityLogs.createdAt))
        .limit(50),
    ]);

    const teamIds = membershipRows.map((m) => m.teamId);
    const memberTeams =
      teamIds.length > 0 ? await db.select().from(startupTeams).where(inArray(startupTeams.id, teamIds)) : [];

    return {
      user: userRow,
      application: appRows[0] || null,
      teams: memberTeams,
      invitations: inviteRows,
      tasks: taskRows,
      reports: reportRows,
      activities: activityRows,
    };
  } catch (error) {
    wrapRepoError('getMemberFullDetails', error);
  }
}

/* ============================================================================
 * STARTUP TEAMS & MEMBERS (STRICT MAX-4 & SINGLE-ACTIVE-TEAM ENFORCEMENT)
 * ============================================================================ */

async function hydrateTeamsWithMembers(teamRows: (typeof startupTeams.$inferSelect)[]) {
  if (teamRows.length === 0) return [];
  const teamIds = teamRows.map((t) => t.id);
  const memberRows = await db
    .select({
      member: startupTeamMembers,
      user: {
        fullName: users.fullName,
        email: users.email,
        escMemberId: users.escMemberId,
        college: users.college,
        branch: users.branch,
        academicYear: users.academicYear,
        technicalSkills: users.technicalSkills,
        accountStatus: users.accountStatus,
      },
    })
    .from(startupTeamMembers)
    .innerJoin(users, eq(startupTeamMembers.userUid, users.uid))
    .where(inArray(startupTeamMembers.teamId, teamIds))
    .orderBy(asc(startupTeamMembers.joinedAt));

  const membersByTeam = new Map<string, any[]>();
  for (const row of memberRows) {
    const arr = membersByTeam.get(row.member.teamId) || [];
    arr.push({
      id: row.member.id,
      teamId: row.member.teamId,
      userUid: row.member.userUid,
      role: row.member.role,
      title: row.member.title,
      joinedAt: row.member.joinedAt,
      fullName: row.user.fullName,
      email: row.user.email,
      escMemberId: row.user.escMemberId,
      college: row.user.college,
      branch: row.user.branch,
      academicYear: row.user.academicYear,
      technicalSkills: row.user.technicalSkills,
      accountStatus: row.user.accountStatus,
    });
    membersByTeam.set(row.member.teamId, arr);
  }

  return teamRows.map((team) => {
    const members = membersByTeam.get(team.id) || [];
    return {
      ...team,
      members,
      memberCount: members.length,
    };
  });
}

async function getActiveTeamCountForMemberTx(tx: any, userUid: string, excludeTeamId?: string): Promise<number> {
  const rows = await tx
    .select({
      teamId: startupTeamMembers.teamId,
      status: startupTeams.status,
    })
    .from(startupTeamMembers)
    .innerJoin(startupTeams, eq(startupTeamMembers.teamId, startupTeams.id))
    .where(eq(startupTeamMembers.userUid, userUid));

  const inactiveTeamStatuses = new Set(['completed', 'rejected']);
  return rows.filter(
    (r: { teamId: string; status: string }) =>
      (!excludeTeamId || r.teamId !== excludeTeamId) && !inactiveTeamStatuses.has(r.status)
  ).length;
}

export async function listAllStartupTeams() {
  try {
    const rows = await db.select().from(startupTeams).orderBy(desc(startupTeams.updatedAt));
    return await hydrateTeamsWithMembers(rows);
  } catch (error) {
    wrapRepoError('listAllStartupTeams', error);
  }
}

export async function listPublicStartupTeamsDirectory(viewerUid: string) {
  try {
    const allRows = await db
      .select()
      .from(startupTeams)
      .orderBy(desc(startupTeams.updatedAt));

    const visibleRows = allRows.filter(
      (t) => t.status !== 'draft' && t.status !== 'rejected'
    );
    const hydrated = await hydrateTeamsWithMembers(visibleRows);

    const viewerRequests = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.inviterUid, viewerUid));

    const reqByTeam = new Map<string, string>();
    for (const r of viewerRequests) {
      if (r.id.startsWith('req_')) {
        const prev = reqByTeam.get(r.teamId);
        if (!prev || r.status === 'pending' || r.status === 'accepted') {
          reqByTeam.set(r.teamId, r.status);
        }
      }
    }

    return hydrated.map((team) => {
      const members = Array.isArray(team.members) ? team.members : [];
      const leaderMember = members.find((m: any) => m.userUid === team.leaderUid);
      const memberColleges = Array.from(
        new Set(
          members
            .map((m: any) => (m.college || '').trim())
            .filter((c: string) => c.length > 0)
        )
      );
      return {
        id: team.id,
        teamCode: team.teamCode,
        name: team.name,
        problemStatement: team.problemStatement,
        proposedSolution: team.proposedSolution,
        ideaDescription: team.ideaDescription,
        domain: team.domain,
        stage: team.stage,
        skillsRequired: team.skillsRequired || [],
        expectedOutcome: team.expectedOutcome || '',
        leaderUid: team.leaderUid,
        leaderName: team.leaderName,
        leaderCollege: leaderMember?.college || '',
        status: team.status,
        isApproved: team.isApproved,
        maxMembers: team.maxMembers,
        memberCount: members.length,
        memberColleges,
        isCurrentUserMember: members.some((m: any) => m.userUid === viewerUid),
        userJoinRequestStatus: reqByTeam.get(team.id) || null,
        createdAt: team.createdAt,
      };
    });
  } catch (error) {
    wrapRepoError('listPublicStartupTeamsDirectory', error);
  }
}

export async function requestToJoinTeamTransaction(params: {
  teamId: string;
  requesterUid: string;
  message?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const teamRow = (
        await tx.select().from(startupTeams).where(eq(startupTeams.id, params.teamId)).limit(1)
      )[0];
      if (!teamRow) {
        throw new Error('ESC_RULE:Startup team not found.');
      }
      if (teamRow.status === 'rejected' || teamRow.status === 'completed' || teamRow.status === 'draft') {
        throw new Error('ESC_RULE:This startup team is not currently accepting join requests.');
      }

      const currentMembers = await tx
        .select()
        .from(startupTeamMembers)
        .where(eq(startupTeamMembers.teamId, teamRow.id));

      if (currentMembers.some((m) => m.userUid === params.requesterUid)) {
        throw new Error('ESC_RULE:You are already a member of this startup team.');
      }

      const requesterRow = (
        await tx.select().from(users).where(eq(users.uid, params.requesterUid)).limit(1)
      )[0];
      const activeCount = await getActiveTeamCountForMemberTx(tx, params.requesterUid, teamRow.id);

      const check = canMemberJoinOrCreateTeam({
        userProfile: requesterRow as any,
        existingActiveTeamCount: activeCount,
        targetTeamMemberCount: currentMembers.length,
        maxMembers: teamRow.maxMembers,
        allowMultiTeamOverride: Boolean(teamRow.allowMultiTeamOverride),
      });

      if (!check.allowed) {
        throw new Error(`ESC_RULE:${check.reason}`);
      }

      const duplicatePending = await tx
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.teamId, teamRow.id),
            eq(teamInvitations.inviterUid, params.requesterUid),
            eq(teamInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (duplicatePending[0]) {
        throw new Error('ESC_RULE:You already have a pending join request for this startup team.');
      }

      const leaderRow = (
        await tx.select().from(users).where(eq(users.uid, teamRow.leaderUid)).limit(1)
      )[0];

      const now = new Date();
      const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const created = await tx
        .insert(teamInvitations)
        .values({
          id: reqId,
          teamId: teamRow.id,
          teamName: teamRow.name,
          inviterUid: requesterRow.uid,
          inviterName: requesterRow.fullName,
          inviteeUid: teamRow.leaderUid,
          inviteeName: leaderRow?.fullName || teamRow.leaderName,
          inviteeEmail: requesterRow.email,
          message:
            params.message?.trim() ||
            `${requesterRow.fullName} (${requesterRow.escMemberId || 'ESC Member'}) requested to join "${teamRow.name}".`,
          status: 'pending',
          createdAt: now,
        })
        .returning();

      await tx
        .insert(notifications)
        .values({
          id: `ntf_${Date.now()}_jreq_${Math.random().toString(36).slice(2, 6)}`,
          recipientType: 'user',
          recipientUid: teamRow.leaderUid,
          title: `Team Join Request: ${requesterRow.fullName}`,
          description: `${requesterRow.fullName} requested to join your startup team "${teamRow.name}" (${teamRow.teamCode}). Review it in Startup Teams.`,
          senderName: requesterRow.fullName,
          type: 'join_request',
          relatedMemberUid: requesterRow.uid,
          relatedTeamId: teamRow.id,
          linkTab: 'team',
          dedupeKey: `join_req_${reqId}`,
          isRead: false,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey });

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: requesterRow.uid,
        actorName: requesterRow.fullName,
        memberUid: requesterRow.uid,
        teamId: teamRow.id,
        activityType: 'join_request_sent',
        title: `Requested to join ${teamRow.name}`,
        details: `${requesterRow.fullName} (${requesterRow.escMemberId || requesterRow.email}) sent a join request to ${teamRow.name}.`,
        status: 'pending',
      });

      return created[0];
    });
  } catch (error) {
    wrapRepoError('requestToJoinTeamTransaction', error);
  }
}

export async function getMemberTeamsAndInvitations(userUid: string) {
  try {
    const membershipRows = await db
      .select()
      .from(startupTeamMembers)
      .where(eq(startupTeamMembers.userUid, userUid));
    const teamIds = membershipRows.map((m) => m.teamId);

    const teamRows =
      teamIds.length > 0
        ? await db.select().from(startupTeams).where(inArray(startupTeams.id, teamIds)).orderBy(desc(startupTeams.updatedAt))
        : [];
    const hydratedTeams = await hydrateTeamsWithMembers(teamRows);

    const [incomingInvites, outgoingInvites, teamMilestones, teamReports] = await Promise.all([
      db.select().from(teamInvitations).where(eq(teamInvitations.inviteeUid, userUid)).orderBy(desc(teamInvitations.createdAt)),
      db.select().from(teamInvitations).where(eq(teamInvitations.inviterUid, userUid)).orderBy(desc(teamInvitations.createdAt)),
      teamIds.length > 0
        ? db.select().from(projectMilestones).where(inArray(projectMilestones.teamId, teamIds)).orderBy(asc(projectMilestones.dueDate))
        : Promise.resolve([]),
      teamIds.length > 0
        ? db.select().from(progressReports).where(inArray(progressReports.teamId, teamIds)).orderBy(desc(progressReports.createdAt))
        : Promise.resolve([]),
    ]);

    return {
      teams: hydratedTeams,
      incomingInvitations: incomingInvites,
      outgoingInvitations: outgoingInvites,
      milestones: teamMilestones,
      reports: teamReports,
    };
  } catch (error) {
    wrapRepoError('getMemberTeamsAndInvitations', error);
  }
}

export async function createStartupTeamTransaction(params: {
  leaderUid: string;
  name: string;
  problemStatement: string;
  proposedSolution: string;
  ideaDescription: string;
  domain: string;
  stage: string;
  skillsRequired: string[];
  expectedOutcome: string;
  logoUrl?: string;
  supportingDocs?: { name: string; url: string }[];
  isAdminCreator?: boolean;
}) {
  try {
    return await db.transaction(async (tx) => {
      const userRow = (await tx.select().from(users).where(eq(users.uid, params.leaderUid)).limit(1))[0];
      const activeCount = await getActiveTeamCountForMemberTx(tx, params.leaderUid);

      const eligibility = canMemberJoinOrCreateTeam({
        userProfile: userRow as any,
        existingActiveTeamCount: activeCount,
        targetTeamMemberCount: 0,
        maxMembers: MAX_STARTUP_TEAM_MEMBERS,
        allowMultiTeamOverride: Boolean(params.isAdminCreator),
      });

      if (!eligibility.allowed) {
        throw new Error(`ESC_RULE:${eligibility.reason}`);
      }

      const existingCodesRows = await tx.select({ teamCode: startupTeams.teamCode }).from(startupTeams);
      const codeSet = new Set(existingCodesRows.map((r) => r.teamCode));
      const now = new Date();
      const teamCode = formatStartupTeamCode(now.getFullYear(), codeSet, codeSet.size + 1);
      const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const createdTeamRows = await tx
        .insert(startupTeams)
        .values({
          id: teamId,
          teamCode,
          name: params.name.trim(),
          problemStatement: params.problemStatement.trim(),
          proposedSolution: params.proposedSolution.trim(),
          ideaDescription: params.ideaDescription.trim(),
          domain: params.domain.trim(),
          stage: params.stage,
          skillsRequired: params.skillsRequired,
          expectedOutcome: params.expectedOutcome.trim(),
          logoUrl: params.logoUrl || '',
          supportingDocs: params.supportingDocs || [],
          leaderUid: userRow.uid,
          leaderName: userRow.fullName,
          status: 'recruiting',
          isApproved: false,
          maxMembers: MAX_STARTUP_TEAM_MEMBERS,
          allowMultiTeamOverride: false,
          progressPercent: 10,
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(startupTeamMembers).values({
        id: `tm_${teamId}_${userRow.uid}`,
        teamId,
        userUid: userRow.uid,
        role: 'leader',
        title: 'Team Leader & Founder',
        joinedAt: now,
      });

      await tx
        .update(users)
        .set({
          startupTeamId: teamId,
          teamRole: 'leader',
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(users.uid, userRow.uid));

      await tx.insert(notifications).values({
        id: `ntf_${Date.now()}_tm_${Math.random().toString(36).slice(2, 6)}`,
        recipientType: 'admin',
        recipientUid: '',
        title: `New Startup Team Created: ${params.name.trim()}`,
        description: `${userRow.fullName} (${userRow.escMemberId || 'ESC Member'}) created Startup Team "${params.name.trim()}" [${teamCode}].`,
        senderName: userRow.fullName,
        type: 'team_created',
        relatedMemberUid: userRow.uid,
        relatedTeamId: teamId,
        linkTab: 'teams',
        isRead: false,
      });

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: userRow.uid,
        actorName: userRow.fullName,
        memberUid: userRow.uid,
        teamId,
        activityType: 'team_created',
        title: `Created Startup Team ${teamCode}`,
        details: `Created startup team "${params.name.trim()}" in ${params.domain} (${params.stage}).`,
        status: 'recruiting',
      });

      const hydrated = await hydrateTeamsWithMembers(createdTeamRows);
      return hydrated[0];
    });
  } catch (error) {
    wrapRepoError('createStartupTeamTransaction', error);
  }
}

export async function sendTeamInvitationTransaction(params: {
  teamId: string;
  inviterUid: string;
  inviteeUid: string;
  message?: string;
  isAdmin?: boolean;
}) {
  try {
    return await db.transaction(async (tx) => {
      const teamRow = (await tx.select().from(startupTeams).where(eq(startupTeams.id, params.teamId)).limit(1))[0];
      if (!teamRow) {
        throw new Error('ESC_RULE:Startup team not found.');
      }

      if (!params.isAdmin && teamRow.leaderUid !== params.inviterUid) {
        throw new Error('ESC_RULE:Only the Team Leader or an ESC Administrator can send team invitations.');
      }

      const currentMembers = await tx
        .select()
        .from(startupTeamMembers)
        .where(eq(startupTeamMembers.teamId, params.teamId));

      if (currentMembers.length >= Math.min(MAX_STARTUP_TEAM_MEMBERS, teamRow.maxMembers || MAX_STARTUP_TEAM_MEMBERS)) {
        throw new Error(`ESC_RULE:Team already has ${currentMembers.length} of 4 maximum members.`);
      }

      if (currentMembers.some((m) => m.userUid === params.inviteeUid)) {
        throw new Error('ESC_RULE:This member is already part of your startup team.');
      }

      const inviteeRow = (await tx.select().from(users).where(eq(users.uid, params.inviteeUid)).limit(1))[0];
      const inviterRow = (await tx.select().from(users).where(eq(users.uid, params.inviterUid)).limit(1))[0];
      const inviteeActiveCount = await getActiveTeamCountForMemberTx(tx, params.inviteeUid, params.teamId);

      const check = canMemberJoinOrCreateTeam({
        userProfile: inviteeRow as any,
        existingActiveTeamCount: inviteeActiveCount,
        targetTeamMemberCount: currentMembers.length,
        maxMembers: teamRow.maxMembers,
        allowMultiTeamOverride: Boolean(teamRow.allowMultiTeamOverride),
      });

      if (!check.allowed) {
        throw new Error(`ESC_RULE:${check.reason}`);
      }

      const duplicatePending = await tx
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.teamId, params.teamId),
            eq(teamInvitations.inviteeUid, params.inviteeUid),
            eq(teamInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (duplicatePending[0]) {
        throw new Error('ESC_RULE:A pending invitation has already been sent to this member.');
      }

      const now = new Date();
      const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const created = await tx
        .insert(teamInvitations)
        .values({
          id: invId,
          teamId: teamRow.id,
          teamName: teamRow.name,
          inviterUid: params.inviterUid,
          inviterName: inviterRow?.fullName || teamRow.leaderName,
          inviteeUid: inviteeRow.uid,
          inviteeName: inviteeRow.fullName,
          inviteeEmail: inviteeRow.email,
          message: params.message?.trim() || `Join Startup Team "${teamRow.name}" (${teamRow.domain})`,
          status: 'pending',
          createdAt: now,
        })
        .returning();

      await tx
        .insert(notifications)
        .values({
          id: `ntf_${Date.now()}_inv_${Math.random().toString(36).slice(2, 6)}`,
          recipientType: 'user',
          recipientUid: inviteeRow.uid,
          title: `Startup Team Invitation: ${teamRow.name}`,
          description: `${inviterRow?.fullName || teamRow.leaderName} invited you to join "${teamRow.name}" (${teamRow.teamCode}).`,
          senderName: inviterRow?.fullName || teamRow.leaderName,
          type: 'team_invite',
          relatedMemberUid: inviteeRow.uid,
          relatedTeamId: teamRow.id,
          linkTab: 'team',
          dedupeKey: `invite_pending_${invId}`,
          isRead: false,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey });

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: params.inviterUid,
        actorName: inviterRow?.fullName || teamRow.leaderName,
        memberUid: inviteeRow.uid,
        teamId: teamRow.id,
        activityType: 'invitation_sent',
        title: `Invited ${inviteeRow.fullName} to ${teamRow.name}`,
        details: `Team invitation sent to ${inviteeRow.fullName} (${inviteeRow.escMemberId || inviteeRow.email}).`,
        status: 'pending',
      });

      return created[0];
    });
  } catch (error) {
    wrapRepoError('sendTeamInvitationTransaction', error);
  }
}

export async function respondToInvitationTransaction(params: {
  invitationId: string;
  actorUid: string;
  decision: 'accept' | 'reject' | 'cancel';
  isAdmin?: boolean;
}) {
  try {
    return await db.transaction(async (tx) => {
      const inv = (
        await tx.select().from(teamInvitations).where(eq(teamInvitations.id, params.invitationId)).limit(1)
      )[0];
      if (!inv) {
        throw new Error('ESC_RULE:Invitation not found.');
      }
      if (inv.status !== 'pending') {
        throw new Error(`ESC_RULE:Invitation is already ${inv.status}.`);
      }

      const now = new Date();
      const isJoinRequest = inv.id.startsWith('req_');
      const joiningUserUid = isJoinRequest ? inv.inviterUid : inv.inviteeUid;
      const joiningUserName = isJoinRequest ? inv.inviterName : inv.inviteeName;
      const decisionMakerUid = isJoinRequest ? inv.inviteeUid : inv.inviteeUid; // leader for req_, invitee for inv_
      const notifyTargetUid = isJoinRequest ? inv.inviterUid : inv.inviterUid; // requester for req_, leader for inv_

      if (params.decision === 'cancel') {
        if (!params.isAdmin && inv.inviterUid !== params.actorUid) {
          throw new Error(
            isJoinRequest
              ? 'ESC_RULE:Only the requesting member or an administrator can cancel this join request.'
              : 'ESC_RULE:Only the inviter or an administrator can cancel this invitation.'
          );
        }
        const cancelled = await tx
          .update(teamInvitations)
          .set({ status: 'cancelled', respondedAt: now })
          .where(eq(teamInvitations.id, inv.id))
          .returning();
        return { invitation: cancelled[0], team: null };
      }

      if (!params.isAdmin && decisionMakerUid !== params.actorUid) {
        throw new Error(
          isJoinRequest
            ? 'ESC_RULE:Only the team leader or an administrator can accept or reject this join request.'
            : 'ESC_RULE:Only the invited member can accept or reject this invitation.'
        );
      }

      if (params.decision === 'reject') {
        const rejected = await tx
          .update(teamInvitations)
          .set({ status: 'rejected', respondedAt: now })
          .where(eq(teamInvitations.id, inv.id))
          .returning();

        await tx.insert(notifications).values({
          id: `ntf_${Date.now()}_rej_${Math.random().toString(36).slice(2, 6)}`,
          recipientType: 'user',
          recipientUid: notifyTargetUid,
          title: isJoinRequest
            ? `Join Request Declined: ${inv.teamName}`
            : `Invitation Declined: ${inv.inviteeName}`,
          description: isJoinRequest
            ? `Your request to join "${inv.teamName}" was declined by the team leader.`
            : `${inv.inviteeName} declined your invitation to join "${inv.teamName}".`,
          senderName: isJoinRequest ? inv.inviteeName : inv.inviteeName,
          type: isJoinRequest ? 'join_request_rejected' : 'invite_rejected',
          relatedMemberUid: joiningUserUid,
          relatedTeamId: inv.teamId,
          linkTab: 'team',
          isRead: false,
        });

        await tx.insert(activityLogs).values({
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          actorUid: params.actorUid,
          actorName: isJoinRequest ? inv.inviteeName : inv.inviteeName,
          memberUid: joiningUserUid,
          teamId: inv.teamId,
          activityType: isJoinRequest ? 'join_request_rejected' : 'invitation_rejected',
          title: isJoinRequest
            ? `Declined join request from ${joiningUserName} for ${inv.teamName}`
            : `Declined team invitation for ${inv.teamName}`,
          details: isJoinRequest
            ? `${inv.inviteeName} declined ${joiningUserName}'s request to join ${inv.teamName}.`
            : `${inv.inviteeName} declined the team invitation from ${inv.inviterName}.`,
          status: 'rejected',
        });

        return { invitation: rejected[0], team: null };
      }

      // ACCEPT PATH — strictly re-verify max 4 members & single active team atomically!
      const teamRow = (await tx.select().from(startupTeams).where(eq(startupTeams.id, inv.teamId)).limit(1))[0];
      if (!teamRow) {
        throw new Error('ESC_RULE:Target startup team no longer exists.');
      }

      const currentMembers = await tx
        .select()
        .from(startupTeamMembers)
        .where(eq(startupTeamMembers.teamId, teamRow.id));

      const joiningUserRow = (
        await tx.select().from(users).where(eq(users.uid, joiningUserUid)).limit(1)
      )[0];
      const activeCount = await getActiveTeamCountForMemberTx(tx, joiningUserUid, teamRow.id);

      const eligibility = canMemberJoinOrCreateTeam({
        userProfile: joiningUserRow as any,
        existingActiveTeamCount: activeCount,
        targetTeamMemberCount: currentMembers.length,
        maxMembers: teamRow.maxMembers,
        allowMultiTeamOverride: Boolean(teamRow.allowMultiTeamOverride),
      });

      if (!eligibility.allowed) {
        throw new Error(`ESC_RULE:${eligibility.reason}`);
      }

      await tx.insert(startupTeamMembers).values({
        id: `tm_${teamRow.id}_${joiningUserUid}`,
        teamId: teamRow.id,
        userUid: joiningUserUid,
        role: 'member',
        title: 'Founding Engineer',
        joinedAt: now,
      });

      await tx
        .update(users)
        .set({
          startupTeamId: teamRow.id,
          teamRole: 'member',
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(users.uid, joiningUserUid));

      const acceptedRows = await tx
        .update(teamInvitations)
        .set({ status: 'accepted', respondedAt: now })
        .where(eq(teamInvitations.id, inv.id))
        .returning();

      // Auto-mark team_formed when full or update activity
      const newCount = currentMembers.length + 1;
      const nextStatus =
        newCount >= MAX_STARTUP_TEAM_MEMBERS && teamRow.status === 'recruiting'
          ? 'team_formed'
          : teamRow.status;

      const updatedTeams = await tx
        .update(startupTeams)
        .set({
          status: nextStatus,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(startupTeams.id, teamRow.id))
        .returning();

      await tx.insert(notifications).values({
        id: `ntf_${Date.now()}_acc_u_${Math.random().toString(36).slice(2, 6)}`,
        recipientType: 'user',
        recipientUid: notifyTargetUid,
        title: isJoinRequest
          ? `Join Request Accepted: ${teamRow.name}`
          : `${joiningUserName} joined ${teamRow.name}`,
        description: isJoinRequest
          ? `Congratulations! Your request to join "${teamRow.name}" was accepted. Open Startup Teams to collaborate.`
          : `${joiningUserName} accepted your invitation (${newCount}/4 members).`,
        senderName: isJoinRequest ? inv.inviteeName : joiningUserName,
        type: isJoinRequest ? 'join_request_accepted' : 'invite_accepted',
        relatedMemberUid: joiningUserUid,
        relatedTeamId: teamRow.id,
        linkTab: 'team',
        isRead: false,
      });

      await tx.insert(notifications).values({
        id: `ntf_${Date.now()}_acc_a_${Math.random().toString(36).slice(2, 6)}`,
        recipientType: 'admin',
        recipientUid: '',
        title: `Team Member Joined: ${teamRow.name}`,
        description: `${joiningUserName} joined Startup Team "${teamRow.name}" (${newCount}/4 members).`,
        senderName: joiningUserName,
        type: isJoinRequest ? 'join_request_accepted' : 'invite_accepted',
        relatedMemberUid: joiningUserUid,
        relatedTeamId: teamRow.id,
        linkTab: 'teams',
        isRead: false,
      });

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: params.actorUid,
        actorName: isJoinRequest ? inv.inviteeName : joiningUserName,
        memberUid: joiningUserUid,
        teamId: teamRow.id,
        activityType: isJoinRequest ? 'join_request_accepted' : 'invitation_accepted',
        title: `Joined Startup Team ${teamRow.name}`,
        details: `${joiningUserName} joined ${teamRow.name} (${newCount}/4 members).`,
        status: 'accepted',
      });

      const hydrated = await hydrateTeamsWithMembers(updatedTeams);
      return { invitation: acceptedRows[0], team: hydrated[0] };
    });
  } catch (error) {
    wrapRepoError('respondToInvitationTransaction', error);
  }
}

export async function adminAddOrRemoveTeamMember(params: {
  teamId: string;
  userUid: string;
  action: 'add' | 'remove';
  role?: 'leader' | 'member';
  adminUid: string;
  adminEmail: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const teamRow = (await tx.select().from(startupTeams).where(eq(startupTeams.id, params.teamId)).limit(1))[0];
      if (!teamRow) throw new Error('ESC_RULE:Startup team not found.');
      const userRow = (await tx.select().from(users).where(eq(users.uid, params.userUid)).limit(1))[0];
      if (!userRow) throw new Error('ESC_RULE:Member not found.');

      const now = new Date();

      if (params.action === 'remove') {
        if (teamRow.leaderUid === params.userUid) {
          throw new Error('ESC_RULE:Reassign the Team Leader before removing the current leader.');
        }
        await tx
          .delete(startupTeamMembers)
          .where(and(eq(startupTeamMembers.teamId, params.teamId), eq(startupTeamMembers.userUid, params.userUid)));

        if (userRow.startupTeamId === params.teamId) {
          await tx
            .update(users)
            .set({ startupTeamId: '', teamRole: '', updatedAt: now })
            .where(eq(users.uid, params.userUid));
        }
      } else {
        const currentMembers = await tx
          .select()
          .from(startupTeamMembers)
          .where(eq(startupTeamMembers.teamId, params.teamId));
        if (currentMembers.some((m) => m.userUid === params.userUid)) {
          throw new Error('ESC_RULE:Member is already in this team.');
        }
        const activeCount = await getActiveTeamCountForMemberTx(tx, params.userUid, params.teamId);
        const eligibility = canMemberJoinOrCreateTeam({
          userProfile: userRow as any,
          existingActiveTeamCount: activeCount,
          targetTeamMemberCount: currentMembers.length,
          maxMembers: teamRow.maxMembers,
          allowMultiTeamOverride: Boolean(teamRow.allowMultiTeamOverride),
        });
        if (!eligibility.allowed) {
          throw new Error(`ESC_RULE:${eligibility.reason}`);
        }

        await tx.insert(startupTeamMembers).values({
          id: `tm_${params.teamId}_${params.userUid}`,
          teamId: params.teamId,
          userUid: params.userUid,
          role: params.role || 'member',
          title: params.role === 'leader' ? 'Team Leader' : 'Engineering Member',
          joinedAt: now,
        });

        await tx
          .update(users)
          .set({ startupTeamId: params.teamId, teamRole: params.role || 'member', updatedAt: now })
          .where(eq(users.uid, params.userUid));
      }

      const updatedTeams = await tx
        .update(startupTeams)
        .set({ lastActivityAt: now, updatedAt: now })
        .where(eq(startupTeams.id, params.teamId))
        .returning();

      await tx.insert(activityLogs).values({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        actorUid: params.adminUid,
        actorName: params.adminEmail,
        memberUid: params.userUid,
        teamId: params.teamId,
        activityType: params.action === 'add' ? 'admin_member_added' : 'admin_member_removed',
        title: `Admin ${params.action === 'add' ? 'added' : 'removed'} ${userRow.fullName}`,
        details: `${params.adminEmail} ${params.action === 'add' ? 'added' : 'removed'} ${userRow.fullName} in team "${teamRow.name}".`,
        status: teamRow.status,
      });

      const hydrated = await hydrateTeamsWithMembers(updatedTeams);
      return hydrated[0];
    });
  } catch (error) {
    wrapRepoError('adminAddOrRemoveTeamMember', error);
  }
}

export async function updateStartupTeamDetails(params: {
  teamId: string;
  actorUid: string;
  isAdmin: boolean;
  patch: Partial<{
    name: string;
    problemStatement: string;
    proposedSolution: string;
    ideaDescription: string;
    domain: string;
    stage: string;
    skillsRequired: string[];
    expectedOutcome: string;
    logoUrl: string;
    supportingDocs: { name: string; url: string }[];
    status: string;
    isApproved: boolean;
    allowMultiTeamOverride: boolean;
    nextDeadline: string;
    progressPercent: number;
    adminNotes: string;
  }>;
}) {
  try {
    const teamRow = (await db.select().from(startupTeams).where(eq(startupTeams.id, params.teamId)).limit(1))[0];
    if (!teamRow) throw new Error('ESC_RULE:Startup team not found.');
    if (!params.isAdmin && teamRow.leaderUid !== params.actorUid) {
      throw new Error('ESC_RULE:Only the Team Leader or an Admin can update this Startup Team.');
    }

    const updateSet: Record<string, any> = {
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };

    const leaderEditableKeys = [
      'name',
      'problemStatement',
      'proposedSolution',
      'ideaDescription',
      'domain',
      'stage',
      'skillsRequired',
      'expectedOutcome',
      'logoUrl',
      'supportingDocs',
    ] as const;

    for (const k of leaderEditableKeys) {
      if (params.patch[k] !== undefined) {
        updateSet[k] = params.patch[k];
      }
    }

    if (params.isAdmin) {
      if (params.patch.status !== undefined) updateSet.status = params.patch.status;
      if (params.patch.isApproved !== undefined) updateSet.isApproved = params.patch.isApproved;
      if (params.patch.allowMultiTeamOverride !== undefined) {
        updateSet.allowMultiTeamOverride = params.patch.allowMultiTeamOverride;
      }
      if (params.patch.nextDeadline !== undefined) updateSet.nextDeadline = params.patch.nextDeadline;
      if (params.patch.progressPercent !== undefined) updateSet.progressPercent = params.patch.progressPercent;
      if (params.patch.adminNotes !== undefined) updateSet.adminNotes = params.patch.adminNotes;
    }

    const updated = await db
      .update(startupTeams)
      .set(updateSet)
      .where(eq(startupTeams.id, params.teamId))
      .returning();

    if (params.isAdmin && (params.patch.status || params.patch.isApproved !== undefined)) {
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: teamRow.leaderUid,
        title: `Startup Team Update: ${teamRow.name}`,
        description: `Admin updated "${teamRow.name}" status to ${(updateSet.status || teamRow.status).replace(/_/g, ' ').toUpperCase()}.`,
        senderName: 'ESC Admin Review',
        type: 'admin_notice',
        relatedMemberUid: teamRow.leaderUid,
        relatedTeamId: teamRow.id,
        linkTab: 'team',
      });
    }

    const hydrated = await hydrateTeamsWithMembers(updated);
    return hydrated[0];
  } catch (error) {
    wrapRepoError('updateStartupTeamDetails', error);
  }
}

/* ============================================================================
 * PRIVATE TEAM CHAT (STRICT TEAM MEMBERS + AUTHORIZED ADMINS ONLY)
 * ============================================================================ */

export async function assertTeamChatAccess(teamId: string, userUid: string, isAdmin: boolean) {
  const team = (await db.select().from(startupTeams).where(eq(startupTeams.id, teamId)).limit(1))[0];
  if (!team) {
    throw new Error('ESC_RULE:Startup team not found.');
  }
  if (isAdmin) {
    return { team, isMember: false, isAdminAccess: true };
  }
  const membership = await db
    .select()
    .from(startupTeamMembers)
    .where(and(eq(startupTeamMembers.teamId, teamId), eq(startupTeamMembers.userUid, userUid)))
    .limit(1);

  if (!membership[0]) {
    throw new Error('ESC_RULE:Forbidden: Team Chat is private to verified members of this team and authorized ESC Admins.');
  }
  return { team, isMember: true, isAdminAccess: false, memberRole: membership[0].role };
}

export async function listTeamMessages(teamId: string, viewerUid: string, isAdmin: boolean) {
  try {
    await assertTeamChatAccess(teamId, viewerUid, isAdmin);
    return await db
      .select()
      .from(teamMessages)
      .where(eq(teamMessages.teamId, teamId))
      .orderBy(asc(teamMessages.createdAt))
      .limit(200);
  } catch (error) {
    wrapRepoError('listTeamMessages', error);
  }
}

export async function postTeamMessage(params: {
  teamId: string;
  senderUid: string;
  senderName: string;
  isAdmin: boolean;
  content: string;
  attachmentName?: string;
  attachmentUrl?: string;
}) {
  try {
    const access = await assertTeamChatAccess(params.teamId, params.senderUid, params.isAdmin);
    const now = new Date();
    const senderRole = access.isAdminAccess ? 'admin' : access.memberRole || 'member';
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const rows = await db
      .insert(teamMessages)
      .values({
        id: msgId,
        teamId: params.teamId,
        senderUid: params.senderUid,
        senderName: params.senderName,
        senderRole,
        content: params.content.trim(),
        attachmentName: params.attachmentName || '',
        attachmentUrl: params.attachmentUrl || '',
        readBy: [params.senderUid],
        createdAt: now,
      })
      .returning();

    await db
      .update(startupTeams)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(startupTeams.id, params.teamId));

    // Notify teammates (except sender)
    const teamMembers = await db
      .select()
      .from(startupTeamMembers)
      .where(and(eq(startupTeamMembers.teamId, params.teamId), ne(startupTeamMembers.userUid, params.senderUid)));

    for (const tm of teamMembers) {
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: tm.userUid,
        title: `New Message in ${access.team.name}`,
        description: `${params.senderName}: ${params.content.trim().slice(0, 90)}`,
        senderName: params.senderName,
        type: 'team_message',
        relatedMemberUid: params.senderUid,
        relatedTeamId: params.teamId,
        linkTab: 'team',
      });
    }

    await recordActivityLog({
      actorUid: params.senderUid,
      actorName: params.senderName,
      memberUid: params.senderUid,
      teamId: params.teamId,
      activityType: 'team_message',
      title: `Posted in ${access.team.name} chat`,
      details: `${params.senderName} sent a message${params.attachmentName ? ` with file "${params.attachmentName}"` : ''}.`,
      status: 'sent',
    });

    return rows[0];
  } catch (error) {
    wrapRepoError('postTeamMessage', error);
  }
}

export async function markTeamMessagesRead(teamId: string, viewerUid: string, isAdmin: boolean) {
  try {
    await assertTeamChatAccess(teamId, viewerUid, isAdmin);
    const msgs = await db.select().from(teamMessages).where(eq(teamMessages.teamId, teamId));
    for (const m of msgs) {
      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      if (!readBy.includes(viewerUid)) {
        await db
          .update(teamMessages)
          .set({ readBy: [...readBy, viewerUid] })
          .where(eq(teamMessages.id, m.id));
      }
    }
    return true;
  } catch (error) {
    wrapRepoError('markTeamMessagesRead', error);
  }
}

/* ============================================================================
 * TASKS, MILESTONES & PROGRESS REPORTS
 * ============================================================================ */

function normalizeTaskRow(row: typeof tasks.$inferSelect, teamNameMap: Map<string, string>) {
  return {
    ...row,
    teamName: teamNameMap.get(row.teamId) || '',
    status: evaluateTaskOverdue({ status: row.status as any, deadline: row.deadline }),
  };
}

export async function listAllTasksForAdmin() {
  try {
    const [taskRows, teamRows] = await Promise.all([
      db.select().from(tasks).orderBy(asc(tasks.deadline)),
      db.select({ id: startupTeams.id, name: startupTeams.name }).from(startupTeams),
    ]);
    const nameMap = new Map(teamRows.map((t) => [t.id, t.name]));
    return taskRows.map((r) => normalizeTaskRow(r, nameMap));
  } catch (error) {
    wrapRepoError('listAllTasksForAdmin', error);
  }
}

export async function listMemberTasks(userUid: string) {
  try {
    const memberships = await db
      .select({ teamId: startupTeamMembers.teamId })
      .from(startupTeamMembers)
      .where(eq(startupTeamMembers.userUid, userUid));
    const teamIds = memberships.map((m) => m.teamId);

    const condition =
      teamIds.length > 0
        ? or(eq(tasks.assignedToUid, userUid), inArray(tasks.teamId, teamIds))
        : eq(tasks.assignedToUid, userUid);

    const [taskRows, teamRows] = await Promise.all([
      db.select().from(tasks).where(condition).orderBy(asc(tasks.deadline)),
      db.select({ id: startupTeams.id, name: startupTeams.name }).from(startupTeams),
    ]);
    const nameMap = new Map(teamRows.map((t) => [t.id, t.name]));
    return taskRows.map((r) => normalizeTaskRow(r, nameMap));
  } catch (error) {
    wrapRepoError('listMemberTasks', error);
  }
}

export async function createAdminTask(params: {
  title: string;
  description: string;
  teamId: string;
  assignedToUid?: string;
  assignedToName?: string;
  priority: string;
  startDate?: string;
  deadline: string;
  expectedDeliverable?: string;
  instructions?: string;
  supportingFiles?: { name: string; url: string }[];
  createdBy: string;
  adminUid: string;
}) {
  try {
    const teamRow = (await db.select().from(startupTeams).where(eq(startupTeams.id, params.teamId)).limit(1))[0];
    if (!teamRow) throw new Error('ESC_RULE:Selected startup team does not exist.');

    const now = new Date();
    const id = `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rows = await db
      .insert(tasks)
      .values({
        id,
        title: params.title.trim(),
        description: params.description.trim(),
        teamId: params.teamId,
        assignedToUid: params.assignedToUid || teamRow.leaderUid,
        assignedToName: params.assignedToName || teamRow.leaderName,
        priority: params.priority || 'medium',
        startDate: params.startDate || '',
        deadline: params.deadline,
        expectedDeliverable: params.expectedDeliverable || '',
        instructions: params.instructions || '',
        supportingFiles: params.supportingFiles || [],
        status: 'not_started',
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Update team's nextDeadline if empty or earlier
    if (!teamRow.nextDeadline || params.deadline < teamRow.nextDeadline) {
      await db
        .update(startupTeams)
        .set({ nextDeadline: params.deadline, updatedAt: now })
        .where(eq(startupTeams.id, params.teamId));
    }

    // Notify all team members
    const members = await db
      .select({ userUid: startupTeamMembers.userUid })
      .from(startupTeamMembers)
      .where(eq(startupTeamMembers.teamId, params.teamId));
    for (const m of members) {
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: m.userUid,
        title: `New Task Assigned: ${params.title.trim()}`,
        description: `Team ${teamRow.name} • Deadline: ${params.deadline} • Priority: ${params.priority.toUpperCase()}`,
        senderName: 'ESC Super Admin',
        type: 'task_assigned',
        relatedMemberUid: m.userUid,
        relatedTeamId: params.teamId,
        linkTab: 'tasks',
      });
    }

    await recordActivityLog({
      actorUid: params.adminUid,
      actorName: params.createdBy,
      memberUid: params.assignedToUid || teamRow.leaderUid,
      teamId: params.teamId,
      activityType: 'task_assigned',
      title: `Assigned Task: ${params.title.trim()}`,
      details: `Task assigned to ${teamRow.name} (${params.assignedToName || teamRow.leaderName}), due ${params.deadline}.`,
      status: 'not_started',
    });

    return { ...rows[0], teamName: teamRow.name };
  } catch (error) {
    wrapRepoError('createAdminTask', error);
  }
}

export async function adminUpdateTaskReview(params: {
  taskId: string;
  adminUid: string;
  adminEmail: string;
  patch: Partial<{
    title: string;
    description: string;
    priority: string;
    deadline: string;
    status: string;
    adminFeedback: string;
    expectedDeliverable: string;
    instructions: string;
  }>;
}) {
  try {
    const existing = (await db.select().from(tasks).where(eq(tasks.id, params.taskId)).limit(1))[0];
    if (!existing) throw new Error('ESC_RULE:Task not found.');

    const now = new Date();
    const updateValues: Record<string, any> = {
      ...params.patch,
      updatedAt: now,
    };
    if (params.patch.status === 'completed') {
      updateValues.completedAt = now;
    }

    const updated = await db.update(tasks).set(updateValues).where(eq(tasks.id, params.taskId)).returning();

    if (params.patch.status === 'completed' || params.patch.status === 'revision_required') {
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: existing.assignedToUid || '',
        title:
          params.patch.status === 'completed'
            ? `Task Approved: ${existing.title}`
            : `Revision Requested: ${existing.title}`,
        description: params.patch.adminFeedback || `Admin updated task status to ${params.patch.status}.`,
        senderName: params.adminEmail,
        type: 'task_reviewed',
        relatedMemberUid: existing.assignedToUid || '',
        relatedTeamId: existing.teamId,
        linkTab: 'tasks',
      });
    }

    await recordActivityLog({
      actorUid: params.adminUid,
      actorName: params.adminEmail,
      memberUid: existing.assignedToUid || '',
      teamId: existing.teamId,
      activityType: 'task_reviewed',
      title: `Task Updated: ${existing.title}`,
      details: `Status set to ${params.patch.status || existing.status}${params.patch.adminFeedback ? ` — ${params.patch.adminFeedback}` : ''}`,
      status: params.patch.status || existing.status,
    });

    return updated[0];
  } catch (error) {
    wrapRepoError('adminUpdateTaskReview', error);
  }
}

export async function memberUpdateTaskSubmission(params: {
  taskId: string;
  actorUid: string;
  actorName: string;
  status: 'in_progress' | 'submitted_for_review';
  submissionNotes?: string;
  submissionUrl?: string;
  submissionFiles?: { name: string; url: string }[];
}) {
  try {
    const taskRow = (await db.select().from(tasks).where(eq(tasks.id, params.taskId)).limit(1))[0];
    if (!taskRow) throw new Error('ESC_RULE:Task not found.');

    const membership = await db
      .select()
      .from(startupTeamMembers)
      .where(and(eq(startupTeamMembers.teamId, taskRow.teamId), eq(startupTeamMembers.userUid, params.actorUid)))
      .limit(1);

    if (!membership[0] && taskRow.assignedToUid !== params.actorUid) {
      throw new Error('ESC_RULE:Forbidden: Only team members assigned to this task can submit updates.');
    }

    const now = new Date();
    const updated = await db
      .update(tasks)
      .set({
        status: params.status,
        submissionNotes: params.submissionNotes ?? taskRow.submissionNotes,
        submissionUrl: params.submissionUrl ?? taskRow.submissionUrl,
        submissionFiles: params.submissionFiles ?? taskRow.submissionFiles,
        submittedAt: params.status === 'submitted_for_review' ? now : taskRow.submittedAt,
        updatedAt: now,
      })
      .where(eq(tasks.id, params.taskId))
      .returning();

    if (params.status === 'submitted_for_review') {
      await createNotificationSafe({
        recipientType: 'admin',
        recipientUid: '',
        title: `Task Deliverable Submitted: ${taskRow.title}`,
        description: `${params.actorName} submitted deliverables for "${taskRow.title}".`,
        senderName: params.actorName,
        type: 'task_submitted',
        relatedMemberUid: params.actorUid,
        relatedTeamId: taskRow.teamId,
        linkTab: 'tasks',
      });
    }

    await recordActivityLog({
      actorUid: params.actorUid,
      actorName: params.actorName,
      memberUid: params.actorUid,
      teamId: taskRow.teamId,
      activityType: params.status === 'submitted_for_review' ? 'task_submitted' : 'task_progress',
      title: `Task ${params.status === 'submitted_for_review' ? 'Submitted' : 'In Progress'}: ${taskRow.title}`,
      details: params.submissionNotes || `Updated task status to ${params.status}.`,
      status: params.status,
    });

    return updated[0];
  } catch (error) {
    wrapRepoError('memberUpdateTaskSubmission', error);
  }
}

export async function createTeamMilestone(params: {
  teamId: string;
  actorUid: string;
  actorName: string;
  isAdmin: boolean;
  title: string;
  description?: string;
  dueDate: string;
  progressPercent?: number;
}) {
  try {
    await assertTeamChatAccess(params.teamId, params.actorUid, params.isAdmin);
    const id = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rows = await db
      .insert(projectMilestones)
      .values({
        id,
        teamId: params.teamId,
        title: params.title.trim(),
        description: params.description || '',
        dueDate: params.dueDate,
        status: 'upcoming',
        progressPercent: Number(params.progressPercent || 0),
      })
      .returning();

    await recordActivityLog({
      actorUid: params.actorUid,
      actorName: params.actorName,
      memberUid: params.actorUid,
      teamId: params.teamId,
      activityType: 'milestone_added',
      title: `Added Milestone: ${params.title.trim()}`,
      details: `Target completion date: ${params.dueDate}`,
      status: 'upcoming',
    });

    return rows[0];
  } catch (error) {
    wrapRepoError('createTeamMilestone', error);
  }
}

export async function submitTeamProgressReport(params: {
  teamId: string;
  authorUid: string;
  authorName: string;
  summary: string;
  accomplishments: string;
  blockers?: string;
  nextSteps?: string;
  progressPercent: number;
  attachments?: { name: string; url: string }[];
}) {
  try {
    const access = await assertTeamChatAccess(params.teamId, params.authorUid, false);
    const now = new Date();
    const id = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const rows = await db
      .insert(progressReports)
      .values({
        id,
        teamId: params.teamId,
        authorUid: params.authorUid,
        authorName: params.authorName,
        summary: params.summary.trim(),
        accomplishments: params.accomplishments.trim(),
        blockers: params.blockers || '',
        nextSteps: params.nextSteps || '',
        progressPercent: Math.min(100, Math.max(0, Number(params.progressPercent || 0))),
        attachments: params.attachments || [],
        status: 'submitted',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db
      .update(startupTeams)
      .set({
        progressPercent: Math.min(100, Math.max(0, Number(params.progressPercent || 0))),
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(startupTeams.id, params.teamId));

    await createNotificationSafe({
      recipientType: 'admin',
      recipientUid: '',
      title: `Progress Report Submitted: ${access.team.name}`,
      description: `${params.authorName} reported ${params.progressPercent}% progress: ${params.summary.trim().slice(0, 90)}`,
      senderName: params.authorName,
      type: 'task_submitted',
      relatedMemberUid: params.authorUid,
      relatedTeamId: params.teamId,
      linkTab: 'teams',
    });

    await recordActivityLog({
      actorUid: params.authorUid,
      actorName: params.authorName,
      memberUid: params.authorUid,
      teamId: params.teamId,
      activityType: 'progress_report',
      title: `Progress Report (${params.progressPercent}%)`,
      details: params.summary.trim(),
      status: 'submitted',
    });

    return rows[0];
  } catch (error) {
    wrapRepoError('submitTeamProgressReport', error);
  }
}

export async function listAllProgressReports(teamId?: string) {
  try {
    if (teamId) {
      return await db
        .select()
        .from(progressReports)
        .where(eq(progressReports.teamId, teamId))
        .orderBy(desc(progressReports.createdAt));
    }
    return await db.select().from(progressReports).orderBy(desc(progressReports.createdAt));
  } catch (error) {
    wrapRepoError('listAllProgressReports', error);
  }
}

export async function adminReviewProgressReport(params: {
  reportId: string;
  adminEmail: string;
  adminReviewNotes: string;
  status: 'reviewed' | 'needs_attention';
}) {
  try {
    const rows = await db
      .update(progressReports)
      .set({
        adminReviewNotes: params.adminReviewNotes,
        reviewedBy: params.adminEmail,
        status: params.status,
        updatedAt: new Date(),
      })
      .where(eq(progressReports.id, params.reportId))
      .returning();

    if (rows[0]) {
      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: rows[0].authorUid,
        title: `Progress Report Reviewed`,
        description: params.adminReviewNotes || `Admin marked your progress report as ${params.status}.`,
        senderName: params.adminEmail,
        type: 'task_reviewed',
        relatedMemberUid: rows[0].authorUid,
        relatedTeamId: rows[0].teamId,
        linkTab: 'team',
      });
    }
    return rows[0] || null;
  } catch (error) {
    wrapRepoError('adminReviewProgressReport', error);
  }
}

export async function listActivityLogs(filters?: {
  memberUid?: string;
  teamId?: string;
  activityType?: string;
}) {
  try {
    const rows = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(250);
    return rows.filter((r) => {
      if (filters?.memberUid && r.memberUid !== filters.memberUid && r.actorUid !== filters.memberUid) return false;
      if (filters?.teamId && r.teamId !== filters.teamId) return false;
      if (filters?.activityType && filters.activityType !== 'all' && r.activityType !== filters.activityType) return false;
      return true;
    });
  } catch (error) {
    wrapRepoError('listActivityLogs', error);
  }
}
