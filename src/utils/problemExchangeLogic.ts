import type {
  ExchangeProblem,
  ExchangeProblemDifficulty,
  ExchangeProblemImpact,
  ExchangePublicationStatus,
  ExchangeValidationStatus,
  OpportunityScoreCriteria,
} from '../types/index.ts';

/* --------------------------------------------------------------------------
 * OFFICIAL 40 ESC PROBLEM EXCHANGE CATEGORIES
 * -------------------------------------------------------------------------- */

export const PROBLEM_EXCHANGE_CATEGORIES = [
  'Mechanical Engineering',
  'Manufacturing',
  'Industrial Automation',
  'Robotics',
  'Automotive',
  'Electric Vehicles',
  'Aerospace',
  'Renewable Energy',
  'Solar Energy',
  'Agriculture Technology',
  'Water Management',
  'Waste Management',
  'Construction',
  'Civil Engineering',
  'Smart Cities',
  'Transportation',
  'Logistics',
  'Healthcare Technology',
  'Assistive Technology',
  'Education Technology',
  'Artificial Intelligence',
  'Machine Learning',
  'Internet of Things',
  'Embedded Systems',
  'Electronics',
  'Semiconductor Technology',
  'Software Development',
  'Cybersecurity',
  'FinTech',
  'Retail Technology',
  'Food Technology',
  'Food Processing',
  'Packaging',
  'Supply Chain',
  'Small Business Problems',
  'Rural Development',
  'Consumer Products',
  'Environmental Technology',
  'Industrial Safety',
  'Other Emerging Technologies',
] as const;

export type ProblemExchangeCategory = (typeof PROBLEM_EXCHANGE_CATEGORIES)[number];

export const OPPORTUNITY_SCORE_WEIGHTS = {
  severity: 0.22,
  peopleAffected: 0.2,
  frequency: 0.14,
  urgency: 0.16,
  potentialImpact: 0.18,
  feasibility: 0.1,
} as const;

export const OPPORTUNITY_SCORE_CRITERIA_META: {
  key: keyof OpportunityScoreCriteria;
  label: string;
  weightPercent: number;
  description: string;
}[] = [
  {
    key: 'severity',
    label: 'Problem Severity',
    weightPercent: 22,
    description: 'Magnitude of technical, economic, health, or operational pain caused when unsolved.',
  },
  {
    key: 'peopleAffected',
    label: 'People Affected',
    weightPercent: 20,
    description: 'Breadth of citizens, workers, students, businesses, or institutions impacted.',
  },
  {
    key: 'frequency',
    label: 'Frequency of Occurrence',
    weightPercent: 14,
    description: 'How often the friction recurs in daily, seasonal, or industrial workflows.',
  },
  {
    key: 'urgency',
    label: 'Urgency',
    weightPercent: 16,
    description: 'Time sensitivity due to regulatory shifts, climate pressure, safety risk, or cost escalation.',
  },
  {
    key: 'potentialImpact',
    label: 'Potential Impact',
    weightPercent: 18,
    description: 'Expected measurable improvement in cost, safety, efficiency, sustainability, or access.',
  },
  {
    key: 'feasibility',
    label: 'Solution Feasibility',
    weightPercent: 10,
    description: 'Practicality for student engineers and early-stage builders to prototype and validate.',
  },
];

export const ESC_OPPORTUNITY_SCORE_DISCLAIMER =
  'The ESC Opportunity Score is an internal prioritisation tool derived from six transparent evaluation criteria to help builders focus research effort. It is not a guarantee of market demand, commercial viability, or business success.';

export const ALLOWED_PROBLEM_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];
export const MAX_PROBLEM_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_CSV_IMPORT_RECORDS = 1000;

export function clampScoreMetric(value: unknown, fallback = 70): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.round(n)));
}

/**
 * Computes the transparent ESC Opportunity Score (0–100) from the 6 weighted criteria.
 */
export function computeOpportunityScore(criteria: OpportunityScoreCriteria): number {
  const severity = clampScoreMetric(criteria.severity);
  const peopleAffected = clampScoreMetric(criteria.peopleAffected);
  const frequency = clampScoreMetric(criteria.frequency);
  const urgency = clampScoreMetric(criteria.urgency);
  const potentialImpact = clampScoreMetric(criteria.potentialImpact);
  const feasibility = clampScoreMetric(criteria.feasibility);

  const weighted =
    severity * OPPORTUNITY_SCORE_WEIGHTS.severity +
    peopleAffected * OPPORTUNITY_SCORE_WEIGHTS.peopleAffected +
    frequency * OPPORTUNITY_SCORE_WEIGHTS.frequency +
    urgency * OPPORTUNITY_SCORE_WEIGHTS.urgency +
    potentialImpact * OPPORTUNITY_SCORE_WEIGHTS.potentialImpact +
    feasibility * OPPORTUNITY_SCORE_WEIGHTS.feasibility;

  return Math.max(1, Math.min(100, Math.round(weighted)));
}

