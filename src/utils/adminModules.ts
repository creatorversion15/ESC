export type AdminTab =
  | 'hub'
  | 'overview'
  | 'users'
  | 'applications'
  | 'teams'
  | 'tasks'
  | 'activities'
  | 'ideas'
  | 'problem_exchange'
  | 'challenges'
  | 'projects'
  | 'skills'
  | 'events'
  | 'opportunities'
  | 'support'
  | 'certificates'
  | 'card_orders'
  | 'notifications'
  | 'analytics_reports'
  | 'settings'
  | 'logs';

export type AdminCategoryId =
  | 'core_operations'
  | 'innovation_startups'
  | 'platform_community'
  | 'administration';

export interface AdminCategoryDef {
  id: AdminCategoryId;
  code: string;
  title: string;
  subtitle: string;
}

export interface AdminModuleDef {
  id: Exclude<AdminTab, 'hub'>;
  category: AdminCategoryId;
  name: string;
  shortName: string;
  description: string;
  iconKey:
    | 'overview'
    | 'users'
    | 'applications'
    | 'teams'
    | 'tasks'
    | 'activities'
    | 'ideas'
    | 'problem_exchange'
    | 'challenges'
    | 'projects'
    | 'skills'
    | 'events'
    | 'opportunities'
    | 'support'
    | 'certificates'
    | 'card_orders'
    | 'notifications'
    | 'analytics_reports'
    | 'settings'
    | 'logs';
  keywords: string[];
  superAdminOnlyNote?: string;
}

export interface AdminLiveCounts {
  totalMembers: number;
  membersUnderReview: number;
  totalApplications: number;
  pendingApplications: number;
  totalTeams: number;
  teamsUnderReview: number;
  totalTasks: number;
  overdueTasks: number;
  totalActivities: number;
  totalIdeas: number;
  pendingIdeas: number;
  publishedProblems: number | null;
  pendingProblems: number;
  pendingSolverInterests: number;
  openProblemReports: number;
  totalChallenges: number;
  totalChallengeSubmissions: number;
  totalProjects: number;
  activeProjects: number;
  totalCustomSkills: number | null;
  pendingCustomSkills: number;
  totalEvents: number;
  publishedEvents: number;
  totalOpportunities: number;
  totalOpportunityApplications: number;
  totalSupportTickets: number | null;
  openSupportTickets: number;
  totalCertificates: number;
  validCertificates: number;
  totalCardOrders: number | null;
  pendingCardOrders: number;
  totalNotifications: number;
  unreadNotifications: number;
  totalAnnouncements: number;
  totalLogs: number;
  applicationsOpen: boolean;
}

export interface AdminModuleCardModel extends AdminModuleDef {
  metricValue: string;
  metricLabel: string;
  pendingCount: number;
  pendingLabel?: string;
}

export const ADMIN_CATEGORIES: AdminCategoryDef[] = [
  {
    id: 'core_operations',
    code: 'A',
    title: 'Core Operations',
    subtitle: 'Executive overview, member approvals, fellowship intake, startup teams, sprint tasks, and live activity.',
  },
  {
    id: 'innovation_startups',
    code: 'B',
    title: 'Innovation & Startups',
    subtitle: 'Startup idea reviews, ESC Problem Exchange curation, engineering challenges, project workspaces, and Startup Lab.',
  },
  {
    id: 'platform_community',
    code: 'C',
    title: 'Platform & Community',
    subtitle: 'Events, funding & lab opportunities, support & help desk tickets, and certificate verification studio.',
  },
  {
    id: 'administration',
    code: 'D',
    title: 'Administration',
    subtitle: 'Admin alerts & site announcements, analytics & CSV exports, global Super Admin settings, and audit trails.',
  },
];

