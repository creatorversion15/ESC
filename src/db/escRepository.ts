import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminAuditLogs,
  announcements,
  applications,
  certificates,
  challengeRegistrations,
  challenges,
  challengeSubmissions,
  customSkills,
  eventRegistrations,
  events,
  ideas,
  opportunities,
  opportunityApplications,
  problems,
  projects,
  users,
} from './schema.ts';
import { cleanSkillDisplayName, normalizeSkillName } from '../utils/escLogic.ts';

function wrapDbError(context: string, error: unknown): never {
  console.error(`Database query failed [${context}]:`, error);
  throw new Error('Database operation failed. Please try again later.', { cause: error });
}

/* ============================================================================
 * CHALLENGES
 * ============================================================================ */

export async function listChallenges(includeUnpublished: boolean) {
  try {
    if (includeUnpublished) {
      return await db.select().from(challenges).orderBy(desc(challenges.createdAt));
    }
    return await db
      .select()
      .from(challenges)
      .where(eq(challenges.isPublished, true))
      .orderBy(desc(challenges.createdAt));
  } catch (error) {
    wrapDbError('listChallenges', error);
  }
}

export async function upsertChallenge(payload: typeof challenges.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(challenges)
      .values({
        ...payload,
        createdAt: payload.createdAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: challenges.id,
        set: {
          title: payload.title,
          description: payload.description,
          category: payload.category,
          posterUrl: payload.posterUrl,
          eligibility: payload.eligibility,
          requiredSkills: payload.requiredSkills,
          participationType: payload.participationType,
          minTeamSize: payload.minTeamSize,
          maxTeamSize: payload.maxTeamSize,
          startDateTime: payload.startDateTime,
          registrationDeadline: payload.registrationDeadline,
          submissionDeadline: payload.submissionDeadline,
          rules: payload.rules,
          submissionInstructions: payload.submissionInstructions,
          requiredSubmissionFiles: payload.requiredSubmissionFiles,
          prizeOrRewards: payload.prizeOrRewards,
          certificateAvailable: payload.certificateAvailable,
          contactInfo: payload.contactInfo,
          status: payload.status,
          isPublished: payload.isPublished,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertChallenge', error);
  }
}

export async function deleteChallengeById(id: string) {
  try {
    const deleted = await db.delete(challenges).where(eq(challenges.id, id)).returning();
    return deleted[0] || null;
  } catch (error) {
    wrapDbError('deleteChallengeById', error);
  }
}

export async function registerForChallenge(payload: typeof challengeRegistrations.$inferInsert) {
  try {
    const existing = await db
      .select()
      .from(challengeRegistrations)
      .where(
        and(
          eq(challengeRegistrations.challengeId, payload.challengeId),
          eq(challengeRegistrations.userUid, payload.userUid)
        )
      )
      .limit(1);

    if (existing[0]) {
      return { registration: existing[0], alreadyRegistered: true };
    }

    const rows = await db
      .insert(challengeRegistrations)
      .values(payload)
      .returning();

    await db
      .update(challenges)
      .set({
        registeredCount: sql`${challenges.registeredCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(challenges.id, payload.challengeId));

    return { registration: rows[0], alreadyRegistered: false };
  } catch (error) {
    wrapDbError('registerForChallenge', error);
  }
}

export async function submitToChallenge(payload: typeof challengeSubmissions.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(challengeSubmissions)
      .values({
        ...payload,
        submittedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: challengeSubmissions.id,
        set: {
          projectTitle: payload.projectTitle,
          summary: payload.summary,
          repoUrl: payload.repoUrl,
          demoVideoUrl: payload.demoVideoUrl,
          deckOrDocUrl: payload.deckOrDocUrl,
          deliverablesChecklist: payload.deliverablesChecklist,
          notes: payload.notes,
          teamName: payload.teamName,
          updatedAt: now,
        },
      })
      .returning();

    await db
      .update(challenges)
      .set({
        submissionCount: sql`${challenges.submissionCount} + 1`,
        updatedAt: now,
      })
      .where(eq(challenges.id, payload.challengeId));

    await db
      .update(challengeRegistrations)
      .set({ status: 'submitted' })
      .where(
        and(
          eq(challengeRegistrations.challengeId, payload.challengeId),
          eq(challengeRegistrations.userUid, payload.userUid)
        )
      );

    return rows[0];
  } catch (error) {
    wrapDbError('submitToChallenge', error);
  }
}

export async function getUserChallengeActivity(userUid: string) {
  try {
    const [registrations, submissions] = await Promise.all([
      db
        .select()
        .from(challengeRegistrations)
        .where(eq(challengeRegistrations.userUid, userUid))
        .orderBy(desc(challengeRegistrations.registeredAt)),
      db
        .select()
        .from(challengeSubmissions)
        .where(eq(challengeSubmissions.userUid, userUid))
        .orderBy(desc(challengeSubmissions.submittedAt)),
    ]);
    return { registrations, submissions };
  } catch (error) {
    wrapDbError('getUserChallengeActivity', error);
  }
}

/* ============================================================================
 * EVENTS
 * ============================================================================ */

export async function listEvents(includeUnpublished: boolean) {
  try {
    if (includeUnpublished) {
      return await db.select().from(events).orderBy(desc(events.createdAt));
    }
    return await db
      .select()
      .from(events)
      .where(eq(events.isPublished, true))
      .orderBy(desc(events.createdAt));
  } catch (error) {
    wrapDbError('listEvents', error);
  }
}

export async function upsertEvent(payload: typeof events.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(events)
      .values({
        ...payload,
        createdAt: payload.createdAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: events.id,
        set: {
          title: payload.title,
          description: payload.description,
          posterUrl: payload.posterUrl,
          type: payload.type,
          date: payload.date,
          startDateTime: payload.startDateTime,
          location: payload.location,
          meetingLink: payload.meetingLink,
          registrationDeadline: payload.registrationDeadline,
          eligibility: payload.eligibility,
          maxParticipants: payload.maxParticipants,
          instructions: payload.instructions,
          contactInfo: payload.contactInfo,
          certificateAvailable: payload.certificateAvailable,
          status: payload.status,
          isPublished: payload.isPublished,
          prizes: payload.prizes,
          schedule: payload.schedule,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertEvent', error);
  }
}

export async function deleteEventById(id: string) {
  try {
    const deleted = await db.delete(events).where(eq(events.id, id)).returning();
    return deleted[0] || null;
  } catch (error) {
    wrapDbError('deleteEventById', error);
  }
}

export async function registerForEvent(payload: typeof eventRegistrations.$inferInsert) {
  try {
    const existing = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, payload.eventId),
          eq(eventRegistrations.userUid, payload.userUid)
        )
      )
      .limit(1);

    if (existing[0]) {
      return { registration: existing[0], alreadyRegistered: true };
    }

    const rows = await db.insert(eventRegistrations).values(payload).returning();

    await db
      .update(events)
      .set({
        registeredCount: sql`${events.registeredCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(events.id, payload.eventId));

    return { registration: rows[0], alreadyRegistered: false };
  } catch (error) {
    wrapDbError('registerForEvent', error);
  }
}

export async function getUserEventRegistrations(userUid: string) {
  try {
    return await db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.userUid, userUid))
      .orderBy(desc(eventRegistrations.registeredAt));
  } catch (error) {
    wrapDbError('getUserEventRegistrations', error);
  }
}

/* ============================================================================
 * OPPORTUNITIES
 * ============================================================================ */

export async function listOpportunities(includeUnpublished: boolean) {
  try {
    if (includeUnpublished) {
      return await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
    }
    return await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.isPublished, true))
      .orderBy(desc(opportunities.createdAt));
  } catch (error) {
    wrapDbError('listOpportunities', error);
  }
}

