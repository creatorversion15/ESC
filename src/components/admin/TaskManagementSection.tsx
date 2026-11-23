import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  ListChecks,
  X,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { evaluateTaskOverdue } from '../../utils/escLogic';
import type {
  TeamTask,
  StartupTeam,
  TaskPriority,
  TaskStatus,
} from '../../types';

interface TaskManagementSectionProps {
  tasks: TeamTask[];
  setTasks: React.Dispatch<React.SetStateAction<TeamTask[]>>;
  teams: StartupTeam[];
  initialFilter?: 'all' | TaskStatus;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onRefreshAll: () => Promise<void>;
}

export const TaskManagementSection: React.FC<TaskManagementSectionProps> = ({
  tasks,
  setTasks,
  teams,
  initialFilter = 'all',
  onNotify,
  onRefreshAll,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>(initialFilter);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [teamId, setTeamId] = useState('');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [expectedDeliverable, setExpectedDeliverable] = useState('');
  const [instructions, setInstructions] = useState('');

  // Review drawer state
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewStatusDraft, setReviewStatusDraft] = useState<TaskStatus>('in_progress');
  const [reviewDeadlineDraft, setReviewDeadlineDraft] = useState('');

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  const normalizedTasks = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        effectiveStatus: evaluateTaskOverdue(t),
      })),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return normalizedTasks.filter((t) =>
      statusFilter === 'all' ? true : t.effectiveStatus === statusFilter
    );
  }, [normalizedTasks, statusFilter]);

  const selectedTeamMembers = useMemo(() => {
    return teams.find((t) => t.id === teamId)?.members || [];
  }, [teams, teamId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !title.trim() || !deadline) return;
    try {
      setBusy(true);
      const memberObj = selectedTeamMembers.find((m) => m.userUid === assignedToUid);
      const created = await apiRequest<TeamTask>('/api/admin/tasks', {
        method: 'POST',
        requireAuth: true,
        body: {
          teamId,
          assignedToUid: assignedToUid || undefined,
          assignedToName: memberObj?.fullName || undefined,
          title: title.trim(),
          description: description.trim() || title.trim(),
          priority,
          startDate,
          deadline,
          expectedDeliverable: expectedDeliverable.trim(),
          instructions: instructions.trim(),
        },
      });
      setTasks((prev) => [created, ...prev]);
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setExpectedDeliverable('');
      setInstructions('');
      setAssignedToUid('');
      onNotify('success', `Assigned task "${created.title}".`);
      await onRefreshAll();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to create task.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateTaskReview = async (nextStatus?: TaskStatus) => {
    if (!selectedTask) return;
    try {
      setBusy(true);
      const updated = await apiRequest<TeamTask>(`/api/admin/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          status: nextStatus || reviewStatusDraft,
          adminFeedback: reviewFeedback,
          deadline: reviewDeadlineDraft || selectedTask.deadline,
        },
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
      onNotify('success', `Task "${updated.title}" updated to ${updated.status.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update task.');
    } finally {
      setBusy(false);
    }
  };

  // Calendar buckets
  const calendarGroups = useMemo(() => {
    const now = Date.now();
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
    const overdue = filteredTasks.filter((t) => t.effectiveStatus === 'overdue');
    const dueSoon = filteredTasks.filter((t) => {
      if (t.effectiveStatus === 'completed' || t.effectiveStatus === 'overdue') return false;
      const d = Date.parse(t.deadline);
      return !Number.isNaN(d) && d <= weekAhead;
    });
    const upcoming = filteredTasks.filter((t) => {
      if (t.effectiveStatus === 'completed' || t.effectiveStatus === 'overdue') return false;
      const d = Date.parse(t.deadline);
      return Number.isNaN(d) || d > weekAhead;
    });
    const completed = filteredTasks.filter((t) => t.effectiveStatus === 'completed');
    return { overdue, dueSoon, upcoming, completed };
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#232731] bg-[#121419] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white"
          >
            <option value="all">All Tasks ({normalizedTasks.length})</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted_for_review">Submitted for Review</option>
            <option value="revision_required">Revision Required</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>

          <div className="inline-flex rounded-xl border border-[#2b2f38] bg-[#17191e] p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 cursor-pointer ${
                viewMode === 'list' ? 'bg-[#CCFF00] text-black font-bold' : 'text-zinc-400'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" /> Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 cursor-pointer ${
                viewMode === 'calendar' ? 'bg-[#CCFF00] text-black font-bold' : 'text-zinc-400'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> Calendar Timeline
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!teamId && teams.length > 0) setTeamId(teams[0].id);
            setCreateOpen(true);
          }}
          disabled={teams.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Assign New Task
        </button>
      </div>

      {viewMode === 'list' ? (
        filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
            <ListChecks className="h-8 w-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400">No tasks match the current filter.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Startup Team / Assignee</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1f26]">
                {filteredTasks.map((tk) => (
                  <tr key={tk.id} className="hover:bg-[#14161d]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{tk.title}</div>
                      <div className="text-[11px] text-zinc-400 line-clamp-1">{tk.expectedDeliverable || tk.description}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-zinc-200">{tk.teamName || tk.teamId}</div>
                      <div className="font-mono text-[10px] text-zinc-400">
                        {tk.assignedToName ? `Assignee: ${tk.assignedToName}` : 'All Team Members'}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono uppercase text-[10px]">
                      <span
                        className={`rounded px-2 py-0.5 ${
                          tk.priority === 'critical'
                            ? 'bg-red-950/60 text-red-300'
                            : tk.priority === 'high'
                            ? 'bg-amber-950/60 text-amber-300'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {tk.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-zinc-300">{tk.deadline}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                          tk.effectiveStatus === 'completed'
                            ? 'bg-[#CCFF00]/15 border-[#CCFF00]/40 text-[#CCFF00]'
                            : tk.effectiveStatus === 'overdue'
                            ? 'bg-red-950/50 border-red-800 text-red-300'
                            : tk.effectiveStatus === 'submitted_for_review'
                            ? 'bg-sky-950/50 border-sky-700 text-sky-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {tk.effectiveStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(tk);
                          setReviewFeedback(tk.adminFeedback || '');
                          setReviewStatusDraft(tk.status);
                          setReviewDeadlineDraft(tk.deadline);
                        }}
                        className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {[
            { title: 'Overdue Alerts', items: calendarGroups.overdue, icon: AlertTriangle, accent: 'text-red-400 border-red-900/50' },
            { title: 'Due Within 7 Days', items: calendarGroups.dueSoon, icon: Clock, accent: 'text-amber-300 border-amber-800/50' },
            { title: 'Upcoming Deadlines', items: calendarGroups.upcoming, icon: Calendar, accent: 'text-sky-300 border-sky-900/50' },
            { title: 'Completed Tasks', items: calendarGroups.completed, icon: CheckCircle2, accent: 'text-[#CCFF00] border-[#CCFF00]/40' },
          ].map((col) => {
            const Icon = col.icon;
            return (
              <div key={col.title} className={`rounded-2xl border bg-[#111317] p-4 space-y-3 ${col.accent}`}>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase font-bold">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {col.title}
                  </span>
                  <span>{col.items.length}</span>
                </div>
                <div className="space-y-2">
                  {col.items.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 font-mono py-3">None</p>
                  ) : (
                    col.items.map((tk) => (
                      <button
                        key={tk.id}
                        type="button"
                        onClick={() => {
                          setSelectedTask(tk);
                          setReviewFeedback(tk.adminFeedback || '');
                          setReviewStatusDraft(tk.status);
                          setReviewDeadlineDraft(tk.deadline);
                        }}
                        className="w-full text-left rounded-xl border border-[#232731] bg-[#161922] p-3 hover:border-[#CCFF00]/50 cursor-pointer space-y-1"
                      >
                        <div className="font-semibold text-white">{tk.title}</div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {tk.teamName} • Due {tk.deadline}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
              <h3 className="font-display text-base font-bold text-white">Assign Startup Team Task</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">Startup Team *</label>
                  <select
                    required
                    value={teamId}
                    onChange={(e) => {
                      setTeamId(e.target.value);
                      setAssignedToUid('');
                    }}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  >
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name} ({tm.teamCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Team Member (optional)</label>
                  <select
                    value={assignedToUid}
                    onChange={(e) => setAssignedToUid(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  >
                    <option value="">Entire Team / Team Leader</option>
                    {selectedTeamMembers.map((m) => (
                      <option key={m.userUid} value={m.userUid}>
                        {m.fullName || m.userUid} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Deadline *</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Expected Deliverable</label>
                <input
                  type="text"
                  value={expectedDeliverable}
                  onChange={(e) => setExpectedDeliverable(e.target.value)}
                  placeholder="e.g. Architecture Doc + Working API Prototype"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Instructions / Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#23262d]">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer">
                  {busy ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect / Review Deliverable Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-start justify-between border-b border-[#23262d] pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  {selectedTask.teamName} • Due {selectedTask.deadline}
                </span>
                <h3 className="font-display text-lg font-bold text-white mt-0.5">{selectedTask.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTask(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-zinc-300 bg-[#14161c] p-3.5 rounded-xl border border-[#232731]">
                {selectedTask.description}
              </p>

              {(selectedTask.submissionNotes || selectedTask.submissionUrl) && (
                <div className="rounded-xl border border-sky-800/50 bg-sky-950/20 p-4 space-y-2">
                  <span className="font-mono text-[10px] uppercase text-sky-300 block">
                    Team Submission Deliverable
                  </span>
                  {selectedTask.submissionNotes && <p className="text-zinc-200">{selectedTask.submissionNotes}</p>}
                  {selectedTask.submissionUrl && (
                    <a
                      href={selectedTask.submissionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[#CCFF00] underline"
                    >
                      Open Deliverable Link <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">Task Status</label>
                  <select
                    value={reviewStatusDraft}
                    onChange={(e) => setReviewStatusDraft(e.target.value as TaskStatus)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="submitted_for_review">Submitted for Review</option>
                    <option value="revision_required">Revision Required</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Deadline</label>
                  <input
                    type="date"
                    value={reviewDeadlineDraft}
                    onChange={(e) => setReviewDeadlineDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Admin Feedback</label>
                <textarea
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Provide verification notes or revision instructions..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#23262d] pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUpdateTaskReview('revision_required')}
                className="rounded-xl border border-amber-700 bg-amber-950/50 px-3.5 py-2 font-mono text-xs text-amber-200 cursor-pointer"
              >
                Request Revision
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUpdateTaskReview('completed')}
                className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Approve Completed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUpdateTaskReview()}
                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2 text-xs text-white cursor-pointer"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