export const ADMIN_MODULES: AdminModuleDef[] = [
  // A. CORE OPERATIONS (6 modules — 2 rows of 3 on desktop)
  {
    id: 'overview',
    category: 'core_operations',
    name: 'Overview',
    shortName: 'Overview',
    description: 'Executive pulse with clickable member, startup team, and task status summaries across the ESC ecosystem.',
    iconKey: 'overview',
    keywords: ['dashboard', 'kpi', 'metrics', 'summary', 'executive'],
  },
  {
    id: 'users',
    category: 'core_operations',
    name: 'Members',
    shortName: 'Members',
    description: 'Manage approved, active, inactive, and under-review ESC members, Member IDs, roles, and 360° profiles.',
    iconKey: 'users',
    keywords: ['users', 'directory', 'accounts', 'roles', 'esc id', 'approval'],
  },
  {
    id: 'applications',
    category: 'core_operations',
    name: 'Applications',
    shortName: 'Applications',
    description: 'Review fellowship applications, shortlist candidates, request additional details, approve members, and export CSVs.',
    iconKey: 'applications',
    keywords: ['fellowship', 'intake', 'applicants', 'shortlist', 'review'],
  },
  {
    id: 'teams',
    category: 'core_operations',
    name: 'Startup Teams',
    shortName: 'Startup Teams',
    description: 'Monitor student startup teams, review team formations, inspect milestones, and evaluate progress reports.',
    iconKey: 'teams',
    keywords: ['squads', 'founders', 'milestones', 'progress reports'],
  },
  {
    id: 'tasks',
    category: 'core_operations',
    name: 'Tasks & Deadlines',
    shortName: 'Tasks & Deadlines',
    description: 'Assign engineering sprint deliverables, track deadlines, review task submissions, and flag overdue items.',
    iconKey: 'tasks',
    keywords: ['deadlines', 'sprints', 'deliverables', 'overdue'],
  },
  {
    id: 'activities',
    category: 'core_operations',
    name: 'Activity Monitor',
    shortName: 'Activity Monitor',
    description: 'Track real-time member sign-ins, team interactions, task updates, and platform engagement logs.',
    iconKey: 'activities',
    keywords: ['monitor', 'engagement', 'telemetry', 'live feed', 'logins'],
  },

  // B. INNOVATION & STARTUPS (5 modules)
  {
    id: 'ideas',
    category: 'innovation_startups',
    name: 'Startup Ideas',
    shortName: 'Startup Ideas',
    description: 'Inspect student startup proposals, review AI-assisted flags, provide technical feedback, and control public listing.',
    iconKey: 'ideas',
    keywords: ['proposals', 'ventures', 'pitch', 'review', 'ai assisted'],
  },
  {
    id: 'problem_exchange',
    category: 'innovation_startups',
    name: 'Problem Exchange Management',
    shortName: 'Problem Exchange',
    description: 'Curate 1,000+ real-world problems, adjust 6-criterion Opportunity Scores, manage Top 10, solver requests, and reports.',
    iconKey: 'problem_exchange',
    keywords: ['problems', 'opportunity score', 'top 10', 'solvers', 'csv', 'reports'],
  },
  {
    id: 'challenges',
    category: 'innovation_startups',
    name: 'Challenge Management',
    shortName: 'Challenges',
    description: 'Create and publish engineering challenges, inspect registrations, score submissions, and award winners.',
    iconKey: 'challenges',
    keywords: ['competitions', 'sprints', 'hackathons', 'submissions', 'winners'],
  },
  {
    id: 'projects',
    category: 'innovation_startups',
    name: 'Projects Management',
    shortName: 'Projects',
    description: 'Create engineering project workspaces, assign Project Leads, update project statuses, and manage deliverables.',
    iconKey: 'projects',
    keywords: ['workspaces', 'hardware', 'software', 'builds', 'leads'],
  },
  {
    id: 'skills',
    category: 'innovation_startups',
    name: 'Startup Lab Management',
    shortName: 'Startup Lab',
    description: 'Moderate Startup Lab custom technical and non-technical skills, merge taxonomy entries, and govern builder tags.',
    iconKey: 'skills',
    keywords: ['startup lab', 'custom skills', 'taxonomy', 'tags', 'moderation'],
  },

  // C. PLATFORM & COMMUNITY (4 modules)
  {
    id: 'events',
    category: 'platform_community',
    name: 'Events Management',
    shortName: 'Events',
    description: 'Schedule workshops, buildathons, and seminars, manage seat capacities, and track attendee registrations.',
    iconKey: 'events',
    keywords: ['buildathons', 'workshops', 'seminars', 'registrations', 'calendar'],
  },
  {
    id: 'opportunities',
    category: 'platform_community',
    name: 'Opportunities Management',
    shortName: 'Opportunities',
    description: 'Publish prototyping grants, internships, mentorships, and lab access openings and process member applications.',
    iconKey: 'opportunities',
    keywords: ['grants', 'internships', 'lab access', 'fellowships', 'funding'],
  },
  {
    id: 'support',
    category: 'platform_community',
    name: 'Support & Help Requests',
    shortName: 'Support & Help',
    description: 'Respond to fellowship, startup project, technical issue, and general enquiry tickets submitted via Need Help.',
    iconKey: 'support',
    keywords: ['help desk', 'tickets', 'issues', 'enquiries', 'support'],
  },
  {
    id: 'certificates',
    category: 'platform_community',
    name: 'Verify Certificate Management',
    shortName: 'Certificates',
    description: 'Issue verifiable ESC completion certificates, customize certificate templates, verify IDs, and manage revocations.',
    iconKey: 'certificates',
    keywords: ['verify cert', 'credentials', 'studio', 'issue', 'revoke'],
  },
  {
    id: 'card_orders',
    category: 'platform_community',
    name: 'Physical Member Card Orders',
    shortName: 'Card Orders',
    description: 'Verify ₹151 UPI payments, export print-ready ESC Member Cards, manage courier dispatches, and track pan-India deliveries.',
    iconKey: 'card_orders',
    keywords: ['physical card', 'member card', 'upi', 'delivery', 'courier', 'tracking', 'utr', '151'],
  },

  // D. ADMINISTRATION (4 modules)
  {
    id: 'notifications',
    category: 'administration',
    name: 'Notifications',
    shortName: 'Notifications',
    description: 'Review incoming admin alerts, jump directly to pending reviews, and manage pinned top-bar site announcements.',
    iconKey: 'notifications',
    keywords: ['alerts', 'announcements', 'broadcasts', 'banners', 'inbox'],
  },
  {
    id: 'analytics_reports',
    category: 'administration',
    name: 'Analytics & Reports',
    shortName: 'Analytics & Reports',
    description: 'Inspect platform growth charts, approval rates, registration trends, and export live database snapshots to CSV.',
    iconKey: 'analytics_reports',
    keywords: ['charts', 'exports', 'csv', 'growth', 'statistics', 'reports'],
  },
  {
    id: 'settings',
    category: 'administration',
    name: 'Admin Settings',
    shortName: 'Admin Settings',
    description: 'Configure global site taglines, fellowship cycle status, official contact email, WhatsApp invite, and guidelines.',
    iconKey: 'settings',
    keywords: ['configuration', 'whatsapp', 'guidelines', 'cycle', 'super admin'],
    superAdminOnlyNote: 'Super Admin editable',
  },
  {
    id: 'logs',
    category: 'administration',
    name: 'Audit Logs',
    shortName: 'Audit Logs',
    description: 'Inspect the immutable record of administrative approvals, edits, certificate issuances, and configuration changes.',
    iconKey: 'logs',
    keywords: ['audit trail', 'history', 'security', 'compliance'],
  },
];

