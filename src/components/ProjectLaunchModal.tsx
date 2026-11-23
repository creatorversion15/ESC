import React, { useState } from 'react';
import { X, Rocket, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { ProjectStatus } from '../types';

interface ProjectLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProjectLaunchModal: React.FC<ProjectLaunchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, isApprovedMember, signInWithGoogle } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Robotics & Mechatronics');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to launch a project.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError('Project title and description are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const parsedObjectives = objectives
        .split('\n')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      const parsedSkills = requiredSkills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const projectsCol = collection(db, 'projects');
      const newDocRef = doc(projectsCol);

      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        leaderId: user.uid,
        leaderName: user.displayName || 'Lead Engineer',
        leaderEmail: user.email || '',
        objectives: parsedObjectives.length > 0 ? parsedObjectives : ['Build prototype deliverable'],
        requiredSkills: parsedSkills,
        teamMemberIds: [user.uid],
        teamMembers: [
          { id: user.uid, name: user.displayName || 'Lead Engineer', role: 'Project Lead' },
        ],
        status: 'recruiting' as ProjectStatus,
        repoUrl: repoUrl.trim(),
        demoUrl: demoUrl.trim(),
        milestones: [
          { id: 'm1', title: 'Architecture & Schematic Signoff', targetDate: 'Next 30 days', completed: false },
        ],
        tasks: [
          { id: 't1', title: 'Set up hardware / software repository', completed: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(newDocRef, payload);
      await syncToSqlApi('/api/projects', 'POST', { id: newDocRef.id, ...payload });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#38bdf8', '#ffffff'],
      });

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to launch project.');
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
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Launch Engineering Project Workspace
              </h3>
              <p className="text-xs text-[#8e919b]">
                Establish a multidisciplinary project, recruit specialized student talent, and track milestones.
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
              Please sign in with Google to create a project workspace.
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
              Project Successfully Initialized!
            </h4>
            <p className="text-xs text-[#9ca3af] max-w-md mx-auto">
              Your project workspace is live. Other student engineers can discover your project in Explore Projects and apply to join your team.
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
                Project Name *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AeroGlide — Autonomous Urban Delivery Drone"
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
              >
                <option value="Robotics & Mechatronics">Robotics & Mechatronics</option>
                <option value="Biomedical & Hardware">Biomedical & Hardware</option>
                <option value="CleanTech & Thermodynamics">CleanTech & Thermodynamics</option>
                <option value="AI & Autonomous Systems">AI & Autonomous Systems</option>
                <option value="Aerospace & Avionics">Aerospace & Avionics</option>
                <option value="IoT & Smart Infrastructure">IoT & Smart Infrastructure</option>
                <option value="Web3 & Distributed Systems">Web3 & Distributed Systems</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Project Overview & Vision *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you engineering, and what is the technical roadmap?"
                rows={3}
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Key Objectives (one per line)
              </label>
              <textarea
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="e.g. Design lightweight carbon-fiber chassis&#10;Implement Kalman filter sensor fusion&#10;Conduct outdoor endurance test"
                rows={3}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Skills You Are Recruiting (comma separated)
              </label>
              <input
                type="text"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="e.g. ROS2, FreeRTOS, SolidWorks, PyTorch"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">
                  GitHub / Hardware Repo
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">
                  Demo / Simulation Link
                </label>
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
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
                {loading ? 'Creating...' : 'Launch Workspace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
