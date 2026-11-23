import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_CATEGORIES,
  ADMIN_MODULES,
  buildAdminModuleCards,
  buildAdminModuleHash,
  filterAdminModules,
  normalizeAdminTab,
  parseAdminTabFromHash,
  type AdminLiveCounts,
} from './adminModules';

const BASE_COUNTS: AdminLiveCounts = {
  totalMembers: 42,
  membersUnderReview: 5,
  totalApplications: 18,
  pendingApplications: 4,
  totalTeams: 9,
  teamsUnderReview: 2,
  totalTasks: 31,
  overdueTasks: 3,
  totalActivities: 120,
  totalIdeas: 14,
  pendingIdeas: 6,
  publishedProblems: 1000,
  pendingProblems: 2,
  pendingSolverInterests: 4,
  openProblemReports: 1,
  totalChallenges: 5,
  totalChallengeSubmissions: 19,
  totalProjects: 11,
  activeProjects: 7,
  totalCustomSkills: 23,
  pendingCustomSkills: 3,
  totalEvents: 8,
  publishedEvents: 6,
  totalOpportunities: 12,
  totalOpportunityApplications: 27,
  totalSupportTickets: 15,
  openSupportTickets: 4,
  totalCertificates: 34,
  validCertificates: 32,
  totalCardOrders: 9,
  pendingCardOrders: 2,
  totalNotifications: 20,
  unreadNotifications: 5,
  totalAnnouncements: 3,
  totalLogs: 88,
  applicationsOpen: true,
};

describe('ESC Super Admin Module Registry', () => {
  it('defines all 4 required categories with zero duplicate module IDs or names', () => {
    assert.deepEqual(
      ADMIN_CATEGORIES.map((c) => c.id),
      ['core_operations', 'innovation_startups', 'platform_community', 'administration']
    );

    const ids = ADMIN_MODULES.map((m) => m.id);
    const names = ADMIN_MODULES.map((m) => m.name);
    assert.equal(new Set(ids).size, ids.length, 'Module IDs must be unique');
    assert.equal(new Set(names).size, names.length, 'Module names must be unique');
  });

  it('includes all 16 core required modules plus Projects, Startup Lab, and Audit Logs', () => {
    const requiredIds = [
      'overview',
      'users',
      'applications',
      'teams',
      'tasks',
      'activities',
      'ideas',
      'problem_exchange',
      'challenges',
      'projects',
      'skills',
      'events',
      'opportunities',
      'support',
      'certificates',
      'notifications',
      'analytics_reports',
      'settings',
      'logs',
    ];
    const actualIds = ADMIN_MODULES.map((m) => m.id);
    for (const id of requiredIds) {
      assert.ok(actualIds.includes(id as any), `Missing required admin module: ${id}`);
    }
    const coreOpsCount = ADMIN_MODULES.filter((m) => m.category === 'core_operations').length;
    assert.equal(coreOpsCount, 6, 'Core Operations should contain exactly 6 modules (2 rows of 3)');
  });

  it('computes real database counts and pending badges without fabricating values', () => {
    const cards = buildAdminModuleCards(BASE_COUNTS);
    const px = cards.find((c) => c.id === 'problem_exchange')!;
    assert.equal(px.metricValue, '1,000');
    assert.equal(px.pendingCount, 7); // 2 pending problems + 4 solvers + 1 report
    assert.equal(px.pendingLabel, '7 Action Items');

    const support = cards.find((c) => c.id === 'support')!;
    assert.equal(support.metricValue, '15');
    assert.equal(support.pendingCount, 4);
    assert.equal(support.pendingLabel, '4 Open');

    const challenges = cards.find((c) => c.id === 'challenges')!;
    assert.equal(challenges.metricValue, '5');
    assert.equal(challenges.pendingCount, 0);
    assert.equal(challenges.pendingLabel, undefined);

    const unknownCounts = buildAdminModuleCards({
      ...BASE_COUNTS,
      publishedProblems: null,
      totalSupportTickets: null,
      openSupportTickets: 0,
    });
    assert.equal(unknownCounts.find((c) => c.id === 'problem_exchange')!.metricValue, '—');
    assert.equal(unknownCounts.find((c) => c.id === 'support')!.metricValue, '—');
  });

  it('parses and normalizes admin module deep-link hashes safely', () => {
    assert.equal(parseAdminTabFromHash('#/admin'), 'hub');
    assert.equal(parseAdminTabFromHash('#/admin?module=challenges'), 'challenges');
    assert.equal(parseAdminTabFromHash('#/admin?module=support'), 'support');
    assert.equal(parseAdminTabFromHash('#/admin?module=problem_exchange'), 'problem_exchange');
    assert.equal(parseAdminTabFromHash('#/admin?tab=analytics'), 'overview');
    assert.equal(parseAdminTabFromHash('#/admin?module=content'), 'notifications');
    assert.equal(parseAdminTabFromHash('#/admin?module=does_not_exist'), 'hub');
    assert.equal(normalizeAdminTab('SETTINGS'), 'settings');
    assert.equal(buildAdminModuleHash('hub'), '/admin');
    assert.equal(buildAdminModuleHash('challenges'), '/admin?module=challenges');
  });

  it('filters modules accurately by keyword and category', () => {
    const cards = buildAdminModuleCards(BASE_COUNTS);
    const supportMatches = filterAdminModules(cards, 'ticket');
    assert.equal(supportMatches.length, 1);
    assert.equal(supportMatches[0].id, 'support');

    const platformMatches = filterAdminModules(cards, '', 'platform_community');
    assert.deepEqual(
      platformMatches.map((m) => m.id),
      ['events', 'opportunities', 'support', 'certificates', 'card_orders']
    );
  });
});
