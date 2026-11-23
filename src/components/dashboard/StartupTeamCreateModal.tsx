import React, { useState } from 'react';
import { X, Rocket, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { validateStartupTeamInput } from '../../utils/escLogic';
import type { StartupStage, StartupTeam } from '../../types';

interface StartupTeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (team: StartupTeam) => void;
}

export const StartupTeamCreateModal: React.FC<StartupTeamCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('AI & Autonomous Systems');
  const [stage, setStage] = useState<StartupStage>('idea');
  const [problemStatement, setProblemStatement] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const skillsRequired = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const validation = validateStartupTeamInput({
      name,
      domain,
      stage,
      problemStatement,
      proposedSolution,
      ideaDescription,
      skillsRequired,
      expectedOutcome,
    });

    if (!validation.isValid) {
      setError(Object.values(validation.errors)[0] || 'Please fill in all required startup fields.');
      return;
    }

    try {
      setSubmitting(true);
      const supportingDocs =
        docUrl.trim() ? [{ name: docTitle.trim() || 'Pitch / Architecture Doc', url: docUrl.trim() }] : [];

      const created = await apiRequest<StartupTeam>('/api/teams', {
        method: 'POST',
        requireAuth: true,
        body: {
          name: name.trim(),
          domain: domain.trim(),
          stage,
          problemStatement: problemStatement.trim(),
          proposedSolution: proposedSolution.trim(),
          ideaDescription: ideaDescription.trim(),
          skillsRequired,
          expectedOutcome: expectedOutcome.trim(),
          logoUrl: logoUrl.trim(),
          supportingDocs,
        },
      });
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to create startup team.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
              ESC Venture Builder • Max 4 Members (1 Leader + 3 Members)
            </span>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <Rocket className="h-4 w-4 text-[#CCFF00]" /> Launch Startup Team
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2.5 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-white mb-1">1. Startup Team Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AeroSense Robotics"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">2. Domain / Category *</label>
              <input
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. CleanTech / AI / Robotics"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">3. Current Stage *</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as StartupStage)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              >
                <option value="idea">Idea</option>
                <option value="research">Research & Validation</option>
                <option value="prototype">Hardware / Software Prototype</option>
                <option value="mvp">MVP Testing</option>
                <option value="launched">Launched Pilot</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">4. Skills Required (comma-separated) *</label>
              <input
                type="text"
                required
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="ROS2, Embedded C, React, Figma"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-white mb-1">5. Problem Statement *</label>
            <textarea
              required
              rows={2}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="What critical engineering or industry problem are you solving?"
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-white mb-1">6. Proposed Solution *</label>
            <textarea
              required
              rows={2}
              value={proposedSolution}
              onChange={(e) => setProposedSolution(e.target.value)}
              placeholder="How does your engineering system solve this problem?"
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-white mb-1">7. Startup Idea & Architecture Description *</label>
            <textarea
              required
              rows={2}
              value={ideaDescription}
              onChange={(e) => setIdeaDescription(e.target.value)}
              placeholder="Core architecture, target users, and differentiation..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-white mb-1">8. Expected Outcome / 90-Day Goal *</label>
            <input
              type="text"
              required
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="e.g. Deploy working field prototype & 3 pilot demos"
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-white mb-1">9. Team Logo / Cover URL (optional)</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">10a. Supporting Doc Label</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Pitch Deck / Spec PDF"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">10b. Supporting Doc Link</label>
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#23262d]">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Creating Team...' : 'Submit Startup Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
