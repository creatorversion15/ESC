import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Search, 
  Filter, 
  Plus, 
  Flame, 
  CheckCircle2, 
  Users, 
  ChevronRight, 
  X,
  Share2,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, getDocs, doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ProblemSubmissionModal } from '../components/ProblemSubmissionModal';
import type { ProblemStatement, ProblemDifficulty, ProblemStatus } from '../types';

interface ProblemsProps {
  navigate: (path: string) => void;
}

export const Problems: React.FC<ProblemsProps> = ({ navigate }) => {
  const { user, signInWithGoogle } = useAuth();

  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ProblemStatement | null>(null);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'problems'));
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProblemStatement));
        setProblems(list);
      } else {
        const { INITIAL_PROBLEMS } = await import('../lib/seedData');
        setProblems(INITIAL_PROBLEMS.map((p, i) => ({ id: `init_prob_${i}`, ...p })));
      }
    } catch (err) {
      console.error('Error fetching problems:', err);
      const { INITIAL_PROBLEMS } = await import('../lib/seedData');
      setProblems(INITIAL_PROBLEMS.map((p, i) => ({ id: `init_prob_${i}`, ...p })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleToggleInterest = async (problem: ProblemStatement) => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    const problemRef = doc(db, 'problems', problem.id!);
    const hasExpressed = problem.interestedUserIds?.includes(user.uid);

    try {
      if (hasExpressed) {
        await updateDoc(problemRef, {
          interestCount: increment(-1),
          interestedUserIds: arrayRemove(user.uid),
          updatedAt: new Date().toISOString(),
        });
        setProblems((prev) =>
          prev.map((p) =>
            p.id === problem.id
              ? {
                  ...p,
                  interestCount: Math.max((p.interestCount || 1) - 1, 0),
                  interestedUserIds: p.interestedUserIds.filter((id) => id !== user.uid),
                }
              : p
          )
        );
      } else {
        await updateDoc(problemRef, {
          interestCount: increment(1),
          interestedUserIds: arrayUnion(user.uid),
          updatedAt: new Date().toISOString(),
        });
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#CCFF00', '#ffffff'],
        });
        setProblems((prev) =>
          prev.map((p) =>
            p.id === problem.id
              ? {
                  ...p,
                  interestCount: (p.interestCount || 0) + 1,
                  interestedUserIds: [...(p.interestedUserIds || []), user.uid],
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Error toggling interest:', err);
    }
  };

  const filteredProblems = problems.filter((prob) => {
    if (industryFilter !== 'all' && prob.industry !== industryFilter) return false;
    if (difficultyFilter !== 'all' && prob.difficulty !== difficultyFilter) return false;
    if (statusFilter !== 'all' && prob.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = prob.title.toLowerCase().includes(q);
      const matchDesc = prob.description.toLowerCase().includes(q);
      const matchSkills = prob.skillsRequired?.some((s) => s.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchSkills) return false;
    }
    return true;
  });

  const industries = Array.from(new Set(problems.map((p) => p.industry))).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1f2229] pb-8">
          <div className="space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              Problem Discovery Platform
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
              The ESC Problem Bank
            </h1>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
              Real engineering solutions start with real friction. Discover verified problem briefs from agriculture, power grids, healthcare, and robotics, or submit friction observed in your local community.
            </p>
          </div>

          <button
            onClick={() => {
              if (!user) signInWithGoogle();
              else setIsSubmitModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] shadow-lg shadow-[#CCFF00]/20 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus className="h-4 w-4" /> Submit A Problem
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problem title, engineering disciplines, or keywords..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
            >
              <option value="all">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner Sprint</option>
              <option value="intermediate">Intermediate Build</option>
              <option value="advanced">Advanced DeepTech</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open for Tackling</option>
              <option value="team_formation">Team Forming</option>
              <option value="in_progress">Active in Projects</option>
              <option value="solved">Solved Prototype</option>
            </select>
          </div>
        </div>

        {/* Problems List */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2"></span>
            Loading Problem Bank from Firestore...
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
            <Target className="h-10 w-10 text-[#52525b] mx-auto" />
            <h3 className="font-display text-lg font-bold text-white">No problem statements found</h3>
            <p className="text-xs text-[#8e919b]">Contribute the first problem for this category.</p>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-bold text-black uppercase"
            >
              Submit Problem
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProblems.map((prob) => {
              const hasExpressed = user && prob.interestedUserIds?.includes(user.uid);
              return (
                <div
                  key={prob.id}
                  className="group flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-6 hover:border-[#CCFF00]/50 transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="rounded bg-[#1b1e25] border border-[#2b2f38] px-2.5 py-1 text-[#CCFF00]">
                        {prob.industry}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 uppercase ${
                        prob.difficulty === 'advanced' ? 'text-red-400 bg-red-950/30' :
                        prob.difficulty === 'intermediate' ? 'text-amber-400 bg-amber-950/30' :
                        'text-emerald-400 bg-emerald-950/30'
                      }`}>
                        {prob.difficulty}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-lg font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                        {prob.title}
                      </h3>
                      <p className="text-xs text-[#8e919b] mt-2 line-clamp-4 leading-relaxed">
                        {prob.description}
                      </p>
                    </div>

                    {prob.skillsRequired && prob.skillsRequired.length > 0 && (
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
                          Key Disciplines:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {prob.skillsRequired.map((s, i) => (
                            <span key={i} className="rounded bg-[#181a20] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#1c1f26] pt-4 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleInterest(prob)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                        hasExpressed
                          ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/20'
                          : 'bg-[#181a20] text-zinc-300 border border-[#2b2f38] hover:border-[#CCFF00]/50'
                      }`}
                    >
                      <Flame className={`h-4 w-4 ${hasExpressed ? 'fill-black' : 'text-[#CCFF00]'}`} />
                      <span>{prob.interestCount || 0} Interested</span>
                    </button>

                    <button
                      onClick={() => setSelectedProblem(prob)}
                      className="text-xs font-semibold text-[#CCFF00] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Full Brief <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Problem Detail Modal */}
        {selectedProblem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-[#CCFF00] uppercase">
                      {selectedProblem.industry}
                    </span>
                    <span className="text-[10px] text-zinc-500">•</span>
                    <span className="text-[10px] font-mono text-zinc-400 capitalize">
                      {selectedProblem.difficulty} Difficulty
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    {selectedProblem.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedProblem(null)}
                  className="rounded-lg p-1.5 text-[#9ca3af] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-white mb-1">Detailed Problem Description</h4>
                  <p className="text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">{selectedProblem.description}</p>
                </div>

                {selectedProblem.skillsRequired && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Recommended Engineering Skillsets</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProblem.skillsRequired.map((s, idx) => (
                        <span key={idx} className="rounded-lg bg-[#1a1d24] border border-[#2b2f38] px-2.5 py-1 font-mono text-zinc-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#262933] bg-[#14161c] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block">Curator / Source</span>
                    <span className="font-semibold text-white">{selectedProblem.authorName || 'ESC Advisory'}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleInterest(selectedProblem)}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                        user && selectedProblem.interestedUserIds?.includes(user.uid)
                          ? 'bg-[#CCFF00] text-black'
                          : 'bg-[#232731] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black'
                      }`}
                    >
                      <Flame className="h-4 w-4" />
                      {user && selectedProblem.interestedUserIds?.includes(user.uid)
                        ? 'Interested (Tagged)'
                        : 'Express Interest'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProblem(null);
                        navigate('/projects');
                      }}
                      className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
                    >
                      Form a Team
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Problem Submission Modal */}
        <ProblemSubmissionModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onSuccess={() => {
            fetchProblems();
          }}
        />

      </div>
    </div>
  );
};