const VALID_TABS = new Set<AdminTab>(['hub', ...ADMIN_MODULES.map((m) => m.id)]);

const TAB_ALIASES: Record<string, AdminTab> = {
  dashboard: 'hub',
  modules: 'hub',
  analytics: 'overview',
  reports: 'analytics_reports',
  content: 'notifications',
  alerts: 'notifications',
  members: 'users',
  support_requests: 'support',
  problems: 'problem_exchange',
  startup_lab: 'skills',
  physical_cards: 'card_orders',
  member_cards: 'card_orders',
};

export function normalizeAdminTab(raw?: string | null): AdminTab {
  if (!raw) return 'hub';
  const cleaned = raw.trim().toLowerCase();
  if (VALID_TABS.has(cleaned as AdminTab)) {
    return cleaned as AdminTab;
  }
  if (cleaned in TAB_ALIASES) {
    return TAB_ALIASES[cleaned];
  }
  return 'hub';
}

export function parseAdminTabFromHash(hash: string): AdminTab {
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return 'hub';
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return normalizeAdminTab(params.get('module') || params.get('tab'));
}

export function buildAdminModuleHash(tab: AdminTab): string {
  if (tab === 'hub') return '/admin';
  return `/admin?module=${encodeURIComponent(tab)}`;
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}

