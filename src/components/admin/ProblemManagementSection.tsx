import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Flag,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  Users,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { apiRequest } from '../../lib/apiClient';
import {
  OPPORTUNITY_SCORE_CRITERIA_META,
  PROBLEM_EXCHANGE_CATEGORIES,
  computeOpportunityScore,
  getDifficultyLabel,
  getPublicationStatusLabel,
  getValidationStatusLabel,
} from '../../utils/problemExchangeLogic';
import type {
  ExchangePaginatedResponse,
  ExchangeProblem,
  ExchangeProblemDifficulty,
  ExchangeProblemReport,
  ExchangePublicationStatus,
  ExchangeSolverInterest,
  ExchangeValidationStatus,
  OpportunityScoreCriteria,
} from '../../types';

interface AdminStats {
  total: number;
  published: number;
  pendingReview: number;
  rejected: number;
  archived: number;
  researchNeeded: number;
  underValidation: number;
  validated: number;
  featured: number;
  topTen: number;
  solverInterestsTotal: number;
  solverInterestsPending: number;
  reportsTotal: number;
  reportsOpen: number;
}

interface ProblemManagementSectionProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
  navigate?: (path: string) => void;
}

type AdminSubTab = 'problems' | 'solvers' | 'reports';

const DEFAULT_CRITERIA: OpportunityScoreCriteria = {
  severity: 76,
  peopleAffected: 74,
  frequency: 72,
  urgency: 70,
  potentialImpact: 78,
  feasibility: 72,
};

