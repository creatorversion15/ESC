import crypto from 'node:crypto';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  exchangeProblemReports,
  exchangeProblems,
  exchangeSavedProblems,
  exchangeSolverInterests,
  users,
} from './schema.ts';
import type {
  ExchangeOverviewResponse,
  ExchangePaginatedResponse,
  ExchangeProblem,
  ExchangeProblemDifficulty,
  ExchangeProblemImpact,
  ExchangeProblemReport,
  ExchangePublicationStatus,
  ExchangeSolverInterest,
  ExchangeSourceType,
  ExchangeValidationStatus,
  OpportunityScoreCriteria,
} from '../types/index.ts';
import {
  PROBLEM_EXCHANGE_CATEGORIES,
  clampScoreMetric,
  computeOpportunityScore,
  deriveImpactLevel,
  exportProblemsToCsv,
  isValidCategory,
  normalizeProblemTitle,
  parseProblemExchangeCsv,
  sanitizeLinks,
} from '../utils/problemExchangeLogic.ts';

type DbProblemRow = typeof exchangeProblems.$inferSelect;
type DbSolverRow = typeof exchangeSolverInterests.$inferSelect;
type DbReportRow = typeof exchangeProblemReports.$inferSelect;

function mapProblemRow(
  row: DbProblemRow,
  savedSet?: Set<string>,
  solverStatusMap?: Map<string, ExchangeSolverInterest['status']>
): ExchangeProblem {
  return {
    id: row.id,
    problemCode: row.problemCode,
    title: row.title,
    description: row.description,
    category: row.category,
    industry: row.industry,
    affectedUsers: row.affectedUsers,
    realWorldContext: row.realWorldContext,
    currentChallenges: row.currentChallenges,
    currentWorkarounds: row.currentWorkarounds || '',
    whyItMatters: row.whyItMatters,
    potentialImpact: row.potentialImpact,
    impactLevel: (row.impactLevel as ExchangeProblemImpact) || 'high',
    difficulty: (row.difficulty as ExchangeProblemDifficulty) || 'intermediate',
    skillsRequired: Array.isArray(row.skillsRequired) ? row.skillsRequired : [],
    location: row.location || 'Pan-India',
    developmentOpportunities: row.developmentOpportunities || '',
    suggestedResearchQuestions: Array.isArray(row.suggestedResearchQuestions)
      ? row.suggestedResearchQuestions
      : [],
    evidenceLinks: Array.isArray(row.evidenceLinks) ? row.evidenceLinks : [],
    attachmentName: row.attachmentName || undefined,
    attachmentType: row.attachmentType || undefined,
    attachmentDataUrl: row.attachmentDataUrl || undefined,
    scoreCriteria: {
      severity: row.scoreSeverity,
      peopleAffected: row.scorePeopleAffected,
      frequency: row.scoreFrequency,
      urgency: row.scoreUrgency,
      potentialImpact: row.scorePotentialImpact,
      feasibility: row.scoreFeasibility,
    },
    opportunityScore: row.opportunityScore,
    publicationStatus: (row.publicationStatus as ExchangePublicationStatus) || 'published',
    validationStatus: (row.validationStatus as ExchangeValidationStatus) || 'research_needed',
    isFeatured: Boolean(row.isFeatured),
    topTenRank: row.topTenRank ?? null,
    sourceType: (row.sourceType as ExchangeSourceType) || 'esc_original',
    viewsCount: row.viewsCount ?? 0,
    savesCount: row.savesCount ?? 0,
    solverInterestCount: row.solverInterestCount ?? 0,
    submittedByUid: row.submittedByUid || undefined,
    submittedByName: row.submittedByName || undefined,
    submittedByEmail: row.submittedByEmail || undefined,
    adminNotes: row.adminNotes || undefined,
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt || undefined,
    isSaved: savedSet ? savedSet.has(row.id) : undefined,
    userSolverStatus: solverStatusMap ? solverStatusMap.get(row.id) ?? null : undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapSolverRow(row: DbSolverRow): ExchangeSolverInterest {
  return {
    id: row.id,
    problemId: row.problemId,
    problemTitle: row.problemTitle,
    userUid: row.userUid,
    userName: row.userName,
    userEmail: row.userEmail,
    proposedApproach: row.proposedApproach,
    skillsOffered: Array.isArray(row.skillsOffered) ? row.skillsOffered : [],
    lookingForTeammates: Boolean(row.lookingForTeammates),
    neededRoles: row.neededRoles || '',
    teamPreference: (row.teamPreference as ExchangeSolverInterest['teamPreference']) || 'form_new_team',
    linkedTeamId: row.linkedTeamId || undefined,
    status: (row.status as ExchangeSolverInterest['status']) || 'pending_review',
    adminNotes: row.adminNotes || undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapReportRow(row: DbReportRow): ExchangeProblemReport {
  return {
    id: row.id,
    problemId: row.problemId,
    problemTitle: row.problemTitle,
    reporterUid: row.reporterUid || undefined,
    reporterName: row.reporterName,
    reporterEmail: row.reporterEmail || undefined,
    reason: (row.reason as ExchangeProblemReport['reason']) || 'inaccurate',
    details: row.details,
    duplicateOfId: row.duplicateOfId || undefined,
    status: (row.status as ExchangeProblemReport['status']) || 'open',
    adminNotes: row.adminNotes || undefined,
    resolvedBy: row.resolvedBy || undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

async function getUserContextSets(userUid?: string): Promise<{
  savedSet: Set<string>;
  solverStatusMap: Map<string, ExchangeSolverInterest['status']>;
}> {
  if (!userUid) {
    return { savedSet: new Set(), solverStatusMap: new Map() };
  }
  const [savedRows, solverRows] = await Promise.all([
    db
      .select({ problemId: exchangeSavedProblems.problemId })
      .from(exchangeSavedProblems)
      .where(eq(exchangeSavedProblems.userUid, userUid)),
    db
      .select({
        problemId: exchangeSolverInterests.problemId,
        status: exchangeSolverInterests.status,
      })
      .from(exchangeSolverInterests)
      .where(eq(exchangeSolverInterests.userUid, userUid)),
  ]);

  return {
    savedSet: new Set(savedRows.map((r) => r.problemId)),
    solverStatusMap: new Map(
      solverRows.map((r) => [r.problemId, r.status as ExchangeSolverInterest['status']])
    ),
  };
}

async function generateNextProblemCode(): Promise<string> {
  const res = await db.execute(sql`
    SELECT COALESCE(MAX(
      CASE
        WHEN problem_code ~ '^PX-[0-9]+$' THEN SUBSTRING(problem_code FROM 4)::int
        ELSE 0
      END
    ), 1000)::int AS max_num
    FROM exchange_problems
  `);
  const maxNum = Number((res.rows[0] as any)?.max_num ?? 1000);
  return `PX-${String(maxNum + 1).padStart(4, '0')}`;
}

export async function getProblemExchangeOverview(userUid?: string): Promise<ExchangeOverviewResponse> {
  const [countsRes, categoryRes, industryRes, locationRes, skillsRes, topTenRows, featuredRows, userCtx] =
    await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_published,
          COUNT(DISTINCT normalized_title)::int AS distinct_published,
          COUNT(*) FILTER (WHERE validation_status = 'validated')::int AS validated_count,
          COUNT(*) FILTER (WHERE validation_status = 'under_validation')::int AS under_validation_count,
          COUNT(*) FILTER (WHERE validation_status = 'research_needed')::int AS research_needed_count,
          COUNT(*) FILTER (WHERE is_featured = true)::int AS featured_count
        FROM exchange_problems
        WHERE publication_status = 'published'
      `),
      db.execute(sql`
        SELECT category, COUNT(*)::int AS count
        FROM exchange_problems
        WHERE publication_status = 'published'
        GROUP BY category
      `),
      db.execute(sql`
        SELECT industry, COUNT(*)::int AS count
        FROM exchange_problems
        WHERE publication_status = 'published' AND industry IS NOT NULL AND industry <> ''
        GROUP BY industry
        ORDER BY count DESC, industry ASC
        LIMIT 60
      `),
      db.execute(sql`
        SELECT location, COUNT(*)::int AS count
        FROM exchange_problems
        WHERE publication_status = 'published' AND location IS NOT NULL AND location <> ''
        GROUP BY location
        ORDER BY count DESC, location ASC
        LIMIT 40
      `),
      db.execute(sql`
        SELECT skill, COUNT(*)::int AS count
        FROM (
          SELECT jsonb_array_elements_text(skills_required) AS skill
          FROM exchange_problems
          WHERE publication_status = 'published'
        ) sub
        WHERE skill IS NOT NULL AND skill <> ''
        GROUP BY skill
        ORDER BY count DESC, skill ASC
        LIMIT 60
      `),
      db
        .select()
        .from(exchangeProblems)
        .where(
          and(eq(exchangeProblems.publicationStatus, 'published'), isNotNull(exchangeProblems.topTenRank))
        )
        .orderBy(asc(exchangeProblems.topTenRank))
        .limit(10),
      db
        .select()
        .from(exchangeProblems)
        .where(and(eq(exchangeProblems.publicationStatus, 'published'), eq(exchangeProblems.isFeatured, true)))
        .orderBy(desc(exchangeProblems.opportunityScore), desc(exchangeProblems.updatedAt))
        .limit(12),
      getUserContextSets(userUid),
    ]);

  const stats = (countsRes.rows[0] as any) || {};
  const catMap = new Map<string, number>();
  for (const r of categoryRes.rows as any[]) {
    catMap.set(String(r.category), Number(r.count) || 0);
  }

  const categoryCounts = PROBLEM_EXCHANGE_CATEGORIES.map((category) => ({
    category,
    count: catMap.get(category) || 0,
  }));

  const industries = (industryRes.rows as any[])
    .map((r) => String(r.industry || '').trim())
    .filter(Boolean);
  const locations = (locationRes.rows as any[])
    .map((r) => String(r.location || '').trim())
    .filter(Boolean);
  const skills = (skillsRes.rows as any[])
    .map((r) => String(r.skill || '').trim())
    .filter(Boolean);

  return {
    totalPublished: Number(stats.total_published) || 0,
    totalCategories: categoryCounts.filter((c) => c.count > 0).length,
    categoryCounts,
    topTenProblems: topTenRows.map((r) => mapProblemRow(r, userCtx.savedSet, userCtx.solverStatusMap)),
    featuredProblems: featuredRows.map((r) => mapProblemRow(r, userCtx.savedSet, userCtx.solverStatusMap)),
    facets: {
      industries,
      locations,
      skills,
    },
  };
}

export interface ListExchangeProblemsQuery {
  q?: string;
  category?: string;
  industry?: string;
  difficulty?: string;
  impactLevel?: string;
  skill?: string;
  location?: string;
  validationStatus?: string;
  publicationStatus?: string;
  minScore?: number;
  maxScore?: number;
  featuredOnly?: boolean;
  topTenOnly?: boolean;
  sort?: 'score_desc' | 'recent' | 'impact' | 'impact_desc' | 'popular' | 'featured';
  page?: number;
  pageSize?: number;
  userUid?: string;
  isAdminView?: boolean;
}

export async function listExchangeProblems(
  params: ListExchangeProblemsQuery
): Promise<ExchangePaginatedResponse> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(60, Number(params.pageSize) || 18));
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];

  if (params.isAdminView) {
    if (params.publicationStatus && params.publicationStatus !== 'all') {
      conditions.push(eq(exchangeProblems.publicationStatus, params.publicationStatus));
    }
  } else {
    conditions.push(eq(exchangeProblems.publicationStatus, 'published'));
  }

  if (params.category && params.category !== 'all') {
    conditions.push(eq(exchangeProblems.category, params.category));
  }
  if (params.industry && params.industry !== 'all') {
    conditions.push(ilike(exchangeProblems.industry, `%${params.industry.trim()}%`));
  }
  if (params.difficulty && params.difficulty !== 'all') {
    conditions.push(eq(exchangeProblems.difficulty, params.difficulty));
  }
  if (params.impactLevel && params.impactLevel !== 'all') {
    conditions.push(eq(exchangeProblems.impactLevel, params.impactLevel));
  }
  if (params.validationStatus && params.validationStatus !== 'all') {
    conditions.push(eq(exchangeProblems.validationStatus, params.validationStatus));
  }
  if (params.location && params.location.trim()) {
    conditions.push(ilike(exchangeProblems.location, `%${params.location.trim()}%`));
  }
  if (typeof params.minScore === 'number' && Number.isFinite(params.minScore) && params.minScore > 0) {
    conditions.push(gte(exchangeProblems.opportunityScore, Math.round(params.minScore)));
  }
  if (typeof params.maxScore === 'number' && Number.isFinite(params.maxScore) && params.maxScore < 100) {
    conditions.push(lte(exchangeProblems.opportunityScore, Math.round(params.maxScore)));
  }
  if (params.featuredOnly) {
    conditions.push(eq(exchangeProblems.isFeatured, true));
  }
  if (params.topTenOnly) {
    conditions.push(isNotNull(exchangeProblems.topTenRank));
  }
  if (params.skill && params.skill.trim()) {
    const sk = `%${params.skill.trim()}%`;
    conditions.push(sql`${exchangeProblems.skillsRequired}::text ILIKE ${sk}`);
  }
  if (params.q && params.q.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(exchangeProblems.title, term),
        ilike(exchangeProblems.description, term),
        ilike(exchangeProblems.category, term),
        ilike(exchangeProblems.industry, term),
        ilike(exchangeProblems.affectedUsers, term),
        ilike(exchangeProblems.location, term),
        ilike(exchangeProblems.problemCode, term),
        sql`${exchangeProblems.skillsRequired}::text ILIKE ${term}`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByCols: any[];
  switch (params.sort) {
    case 'recent':
      orderByCols = [desc(exchangeProblems.createdAt), desc(exchangeProblems.opportunityScore)];
      break;
    case 'impact':
    case 'impact_desc':
      orderByCols = [
        desc(exchangeProblems.scorePotentialImpact),
        desc(exchangeProblems.opportunityScore),
        asc(exchangeProblems.problemCode),
      ];
      break;
    case 'popular':
      orderByCols = [
        desc(
          sql`(${exchangeProblems.savesCount} * 3 + ${exchangeProblems.solverInterestCount} * 5 + ${exchangeProblems.viewsCount})`
        ),
        desc(exchangeProblems.opportunityScore),
        asc(exchangeProblems.problemCode),
      ];
      break;
    case 'featured':
      orderByCols = [
        desc(exchangeProblems.isFeatured),
        sql`${exchangeProblems.topTenRank} ASC NULLS LAST`,
        desc(exchangeProblems.opportunityScore),
      ];
      break;
    case 'score_desc':
    default:
      orderByCols = [
        desc(exchangeProblems.opportunityScore),
        desc(exchangeProblems.scoreSeverity),
        asc(exchangeProblems.problemCode),
      ];
      break;
  }

  const [countRes, rows, userCtx] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(exchangeProblems)
      .where(whereClause),
    db
      .select()
      .from(exchangeProblems)
      .where(whereClause)
      .orderBy(...orderByCols)
      .limit(pageSize)
      .offset(offset),
    getUserContextSets(params.userUid),
  ]);

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: rows.map((r) => mapProblemRow(r, userCtx.savedSet, userCtx.solverStatusMap)),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getRandomPublishedProblem(
  excludeId?: string,
  userUid?: string
): Promise<ExchangeProblem | null> {
  const cond = excludeId
    ? and(eq(exchangeProblems.publicationStatus, 'published'), ne(exchangeProblems.id, excludeId))
    : eq(exchangeProblems.publicationStatus, 'published');

  const countRes = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(exchangeProblems)
    .where(cond);
  const total = Number(countRes[0]?.count ?? 0);
  if (total === 0) return null;

  const randomOffset = Math.floor(Math.random() * total);
  const [rows, userCtx] = await Promise.all([
    db
      .select()
      .from(exchangeProblems)
      .where(cond)
      .orderBy(asc(exchangeProblems.id))
      .limit(1)
      .offset(randomOffset),
    getUserContextSets(userUid),
  ]);

  if (!rows[0]) return null;
  return mapProblemRow(rows[0], userCtx.savedSet, userCtx.solverStatusMap);
}

export async function getExchangeProblemById(
  idOrCode: string,
  options?: { userUid?: string; isAdmin?: boolean; incrementView?: boolean }
): Promise<{
  problem: ExchangeProblem;
  userSolverInterest: ExchangeSolverInterest | null;
} | null> {
  const key = idOrCode.trim();
  const rows = await db
    .select()
    .from(exchangeProblems)
    .where(or(eq(exchangeProblems.id, key), eq(exchangeProblems.problemCode, key.toUpperCase())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const isOwner = Boolean(options?.userUid && row.submittedByUid === options.userUid);
  if (row.publicationStatus !== 'published' && !options?.isAdmin && !isOwner) {
    return null;
  }

  if (options?.incrementView && row.publicationStatus === 'published') {
    await db
      .update(exchangeProblems)
      .set({ viewsCount: sql`${exchangeProblems.viewsCount} + 1` })
      .where(eq(exchangeProblems.id, row.id))
      .catch(() => {});
    row.viewsCount = (row.viewsCount || 0) + 1;
  }

  const userCtx = await getUserContextSets(options?.userUid);
  let userSolverInterest: ExchangeSolverInterest | null = null;

  if (options?.userUid) {
    const interestRows = await db
      .select()
      .from(exchangeSolverInterests)
      .where(
        and(
          eq(exchangeSolverInterests.problemId, row.id),
          eq(exchangeSolverInterests.userUid, options.userUid)
        )
      )
      .limit(1);
    if (interestRows[0]) {
      userSolverInterest = mapSolverRow(interestRows[0]);
    }
  }

  return {
    problem: mapProblemRow(row, userCtx.savedSet, userCtx.solverStatusMap),
    userSolverInterest,
  };
}

export async function findMatchingTeamMembersForProblem(problemId: string, requesterUid?: string) {
  const [problemRow] = await db
    .select()
    .from(exchangeProblems)
    .where(or(eq(exchangeProblems.id, problemId), eq(exchangeProblems.problemCode, problemId.toUpperCase())))
    .limit(1);

  if (!problemRow) return null;

  const skillTokens = new Set(
    [
      ...(Array.isArray(problemRow.skillsRequired) ? problemRow.skillsRequired : []),
      problemRow.category,
      problemRow.industry,
    ]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9+]+/)
      .filter((t) => t.length >= 3)
  );

  const approvedMembers = await db
    .select({
      uid: users.uid,
      escMemberId: users.escMemberId,
      fullName: users.fullName,
      college: users.college,
      branch: users.branch,
      academicYear: users.academicYear,
      technicalSkills: users.technicalSkills,
      nonTechnicalSkills: users.nonTechnicalSkills,
      customSkills: users.customSkills,
      bio: users.bio,
      githubUrl: users.githubUrl,
      linkedinUrl: users.linkedinUrl,
      photoUrl: users.photoUrl,
    })
    .from(users)
    .where(and(eq(users.membershipStatus, 'approved'), eq(users.accountStatus, 'active')))
    .limit(200);

  const scored = approvedMembers
    .filter((m) => m.uid !== requesterUid)
    .map((m) => {
      const allSkills = [
        ...(Array.isArray(m.technicalSkills) ? m.technicalSkills : []),
        ...(Array.isArray(m.nonTechnicalSkills) ? m.nonTechnicalSkills : []),
        ...(Array.isArray(m.customSkills) ? m.customSkills : []),
      ];
      const matchedSkills: string[] = [];
      let score = 0;

      for (const s of allSkills) {
        const lower = s.toLowerCase();
        const words = lower.split(/[^a-z0-9+]+/).filter((w) => w.length >= 3);
        if (words.some((w) => skillTokens.has(w))) {
          matchedSkills.push(s);
          score += 3;
        }
      }

      const branchWords = (m.branch || '')
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .filter((w) => w.length >= 3);
      if (branchWords.some((w) => skillTokens.has(w))) {
        score += 2;
      }

      return {
        uid: m.uid,
        escMemberId: m.escMemberId || '',
        fullName: m.fullName,
        college: m.college || '',
        branch: m.branch || '',
        yearOfStudy: m.academicYear || '',
        bio: m.bio || '',
        githubUrl: m.githubUrl || '',
        linkedinUrl: m.linkedinUrl || '',
        photoUrl: m.photoUrl || '',
        skills: allSkills.slice(0, 8),
        matchedSkills: matchedSkills.slice(0, 5),
        matchScore: score,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.fullName.localeCompare(b.fullName))
    .slice(0, 12);

  return {
    problemId: problemRow.id,
    problemTitle: problemRow.title,
    skillsRequired: problemRow.skillsRequired || [],
    members: scored,
  };
}

export async function toggleSaveExchangeProblem(
  userUid: string,
  problemId: string
): Promise<{ saved: boolean; savesCount: number } | null> {
  const [problem] = await db
    .select({ id: exchangeProblems.id, savesCount: exchangeProblems.savesCount })
    .from(exchangeProblems)
    .where(eq(exchangeProblems.id, problemId))
    .limit(1);
  if (!problem) return null;

  const existing = await db
    .select({ id: exchangeSavedProblems.id })
    .from(exchangeSavedProblems)
    .where(
      and(
        eq(exchangeSavedProblems.userUid, userUid),
        eq(exchangeSavedProblems.problemId, problemId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db.delete(exchangeSavedProblems).where(eq(exchangeSavedProblems.id, existing[0].id));
    const [updated] = await db
      .update(exchangeProblems)
      .set({ savesCount: sql`GREATEST(0, ${exchangeProblems.savesCount} - 1)` })
      .where(eq(exchangeProblems.id, problemId))
      .returning({ savesCount: exchangeProblems.savesCount });
    return { saved: false, savesCount: updated?.savesCount ?? Math.max(0, problem.savesCount - 1) };
  }

  await db.insert(exchangeSavedProblems).values({
    id: `px_save_${crypto.randomUUID().slice(0, 12)}`,
    userUid,
    problemId,
  });
  const [updated] = await db
    .update(exchangeProblems)
    .set({ savesCount: sql`${exchangeProblems.savesCount} + 1` })
    .where(eq(exchangeProblems.id, problemId))
    .returning({ savesCount: exchangeProblems.savesCount });

  return { saved: true, savesCount: updated?.savesCount ?? problem.savesCount + 1 };
}

export async function getMyProblemExchangeWorkspace(userUid: string, userEmail?: string) {
  const [savedRows, submittedRows, interestRows] = await Promise.all([
    db
      .select({ problem: exchangeProblems })
      .from(exchangeSavedProblems)
      .innerJoin(exchangeProblems, eq(exchangeSavedProblems.problemId, exchangeProblems.id))
      .where(eq(exchangeSavedProblems.userUid, userUid))
      .orderBy(desc(exchangeSavedProblems.createdAt)),
    db
      .select()
      .from(exchangeProblems)
      .where(
        userEmail
          ? or(
              eq(exchangeProblems.submittedByUid, userUid),
              eq(exchangeProblems.submittedByEmail, userEmail.toLowerCase())
            )
          : eq(exchangeProblems.submittedByUid, userUid)
      )
      .orderBy(desc(exchangeProblems.createdAt)),
    db
      .select()
      .from(exchangeSolverInterests)
      .where(eq(exchangeSolverInterests.userUid, userUid))
      .orderBy(desc(exchangeSolverInterests.createdAt)),
  ]);

  const savedSet = new Set(savedRows.map((r) => r.problem.id));
  const solverMap = new Map(
    interestRows.map((r) => [r.problemId, r.status as ExchangeSolverInterest['status']])
  );

  return {
    savedProblems: savedRows.map((r) => mapProblemRow(r.problem, savedSet, solverMap)),
    submittedProblems: submittedRows.map((r) => mapProblemRow(r, savedSet, solverMap)),
    solverInterests: interestRows.map(mapSolverRow),
  };
}

export async function submitCommunityProblem(input: {
  title: string;
  description: string;
  category: string;
  industry: string;
  location: string;
  affectedUsers: string;
  whyItMatters: string;
  evidenceLinks?: string[];
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
  submitterUid?: string;
  submitterName: string;
  submitterEmail: string;
}): Promise<{ problem?: ExchangeProblem; duplicate?: { id: string; problemCode: string; title: string } }> {
  const normalizedTitle = normalizeProblemTitle(input.title);

  // Duplicate prevention check against active published / pending items
  const existing = await db
    .select({
      id: exchangeProblems.id,
      problemCode: exchangeProblems.problemCode,
      title: exchangeProblems.title,
    })
    .from(exchangeProblems)
    .where(
      and(
        eq(exchangeProblems.normalizedTitle, normalizedTitle),
        inArray(exchangeProblems.publicationStatus, ['published', 'pending_review'])
      )
    )
    .limit(1);

  if (existing[0]) {
    return { duplicate: existing[0] };
  }

  const problemCode = await generateNextProblemCode();
  const id = `esc_px_sub_${crypto.randomUUID().slice(0, 10)}`;

  const defaultCriteria: OpportunityScoreCriteria = {
    severity: 72,
    peopleAffected: 70,
    frequency: 70,
    urgency: 70,
    potentialImpact: 74,
    feasibility: 68,
  };
  const opportunityScore = computeOpportunityScore(defaultCriteria);
  const impactLevel = deriveImpactLevel(opportunityScore, defaultCriteria.potentialImpact);

  const [created] = await db
    .insert(exchangeProblems)
    .values({
      id,
      problemCode,
      title: input.title.trim(),
      normalizedTitle,
      description: input.description.trim(),
      category: input.category.trim(),
      industry: input.industry.trim(),
      affectedUsers: input.affectedUsers.trim(),
      realWorldContext: input.description.trim(),
      currentChallenges: input.description.trim(),
      currentWorkarounds: 'Submitted by community member — pending field verification.',
      whyItMatters: input.whyItMatters.trim(),
      potentialImpact: input.whyItMatters.trim(),
      impactLevel,
      difficulty: 'intermediate',
      skillsRequired: ['Problem Discovery', 'Engineering Design', input.category.trim()],
      location: input.location.trim(),
      developmentOpportunities: 'Open for ESC research validation and prototype scoping upon approval.',
      suggestedResearchQuestions: [
        `How severely do ${input.affectedUsers.trim().toLowerCase()} experience this issue in ${input.location.trim()}?`,
        'What technical or operational barriers have prevented existing solutions from scaling?',
      ],
      evidenceLinks: sanitizeLinks(input.evidenceLinks || []),
      attachmentName: input.attachmentName || '',
      attachmentType: input.attachmentType || '',
      attachmentDataUrl: input.attachmentDataUrl || '',
      scoreSeverity: defaultCriteria.severity,
      scorePeopleAffected: defaultCriteria.peopleAffected,
      scoreFrequency: defaultCriteria.frequency,
      scoreUrgency: defaultCriteria.urgency,
      scorePotentialImpact: defaultCriteria.potentialImpact,
      scoreFeasibility: defaultCriteria.feasibility,
      opportunityScore,
      publicationStatus: 'pending_review',
      validationStatus: 'research_needed',
      isFeatured: false,
      topTenRank: null,
      sourceType: 'member_submission',
      submittedByUid: input.submitterUid || '',
      submittedByName: input.submitterName.trim(),
      submittedByEmail: input.submitterEmail.trim().toLowerCase(),
    })
    .returning();

  return { problem: mapProblemRow(created) };
}

export async function updateOwnPendingProblem(
  id: string,
  userUid: string,
  patch: {
    title?: string;
    description?: string;
    category?: string;
    industry?: string;
    location?: string;
    affectedUsers?: string;
    whyItMatters?: string;
    evidenceLinks?: string[];
  }
): Promise<ExchangeProblem | null> {
  const [existing] = await db
    .select()
    .from(exchangeProblems)
    .where(and(eq(exchangeProblems.id, id), eq(exchangeProblems.submittedByUid, userUid)))
    .limit(1);

  if (!existing || existing.publicationStatus !== 'pending_review') return null;

  const nextTitle = patch.title?.trim() || existing.title;
  const nextDesc = patch.description?.trim() || existing.description;
  const nextWhy = patch.whyItMatters?.trim() || existing.whyItMatters;

  const [updated] = await db
    .update(exchangeProblems)
    .set({
      title: nextTitle,
      normalizedTitle: normalizeProblemTitle(nextTitle),
      description: nextDesc,
      realWorldContext: nextDesc,
      currentChallenges: nextDesc,
      category: patch.category && isValidCategory(patch.category) ? patch.category : existing.category,
      industry: patch.industry?.trim() || existing.industry,
      location: patch.location?.trim() || existing.location,
      affectedUsers: patch.affectedUsers?.trim() || existing.affectedUsers,
      whyItMatters: nextWhy,
      potentialImpact: nextWhy,
      evidenceLinks:
        patch.evidenceLinks !== undefined ? sanitizeLinks(patch.evidenceLinks) : existing.evidenceLinks,
      updatedAt: new Date(),
    })
    .where(eq(exchangeProblems.id, id))
    .returning();

  return updated ? mapProblemRow(updated) : null;
}

export async function submitSolverInterest(input: {
  problemId: string;
  userUid: string;
  userName: string;
  userEmail: string;
  proposedApproach: string;
  skillsOffered: string[];
  lookingForTeammates: boolean;
  neededRoles?: string;
  teamPreference: 'solo' | 'form_new_team' | 'join_team';
}): Promise<{ interest: ExchangeSolverInterest; isNew: boolean } | null> {
  const [problem] = await db
    .select({ id: exchangeProblems.id, title: exchangeProblems.title, publicationStatus: exchangeProblems.publicationStatus })
    .from(exchangeProblems)
    .where(eq(exchangeProblems.id, input.problemId))
    .limit(1);

  if (!problem || problem.publicationStatus !== 'published') return null;

  const existing = await db
    .select()
    .from(exchangeSolverInterests)
    .where(
      and(
        eq(exchangeSolverInterests.problemId, problem.id),
        eq(exchangeSolverInterests.userUid, input.userUid)
      )
    )
    .limit(1);

  const cleanedSkills = input.skillsOffered.map((s) => s.trim()).filter(Boolean).slice(0, 12);

  if (existing[0]) {
    const [updated] = await db
      .update(exchangeSolverInterests)
      .set({
        proposedApproach: input.proposedApproach.trim(),
        skillsOffered: cleanedSkills,
        lookingForTeammates: input.lookingForTeammates,
        neededRoles: (input.neededRoles || '').trim().slice(0, 400),
        teamPreference: input.teamPreference,
        status: 'pending_review',
        updatedAt: new Date(),
      })
      .where(eq(exchangeSolverInterests.id, existing[0].id))
      .returning();
    return { interest: mapSolverRow(updated), isNew: false };
  }

  const [created] = await db
    .insert(exchangeSolverInterests)
    .values({
      id: `px_solv_${crypto.randomUUID().slice(0, 10)}`,
      problemId: problem.id,
      problemTitle: problem.title,
      userUid: input.userUid,
      userName: input.userName.trim(),
      userEmail: input.userEmail.trim().toLowerCase(),
      proposedApproach: input.proposedApproach.trim(),
      skillsOffered: cleanedSkills,
      lookingForTeammates: input.lookingForTeammates,
      neededRoles: (input.neededRoles || '').trim().slice(0, 400),
      teamPreference: input.teamPreference,
      status: 'pending_review', // NEVER auto-approved! Always enters ESC admin review.
    })
    .returning();

  await db
    .update(exchangeProblems)
    .set({ solverInterestCount: sql`${exchangeProblems.solverInterestCount} + 1` })
    .where(eq(exchangeProblems.id, problem.id));

  return { interest: mapSolverRow(created), isNew: true };
}

export async function submitProblemReport(input: {
  problemId: string;
  reporterUid?: string;
  reporterName: string;
  reporterEmail?: string;
  reason: 'duplicate' | 'inaccurate' | 'spam' | 'out_of_scope' | 'other';
  details: string;
  duplicateOfId?: string;
}): Promise<ExchangeProblemReport | null> {
  const [problem] = await db
    .select({ id: exchangeProblems.id, title: exchangeProblems.title })
    .from(exchangeProblems)
    .where(eq(exchangeProblems.id, input.problemId))
    .limit(1);
  if (!problem) return null;

  const [created] = await db
    .insert(exchangeProblemReports)
    .values({
      id: `px_rep_${crypto.randomUUID().slice(0, 10)}`,
      problemId: problem.id,
      problemTitle: problem.title,
      reporterUid: input.reporterUid || '',
      reporterName: input.reporterName.trim(),
      reporterEmail: (input.reporterEmail || '').trim().toLowerCase(),
      reason: input.reason,
      details: input.details.trim(),
      duplicateOfId: (input.duplicateOfId || '').trim(),
      status: 'open',
    })
    .returning();

  return mapReportRow(created);
}

/* --------------------------------------------------------------------------
 * ADMIN CRUD, CURATION, SOLVER INTEREST REVIEW, REPORTS & CSV IMPORT/EXPORT
 * -------------------------------------------------------------------------- */

export async function adminGetProblemExchangeStats() {
  const [probRes, solverRes, reportRes] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE publication_status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE publication_status = 'pending_review')::int AS pending_review,
        COUNT(*) FILTER (WHERE publication_status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE publication_status = 'archived')::int AS archived,
        COUNT(*) FILTER (WHERE validation_status = 'research_needed')::int AS research_needed,
        COUNT(*) FILTER (WHERE validation_status = 'under_validation')::int AS under_validation,
        COUNT(*) FILTER (WHERE validation_status = 'validated')::int AS validated,
        COUNT(*) FILTER (WHERE is_featured = true AND publication_status = 'published')::int AS featured,
        COUNT(*) FILTER (WHERE top_ten_rank IS NOT NULL AND publication_status = 'published')::int AS top_ten
      FROM exchange_problems
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending_review')::int AS pending
      FROM exchange_solver_interests
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open
      FROM exchange_problem_reports
    `),
  ]);

  const p = (probRes.rows[0] as any) || {};
  const s = (solverRes.rows[0] as any) || {};
  const r = (reportRes.rows[0] as any) || {};

  return {
    total: Number(p.total) || 0,
    published: Number(p.published) || 0,
    pendingReview: Number(p.pending_review) || 0,
    rejected: Number(p.rejected) || 0,
    archived: Number(p.archived) || 0,
    researchNeeded: Number(p.research_needed) || 0,
    underValidation: Number(p.under_validation) || 0,
    validated: Number(p.validated) || 0,
    featured: Number(p.featured) || 0,
    topTen: Number(p.top_ten) || 0,
    solverInterestsTotal: Number(s.total) || 0,
    solverInterestsPending: Number(s.pending) || 0,
    reportsTotal: Number(r.total) || 0,
    reportsOpen: Number(r.open) || 0,
  };
}

export async function adminCreateExchangeProblem(
  payload: Record<string, any>,
  adminEmail: string
): Promise<ExchangeProblem> {
  const title = String(payload.title || '').trim();
  const normalizedTitle = normalizeProblemTitle(title);
  const problemCode = await generateNextProblemCode();
  const id = `esc_px_adm_${crypto.randomUUID().slice(0, 10)}`;

  const criteria: OpportunityScoreCriteria = {
    severity: clampScoreMetric(payload.scoreCriteria?.severity ?? payload.scoreSeverity, 75),
    peopleAffected: clampScoreMetric(payload.scoreCriteria?.peopleAffected ?? payload.scorePeopleAffected, 75),
    frequency: clampScoreMetric(payload.scoreCriteria?.frequency ?? payload.scoreFrequency, 75),
    urgency: clampScoreMetric(payload.scoreCriteria?.urgency ?? payload.scoreUrgency, 75),
    potentialImpact: clampScoreMetric(payload.scoreCriteria?.potentialImpact ?? payload.scorePotentialImpact, 75),
    feasibility: clampScoreMetric(payload.scoreCriteria?.feasibility ?? payload.scoreFeasibility, 75),
  };
  const opportunityScore = computeOpportunityScore(criteria);
  const impactLevel = deriveImpactLevel(opportunityScore, criteria.potentialImpact);

  let topTenRank: number | null = null;
  if (payload.topTenRank !== null && payload.topTenRank !== undefined && payload.topTenRank !== '') {
    const parsedRank = Math.round(Number(payload.topTenRank));
    if (parsedRank >= 1 && parsedRank <= 10) {
      topTenRank = parsedRank;
      await db
        .update(exchangeProblems)
        .set({ topTenRank: null })
        .where(eq(exchangeProblems.topTenRank, parsedRank));
    }
  }

  const category = isValidCategory(String(payload.category || ''))
    ? String(payload.category)
    : 'Other Emerging Technologies';

  const [created] = await db
    .insert(exchangeProblems)
    .values({
      id,
      problemCode,
      title,
      normalizedTitle,
      description: String(payload.description || '').trim(),
      category,
      industry: String(payload.industry || category).trim(),
      affectedUsers: String(payload.affectedUsers || 'Industry stakeholders').trim(),
      realWorldContext: String(payload.realWorldContext || payload.description || '').trim(),
      currentChallenges: String(payload.currentChallenges || payload.description || '').trim(),
      currentWorkarounds: String(payload.currentWorkarounds || '').trim(),
      whyItMatters: String(payload.whyItMatters || '').trim(),
      potentialImpact: String(payload.potentialImpact || payload.whyItMatters || '').trim(),
      impactLevel,
      difficulty: (['beginner', 'intermediate', 'advanced', 'deep_tech'].includes(payload.difficulty)
        ? payload.difficulty
        : 'intermediate') as ExchangeProblemDifficulty,
      skillsRequired: Array.isArray(payload.skillsRequired)
        ? payload.skillsRequired.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 10)
        : ['Systems Engineering'],
      location: String(payload.location || 'Pan-India').trim(),
      developmentOpportunities: String(payload.developmentOpportunities || '').trim(),
      suggestedResearchQuestions: Array.isArray(payload.suggestedResearchQuestions)
        ? payload.suggestedResearchQuestions.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 6)
        : [],
      evidenceLinks: sanitizeLinks(payload.evidenceLinks || []),
      scoreSeverity: criteria.severity,
      scorePeopleAffected: criteria.peopleAffected,
      scoreFrequency: criteria.frequency,
      scoreUrgency: criteria.urgency,
      scorePotentialImpact: criteria.potentialImpact,
      scoreFeasibility: criteria.feasibility,
      opportunityScore,
      publicationStatus: (['published', 'pending_review', 'rejected', 'archived'].includes(
        payload.publicationStatus
      )
        ? payload.publicationStatus
        : 'published') as ExchangePublicationStatus,
      validationStatus: (['research_needed', 'under_validation', 'validated'].includes(
        payload.validationStatus
      )
        ? payload.validationStatus
        : 'research_needed') as ExchangeValidationStatus,
      isFeatured: Boolean(payload.isFeatured || topTenRank !== null),
      topTenRank,
      sourceType: 'esc_original',
      submittedByName: 'ESC Admin Curation',
      submittedByEmail: adminEmail,
      adminNotes: String(payload.adminNotes || '').trim(),
      reviewedBy: adminEmail,
      reviewedAt: new Date().toISOString(),
    })
    .returning();

  return mapProblemRow(created);
}

export async function adminUpdateExchangeProblem(
  id: string,
  patch: Record<string, any>,
  adminEmail: string
): Promise<ExchangeProblem | null> {
  const [existing] = await db
    .select()
    .from(exchangeProblems)
    .where(eq(exchangeProblems.id, id))
    .limit(1);
  if (!existing) return null;

  const criteria: OpportunityScoreCriteria = {
    severity: clampScoreMetric(
      patch.scoreCriteria?.severity ?? patch.scoreSeverity ?? existing.scoreSeverity,
      existing.scoreSeverity
    ),
    peopleAffected: clampScoreMetric(
      patch.scoreCriteria?.peopleAffected ?? patch.scorePeopleAffected ?? existing.scorePeopleAffected,
      existing.scorePeopleAffected
    ),
    frequency: clampScoreMetric(
      patch.scoreCriteria?.frequency ?? patch.scoreFrequency ?? existing.scoreFrequency,
      existing.scoreFrequency
    ),
    urgency: clampScoreMetric(
      patch.scoreCriteria?.urgency ?? patch.scoreUrgency ?? existing.scoreUrgency,
      existing.scoreUrgency
    ),
    potentialImpact: clampScoreMetric(
      patch.scoreCriteria?.potentialImpact ?? patch.scorePotentialImpact ?? existing.scorePotentialImpact,
      existing.scorePotentialImpact
    ),
    feasibility: clampScoreMetric(
      patch.scoreCriteria?.feasibility ?? patch.scoreFeasibility ?? existing.scoreFeasibility,
      existing.scoreFeasibility
    ),
  };

  const opportunityScore = computeOpportunityScore(criteria);
  const impactLevel = deriveImpactLevel(opportunityScore, criteria.potentialImpact);

  let nextTopTenRank: number | null = existing.topTenRank ?? null;
  if ('topTenRank' in patch) {
    if (patch.topTenRank === null || patch.topTenRank === '' || patch.topTenRank === 0) {
      nextTopTenRank = null;
    } else {
      const parsedRank = Math.round(Number(patch.topTenRank));
      if (parsedRank >= 1 && parsedRank <= 10) {
        nextTopTenRank = parsedRank;
        // Clear any other problem holding this exact Top 10 rank slot
        await db
          .update(exchangeProblems)
          .set({ topTenRank: null, updatedAt: new Date() })
          .where(and(eq(exchangeProblems.topTenRank, parsedRank), ne(exchangeProblems.id, id)));
      }
    }
  }

  const nextTitle = typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : existing.title;
  const nextPubStatus =
    typeof patch.publicationStatus === 'string' &&
    ['published', 'pending_review', 'rejected', 'archived'].includes(patch.publicationStatus)
      ? patch.publicationStatus
      : existing.publicationStatus;

  const [updated] = await db
    .update(exchangeProblems)
    .set({
      title: nextTitle,
      normalizedTitle: normalizeProblemTitle(nextTitle),
      description:
        typeof patch.description === 'string' ? patch.description.trim() : existing.description,
      category:
        typeof patch.category === 'string' && isValidCategory(patch.category)
          ? patch.category
          : existing.category,
      industry: typeof patch.industry === 'string' ? patch.industry.trim() : existing.industry,
      affectedUsers:
        typeof patch.affectedUsers === 'string' ? patch.affectedUsers.trim() : existing.affectedUsers,
      realWorldContext:
        typeof patch.realWorldContext === 'string'
          ? patch.realWorldContext.trim()
          : existing.realWorldContext,
      currentChallenges:
        typeof patch.currentChallenges === 'string'
          ? patch.currentChallenges.trim()
          : existing.currentChallenges,
      currentWorkarounds:
        typeof patch.currentWorkarounds === 'string'
          ? patch.currentWorkarounds.trim()
          : existing.currentWorkarounds,
      whyItMatters:
        typeof patch.whyItMatters === 'string' ? patch.whyItMatters.trim() : existing.whyItMatters,
      potentialImpact:
        typeof patch.potentialImpact === 'string'
          ? patch.potentialImpact.trim()
          : existing.potentialImpact,
      impactLevel,
      difficulty:
        typeof patch.difficulty === 'string' &&
        ['beginner', 'intermediate', 'advanced', 'deep_tech'].includes(patch.difficulty)
          ? patch.difficulty
          : existing.difficulty,
      skillsRequired: Array.isArray(patch.skillsRequired)
        ? patch.skillsRequired.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 10)
        : existing.skillsRequired,
      location: typeof patch.location === 'string' ? patch.location.trim() : existing.location,
      developmentOpportunities:
        typeof patch.developmentOpportunities === 'string'
          ? patch.developmentOpportunities.trim()
          : existing.developmentOpportunities,
      suggestedResearchQuestions: Array.isArray(patch.suggestedResearchQuestions)
        ? patch.suggestedResearchQuestions.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 6)
        : existing.suggestedResearchQuestions,
      evidenceLinks:
        Array.isArray(patch.evidenceLinks) ? sanitizeLinks(patch.evidenceLinks) : existing.evidenceLinks,
      scoreSeverity: criteria.severity,
      scorePeopleAffected: criteria.peopleAffected,
      scoreFrequency: criteria.frequency,
      scoreUrgency: criteria.urgency,
      scorePotentialImpact: criteria.potentialImpact,
      scoreFeasibility: criteria.feasibility,
      opportunityScore,
      publicationStatus: nextPubStatus,
      validationStatus:
        typeof patch.validationStatus === 'string' &&
        ['research_needed', 'under_validation', 'validated'].includes(patch.validationStatus)
          ? patch.validationStatus
          : existing.validationStatus,
      isFeatured:
        typeof patch.isFeatured === 'boolean'
          ? patch.isFeatured
          : nextTopTenRank !== null
            ? true
            : existing.isFeatured,
      topTenRank: nextPubStatus === 'published' ? nextTopTenRank : null,
      adminNotes: typeof patch.adminNotes === 'string' ? patch.adminNotes.trim() : existing.adminNotes,
      reviewedBy: adminEmail,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date(),
    })
    .where(eq(exchangeProblems.id, id))
    .returning();

  return updated ? mapProblemRow(updated) : null;
}

