import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  ExternalLink,
  Eye,
  X,
  AlertCircle,
  Clock,
  MapPin,
  Briefcase,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { canApplyToOpportunity, isOpportunityPubliclyVisible } from '../utils/escLogic';
import type {
  OpportunityApplication,
  OpportunityCategory,
  OpportunityItem,
} from '../types';

interface OpportunitiesProps {
  navigate: (path: string) => void;
}

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  grant: 'Prototyping Grant',
  internship: 'Engineering Internship',
  fellowship: 'Founder Fellowship',
  lab_access: 'Lab & Equipment Access',
  mentorship: 'Mentor Office Hours',
  ip_legal: 'IP & Patent Support',
  other: 'Opportunity',
};

export const Opportunities: React.FC<OpportunitiesProps> = ({ navigate }) => {
  const { user, profile, signInWithGoogle } = useAuth();

  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [applications, setApplications] = useState<Record<string, OpportunityApplication>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [detailOpp, setDetailOpp] = useState<OpportunityItem | null>(null);
  const [applyTarget, setApplyTarget] = useState<OpportunityItem | null>(null);
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const q = query(collection(db, 'opportunities'), where('isPublished', '==', true));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as OpportunityItem))
        .filter((o) => isOpportunityPubliclyVisible(o))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setOpportunities(list);

      if (user) {
        const appSnap = await getDocs(
          query(collection(db, 'opportunityApplications'), where('userId', '==', user.uid))
        );
        const map: Record<string, OpportunityApplication> = {};
        appSnap.docs.forEach((d) => {
          const item = { id: d.id, ...d.data() } as OpportunityApplication;
          map[item.opportunityId] = item;
        });
        setApplications(map);
      } else {
        setApplications({});
      }
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setErrorMsg('Unable to load opportunities right now. Please try again.');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [user?.uid]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      if (categoryFilter !== 'all' && opp.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          opp.title?.toLowerCase().includes(q) ||
          opp.organization?.toLowerCase().includes(q) ||
          opp.description?.toLowerCase().includes(q) ||
          opp.requiredSkills?.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [opportunities, categoryFilter, search]);

  const openApplyModal = (opp: OpportunityItem) => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    setCollege(profile?.college || '');
    setBranch(profile?.branch || '');
    setPortfolioUrl(profile?.portfolioUrl || profile?.githubUrl || '');
    setStatement('');
    setApplyTarget(opp);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !applyTarget?.id) return;

    const gate = canApplyToOpportunity(applyTarget);
    if (!gate.allowed) {
      setBanner({ type: 'error', text: gate.reason || 'Applications are closed.' });
      return;
    }

    if (!statement.trim() || statement.trim().length < 15) {
      setBanner({
        type: 'error',
        text: 'Please write a brief statement explaining your fit or project needs.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const appId = `oppapp_${user.uid}_${applyTarget.id}`;
      const now = new Date().toISOString();
      const alreadyApplied = Boolean(applications[applyTarget.id]);

      const record: OpportunityApplication = {
        id: appId,
        opportunityId: applyTarget.id,
        opportunityTitle: applyTarget.title,
        userId: user.uid,
        userName: profile?.fullName || user.displayName || 'Engineering Student',
        userEmail: user.email || '',
        college: college.trim(),
        branch: branch.trim(),
        portfolioUrl: portfolioUrl.trim(),
        statement: statement.trim(),
        status: 'submitted',
        appliedAt: now,
      };

      await setDoc(doc(db, 'opportunityApplications', appId), record);
      await syncToSqlApi(
        `/api/opportunities/${encodeURIComponent(applyTarget.id)}/apply`,
        'POST',
        record
      );

      if (!alreadyApplied) {
        await updateDoc(doc(db, 'opportunities', applyTarget.id), {
          applicationsCount: increment(1),
          updatedAt: now,
        });
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === applyTarget.id
              ? { ...o, applicationsCount: (o.applicationsCount || 0) + 1 }
              : o
          )
        );
      }

      setApplications((prev) => ({ ...prev, [applyTarget.id!]: record }));
      setBanner({
        type: 'success',
        text: `Application submitted for "${applyTarget.title}". Track review status in your Dashboard.`,
      });
      setApplyTarget(null);
    } catch (err: any) {
      console.error('Opportunity application error:', err);
      setBanner({ type: 'error', text: err?.message || 'Failed to submit application.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Header */}
        <div className="border-b border-[#1f2229] pb-8 space-y-3">
          <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
            Founder Resources
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
            Grants, Labs &amp; Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
            Verified prototyping grants, internships, fellowships, lab access, and mentorship programs curated and published directly by ESC Super Admin.
          </p>
        </div>

        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
              banner.type === 'success'
                ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                : 'border-red-800 bg-red-950/40 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grants, internships, labs, or skills..."
              className="w-full rounded-xl border border-[#262933] bg-[#12141a] pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'all', label: 'All' },
              { key: 'grant', label: 'Grants' },
              { key: 'internship', label: 'Internships' },
              { key: 'fellowship', label: 'Fellowships' },
              { key: 'lab_access', label: 'Lab Access' },
              { key: 'mentorship', label: 'Mentorship' },
              { key: 'ip_legal', label: 'IP & Legal' },
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                  categoryFilter === cat.key
                    ? 'bg-[#CCFF00] text-black'
                    : 'bg-[#14161c] text-zinc-400 border border-[#232731] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Opportunity Cards */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2" />
            Loading live opportunities...
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-900/50 bg-[#141013] p-10 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-200">{errorMsg}</p>
            <button
              onClick={loadOpportunities}
              className="rounded-xl border border-red-700 px-4 py-2 text-xs font-mono text-white hover:bg-red-900/40 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-14 text-center space-y-4">
            <Briefcase className="h-10 w-10 text-zinc-600 mx-auto" />
            <h3 className="font-display text-xl font-bold text-white">
              {opportunities.length === 0
                ? 'No live opportunities published yet'
                : 'No opportunities match your filter'}
            </h3>
            <p className="text-xs text-[#8e919b] max-w-md mx-auto leading-relaxed">
              {opportunities.length === 0
                ? 'New prototyping grants, lab partnerships, and internships will appear here as soon as the ESC Super Admin publishes them.'
                : 'Try adjusting your category filter or search query.'}
            </p>
            {opportunities.length > 0 ? (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setSearch('');
                }}
                className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/challenges')}
                className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Explore Challenges
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredOpportunities.map((opp) => {
              const existingApp = opp.id ? applications[opp.id] : undefined;
              const gate = canApplyToOpportunity(opp);

              return (
                <div
                  key={opp.id}
                  className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between hover:border-[#CCFF00]/50 transition-all"
                >
                  {opp.posterUrl && (
                    <div className="h-44 w-full overflow-hidden border-b border-[#1f2229] bg-[#0b0c0e]">
                      <img src={opp.posterUrl} alt={opp.title} className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="p-7 space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span className="rounded bg-[#1c1f26] px-2.5 py-1 text-[#CCFF00]">
                          {CATEGORY_LABELS[opp.category] || opp.category}
                        </span>
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#CCFF00]" />
                          {opp.applicationDeadline || 'Open'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-xl font-bold text-white">{opp.title}</h3>
                        {opp.organization && (
                          <p className="text-xs font-mono text-zinc-400 mt-1">{opp.organization}</p>
                        )}
                      </div>

                      {opp.allocationOrStipend && (
                        <div className="rounded-xl border border-[#282c38] bg-[#161820] p-3 text-xs">
                          <span className="font-mono text-[#CCFF00] block text-[10px] uppercase">
                            Allocation / Stipend / Value:
                          </span>
                          <span className="font-semibold text-white">{opp.allocationOrStipend}</span>
                        </div>
                      )}

                      <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                        {opp.description}
                      </p>

                      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
                        {opp.locationOrMode && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#CCFF00]" /> {opp.locationOrMode}
                          </span>
                        )}
                        {opp.eligibility && (
                          <span>
                            <strong className="text-white">Eligibility: </strong>
                            {opp.eligibility}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[#1c1f26] pt-4 flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => setDetailOpp(opp)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#2b2f38] bg-[#161820] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </button>

                      <div className="flex items-center gap-2">
                        {opp.externalApplyUrl && (
                          <a
                            href={opp.externalApplyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-[#2b2f38] px-3.5 py-2 text-xs font-mono text-[#CCFF00] hover:border-[#CCFF00]"
                          >
                            External Link <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}

                        {existingApp ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 px-3.5 py-2 font-mono text-xs text-emerald-300 capitalize">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            {existingApp.status.replace('_', ' ')}
                          </span>
                        ) : gate.allowed ? (
                          <button
                            onClick={() => openApplyModal(opp)}
                            className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
                          >
                            Apply Now
                          </button>
                        ) : (
                          <span className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-[11px] font-mono text-zinc-400">
                            {gate.reason || 'Closed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {detailOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 text-xs">
            <div className="flex items-start justify-between gap-4 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  {CATEGORY_LABELS[detailOpp.category] || detailOpp.category} •{' '}
                  {detailOpp.organization}
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-1">
                  {detailOpp.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailOpp(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailOpp.posterUrl && (
              <img
                src={detailOpp.posterUrl}
                alt={detailOpp.title}
                className="w-full h-44 object-cover rounded-xl border border-[#232731]"
              />
            )}

            <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
              {detailOpp.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4">
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Allocation / Value</span>
                <p className="text-white mt-0.5">{detailOpp.allocationOrStipend || 'See details'}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Deadline</span>
                <p className="text-white mt-0.5">{detailOpp.applicationDeadline || 'Open'}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Mode / Location</span>
                <p className="text-white mt-0.5">{detailOpp.locationOrMode || 'Remote / Hybrid'}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Contact</span>
                <p className="text-white mt-0.5">{detailOpp.contactInfo || 'Via ESC Portal'}</p>
              </div>
            </div>

            {detailOpp.eligibility && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Eligibility Requirements
                </span>
                <p className="text-zinc-300 whitespace-pre-line">{detailOpp.eligibility}</p>
              </div>
            )}

            {detailOpp.applyInstructions && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Application Instructions
                </span>
                <p className="text-zinc-300 whitespace-pre-line">{detailOpp.applyInstructions}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
              <button
                onClick={() => setDetailOpp(null)}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
              >
                Close
              </button>
              {detailOpp.id &&
                !applications[detailOpp.id] &&
                canApplyToOpportunity(detailOpp).allowed && (
                  <button
                    onClick={() => {
                      const target = detailOpp;
                      setDetailOpp(null);
                      openApplyModal(target);
                    }}
                    className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                  >
                    Apply Now
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  Apply for Opportunity
                </span>
                <h3 className="font-display text-base font-bold text-white mt-0.5">
                  {applyTarget.title}
                </h3>
              </div>
              <button
                onClick={() => setApplyTarget(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">College / University</label>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Branch / Discipline</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Portfolio / GitHub / Project Link
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Statement of Purpose / Project Allocation Need *
                </label>
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe your relevant engineering work, project objectives, or why you're applying..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
                <button
                  type="button"
                  onClick={() => setApplyTarget(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
