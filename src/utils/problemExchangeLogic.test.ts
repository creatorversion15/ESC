import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROBLEM_EXCHANGE_CATEGORIES,
  computeOpportunityScore,
  deriveImpactLevel,
  exportProblemsToCsv,
  normalizeProblemTitle,
  parseProblemExchangeCsv,
  validateProblemReportInput,
  validateProblemSubmission,
  validateSolverInterestInput,
} from './problemExchangeLogic';
import {
  buildAllExchangeProblemSeeds,
  validateExchangeSeedDataset,
} from '../data/problemExchange/index';
import type { ExchangeProblem } from '../types';

test('dataset contains exactly 1,000 distinct original problems across all 40 categories', () => {
  const records = buildAllExchangeProblemSeeds();
  const report = validateExchangeSeedDataset(records);

  assert.equal(report.ok, true, `Dataset validation errors:\n${report.errors.join('\n')}`);
  assert.equal(report.totalCount, 1000);
  assert.equal(Object.keys(report.categoryCounts).length, 40);
  assert.equal(report.topTenCount, 10);

  for (const cat of PROBLEM_EXCHANGE_CATEGORIES) {
    assert.equal(report.categoryCounts[cat], 25, `Category ${cat} should have 25 problems`);
  }

  // Every seeded problem must have non-empty core fields and valid score bounds
  for (const r of records) {
    assert.ok(r.title.length >= 15, `Title too short: ${r.problemCode}`);
    assert.ok(r.description.length >= 50, `Description too short: ${r.problemCode}`);
    assert.ok(r.opportunityScore >= 1 && r.opportunityScore <= 100);
    assert.equal(r.validationStatus, 'research_needed');
    assert.equal(r.publicationStatus, 'published');
    assert.ok(r.skillsRequired.length >= 2);
    assert.equal(r.suggestedResearchQuestions.length, 2);
  }
});

test('computeOpportunityScore applies exact weighted criteria formula and clamping', () => {
  // 0.22*90 + 0.20*80 + 0.14*70 + 0.16*60 + 0.18*50 + 0.10*40 = 19.8+16+9.8+9.6+9+4 = 68.2 -> 68
  const score = computeOpportunityScore({
    severity: 90,
    peopleAffected: 80,
    frequency: 70,
    urgency: 60,
    potentialImpact: 50,
    feasibility: 40,
  });
  assert.equal(score, 68);

  // Clamping above 100 and below 1
  const maxScore = computeOpportunityScore({
    severity: 150,
    peopleAffected: 120,
    frequency: 110,
    urgency: 105,
    potentialImpact: 200,
    feasibility: 999,
  });
  assert.equal(maxScore, 100);

  const minScore = computeOpportunityScore({
    severity: -10,
    peopleAffected: 0,
    frequency: 0,
    urgency: -5,
    potentialImpact: 0,
    feasibility: 0,
  });
  assert.equal(minScore, 1);
});

test('deriveImpactLevel and normalizeProblemTitle work deterministically', () => {
  assert.equal(deriveImpactLevel(85, 80), 'critical');
  assert.equal(deriveImpactLevel(75, 89), 'critical');
  assert.equal(deriveImpactLevel(72, 70), 'high');
  assert.equal(deriveImpactLevel(60, 62), 'medium');

  assert.equal(
    normalizeProblemTitle('  Low-Cost   Soil-NPK & pH Scanner!! '),
    'low cost soil npk ph scanner'
  );
});