export const ProblemManagementSection: React.FC<ProblemManagementSectionProps> = ({
  onNotify,
  navigate,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('problems');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Problems list state
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pubFilter, setPubFilter] = useState('all');
  const [valFilter, setValFilter] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [topTenOnly, setTopTenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [problemsRes, setProblemsRes] = useState<ExchangePaginatedResponse | null>(null);
  const [loadingProblems, setLoadingProblems] = useState(true);

  // Solvers & Reports state
  const [solverFilter, setSolverFilter] = useState('all');
  const [solvers, setSolvers] = useState<ExchangeSolverInterest[]>([]);
  const [loadingSolvers, setLoadingSolvers] = useState(false);
  const [solverNoteDrafts, setSolverNoteDrafts] = useState<Record<string, string>>({});

  const [reportFilter, setReportFilter] = useState('all');
  const [reports, setReports] = useState<ExchangeProblemReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportNoteDrafts, setReportNoteDrafts] = useState<Record<string, string>>({});

  // Create/Edit Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ExchangeProblem | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<string>(PROBLEM_EXCHANGE_CATEGORIES[0]);
  const [formIndustry, setFormIndustry] = useState('');
  const [formLocation, setFormLocation] = useState('Pan-India');
  const [formDifficulty, setFormDifficulty] = useState<ExchangeProblemDifficulty>('intermediate');
  const [formAffectedUsers, setFormAffectedUsers] = useState('');
  const [formRealWorldContext, setFormRealWorldContext] = useState('');
  const [formCurrentChallenges, setFormCurrentChallenges] = useState('');
  const [formCurrentWorkarounds, setFormCurrentWorkarounds] = useState('');
  const [formWhyItMatters, setFormWhyItMatters] = useState('');
  const [formPotentialImpact, setFormPotentialImpact] = useState('');
  const [formDevOpportunities, setFormDevOpportunities] = useState('');
  const [formSkillsText, setFormSkillsText] = useState('');
  const [formQuestionsText, setFormQuestionsText] = useState('');
  const [formLinksText, setFormLinksText] = useState('');
  const [formCriteria, setFormCriteria] = useState<OpportunityScoreCriteria>(DEFAULT_CRITERIA);
  const [formPubStatus, setFormPubStatus] = useState<ExchangePublicationStatus>('published');
  const [formValStatus, setFormValStatus] = useState<ExchangeValidationStatus>('research_needed');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formTopTenRank, setFormTopTenRank] = useState<string>('');
  const [formAdminNotes, setFormAdminNotes] = useState('');

  // Inline Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<ExchangeProblem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPublishNow, setCsvPublishNow] = useState(true);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvReport, setCsvReport] = useState<{
    importedCount: number;
    skippedCount: number;
    skipped: { row: number; reason: string }[];
  } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest<AdminStats>('/api/admin/problem-exchange/stats', {
        requireAuth: true,
      });
      setStats(data);
    } catch (err) {
      console.error('Failed to load Problem Exchange stats:', err);
    }
  }, []);

  const loadProblems = useCallback(async () => {
    try {
      setLoadingProblems(true);
      const params = new URLSearchParams();
      if (searchQ.trim()) params.set('q', searchQ.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      params.set('publicationStatus', pubFilter);
      params.set('validationStatus', valFilter);
      if (featuredOnly) params.set('featured', '1');
      if (topTenOnly) params.set('topTen', '1');
      params.set('page', String(page));
      params.set('pageSize', '20');

      const data = await apiRequest<ExchangePaginatedResponse>(
        `/api/admin/problem-exchange/problems?${params.toString()}`,
        { requireAuth: true }
      );
      setProblemsRes(data);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to load Problem Exchange list.');
    } finally {
      setLoadingProblems(false);
    }
  }, [searchQ, categoryFilter, pubFilter, valFilter, featuredOnly, topTenOnly, page, onNotify]);

  const loadSolvers = useCallback(async () => {
    try {
      setLoadingSolvers(true);
      const query = solverFilter !== 'all' ? `?status=${encodeURIComponent(solverFilter)}` : '';
      const data = await apiRequest<ExchangeSolverInterest[]>(
        `/api/admin/problem-exchange/solver-interests${query}`,
        { requireAuth: true }
      );
      setSolvers(data || []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to load solver interest applications.');
    } finally {
      setLoadingSolvers(false);
    }
  }, [solverFilter, onNotify]);

  const loadReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const query = reportFilter !== 'all' ? `?status=${encodeURIComponent(reportFilter)}` : '';
      const data = await apiRequest<ExchangeProblemReport[]>(
        `/api/admin/problem-exchange/reports${query}`,
        { requireAuth: true }
      );
      setReports(data || []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to load problem reports.');
    } finally {
      setLoadingReports(false);
    }
  }, [reportFilter, onNotify]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (subTab === 'problems') loadProblems();
    if (subTab === 'solvers') loadSolvers();
    if (subTab === 'reports') loadReports();
  }, [subTab, loadProblems, loadSolvers, loadReports]);

  const openCreateModal = () => {
    setEditingProblem(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory(PROBLEM_EXCHANGE_CATEGORIES[0]);
    setFormIndustry('');
    setFormLocation('Pan-India');
    setFormDifficulty('intermediate');
    setFormAffectedUsers('');
    setFormRealWorldContext('');
    setFormCurrentChallenges('');
    setFormCurrentWorkarounds('');
    setFormWhyItMatters('');
    setFormPotentialImpact('');
    setFormDevOpportunities('');
    setFormSkillsText('');
    setFormQuestionsText('');
    setFormLinksText('');
    setFormCriteria(DEFAULT_CRITERIA);
    setFormPubStatus('published');
    setFormValStatus('research_needed');
    setFormFeatured(false);
    setFormTopTenRank('');
    setFormAdminNotes('');
    setEditorOpen(true);
  };

  const openEditModal = (prob: ExchangeProblem) => {
    setEditingProblem(prob);
    setFormTitle(prob.title);
    setFormDesc(prob.description);
    setFormCategory(prob.category);
    setFormIndustry(prob.industry);
    setFormLocation(prob.location);
    setFormDifficulty(prob.difficulty);
    setFormAffectedUsers(prob.affectedUsers || '');
    setFormRealWorldContext(prob.realWorldContext || '');
    setFormCurrentChallenges(prob.currentChallenges || '');
    setFormCurrentWorkarounds(prob.currentWorkarounds || '');
    setFormWhyItMatters(prob.whyItMatters || '');
    setFormPotentialImpact(prob.potentialImpact || '');
    setFormDevOpportunities(prob.developmentOpportunities || '');
    setFormSkillsText((prob.skillsRequired || []).join(', '));
    setFormQuestionsText((prob.suggestedResearchQuestions || []).join('\n'));
    setFormLinksText((prob.evidenceLinks || []).join('\n'));
    setFormCriteria(prob.scoreCriteria || DEFAULT_CRITERIA);
    setFormPubStatus(prob.publicationStatus);
    setFormValStatus(prob.validationStatus);
    setFormFeatured(prob.isFeatured);
    setFormTopTenRank(prob.topTenRank ? String(prob.topTenRank) : '');
    setFormAdminNotes(prob.adminNotes || '');
    setEditorOpen(true);
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim()) {
      onNotify('error', 'Title and description are required.');
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      category: formCategory,
      industry: formIndustry.trim() || formCategory,
      location: formLocation.trim() || 'Pan-India',
      difficulty: formDifficulty,
      affectedUsers: formAffectedUsers.trim(),
      realWorldContext: formRealWorldContext.trim(),
      currentChallenges: formCurrentChallenges.trim(),
      currentWorkarounds: formCurrentWorkarounds.trim(),
      whyItMatters: formWhyItMatters.trim(),
      potentialImpact: formPotentialImpact.trim(),
      developmentOpportunities: formDevOpportunities.trim(),
      skillsRequired: formSkillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      suggestedResearchQuestions: formQuestionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      evidenceLinks: formLinksText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      scoreCriteria: formCriteria,
      publicationStatus: formPubStatus,
      validationStatus: formValStatus,
      isFeatured: formFeatured,
      topTenRank: formTopTenRank ? Number(formTopTenRank) : null,
      adminNotes: formAdminNotes.trim(),
    };

    try {
      setSavingEditor(true);
      if (editingProblem) {
        await apiRequest(`/api/admin/problem-exchange/problems/${editingProblem.id}`, {
          method: 'PATCH',
          requireAuth: true,
          body: payload,
        });
        onNotify('success', `Updated ${editingProblem.problemCode} successfully.`);
      } else {
        const created = await apiRequest<ExchangeProblem>('/api/admin/problem-exchange/problems', {
          method: 'POST',
          requireAuth: true,
          body: payload,
        });
        onNotify('success', `Created ${created.problemCode} successfully.`);
      }
      setEditorOpen(false);
      loadProblems();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save problem.');
    } finally {
      setSavingEditor(false);
    }
  };

  const handleQuickPatch = async (
    prob: ExchangeProblem,
    patch: Record<string, any>,
    successMsg: string
  ) => {
    try {
      await apiRequest(`/api/admin/problem-exchange/problems/${prob.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: patch,
      });
      onNotify('success', successMsg);
      loadProblems();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update problem.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiRequest(`/api/admin/problem-exchange/problems/${deleteTarget.id}`, {
        method: 'DELETE',
        requireAuth: true,
      });
      onNotify('success', `Deleted ${deleteTarget.problemCode}.`);
      setDeleteTarget(null);
      loadProblems();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete problem.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReviewSolver = async (
    interest: ExchangeSolverInterest,
    status: 'under_review' | 'approved_for_team_formation' | 'declined'
  ) => {
    try {
      const notes = solverNoteDrafts[interest.id] ?? interest.adminNotes ?? '';
      await apiRequest(`/api/admin/problem-exchange/solver-interests/${interest.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: { status, adminNotes: notes },
      });
      onNotify('success', `Updated solver interest for ${interest.userName} → ${status.replace(/_/g, ' ')}.`);
      loadSolvers();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to review solver interest.');
    }
  };

  const handleReviewReport = async (
    report: ExchangeProblemReport,
    status: 'reviewing' | 'resolved' | 'dismissed'
  ) => {
    try {
      const notes = reportNoteDrafts[report.id] ?? report.adminNotes ?? '';
      await apiRequest(`/api/admin/problem-exchange/reports/${report.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: { status, adminNotes: notes },
      });
      onNotify('success', `Marked report on ${report.problemTitle} as ${status}.`);
      loadReports();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update report.');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCsvText(reader.result);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      onNotify('error', 'Upload or paste CSV content first.');
      return;
    }
    try {
      setImportingCsv(true);
      const res = await apiRequest<{
        importedCount: number;
        skippedCount: number;
        skipped: { row: number; reason: string }[];
      }>('/api/admin/problem-exchange/import-csv', {
        method: 'POST',
        requireAuth: true,
        body: { csvText, publishImmediately: csvPublishNow },
      });
      setCsvReport(res);
      onNotify(
        'success',
        `Imported ${res.importedCount} problems (${res.skippedCount} skipped).`
      );
      loadProblems();
      loadStats();
    } catch (err: any) {
      onNotify('error', err?.message || 'CSV import failed.');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication required for CSV export.');
      const res = await fetch(
        `/api/admin/problem-exchange/export-csv?publicationStatus=${encodeURIComponent(pubFilter)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esc_problem_exchange_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('success', 'Exported Problem Exchange CSV.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const liveScorePreview = computeOpportunityScore(formCriteria);

  return (
    <div className="space-y-6">
      {/* Header & Top Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-[#39FF14]">
            ESC Problem Exchange Administration
          </span>
          <h2 className="font-display text-2xl font-extrabold text-white">
            Problem Exchange Control Desk
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Problem
          </button>
          <button
            type="button"
            onClick={() => {
              setCsvReport(null);
              setCsvModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-3.5 py-2 font-mono text-xs text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-3.5 py-2 font-mono text-xs text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> {exportingCsv ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => {
              loadStats();
              if (subTab === 'problems') loadProblems();
              if (subTab === 'solvers') loadSolvers();
              if (subTab === 'reports') loadReports();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-3 py-2 font-mono text-xs text-zinc-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Live KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Published', value: stats.published, accent: 'text-[#39FF14]' },
            { label: 'Pending Review', value: stats.pendingReview, accent: 'text-amber-300' },
            { label: 'Validated', value: stats.validated, accent: 'text-emerald-300' },
            { label: 'Under Validation', value: stats.underValidation, accent: 'text-sky-300' },
            { label: 'Featured', value: stats.featured ?? 0, accent: 'text-[#CCFF00]' },
            { label: 'Top 10 Ranked', value: stats.topTen ?? 0, accent: 'text-white' },
            { label: 'Pending Solvers', value: stats.solverInterestsPending ?? 0, accent: 'text-purple-300' },
            { label: 'Open Reports', value: stats.reportsOpen ?? 0, accent: 'text-red-300' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-[#232731] bg-[#111317] p-3.5 space-y-1"
            >
              <span className="block font-mono text-[10px] uppercase text-zinc-400 truncate">
                {kpi.label}
              </span>
              <span className={`font-display text-2xl font-extrabold ${kpi.accent}`}>
                {(kpi.value ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1f232c] pb-3">
        <button
          type="button"
          onClick={() => setSubTab('problems')}
          className={`rounded-xl px-4 py-2 font-mono text-xs font-semibold cursor-pointer ${
            subTab === 'problems'
              ? 'bg-[#39FF14] text-black font-bold'
              : 'border border-[#272c38] bg-[#141720] text-zinc-300 hover:text-white'
          }`}
        >
          Problems Database ({stats?.total?.toLocaleString() ?? '…'})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('solvers')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-semibold cursor-pointer ${
            subTab === 'solvers'
              ? 'bg-[#39FF14] text-black font-bold'
              : 'border border-[#272c38] bg-[#141720] text-zinc-300 hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Solver Interests ({stats?.solverInterestsPending ?? 0} pending)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('reports')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-semibold cursor-pointer ${
            subTab === 'reports'
              ? 'bg-[#39FF14] text-black font-bold'
              : 'border border-[#272c38] bg-[#141720] text-zinc-300 hover:text-white'
          }`}
        >
          <Flag className="h-3.5 w-3.5" /> Reports & Duplicates ({stats?.reportsOpen ?? 0} open)
        </button>
      </div>

      {/* SUB-TAB 1: PROBLEMS DATABASE */}
      {subTab === 'problems' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 rounded-2xl border border-[#232731] bg-[#111317] p-4">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search code, title, industry..."
                className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] pl-9 pr-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
              />
            </div>

            <select
              value={pubFilter}
              onChange={(e) => {
                setPubFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by publication status"
              className="rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
            >
              <option value="all">All Pub Statuses</option>
              <option value="published">Published</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={valFilter}
              onChange={(e) => {
                setValFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by validation status"
              className="rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
            >
              <option value="all">All Validation Stages</option>
              <option value="research_needed">Research Needed</option>
              <option value="under_validation">Under Validation</option>
              <option value="validated">Validated</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
            >
              <option value="">All 40 Categories</option>
              {PROBLEM_EXCHANGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeaturedOnly((v) => !v);
                  setPage(1);
                }}
                className={`flex-1 rounded-xl border px-2.5 py-2 font-mono text-[11px] cursor-pointer ${
                  featuredOnly
                    ? 'border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]'
                    : 'border-[#2a2f3c] bg-[#151822] text-zinc-400'
                }`}
              >
                Featured
              </button>
              <button
                type="button"
                onClick={() => {
                  setTopTenOnly((v) => !v);
                  setPage(1);
                }}
                className={`flex-1 rounded-xl border px-2.5 py-2 font-mono text-[11px] cursor-pointer ${
                  topTenOnly
                    ? 'border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]'
                    : 'border-[#2a2f3c] bg-[#151822] text-zinc-400'
                }`}
              >
                Top 10
              </button>
            </div>
          </div>

          {/* Problems Table */}
          <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
            {loadingProblems ? (
              <div className="p-12 text-center font-mono text-xs text-zinc-400">
                Loading Problem Exchange records...
              </div>
            ) : !problemsRes || problemsRes.items.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400">
                No problems match the selected filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#1f232c] bg-[#161922] font-mono text-[10px] uppercase text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Code / Rank</th>
                    <th className="px-4 py-3">Title & Category</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Validation</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c202a]">
                  {problemsRes.items.map((prob) => (
                    <tr key={prob.id} className="hover:bg-[#141720]">
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        <span className="font-bold text-[#39FF14] block">{prob.problemCode}</span>
                        {prob.topTenRank && (
                          <span className="inline-block mt-1 rounded bg-[#39FF14] px-1.5 py-0.5 text-[10px] font-extrabold text-black">
                            TOP #{prob.topTenRank}
                          </span>
                        )}
                        {prob.isFeatured && !prob.topTenRank && (
                          <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-[#CCFF00]">
                            <Star className="h-2.5 w-2.5" /> Featured
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="font-display font-bold text-white line-clamp-1">
                          {prob.title}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-400 mt-0.5">
                          {prob.category} • {prob.industry} • {getDifficultyLabel(prob.difficulty)}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-display text-base font-extrabold text-[#39FF14]">
                        {prob.opportunityScore}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
                            prob.publicationStatus === 'published'
                              ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
                              : prob.publicationStatus === 'pending_review'
                              ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                              : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                          }`}
                        >
                          {getPublicationStatusLabel(prob.publicationStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-zinc-300">
                        {getValidationStatusLabel(prob.validationStatus)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {prob.publicationStatus !== 'published' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPatch(
                                  prob,
                                  { publicationStatus: 'published' },
                                  `Approved & published ${prob.problemCode}.`
                                )
                              }
                              className="rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/40 px-2.5 py-1 font-mono text-[10px] font-bold text-[#39FF14] hover:bg-[#39FF14] hover:text-black cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {navigate && prob.publicationStatus === 'published' && (
                            <button
                              type="button"
                              onClick={() => navigate(`/problem-exchange/${prob.id}`)}
                              aria-label={`View ${prob.problemCode}`}
                              className="rounded-lg border border-[#2a2f3c] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(prob)}
                            aria-label={`Edit ${prob.problemCode}`}
                            className="rounded-lg border border-[#2a2f3c] p-1.5 text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(prob)}
                            aria-label={`Delete ${prob.problemCode}`}
                            className="rounded-lg border border-red-900/50 p-1.5 text-red-400 hover:bg-red-950/50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {problemsRes && problemsRes.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>
                Page {problemsRes.page} of {problemsRes.totalPages} ({problemsRes.total.toLocaleString()} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2a2f3c] bg-[#141720] px-3 py-1.5 text-zinc-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  type="button"
                  disabled={page >= problemsRes.totalPages}
                  onClick={() => setPage((p) => Math.min(problemsRes.totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2a2f3c] bg-[#141720] px-3 py-1.5 text-zinc-200 disabled:opacity-40 cursor-pointer"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SOLVER INTERESTS REVIEW */}
      {subTab === 'solvers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Review students who clicked &quot;I Want to Solve This&quot;. Approving unlocks team formation guidance — no team is auto-approved without Admin review.
            </p>
            <select
              value={solverFilter}
              onChange={(e) => setSolverFilter(e.target.value)}
              className="rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="approved_for_team_formation">Approved for Team Formation</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          {loadingSolvers ? (
            <div className="p-10 text-center font-mono text-xs text-zinc-400">
              Loading solver applications...
            </div>
          ) : solvers.length === 0 ? (
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center text-xs text-zinc-400">
              No solver interest submissions found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {solvers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-display text-sm font-bold text-white">
                        {s.userName}{' '}
                        <span className="font-mono text-xs font-normal text-zinc-400">
                          ({s.userEmail})
                        </span>
                      </span>
                      <p className="font-mono text-xs text-[#39FF14] mt-0.5">{s.problemTitle}</p>
                    </div>
                    <span className="rounded border border-[#2d3340] bg-[#161922] px-2.5 py-1 font-mono text-[10px] uppercase text-amber-300">
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{s.proposedApproach}</p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
                    <span>Mode: {s.teamPreference.replace(/_/g, ' ')}</span>
                    {s.neededRoles && <span>• Needs: {s.neededRoles}</span>}
                    {s.skillsOffered.map((sk) => (
                      <span
                        key={sk}
                        className="rounded border border-[#272c37] bg-[#0e1015] px-2 py-0.5 text-zinc-300"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#1e222b]">
                    <input
                      type="text"
                      value={solverNoteDrafts[s.id] ?? s.adminNotes ?? ''}
                      onChange={(e) =>
                        setSolverNoteDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="Optional admin feedback / next step..."
                      className="flex-1 rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-1.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleReviewSolver(s, 'under_review')}
                        className="rounded-lg border border-sky-600/40 bg-sky-950/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-sky-300 cursor-pointer"
                      >
                        Under Review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewSolver(s, 'approved_for_team_formation')}
                        className="rounded-lg bg-[#39FF14] px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase text-black cursor-pointer"
                      >
                        Approve for Team
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewSolver(s, 'declined')}
                        className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-red-300 cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: REPORTS & DUPLICATES */}
      {subTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Moderate community flags for duplicate entries, inaccuracies, or spam.
            </p>
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              className="rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
            >
              <option value="all">All Reports</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {loadingReports ? (
            <div className="p-10 text-center font-mono text-xs text-zinc-400">
              Loading problem reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center text-xs text-zinc-400">
              No problem reports match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="rounded bg-red-950/60 border border-red-800/50 px-2 py-0.5 font-mono text-[10px] uppercase text-red-300">
                        {rep.reason}
                      </span>
                      <span className="ml-2 font-display text-sm font-bold text-white">
                        {rep.problemTitle}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] uppercase text-zinc-400">
                      Status: <strong className="text-white">{rep.status}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300">{rep.details}</p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    Reported by {rep.reporterName}
                    {rep.reporterEmail ? ` (${rep.reporterEmail})` : ''}
                    {rep.duplicateOfId ? ` • Duplicate of ${rep.duplicateOfId}` : ''}
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#1e222b]">
                    <input
                      type="text"
                      value={reportNoteDrafts[rep.id] ?? rep.adminNotes ?? ''}
                      onChange={(e) =>
                        setReportNoteDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                      }
                      placeholder="Resolution note..."
                      className="flex-1 rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-1.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleReviewReport(rep, 'reviewing')}
                        className="rounded-lg border border-sky-600/40 bg-sky-950/40 px-3 py-1.5 font-mono text-[10px] uppercase text-sky-300 cursor-pointer"
                      >
                        Reviewing
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewReport(rep, 'resolved')}
                        className="rounded-lg bg-[#39FF14] px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase text-black cursor-pointer"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewReport(rep, 'dismissed')}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase text-zinc-400 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PROBLEM MODAL */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
        >
          <form
            onSubmit={handleSaveProblem}
            className="relative my-8 w-full max-w-4xl rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 sm:p-8 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#1f232c] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                  {editingProblem ? `Editing ${editingProblem.problemCode}` : 'New Problem Entry'}
                </span>
                <h3 className="font-display text-xl font-extrabold text-white mt-0.5">
                  {editingProblem ? 'Edit Problem Exchange Record' : 'Create Problem Exchange Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-[#282d38] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-200 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3.5 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                >
                  {PROBLEM_EXCHANGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">Industry</label>
                <input
                  type="text"
                  value={formIndustry}
                  onChange={(e) => setFormIndustry(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">Location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">Difficulty</label>
                <select
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value as ExchangeProblemDifficulty)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="deep_tech">Deep Tech</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Affected Users
                </label>
                <textarea
                  rows={2}
                  value={formAffectedUsers}
                  onChange={(e) => setFormAffectedUsers(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Why It Matters
                </label>
                <textarea
                  rows={2}
                  value={formWhyItMatters}
                  onChange={(e) => setFormWhyItMatters(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Real-World Context
                </label>
                <textarea
                  rows={2}
                  value={formRealWorldContext}
                  onChange={(e) => setFormRealWorldContext(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Potential Impact
                </label>
                <textarea
                  rows={2}
                  value={formPotentialImpact}
                  onChange={(e) => setFormPotentialImpact(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Current Challenges
                </label>
                <textarea
                  rows={2}
                  value={formCurrentChallenges}
                  onChange={(e) => setFormCurrentChallenges(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Current Workarounds
                </label>
                <textarea
                  rows={2}
                  value={formCurrentWorkarounds}
                  onChange={(e) => setFormCurrentWorkarounds(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Skills Required (comma-separated)
                </label>
                <input
                  type="text"
                  value={formSkillsText}
                  onChange={(e) => setFormSkillsText(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Development Opportunities
                </label>
                <input
                  type="text"
                  value={formDevOpportunities}
                  onChange={(e) => setFormDevOpportunities(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Research Questions (one per line)
                </label>
                <textarea
                  rows={2}
                  value={formQuestionsText}
                  onChange={(e) => setFormQuestionsText(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Evidence Links (one URL per line)
                </label>
                <textarea
                  rows={2}
                  value={formLinksText}
                  onChange={(e) => setFormLinksText(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* 6-Criterion ESC Opportunity Score Sliders */}
            <div className="rounded-xl border border-[#39FF14]/35 bg-[#0e150e] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-[#39FF14]">
                  ESC Opportunity Score Criteria
                </span>
                <span className="font-display text-2xl font-black text-[#39FF14]">
                  {liveScorePreview} / 100
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {OPPORTUNITY_SCORE_CRITERIA_META.map((meta) => (
                  <div key={meta.key} className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-zinc-200">
                        {meta.label} ({meta.weightPercent}%)
                      </span>
                      <span className="text-[#39FF14] font-bold">{formCriteria[meta.key]}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={formCriteria[meta.key]}
                      onChange={(e) =>
                        setFormCriteria((prev) => ({
                          ...prev,
                          [meta.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#39FF14]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Governance, Status, Featured & Top 10 Rank */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#1e222b]">
              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Publication Status
                </label>
                <select
                  value={formPubStatus}
                  onChange={(e) => setFormPubStatus(e.target.value as ExchangePublicationStatus)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                >
                  <option value="published">Published</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Validation Status
                </label>
                <select
                  value={formValStatus}
                  onChange={(e) => setFormValStatus(e.target.value as ExchangeValidationStatus)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                >
                  <option value="research_needed">Research Needed</option>
                  <option value="under_validation">Under Validation</option>
                  <option value="validated">Validated</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Top 10 Rank Slot
                </label>
                <select
                  value={formTopTenRank}
                  onChange={(e) => setFormTopTenRank(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                >
                  <option value="">Not in Top 10</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <option key={r} value={String(r)}>
                      Rank #{String(r).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 pt-5 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formFeatured}
                  onChange={(e) => setFormFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[#39FF14]"
                />
                <span>Mark as Admin Featured</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-200 mb-1">Admin Notes</label>
              <input
                type="text"
                value={formAdminNotes}
                onChange={(e) => setFormAdminNotes(e.target.value)}
                placeholder="Internal or submitter-visible moderation note..."
                className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditor}
                className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
              >
                {savingEditor ? 'Saving...' : editingProblem ? 'Save Changes' : 'Create Problem'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INLINE DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-[#120f12] p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-display text-lg font-bold text-white">
                Delete {deleteTarget.problemCode}?
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              This permanently removes <strong>{deleteTarget.title}</strong> along with its bookmarks, solver applications, and reports. Consider setting status to Archived instead if you want to retain history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-600 px-5 py-2 font-display text-xs font-bold uppercase text-white cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {csvModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#1f232c] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                  Authorised Admin Bulk Import (Max 1,000 Rows)
                </span>
                <h3 className="font-display text-xl font-extrabold text-white mt-1">
                  Import Problems from CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="rounded-lg border border-[#282d38] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-400">
              <p>
                Required headers: <code className="text-[#39FF14]">Title</code>,{' '}
                <code className="text-[#39FF14]">Description</code>,{' '}
                <code className="text-[#39FF14]">Category</code>. Optional: Industry, Location,
                Difficulty, Affected Users, Why It Matters, Skills, Severity Score, People Affected
                Score, Frequency Score, Urgency Score, Potential Impact Score, Feasibility Score.
              </p>

              <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#363d4c] bg-[#141720] px-4 py-2.5 text-zinc-200 hover:border-[#39FF14] cursor-pointer">
                <Upload className="h-4 w-4 text-[#39FF14]" />
                <span>Choose CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="sr-only"
                />
              </label>

              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV rows here..."
                className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] p-3 font-mono text-[11px] text-white focus:border-[#39FF14] focus:outline-none"
              />

              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={csvPublishNow}
                  onChange={(e) => setCsvPublishNow(e.target.checked)}
                  className="h-4 w-4 accent-[#39FF14]"
                />
                <span>Publish imported problems immediately (otherwise queue as Pending Review)</span>
              </label>
            </div>

            {csvReport && (
              <div className="rounded-xl border border-[#39FF14]/40 bg-[#0f1a0d] p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#39FF14]">
                  <CheckCircle2 className="h-4 w-4" />
                  Imported {csvReport.importedCount} problems • Skipped {csvReport.skippedCount}
                </div>
                {csvReport.skipped.length > 0 && (
                  <ul className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-200">
                    {csvReport.skipped.slice(0, 12).map((s, idx) => (
                      <li key={idx}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={importingCsv}
                onClick={handleImportCsv}
                className="rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-extrabold uppercase text-black disabled:opacity-50 cursor-pointer"
              >
                {importingCsv ? 'Importing...' : 'Run Deduplicated Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