export function buildAdminModuleCards(counts: AdminLiveCounts): AdminModuleCardModel[] {
  return ADMIN_MODULES.map((mod) => {
    let metricValue = '—';
    let metricLabel = 'Live records';
    let pendingCount = 0;
    let pendingLabel: string | undefined;

    switch (mod.id) {
      case 'overview':
        metricValue = formatCount(counts.totalMembers + counts.totalTeams + counts.totalProjects);
        metricLabel = 'Tracked entities';
        pendingCount = counts.pendingApplications + counts.teamsUnderReview + counts.overdueTasks;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Need Attention` : undefined;
        break;
      case 'users':
        metricValue = formatCount(counts.totalMembers);
        metricLabel = 'Registered members';
        pendingCount = counts.membersUnderReview;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Under Review` : undefined;
        break;
      case 'applications':
        metricValue = formatCount(counts.totalApplications);
        metricLabel = 'Total applications';
        pendingCount = counts.pendingApplications;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Pending` : undefined;
        break;
      case 'teams':
        metricValue = formatCount(counts.totalTeams);
        metricLabel = 'Startup teams';
        pendingCount = counts.teamsUnderReview;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Under Review` : undefined;
        break;
      case 'tasks':
        metricValue = formatCount(counts.totalTasks);
        metricLabel = 'Assigned tasks';
        pendingCount = counts.overdueTasks;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Overdue` : undefined;
        break;
      case 'activities':
        metricValue = formatCount(counts.totalActivities);
        metricLabel = 'Logged activities';
        break;
      case 'ideas':
        metricValue = formatCount(counts.totalIdeas);
        metricLabel = 'Startup proposals';
        pendingCount = counts.pendingIdeas;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Pending Review` : undefined;
        break;
      case 'problem_exchange': {
        metricValue = formatCount(counts.publishedProblems);
        metricLabel = 'Published problems';
        const pxPending =
          counts.pendingProblems + counts.pendingSolverInterests + counts.openProblemReports;
        pendingCount = pxPending;
        pendingLabel = pxPending > 0 ? `${pxPending} Action Items` : undefined;
        break;
      }
      case 'challenges':
        metricValue = formatCount(counts.totalChallenges);
        metricLabel =
          counts.totalChallengeSubmissions > 0
            ? `Challenges · ${counts.totalChallengeSubmissions} submissions`
            : 'Engineering challenges';
        break;
      case 'projects':
        metricValue = formatCount(counts.totalProjects);
        metricLabel =
          counts.activeProjects > 0
            ? `Workspaces · ${counts.activeProjects} active`
            : 'Project workspaces';
        break;
      case 'skills':
        metricValue = formatCount(counts.totalCustomSkills);
        metricLabel = 'Custom skills tracked';
        pendingCount = counts.pendingCustomSkills;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Pending` : undefined;
        break;
      case 'events':
        metricValue = formatCount(counts.totalEvents);
        metricLabel =
          counts.publishedEvents > 0
            ? `Events · ${counts.publishedEvents} published`
            : 'Scheduled events';
        break;
      case 'opportunities':
        metricValue = formatCount(counts.totalOpportunities);
        metricLabel =
          counts.totalOpportunityApplications > 0
            ? `Listings · ${counts.totalOpportunityApplications} applicants`
            : 'Active opportunities';
        break;
      case 'support':
        metricValue = formatCount(counts.totalSupportTickets);
        metricLabel = 'Support tickets';
        pendingCount = counts.openSupportTickets;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Open` : undefined;
        break;
      case 'certificates':
        metricValue = formatCount(counts.totalCertificates);
        metricLabel =
          counts.validCertificates > 0
            ? `Issued · ${counts.validCertificates} valid`
            : 'Issued certificates';
        break;
      case 'card_orders':
        metricValue = formatCount(counts.totalCardOrders);
        metricLabel = 'Physical card orders';
        pendingCount = counts.pendingCardOrders;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Pending Verify` : undefined;
        break;
      case 'notifications':
        metricValue = formatCount(counts.totalNotifications + counts.totalAnnouncements);
        metricLabel = `${counts.totalNotifications} alerts · ${counts.totalAnnouncements} announcements`;
        pendingCount = counts.unreadNotifications;
        pendingLabel = pendingCount > 0 ? `${pendingCount} Unread` : undefined;
        break;
      case 'analytics_reports':
        metricValue = '3 CSV';
        metricLabel = 'Live charts & exports';
        break;
      case 'settings':
        metricValue = counts.applicationsOpen ? 'Open' : 'Closed';
        metricLabel = 'Fellowship intake status';
        break;
      case 'logs':
        metricValue = formatCount(counts.totalLogs);
        metricLabel = 'Audit trail entries';
        break;
    }

    return {
      ...mod,
      metricValue,
      metricLabel,
      pendingCount,
      pendingLabel,
    };
  });
}

export function filterAdminModules(
  cards: AdminModuleCardModel[],
  query: string,
  categoryFilter: 'all' | AdminCategoryId = 'all'
): AdminModuleCardModel[] {
  const q = query.trim().toLowerCase();
  return cards.filter((card) => {
    if (categoryFilter !== 'all' && card.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      card.name.toLowerCase().includes(q) ||
      card.shortName.toLowerCase().includes(q) ||
      card.description.toLowerCase().includes(q) ||
      card.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });
}

export function getAdminModuleById(id: AdminTab): AdminModuleDef | null {
  if (id === 'hub') return null;
  return ADMIN_MODULES.find((m) => m.id === id) || null;
}

export function getAdminCategoryById(id: AdminCategoryId): AdminCategoryDef | null {
  return ADMIN_CATEGORIES.find((c) => c.id === id) || null;
}
