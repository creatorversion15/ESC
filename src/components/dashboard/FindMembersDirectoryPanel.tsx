import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Search, Users } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';

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

interface FindMembersDirectoryPanelProps {
  currentUid: string;
  onInviteHint?: () => void;
}

export const FindMembersDirectoryPanel: React.FC<FindMembersDirectoryPanelProps> = ({
  currentUid,
  onInviteHint,
}) => {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiRequest<DirectoryMember[]>('/api/members/directory', { requireAuth: true })
      .then((rows) => setMembers(Array.isArray(rows) ? rows : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!q) return true;
      const hay = [
        m.fullName,
        m.escMemberId || '',
        m.college || '',
        m.branch || '',
        m.academicYear || '',
        ...(m.technicalSkills || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [members, search]);

  return (
    <div className="space-y-5 text-xs" data-testid="find-members-directory-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-white">ESC Approved Member Directory</h3>
          <p className="text-zinc-400">
            Connect with verified student engineers, hardware builders, and founders across ESC cohorts.
          </p>
        </div>
        <span className="rounded-full border border-[#39FF14]/35 bg-[#101911] px-3 py-1 font-mono text-[11px] font-bold text-[#39FF14]">
          {filtered.length} Verified Member{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ESC Member ID, college, branch, or technical skill..."
          className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#6b7280] focus:border-[#39FF14] focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="py-10 text-center font-mono text-zinc-500">Loading approved ESC members...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-2">
          <Users className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-400">No verified ESC members matched your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((member) => (
            <div
              key={member.uid}
              className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-white truncate">
                    {member.fullName}
                    {member.uid === currentUid && (
                      <span className="ml-1.5 font-mono text-[10px] text-[#39FF14]">(You)</span>
                    )}
                  </span>
                  {member.escMemberId && (
                    <span className="inline-flex items-center gap-1 rounded bg-[#39FF14]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#39FF14] shrink-0">
                      <BadgeCheck className="h-3 w-3" /> {member.escMemberId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  {member.college || 'Engineering Student'}
                  {member.branch ? ` • ${member.branch}` : ''}
                  {member.academicYear ? ` (${member.academicYear})` : ''}
                </p>
                {member.technicalSkills && member.technicalSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {member.technicalSkills.slice(0, 5).map((sk) => (
                      <span
                        key={sk}
                        className="rounded border border-[#2a2e39] bg-[#171a23] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#1e222b] flex items-center justify-between text-[11px] font-mono">
                <span className={member.startupTeamId ? 'text-zinc-400' : 'text-[#CCFF00]'}>
                  {member.startupTeamId ? 'In Startup Team' : 'Open to Join Team'}
                </span>
                {onInviteHint && member.uid !== currentUid && !member.startupTeamId && (
                  <button
                    type="button"
                    onClick={onInviteHint}
                    className="text-[#39FF14] hover:underline cursor-pointer"
                  >
                    Invite via Teams →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