export async function upsertOpportunity(payload: typeof opportunities.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(opportunities)
      .values({
        ...payload,
        createdAt: payload.createdAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: opportunities.id,
        set: {
          title: payload.title,
          category: payload.category,
          organization: payload.organization,
          posterUrl: payload.posterUrl,
          description: payload.description,
          allocationOrStipend: payload.allocationOrStipend,
          eligibility: payload.eligibility,
          requiredSkills: payload.requiredSkills,
          locationOrMode: payload.locationOrMode,
          applicationDeadline: payload.applicationDeadline,
          applyInstructions: payload.applyInstructions,
          externalApplyUrl: payload.externalApplyUrl,
          contactInfo: payload.contactInfo,
          status: payload.status,
          isPublished: payload.isPublished,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertOpportunity', error);
  }
}

export async function deleteOpportunityById(id: string) {
  try {
    const deleted = await db.delete(opportunities).where(eq(opportunities.id, id)).returning();
    return deleted[0] || null;
  } catch (error) {
    wrapDbError('deleteOpportunityById', error);
  }
}

export async function applyToOpportunity(payload: typeof opportunityApplications.$inferInsert) {
  try {
    const existing = await db
      .select()
      .from(opportunityApplications)
      .where(
        and(
          eq(opportunityApplications.opportunityId, payload.opportunityId),
          eq(opportunityApplications.userUid, payload.userUid)
        )
      )
      .limit(1);

    if (existing[0]) {
      return { application: existing[0], alreadyApplied: true };
    }

    const rows = await db.insert(opportunityApplications).values(payload).returning();

    await db
      .update(opportunities)
      .set({
        applicationsCount: sql`${opportunities.applicationsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, payload.opportunityId));

    return { application: rows[0], alreadyApplied: false };
  } catch (error) {
    wrapDbError('applyToOpportunity', error);
  }
}

export async function getUserOpportunityApplications(userUid: string) {
  try {
    return await db
      .select()
      .from(opportunityApplications)
      .where(eq(opportunityApplications.userUid, userUid))
      .orderBy(desc(opportunityApplications.appliedAt));
  } catch (error) {
    wrapDbError('getUserOpportunityApplications', error);
  }
}

/* ============================================================================
 * MEMBERSHIP APPLICATIONS, IDEAS, PROBLEMS, PROJECTS, CERTIFICATES, ANNOUNCEMENTS
 * ============================================================================ */

export async function getApplicationByUserUid(userUid: string) {
  try {
    const rows = await db
      .select()
      .from(applications)
      .where(eq(applications.userUid, userUid))
      .orderBy(desc(applications.updatedAt))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    wrapDbError('getApplicationByUserUid', error);
  }
}

export async function upsertMembershipApplication(payload: typeof applications.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(applications)
      .values({
        ...payload,
        createdAt: payload.createdAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: applications.id,
        set: {
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          college: payload.college,
          city: payload.city,
          state: payload.state,
          branch: payload.branch,
          academicYear: payload.academicYear,
          technicalSkills: payload.technicalSkills,
          nonTechnicalSkills: payload.nonTechnicalSkills,
          customSkills: payload.customSkills ?? [],
          portfolioUrl: payload.portfolioUrl,
          githubUrl: payload.githubUrl,
          linkedinUrl: payload.linkedinUrl,
          whyJoin: payload.whyJoin,
          startupInterests: payload.startupInterests,
          hasExistingIdea: payload.hasExistingIdea,
          existingIdeaSummary: payload.existingIdeaSummary,
          ideaAiAssisted: Boolean(payload.ideaAiAssisted),
          teamGoal: payload.teamGoal,
          weeklyAvailability: payload.weeklyAvailability,
          termsAccepted: Boolean(payload.termsAccepted),
          termsAcceptedAt: payload.termsAcceptedAt || '',
          policyVersion: payload.policyVersion || '',
          status: payload.status,
          updatedAt: now,
        },
      })
      .returning();

    await db
      .update(users)
      .set({
        fullName: payload.fullName,
        phone: payload.phone || '',
        college: payload.college,
        city: payload.city,
        state: payload.state,
        branch: payload.branch,
        academicYear: payload.academicYear,
        technicalSkills: payload.technicalSkills,
        nonTechnicalSkills: payload.nonTechnicalSkills,
        customSkills: payload.customSkills ?? [],
        portfolioUrl: payload.portfolioUrl || '',
        githubUrl: payload.githubUrl || '',
        linkedinUrl: payload.linkedinUrl || '',
        weeklyAvailability: payload.weeklyAvailability,
        membershipStatus: payload.status,
        updatedAt: now,
      })
      .where(eq(users.uid, payload.userUid));

    return rows[0];
  } catch (error) {
    wrapDbError('upsertMembershipApplication', error);
  }
}

export async function listAllApplications() {
  try {
    return await db.select().from(applications).orderBy(desc(applications.updatedAt));
  } catch (error) {
    wrapDbError('listAllApplications', error);
  }
}

export async function updateApplicationReview(params: {
  id: string;
  status: string;
  adminNotes?: string;
  reviewedBy: string;
}) {
  try {
    const now = new Date();
    const rows = await db
      .update(applications)
      .set({
        status: params.status,
        adminNotes: params.adminNotes ?? '',
        reviewedBy: params.reviewedBy,
        updatedAt: now,
      })
      .where(eq(applications.id, params.id))
      .returning();

    if (rows[0]) {
      const nextRole = params.status === 'approved' ? 'member' : undefined;
      await db
        .update(users)
        .set({
          membershipStatus: params.status,
          ...(nextRole ? { role: nextRole } : {}),
          updatedAt: now,
        })
        .where(eq(users.uid, rows[0].userUid));
    }

    return rows[0] || null;
  } catch (error) {
    wrapDbError('updateApplicationReview', error);
  }
}

export async function listIdeas(viewerUid?: string, isAdmin: boolean = false) {
  try {
    if (isAdmin) {
      return await db.select().from(ideas).orderBy(desc(ideas.createdAt));
    }
    if (viewerUid) {
      return await db
        .select()
        .from(ideas)
        .where(or(eq(ideas.isPublic, true), eq(ideas.authorUid, viewerUid)))
        .orderBy(desc(ideas.createdAt));
    }
    return await db
      .select()
      .from(ideas)
      .where(eq(ideas.isPublic, true))
      .orderBy(desc(ideas.createdAt));
  } catch (error) {
    wrapDbError('listIdeas', error);
  }
}

export async function upsertIdea(payload: typeof ideas.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(ideas)
      .values({ ...payload, createdAt: payload.createdAt || now, updatedAt: now })
      .onConflictDoUpdate({
        target: ideas.id,
        set: {
          title: payload.title,
          problemStatement: payload.problemStatement,
          targetAudience: payload.targetAudience,
          proposedSolution: payload.proposedSolution,
          industry: payload.industry,
          uniqueValueProposition: payload.uniqueValueProposition,
          stage: payload.stage,
          demoUrl: payload.demoUrl,
          skillsRequired: payload.skillsRequired,
          teamRequirements: payload.teamRequirements,
          fundingRequirements: payload.fundingRequirements,
          isPublic: payload.isPublic,
          reviewStatus: payload.reviewStatus,
          aiAssisted: Boolean(payload.aiAssisted),
          adminFeedback: payload.adminFeedback,
          reviewedBy: payload.reviewedBy ?? '',
          reviewedAt: payload.reviewedAt ?? '',
          decisionHistory: payload.decisionHistory ?? [],
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertIdea', error);
  }
}

export async function reviewIdeaById(params: {
  id: string;
  reviewStatus: 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'cancelled';
  adminFeedback?: string;
  adminEmail: string;
}) {
  try {
    const existingRows = await db.select().from(ideas).where(eq(ideas.id, params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return null;

    const now = new Date();
    const nowIso = now.toISOString();
    const prevHistory = Array.isArray(existing.decisionHistory) ? existing.decisionHistory : [];
    const nextHistory = [
      ...prevHistory,
      {
        status: params.reviewStatus,
        feedback: params.adminFeedback || '',
        adminEmail: params.adminEmail,
        timestamp: nowIso,
      },
    ];

    const rows = await db
      .update(ideas)
      .set({
        reviewStatus: params.reviewStatus,
        isPublic: params.reviewStatus === 'approved',
        adminFeedback: params.adminFeedback ?? existing.adminFeedback ?? '',
        reviewedBy: params.adminEmail,
        reviewedAt: nowIso,
        decisionHistory: nextHistory,
        updatedAt: now,
      })
      .where(eq(ideas.id, params.id))
      .returning();

    return rows[0] || null;
  } catch (error) {
    wrapDbError('reviewIdeaById', error);
  }
}

/* ============================================================================
 * CUSTOM SKILLS CATALOG & ADMIN MODERATION
 * ============================================================================ */

export async function listCustomSkills(options?: { includeAll?: boolean; viewerUid?: string }) {
  try {
    if (options?.includeAll) {
      return await db.select().from(customSkills).orderBy(desc(customSkills.updatedAt));
    }
    if (options?.viewerUid) {
      return await db
        .select()
        .from(customSkills)
        .where(
          or(
            eq(customSkills.status, 'approved'),
            and(eq(customSkills.submittedByUid, options.viewerUid), eq(customSkills.status, 'pending'))
          )
        )
        .orderBy(desc(customSkills.usageCount));
    }
    return await db
      .select()
      .from(customSkills)
      .where(eq(customSkills.status, 'approved'))
      .orderBy(desc(customSkills.usageCount));
  } catch (error) {
    wrapDbError('listCustomSkills', error);
  }
}

export async function createOrIncrementCustomSkill(params: {
  name: string;
  skillType: 'technical' | 'non_technical';
  category?: string;
  submittedByUid: string;
  submittedByName: string;
  autoApprove?: boolean;
}) {
  try {
    const cleanName = cleanSkillDisplayName(params.name);
    const normalizedName = normalizeSkillName(cleanName);
    if (!normalizedName) {
      throw new Error('Skill name cannot be empty.');
    }

    const existingRows = await db
      .select()
      .from(customSkills)
      .where(eq(customSkills.normalizedName, normalizedName))
      .limit(1);

    const now = new Date();
    if (existingRows[0]) {
      const existing = existingRows[0];
      if (existing.status === 'rejected') {
        const reopened = await db
          .update(customSkills)
          .set({
            status: params.autoApprove ? 'approved' : 'pending',
            usageCount: sql`${customSkills.usageCount} + 1`,
            updatedAt: now,
          })
          .where(eq(customSkills.id, existing.id))
          .returning();
        return { skill: reopened[0], existed: true };
      }
      const bumped = await db
        .update(customSkills)
        .set({
          usageCount: sql`${customSkills.usageCount} + 1`,
          updatedAt: now,
        })
        .where(eq(customSkills.id, existing.id))
        .returning();
      return { skill: bumped[0], existed: true };
    }

    const id = `cskill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rows = await db
      .insert(customSkills)
      .values({
        id,
        name: cleanName,
        normalizedName,
        skillType: params.skillType === 'non_technical' ? 'non_technical' : 'technical',
        category:
          params.category?.trim() ||
          (params.skillType === 'non_technical' ? 'Custom Non-Technical' : 'Other Engineering Skills'),
        status: params.autoApprove ? 'approved' : 'pending',
        submittedByUid: params.submittedByUid,
        submittedByName: params.submittedByName,
        usageCount: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { skill: rows[0], existed: false };
  } catch (error) {
    wrapDbError('createOrIncrementCustomSkill', error);
  }
}

async function propagateSkillReplacement(oldName: string, newName: string) {
  const oldNorm = normalizeSkillName(oldName);
  const replaceArr = (arr: string[] | null | undefined) => {
    if (!Array.isArray(arr) || arr.length === 0) return { changed: false, next: arr || [] };
    let changed = false;
    const seen = new Set<string>();
    const next: string[] = [];
    for (const item of arr) {
      const target = normalizeSkillName(item) === oldNorm ? newName : item;
      if (target !== item) changed = true;
      const key = normalizeSkillName(target);
      if (key && !seen.has(key)) {
        seen.add(key);
        next.push(target);
      }
    }
    return { changed, next };
  };

  const [allUsers, allApps] = await Promise.all([db.select().from(users), db.select().from(applications)]);
  const now = new Date();

  for (const u of allUsers) {
    const t = replaceArr(u.technicalSkills);
    const nt = replaceArr(u.nonTechnicalSkills);
    const c = replaceArr(u.customSkills);
    if (t.changed || nt.changed || c.changed) {
      await db
        .update(users)
        .set({
          technicalSkills: t.next,
          nonTechnicalSkills: nt.next,
          customSkills: c.next,
          updatedAt: now,
        })
        .where(eq(users.uid, u.uid));
    }
  }

  for (const app of allApps) {
    const t = replaceArr(app.technicalSkills);
    const nt = replaceArr(app.nonTechnicalSkills);
    const c = replaceArr(app.customSkills);
    if (t.changed || nt.changed || c.changed) {
      await db
        .update(applications)
        .set({
          technicalSkills: t.next,
          nonTechnicalSkills: nt.next,
          customSkills: c.next,
          updatedAt: now,
        })
        .where(eq(applications.id, app.id));
    }
  }
}

export async function moderateCustomSkill(
  id: string,
  params: {
    action: 'approve' | 'reject' | 'rename' | 'merge';
    newName?: string;
    skillType?: 'technical' | 'non_technical';
    category?: string;
    mergeTargetName?: string;
    adminEmail: string;
  }
) {
  try {
    const rows = await db.select().from(customSkills).where(eq(customSkills.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) return null;

    const now = new Date();
    const nowIso = now.toISOString();

    if (params.action === 'approve') {
      const updated = await db
        .update(customSkills)
        .set({
          status: 'approved',
          skillType: params.skillType || existing.skillType,
          category: params.category || existing.category,
          reviewedBy: params.adminEmail,
          reviewedAt: nowIso,
          updatedAt: now,
        })
        .where(eq(customSkills.id, id))
        .returning();
      return updated[0];
    }

    if (params.action === 'reject') {
      const updated = await db
        .update(customSkills)
        .set({
          status: 'rejected',
          reviewedBy: params.adminEmail,
          reviewedAt: nowIso,
          updatedAt: now,
        })
        .where(eq(customSkills.id, id))
        .returning();
      return updated[0];
    }

    if (params.action === 'rename') {
      const cleanName = cleanSkillDisplayName(params.newName || '');
      const norm = normalizeSkillName(cleanName);
      if (!cleanName || !norm) throw new Error('A valid new skill name is required.');
      const updated = await db
        .update(customSkills)
        .set({
          name: cleanName,
          normalizedName: norm,
          skillType: params.skillType || existing.skillType,
          category: params.category || existing.category,
          status: 'approved',
          reviewedBy: params.adminEmail,
          reviewedAt: nowIso,
          updatedAt: now,
        })
        .where(eq(customSkills.id, id))
        .returning();
      await propagateSkillReplacement(existing.name, cleanName);
      return updated[0];
    }

    if (params.action === 'merge') {
      const targetName = cleanSkillDisplayName(params.mergeTargetName || '');
      if (!targetName) throw new Error('Target skill name is required for merge.');
      const updated = await db
        .update(customSkills)
        .set({
          status: 'merged',
          mergedInto: targetName,
          reviewedBy: params.adminEmail,
          reviewedAt: nowIso,
          updatedAt: now,
        })
        .where(eq(customSkills.id, id))
        .returning();
      await propagateSkillReplacement(existing.name, targetName);
      return updated[0];
    }

    return existing;
  } catch (error) {
    wrapDbError('moderateCustomSkill', error);
  }
}

export async function deleteCustomSkillById(id: string) {
  try {
    const deleted = await db.delete(customSkills).where(eq(customSkills.id, id)).returning();
    return deleted[0] || null;
  } catch (error) {
    wrapDbError('deleteCustomSkillById', error);
  }
}

export async function listProblems() {
  try {
    return await db.select().from(problems).orderBy(desc(problems.createdAt));
  } catch (error) {
    wrapDbError('listProblems', error);
  }
}

export async function upsertProblem(payload: typeof problems.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(problems)
      .values({ ...payload, createdAt: payload.createdAt || now, updatedAt: now })
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          title: payload.title,
          description: payload.description,
          industry: payload.industry,
          difficulty: payload.difficulty,
          status: payload.status,
          skillsRequired: payload.skillsRequired,
          interestedUserIds: payload.interestedUserIds,
          interestCount: payload.interestCount,
          verifiedByAdmin: payload.verifiedByAdmin,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertProblem', error);
  }
}

export async function listProjects() {
  try {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  } catch (error) {
    wrapDbError('listProjects', error);
  }
}

export async function upsertProject(payload: typeof projects.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(projects)
      .values({ ...payload, createdAt: payload.createdAt || now, updatedAt: now })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          title: payload.title,
          description: payload.description,
          category: payload.category,
          objectives: payload.objectives,
          requiredSkills: payload.requiredSkills,
          teamMemberIds: payload.teamMemberIds,
          teamMembers: payload.teamMembers,
          status: payload.status,
          demoUrl: payload.demoUrl,
          repoUrl: payload.repoUrl,
          milestones: payload.milestones,
          tasks: payload.tasks,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertProject', error);
  }
}

export async function getCertificateByCertId(certId: string) {
  try {
    const rows = await db
      .select()
      .from(certificates)
      .where(eq(certificates.certId, certId.trim().toUpperCase()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    wrapDbError('getCertificateByCertId', error);
  }
}

export async function listCertificates() {
  try {
    return await db.select().from(certificates).orderBy(desc(certificates.createdAt));
  } catch (error) {
    wrapDbError('listCertificates', error);
  }
}

export async function upsertCertificate(payload: typeof certificates.$inferInsert) {
  try {
    const rows = await db
      .insert(certificates)
      .values(payload)
      .onConflictDoUpdate({
        target: certificates.certId,
        set: {
          studentName: payload.studentName,
          studentEmail: payload.studentEmail,
          certificateTitle: payload.certificateTitle,
          competitionName: payload.competitionName,
          achievement: payload.achievement,
          activityName: payload.activityName,
          organization: payload.organization,
          issueDate: payload.issueDate,
          authorizedSigner: payload.authorizedSigner,
          authorizedSignerTitle: payload.authorizedSignerTitle,
          logoUrl: payload.logoUrl,
          signatureUrl: payload.signatureUrl,
          templateStyle: payload.templateStyle,
          verificationHash: payload.verificationHash,
          verificationUrl: payload.verificationUrl,
          status: payload.status,
          downloadedAt: payload.downloadedAt,
          downloadCount: payload.downloadCount,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertCertificate', error);
  }
}

export async function listAnnouncements(activeOnly: boolean = true) {
  try {
    if (activeOnly) {
      return await db
        .select()
        .from(announcements)
        .where(eq(announcements.isActive, true))
        .orderBy(desc(announcements.createdAt));
    }
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  } catch (error) {
    wrapDbError('listAnnouncements', error);
  }
}

export async function upsertAnnouncement(payload: typeof announcements.$inferInsert) {
  try {
    const now = new Date();
    const rows = await db
      .insert(announcements)
      .values({ ...payload, createdAt: payload.createdAt || now, updatedAt: now })
      .onConflictDoUpdate({
        target: announcements.id,
        set: {
          title: payload.title,
          message: payload.message,
          type: payload.type,
          linkPath: payload.linkPath,
          linkLabel: payload.linkLabel,
          isActive: payload.isActive,
          isPinned: payload.isPinned,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    wrapDbError('upsertAnnouncement', error);
  }
}

export async function deleteAnnouncementById(id: string) {
  try {
    const rows = await db.delete(announcements).where(eq(announcements.id, id)).returning();
    return rows[0] || null;
  } catch (error) {
    wrapDbError('deleteAnnouncementById', error);
  }
}

export async function createAdminAuditLog(payload: typeof adminAuditLogs.$inferInsert) {
  try {
    const rows = await db.insert(adminAuditLogs).values(payload).returning();
    return rows[0];
  } catch (error) {
    wrapDbError('createAdminAuditLog', error);
  }
}

export async function getAdminOverviewData() {
  try {
    const [
      allUsers,
      allApplications,
      allIdeas,
      allProjects,
      allChallenges,
      allChallengeRegistrations,
      allChallengeSubmissions,
      allEvents,
      allEventRegistrations,
      allOpportunities,
      allOpportunityApplications,
      allCertificates,
      allAnnouncements,
      allCustomSkills,
      logs,
    ] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(applications).orderBy(desc(applications.updatedAt)),
      db.select().from(ideas).orderBy(desc(ideas.createdAt)),
      db.select().from(projects).orderBy(desc(projects.createdAt)),
      db.select().from(challenges).orderBy(desc(challenges.createdAt)),
      db.select().from(challengeRegistrations).orderBy(desc(challengeRegistrations.registeredAt)),
      db.select().from(challengeSubmissions).orderBy(desc(challengeSubmissions.submittedAt)),
      db.select().from(events).orderBy(desc(events.createdAt)),
      db.select().from(eventRegistrations).orderBy(desc(eventRegistrations.registeredAt)),
      db.select().from(opportunities).orderBy(desc(opportunities.createdAt)),
      db.select().from(opportunityApplications).orderBy(desc(opportunityApplications.appliedAt)),
      db.select().from(certificates).orderBy(desc(certificates.createdAt)),
      db.select().from(announcements).orderBy(desc(announcements.createdAt)),
      db.select().from(customSkills).orderBy(desc(customSkills.updatedAt)),
      db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.timestamp)).limit(100),
    ]);

    return {
      users: allUsers,
      applications: allApplications,
      ideas: allIdeas,
      projects: allProjects,
      challenges: allChallenges,
      challengeRegistrations: allChallengeRegistrations,
      challengeSubmissions: allChallengeSubmissions,
      events: allEvents,
      eventRegistrations: allEventRegistrations,
      opportunities: allOpportunities,
      opportunityApplications: allOpportunityApplications,
      certificates: allCertificates,
      announcements: allAnnouncements,
      customSkills: allCustomSkills,
      logs,
    };
  } catch (error) {
    wrapDbError('getAdminOverviewData', error);
  }
}