export function deriveImpactLevel(score: number, potentialImpact: number): ExchangeProblemImpact {
  if (score >= 82 || potentialImpact >= 88) return 'critical';
  if (score >= 68 || potentialImpact >= 74) return 'high';
  return 'medium';
}

export function normalizeProblemTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getValidationStatusLabel(status: ExchangeValidationStatus | string): string {
  switch (status) {
    case 'validated':
      return 'Validated';
    case 'under_validation':
      return 'Under Validation';
    case 'research_needed':
    default:
      return 'Research Needed';
  }
}

export function getPublicationStatusLabel(status: ExchangePublicationStatus | string): string {
  switch (status) {
    case 'published':
      return 'Published';
    case 'pending_review':
      return 'Pending Review';
    case 'rejected':
      return 'Rejected';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

export function getDifficultyLabel(difficulty: ExchangeProblemDifficulty | string): string {
  switch (difficulty) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    case 'deep_tech':
      return 'Deep Tech';
    default:
      return difficulty;
  }
}

export function isValidCategory(category: string): boolean {
  return (PROBLEM_EXCHANGE_CATEGORIES as readonly string[]).includes(category);
}

export function sanitizeLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const cleaned: string[] = [];
  for (const item of links) {
    const str = String(item || '').trim();
    if (!str) continue;
    if (/^https?:\/\/[^\s]+$/i.test(str) && str.length <= 500) {
      if (!cleaned.includes(str)) cleaned.push(str);
    }
    if (cleaned.length >= 8) break;
  }
  return cleaned;
}

export interface ProblemSubmissionInput {
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
  submitterName: string;
  submitterEmail: string;
}

