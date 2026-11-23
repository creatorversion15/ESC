import React, { useEffect, useState } from 'react';
import {
  Users,
  MessageSquare,
  ListChecks,
  Calendar,
  FileText,
  Shield,
  Send,
  Plus,
  ExternalLink,
  CheckCircle2,
  Edit3,
  Save,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { evaluateTaskOverdue } from '../../utils/escLogic';
import type {
  StartupTeam,
  TeamTask,
  TeamMessage,
  TeamMilestone,
  ProgressReport,
} from '../../types';

interface TeamWorkspacePanelProps {
  team: StartupTeam;
  currentUid: string;
  tasks: TeamTask[];
  milestones?: TeamMilestone[];
  reports?: ProgressReport[];
  onRefreshAll: () => Promise<void>;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const TeamWorkspacePanel: React.FC<TeamWorkspacePanelProps> = ({
  team,
  currentUid,
  tasks,
  milestones = [],
  reports = [],
  onRefreshAll,
  onFeedback,
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'chat' | 'tasks' | 'milestones' | 'reports'>('overview');

  // Chat state
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatContent, setChatContent] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Leader edit state
  const [editingTeam, setEditingTeam] = useState(false);
  const [editProblem, setEditProblem] = useState(team.problemStatement);
  const [editSolution, setEditSolution] = useState(team.proposedSolution);
  const [editOutcome, setEditOutcome] = useState(team.expectedOutcome);

  // Task submission state
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [subNotes, setSubNotes] = useState('');
  const [subUrl, setSubUrl] = useState('');

  // Milestone form
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState('');
  const [msDesc, setMsDesc] = useState('');

  // Progress Report form
  const [repSummary, setRepSummary] = useState('');
  const [repAccomplishments, setRepAccomplishments] = useState('');
  const [repBlockers, setRepBlockers] = useState('');
  const [repNextSteps, setRepNextSteps] = useState('');
  const [repPercent, setRepPercent] = useState(team.progressPercent || 25);

  const [busy, setBusy] = useState(false);
  const isLeader = team.leaderUid === currentUid;
  const teamTasks = tasks.filter((t) => t.teamId === team.id);

  const loadChat = async () => {
    try {
      setLoadingChat(true);
      const msgs = await apiRequest<TeamMessage[]>(`/api/teams/${team.id}/messages`, { requireAuth: true });
      setMessages(msgs);
      await apiRequest(`/api/teams/${team.id}/messages/read`, { method: 'POST', requireAuth: true }).catch(() => {});
    } catch (err: any) {
      onFeedback('error', err?.message || 'Unable to load private team chat.');
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (subTab === 'chat') {
      loadChat();
    }
  }, [subTab, team.id]);

  const handleSaveTeamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      await apiRequest(`/api/teams/${team.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          problemStatement: editProblem.trim(),
          proposedSolution: editSolution.trim(),
          expectedOutcome: editOutcome.trim(),
        },
      });
      setEditingTeam(false);
      onFeedback('success', 'Startup team profile updated.');
      await onRefreshAll();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not update team profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatContent.trim()) return;
    try {
      setBusy(true);
      const created = await apiRequest<TeamMessage>(`/api/teams/${team.id}/messages`, {
        method: 'POST',
        requireAuth: true,
        body: {
          content: chatContent.trim(),
          attachmentName: attachmentName.trim(),
          attachmentUrl: attachmentUrl.trim(),
        },
      });
      setMessages((prev) => [...prev, created]);
      setChatContent('');
      setAttachmentName('');
      setAttachmentUrl('');
    } catch (err: any) {
      onFeedback('error', err?.message || 'Failed to send team message.');
    } finally {
      setBusy(false);
    }
  };

  const handleTaskAction = async (
    taskId: string,
    status: 'in_progress' | 'submitted_for_review',
    notes?: string,
    url?: string
  ) => {
    try {
      setBusy(true);
      await apiRequest(`/api/tasks/${taskId}/member-update`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          status,
          submissionNotes: notes,
          submissionUrl: url,
        },
      });
      setSubmittingTaskId(null);
      setSubNotes('');
      setSubUrl('');
      onFeedback(
        'success',
        status === 'submitted_for_review'
          ? 'Deliverable submitted for ESC Admin verification.'
          : 'Task marked as In Progress.'
      );
      await onRefreshAll();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not update task.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim() || !msDate) return;
    try {
      setBusy(true);
      await apiRequest(`/api/teams/${team.id}/milestones`, {
        method: 'POST',
        requireAuth: true,
        body: { title: msTitle.trim(), dueDate: msDate, description: msDesc.trim() },
      });
      setMsTitle('');
      setMsDate('');
      setMsDesc('');
      onFeedback('success', 'Milestone added to startup timeline.');
      await onRefreshAll();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not create milestone.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repSummary.trim() || !repAccomplishments.trim()) return;
    try {
      setBusy(true);
      await apiRequest(`/api/teams/${team.id}/reports`, {
        method: 'POST',
        requireAuth: true,
        body: {
          summary: repSummary.trim(),
          accomplishments: repAccomplishments.trim(),
          blockers: repBlockers.trim(),
          nextSteps: repNextSteps.trim(),
          progressPercent: repPercent,
        },
      });
      setRepSummary('');
      setRepAccomplishments('');
      setRepBlockers('');
      setRepNextSteps('');
      onFeedback('success', 'Progress report submitted to ESC Admins.');
      await onRefreshAll();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not submit progress report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2229] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="rounded bg-[#CCFF00]/15 border border-[#CCFF00]/40 px-2 py-0.5 text-[#CCFF00] font-bold">
              {team.teamCode}
            </span>
            <span className="rounded bg-[#1a1d25] border border-[#2b2f38] px-2 py-0.5 uppercase text-zinc-200">
              {team.status.replace(/_/g, ' ')}
            </span>
            <span className="text-zinc-400">
              {team.domain} • Stage: <strong className="uppercase text-white">{team.stage}</strong>
            </span>
          </div>
          <h3 className="font-display text-xl font-bold text-white">{team.name}</h3>
          <p className="text-xs text-zinc-400">
            Progress: <strong className="text-[#CCFF00]">{team.progressPercent || 0}%</strong>
            {team.nextDeadline ? ` • Next Deadline: ${team.nextDeadline}` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-[#252932] bg-[#161922] px-4 py-2.5 text-xs font-mono">
          <span className="text-zinc-400 block text-[10px] uppercase">Roster Capacity</span>
          <span className="text-[#CCFF00] font-bold">
            {team.members?.length ?? 1} / {team.maxMembers || 4} Members
          </span>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'overview', label: 'Overview & Roster', icon: Users },
          { key: 'chat', label: 'Private Team Chat', icon: MessageSquare },
          { key: 'tasks', label: `Tasks (${teamTasks.length})`, icon: ListChecks },
          { key: 'milestones', label: `Timeline (${milestones.length})`, icon: Calendar },
          { key: 'reports', label: `Progress Reports (${reports.length})`, icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key as any)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-mono font-semibold cursor-pointer ${
                active ? 'bg-[#CCFF00] text-black' : 'bg-[#17191e] text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: OVERVIEW & ROSTER */}
      {subTab === 'overview' && (
        <div className="space-y-5 text-xs">
          {team.adminNotes && (
            <div className="rounded-xl border border-[#CCFF00]/40 bg-[#121612] p-3.5 text-zinc-200">
              <span className="font-mono text-[10px] uppercase text-[#CCFF00] block mb-0.5">
                ESC Admin Supervision Notes
              </span>
              <p>{team.adminNotes}</p>
            </div>
          )}

          {editingTeam ? (
            <form onSubmit={handleSaveTeamEdit} className="rounded-xl border border-[#2b2f38] bg-[#151820] p-4 space-y-3">
              <div>
                <label className="block font-semibold text-white mb-1">Problem Statement</label>
                <textarea
                  rows={2}
                  value={editProblem}
                  onChange={(e) => setEditProblem(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Proposed Solution</label>
                <textarea
                  rows={2}
                  value={editSolution}
                  onChange={(e) => setEditSolution(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Expected Outcome</label>
                <input
                  type="text"
                  value={editOutcome}
                  onChange={(e) => setEditOutcome(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingTeam(false)} className="rounded-xl border border-[#2b2f38] px-3 py-1.5 text-zinc-400 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-[#CCFF00] px-4 py-1.5 font-display font-bold uppercase text-black cursor-pointer">
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-[#232731] bg-[#14161c] p-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Problem Statement</span>
                <p className="text-zinc-200 mt-1">{team.problemStatement}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Proposed Solution</span>
                <p className="text-zinc-200 mt-1">{team.proposedSolution}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Idea & Architecture</span>
                <p className="text-zinc-200 mt-1">{team.ideaDescription}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Expected Outcome</span>
                <p className="text-zinc-200 mt-1">{team.expectedOutcome}</p>
              </div>
              {isLeader && (
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingTeam(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-3 py-1.5 text-[11px] font-mono text-[#CCFF00] hover:bg-[#1a1d25] cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" /> Edit Startup Details
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Roster */}
          <div className="space-y-2.5">
            <span className="font-mono text-[11px] uppercase text-[#CCFF00] block">
              Team Members ({team.members?.length ?? 1} / {team.maxMembers || 4})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(team.members || []).map((m) => (
                <div key={m.userUid} className="rounded-xl border border-[#232731] bg-[#151820] p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      {m.fullName || m.userUid}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400">
                      {m.escMemberId || 'ESC Member'} • {m.branch || m.college || 'Engineering'}
                    </div>
                  </div>
                  <span className="rounded bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[10px] uppercase text-[#CCFF00] font-bold">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PRIVATE TEAM CHAT */}
      {subTab === 'chat' && (
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-[#CCFF00]/35 bg-[#121612] px-4 py-3 flex items-start gap-2.5 text-[#CCFF00]">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Team Privacy &amp; Governance Notice:</strong> Team conversations are private to members of this Startup Team and accessible to authorized ESC administrators for supervision and moderation.
            </span>
          </div>

          <div className="rounded-xl border border-[#232731] bg-[#13151b] p-4 h-80 overflow-y-auto space-y-3">
            {loadingChat ? (
              <p className="text-zinc-500 font-mono">Loading private team messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-zinc-500 font-mono text-center py-10">
                No messages yet. Start coordinating your startup sprint with your teammates below.
              </p>
            ) : (
              messages.map((m) => {
                const isMine = m.senderUid === currentUid;
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 space-y-1 ${
                      m.senderRole === 'admin'
                        ? 'border-[#CCFF00]/40 bg-[#141a12]'
                        : isMine
                        ? 'border-sky-800/40 bg-[#151b24]'
                        : 'border-[#232731] bg-[#181b23]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className={m.senderRole === 'admin' ? 'text-[#CCFF00] font-bold' : 'text-white font-semibold'}>
                        {m.senderName} • {m.senderRole.toUpperCase()}
                      </span>
                      <span className="text-zinc-500">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                    {m.attachmentUrl && (
                      <a
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-[#CCFF00] underline"
                      >
                        <ExternalLink className="h-3 w-3" /> {m.attachmentName || m.attachmentUrl}
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMessage} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={chatContent}
                onChange={(e) => setChatContent(e.target.value)}
                placeholder="Write a message to your Startup Team..."
                className="flex-1 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !chatContent.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="Optional attachment title (e.g. Figma Prototype)"
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 text-[11px] text-white"
              />
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Optional attachment URL (https://...)"
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 text-[11px] text-white"
              />
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 3: TASKS & DELIVERABLES */}
      {subTab === 'tasks' && (
        <div className="space-y-3 text-xs">
          {teamTasks.length === 0 ? (
            <p className="text-zinc-500 font-mono text-center py-6">No tasks assigned to your Startup Team yet.</p>
          ) : (
            teamTasks.map((tk) => {
              const eff = evaluateTaskOverdue(tk);
              return (
                <div key={tk.id} className="rounded-xl border border-[#232731] bg-[#151820] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                    <span className="text-[#CCFF00] uppercase font-bold">
                      Priority: {tk.priority} • Due {tk.deadline}
                    </span>
                    <span className="rounded-full border border-[#2b2f38] bg-[#1b1f29] px-2.5 py-0.5 uppercase text-zinc-200">
                      {eff.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-white">{tk.title}</h4>
                  <p className="text-zinc-300">{tk.description}</p>
                  {tk.expectedDeliverable && (
                    <p className="text-zinc-400 font-mono text-[11px]">Expected: {tk.expectedDeliverable}</p>
                  )}
                  {tk.adminFeedback && (
                    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-2.5 text-amber-200">
                      Admin Feedback: {tk.adminFeedback}
                    </div>
                  )}

                  {eff !== 'completed' && (
                    <div className="pt-2 border-t border-[#202430] flex flex-wrap items-center gap-2">
                      {tk.status === 'not_started' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTaskAction(tk.id, 'in_progress')}
                          className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-mono text-[11px] text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                        >
                          Start Task
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSubmittingTaskId(submittingTaskId === tk.id ? null : tk.id);
                          setSubNotes(tk.submissionNotes || '');
                          setSubUrl(tk.submissionUrl || '');
                        }}
                        className="rounded-xl bg-[#CCFF00] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
                      >
                        {tk.status === 'submitted_for_review' ? 'Update Deliverable' : 'Submit Deliverable'}
                      </button>
                    </div>
                  )}

                  {submittingTaskId === tk.id && (
                    <div className="rounded-xl border border-[#CCFF00]/40 bg-[#12151c] p-3 space-y-2 mt-2">
                      <textarea
                        rows={2}
                        value={subNotes}
                        onChange={(e) => setSubNotes(e.target.value)}
                        placeholder="Summary of completed deliverable & notes..."
                        className="w-full rounded-lg border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                      />
                      <input
                        type="url"
                        value={subUrl}
                        onChange={(e) => setSubUrl(e.target.value)}
                        placeholder="Deliverable Link (GitHub PR, Figma, Drive PDF...)"
                        className="w-full rounded-lg border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setSubmittingTaskId(null)} className="px-3 py-1 text-zinc-400 cursor-pointer">
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTaskAction(tk.id, 'submitted_for_review', subNotes, subUrl)}
                          className="rounded-lg bg-[#CCFF00] px-4 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
                        >
                          Submit for Review
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBTAB 4: MILESTONES */}
      {subTab === 'milestones' && (
        <div className="space-y-4 text-xs">
          <form onSubmit={handleCreateMilestone} className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
            <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">Add Startup Milestone</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                placeholder="Milestone Title (e.g. Alpha PCB)"
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
              <input
                type="date"
                required
                value={msDate}
                onChange={(e) => setMsDate(e.target.value)}
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#CCFF00] px-4 py-2 font-display font-bold uppercase text-black cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Milestone
              </button>
            </div>
            <input
              type="text"
              value={msDesc}
              onChange={(e) => setMsDesc(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
            />
          </form>

          {milestones.length === 0 ? (
            <p className="text-zinc-500 font-mono text-center py-4">No milestones added yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((ms) => (
                <div key={ms.id} className="flex items-center justify-between rounded-xl border border-[#232731] bg-[#151820] px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">{ms.title}</div>
                    {ms.description && <div className="text-zinc-400 text-[11px]">{ms.description}</div>}
                  </div>
                  <span className="font-mono text-[11px] text-[#CCFF00]">Due {ms.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: PROGRESS REPORTS */}
      {subTab === 'reports' && (
        <div className="space-y-4 text-xs">
          <form onSubmit={handleSubmitReport} className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
            <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">Submit Weekly Progress Report</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-white font-semibold mb-1">Executive Summary *</label>
                <input
                  type="text"
                  required
                  value={repSummary}
                  onChange={(e) => setRepSummary(e.target.value)}
                  placeholder="e.g. Completed sensor calibration & REST telemetry"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-white font-semibold mb-1">Overall Progress %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={repPercent}
                  onChange={(e) => setRepPercent(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-white font-semibold mb-1">Key Accomplishments *</label>
              <textarea
                rows={2}
                required
                value={repAccomplishments}
                onChange={(e) => setRepAccomplishments(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={repBlockers}
                onChange={(e) => setRepBlockers(e.target.value)}
                placeholder="Any technical blockers? (optional)"
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
              <input
                type="text"
                value={repNextSteps}
                onChange={(e) => setRepNextSteps(e.target.value)}
                placeholder="Next week plan (optional)"
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2 font-display font-bold uppercase text-black cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Submit Report
              </button>
            </div>
          </form>

          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#232731] bg-[#151820] p-4 space-y-2">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-[#CCFF00]">{r.progressPercent}% Complete • {r.authorName}</span>
                <span className="uppercase text-zinc-400">{r.status.replace('_', ' ')}</span>
              </div>
              <p className="font-semibold text-white">{r.summary}</p>
              <p className="text-zinc-300">{r.accomplishments}</p>
              {r.adminReviewNotes && (
                <div className="rounded-lg border border-[#CCFF00]/30 bg-[#121612] p-2.5 text-[#CCFF00]">
                  Admin Review: {r.adminReviewNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
