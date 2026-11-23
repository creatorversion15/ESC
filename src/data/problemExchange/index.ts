import type {
  ExchangeProblemDifficulty,
  ExchangeProblemImpact,
  ExchangePublicationStatus,
  ExchangeSourceType,
  ExchangeValidationStatus,
} from '../../types';
import {
  PROBLEM_EXCHANGE_CATEGORIES,
  computeOpportunityScore,
  deriveImpactLevel,
  normalizeProblemTitle,
} from '../../utils/problemExchangeLogic';
import { PROBLEM_BATCH_1 } from './batch1';
import { PROBLEM_BATCH_2A } from './batch2a';
import { PROBLEM_BATCH_2B } from './batch2b';
import { PROBLEM_BATCH_3A } from './batch3a';
import { PROBLEM_BATCH_3B } from './batch3b';
import { PROBLEM_BATCH_4A } from './batch4a';
import { PROBLEM_BATCH_4B } from './batch4b';
import { buildCriteriaTuple, normalizeSeedDifficulty, type CategoryProblemBatch } from './types';

export interface ExchangeProblemSeedRecord {
  id: string;
  problemCode: string;
  title: string;
  normalizedTitle: string;
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
  scoreSeverity: number;
  scorePeopleAffected: number;
  scoreFrequency: number;
  scoreUrgency: number;
  scorePotentialImpact: number;
  scoreFeasibility: number;
  opportunityScore: number;
  publicationStatus: ExchangePublicationStatus;
  validationStatus: ExchangeValidationStatus;
  isFeatured: boolean;
  topTenRank: number | null;
  sourceType: ExchangeSourceType;
  submittedByUid: string;
  submittedByName: string;
  submittedByEmail: string;
}

export const ALL_CATEGORY_BATCHES: CategoryProblemBatch[] = [
  ...PROBLEM_BATCH_1,
  ...PROBLEM_BATCH_2A,
  ...PROBLEM_BATCH_2B,
  ...PROBLEM_BATCH_3A,
  ...PROBLEM_BATCH_3B,
  ...PROBLEM_BATCH_4A,
  ...PROBLEM_BATCH_4B,
];

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const val of values) {
    const clean = val.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

/**
 * Expands the 40 authored category batches (25 distinct problems per category)
 * into 1,000 structured, deterministic, Cloud-SQL-ready Problem Exchange records.
 * Every independently authored problem defaults to validationStatus: 'research_needed'.
 */
export function buildAllExchangeProblemSeeds(): ExchangeProblemSeedRecord[] {
  const records: ExchangeProblemSeedRecord[] = [];
  let seq = 1;

  for (const batch of ALL_CATEGORY_BATCHES) {
    for (const item of batch.items) {
      const codeNum = String(seq).padStart(4, '0');
      const criteria = buildCriteriaTuple(item.sc);
      const opportunityScore = computeOpportunityScore(criteria);
      const impactLevel = deriveImpactLevel(opportunityScore, criteria.potentialImpact);
      const difficulty = normalizeSeedDifficulty(item.diff, criteria.feasibility);
      const industry = (item.ind || batch.defaultIndustry).trim();
      const skillsRequired = dedupeStrings([...(item.sk || []), ...batch.defaultSkills]).slice(0, 6);

      const description = `${item.ctx} ${item.why}`.trim();
      const currentChallenges = `${item.ctx} Today, ${item.wrk.charAt(0).toLowerCase()}${item.wrk.slice(1)}`;
      const potentialImpact = `${item.why} Addressing this challenge meaningfully benefits ${item.u.toLowerCase()} across ${item.loc}.`;
      const developmentOpportunities = `Build and field-test an engineering MVP combining ${skillsRequired.slice(0, 3).join(', ')} with pilot validation alongside ${item.u.toLowerCase()} in ${item.loc}.`;

      records.push({
        id: `esc_px_${codeNum}`,
        problemCode: `PX-${codeNum}`,
        title: item.t.trim(),
        normalizedTitle: normalizeProblemTitle(item.t),
        description,
        category: batch.category,
        industry,
        affectedUsers: item.u.trim(),
        realWorldContext: item.ctx.trim(),
        currentChallenges,
        currentWorkarounds: item.wrk.trim(),
        whyItMatters: item.why.trim(),
        potentialImpact,
        impactLevel,
        difficulty,
        skillsRequired,
        location: item.loc.trim(),
        developmentOpportunities,
        suggestedResearchQuestions: [item.q[0].trim(), item.q[1].trim()],
        evidenceLinks: [],
        scoreSeverity: criteria.severity,
        scorePeopleAffected: criteria.peopleAffected,
        scoreFrequency: criteria.frequency,
        scoreUrgency: criteria.urgency,
        scorePotentialImpact: criteria.potentialImpact,
        scoreFeasibility: criteria.feasibility,
        opportunityScore,
        publicationStatus: 'published',
        validationStatus: 'research_needed',
        isFeatured: Boolean(item.feat || item.rank),
        topTenRank: typeof item.rank === 'number' ? item.rank : null,
        sourceType: 'esc_original',
        submittedByUid: '',
        submittedByName: 'ESC Research Desk',
        submittedByEmail: '',
      });

      seq += 1;
    }
  }

  return records;
}

export function validateExchangeSeedDataset(records: ExchangeProblemSeedRecord[]): {
  ok: boolean;
  errors: string[];
  totalCount: number;
  categoryCounts: Record<string, number>;
  topTenCount: number;
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const seenTitles = new Set<string>();
  const seenRanks = new Set<number>();
  const categoryCounts: Record<string, number> = {};

  for (const cat of PROBLEM_EXCHANGE_CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  for (const r of records) {
    if (seenIds.has(r.id)) errors.push(`Duplicate id: ${r.id}`);
    seenIds.add(r.id);

    if (seenCodes.has(r.problemCode)) errors.push(`Duplicate problemCode: ${r.problemCode}`);
    seenCodes.add(r.problemCode);

    if (!r.normalizedTitle || seenTitles.has(r.normalizedTitle)) {
      errors.push(`Duplicate or blank title: "${r.title}" (${r.problemCode})`);
    }
    seenTitles.add(r.normalizedTitle);

    if (!(r.category in categoryCounts)) {
      errors.push(`Invalid category "${r.category}" on ${r.problemCode}`);
    } else {
      categoryCounts[r.category] += 1;
    }

    if (r.validationStatus !== 'research_needed') {
      errors.push(`Seed record ${r.problemCode} must default to research_needed`);
    }

    if (r.topTenRank !== null) {
      if (r.topTenRank < 1 || r.topTenRank > 10 || seenRanks.has(r.topTenRank)) {
        errors.push(`Invalid or duplicate topTenRank ${r.topTenRank} on ${r.problemCode}`);
      }
      seenRanks.add(r.topTenRank);
    }
  }

  if (records.length !== 1000) {
    errors.push(`Expected exactly 1000 problems, found ${records.length}`);
  }

  for (const cat of PROBLEM_EXCHANGE_CATEGORIES) {
    if (categoryCounts[cat] !== 25) {
      errors.push(`Category "${cat}" has ${categoryCounts[cat]} problems (expected 25)`);
    }
  }

  for (let rank = 1; rank <= 10; rank++) {
    if (!seenRanks.has(rank)) {
      errors.push(`Missing Top 10 rank #${rank}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    totalCount: records.length,
    categoryCounts,
    topTenCount: seenRanks.size,
  };
}
