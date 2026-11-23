import React, { useState } from 'react';
import { X, Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { ProblemDifficulty, ProblemStatus } from '../types';

interface ProblemSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProblemSubmissionModal: React.FC<ProblemSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, isAdmin, signInWithGoogle } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('CleanTech & Energy');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('intermediate');
  const [status, setStatus] = useState<ProblemStatus>('open');
  const [skillsRequired, setSkillsRequired] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to submit a problem.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const parsedSkills = skillsRequired
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const problemsCol = collection(db, 'problems');
      const newDocRef = doc(problemsCol);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        industry,
        difficulty,
        status,
        skillsRequired: parsedSkills,
        interestCount: 1,
        interestedUserIds: [user.uid],
        authorId: user.uid,
        authorName: user.displayName || 'Engineering Student',
        verifiedByAdmin: Boolean(isAdmin),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(newDocRef, payload);
      await syncToSqlApi('/api/problems', 'POST', { id: newDocRef.id, ...payload });
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to submit problem statement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#CCFF00]/10 p-2 text-[#CCFF00]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Submit Real-World Problem Statement
              </h3>
              <p className="text-xs text-[#8e919b]">
                Add an industrial, environmental, or community friction for multidisciplinary engineering teams to tackle.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1f2229] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-[#9ca3af]">
              Please sign in with Google to contribute problems to the bank.
            </p>
            <button
              onClick={() => signInWithGoogle()}
              className="rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600]"
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
              Problem Statement Added!
            </h4>
            <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
              Your problem is now listed in the ESC Problem Bank. Other student engineers can explore and assemble teams to solve it.
            </p>
            <button
              onClick={onClose}
              className="rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase text-black"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-950/40 border border-red-800 p-3 text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-white mb-1">
                Problem Statement Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ultra-Low Power Sensor Node for Groundwater Contamination"
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">
                  Industry / Domain
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="CleanTech & Energy">CleanTech & Energy</option>
                  <option value="AI & Robotics">AI & Robotics</option>
                  <option value="MedTech & BioEngineering">MedTech & BioEngineering</option>
                  <option value="EV & Automotive">EV & Automotive</option>
                  <option value="Agritech & Water">Agritech & Water</option>
                  <option value="Industrial & Hardware">Industrial & Hardware</option>
                  <option value="Environmental & Smart Cities">Environmental & Smart Cities</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as ProblemDifficulty)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="beginner">Beginner (1-2 weeks sprint)</option>
                  <option value="intermediate">Intermediate (Month-long build)</option>
                  <option value="advanced">Advanced (DeepTech / Multi-term)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Problem Description & Constraints *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe why this problem exists, who is affected, and existing shortcomings..."
                rows={4}
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Skills / Disciplines Required (comma separated)
              </label>
              <input
                type="text"
                value={skillsRequired}
                onChange={(e) => setSkillsRequired(e.target.value)}
                placeholder="e.g. Embedded C, PCB Design, Fluid Mechanics, PyTorch"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23262d]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs font-semibold text-[#8e919b] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Publish Problem'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
