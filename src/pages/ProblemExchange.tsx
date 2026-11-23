import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  MapPin,
  Play,
  PlusCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
  CheckCircle2,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/apiClient';
import {
  PROBLEM_EXCHANGE_CATEGORIES,
  getDifficultyLabel,
  getPublicationStatusLabel,
  getValidationStatusLabel,
} from '../utils/problemExchangeLogic';
import { ProblemExchangeIntro } from '../components/problemExchange/ProblemExchangeIntro';
import { ScratchRevealCard } from '../components/problemExchange/ScratchRevealCard';
import { TopTenCarousel } from '../components/problemExchange/TopTenCarousel';
import { SubmitProblemModal } from '../components/problemExchange/SubmitProblemModal';
import { ProblemDetailView } from '../components/problemExchange/ProblemDetailView';
import type {
  ExchangeOverviewResponse,
  ExchangePaginatedResponse,
  ExchangeProblem,
  ExchangeSolverInterest,
} from '../types';

interface ProblemExchangeProps {
  navigate: (path: string) => void;
  problemId?: string;
}

type DirectoryTab = 'all' | 'saved' | 'mine';

interface DirectoryFilters {
  q: string;
  category: string;
  industry: string;
  difficulty: string;
  impactLevel: string;
  skill: string;
  location: string;
  validationStatus: string;
  minScore: number;
  maxScore: number;
  sort: 'score_desc' | 'recent' | 'impact' | 'popular' | 'featured';
}

const DEFAULT_FILTERS: DirectoryFilters = {
  q: '',
  category: '',
  industry: '',
  difficulty: '',
  impactLevel: '',
  skill: '',
  location: '',
  validationStatus: '',
  minScore: 0,
  maxScore: 100,
  sort: 'score_desc',
};

export const ProblemExchange: React.FC<ProblemExchangeProps> = ({ navigate, problemId }) => {
  if (problemId) {
    return (
      <ProblemDetailView
        problemId={problemId}
        navigate={navigate}
        onBack={() => navigate('/problem-exchange?autostart=1')}
      />
    );
  }

  return <ProblemExchangeHub navigate={navigate} />;
};

