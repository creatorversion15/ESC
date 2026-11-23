import React, { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { MemberActivityLog, UserProfile, StartupTeam } from '../../types';

interface MemberActivityMonitorSectionProps {
  activities: MemberActivityLog[];
  usersList: UserProfile[];
  teams: StartupTeam[];
  onRefresh: () => Promise<void>;
}

export const MemberActivityMonitorSection: React.FC<MemberActivityMonitorSectionProps> = ({
  activities,
  usersList,
  teams,
  onRefresh,
}) => {
  const [memberFilter, setMemberFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const activityTypes = useMemo(() => {
    return Array.from(new Set(activities.map((a) => a.activityType))).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (memberFilter !== 'all' && a.memberUid !== memberFilter && a.actorUid !== memberFilter) {
        return false;
      }
      if (teamFilter !== 'all' && a.teamId !== teamFilter) {
        return false;
      }
      if (typeFilter !== 'all' && a.activityType !== typeFilter) {
        return false;
      }
      if (dateFrom) {
        if ((a.createdAt || '').slice(0, 10) < dateFrom) return false;
      }
      return true;
    });
  }, [activities, memberFilter, teamFilter, typeFilter, dateFrom]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#232731] bg-[#121419] p-4 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
          >
            <option value="all">All Members</option>
            {usersList.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName} {u.escMemberId ? `(${u.escMemberId})` : ''}
              </option>
            ))}
          </select>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
          >
            <option value="all">All Startup Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.teamCode})
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
          >
            <option value="all">All Activity Types</option>
            {activityTypes.map((tp) => (
              <option key={tp} value={tp}>
                {tp.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
            aria-label="Filter from date"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
          <Activity className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400">No ecosystem activities match the selected filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1f26]">
              {filtered.map((act) => (
                <tr key={act.id} className="hover:bg-[#14161d]">
                  <td className="px-5 py-3 font-mono text-zinc-400 whitespace-nowrap">
                    {new Date(act.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-semibold text-white">{act.actorName}</td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-[#CCFF00]/10 px-2 py-0.5 font-mono text-[10px] text-[#CCFF00] uppercase">
                      {act.activityType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-300">
                    <div className="font-medium text-white">{act.title}</div>
                    <div className="text-[11px] text-zinc-400">{act.details}</div>
                  </td>
                  <td className="px-5 py-3 font-mono text-[10px] uppercase text-zinc-400">
                    {act.status || 'logged'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