export async function adminDeleteExchangeProblem(id: string): Promise<boolean> {
  const deleted = await db
    .delete(exchangeProblems)
    .where(eq(exchangeProblems.id, id))
    .returning({ id: exchangeProblems.id });
  return deleted.length > 0;
}

export async function adminListSolverInterests(status?: string): Promise<ExchangeSolverInterest[]> {
  const rows = await db
    .select()
    .from(exchangeSolverInterests)
    .where(status && status !== 'all' ? eq(exchangeSolverInterests.status, status) : undefined)
    .orderBy(desc(exchangeSolverInterests.createdAt))
    .limit(250);
  return rows.map(mapSolverRow);
}

export async function adminReviewSolverInterest(
  id: string,
  status: 'pending_review' | 'under_review' | 'approved_for_team_formation' | 'declined',
  adminNotes: string
): Promise<ExchangeSolverInterest | null> {
  const [updated] = await db
    .update(exchangeSolverInterests)
    .set({
      status,
      adminNotes: adminNotes.trim().slice(0, 1500),
      updatedAt: new Date(),
    })
    .where(eq(exchangeSolverInterests.id, id))
    .returning();
  return updated ? mapSolverRow(updated) : null;
}

export async function adminListProblemReports(status?: string): Promise<ExchangeProblemReport[]> {
  const rows = await db
    .select()
    .from(exchangeProblemReports)
    .where(status && status !== 'all' ? eq(exchangeProblemReports.status, status) : undefined)
    .orderBy(desc(exchangeProblemReports.createdAt))
    .limit(250);
  return rows.map(mapReportRow);
}

