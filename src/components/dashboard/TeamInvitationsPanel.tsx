import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Check, X, Users, Clock } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isTeamJoinRequestRecord } from '../../utils/memberOnboardingLogic';
import type { StartupTeam, TeamInvitation } from '../../types';

interface DirectoryMember {
  uid: string;
  fullName: string;
  escMemberId?: string;
  college?: string;
  branch?: string;
  academicYear?: string;
  technicalSkills?: string[];
  startupTeamId?: string;
}

interface TeamInvitationsPanelProps {
  currentUid: string;
  activeTeam: StartupTeam | null;
  invitations: TeamInvitation[];
  isApprovedMember: boolean;
  isSuspended: boolean;
  onRefreshTeams: () => Promise<void>;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const TeamInvitationsPanel: React.FC<TeamInvitationsPanelProps> = ({
  currentUid,
  activeTeam,
  invitations,
  isApprovedMember,
  isSuspended,
  onRefreshTeams,
  onFeedback,
}) => {
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [search, setSearch] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const isLeaderOfActiveTeam = Boolean(activeTeam && activeTeam.leaderUid === currentUid);
  const currentTeamCount = activeTeam?.members?.length ?? 0;
  const maxMembers = activeTeam?.maxMembers ?? 4;

  useEffect(() => {
    if (!isApprovedMember || isSuspended) return;
    apiRequest<DirectoryMember[]>('/api/members/directory', { requireAuth: true })
      .then((rows) => setDirectory(rows))
      .catch(() => {});
  }, [isApprovedMember, isSuspended]);

  const incomingInvites = useMemo(
    () =>
      invitations.filter(
        (inv) =>
          !isTeamJoinRequestRecord(inv) &&
          inv.inviteeUid === currentUid &&
          inv.status === 'pending'
      ),
    [invitations, currentUid]
  );

  const outgoingInvites = useMemo(
    () =>
      invitations.filter(
        (inv) => !isTeamJoinRequestRecord(inv) && inv.inviterUid === currentUid
      ),
    [invitations, currentUid]
  );

  const filteredDirectory = useMemo(() => {
    const existingMemberIds = new Set((activeTeam?.members || []).map((m) => m.userUid));
    return directory.filter((m) => {
      if (m.uid === currentUid) return false;
      if (existingMemberIds.has(m.uid)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const skills = (m.technicalSkills || []).join(' ').toLowerCase();
      return (
        m.fullName?.toLowerCase().includes(q) ||
        m.escMemberId?.toLowerCase().includes(q) ||
        m.college?.toLowerCase().includes(q) ||
        m.branch?.toLowerCase().includes(q) ||
        skills.includes(q)
      );
    });
  }, [directory, activeTeam, currentUid, search]);

  const handleSendInvite = async (inviteeUid: string) => {
    if (!activeTeam) return;
    try {
      setBusyId(inviteeUid);
      await apiRequest(`/api/teams/${activeTeam.id}/invitations`, {
        method: 'POST',
        requireAuth: true,
        body: { inviteeUid, message: inviteMessage.trim() || undefined },
      });
      setInviteMessage('');
      onFeedback('success', 'Team invitation sent to approved ESC member.');
      await onRefreshTeams();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not send team invitation.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRespond = async (invitationId: string, decision: 'accept' | 'reject' | 'cancel') => {
    try {
      setBusyId(invitationId);
      await apiRequest(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        requireAuth: true,
        body: { decision },
      });
      onFeedback(
        'success',
        decision === 'accept'
          ? 'Invitation accepted! Welcome to your Startup Team workspace.'
          : decision === 'reject'
          ? 'Invitation declined.'
          : 'Invitation cancelled.'
      );
      await onRefreshTeams();
    } catch (err: any) {
      onFeedback('error', err?.message || 'Could not respond to invitation.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Incoming Invitations */}
      {incomingInvites.length > 0 && (
        <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#121612] p-5 space-y-3">
          <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-[#CCFF00]" /> Incoming Startup Team Invitations ({incomingInvites.length})
          </h4>
          <div className="space-y-2.5">
            {incomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#232731] bg-[#161922] p-4"
              >
                <div>
                  <div className="font-bold text-white text-sm">{inv.teamName}</div>
                  <div className="text-zinc-400">
                    Invited by <strong className="text-zinc-200">{inv.inviterName}</strong>
                  </div>
                  {inv.message && <p className="text-zinc-300 mt-1 italic">&ldquo;{inv.message}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => handleRespond(inv.id, 'accept')}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#CCFF00] px-3.5 py-2 font-display text-[11px] font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => handleRespond(inv.id, 'reject')}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Invite Approved ESC Members (Leader Only) */}
      {isLeaderOfActiveTeam && activeTeam && (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-display text-sm font-bold text-white">Invite Approved ESC Members</h4>
              <p className="text-zinc-400 text-[11px]">
                Search verified ESC fellows by name, Member ID, college, branch, or technical skills.
              </p>
            </div>
            <span className="rounded-full border border-[#CCFF00]/40 bg-[#CCFF00]/10 px-3 py-1 font-mono text-[11px] text-[#CCFF00] font-bold">
              Capacity: {currentTeamCount} / {maxMembers} Members
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ESC-2026-..., college, branch, or skills..."
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-9 pr-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Optional invite pitch (e.g. Need Embedded/React builder)..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          {currentTeamCount >= maxMembers ? (
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-amber-200 font-mono text-[11px]">
              Your Startup Team has reached the maximum capacity of {maxMembers} members (1 Leader + 3 Members).
            </div>
          ) : filteredDirectory.length === 0 ? (
            <p className="text-zinc-500 font-mono py-4 text-center">No matching approved members found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {filteredDirectory.slice(0, 20).map((m) => {
                const alreadyPending = outgoingInvites.some(
                  (inv) => inv.inviteeUid === m.uid && inv.teamId === activeTeam.id && inv.status === 'pending'
                );
                return (
                  <div
                    key={m.uid}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#232731] bg-[#151820] p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {m.fullName}{' '}
                        {m.escMemberId && (
                          <span className="font-mono text-[10px] text-[#CCFF00]">({m.escMemberId})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {m.branch || 'Engineering'} {m.college ? `• ${m.college}` : ''}
                      </div>
                      {m.technicalSkills && m.technicalSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.technicalSkills.slice(0, 3).map((sk, idx) => (
                            <span key={idx} className="rounded bg-[#1e222b] px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busyId === m.uid || alreadyPending || currentTeamCount >= maxMembers}
                      onClick={() => handleSendInvite(m.uid)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#CCFF00] px-3 py-1.5 font-display text-[10px] font-bold uppercase text-black disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      <UserPlus className="h-3 w-3" /> {alreadyPending ? 'Invited' : 'Invite'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outgoing Invites */}
          {outgoingInvites.length > 0 && (
            <div className="border-t border-[#20232d] pt-3 space-y-2">
              <span className="font-mono text-[10px] uppercase text-zinc-400">Sent Invitations History</span>
              <div className="space-y-1.5">
                {outgoingInvites.slice(0, 8).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-[#161922] px-3 py-2">
                    <div>
                      <span className="text-white font-medium">{inv.inviteeName}</span>
                      <span className="ml-2 font-mono text-[10px] text-zinc-400 uppercase">({inv.status})</span>
                    </div>
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busyId === inv.id}
                        onClick={() => handleRespond(inv.id, 'cancel')}
                        className="font-mono text-[10px] text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!activeTeam && incomingInvites.length === 0 && (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 text-center text-zinc-400 flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <span>No pending startup team invitations. Create your own team or wait for an invitation from a Team Leader.</span>
        </div>
      )}
    </div>
  );
};
