import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { StartupStage } from '../types';

export interface IdeaProposalDraft {
  id?: string;
  title: string;
  problemStatement: string;
  proposedSolution: string;
  industry: string;
  stage: StartupStage;
  targetAudience: string;
  uniqueValueProposition: string;
  skillsRequired: string[];
  demoUrl: string;
  fundingRequirements: string;
  persistedToDb: boolean;
}

interface IdeaSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProposal?: Partial<IdeaProposalDraft> | null;
  allowDraftReturn?: boolean;
  onProposalSaved?: (proposal: IdeaProposalDraft) => void;
}

export const IdeaSubmissionModal: React.FC<IdeaSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialProposal,
  allowDraftReturn = false,
  onProposalSaved,
}) => {
  const { user, profile, signInWithGoogle } = useAuth();

  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [industry, setIndustry] = useState('AI & Robotics');
  const [uniqueValueProposition, setUniqueValueProposition] = useState('');
  const [stage, setStage] = useState<StartupStage>('idea');
  const [demoUrl, setDemoUrl] = useState('');
  const [skillsRequired, setSkillsRequired] = useState('');
  const [fundingRequirements, setFundingRequirements] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitted(false);
    if (initialProposal) {
      setTitle(initialProposal.title || '');
      setProblemStatement(initialProposal.problemStatement || '');
      setProposedSolution(initialProposal.proposedSolution || '');
      setIndustry(initialProposal.industry || 'AI & Robotics');
      setStage(initialProposal.stage || 'idea');
      setTargetAudience(initialProposal.targetAudience || '');
      setUniqueValueProposition(initialProposal.uniqueValueProposition || '');
      setSkillsRequired(
        Array.isArray(initialProposal.skillsRequired)
          ? initialProposal.skillsRequired.join(', ')
          : ''
      );
      setDemoUrl(initialProposal.demoUrl || '');
      setFundingRequirements(initialProposal.fundingRequirements || '');
    }
  }, [isOpen, initialProposal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !problemStatement.trim() || !proposedSolution.trim()) {
      setError('Startup / Product Name, Problem Statement, and Proposed Solution are required.');
      return;
    }

    const parsedSkills = skillsRequired
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // When opened inside the Fellowship Application before Google Sign-In,
    // allow attaching the proposal draft to the application so it saves on final submit.
    if (!user && allowDraftReturn && onProposalSaved) {
      onProposalSaved({
        title: title.trim(),
        problemStatement: problemStatement.trim(),
        proposedSolution: proposedSolution.trim(),
        industry,
        stage,
        targetAudience: targetAudience.trim(),
        uniqueValueProposition: uniqueValueProposition.trim(),
        skillsRequired: parsedSkills,
        demoUrl: demoUrl.trim(),
        fundingRequirements: fundingRequirements.trim(),
        persistedToDb: false,
      });
      onClose();
      return;
    }

    if (!user) {
      setError('Please sign in to submit a startup idea.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const ideasCol = collection(db, 'ideas');
      const newDocRef = initialProposal?.id
        ? doc(db, 'ideas', initialProposal.id)
        : doc(ideasCol);

      const nowIso = new Date().toISOString();
      const payload = {
        title: title.trim(),
        problemStatement: problemStatement.trim(),
        targetAudience: targetAudience.trim(),
        proposedSolution: proposedSolution.trim(),
        industry,
        uniqueValueProposition: uniqueValueProposition.trim(),
        stage,
        demoUrl: demoUrl.trim(),
        skillsRequired: parsedSkills,
        teamRequirements: '',
        fundingRequirements: fundingRequirements.trim(),
        isPublic: false,
        authorId: user.uid,
        authorName: user.displayName || profile?.fullName || 'Student Founder',
        authorEmail: user.email || '',
        reviewStatus: 'under_review',
        aiAssisted: false,
        adminFeedback: '',
        decisionHistory: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(newDocRef, payload, { merge: true });
      await syncToSqlApi('/api/ideas', 'POST', { id: newDocRef.id, ...payload });

      const savedProposal: IdeaProposalDraft = {
        id: newDocRef.id,
        title: payload.title,
        problemStatement: payload.problemStatement,
        proposedSolution: payload.proposedSolution,
        industry: payload.industry,
        stage: payload.stage,
        targetAudience: payload.targetAudience,
        uniqueValueProposition: payload.uniqueValueProposition,
        skillsRequired: payload.skillsRequired,
        demoUrl: payload.demoUrl,
        fundingRequirements: payload.fundingRequirements,
        persistedToDb: true,
      };

      if (onProposalSaved) {
        onProposalSaved(savedProposal);
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#ffffff', '#22c55e'],
      });

      if (onProposalSaved && allowDraftReturn) {
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to save idea. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Startup or Product Idea Proposal Form"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-5 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#CCFF00]/10 p-2 text-[#CCFF00]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Startup / Product Idea Proposal
              </h3>
              <p className="text-xs text-[#8e919b]">
                Submit your engineering concept for ESC review and programme support.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close proposal form"
            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1f2229] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user && !allowDraftReturn ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-[#9ca3af]">
              You must sign in with Google to submit an idea and track review status.
            </p>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        ) : submitted ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="font-display text-xl font-bold text-white">
              Idea Submitted — Status: Under Review
            </h4>
            <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
              Your startup proposal has been recorded with status{' '}
              <strong className="text-amber-300">Under Review</strong>. You can track decisions and feedback in your Dashboard.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
            {/* Short top notice */}
            <p className="rounded-lg border border-[#2b2f38] bg-[#151820] px-3.5 py-2 text-[11px] font-medium text-zinc-300">
              All startup and product ideas are subject to ESC Admin review and approval.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-950/40 border border-red-800 p-3 text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="idea-title" className="block font-semibold text-white mb-1">
                Startup / Product Name *
              </label>
              <input
                id="idea-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. HyperKite — High-Altitude Wind Generator"
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="idea-domain" className="block font-semibold text-white mb-1">
                  Engineering Domain *
                </label>
                <select
                  id="idea-domain"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="AI & Robotics">AI & Robotics</option>
                  <option value="CleanTech & Energy">CleanTech & Energy</option>
                  <option value="MedTech & BioEngineering">MedTech & BioEngineering</option>
                  <option value="Aerospace & Defense">Aerospace & Defense</option>
                  <option value="EV & Automotive">EV & Automotive</option>
                  <option value="Hardware & IoT">Hardware & IoT</option>
                  <option value="Semiconductors">Semiconductors</option>
                  <option value="Web3 & FinTech">Web3 & FinTech</option>
                  <option value="Agritech & Water">Agritech & Water</option>
                </select>
              </div>

              <div>
                <label htmlFor="idea-stage" className="block font-semibold text-white mb-1">
                  Development Stage *
                </label>
                <select
                  id="idea-stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as StartupStage)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="idea">Idea Stage</option>
                  <option value="research">Research Stage</option>
                  <option value="prototype">Prototype Stage</option>
                  <option value="mvp">MVP Stage</option>
                  <option value="launched">Launched Product</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="idea-problem" className="block font-semibold text-white mb-1">
                Problem Statement *
              </label>
              <textarea
                id="idea-problem"
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="What real engineering or market friction does this address?"
                rows={2}
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="idea-solution" className="block font-semibold text-white mb-1">
                Proposed Solution / Idea Description *
              </label>
              <textarea
                id="idea-solution"
                value={proposedSolution}
                onChange={(e) => setProposedSolution(e.target.value)}
                placeholder="How does your technology or product solve this problem?"
                rows={3}
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="idea-audience" className="block font-semibold text-white mb-1">
                  Target Audience / Customer
                </label>
                <input
                  id="idea-audience"
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Municipal water authorities, EV fleet operators"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="idea-uvp" className="block font-semibold text-white mb-1">
                  Unique Value Proposition (UVP)
                </label>
                <input
                  id="idea-uvp"
                  type="text"
                  value={uniqueValueProposition}
                  onChange={(e) => setUniqueValueProposition(e.target.value)}
                  placeholder="e.g. 5x faster at 1/10th the power consumption"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="idea-tech-req" className="block font-semibold text-white mb-1">
                  Technical Requirements
                </label>
                <input
                  id="idea-tech-req"
                  type="text"
                  value={skillsRequired}
                  onChange={(e) => setSkillsRequired(e.target.value)}
                  placeholder="e.g. ROS2, PCB Design, PyTorch, Embedded C"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="idea-demo-url" className="block font-semibold text-white mb-1">
                  Prototype Demo URL / GitHub
                </label>
                <input
                  id="idea-demo-url"
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="idea-funding" className="block font-semibold text-white mb-1">
                Funding or Mentorship Needs (Optional)
              </label>
              <input
                id="idea-funding"
                type="text"
                value={fundingRequirements}
                onChange={(e) => setFundingRequirements(e.target.value)}
                placeholder="e.g. ₹50,000 for sensor breakout boards, or advice on battery BMS"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23262d]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2b2f38] px-4 py-2.5 text-xs font-semibold text-[#8e919b] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
              >
                {loading
                  ? 'Submitting...'
                  : allowDraftReturn && !user
                    ? 'Save Proposal to Application'
                    : 'Submit Startup Idea'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