const ProblemExchangeHub: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const { user, signInWithGoogle } = useAuth();

  const [replayIntro, setReplayIntro] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [overview, setOverview] = useState<ExchangeOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [activeTab, setActiveTab] = useState<DirectoryTab>('all');
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 18;

  const [directoryData, setDirectoryData] = useState<ExchangePaginatedResponse | null>(null);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // User workspace (saved, submitted, solver interests)
  const [myWorkspace, setMyWorkspace] = useState<{
    savedProblems: ExchangeProblem[];
    submittedProblems: ExchangeProblem[];
    solverInterests: ExchangeSolverInterest[];
  }>({
    savedProblems: [],
    submittedProblems: [],
    solverInterests: [],
  });
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [inlineToast, setInlineToast] = useState<string | null>(null);

  const directoryRef = useRef<HTMLDivElement | null>(null);

  const flashToast = (msg: string) => {
    setInlineToast(msg);
    window.setTimeout(() => setInlineToast(null), 3500);
  };

  // Debounce search text
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(filters.q.trim());
      setPage(1);
    }, 260);
    return () => window.clearTimeout(t);
  }, [filters.q]);

  // Load overview metrics, Top 10, Featured, 40-Category live counts & facets
  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      const data = await apiRequest<ExchangeOverviewResponse>('/api/problem-exchange/overview');
      setOverview(data);
    } catch (err) {
      console.error('Failed to load Problem Exchange overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Load paginated SQL directory whenever filters/page change
  const loadDirectory = useCallback(async () => {
    try {
      setLoadingDirectory(true);
      setDirectoryError(null);
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (filters.category) params.set('category', filters.category);
      if (filters.industry) params.set('industry', filters.industry);
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.impactLevel) params.set('impactLevel', filters.impactLevel);
      if (filters.skill) params.set('skill', filters.skill);
      if (filters.location) params.set('location', filters.location);
      if (filters.validationStatus) params.set('validationStatus', filters.validationStatus);
      if (filters.minScore > 0) params.set('minScore', String(filters.minScore));
      if (filters.maxScore < 100) params.set('maxScore', String(filters.maxScore));
      params.set('sort', filters.sort);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const res = await apiRequest<ExchangePaginatedResponse>(
        `/api/problem-exchange?${params.toString()}`
      );
      setDirectoryData(res);
    } catch (err: any) {
      setDirectoryError(err?.message || 'Failed to load problems.');
    } finally {
      setLoadingDirectory(false);
    }
  }, [
    debouncedQuery,
    filters.category,
    filters.industry,
    filters.difficulty,
    filters.impactLevel,
    filters.skill,
    filters.location,
    filters.validationStatus,
    filters.minScore,
    filters.maxScore,
    filters.sort,
    page,
  ]);

  useEffect(() => {
    if (activeTab === 'all') {
      loadDirectory();
    }
  }, [activeTab, loadDirectory]);

  // Load authenticated user's saved/submitted/solver workspace
  const loadMyWorkspace = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingWorkspace(true);
      const res = await apiRequest<{
        savedProblems: ExchangeProblem[];
        submittedProblems: ExchangeProblem[];
        solverInterests: ExchangeSolverInterest[];
      }>('/api/problem-exchange/my', { requireAuth: true });
      setMyWorkspace(res);
    } catch (err) {
      console.error('Failed to load personal Problem Exchange workspace:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && (activeTab === 'saved' || activeTab === 'mine')) {
      loadMyWorkspace();
    }
  }, [user, activeTab, loadMyWorkspace]);

  const updateFilter = <K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setActiveTab('all');
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedQuery('');
    setPage(1);
    setActiveTab('all');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.industry) count++;
    if (filters.difficulty) count++;
    if (filters.impactLevel) count++;
    if (filters.skill) count++;
    if (filters.location) count++;
    if (filters.validationStatus) count++;
    if (filters.minScore > 0 || filters.maxScore < 100) count++;
    return count;
  }, [filters]);

  const scrollToDirectory = () => {
    directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectCategoryFromExplorer = (categoryName: string) => {
    updateFilter('category', filters.category === categoryName ? '' : categoryName);
    scrollToDirectory();
  };

  const handleToggleCardSave = async (e: React.MouseEvent, problem: ExchangeProblem) => {
    e.stopPropagation();
    if (!user) {
      flashToast('Sign in with Google to save problems to your workspace.');
      return;
    }
    try {
      const res = await apiRequest<{ saved: boolean; savesCount: number }>(
        `/api/problem-exchange/${encodeURIComponent(problem.id)}/save`,
        { method: 'POST', requireAuth: true }
      );
      setDirectoryData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === problem.id
                  ? { ...item, isSaved: res.saved, savesCount: res.savesCount }
                  : item
              ),
            }
          : prev
      );
      if (activeTab === 'saved') {
        loadMyWorkspace();
      }
      flashToast(res.saved ? `Saved ${problem.problemCode}` : `Removed ${problem.problemCode}`);
    } catch (err: any) {
      flashToast(err?.message || 'Unable to update bookmark.');
    }
  };

  const openProblemDetail = (id: string) => {
    navigate(`/problem-exchange/${id}`);
  };

  // Build pagination window numbers
  const paginationPages = useMemo(() => {
    const totalPages = directoryData?.totalPages || 1;
    const current = directoryData?.page || 1;
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('ellipsis');
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [directoryData]);

  // Filter Panel JSX (shared between desktop sidebar and mobile drawer)
  const renderFilterControls = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-[#1f232c] pb-3">
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-white">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#39FF14]" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded bg-[#39FF14] px-1.5 py-0.5 text-[10px] font-extrabold text-black">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#39FF14] hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Category (40 Domains) */}
      <div>
        <label
          htmlFor="filter-category"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Category (40 Domains)
        </label>
        <select
          id="filter-category"
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">All 40 Categories</option>
          {PROBLEM_EXCHANGE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Industry */}
      <div>
        <label
          htmlFor="filter-industry"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Industry
        </label>
        <select
          id="filter-industry"
          value={filters.industry}
          onChange={(e) => updateFilter('industry', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">All Industries</option>
          {(overview?.facets?.industries || []).map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      {/* Difficulty */}
      <div>
        <label
          htmlFor="filter-difficulty"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Technical Difficulty
        </label>
        <select
          id="filter-difficulty"
          value={filters.difficulty}
          onChange={(e) => updateFilter('difficulty', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">Any Difficulty</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="deep_tech">Deep Tech</option>
        </select>
      </div>

      {/* Impact Level */}
      <div>
        <label
          htmlFor="filter-impact"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Impact Level
        </label>
        <select
          id="filter-impact"
          value={filters.impactLevel}
          onChange={(e) => updateFilter('impactLevel', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">Any Impact</option>
          <option value="critical">Critical Impact</option>
          <option value="high">High Impact</option>
          <option value="medium">Medium Impact</option>
        </select>
      </div>

      {/* Validation Status */}
      <div>
        <label
          htmlFor="filter-validation"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Validation Status
        </label>
        <select
          id="filter-validation"
          value={filters.validationStatus}
          onChange={(e) => updateFilter('validationStatus', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">All Validation Stages</option>
          <option value="research_needed">Research Needed</option>
          <option value="under_validation">Under Validation</option>
          <option value="validated">Validated</option>
        </select>
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="filter-location"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Location / Region
        </label>
        <select
          id="filter-location"
          value={filters.location}
          onChange={(e) => updateFilter('location', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">All Locations</option>
          {(overview?.facets?.locations || []).map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      {/* Skills */}
      <div>
        <label
          htmlFor="filter-skill"
          className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5"
        >
          Skill Required
        </label>
        <select
          id="filter-skill"
          value={filters.skill}
          onChange={(e) => updateFilter('skill', e.target.value)}
          className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
        >
          <option value="">Any Skill</option>
          {(overview?.facets?.skills || []).map((sk) => (
            <option key={sk} value={sk}>
              {sk}
            </option>
          ))}
        </select>
      </div>

      {/* Opportunity Score Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          <span>Opportunity Score</span>
          <span className="text-[#39FF14] font-bold">
            {filters.minScore}–{filters.maxScore}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="filter-min-score" className="sr-only">
              Minimum Opportunity Score
            </label>
            <input
              id="filter-min-score"
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(e) =>
                updateFilter(
                  'minScore',
                  Math.max(0, Math.min(filters.maxScore, Number(e.target.value) || 0))
                )
              }
              className="w-full rounded-lg border border-[#2a2f3c] bg-[#141720] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#39FF14] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="filter-max-score" className="sr-only">
              Maximum Opportunity Score
            </label>
            <input
              id="filter-max-score"
              type="number"
              min={0}
              max={100}
              value={filters.maxScore}
              onChange={(e) =>
                updateFilter(
                  'maxScore',
                  Math.max(filters.minScore, Math.min(100, Number(e.target.value) || 100))
                )
              }
              className="w-full rounded-lg border border-[#2a2f3c] bg-[#141720] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#39FF14] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-xl border border-[#2a2f3c] bg-[#161922] py-2 font-mono text-xs uppercase tracking-wider text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
      >
        Reset All Filters
      </button>
    </div>
  );

  const visibleCategoryCounts = showAllCategories
    ? overview?.categoryCounts || []
    : (overview?.categoryCounts || []).slice(0, 16);

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-white pb-24 space-y-16">
      {/* 1. Dedicated Cinematic Opening Animation */}
      <ProblemExchangeIntro
        forceShow={replayIntro}
        onExplore={() => setReplayIntro(false)}
        onSubmitProblem={() => {
          setReplayIntro(false);
          setSubmitModalOpen(true);
        }}
      />

      {/* 2. Flagship Hero Section */}
      <section className="relative overflow-hidden border-b border-[#1c2029] bg-[#0a0b0e] pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(57,255,20,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(57,255,20,0.07) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[#39FF14]/10 blur-[140px]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#39FF14]">
                  <span className="h-2 w-2 rounded-full bg-[#39FF14] animate-pulse" />
                  ESC Problem Exchange
                </span>
                <button
                  type="button"
                  onClick={() => setReplayIntro(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#252a35] bg-[#12151c] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:border-[#39FF14]/50 hover:text-[#39FF14] transition-colors cursor-pointer"
                >
                  <Play className="h-2.5 w-2.5" /> Replay Intro
                </button>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.03]">
                REAL PROBLEMS. BIG IDEAS.{' '}
                <span className="text-[#39FF14]">REAL-WORLD SOLUTIONS.</span>
              </h1>

              <p className="max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
                Engineering Startup Company&apos;s verified repository of real engineering, industrial, civic, and rural challenges — transparently scored across six criteria so builders, student founders, and researchers focus on problems that truly matter.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={scrollToDirectory}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3.5 font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] shadow-lg shadow-[#39FF14]/20 transition-all cursor-pointer"
                >
                  Explore Problems <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(true)}
                  data-testid="open-submit-problem-btn"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2f3543] bg-[#13161e] px-6 py-3.5 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-white hover:border-[#39FF14] hover:text-[#39FF14] transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" /> Submit a Problem
                </button>
              </div>
            </div>

            {/* Live Database-Driven Metrics Panel (Never Hardcoded) */}
            <div className="lg:col-span-4 grid grid-cols-3 lg:grid-cols-1 gap-3">
              <div className="rounded-2xl border border-[#232833] bg-[#111317] p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Published Problems
                  </span>
                  <span
                    data-testid="live-published-count"
                    className="font-display text-2xl sm:text-3xl font-black text-[#39FF14]"
                  >
                    {loadingOverview
                      ? '—'
                      : (overview?.totalPublished ?? 0).toLocaleString()}
                  </span>
                </div>
                <span className="hidden sm:inline-block font-mono text-[10px] uppercase text-zinc-500">
                  Live SQL Index
                </span>
              </div>

              <div className="rounded-2xl border border-[#232833] bg-[#111317] p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Engineering Domains
                  </span>
                  <span
                    data-testid="live-categories-count"
                    className="font-display text-2xl sm:text-3xl font-black text-white"
                  >
                    {loadingOverview ? '—' : overview?.totalCategories ?? 0}
                  </span>
                </div>
                <span className="hidden sm:inline-block font-mono text-[10px] uppercase text-zinc-500">
                  Active Sectors
                </span>
              </div>

              <div className="rounded-2xl border border-[#232833] bg-[#111317] p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Curated Priority
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-black text-white">
                    {loadingOverview ? '—' : `Top ${overview?.topTenProblems?.length ?? 0}`}
                  </span>
                </div>
                <span className="hidden sm:inline-block font-mono text-[10px] uppercase text-zinc-500">
                  Admin Ranked
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Scratch-to-Reveal Card */}
      <ScratchRevealCard onExploreProblem={openProblemDetail} />

      {/* 4. Top 10 High-Priority Carousel */}
      {overview && (overview.topTenProblems?.length ?? 0) > 0 && (
        <TopTenCarousel
          problems={overview.topTenProblems || []}
          onExploreProblem={openProblemDetail}
        />
      )}

      {/* 5. Featured Problems Showcase */}
      {overview && (overview.featuredProblems?.length ?? 0) > 0 && (
        <section
          aria-label="Featured Problems"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#39FF14]">
                <Sparkles className="h-3.5 w-3.5" /> Admin Spotlight
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Featured Engineering Challenges
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                updateFilter('sort', 'featured');
                scrollToDirectory();
              }}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase text-[#39FF14] hover:underline cursor-pointer"
            >
              View All Featured <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {overview.featuredProblems.slice(0, 6).map((item) => (
              <article
                key={item.id}
                onClick={() => openProblemDetail(item.id)}
                className="group flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-6 hover:border-[#39FF14]/60 transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="text-[#39FF14] font-bold">{item.problemCode}</span>
                    <span className="rounded border border-[#39FF14]/35 bg-[#0e170d] px-2 py-0.5 text-[#39FF14] font-bold">
                      Score {item.opportunityScore}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {item.category} • {item.industry}
                  </div>
                  <h3 className="font-display text-lg font-bold text-white group-hover:text-[#39FF14] transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#1e222b] flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{getDifficultyLabel(item.difficulty)}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#39FF14]">
                    Inspect Brief <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 6. 40-Category Interactive Explorer */}
      {overview && (overview.categoryCounts?.length ?? 0) > 0 && (
        <section
          aria-label="40 Engineering Problem Categories"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#39FF14]">
                <Layers className="h-3.5 w-3.5" /> Domain Taxonomy
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Explore by Technical Category ({overview.totalCategories || 0})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setShowAllCategories((prev) => !prev)}
              className="rounded-xl border border-[#2b303c] bg-[#141720] px-4 py-2 font-mono text-xs text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
            >
              {showAllCategories
                ? 'Show Fewer Categories'
                : `Show All ${(overview.categoryCounts || []).length} Categories`}
            </button>
          </div>

          <div
            data-testid="category-explorer-grid"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {visibleCategoryCounts.map((entry) => {
              const selected = filters.category === entry.category;
              return (
                <button
                  key={entry.category}
                  type="button"
                  onClick={() => handleSelectCategoryFromExplorer(entry.category)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-[#39FF14] bg-[#121f10] text-[#39FF14]'
                      : 'border-[#232731] bg-[#111317] text-zinc-200 hover:border-[#39FF14]/50 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold truncate">{entry.category}</span>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold shrink-0 ${
                      selected
                        ? 'bg-[#39FF14] text-black'
                        : 'bg-[#1a1e27] text-zinc-400'
                    }`}
                  >
                    {entry.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. Main Indexed Paginated Problem Directory */}
      <section
        id="problem-directory"
        ref={directoryRef}
        aria-label="Main Problem Exchange Directory"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-24"
      >
        {/* Directory Header + View Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1f232c] pb-5">
          <div className="space-y-1">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Problem Exchange Directory
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Search, filter, and sort verified engineering problems across all {overview?.totalCategories || 40} categories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'all', label: 'Explore All' },
                { key: 'saved', label: 'My Saved Problems' },
                { key: 'mine', label: 'My Submissions & Interests' },
              ] as { key: DirectoryTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-[#39FF14] text-black font-bold'
                    : 'border border-[#282d38] bg-[#141720] text-zinc-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Toast Notification */}
        {inlineToast && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-[#39FF14]/40 bg-[#101d0e] px-4 py-2.5 text-xs text-[#39FF14]"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {inlineToast}
            </span>
            <button
              type="button"
              onClick={() => setInlineToast(null)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB: EXPLORE ALL (Indexed SQL Search, Filter & Pagination) */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Desktop Left Filter Sidebar */}
            <aside className="hidden lg:block lg:col-span-3 rounded-2xl border border-[#232731] bg-[#111317] p-5 sticky top-24">
              {renderFilterControls()}
            </aside>

            {/* Right Main Column: Search + Sort + Grid + Pagination */}
            <div className="lg:col-span-9 space-y-5">
              {/* Search & Sort Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <label htmlFor="px-directory-search" className="sr-only">
                    Search problems by title, domain, skill, or problem code
                  </label>
                  <input
                    id="px-directory-search"
                    type="search"
                    value={filters.q}
                    onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                    placeholder="Search title, problem code (PX-0001), industry, skill, or location..."
                    className="w-full rounded-xl border border-[#2a2f3c] bg-[#141720] pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Mobile Filter Drawer Trigger */}
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    data-testid="mobile-filter-drawer-btn"
                    className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-[#2a2f3c] bg-[#141720] px-3.5 py-2.5 font-mono text-xs text-white hover:border-[#39FF14] cursor-pointer"
                  >
                    <Filter className="h-3.5 w-3.5 text-[#39FF14]" />
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </button>

                  <label htmlFor="px-directory-sort" className="sr-only">
                    Sort problems
                  </label>
                  <select
                    id="px-directory-sort"
                    value={filters.sort}
                    onChange={(e) => updateFilter('sort', e.target.value as any)}
                    className="rounded-xl border border-[#2a2f3c] bg-[#141720] px-3.5 py-2.5 text-xs font-mono text-white focus:border-[#39FF14] focus:outline-none"
                  >
                    <option value="score_desc">Sort: Highest Opportunity Score</option>
                    <option value="recent">Sort: Most Recent</option>
                    <option value="impact">Sort: Highest Impact</option>
                    <option value="popular">Sort: Most Popular</option>
                    <option value="featured">Sort: Admin Featured</option>
                  </select>
                </div>
              </div>

              {/* Active Result Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-zinc-400">
                <span data-testid="directory-result-summary">
                  {loadingDirectory
                    ? 'Querying Problem Exchange index...'
                    : directoryData
                    ? `Showing ${
                        directoryData.total === 0
                          ? 0
                          : (directoryData.page - 1) * directoryData.pageSize + 1
                      }–${Math.min(
                        directoryData.page * directoryData.pageSize,
                        directoryData.total
                      )} of ${directoryData.total.toLocaleString()} problems`
                    : '0 problems'}
                </span>

                {filters.category && (
                  <button
                    type="button"
                    onClick={() => updateFilter('category', '')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#39FF14]/40 bg-[#121f10] px-2.5 py-1 text-[11px] text-[#39FF14] cursor-pointer"
                  >
                    Category: {filters.category} <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Directory Grid */}
              {directoryError ? (
                <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-8 text-center space-y-3">
                  <p className="text-sm text-red-200">{directoryError}</p>
                  <button
                    type="button"
                    onClick={loadDirectory}
                    className="rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                  >
                    Retry Query
                  </button>
                </div>
              ) : loadingDirectory ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-56 animate-pulse rounded-2xl border border-[#1f232c] bg-[#111317] p-5"
                    />
                  ))}
                </div>
              ) : !directoryData || !Array.isArray(directoryData.items) || directoryData.items.length === 0 ? (
                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
                  <FolderOpen className="h-10 w-10 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-white">
                      No matching problems found
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Try broadening your filters or submit a new real-world problem for ESC review.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-xl border border-[#2d3340] bg-[#161922] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                    >
                      Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmitModalOpen(true)}
                      className="rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                    >
                      Submit This Problem
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    data-testid="problem-directory-grid"
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {(directoryData.items || []).map((problem) => (
                      <article
                        key={problem.id}
                        className="group flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-5 hover:border-[#39FF14]/60 transition-all"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                              <span className="rounded border border-[#39FF14]/35 bg-[#39FF14]/10 px-2 py-0.5 font-bold text-[#39FF14]">
                                {problem.problemCode}
                              </span>
                              <span className="rounded border border-[#262b36] bg-[#161922] px-2 py-0.5 text-zinc-300">
                                {problem.category}
                              </span>
                              {problem.topTenRank && (
                                <span className="rounded bg-[#39FF14] px-1.5 py-0.5 font-extrabold text-black">
                                  #{String(problem.topTenRank).padStart(2, '0')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                title="ESC Opportunity Score"
                                className="rounded-lg border border-[#39FF14]/30 bg-[#0d160c] px-2 py-0.5 font-display text-sm font-extrabold text-[#39FF14]"
                              >
                                {problem.opportunityScore}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleToggleCardSave(e, problem)}
                                aria-label={
                                  problem.isSaved
                                    ? `Unsave ${problem.problemCode}`
                                    : `Save ${problem.problemCode}`
                                }
                                className={`rounded-lg border p-1.5 transition-colors cursor-pointer ${
                                  problem.isSaved
                                    ? 'border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]'
                                    : 'border-[#272c37] bg-[#151822] text-zinc-400 hover:border-[#39FF14] hover:text-[#39FF14]'
                                }`}
                              >
                                {problem.isSaved ? (
                                  <BookmarkCheck className="h-3.5 w-3.5" />
                                ) : (
                                  <Bookmark className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-400">
                            <span>{problem.industry}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-zinc-500" /> {problem.location}
                            </span>
                            <span>•</span>
                            <span className="text-amber-300">
                              {getValidationStatusLabel(problem.validationStatus)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openProblemDetail(problem.id)}
                            className="block text-left font-display text-base font-bold text-white group-hover:text-[#39FF14] transition-colors line-clamp-2 cursor-pointer"
                          >
                            {problem.title}
                          </button>

                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                            {problem.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-[#1e222b] flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="rounded bg-[#171b24] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                              {getDifficultyLabel(problem.difficulty)}
                            </span>
                            {problem.skillsRequired.slice(0, 2).map((sk) => (
                              <span
                                key={sk}
                                className="rounded border border-[#242935] bg-[#0e1015] px-2 py-0.5 font-mono text-[10px] text-zinc-400 truncate max-w-[125px]"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => openProblemDetail(problem.id)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-[#39FF14] hover:underline shrink-0 cursor-pointer"
                          >
                            Explore <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {/* Indexed SQL Pagination Controls */}
                  {directoryData.totalPages > 1 && (
                    <nav
                      aria-label="Problem Directory Pagination"
                      data-testid="directory-pagination"
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#232731] bg-[#111317] px-4 py-3"
                    >
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => {
                          setPage((p) => Math.max(1, p - 1));
                          scrollToDirectory();
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#2a2f3c] bg-[#161922] px-3.5 py-2 font-mono text-xs text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {paginationPages.map((p, idx) =>
                          p === 'ellipsis' ? (
                            <span
                              key={`ell-${idx}`}
                              className="px-2 font-mono text-xs text-zinc-500"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setPage(p);
                                scrollToDirectory();
                              }}
                              aria-current={page === p ? 'page' : undefined}
                              className={`h-9 min-w-[36px] rounded-lg px-2.5 font-mono text-xs font-bold transition-colors cursor-pointer ${
                                page === p
                                  ? 'bg-[#39FF14] text-black'
                                  : 'border border-[#272c37] bg-[#151822] text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14]'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={page >= directoryData.totalPages}
                        onClick={() => {
                          setPage((p) => Math.min(directoryData.totalPages, p + 1));
                          scrollToDirectory();
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#2a2f3c] bg-[#161922] px-3.5 py-2 font-mono text-xs text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] disabled:opacity-40 cursor-pointer"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB: MY SAVED PROBLEMS */}
        {activeTab === 'saved' && (
          <div>
            {!user ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
                <Bookmark className="h-9 w-9 text-[#39FF14] mx-auto" />
                <h3 className="font-display text-xl font-bold text-white">
                  Sign in to view your Saved Problems
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Bookmark high-priority challenges to build your research shortlist and sync directly with your ESC Member Dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : loadingWorkspace ? (
              <div className="py-12 text-center font-mono text-xs text-zinc-400">
                Loading saved problems...
              </div>
            ) : myWorkspace.savedProblems.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
                <Bookmark className="h-9 w-9 text-zinc-600 mx-auto" />
                <p className="text-sm text-zinc-400">You have not saved any problems yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                >
                  Explore Directory
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myWorkspace.savedProblems.map((prob) => (
                  <article
                    key={prob.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[#39FF14] font-bold">{prob.problemCode}</span>
                        <span className="text-zinc-400">Score {prob.opportunityScore}</span>
                      </div>
                      <h3 className="font-display text-base font-bold text-white">{prob.title}</h3>
                      <p className="text-xs text-zinc-400 line-clamp-3">{prob.description}</p>
                    </div>
                    <div className="pt-3 border-t border-[#1e222b] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => handleToggleCardSave(e, prob)}
                        className="text-xs font-mono text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => openProblemDetail(prob.id)}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#39FF14] hover:underline cursor-pointer"
                      >
                        Open Brief <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: MY SUBMISSIONS & SOLVER INTERESTS */}
        {activeTab === 'mine' && (
          <div>
            {!user ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
                <Clock className="h-9 w-9 text-[#39FF14] mx-auto" />
                <h3 className="font-display text-xl font-bold text-white">
                  Sign in to track your Submissions & Solver Applications
                </h3>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : loadingWorkspace ? (
              <div className="py-12 text-center font-mono text-xs text-zinc-400">
                Loading your submissions and solver interests...
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-white">
                      My Submitted Problems ({myWorkspace.submittedProblems.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSubmitModalOpen(true)}
                      className="rounded-lg bg-[#39FF14] px-3 py-1.5 font-display text-[11px] font-extrabold uppercase text-black cursor-pointer"
                    >
                      + Submit New
                    </button>
                  </div>
                  {myWorkspace.submittedProblems.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      You have not submitted any problems yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myWorkspace.submittedProblems.map((prob) => (
                        <div
                          key={prob.id}
                          className="rounded-xl border border-[#222733] bg-[#0e1015] p-4 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                            <span className="text-[#39FF14]">{prob.problemCode}</span>
                            <span className="rounded border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-amber-300 uppercase">
                              {getPublicationStatusLabel(prob.publicationStatus)}
                            </span>
                          </div>
                          <p className="font-display text-sm font-bold text-white">{prob.title}</p>
                          <p className="text-xs text-zinc-400 line-clamp-2">{prob.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-white">
                      My Solver Interest Applications ({myWorkspace.solverInterests.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="font-mono text-xs text-[#39FF14] hover:underline cursor-pointer"
                    >
                      Manage in Dashboard →
                    </button>
                  </div>
                  {myWorkspace.solverInterests.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      Click &quot;I Want to Solve This&quot; on any problem brief to apply for ESC team formation.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myWorkspace.solverInterests.map((interest) => (
                        <div
                          key={interest.id}
                          className="rounded-xl border border-[#222733] bg-[#0e1015] p-4 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase">
                            <span className="text-zinc-400">
                              {interest.teamPreference.replace(/_/g, ' ')}
                            </span>
                            <span className="rounded border border-[#39FF14]/40 bg-[#101c0e] px-2 py-0.5 text-[#39FF14]">
                              {interest.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openProblemDetail(interest.problemId)}
                            className="text-left font-display text-sm font-bold text-white hover:text-[#39FF14] cursor-pointer"
                          >
                            {interest.problemTitle}
                          </button>
                          <p className="text-xs text-zinc-400 line-clamp-2">
                            {interest.proposedApproach}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Mobile Slide-Out Filter Drawer */}
      {mobileFilterOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter Problems"
            className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm lg:hidden"
          >
            <div className="relative flex h-full w-full max-w-sm flex-col bg-[#0f1116] border-l border-[#262b36] p-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display text-base font-bold text-white">Filter Problems</span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  aria-label="Close filters drawer"
                  className="rounded-lg border border-[#282d38] bg-[#161922] p-1.5 text-zinc-300 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderFilterControls()}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="mt-6 w-full rounded-xl bg-[#39FF14] py-3 font-display text-xs font-extrabold uppercase tracking-wider text-black cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Submit a Problem Modal */}
      <SubmitProblemModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onSubmitted={() => {
          loadOverview();
          if (user) loadMyWorkspace();
        }}
      />
    </div>
  );
};
