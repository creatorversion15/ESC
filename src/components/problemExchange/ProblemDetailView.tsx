import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Share2,
  Flag,
  Users,
  Rocket,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Layers,
  Cpu,
  Eye,
  ShieldAlert,
  Info,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/apiClient';
import {
  ESC_OPPORTUNITY_SCORE_DISCLAIMER,
  OPPORTUNITY_SCORE_CRITERIA_META,
  getDifficultyLabel,
  getValidationStatusLabel,
  validateProblemReportInput,
  validateSolverInterestInput,
} from '../../utils/problemExchangeLogic';
import type { ExchangeProblem } from '../../types';

interface MatchingMember {
  uid: string;
  escMemberId: string;
  fullName: string;
  college: string;
  branch: string;
  yearOfStudy: string;
  bio: string;
  githubUrl: string;
  linkedinUrl: string;
  photoUrl: string;
  skills: string[];
  matchedSkills: string[];
  matchScore: number;
}

interface ProblemDetailViewProps {
  problemId: string;
  navigate: (path: string) => void;
  onBack: () => void;
}

export const ProblemDetailView: React.FC<ProblemDetailViewProps> = ({
  problemId,
  navigate,
  onBack,
}) => {
  const { user, profile, signInWithGoogle } = useAuth();

  const [problem, setProblem] = useState<ExchangeProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Save state
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Action Modals
  const [solveModalOpen, setSolveModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Solver Form State
  const [proposedApproach, setProposedApproach] = useState('');
  const [skillsOfferedText, setSkillsOfferedText] = useState('');
  const [teamPreference, setTeamPreference] = useState<'form_new_team' | 'join_team' | 'solo'>(
    'form_new_team'
  );
  const [lookingForTeammates, setLookingForTeammates] = useState(true);
  const [neededRoles, setNeededRoles] = useState('');
  const [solverErrors, setSolverErrors] = useState<Record<string, string>>({});
  const [submittingSolver, setSubmittingSolver] = useState(false);
  const [solverConfirmation, setSolverConfirmation] = useState<string | null>(null);

  // Report Form State
  const [reportReason, setReportReason] = useState<
    'duplicate' | 'inaccurate' | 'spam' | 'out_of_scope' | 'other'
  >('inaccurate');
  const [reportDetails, setReportDetails] = useState('');
  const [reportDuplicateCode, setReportDuplicateCode] = useState('');
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportConfirmation, setReportConfirmation] = useState<string | null>(null);

  // Matching Team Members State
  const [matchingMembers, setMatchingMembers] = useState<MatchingMember[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [problemId]);

  useEffect(() => {
    let active = true;
    const loadDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<
          | { problem: ExchangeProblem; userSolverInterest?: { status?: ExchangeProblem['userSolverStatus'] } | null }
          | ExchangeProblem
        >(`/api/problem-exchange/${encodeURIComponent(problemId)}`);
        const resolvedProblem =
          data && 'problem' in data && data.problem
            ? {
                ...data.problem,
                userSolverStatus:
                  data.problem.userSolverStatus ?? data.userSolverInterest?.status ?? null,
              }
            : (data as ExchangeProblem);
        if (active) setProblem(resolvedProblem);
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to load this problem.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      active = false;
    };
  }, [problemId]);

  useEffect(() => {
    if (profile && !skillsOfferedText) {
      const combined = [
        ...(profile.technicalSkills || []),
        ...(profile.nonTechnicalSkills || []),
        ...(profile.customSkills || []),
      ].slice(0, 6);
      if (combined.length > 0) {
        setSkillsOfferedText(combined.join(', '));
      }
    }
  }, [profile, skillsOfferedText]);

  const handleToggleSave = async () => {
    if (!problem) return;
    if (!user) {
      showToast('error', 'Please sign in with Google to save problems to your workspace.');
      return;
    }
    try {
      setSavingBookmark(true);
      const res = await apiRequest<{ saved: boolean; savesCount: number }>(
        `/api/problem-exchange/${encodeURIComponent(problem.id)}/save`,
        { method: 'POST', requireAuth: true }
      );
      setProblem((prev) =>
        prev ? { ...prev, isSaved: res.saved, savesCount: res.savesCount } : prev
      );
      showToast(
        'success',
        res.saved ? 'Saved to your ESC Member Dashboard.' : 'Removed from Saved Problems.'
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update saved status.');
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleShare = async () => {
    if (!problem) return;
    const shareUrl = `${window.location.origin}/#/problem-exchange/${problem.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const temp = document.createElement('textarea');
        temp.value = shareUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      showToast('success', `Deep link copied: ${problem.problemCode}`);
    } catch {
      showToast('error', 'Unable to copy link automatically. Copy the URL from your address bar.');
    }
  };

  const handleOpenFindTeam = async () => {
    if (!problem) return;
    setTeamModalOpen(true);
    setLoadingMatches(true);
    setMatchError(null);
    try {
      const res = await apiRequest<{ members: MatchingMember[] }>(
        `/api/problem-exchange/${encodeURIComponent(problem.id)}/matching-members`
      );
      setMatchingMembers(res.members || []);
    } catch (err: any) {
      setMatchError(err?.message || 'Unable to load matching ESC members.');
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleSubmitSolver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem || !user) return;
    const skillsOffered = skillsOfferedText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const validation = validateSolverInterestInput({
      proposedApproach,
      teamPreference,
      skillsOffered,
    });

    if (!validation.isValid) {
      setSolverErrors(validation.errors);
      return;
    }

    setSolverErrors({});
    setSubmittingSolver(true);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/problem-exchange/${encodeURIComponent(problem.id)}/solve`,
        {
          method: 'POST',
          requireAuth: true,
          body: {
            proposedApproach,
            skillsOffered,
            teamPreference,
            lookingForTeammates,
            neededRoles,
            userName: profile?.fullName || user.displayName || user.email || 'ESC Member',
          },
        }
      );
      setSolverConfirmation(res.message);
      setProblem((prev) =>
        prev ? { ...prev, solverInterestCount: prev.solverInterestCount + 1 } : prev
      );
    } catch (err: any) {
      setSolverErrors({
        form: err?.message || 'Failed to record solver interest.',
      });
    } finally {
      setSubmittingSolver(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem) return;
    const validation = validateProblemReportInput({
      reason: reportReason,
      details: reportDetails,
    });
    if (!validation.isValid) {
      setReportErrors(validation.errors);
      return;
    }

    setReportErrors({});
    setSubmittingReport(true);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/problem-exchange/${encodeURIComponent(problem.id)}/report`,
        {
          method: 'POST',
          body: {
            reason: reportReason,
            details: reportDetails,
            duplicateOfId: reportDuplicateCode,
            reporterName: profile?.fullName || user?.displayName || 'Community Member',
            reporterEmail: profile?.email || user?.email || '',
          },
        }
      );
      setReportConfirmation(res.message);
    } catch (err: any) {
      setReportErrors({
        form: err?.message || 'Failed to submit report.',
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 font-mono text-xs text-[#39FF14]">
          <div className="h-7 w-7 rounded-full border-2 border-[#39FF14] border-t-transparent animate-spin" />
          <span>Loading problem brief...</span>
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/30 text-red-400">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Problem Brief Not Available</h1>
        <p className="text-sm text-zinc-400">{error || 'This problem could not be found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Problem Exchange
        </button>
      </div>
    );
  }

  const impactColors =
    problem.impactLevel === 'critical'
      ? 'border-red-500/40 bg-red-950/40 text-red-300'
      : problem.impactLevel === 'high'
      ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
      : 'border-sky-500/40 bg-sky-950/40 text-sky-300';

  const validationColors =
    problem.validationStatus === 'validated'
      ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
      : problem.validationStatus === 'under_validation'
      ? 'border-sky-500/40 bg-sky-950/40 text-sky-300'
      : 'border-amber-500/40 bg-amber-950/40 text-amber-300';

  return (
    <div className="min-h-screen bg-[#0b0c0e] pb-20 pt-8" data-testid="problem-detail-view">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Breadcrumb + Inline Toast */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-[#262b36] bg-[#12151c] px-4 py-2 font-mono text-xs text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to ESC Problem Exchange
          </button>

          {toast && (
            <div
              role="status"
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium ${
                toast.type === 'success'
                  ? 'border-[#39FF14]/40 bg-[#101c0e] text-[#39FF14]'
                  : 'border-red-800 bg-red-950/50 text-red-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
          )}
        </div>

        {/* Hero Header Card */}
        <header className="rounded-2xl border border-[#232731] bg-[#111317] p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="rounded border border-[#39FF14]/45 bg-[#39FF14]/15 px-2.5 py-1 font-bold text-[#39FF14]">
              {problem.problemCode}
            </span>
            <span className={`rounded border px-2.5 py-1 font-semibold ${validationColors}`}>
              {getValidationStatusLabel(problem.validationStatus)}
            </span>
            <span className={`rounded border px-2.5 py-1 uppercase font-semibold ${impactColors}`}>
              {problem.impactLevel} Impact
            </span>
            {problem.topTenRank && (
              <span className="rounded border border-[#39FF14] bg-[#39FF14] px-2.5 py-1 font-extrabold text-black">
                TOP 10 • #{String(problem.topTenRank).padStart(2, '0')}
              </span>
            )}
            {problem.isFeatured && !problem.topTenRank && (
              <span className="rounded border border-[#CCFF00]/40 bg-[#CCFF00]/10 px-2.5 py-1 font-semibold text-[#CCFF00]">
                ADMIN FEATURED
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {problem.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-zinc-400">
            <span className="inline-flex items-center gap-1.5 text-zinc-200">
              <Layers className="h-3.5 w-3.5 text-[#39FF14]" /> {problem.category}
            </span>
            <span>Industry: {problem.industry}</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#39FF14]" /> {problem.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[#39FF14]" /> Difficulty:{' '}
              <strong className="text-white">{getDifficultyLabel(problem.difficulty)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-zinc-500" /> {problem.viewsCount} Views
            </span>
            <span>{problem.savesCount} Saves</span>
            <span>{problem.solverInterestCount} Solvers Interested</span>
          </div>

          {/* All 5 Required Interactive Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-[#1f232d]">
            <button
              type="button"
              onClick={() => {
                setSolverConfirmation(null);
                setSolverErrors({});
                setSolveModalOpen(true);
              }}
              data-testid="action-solve-problem"
              className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] shadow-lg shadow-[#39FF14]/20 transition-all cursor-pointer"
            >
              <Rocket className="h-4 w-4" /> I Want to Solve This
            </button>

            <button
              type="button"
              onClick={handleToggleSave}
              disabled={savingBookmark}
              data-testid="action-save-problem"
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                problem.isSaved
                  ? 'border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]'
                  : 'border-[#2c313d] bg-[#161922] text-white hover:border-[#39FF14] hover:text-[#39FF14]'
              }`}
            >
              {problem.isSaved ? (
                <>
                  <BookmarkCheck className="h-4 w-4" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" /> Save Problem
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenFindTeam}
              data-testid="action-find-team"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2c313d] bg-[#161922] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:border-[#39FF14] hover:text-[#39FF14] transition-all cursor-pointer"
            >
              <Users className="h-4 w-4" /> Find Team Members
            </button>

            <button
              type="button"
              onClick={handleShare}
              data-testid="action-share-problem"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2c313d] bg-[#161922] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-zinc-200 hover:border-white hover:text-white transition-all cursor-pointer"
            >
              <Share2 className="h-4 w-4" /> Share Problem
            </button>

            <button
              type="button"
              onClick={() => {
                setReportConfirmation(null);
                setReportErrors({});
                setReportModalOpen(true);
              }}
              data-testid="action-report-problem"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2c313d] bg-[#161922] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-zinc-400 hover:border-red-500/60 hover:text-red-300 transition-all cursor-pointer"
            >
              <Flag className="h-4 w-4" /> Report Problem
            </button>
          </div>
        </header>

        {/* Main 2-Column Engineering Brief + Opportunity Score Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Structured Brief */}
          <div className="lg:col-span-8 space-y-6">
            <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[#39FF14]">
                01 // Problem Overview
              </h2>
              <p className="text-sm sm:text-base text-zinc-200 leading-relaxed whitespace-pre-line">
                {problem.description}
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-2.5">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  02 // Affected Users
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.affectedUsers || 'Field stakeholders and end users across this domain.'}
                </p>
              </section>

              <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-2.5">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  03 // Real-World Context
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.realWorldContext ||
                    'Documented field constraint observed across Indian operational environments.'}
                </p>
              </section>

              <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-2.5">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  04 // Current Challenges
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.currentChallenges ||
                    'Existing engineering or process solutions remain costly, manual, or difficult to scale.'}
                </p>
              </section>

              <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-2.5">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  05 // Current Workarounds
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.currentWorkarounds ||
                    'Manual inspections, ad-hoc spreadsheets, or reactive maintenance after failures occur.'}
                </p>
              </section>
            </div>

            <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-5">
              <div className="space-y-2">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  06 // Why It Matters
                </h2>
                <p className="text-sm text-zinc-200 leading-relaxed">{problem.whyItMatters}</p>
              </div>
              <div className="border-t border-[#1e222b] pt-5 space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white">
                  Potential Impact
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.potentialImpact ||
                    'Measurable reduction in downtime, operational losses, and access barriers once validated.'}
                </p>
              </div>
              <div className="border-t border-[#1e222b] pt-5 space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white">
                  Development Opportunities
                </h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {problem.developmentOpportunities ||
                    'Open for hardware prototyping, software tooling, embedded telemetry, or hybrid startup MVP execution.'}
                </p>
              </div>
            </section>

            {/* Suggested Research Questions */}
            {problem.suggestedResearchQuestions && problem.suggestedResearchQuestions.length > 0 && (
              <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3.5">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  07 // Suggested Research & Discovery Questions
                </h2>
                <ul className="space-y-2.5">
                  {problem.suggestedResearchQuestions.map((question, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-[#1f232d] bg-[#0e1015] p-3.5 text-sm text-zinc-200"
                    >
                      <span className="font-mono text-xs font-bold text-[#39FF14] shrink-0">
                        Q{idx + 1}
                      </span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Required Skills & Evidence */}
            <section className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-5">
              <div className="space-y-3">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#39FF14]">
                  08 // Skills Required
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(problem.skillsRequired || []).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg border border-[#2b313e] bg-[#151822] px-3 py-1.5 font-mono text-xs text-zinc-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {problem.evidenceLinks && problem.evidenceLinks.length > 0 && (
                <div className="border-t border-[#1e222b] pt-5 space-y-2.5">
                  <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white">
                    Reference & Evidence Links
                  </h3>
                  <ul className="space-y-2">
                    {problem.evidenceLinks.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#39FF14] hover:underline break-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problem.attachmentName && problem.attachmentDataUrl && (
                <div className="border-t border-[#1e222b] pt-5 space-y-2">
                  <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-white">
                    Attached Supporting Document
                  </h3>
                  <a
                    href={problem.attachmentDataUrl}
                    download={problem.attachmentName}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2d3340] bg-[#161922] px-4 py-2 text-xs text-[#39FF14] hover:border-[#39FF14]"
                  >
                    <FileText className="h-4 w-4" /> Download {problem.attachmentName}
                  </a>
                </div>
              )}
            </section>
          </div>

          {/* Right 4 Columns: Transparent ESC Opportunity Score Card */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <div
              data-testid="opportunity-score-breakdown"
              className="rounded-2xl border border-[#39FF14]/35 bg-[#101412] p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#1f2920] pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#39FF14]">
                    Transparent Scoring Model
                  </p>
                  <h2 className="font-display text-lg font-extrabold text-white mt-0.5">
                    ESC Opportunity Score
                  </h2>
                </div>
                <div className="text-right">
                  <span className="font-display text-4xl font-black leading-none text-[#39FF14]">
                    {problem.opportunityScore}
                  </span>
                  <span className="block font-mono text-[10px] text-zinc-400">OUT OF 100</span>
                </div>
              </div>

              {/* 6 Weighted Criteria Progress Bars */}
              <div className="space-y-4">
                {OPPORTUNITY_SCORE_CRITERIA_META.map((criterion) => {
                  const scoreVal = problem.scoreCriteria?.[criterion.key] ?? 70;
                  return (
                    <div key={criterion.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          {criterion.label}{' '}
                          <span className="font-mono text-[10px] text-zinc-400">
                            ({criterion.weightPercent}%)
                          </span>
                        </span>
                        <span className="font-mono font-bold text-[#39FF14]">{scoreVal}/100</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a221d]">
                        <div
                          className="h-full rounded-full bg-[#39FF14] transition-all"
                          style={{ width: `${Math.min(100, Math.max(4, scoreVal))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug">
                        {criterion.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Mandatory Prioritisation Disclaimer */}
              <div
                data-testid="opportunity-score-disclaimer"
                className="rounded-xl border border-amber-500/35 bg-[#17150e] p-3.5 text-[11px] leading-relaxed text-amber-100/90 space-y-1.5"
              >
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Info className="h-3.5 w-3.5 shrink-0" /> Scoring Transparency Notice
                </div>
                <p>{ESC_OPPORTUNITY_SCORE_DISCLAIMER}</p>
              </div>
            </div>

            {/* Governance / Review Box */}
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3 text-xs text-zinc-400">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white">
                <ShieldAlert className="h-4 w-4 text-[#39FF14]" /> ESC Validation Governance
              </div>
              <p className="leading-relaxed">
                Current Validation Stage:{' '}
                <strong className="text-white">
                  {getValidationStatusLabel(problem.validationStatus)}
                </strong>
                . Teams selecting this problem should perform primary field interviews and technical feasibility audits before committing to full product development.
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full rounded-xl border border-[#2b303c] bg-[#161922] py-2.5 font-display text-xs font-bold uppercase tracking-wider text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
              >
                Open Member Dashboard
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* MODAL 1: I WANT TO SOLVE THIS */}
      {solveModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="solve-modal-title"
            className="fixed inset-0 z-[120] flex items-start justify-center bg-black/85 p-4 sm:py-12 backdrop-blur-md overflow-y-auto"
          >
            <div className="relative w-full max-w-xl rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#1f232d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                  Solver Interest Application • {problem.problemCode}
                </span>
                <h3 id="solve-modal-title" className="font-display text-xl font-extrabold text-white mt-1">
                  I Want to Solve This Problem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSolveModalOpen(false)}
                aria-label="Close solver interest modal"
                className="rounded-lg border border-[#282d38] bg-[#161922] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!user ? (
              <div className="py-6 text-center space-y-4">
                <p className="text-sm text-zinc-300">
                  Sign in with your ESC Google account to submit your solver interest and connect with ESC Admin & Startup Teams.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : solverConfirmation ? (
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-[#39FF14] mx-auto" />
                <p className="text-sm font-medium text-white leading-relaxed">
                  {solverConfirmation}
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSolveModalOpen(false);
                      navigate('/dashboard');
                    }}
                    className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                  >
                    Track in Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolveModalOpen(false)}
                    className="rounded-xl border border-[#2c313d] px-4 py-2.5 text-xs text-zinc-300 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitSolver} className="space-y-4" noValidate>
                {solverErrors.form && (
                  <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
                    {solverErrors.form}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="solver-approach"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                  >
                    Proposed Approach & Research Plan <span className="text-[#39FF14]">*</span>
                  </label>
                  <textarea
                    id="solver-approach"
                    rows={4}
                    value={proposedApproach}
                    onChange={(e) => setProposedApproach(e.target.value)}
                    placeholder="Outline how you plan to investigate this problem, build an initial prototype, and validate it with real users..."
                    className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                  />
                  {solverErrors.proposedApproach && (
                    <p className="mt-1 text-xs text-red-400">{solverErrors.proposedApproach}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="solver-skills"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                  >
                    Skills You Bring (comma-separated) <span className="text-[#39FF14]">*</span>
                  </label>
                  <input
                    id="solver-skills"
                    type="text"
                    value={skillsOfferedText}
                    onChange={(e) => setSkillsOfferedText(e.target.value)}
                    placeholder="e.g., Embedded C, PCB Design, Python, CAD"
                    className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                  />
                  {solverErrors.skillsOffered && (
                    <p className="mt-1 text-xs text-red-400">{solverErrors.skillsOffered}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="solver-team-pref"
                      className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                    >
                      Team Preference
                    </label>
                    <select
                      id="solver-team-pref"
                      value={teamPreference}
                      onChange={(e) => setTeamPreference(e.target.value as any)}
                      className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3 py-2.5 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                    >
                      <option value="form_new_team">Form a New Startup Team</option>
                      <option value="join_team">Join an Existing Team</option>
                      <option value="solo">Solo Research / Prototype</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="solver-needed-roles"
                      className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                    >
                      Teammate Roles Needed (Optional)
                    </label>
                    <input
                      id="solver-needed-roles"
                      type="text"
                      value={neededRoles}
                      onChange={(e) => setNeededRoles(e.target.value)}
                      placeholder="e.g., Firmware engineer, UI designer"
                      className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lookingForTeammates}
                    onChange={(e) => setLookingForTeammates(e.target.checked)}
                    className="h-4 w-4 accent-[#39FF14]"
                  />
                  <span>I am open to collaborating with other approved ESC members</span>
                </label>

                <div className="rounded-xl border border-amber-500/35 bg-[#17150e] p-3 text-[11px] text-amber-100/90 leading-relaxed">
                  <strong>ESC Admin Review Policy:</strong> Submitting solver interest registers your proposal under <strong>Pending Review</strong>. It does not automatically create or approve an official ESC Startup Team or Project. Team formation proceeds only after ESC Admin review.
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSolveModalOpen(false)}
                    className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSolver}
                    className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                  >
                    {submittingSolver ? 'Submitting...' : 'Submit Solver Interest'}
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: FIND TEAM MEMBERS */}
      {teamModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-team-modal-title"
            className="fixed inset-0 z-[120] flex items-start justify-center bg-black/85 p-4 sm:py-12 backdrop-blur-md overflow-y-auto"
          >
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#1f232d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                  Approved ESC Member Skill Match
                </span>
                <h3 id="find-team-modal-title" className="font-display text-xl font-extrabold text-white mt-1">
                  Find Team Members for {problem.problemCode}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Approved active ESC members ranked by skill overlap with this problem.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTeamModalOpen(false)}
                aria-label="Close find team modal"
                className="rounded-lg border border-[#282d38] bg-[#161922] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingMatches ? (
              <div className="py-10 text-center font-mono text-xs text-zinc-400">
                Matching skills against approved ESC members...
              </div>
            ) : matchError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-xs text-red-200">
                {matchError}
              </div>
            ) : matchingMembers.length === 0 ? (
              <div className="rounded-xl border border-[#232731] bg-[#13161d] p-6 text-center space-y-3">
                <Users className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">
                  No approved ESC member profiles matched yet. You can still form a team or recruit collaborators inside the ESC Startup Teams workspace.
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
                {matchingMembers.map((member) => (
                  <div
                    key={member.uid}
                    className="rounded-xl border border-[#232731] bg-[#141720] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-white">
                          {member.fullName}
                        </span>
                        {member.escMemberId && (
                          <span className="rounded bg-[#39FF14]/15 px-2 py-0.5 font-mono text-[10px] text-[#39FF14]">
                            {member.escMemberId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {[member.branch, member.yearOfStudy, member.college]
                          .filter(Boolean)
                          .join(' • ') || 'Approved ESC Member'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {member.matchedSkills.map((sk) => (
                          <span
                            key={sk}
                            className="rounded border border-[#39FF14]/40 bg-[#39FF14]/10 px-2 py-0.5 font-mono text-[10px] text-[#39FF14]"
                          >
                            {sk}
                          </span>
                        ))}
                        {member.skills
                          .filter((s) => !member.matchedSkills.includes(s))
                          .slice(0, 3)
                          .map((sk) => (
                            <span
                              key={sk}
                              className="rounded border border-[#2a2f3c] bg-[#0e1015] px-2 py-0.5 font-mono text-[10px] text-zinc-400"
                            >
                              {sk}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f232d] pt-4">
              <span className="text-[11px] text-zinc-400">
                Send official team invitations from your Startup Teams workspace.
              </span>
              <button
                type="button"
                onClick={() => {
                  setTeamModalOpen(false);
                  navigate('/dashboard');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" /> Open ESC Startup Teams
              </button>
            </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: REPORT PROBLEM */}
      {reportModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            className="fixed inset-0 z-[120] flex items-start justify-center bg-black/85 p-4 sm:py-12 backdrop-blur-md overflow-y-auto"
          >
            <div className="relative w-full max-w-lg rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#1f232d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-red-400">
                  Quality & Duplicate Moderation
                </span>
                <h3 id="report-modal-title" className="font-display text-xl font-extrabold text-white mt-1">
                  Report {problem.problemCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                aria-label="Close report modal"
                className="rounded-lg border border-[#282d38] bg-[#161922] p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reportConfirmation ? (
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="h-11 w-11 text-[#39FF14] mx-auto" />
                <p className="text-sm text-white">{reportConfirmation}</p>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4" noValidate>
                {reportErrors.form && (
                  <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
                    {reportErrors.form}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="report-reason"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                  >
                    Reason for Report
                  </label>
                  <select
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as any)}
                    className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3 py-2.5 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                  >
                    <option value="duplicate">Duplicate Problem</option>
                    <option value="inaccurate">Inaccurate / Outdated Information</option>
                    <option value="spam">Spam or Promotional Content</option>
                    <option value="out_of_scope">Out of Engineering / Startup Scope</option>
                    <option value="other">Other Quality Concern</option>
                  </select>
                </div>

                {reportReason === 'duplicate' && (
                  <div>
                    <label
                      htmlFor="report-dup-code"
                      className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                    >
                      Duplicate Problem Code (Optional)
                    </label>
                    <input
                      id="report-dup-code"
                      type="text"
                      value={reportDuplicateCode}
                      onChange={(e) => setReportDuplicateCode(e.target.value)}
                      placeholder="e.g., PX-0042"
                      className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="report-details"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                  >
                    Details for ESC Admin Review <span className="text-[#39FF14]">*</span>
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Explain what should be corrected, merged, or moderated..."
                    className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                  />
                  {reportErrors.details && (
                    <p className="mt-1 text-xs text-red-400">{reportErrors.details}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingReport ? 'Sending Report...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