export async function adminReviewProblemReport(
  id: string,
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed',
  adminNotes: string,
  adminEmail: string
): Promise<ExchangeProblemReport | null> {
  const [updated] = await db
    .update(exchangeProblemReports)
    .set({
      status,
      adminNotes: adminNotes.trim().slice(0, 1500),
      resolvedBy: adminEmail,
      updatedAt: new Date(),
    })
    .where(eq(exchangeProblemReports.id, id))
    .returning();
  return updated ? mapReportRow(updated) : null;
}

export async function adminImportProblemsCsv(
  csvText: string,
  adminEmail: string,
  publishImmediately = true
) {
  const parsed = parseProblemExchangeCsv(csvText);
  if (parsed.rows.length === 0) {
    return { importedCount: 0, skippedCount: parsed.skipped.length, skipped: parsed.skipped.slice(0, 50) };
  }

  const existingTitlesRes = await db
    .select({ normalizedTitle: exchangeProblems.normalizedTitle })
    .from(exchangeProblems);
  const existingTitles = new Set(existingTitlesRes.map((r) => r.normalizedTitle));

  const baseCodeRes = await db.execute(sql`
    SELECT COALESCE(MAX(
      CASE
        WHEN problem_code ~ '^PX-[0-9]+$' THEN SUBSTRING(problem_code FROM 4)::int
        ELSE 0
      END
    ), 1000)::int AS max_num
    FROM exchange_problems
  `);
  let nextNum = Number((baseCodeRes.rows[0] as any)?.max_num ?? 1000);

  const toInsert: (typeof exchangeProblems.$inferInsert)[] = [];
  const skipped = [...parsed.skipped];

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const norm = normalizeProblemTitle(row.title);
    if (existingTitles.has(norm)) {
      skipped.push({ line: i + 2, reason: `Already exists in database: "${row.title}"` });
      continue;
    }
    existingTitles.add(norm);
    nextNum += 1;

    toInsert.push({
      id: `esc_px_csv_${crypto.randomUUID().slice(0, 10)}`,
      problemCode: `PX-${String(nextNum).padStart(4, '0')}`,
      title: row.title,
      normalizedTitle: norm,
      description: row.description,
      category: row.category,
      industry: row.industry,
      affectedUsers: row.affectedUsers,
      realWorldContext: row.realWorldContext,
      currentChallenges: row.currentChallenges,
      currentWorkarounds: row.currentWorkarounds,
      whyItMatters: row.whyItMatters,
      potentialImpact: row.potentialImpact,
      impactLevel: deriveImpactLevel(row.opportunityScore, row.scoreCriteria.potentialImpact),
      difficulty: row.difficulty,
      skillsRequired: row.skillsRequired,
      location: row.location,
      developmentOpportunities: row.developmentOpportunities,
      suggestedResearchQuestions: row.suggestedResearchQuestions,
      evidenceLinks: row.evidenceLinks,
      scoreSeverity: row.scoreCriteria.severity,
      scorePeopleAffected: row.scoreCriteria.peopleAffected,
      scoreFrequency: row.scoreCriteria.frequency,
      scoreUrgency: row.scoreCriteria.urgency,
      scorePotentialImpact: row.scoreCriteria.potentialImpact,
      scoreFeasibility: row.scoreCriteria.feasibility,
      opportunityScore: row.opportunityScore,
      publicationStatus: publishImmediately ? 'published' : 'pending_review',
      validationStatus: row.validationStatus,
      isFeatured: false,
      topTenRank: null,
      sourceType: 'csv_import',
      submittedByName: 'ESC Admin CSV Import',
      submittedByEmail: adminEmail,
      reviewedBy: adminEmail,
      reviewedAt: new Date().toISOString(),
    });
  }

  const chunkSize = 100;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    await db.insert(exchangeProblems).values(toInsert.slice(i, i + chunkSize));
  }

  return {
    importedCount: toInsert.length,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 50),
  };
}

export async function adminExportProblemsCsv(publicationStatus?: string): Promise<string> {
  const rows = await db
    .select()
    .from(exchangeProblems)
    .where(
      publicationStatus && publicationStatus !== 'all'
        ? eq(exchangeProblems.publicationStatus, publicationStatus)
        : undefined
    )
    .orderBy(asc(exchangeProblems.problemCode))
    .limit(5000);

  return exportProblemsToCsv(rows.map((r) => mapProblemRow(r)));
}