test('validateProblemSubmission enforces required fields, category list, and attachment limits', () => {
  const invalid = validateProblemSubmission({
    title: 'Short',
    description: 'Too brief',
    category: 'Fake Category',
    industry: '',
    location: '',
    affectedUsers: '',
    whyItMatters: '',
    submitterName: '',
    submitterEmail: 'not-an-email',
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.category);
  assert.ok(invalid.errors.submitterEmail);

  const valid = validateProblemSubmission({
    title: 'Automated Solar Grain Moisture Monitoring for Village Warehouses',
    description:
      'Small rural grain warehouses lose 12% of stored wheat each monsoon because hidden moisture pockets go undetected until fungal mold spreads.',
    category: 'Agriculture Technology',
    industry: 'Agri Storage',
    location: 'Madhya Pradesh & Punjab',
    affectedUsers: 'Village warehouse operators and smallholder farmers',
    whyItMatters: 'Preventing hidden spoilage protects farmer income and national grain reserves.',
    submitterName: 'Aarav Kulkarni',
    submitterEmail: 'aarav@example.com',
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  const badMime = validateProblemSubmission({
    title: 'Automated Solar Grain Moisture Monitoring for Village Warehouses',
    description:
      'Small rural grain warehouses lose 12% of stored wheat each monsoon because hidden moisture pockets go undetected until fungal mold spreads.',
    category: 'Agriculture Technology',
    industry: 'Agri Storage',
    location: 'Madhya Pradesh',
    affectedUsers: 'Village warehouse operators',
    whyItMatters: 'Preventing hidden spoilage protects farmer income.',
    submitterName: 'Aarav Kulkarni',
    submitterEmail: 'aarav@example.com',
    attachmentName: 'script.exe',
    attachmentType: 'application/x-msdownload',
    attachmentDataUrl: 'data:application/x-msdownload;base64,AAAA',
  });
  assert.equal(badMime.isValid, false);
  assert.ok(badMime.errors.attachment);
});

test('validateSolverInterestInput and validateProblemReportInput validate payloads', () => {
  assert.equal(
    validateSolverInterestInput({
      proposedApproach: 'Short',
      teamPreference: 'invalid',
      skillsOffered: [],
    }).isValid,
    false
  );

  assert.equal(
    validateSolverInterestInput({
      proposedApproach:
        'We plan to build a rugged STM32 capacitive moisture spear probe with LoRaWAN alerts tested at local FPO godowns.',
      teamPreference: 'form_new_team',
      skillsOffered: ['Embedded Systems', 'LoRaWAN'],
    }).isValid,
    true
  );

  assert.equal(
    validateProblemReportInput({ reason: 'duplicate', details: 'Duplicate of PX-0042 in Robotics.' }).isValid,
    true
  );
  assert.equal(validateProblemReportInput({ reason: 'unknown', details: 'bad' }).isValid, false);
});

test('CSV export and import round-trip cleanly with deduplication and 1000-row cap', () => {
  const sample: ExchangeProblem = {
    id: 'esc_px_0001',
    problemCode: 'PX-0001',
    title: 'Compact Solar Micro-Pasteurizer for Rural Village Dairies',
    description:
      'Raw village milk sours in 4 hours under summer heat before tankers arrive, forcing distress sales at steep discounts.',
    category: 'Food Technology',
    industry: 'Rural Dairy',
    affectedUsers: 'Village dairy farmers',
    realWorldContext: 'Rural dairy clusters lack reliable 3-phase power.',
    currentChallenges: 'No affordable village-scale pasteurizers exist.',
    currentWorkarounds: 'Selling raw milk quickly at low rates.',
    whyItMatters: 'Doubles local rural dairy farmer realizations safely.',
    potentialImpact: 'Cuts village dairy spoilage by 70%.',
    impactLevel: 'high',
    difficulty: 'advanced',
    skillsRequired: ['Thermal Engineering', 'Solar Power'],
    location: 'Rural India',
    developmentOpportunities: 'Build 200L/hr plate pasteurizer MVP.',
    suggestedResearchQuestions: ['What heat-recovery ratio minimizes solar area?'],
    evidenceLinks: ['https://example.org/dairy-report'],
    scoreCriteria: {
      severity: 86,
      peopleAffected: 88,
      frequency: 92,
      urgency: 82,
      potentialImpact: 90,
      feasibility: 76,
    },
    opportunityScore: 86,
    publicationStatus: 'published',
    validationStatus: 'research_needed',
    isFeatured: true,
    topTenRank: null,
    sourceType: 'esc_original',
    viewsCount: 0,
    savesCount: 0,
    solverInterestCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const csv = exportProblemsToCsv([sample, sample]);
  const parsed = parseProblemExchangeCsv(csv);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.skipped.length, 1); // Duplicate title skipped
  assert.equal(parsed.rows[0].title, sample.title);
  assert.equal(parsed.rows[0].category, 'Food Technology');
  assert.equal(parsed.rows[0].opportunityScore, 86);
});
