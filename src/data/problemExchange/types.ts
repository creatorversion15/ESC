import type {
  ExchangeProblemDifficulty,
  OpportunityScoreCriteria,
} from '../../types';
import type { ProblemExchangeCategory } from '../../utils/problemExchangeLogic';

/**
 * Compact authored seed specification for each unique real-world problem.
 * Expanded into a full structured ExchangeProblem record during batch validation & seeding.
 */
export interface SeedProblemSpec {
  title: string;
  industry: string;
  affectedUsers: string;
  context: string;
  challenges: string;
  workarounds: string;
  whyItMatters: string;
  impact: string;
  difficulty: ExchangeProblemDifficulty;
  skills: string[];
  location: string;
  devOpportunities: string;
  researchQuestions: [string, string];
  scores: [number, number, number, number, number, number]; // [severity, peopleAffected, frequency, urgency, potentialImpact, feasibility]
  featured?: boolean;
  topTenRank?: number;
}

export type SeedDifficultyInput = ExchangeProblemDifficulty | 'easy' | 'medium' | 'hard';

export interface CategoryProblemBatch {
  category: ProblemExchangeCategory;
  defaultIndustry: string;
  defaultSkills: string[];
  items: {
    t: string; // Distinct real-world problem title
    ind?: string; // Specific industry vertical
    u: string; // Affected users
    ctx: string; // Real-world context & root challenge
    wrk: string; // Current workarounds / limitations
    why: string; // Why this problem matters & potential impact
    loc: string; // Geographic relevance
    diff: SeedDifficultyInput;
    sk?: string[]; // Specific skills override/additions
    q: [string, string]; // Suggested research questions
    sc: [number, number, number, number, number, number]; // [severity, peopleAffected, frequency, urgency, potentialImpact, feasibility]
    feat?: boolean;
    rank?: number;
  }[];
}

export function normalizeSeedDifficulty(
  diff: SeedDifficultyInput,
  feasibilityScore: number
): ExchangeProblemDifficulty {
  if (diff === 'beginner' || diff === 'intermediate' || diff === 'advanced' || diff === 'deep_tech') {
    return diff;
  }
  if (diff === 'easy') return 'beginner';
  if (diff === 'medium') return 'intermediate';
  return feasibilityScore <= 72 ? 'deep_tech' : 'advanced';
}

export function buildCriteriaTuple(
  sc: [number, number, number, number, number, number]
): OpportunityScoreCriteria {
  return {
    severity: sc[0],
    peopleAffected: sc[1],
    frequency: sc[2],
    urgency: sc[3],
    potentialImpact: sc[4],
    feasibility: sc[5],
  };
}
