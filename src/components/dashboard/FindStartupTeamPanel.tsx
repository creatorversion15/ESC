import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Send,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import {
  filterStartupTeamDirectory,
  isTeamJoinRequestRecord,
} from '../../utils/memberOnboardingLogic';
import type { DirectoryStartupTeam, StartupTeam, TeamInvitation } from '../../types';

interface FindStartupTeamPanelProps {
  currentUid: string;
  myTeams: StartupTeam[];
  invitations: TeamInvitation[];
  isApprovedMember: boolean;
  isSuspended: boolean;
  onRefreshAll: () => Promise<void>;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const FindStartupTeamPanel: React.FC<FindStartupTeamPanelProps> = ({
  currentUid,
  myTeams,
  invitations,
  isApprovedMember,
  isSuspended,
  onRefreshAll,
  onFeedback,
}) => {
  const [directoryTeams, setDirectoryTeams] = useState<DirectoryStartupTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [onlyOpenSpots, setOnlyOpenSpots] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [pitchMessage, setPitchMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDirectory = async () => {
    if (!isApprovedMember || isSuspended) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const rows = await apiRequest<DirectoryStartupTeam[]>('/api/teams/directory', {
        requireAuth: true,
      });
      setDirectoryTeams(Array.isArray(rows) ? rows : []);
    } catch {
      setDirectoryTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, [isApprovedMember, isSuspended, myTeams.length]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    directoryTeams.forEach((t) => {
      if (t.domain) set.add(t.domain);
    });
    return Array.from(set).sort();
  }, [directoryTeams]);

  const filteredTeams = useMemo(
    () =>
      filterStartupTeamDirectory(directoryTeams, {
        query: queryText,
        domain: domainFilter,
        onlyOpenSpots,
        getMemberCount: (t) => ({ count: t.memberCount, max: t.maxMembers }),
      }),
    [directoryTeams, queryText, domainFilter, onlyOpenSpots]
  );

  // Incoming join requests for teams led by current user
  const incomingJoinRequests = useMemo(
    () =>
      invitations.filter(
        (inv) =>
          isTeamJoinRequestRecord(inv) &&
          inv.inviteeUid === currentUid &&
          inv.status === 'pending'
      ),
    [invitations, currentUid]
  );

  // Outgoing join requests sent by current user
  const myOutgoingJoinRequests = useMemo(
    () =>
      invitations.filter(
        (inv) => isTeamJoinRequestRecord(inv) && inv.inviterUid === currentUid
      ),
    [invitations, currentUid]
  );

  const hasActiveTeam = myTeams.some(
    (t) => t.status !== 'completed' && t.status !== 'rejected'
  );

  const handleSendJoinRequest = async (team: DirectoryStartupTeam) => {
    try {
      setBusyId(team.id);
      await apiRequest(`/api/teams/${team.id}/join-request`, {
        method: 'POST',
        requireAuth: true,
        body: { message: pitchMessage.trim() || undefined },
      });
      setRequestingTeamId(null);
      setPitchMessage('');
      onFeedback('success', `Join request sent to "${team.name}". The team leader has been notified.`);
      await Promise.all([onRefreshAll(), loadDirectory()]);
    } catch (err: any) {
      onFeedback('error', err?.message || 'Unable to submit join request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRespondJoinRequest = async (
    requestId: string,
    decision: 'accept' | 'reject' | 'cancel'
  ) => {
    try {
      setBusyId(requestId);
      await apiRequest(`/api/invitations/${requestId}/respond`, {
        method: 'POST',
        requireAuth: true,
        body: { decision },
      });
      onFeedback(
        'success',
        decision === 'accept'
          ? 'Join request accepted! Member has been added to your Startup Team.'
          : decision === 'reject'
          ? 'Join request declined.'
          : 'Join request cancelled.'
      );
      await Promise.all([onRefreshAll(), loadDirectory()]);
    } catch (err: any) {
      onFeedback('error', err?.message || 'Unable to process join request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 text-xs" data-testid="find-startup-team-panel">
      {/* Leader Inbox: Incoming Join Requests */}
      {incomingJoinRequests.length > 0 && (
        <div className="rounded-2xl border border-[#39FF14]/45 bg-[#0e1710] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#39FF14]" />
              Incoming Team Join Requests ({incomingJoinRequests.length})
            </h4>
            <span className="font-mono text-[10px] uppercase text-[#39FF14]">Team Leader Review</span>
          </div>
          <div className="space-y-2.5">
            {incomingJoinRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#233126] bg-[#131815] p-4"
              >
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    {req.inviterName}{' '}
                    <span className="font-mono text-[11px] font-normal text-zinc-400">
                      requested to join {req.teamName}
                    </span>
                  </div>
                  {req.message && <p className="text-zinc-300 italic">&ldquo;{req.message}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => handleRespondJoinRequest(req.id, 'accept')}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#39FF14] px-3.5 py-2 font-display text-[11px] font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => handleRespondJoinRequest(req.id, 'reject')}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Join Requests Tracker */}
      {myOutgoingJoinRequests.length > 0 && (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3">
          <h4 className="font-display text-sm font-bold text-white">
            My Sent Join Requests ({myOutgoingJoinRequests.length})
          </h4>
          <div className="space-y-2">
            {myOutgoingJoinRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#20242e] bg-[#151821] px-4 py-2.5"
              >
                <div>
                  <span className="font-semibold text-white">{req.teamName}</span>
                  <span className="ml-2 font-mono text-[10px] text-zinc-400">
                    Lead: {req.inviteeName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold ${
                      req.status === 'accepted'
                        ? 'bg-[#39FF14]/15 text-[#39FF14]'
                        : req.status === 'rejected'
                        ? 'bg-red-950/50 text-red-300'
                        : req.status === 'cancelled'
                        ? 'bg-zinc-800 text-zinc-400'
                        : 'bg-amber-950/50 text-amber-300'
                    }`}
                  >
                    {req.status}
                  </span>
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => handleRespondJoinRequest(req.id, 'cancel')}
                      className="font-mono text-[10px] text-zinc-400 hover:text-red-400 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIND A TEAM Directory */}
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#39FF14]" />
              Find a Startup Team
            </h4>
            <p className="text-zinc-400 text-xs mt-0.5">
              Discover active ESC startup teams, search by industry, required skills, project domain, or college, and send a request to join.
            </p>
          </div>
          <span className="rounded-full border border-[#2b303c] bg-[#161922] px-3 py-1 font-mono text-[11px] text-zinc-300">
            {filteredTeams.length} Team{filteredTeams.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search by team name, skill (ROS2, React), industry, project, or college..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-9 pr-3 py-2.5 text-xs text-white placeholder-[#6b7280] focus:border-[#39FF14] focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              aria-label="Filter teams by industry domain"
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
            >
              <option value="all">All Industries / Domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <label className="md:col-span-3 flex items-center gap-2 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-xs text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOpenSpots}
              onChange={(e) => setOnlyOpenSpots(e.target.checked)}
              className="accent-[#39FF14]"
            />
            <span>Open spots only</span>
          </label>
        </div>

        {loading ? (
          <div className="py-10 text-center font-mono text-zinc-500">
            Loading ESC startup teams...
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="rounded-xl border border-[#1f232c] bg-[#0d0f13] p-8 text-center space-y-2">
            <Users className="h-7 w-7 text-zinc-600 mx-auto" />
            <p className="text-zinc-400">
              No startup teams matched your filters. Try adjusting your search or create a new Startup Team above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTeams.map((team) => {
              const isFull = team.memberCount >= team.maxMembers;
              const isExpanded = expandedTeamId === team.id;
              const canRequest =
                !team.isCurrentUserMember &&
                !hasActiveTeam &&
                !isFull &&
                team.userJoinRequestStatus !== 'pending';

              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-[#242834] bg-[#141720] p-5 space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-[#39FF14] font-bold uppercase">
                        {team.teamCode} • {team.domain}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-[#1e222d] px-2 py-0.5 uppercase text-zinc-300">
                          {team.stage}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-bold ${
                            isFull
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-[#39FF14]/15 text-[#39FF14]'
                          }`}
                        >
                          {team.memberCount}/{team.maxMembers} Members
                        </span>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-display text-base font-bold text-white">{team.name}</h5>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Lead: <strong className="text-zinc-200">{team.leaderName}</strong>
                        {team.leaderCollege ? ` • ${team.leaderCollege}` : ''}
                      </p>
                    </div>

                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                      {team.problemStatement || team.ideaDescription}
                    </p>

                    {team.skillsRequired.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {team.skillsRequired.slice(0, 6).map((sk) => (
                          <span
                            key={sk}
                            className="rounded-md border border-[#2a2f3c] bg-[#1a1e28] px-2 py-0.5 font-mono text-[10px] text-zinc-200"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="rounded-xl border border-[#252a36] bg-[#0f1218] p-3.5 space-y-2 text-xs">
                        <div>
                          <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">
                            Proposed Solution
                          </span>
                          <p className="text-zinc-300">{team.proposedSolution}</p>
                        </div>
                        {team.expectedOutcome && (
                          <div>
                            <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">
                              Expected Outcome
                            </span>
                            <p className="text-zinc-300">{team.expectedOutcome}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-[#202430]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            Hide Details <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            View Details <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>

                      {team.isCurrentUserMember ? (
                        <span className="rounded-lg bg-[#39FF14]/15 px-3 py-1 font-mono text-[10px] font-bold uppercase text-[#39FF14]">
                          Your Team
                        </span>
                      ) : team.userJoinRequestStatus === 'pending' ? (
                        <span className="rounded-lg bg-amber-950/50 border border-amber-500/40 px-3 py-1 font-mono text-[10px] font-bold uppercase text-amber-300">
                          Request Pending
                        </span>
                      ) : isFull ? (
                        <span className="rounded-lg bg-zinc-800 px-3 py-1 font-mono text-[10px] uppercase text-zinc-400">
                          Team Full
                        </span>
                      ) : hasActiveTeam ? (
                        <span className="font-mono text-[10px] text-zinc-500">
                          Already in an active team
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canRequest || busyId === team.id}
                          onClick={() =>
                            setRequestingTeamId(requestingTeamId === team.id ? null : team.id)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-3.5 py-1.5 font-display text-[11px] font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                        >
                          <Send className="h-3 w-3" /> Request to Join
                        </button>
                      )}
                    </div>

                    {requestingTeamId === team.id && (
                      <div className="rounded-xl border border-[#39FF14]/40 bg-[#0e150f] p-3 space-y-2">
                        <textarea
                          rows={2}
                          value={pitchMessage}
                          onChange={(e) => setPitchMessage(e.target.value)}
                          placeholder="Introduce your skills & how you can contribute to this team (optional)..."
                          className="w-full rounded-lg border border-[#2a312c] bg-[#141918] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRequestingTeamId(null);
                              setPitchMessage('');
                            }}
                            className="px-3 py-1.5 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={busyId === team.id}
                            onClick={() => handleSendJoinRequest(team)}
                            className="rounded-lg bg-[#39FF14] px-4 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
                          >
                            {busyId === team.id ? 'Sending...' : 'Send Join Request'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
