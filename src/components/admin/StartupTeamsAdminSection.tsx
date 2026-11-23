import React, { useEffect, useMemo, useState } from 'react';
import {
  Rocket,
  Search,
  Users,
  MessageSquare,
  CalendarClock,
  FileCheck,
  X,
  Send,
  Plus,
  Trash2,
  Shield,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type {
  StartupTeam,
  StartupTeamStatus,
  UserProfile,
  TeamMessage,
  ProgressReport,
  MemberActivityLog,
  TaskPriority,
} from '../../types';

interface StartupTeamsAdminSectionProps {
  teams: StartupTeam[];
  setTeams: React.Dispatch<React.SetStateAction<StartupTeam[]>>;
  usersList: UserProfile[];
  reports: ProgressReport[];
  setReports: React.Dispatch<React.SetStateAction<ProgressReport[]>>;
  initialStatusFilter?: string;
  initialSelectedTeamId?: string | null;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onRefreshAll: () => Promise<void>;
}

const TEAM_STATUSES: StartupTeamStatus[] = [
  'recruiting',
  'team_formed',
  'under_admin_review',
  'active',
  'in_progress',
  'completed',
  'on_hold',
  'rejected',
];

export const StartupTeamsAdminSection: React.FC<StartupTeamsAdminSectionProps> = ({
  teams,
  setTeams,
  usersList,
  reports,
  setReports,
  initialStatusFilter = 'all',
  initialSelectedTeamId = null,
  onNotify,
  onRefreshAll,
}) => {
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<StartupTeam | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'chat' | 'assign_task' | 'reports' | 'history'>('overview');

  // Overview Admin controls
  const [statusDraft, setStatusDraft] = useState<StartupTeamStatus>('under_admin_review');
  const [progressDraft, setProgressDraft] = useState(0);
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [overrideDraft, setOverrideDraft] = useState(false);
  const [addMemberUid, setAddMemberUid] = useState('');
  const [busy, setBusy] = useState(false);

  // Team Chat state
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatText, setChatText] = useState('');

  // Quick Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskDeliverable, setTaskDeliverable] = useState('');

  // Report review notes
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  // Activity History
  const [teamHistory, setTeamHistory] = useState<MemberActivityLog[]>([]);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialSelectedTeamId) {
      const found = teams.find((t) => t.id === initialSelectedTeamId);
      if (found) openTeamDrawer(found);
    }
  }, [initialSelectedTeamId, teams]);

  const approvedEligibleUsers = useMemo(() => {
    return usersList.filter(
      (u) =>
        (u.membershipStatus === 'approved' || Boolean(u.escMemberId) || u.role === 'member') &&
        u.accountStatus !== 'suspended'
    );
  }, [usersList]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (statusFilter === 'under_review_group') {
        if (!(t.status === 'under_admin_review' || (!t.isApproved && t.status !== 'rejected' && t.status !== 'completed'))) {
          return false;
        }
      } else if (statusFilter === 'active_group') {
        if (!['active', 'in_progress', 'recruiting', 'team_formed'].includes(t.status)) return false;
      } else if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.teamCode.toLowerCase().includes(q) ||
          t.domain.toLowerCase().includes(q) ||
          t.leaderName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [teams, statusFilter, search]);

  const openTeamDrawer = async (team: StartupTeam) => {
    setSelectedTeam(team);
    setDrawerTab('overview');
    setStatusDraft(team.status);
    setProgressDraft(team.progressPercent || 0);
    setDeadlineDraft(team.nextDeadline || '');
    setAdminNotesDraft(team.adminNotes || '');
    setOverrideDraft(Boolean(team.allowMultiTeamOverride));
    setAddMemberUid('');
  };

  const loadTeamChat = async (teamId: string) => {
    try {
      setLoadingChat(true);
      const msgs = await apiRequest<TeamMessage[]>(`/api/teams/${teamId}/messages`, { requireAuth: true });
      setMessages(msgs);
      await apiRequest(`/api/teams/${teamId}/messages/read`, { method: 'POST', requireAuth: true }).catch(() => {});
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not load team chat.');
    } finally {
      setLoadingChat(false);
    }
  };

  const loadTeamHistory = async (teamId: string) => {
    try {
      const logs = await apiRequest<MemberActivityLog[]>(`/api/admin/activities?teamId=${encodeURIComponent(teamId)}`, {
        requireAuth: true,
      });
      setTeamHistory(logs);
    } catch {
      setTeamHistory([]);
    }
  };

  const handleSaveTeamControls = async (overrideStatus?: StartupTeamStatus, overrideApproved?: boolean) => {
    if (!selectedTeam) return;
    try {
      setBusy(true);
      const nextStatus = overrideStatus || statusDraft;
      const isApproved =
        typeof overrideApproved === 'boolean'
          ? overrideApproved
          : ['active', 'in_progress', 'completed', 'team_formed'].includes(nextStatus);
      const updated = await apiRequest<StartupTeam>(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          status: nextStatus,
          isApproved,
          progressPercent: progressDraft,
          nextDeadline: deadlineDraft,
          adminNotes: adminNotesDraft,
          allowMultiTeamOverride: overrideDraft,
        },
      });
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTeam(updated);
      setStatusDraft(updated.status);
      onNotify('success', `Updated startup team "${updated.name}" (${updated.status.replace(/_/g, ' ')}).`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update team settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !addMemberUid) return;
    try {
      setBusy(true);
      const updated = await apiRequest<StartupTeam>(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        requireAuth: true,
        body: { userUid: addMemberUid, role: 'member' },
      });
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTeam(updated);
      setAddMemberUid('');
      onNotify('success', 'Member added to startup team.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to add member.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!selectedTeam) return;
    try {
      setBusy(true);
      const updated = await apiRequest<StartupTeam>(`/api/teams/${selectedTeam.id}/members/${memberUid}`, {
        method: 'DELETE',
        requireAuth: true,
      });
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTeam(updated);
      onNotify('success', 'Member removed from team.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to remove member.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !chatText.trim()) return;
    try {
      setBusy(true);
      const created = await apiRequest<TeamMessage>(`/api/teams/${selectedTeam.id}/messages`, {
        method: 'POST',
        requireAuth: true,
        body: { content: chatText.trim() },
      });
      setMessages((prev) => [...prev, created]);
      setChatText('');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to send admin message.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !taskTitle.trim() || !taskDeadline) return;
    try {
      setBusy(true);
      const memberObj = selectedTeam.members?.find((m) => m.userUid === taskAssignee);
      await apiRequest('/api/admin/tasks', {
        method: 'POST',
        requireAuth: true,
        body: {
          title: taskTitle.trim(),
          description: taskDesc.trim() || taskTitle.trim(),
          teamId: selectedTeam.id,
          assignedToUid: taskAssignee || undefined,
          assignedToName: memberObj?.fullName || undefined,
          priority: taskPriority,
          deadline: taskDeadline,
          expectedDeliverable: taskDeliverable.trim(),
        },
      });
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignee('');
      setTaskDeadline('');
      setTaskDeliverable('');
      onNotify('success', `Task assigned to ${selectedTeam.name}.`);
      await onRefreshAll();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to assign task.');
    } finally {
      setBusy(false);
    }
  };

  const handleReviewReport = async (reportId: string, status: 'reviewed' | 'needs_attention') => {
    try {
      setBusy(true);
      const updated = await apiRequest<ProgressReport>(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          status,
          adminReviewNotes: reportNotes[reportId] || '',
        },
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      onNotify('success', `Report marked as ${status.replace('_', ' ')}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update progress report.');
    } finally {
      setBusy(false);
    }
  };

  const teamReports = useMemo(
    () => (selectedTeam ? reports.filter((r) => r.teamId === selectedTeam.id) : []),
    [reports, selectedTeam]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search startup teams by name, code (TEAM-2026-...), domain, or leader..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none w-full sm:w-auto"
        >
          <option value="all">All Team Statuses ({teams.length})</option>
          <option value="under_review_group">Under Admin Review</option>
          <option value="active_group">Active Startup Teams</option>
          {TEAM_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st.replace(/_/g, ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
          <Rocket className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400">No startup teams match this filter yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const memberCount = team.members?.length ?? team.memberCount ?? 1;
            return (
              <div
                key={team.id}
                className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-4 flex flex-col justify-between hover:border-[#CCFF00]/40 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-[#CCFF00] font-bold">{team.teamCode}</span>
                    <span className="rounded-full border border-[#2b2f38] bg-[#191c24] px-2.5 py-0.5 uppercase text-zinc-200">
                      {team.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-white">{team.name}</h4>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {team.domain} • Stage: <span className="uppercase text-zinc-200">{team.stage}</span>
                  </p>
                  <p className="text-xs text-zinc-400 line-clamp-2">{team.problemStatement}</p>

                  {/* Progress & Capacity */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>Team Size: {memberCount} / {team.maxMembers || 4}</span>
                      <span>Progress: {team.progressPercent || 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#222530] overflow-hidden">
                      <div
                        className="h-full bg-[#CCFF00] rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, team.progressPercent || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#1c1f26] pt-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Lead: <strong className="text-zinc-200">{team.leaderName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => openTeamDrawer(team)}
                    className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                  >
                    Supervise
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Supervision Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#23262d] pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#CCFF00]">
                  <span>{selectedTeam.teamCode}</span>
                  <span>•</span>
                  <span className="uppercase">{selectedTeam.domain}</span>
                  <span>•</span>
                  <span>{(selectedTeam.members?.length ?? 1)} / {selectedTeam.maxMembers || 4} Members</span>
                </div>
                <h3 className="font-display text-xl font-bold text-white mt-1">{selectedTeam.name}</h3>
                <p className="text-xs text-zinc-400">Leader: {selectedTeam.leaderName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1f2229] pb-3">
              {[
                { key: 'overview', label: 'Profile & Members', icon: Users },
                { key: 'chat', label: 'Team Chat Monitor', icon: MessageSquare },
                { key: 'assign_task', label: 'Assign Task', icon: CalendarClock },
                { key: 'reports', label: `Progress Reports (${teamReports.length})`, icon: FileCheck },
                { key: 'history', label: 'Activity History', icon: Clock },
              ].map((t) => {
                const Icon = t.icon;
                const active = drawerTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setDrawerTab(t.key as any);
                      if (t.key === 'chat') loadTeamChat(selectedTeam.id);
                      if (t.key === 'history') loadTeamHistory(selectedTeam.id);
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold cursor-pointer ${
                      active ? 'bg-[#CCFF00] text-black' : 'bg-[#17191e] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>

            {drawerTab === 'overview' && (
              <div className="space-y-5 text-xs">
                {/* 10-field Startup Profile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-[#232731] bg-[#14161c] p-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">Problem Statement</span>
                    <p className="text-zinc-200 mt-1">{selectedTeam.problemStatement}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">Proposed Solution</span>
                    <p className="text-zinc-200 mt-1">{selectedTeam.proposedSolution}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">Idea Description</span>
                    <p className="text-zinc-200 mt-1">{selectedTeam.ideaDescription}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">Expected Outcome</span>
                    <p className="text-zinc-200 mt-1">{selectedTeam.expectedOutcome}</p>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-1.5">
                    {(selectedTeam.skillsRequired || []).map((sk, idx) => (
                      <span key={idx} className="rounded bg-[#1e222b] px-2 py-0.5 font-mono text-[10px] text-[#CCFF00]">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Members (max 4) */}
                <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase text-[#CCFF00]">
                      Team Members ({selectedTeam.members?.length || 1} / {selectedTeam.maxMembers || 4} Max)
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={addMemberUid}
                        onChange={(e) => setAddMemberUid(e.target.value)}
                        className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="">Select approved ESC member...</option>
                        {approvedEligibleUsers
                          .filter((u) => !selectedTeam.members?.some((m) => m.userUid === u.userId))
                          .map((u) => (
                            <option key={u.userId} value={u.userId}>
                              {u.fullName} {u.escMemberId ? `(${u.escMemberId})` : ''}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !addMemberUid || (selectedTeam.members?.length || 0) >= 4}
                        onClick={handleAddMember}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#CCFF00] px-3 py-1.5 font-display text-[11px] font-bold uppercase text-black disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(selectedTeam.members || []).map((m) => (
                      <div key={m.userUid} className="flex items-center justify-between rounded-xl bg-[#191c24] px-3 py-2">
                        <div>
                          <div className="font-semibold text-white">
                            {m.fullName || m.userUid}{' '}
                            <span className="ml-1 rounded bg-[#CCFF00]/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#CCFF00]">
                              {m.role}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400">
                            {m.escMemberId || 'ESC Member'} • {m.branch || m.email || ''}
                          </div>
                        </div>
                        {m.role !== 'leader' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRemoveMember(m.userUid)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Admin Approval & Supervision Controls */}
                <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-white mb-1">Team Status</label>
                      <select
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value as StartupTeamStatus)}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                      >
                        {TEAM_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st.replace(/_/g, ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">Progress (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={progressDraft}
                        onChange={(e) => setProgressDraft(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">Next Deadline</label>
                      <input
                        type="date"
                        value={deadlineDraft}
                        onChange={(e) => setDeadlineDraft(e.target.value)}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Admin Review / Supervision Notes</label>
                    <textarea
                      value={adminNotesDraft}
                      onChange={(e) => setAdminNotesDraft(e.target.value)}
                      rows={2}
                      placeholder="Guidance or approval decision notes..."
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideDraft}
                      onChange={(e) => setOverrideDraft(e.target.checked)}
                      className="h-4 w-4 accent-[#CCFF00]"
                    />
                    <span className="text-zinc-200">
                      Allow Multi-Team Override (permit members with other active teams to participate in this team)
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveTeamControls('rejected', false)}
                      className="rounded-xl border border-red-800 bg-red-950/50 px-3.5 py-2 font-mono text-xs text-red-300 hover:bg-red-900 cursor-pointer"
                    >
                      Reject Startup Team
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveTeamControls('active', true)}
                      className="rounded-xl border border-emerald-700 bg-emerald-950/50 px-3.5 py-2 font-mono text-xs text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                    >
                      Approve & Activate
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveTeamControls()}
                      className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                    >
                      Save Team Updates
                    </button>
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'chat' && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-[#CCFF00]/30 bg-[#131712] px-4 py-2.5 flex items-center gap-2 text-[#CCFF00]">
                  <Shield className="h-4 w-4 shrink-0" />
                  <span>
                    Admin Supervision Access: Team conversations are private to members of this Startup Team and visible to authorized ESC Administrators for moderation and mentorship.
                  </span>
                </div>

                <div className="rounded-xl border border-[#232731] bg-[#13151b] p-4 h-72 overflow-y-auto space-y-3">
                  {loadingChat ? (
                    <p className="text-zinc-500 font-mono">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-zinc-500 font-mono text-center py-8">No chat messages in this team yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="rounded-xl border border-[#222632] bg-[#181b23] p-3 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className={m.senderRole === 'admin' ? 'text-[#CCFF00] font-bold' : 'text-white font-semibold'}>
                            {m.senderName} ({m.senderRole.toUpperCase()})
                          </span>
                          <span className="text-zinc-500">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                        {m.attachmentUrl && (
                          <a
                            href={m.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block font-mono text-[10px] text-[#CCFF00] underline"
                          >
                            Attachment: {m.attachmentName || m.attachmentUrl}
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Send official ESC Admin feedback or notice to team chat..."
                    className="flex-1 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || !chatText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2.5 font-display text-xs font-bold uppercase text-black disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                </form>
              </div>
            )}

            {drawerTab === 'assign_task' && (
              <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Task Title *</label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Submit PCB Schematics & BOM"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Assign To Member (optional)</label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                    >
                      <option value="">Entire Startup Team ({selectedTeam.name})</option>
                      {(selectedTeam.members || []).map((m) => (
                        <option key={m.userUid} value={m.userUid}>
                          {m.fullName || m.userUid} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Deadline *</label>
                    <input
                      type="date"
                      required
                      value={taskDeadline}
                      onChange={(e) => setTaskDeadline(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Expected Deliverable</label>
                  <input
                    type="text"
                    value={taskDeliverable}
                    onChange={(e) => setTaskDeliverable(e.target.value)}
                    placeholder="e.g. GitHub PR link + PDF architecture report"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Task Instructions & Description</label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                  >
                    Assign Task to Team
                  </button>
                </div>
              </form>
            )}

            {drawerTab === 'reports' && (
              <div className="space-y-3 text-xs">
                {teamReports.length === 0 ? (
                  <p className="text-zinc-500 font-mono text-center py-6">
                    No weekly/milestone progress reports submitted by this team yet.
                  </p>
                ) : (
                  teamReports.map((r) => (
                    <div key={r.id} className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2.5">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-[#CCFF00]">
                          {r.authorName} • Progress: {r.progressPercent}%
                        </span>
                        <span className="uppercase text-zinc-300">{r.status.replace('_', ' ')}</span>
                      </div>
                      <p className="font-semibold text-white">{r.summary}</p>
                      <p className="text-zinc-300">Accomplishments: {r.accomplishments}</p>
                      {r.blockers && <p className="text-amber-300">Blockers: {r.blockers}</p>}
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#202430]">
                        <input
                          type="text"
                          value={reportNotes[r.id] ?? r.adminReviewNotes ?? ''}
                          onChange={(e) => setReportNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Add admin review note..."
                          className="flex-1 rounded-lg border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 text-white"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReviewReport(r.id, 'reviewed')}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#CCFF00] px-3 py-1.5 font-display text-[10px] font-bold uppercase text-black cursor-pointer"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Mark Reviewed
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReviewReport(r.id, 'needs_attention')}
                          className="rounded-lg border border-amber-700 bg-amber-950/50 px-3 py-1.5 font-mono text-[10px] text-amber-200 cursor-pointer"
                        >
                          Needs Attention
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerTab === 'history' && (
              <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                {teamHistory.length === 0 ? (
                  <p className="text-zinc-500 font-mono text-center py-6">No logged activities for this team yet.</p>
                ) : (
                  teamHistory.map((h) => (
                    <div key={h.id} className="flex items-start justify-between gap-2 rounded-xl bg-[#14161c] px-3.5 py-2.5 border border-[#222530]">
                      <div>
                        <span className="font-semibold text-white">{h.title}</span>
                        <p className="text-zinc-400 text-[11px]">{h.details}</p>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
