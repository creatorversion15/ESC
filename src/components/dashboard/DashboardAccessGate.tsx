import React from 'react';
import {
  ArrowRight,
  Ban,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Lock,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  getApplicationDisplayStatus,
  resolveWhatsappCommunityUrl,
  type MembershipJourneyEvaluation,
} from '../../utils/memberOnboardingLogic';
import type { Application, UserProfile } from '../../types';

interface DashboardAccessGateProps {
  journey: MembershipJourneyEvaluation;
  application: Application | null;
  profile: UserProfile | null;
  userEmail?: string | null;
  whatsappUrl?: string;
  navigate: (path: string) => void;
}

/**
 * Enforces strict conditional access on /dashboard for non-approved / suspended / inactive accounts.
 * Approved & active members bypass this gate and receive the full unified ESC Member Dashboard.
 */
export const DashboardAccessGate: React.FC<DashboardAccessGateProps> = ({
  journey,
  application,
  profile,
  userEmail,
  whatsappUrl,
  navigate,
}) => {
  const submittedDate = application?.createdAt
    ? new Date(application.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : application?.updatedAt
    ? new Date(application.updatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="min-h-[82vh] bg-[#0b0c0e] py-14 px-4 sm:px-6 lg:px-8"
      data-testid="dashboard-access-gate"
      data-journey-state={journey.state}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* STATE 1: NEVER APPLIED */}
        {journey.state === 'not_applied' && (
          <div className="rounded-2xl border border-[#2a2f3c] bg-[#111317] p-8 sm:p-10 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <span className="inline-block rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[10px] uppercase text-zinc-300">
                Member Dashboard Locked
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Apply for ESC Fellowship First
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed">
                The ESC Member Dashboard is exclusively available to approved and active members of Engineering Startup Company. Submit your fellowship application to get started.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/apply')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                {application?.status === 'draft' ? 'Resume Fellowship Application' : 'Apply for Fellowship'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-[#2b2f38] bg-[#161922] px-5 py-3 text-xs font-medium text-zinc-200 hover:border-[#39FF14]/50 cursor-pointer"
              >
                Back to Homepage
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: PENDING ADMIN REVIEW */}
        {journey.state === 'pending_review' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#39FF14]/40 bg-gradient-to-br from-[#0e1510] via-[#11141b] to-[#0c0e13] p-7 sm:p-9 space-y-5 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/45 bg-amber-950/40 px-3.5 py-1 font-mono text-xs font-bold uppercase text-amber-300">
                  <Clock className="h-3.5 w-3.5" /> Status: {journey.statusBadge}
                </span>
                {application?.id && (
                  <span className="font-mono text-xs text-[#CCFF00]">
                    Application ID: {application.id}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  YOUR ESC MEMBERSHIP APPLICATION
                </h1>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                  Thank you for your interest in ESC. Your application is currently under review by our Admin Team.
                </p>
                <p className="text-xs text-zinc-400">
                  Your ESC Member Dashboard, Startup Team creation, and official Digital Member Card will automatically unlock as soon as the Super Admin approves your application.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1f242e] text-xs">
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="font-mono text-[10px] uppercase text-zinc-500 block">Applicant</span>
                  <span className="font-semibold text-white">
                    {application?.fullName || profile?.fullName || userEmail}
                  </span>
                </div>
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="font-mono text-[10px] uppercase text-zinc-500 block">Submitted On</span>
                  <span className="font-mono text-zinc-200">{submittedDate || 'Recorded'}</span>
                </div>
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="font-mono text-[10px] uppercase text-zinc-500 block">Review Status</span>
                  <span className="font-mono font-bold text-amber-300 uppercase">
                    {getApplicationDisplayStatus(application?.status || profile?.membershipStatus)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/apply')}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/50 bg-[#121c13] px-5 py-2.5 font-display text-xs font-bold uppercase text-[#39FF14] hover:bg-[#39FF14]/15 cursor-pointer"
                >
                  <FileText className="h-4 w-4" /> View Application Details
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-xl border border-[#2b2f38] bg-[#161922] px-5 py-2.5 text-xs font-medium text-zinc-200 hover:text-white cursor-pointer"
                >
                  Return to Landing Page
                </button>
              </div>
            </div>

            {/* Official ESC WhatsApp Community Card (Allowed while Pending) */}
            <div className="rounded-2xl border border-[#39FF14]/45 bg-gradient-to-r from-[#0e190f] via-[#111519] to-[#0f1318] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                    Community Access Ready
                  </span>
                  <h2 className="font-display text-base font-bold text-white">JOIN THE ESC COMMUNITY</h2>
                  <p className="text-xs text-zinc-300">
                    Connect with fellow engineering students and innovators on the official ESC WhatsApp group while your application is being reviewed.
                  </p>
                </div>
              </div>
              <a
                href={resolveWhatsappCommunityUrl(whatsappUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010]"
              >
                Join WhatsApp Group <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* STATE 3: REJECTED */}
        {journey.state === 'rejected' && (
          <div className="rounded-2xl border border-red-800/60 bg-[#141013] p-8 sm:p-10 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-700/50 bg-red-950/50 text-red-400">
              <XCircle className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <span className="inline-block rounded-full border border-red-700/60 bg-red-950/60 px-3 py-1 font-mono text-[11px] font-bold uppercase text-red-300">
                Status: REJECTED
              </span>
              <h1 className="font-display text-2xl font-extrabold text-white">
                ESC Member Dashboard Not Available
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed">
                Your ESC Fellowship application was not approved for this cohort. Member dashboard privileges are restricted to approved active members.
              </p>
              {application?.adminNotes && (
                <div className="mx-auto max-w-lg rounded-xl border border-red-900/50 bg-red-950/25 p-4 text-left text-xs text-red-200 mt-3">
                  <span className="font-mono text-[10px] uppercase text-red-400 block mb-1">
                    Reviewer Feedback
                  </span>
                  <p>{application.adminNotes}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/support?category=Fellowship+Application')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" /> Contact ESC Support
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-[#2b2f38] bg-[#161922] px-5 py-2.5 text-xs text-zinc-200 cursor-pointer"
              >
                Return to Homepage
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: SUSPENDED OR INACTIVE */}
        {(journey.state === 'suspended' || journey.state === 'inactive') && (
          <div className="rounded-2xl border border-amber-700/50 bg-[#15120e] p-8 sm:p-10 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-600/50 bg-amber-950/50 text-amber-400">
              {journey.state === 'suspended' ? (
                <Ban className="h-7 w-7" />
              ) : (
                <ShieldAlert className="h-7 w-7" />
              )}
            </div>
            <div className="space-y-2">
              <span className="inline-block rounded-full border border-amber-600/50 bg-amber-950/50 px-3 py-1 font-mono text-[11px] font-bold uppercase text-amber-300">
                Status: {journey.statusBadge}
              </span>
              <h1 className="font-display text-2xl font-extrabold text-white">
                {journey.state === 'suspended'
                  ? 'Membership Temporarily Suspended'
                  : 'Membership Currently Inactive'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed">
                Member-only dashboard functionality, team creation, project submissions, and official member card generation are currently restricted. Your ESC account ({profile?.escMemberId || userEmail}) and historical records remain safely preserved.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/support?category=General+Enquiry')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" /> Contact ESC Admin
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-[#2b2f38] bg-[#161922] px-5 py-2.5 text-xs text-zinc-200 cursor-pointer"
              >
                Return to Homepage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
