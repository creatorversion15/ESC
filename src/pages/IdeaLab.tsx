import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Search, 
  Plus, 
  ExternalLink, 
  Sparkles, 
  Target, 
  Lock, 
  Globe, 
  X, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Rocket,
  Bot,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { IdeaSubmissionModal } from '../components/IdeaSubmissionModal';
import { filterStartupIdeas } from '../utils/escLogic';
import type { StartupIdea, StartupStage } from '../types';

interface IdeaLabProps {
  navigate: (path: string) => void;
}

export const IdeaLab: React.FC<IdeaLabProps> = ({ navigate }) => {
  const { user, isAdmin, signInWithGoogle } = useAuth();

  const [ideas, setIdeas] = useState<StartupIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<StartupIdea | null>(null);

  const fetchIdeas = async () => {
    try {
      setLoading(true);
      let loaded: StartupIdea[] = [];
      if (isAdmin) {
        const snap = await getDocs(collection(db, 'ideas'));
        loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StartupIdea));
      } else {
        const publicSnap = await getDocs(query(collection(db, 'ideas'), where('isPublic', '==', true)));
        const map = new Map<string, StartupIdea>();
        publicSnap.docs.forEach((d) => {
          map.set(d.id, { id: d.id, ...d.data() } as StartupIdea);
        });
        if (user) {
          const ownSnap = await getDocs(query(collection(db, 'ideas'), where('authorId', '==', user.uid)));
          ownSnap.docs.forEach((d) => {
            map.set(d.id, { id: d.id, ...d.data() } as StartupIdea);
          });
        }
        loaded = Array.from(map.values());
      }

      if (loaded.length > 0) {
        setIdeas(loaded);
      } else {
        const { INITIAL_IDEAS } = await import('../lib/seedData');
        setIdeas(INITIAL_IDEAS.map((idea, idx) => ({ id: `init_idea_${idx}`, ...idea })));
      }
    } catch (err) {
      console.error('Error fetching startup ideas:', err);
      const { INITIAL_IDEAS } = await import('../lib/seedData');
      setIdeas(INITIAL_IDEAS.map((idea, idx) => ({ id: `init_idea_${idx}`, ...idea })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [user, isAdmin]);

  const filteredIdeas = filterStartupIdeas(ideas, {
    stage: stageFilter,
    industry: industryFilter,
    search,
  });

  const industries = Array.from(new Set(ideas.map((i) => i.industry))).filter(Boolean);

  const STAGES: { key: string; label: string }[] = [
    { key: 'all', label: 'All Stages' },
    { key: 'idea', label: 'Idea Stage' },
    { key: 'research', label: 'Research' },
    { key: 'prototype', label: 'Prototype' },
    { key: 'mvp', label: 'MVP' },
    { key: 'launched', label: 'Launched' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1f2229] pb-8">
          <div className="space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              DeepTech Incubator
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
              ESC Startup Idea Lab
            </h1>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
              Browse peer-reviewed student startup ideas, from airborne wind generators to ASIC cochlear chips. Find a project to back, co-found, or mentor.
            </p>
          </div>

          <button
            onClick={() => {
              if (!user) signInWithGoogle();
              else setIsSubmitModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] shadow-lg shadow-[#CCFF00]/20 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus className="h-4 w-4" /> Submit Startup Idea
          </button>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(s.key)}
              className={`rounded-xl px-4 py-2 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                stageFilter === s.key
                  ? 'bg-[#CCFF00] text-black shadow-md'
                  : 'bg-[#14161c] text-zinc-400 border border-[#232731] hover:text-white hover:border-[#CCFF00]/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search & Industry Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startup concepts, technologies, or founder names..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none w-full sm:w-auto"
          >
            <option value="all">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        {/* Ideas Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2"></span>
            Syncing Startup Lab ideas from Firestore...
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
            <Lightbulb className="h-10 w-10 text-[#52525b] mx-auto" />
            <h3 className="font-display text-lg font-bold text-white">No startup ideas found</h3>
            <p className="text-xs text-[#8e919b]">Be the first student engineer to submit an idea in this category.</p>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-bold text-black uppercase"
            >
              Submit Idea
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIdeas.map((idea) => (
              <div
                key={idea.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-6 hover:border-[#CCFF00]/50 transition-all"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="rounded bg-[#1b1e25] border border-[#2b2f38] px-2.5 py-1 text-[#CCFF00]">
                      {idea.industry}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {idea.aiAssisted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-[10px] text-purple-200">
                          <Bot className="h-3 w-3" /> AI-Assisted
                        </span>
                      )}
                      <span className="rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-2 py-0.5 text-[#CCFF00] uppercase font-semibold">
                        {idea.stage}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                      {idea.title}
                    </h3>
                    <p className="text-xs text-[#8e919b] mt-2 line-clamp-3 leading-relaxed">
                      {idea.problemStatement}
                    </p>
                  </div>

                  {/* UVP highlight */}
                  {idea.uniqueValueProposition && (
                    <div className="rounded-xl border border-[#252833] bg-[#14171d] p-3 text-xs">
                      <span className="text-[10px] font-mono text-[#CCFF00] uppercase block">
                        Unique Value Proposition:
                      </span>
                      <p className="text-zinc-200 mt-0.5 leading-relaxed">{idea.uniqueValueProposition}</p>
                    </div>
                  )}

                  {/* Skills required */}
                  {idea.skillsRequired && idea.skillsRequired.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
                        Looking for Talent with:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {idea.skillsRequired.map((s, i) => (
                          <span key={i} className="rounded bg-[#181a20] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#1c1f26] pt-4 flex items-center justify-between text-xs">
                  <span className="text-[#9ca3af]">
                    Founder: <strong className="text-white">{idea.authorName}</strong>
                  </span>

                  <button
                    onClick={() => setSelectedIdea(idea)}
                    className="rounded-xl border border-[#2b2f38] px-3.5 py-1.5 font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-colors cursor-pointer"
                  >
                    View Pitch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detailed Idea Pitch Modal */}
        {selectedIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-[#CCFF00] uppercase">
                      {selectedIdea.industry}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="font-mono text-[10px] text-zinc-400 uppercase">
                      {selectedIdea.stage} Stage
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    {selectedIdea.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedIdea(null)}
                  className="rounded-lg p-1.5 text-[#9ca3af] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-white mb-1">Problem Statement</h4>
                  <p className="text-[#d4d4d8] leading-relaxed">{selectedIdea.problemStatement}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-1">Proposed Technical Solution</h4>
                  <p className="text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">{selectedIdea.proposedSolution}</p>
                </div>

                {selectedIdea.targetAudience && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Target Market / Customers</h4>
                    <p className="text-[#9ca3af]">{selectedIdea.targetAudience}</p>
                  </div>
                )}

                {selectedIdea.uniqueValueProposition && (
                  <div className="rounded-xl border border-[#CCFF00]/30 bg-[#CCFF00]/5 p-3.5">
                    <h4 className="font-mono text-[#CCFF00] uppercase text-[11px] mb-1">Unique Value Proposition</h4>
                    <p className="text-white font-medium">{selectedIdea.uniqueValueProposition}</p>
                  </div>
                )}

                {selectedIdea.teamRequirements && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Co-Founder & Team Requirements</h4>
                    <p className="text-[#d4d4d8]">{selectedIdea.teamRequirements}</p>
                  </div>
                )}

                {selectedIdea.fundingRequirements && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Funding or Mentorship Needs</h4>
                    <p className="text-[#d4d4d8]">{selectedIdea.fundingRequirements}</p>
                  </div>
                )}

                {selectedIdea.demoUrl && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Demo / Prototype Link</h4>
                    <a
                      href={selectedIdea.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#CCFF00] hover:underline flex items-center gap-1.5"
                    >
                      {selectedIdea.demoUrl} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <div className="rounded-xl border border-[#262933] bg-[#14161c] p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block">Founder</span>
                    <span className="font-semibold text-white">{selectedIdea.authorName}</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedIdea(null);
                      navigate('/projects');
                    }}
                    className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                  >
                    Explore Active Projects
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Idea Submission Modal */}
        <IdeaSubmissionModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onSuccess={() => {
            fetchIdeas();
          }}
        />

      </div>
    </div>
  );
};