export function validateProblemSubmission(input: ProblemSubmissionInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const category = (input.category || '').trim();
  const industry = (input.industry || '').trim();
  const location = (input.location || '').trim();
  const affectedUsers = (input.affectedUsers || '').trim();
  const whyItMatters = (input.whyItMatters || '').trim();
  const submitterName = (input.submitterName || '').trim();
  const submitterEmail = (input.submitterEmail || '').trim();

  if (title.length < 10 || title.length > 180) {
    errors.title = 'Problem title must be between 10 and 180 characters.';
  }
  if (description.length < 40 || description.length > 4000) {
    errors.description = 'Please describe the problem in at least 40 characters.';
  }
  if (!isValidCategory(category)) {
    errors.category = 'Please select one of the official 40 ESC Problem Exchange categories.';
  }
  if (industry.length < 2 || industry.length > 100) {
    errors.industry = 'Please specify the affected industry.';
  }
  if (location.length < 2 || location.length > 120) {
    errors.location = 'Please provide a location or geographic scope.';
  }
  if (affectedUsers.length < 5 || affectedUsers.length > 500) {
    errors.affectedUsers = 'Please specify who experiences this problem.';
  }
  if (whyItMatters.length < 15 || whyItMatters.length > 2000) {
    errors.whyItMatters = 'Please explain why this problem matters (at least 15 characters).';
  }
  if (submitterName.length < 2 || submitterName.length > 120) {
    errors.submitterName = 'Please provide your name.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    errors.submitterEmail = 'Please enter a valid email address.';
  }

  if (input.attachmentDataUrl) {
    const type = (input.attachmentType || '').trim();
    if (!ALLOWED_PROBLEM_ATTACHMENT_TYPES.includes(type)) {
      errors.attachment = 'Only PNG, JPG, WEBP, or PDF files are permitted.';
    } else {
      const base64Part = input.attachmentDataUrl.split(',')[1] || '';
      const approxBytes = Math.ceil((base64Part.length * 3) / 4);
      if (approxBytes > MAX_PROBLEM_ATTACHMENT_BYTES) {
        errors.attachment = 'Attachment must be 2 MB or smaller.';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSolverInterestInput(input: {
  proposedApproach: string;
  teamPreference: string;
  skillsOffered: string[];
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const approach = (input.proposedApproach || '').trim();
  if (approach.length < 25 || approach.length > 3000) {
    errors.proposedApproach = 'Please explain your proposed approach in at least 25 characters.';
  }
  if (!['solo', 'form_new_team', 'join_team'].includes(input.teamPreference)) {
    errors.teamPreference = 'Choose a valid team collaboration preference.';
  }
  if (!Array.isArray(input.skillsOffered) || input.skillsOffered.length === 0) {
    errors.skillsOffered = 'Add at least one relevant skill you bring to this problem.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateProblemReportInput(input: {
  reason: string;
  details: string;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!['duplicate', 'inaccurate', 'spam', 'out_of_scope', 'other'].includes(input.reason)) {
    errors.reason = 'Please select a valid report reason.';
  }
  const details = (input.details || '').trim();
  if (details.length < 10 || details.length > 1500) {
    errors.details = 'Please include at least 10 characters explaining the report.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

/* --------------------------------------------------------------------------
 * AUTHORISED CSV IMPORT & EXPORT (RFC-4180 COMPLIANT)
 * -------------------------------------------------------------------------- */

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface ParsedCsvProblemRow {
  title: string;
  description: string;
  category: string;
  industry: string;
  affectedUsers: string;
  realWorldContext: string;
  currentChallenges: string;
  currentWorkarounds: string;
  whyItMatters: string;
  potentialImpact: string;
  difficulty: ExchangeProblemDifficulty;
  skillsRequired: string[];
  location: string;
  developmentOpportunities: string;
  suggestedResearchQuestions: string[];
  evidenceLinks: string[];
  scoreCriteria: OpportunityScoreCriteria;
  opportunityScore: number;
  validationStatus: ExchangeValidationStatus;
}

export function parseProblemExchangeCsv(csvText: string): {
  rows: ParsedCsvProblemRow[];
  skipped: { line: number; reason: string }[];
} {
  const lines = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], skipped: [{ line: 1, reason: 'CSV must contain a header row and at least one data row.' }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const colIndex = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iTitle = colIndex(['title', 'problemtitle']);
  const iDesc = colIndex(['description', 'problemdescription']);
  const iCat = colIndex(['category', 'problemcategory']);
  const iInd = colIndex(['industry']);
  const iUsers = colIndex(['affectedusers', 'whoisafffected', 'whoisaffected']);
  const iContext = colIndex(['realworldcontext', 'context']);
  const iChal = colIndex(['currentchallenges', 'challenges']);
  const iWork = colIndex(['currentworkarounds', 'workarounds']);
  const iWhy = colIndex(['whyitmatters', 'whythisproblemmatters']);
  const iImpact = colIndex(['potentialimpact', 'impact']);
  const iDiff = colIndex(['difficulty', 'difficultylevel']);
  const iSkills = colIndex(['skillsrequired', 'skills']);
  const iLoc = colIndex(['location', 'geographicrelevance']);
  const iDev = colIndex(['developmentopportunities', 'opportunities']);
  const iQuestions = colIndex(['suggestedresearchquestions', 'researchquestions']);
  const iLinks = colIndex(['evidencelinks', 'referencelinks']);
  const iSev = colIndex(['scoreseverity', 'severity']);
  const iPeople = colIndex(['scorepeopleaffected', 'peopleaffected']);
  const iFreq = colIndex(['scorefrequency', 'frequency']);
  const iUrg = colIndex(['scoreurgency', 'urgency']);
  const iPot = colIndex(['scorepotentialimpact', 'potentialimpactscore', 'impactscore']);
  const iFeas = colIndex(['scorefeasibility', 'feasibility']);
  const iVal = colIndex(['validationstatus', 'validation']);

  const rows: ParsedCsvProblemRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seenTitles = new Set<string>();

  for (let idx = 1; idx < lines.length; idx++) {
    if (rows.length >= MAX_CSV_IMPORT_RECORDS) {
      skipped.push({ line: idx + 1, reason: `Maximum import limit of ${MAX_CSV_IMPORT_RECORDS} records reached.` });
      break;
    }

    const cells = parseCsvLine(lines[idx]);
    const get = (i: number, fallback = '') => (i >= 0 && cells[i] ? cells[i].trim() : fallback);

    const title = get(iTitle);
    const description = get(iDesc);
    const rawCategory = get(iCat, 'Other Emerging Technologies');
    const category = isValidCategory(rawCategory) ? rawCategory : 'Other Emerging Technologies';
    const industry = get(iInd, category);

    if (title.length < 8) {
      skipped.push({ line: idx + 1, reason: 'Missing or too short title.' });
      continue;
    }
    if (description.length < 20) {
      skipped.push({ line: idx + 1, reason: 'Missing or too short description.' });
      continue;
    }

    const norm = normalizeProblemTitle(title);
    if (seenTitles.has(norm)) {
      skipped.push({ line: idx + 1, reason: `Duplicate title in CSV: "${title}"` });
      continue;
    }
    seenTitles.add(norm);

    const rawDiff = get(iDiff, 'intermediate').toLowerCase().replace(/\s+/g, '_');
    const difficulty: ExchangeProblemDifficulty =
      rawDiff === 'beginner' || rawDiff === 'intermediate' || rawDiff === 'advanced' || rawDiff === 'deep_tech'
        ? rawDiff
        : 'intermediate';

    const rawVal = get(iVal, 'research_needed').toLowerCase().replace(/\s+/g, '_');
    const validationStatus: ExchangeValidationStatus =
      rawVal === 'validated' || rawVal === 'under_validation' || rawVal === 'research_needed'
        ? rawVal
        : 'research_needed';

    const scoreCriteria: OpportunityScoreCriteria = {
      severity: clampScoreMetric(get(iSev), 74),
      peopleAffected: clampScoreMetric(get(iPeople), 72),
      frequency: clampScoreMetric(get(iFreq), 70),
      urgency: clampScoreMetric(get(iUrg), 72),
      potentialImpact: clampScoreMetric(get(iPot), 76),
      feasibility: clampScoreMetric(get(iFeas), 68),
    };

    const skillsRequired = get(iSkills)
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);

    const suggestedResearchQuestions = get(iQuestions)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const evidenceLinks = sanitizeLinks(
      get(iLinks)
        .split(/[|;\s]+/)
        .map((s) => s.trim())
    );

    rows.push({
      title,
      description,
      category,
      industry,
      affectedUsers: get(iUsers, 'Industry stakeholders and end users'),
      realWorldContext: get(iContext, description),
      currentChallenges: get(iChal, 'Existing workflows remain manual, costly, or fragmented.'),
      currentWorkarounds: get(iWork, ''),
      whyItMatters: get(iWhy, 'Solving this bottleneck unlocks measurable operational and social impact.'),
      potentialImpact: get(iImpact, 'Reduced operational friction and scalable engineering adoption.'),
      difficulty,
      skillsRequired: skillsRequired.length > 0 ? skillsRequired : ['Systems Engineering', 'Product Design'],
      location: get(iLoc, 'Pan-India'),
      developmentOpportunities: get(iDev, 'Hardware/software MVP validation with regional pilot partners.'),
      suggestedResearchQuestions:
        suggestedResearchQuestions.length > 0
          ? suggestedResearchQuestions
          : ['What are the primary operational constraints faced by affected users today?'],
      evidenceLinks,
      scoreCriteria,
      opportunityScore: computeOpportunityScore(scoreCriteria),
      validationStatus,
    });
  }

  return { rows, skipped };
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportProblemsToCsv(items: ExchangeProblem[]): string {
  const headers = [
    'Problem Code',
    'Title',
    'Category',
    'Industry',
    'Difficulty',
    'Impact Level',
    'Location',
    'ESC Opportunity Score',
    'Severity',
    'People Affected',
    'Frequency',
    'Urgency',
    'Potential Impact Score',
    'Feasibility',
    'Validation Status',
    'Publication Status',
    'Featured',
    'Top 10 Rank',
    'Affected Users',
    'Description',
    'Why It Matters',
    'Skills Required',
    'Evidence Links',
    'Created At',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const p of items) {
    lines.push(
      [
        p.problemCode,
        p.title,
        p.category,
        p.industry,
        p.difficulty,
        p.impactLevel,
        p.location,
        p.opportunityScore,
        p.scoreCriteria.severity,
        p.scoreCriteria.peopleAffected,
        p.scoreCriteria.frequency,
        p.scoreCriteria.urgency,
        p.scoreCriteria.potentialImpact,
        p.scoreCriteria.feasibility,
        p.validationStatus,
        p.publicationStatus,
        p.isFeatured ? 'Yes' : 'No',
        p.topTenRank ?? '',
        p.affectedUsers,
        p.description,
        p.whyItMatters,
        p.skillsRequired.join('; '),
        p.evidenceLinks.join(' | '),
        p.createdAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return lines.join('\n');
}
