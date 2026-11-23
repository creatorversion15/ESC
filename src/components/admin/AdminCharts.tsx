import React, { useState } from 'react';
import { BarChart3, PieChart, Layers } from 'lucide-react';
import type { AdminMetricsSummary } from '../../utils/escLogic';

interface AdminChartsProps {
  metrics: AdminMetricsSummary;
}

export const AdminCharts: React.FC<AdminChartsProps> = ({ metrics }) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const maxTrendValue = Math.max(
    1,
    ...metrics.registrationTrend7d.map((d) => Math.max(d.users, d.applications))
  );

  const totalAppsForPipeline = Math.max(1, metrics.totalApplications);
  const maxBranchCount = Math.max(1, ...(metrics.branchDistribution.map((b) => b.count)));

  const statusColors: Record<string, string> = {
    submitted: 'bg-blue-400',
    under_review: 'bg-cyan-400',
    shortlisted: 'bg-purple-400',
    more_info_required: 'bg-amber-400',
    approved: 'bg-[#CCFF00]',
    rejected: 'bg-red-500',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. 7-Day Registration & Application Velocity */}
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
              7-Day Activity
            </span>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <BarChart3 className="h-4 w-4 text-[#CCFF00]" />
              Registrations vs Applications
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#CCFF00]"></span> Users
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-sky-400"></span> Apps
            </span>
          </div>
        </div>

        <div className="h-44 flex items-end justify-between gap-2 pt-4 border-b border-[#1f2229] pb-2">
          {metrics.registrationTrend7d.map((day) => {
            const userHeight = Math.round((day.users / maxTrendValue) * 100);
            const appHeight = Math.round((day.applications / maxTrendValue) * 100);
            const isHovered = hoveredDay === day.date;

            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredDay(day.date)}
                onMouseLeave={() => setHoveredDay(null)}
                className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
              >
                {isHovered && (
                  <div className="absolute -top-9 z-20 rounded-lg border border-[#2f3542] bg-[#0b0c0e] px-2 py-1 text-[10px] font-mono text-white whitespace-nowrap shadow-xl">
                    {day.date}: {day.users}u / {day.applications}a
                  </div>
                )}
                <div className="w-full flex items-end justify-center gap-1 h-32">
                  <div
                    className="w-3 rounded-t bg-[#CCFF00] transition-all duration-300 group-hover:brightness-110"
                    style={{ height: `${Math.max(day.users > 0 ? 12 : 4, userHeight)}%` }}
                    title={`${day.users} new users`}
                  />
                  <div
                    className="w-3 rounded-t bg-sky-400 transition-all duration-300 group-hover:brightness-110"
                    style={{ height: `${Math.max(day.applications > 0 ? 12 : 4, appHeight)}%` }}
                    title={`${day.applications} applications`}
                  />
                </div>
                <span className="font-mono text-[10px] text-zinc-500 mt-2">{day.label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Last 7d signups: <strong className="text-white">{metrics.newRegistrations7d}</strong></span>
          <span>Last 30d: <strong className="text-[#CCFF00]">{metrics.newRegistrations30d}</strong></span>
        </div>
      </div>

      {/* 2. Application Pipeline Breakdown */}
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
            Admissions Funnel
          </span>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <PieChart className="h-4 w-4 text-[#CCFF00]" />
            Application Status Breakdown
          </h3>
        </div>

        <div className="space-y-3 pt-1">
          {metrics.applicationStatusBreakdown.map((item) => {
            const pct = Math.round((item.count / totalAppsForPipeline) * 100);
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{item.label}</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    <strong className="text-white">{item.count}</strong> ({metrics.totalApplications > 0 ? pct : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1a1d24] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${statusColors[item.key] || 'bg-zinc-400'}`}
                    style={{ width: `${metrics.totalApplications > 0 ? pct : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Engineering Branches Breakdown */}
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
            Community Composition
          </span>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <Layers className="h-4 w-4 text-[#CCFF00]" />
            Registered Branches
          </h3>
        </div>

        {metrics.branchDistribution.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-500 font-mono">
            No branch metadata recorded across registered users yet.
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {metrics.branchDistribution.map((b) => {
              const pct = Math.round((b.count / maxBranchCount) * 100);
              return (
                <div key={b.branch} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200 truncate max-w-[190px]">{b.branch}</span>
                    <span className="font-mono text-[11px] text-[#CCFF00] font-bold">{b.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1a1d24] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#CCFF00] to-emerald-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
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
