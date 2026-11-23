import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FolderGit2, X } from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { apiRequest } from '../../lib/apiClient';
import { validateMemberProjectInput } from '../../utils/memberOnboardingLogic';
import type { Project, ProjectStatus, StartupStage } from '../../types';

interface MemberProjectSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUid: string;
  userName: string;
  userEmail: string;
  onCreated: (project: Project) => void;
}

const PROJECT_DOMAINS = [
  'AI & Autonomous Systems',
  'Robotics & Mechatronics',
  'IoT & Smart Infrastructure',
  'CleanTech & Energy',
  'Biomedical & HealthTech',
  'AgriTech & Rural Innovation',
  'Aerospace & Drones',
  'FinTech & Developer Tools',
  'EdTech & Social Impact',
];

export const MemberProjectSubmissionModal: React.FC<MemberProjectSubmissionModalProps> = ({
  isOpen,
  onClose,
  userUid,
  userName,
  userEmail,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(PROJECT_DOMAINS[0]);
  const [stage, setStage] = useState<StartupStage>('prototype');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [objectives, setObjectives] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [needsMentorship, setNeedsMentorship] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const submitProject = async (targetStatus: 'draft' | 'submitted') => {
    const check = validateMemberProjectInput({
      title,
      description,
      category,
      problemStatement,
      proposedSolution,
      stage,
      repoUrl,
      demoUrl,
      websiteUrl,
      docsUrl,
      imageUrl,
    });
    if (!check.isValid) {
      setError(Object.values(check.errors)[0] || 'Please review the required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const parsedSkills = requiredSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedObjectives = [
        ...objectives
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean),
      ];
      if (problemStatement.trim()) {
        parsedObjectives.unshift(`Problem: ${problemStatement.trim()}`);
      }
      if (proposedSolution.trim()) {
        parsedObjectives.push(`Solution: ${proposedSolution.trim()}`);
      }
      if (needsMentorship) {
        parsedObjectives.push('Requested ESC Technical Mentorship & Support');
      }

      const newRef = doc(collection(db, 'projects'));
      const nowIso = new Date().toISOString();

      const payload: Project = {
        id: newRef.id,
        title: title.trim(),
        category,
        stage,
        description: description.trim(),
        problemStatement: problemStatement.trim(),
        proposedSolution: proposedSolution.trim(),
        leaderId: userUid,
        leaderName: userName,
        leaderEmail: userEmail,
        objectives: parsedObjectives.length > 0 ? parsedObjectives : ['Deliver engineering prototype'],
        requiredSkills: parsedSkills,
        teamMemberIds: [userUid],
        teamMembers: [{ id: userUid, name: userName, role: 'Project Lead' }],
        status: targetStatus as ProjectStatus,
        repoUrl: repoUrl.trim(),
        demoUrl: (demoUrl || websiteUrl).trim(),
        websiteUrl: websiteUrl.trim(),
        docsUrl: docsUrl.trim(),
        imageUrl: imageUrl.trim(),
        needsMentorship,
        milestones: [
          { id: 'm1', title: 'Initial Architecture & Review', targetDate: 'Next 21 days', completed: false },
        ],
        tasks: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Server-side validation & Cloud SQL persistence first (enforces approved active member check)
      await apiRequest('/api/projects', {
        method: 'POST',
        requireAuth: true,
        body: payload,
      });

      // Mirror to Firestore so Admin Project Management & live explorer stay synchronized
      await setDoc(newRef, payload, { merge: true }).catch(() => {});

      onCreated(payload);
      setSuccessMsg(
        targetStatus === 'draft'
          ? 'Project saved as Draft in your ESC Member Dashboard.'
          : 'Project submitted for ESC Admin review and synced with Admin Project Management!'
      );
    } catch (err: any) {
      setError(err?.message || 'Could not save your project. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-project-title"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f3c] bg-[#0f1116] p-6 space-y-5 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-3 border-b border-[#1f242e] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id="add-member-project-title" className="font-display text-lg font-bold text-white">
                Add New ESC Engineering Project
              </h3>
              <p className="text-xs text-zinc-400">
                Submit your project to your ESC portfolio and connect with ESC Admin review &amp; mentorship.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project submission modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#1a1e28] hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h4 className="font-display text-xl font-bold text-white">Project Saved Successfully</h4>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">{successMsg}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase text-black cursor-pointer"
            >
              Return to My Projects
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">
                  Project Title <span className="text-[#39FF14]">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SolarMesh — Off-Grid Farm Telemetry"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">
                    Domain / Category <span className="text-[#39FF14]">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-2.5 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                  >
                    {PROJECT_DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Project Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as StartupStage)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-2.5 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                  >
                    <option value="idea">Idea</option>
                    <option value="research">Research</option>
                    <option value="prototype">Prototype</option>
                    <option value="mvp">MVP</option>
                    <option value="launched">Launched</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">
                Project Description <span className="text-[#39FF14]">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize what you are building, key technical architecture, and target impact (min 15 chars)..."
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">Problem Statement</label>
                <textarea
                  rows={2}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="What real-world engineering problem does this solve?"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Proposed Solution</label>
                <textarea
                  rows={2}
                  value={proposedSolution}
                  onChange={(e) => setProposedSolution(e.target.value)}
                  placeholder="How does your hardware/software solution address it?"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">
                  Skills &amp; Tech Stack (comma separated)
                </label>
                <input
                  type="text"
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                  placeholder="e.g. STM32, ROS2, TypeScript, SolidWorks"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Key Milestones / Objectives</label>
                <input
                  type="text"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="e.g. Complete PCB v1 & outdoor field pilot"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">GitHub / Repository URL</label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Demo / Prototype Video URL</label>
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Website / Landing Link</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Supporting Docs / Image URL</label>
                <input
                  type="url"
                  value={docsUrl}
                  onChange={(e) => setDocsUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-[#252a36] bg-[#141720] px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={needsMentorship}
                onChange={(e) => setNeedsMentorship(e.target.checked)}
                className="accent-[#39FF14]"
              />
              <span className="text-zinc-200">
                Request ESC Technical Mentorship, Hardware Lab Guidance, or Review Support
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[#1f242e]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitProject('draft')}
                className="rounded-xl border border-[#39FF14]/40 bg-[#121a13] px-4 py-2 font-mono text-xs font-semibold text-[#39FF14] hover:bg-[#39FF14]/15 disabled:opacity-50 cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitProject('submitted')}
                className="rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
