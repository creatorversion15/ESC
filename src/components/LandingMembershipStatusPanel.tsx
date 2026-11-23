import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/apiClient';
import {
  getApplicationDisplayStatus,
  resolveWhatsappCommunityUrl,
} from '../utils/memberOnboardingLogic';
import type { SiteSettings } from '../types';

interface LandingMembershipStatusPanelProps {
  navigate: (path: string) => void;
}

export const LandingMembershipStatusPanel: React.FC<LandingMembershipStatusPanelProps> = ({
  navigate,
}) => {
  const {
    user,
    profile,
    application,
    loading,
    membershipJourney,
    refreshProfile,
  } = useAuth();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    apiRequest<SiteSettings>('/api/site-settings')
      .then((s) => {
        if (s?.whatsappCommunityUrl) setWhatsappUrl(s.whatsappCommunityUrl);
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user || membershipJourney.state === 'logged_out') {
    return null;
  }

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const formattedSubmissionDate = application?.createdAt
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
    : 'Recently submitted';

  const formattedUpdatedDate = application?.updatedAt
    ? new Date(application.updatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : formattedSubmissionDate;

  return (
    <section
      aria-label="ESC Membership Status"
      data-testid="landing-membership-status-panel"
      data-journey-state={membershipJourney.state}
      className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6"
    >
      {/* USER A: LOGGED IN — NEVER APPLIED */}
      {membershipJourney.state === 'not_applied' && (
        <div className="rounded-2xl border border-[#39FF14]/35 bg-gradient-to-r from-[#0f1610] via-[#12151b] to-[#0f1116] p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#39FF14]">
                  Signed in as {profile?.fullName || user.displayName || user.email}
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
                  {membershipJourney.statusBadge}
                </span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                Ready to Join Engineering Startup Company?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                Complete your official ESC Fellowship Application to unlock the community, mentorship, and after admin approval, your full ESC Member Dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/apply')}
            data-testid="landing-status-apply-btn"
            className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors cursor-pointer"
          >
            {application?.status === 'draft' ? 'Resume Application' : 'Apply for Fellowship'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* USER B: APPLICATION SUBMITTED — PENDING ADMIN REVIEW */}
      {membershipJourney.state === 'pending_review' && (
        <div className="rounded-2xl border border-[#39FF14]/40 bg-gradient-to-br from-[#0e1510] via-[#11141b] to-[#0c0e13] p-5 sm:p-7 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/45 bg-amber-950/40 px-3 py-1 font-mono text-[11px] font-bold uppercase text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  Status: {membershipJourney.statusBadge}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1 rounded-full border border-[#2a2f3a] bg-[#161922] px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:border-[#39FF14]/50 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
                </button>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                YOUR ESC MEMBERSHIP APPLICATION
              </h2>
              <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                Thank you for your interest in ESC. Your application is currently under review by our Admin Team.
              </p>
              <p className="text-xs text-zinc-400">
                Your ESC Member Dashboard and membership benefits will become available after admin approval.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                data-testid="landing-view-application-details-btn"
                className="inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/50 bg-[#121c13] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-[#39FF14] hover:bg-[#39FF14]/15 transition-colors cursor-pointer"
              >
                <Eye className="h-4 w-4" />
                VIEW APPLICATION DETAILS
              </button>
              <a
                href={resolveWhatsappCommunityUrl(whatsappUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 font-display text-xs font-extrabold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Join ESC WhatsApp
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#1e232d]">
            <div className="rounded-xl border border-[#222733] bg-[#0e1016] p-3">
              <span className="block font-mono text-[10px] uppercase text-zinc-500">Application ID</span>
              <span className="font-mono text-xs font-bold text-[#CCFF00] truncate block mt-0.5">
                {application?.id || `app_${user.uid}`}
              </span>
            </div>
            <div className="rounded-xl border border-[#222733] bg-[#0e1016] p-3">
              <span className="block font-mono text-[10px] uppercase text-zinc-500">Submission Date</span>
              <span className="font-mono text-xs text-zinc-200 block mt-0.5">
                {formattedSubmissionDate}
              </span>
            </div>
            <div className="rounded-xl border border-[#222733] bg-[#0e1016] p-3">
              <span className="block font-mono text-[10px] uppercase text-zinc-500">Current Status</span>
              <span className="font-mono text-xs font-bold text-amber-300 uppercase block mt-0.5">
                {getApplicationDisplayStatus(application?.status || profile?.membershipStatus)}
              </span>
            </div>
            <div className="rounded-xl border border-[#222733] bg-[#0e1016] p-3">
              <span className="block font-mono text-[10px] uppercase text-zinc-500">Latest Status Update</span>
              <span className="font-mono text-xs text-zinc-200 block mt-0.5">
                {formattedUpdatedDate}
              </span>
            </div>
          </div>

          {application?.status === 'more_info_required' && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div>
                <strong className="text-amber-300">Reviewer requested additional details:</strong>{' '}
                {application.adminNotes || 'Please update your application profile.'}
              </div>
              <button
                type="button"
                onClick={() => navigate('/apply')}
                className="shrink-0 rounded-lg bg-amber-400 px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
              >
                Update Application
              </button>
            </div>
          )}
        </div>
      )}

      {/* USER C: APPLICATION APPROVED — ACTIVE ESC MEMBER */}
      {membershipJourney.state === 'approved_active' && (
        <div className="rounded-2xl border border-[#39FF14]/55 bg-gradient-to-r from-[#0c1c0d] via-[#111714] to-[#0d1117] p-5 sm:p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-[0_20px_50px_rgba(57,255,20,0.08)]">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#39FF14] px-3 py-1 font-mono text-[11px] font-extrabold uppercase text-black">
                <BadgeCheck className="h-3.5 w-3.5" />
                {profile?.escMemberId ? `ESC Member ID: ${profile.escMemberId}` : 'OFFICIAL ESC MEMBER'}
              </span>
              <span className="rounded-full border border-[#39FF14]/40 bg-[#39FF14]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#39FF14]">
                ACTIVE MEMBERSHIP
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
              🎉 WELCOME TO ESC! YOUR MEMBERSHIP HAS BEEN APPROVED.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
              Congratulations! Your application has been approved. You are now an official active member of Engineering Startup Company.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              data-testid="landing-enter-dashboard-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3.5 font-display text-xs font-extrabold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors shadow-[0_0_25px_rgba(57,255,20,0.3)] cursor-pointer"
            >
              ENTER YOUR ESC DASHBOARD
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* USER D: APPLICATION REJECTED */}
      {membershipJourney.state === 'rejected' && (
        <div className="rounded-2xl border border-red-800/60 bg-gradient-to-r from-[#1a0d10] via-[#141217] to-[#0f1014] p-5 sm:p-6 space-y-3 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-700/50 bg-red-950/50 text-red-400">
                <XCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-700/60 bg-red-950/60 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-red-300">
                  Status: REJECTED
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  ESC Fellowship Application Update
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                  Thank you for applying to Engineering Startup Company. Your application was not approved for the current cohort. You can continue exploring public resources or contact ESC Support for guidance.
                </p>
                {application?.adminNotes && (
                  <p className="text-xs text-red-200/90 pt-1">
                    <strong>Reviewer Feedback:</strong> {application.adminNotes}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2d313d] bg-[#161922] px-4 py-2.5 font-mono text-xs text-zinc-200 hover:border-zinc-500 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" /> View Application
              </button>
              <button
                type="button"
                onClick={() => navigate('/support?category=Fellowship+Application')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-700/50 bg-red-950/40 px-4 py-2.5 font-mono text-xs text-red-200 hover:bg-red-950/70 cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" /> Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER E: SUSPENDED OR INACTIVE ACCOUNT */}
      {(membershipJourney.state === 'suspended' || membershipJourney.state === 'inactive') && (
        <div className="rounded-2xl border border-amber-700/50 bg-gradient-to-r from-[#19120b] via-[#141317] to-[#0f1014] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-600/50 bg-amber-950/50 text-amber-400">
              {membershipJourney.state === 'suspended' ? (
                <Ban className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/50 bg-amber-950/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-300">
                Status: {membershipJourney.statusBadge}
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                {membershipJourney.state === 'suspended'
                  ? 'ESC Membership Temporarily Suspended'
                  : 'ESC Membership Currently Inactive'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                Member-only dashboard actions, startup team collaboration, and member card generation are currently restricted. Your account and historical records remain preserved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/support?category=General+Enquiry')}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-amber-300 cursor-pointer"
          >
            <HelpCircle className="h-4 w-4" /> Contact ESC Admin
          </button>
        </div>
      )}

      {/* Read-Only Application Details Modal */}
      {detailsOpen && application && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-details-modal-title"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-[#2a2f3c] bg-[#0f1116] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#1f242e] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
                  Application ID: {application.id || `app_${user.uid}`}
                </span>
                <h3 id="app-details-modal-title" className="font-display text-xl font-bold text-white mt-0.5">
                  ESC Fellowship Application Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close application details"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#1b1f29] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Applicant Name</span>
                <span className="font-semibold text-white">{application.fullName}</span>
              </div>
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Email</span>
                <span className="text-zinc-200">{application.email}</span>
              </div>
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">College &amp; Branch</span>
                <span className="text-zinc-200">
                  {application.college} • {application.branch} ({application.academicYear})
                </span>
              </div>
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Location &amp; Availability</span>
                <span className="text-zinc-200">
                  {application.city}, {application.state} • {application.weeklyAvailability}
                </span>
              </div>
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Current Status</span>
                <span className="font-mono font-bold uppercase text-[#39FF14]">
                  {getApplicationDisplayStatus(application.status)}
                </span>
              </div>
              <div className="rounded-xl border border-[#222631] bg-[#14171f] p-3">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Submission Date</span>
                <span className="font-mono text-zinc-200">{formattedSubmissionDate}</span>
              </div>
            </div>

            {application.technicalSkills && application.technicalSkills.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Technical Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {application.technicalSkills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-lg border border-[#2a2f3b] bg-[#161922] px-2.5 py-1 font-mono text-[11px] text-zinc-200"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-zinc-500 block">Motivation Statement</span>
              <p className="rounded-xl border border-[#222631] bg-[#14171f] p-3.5 text-zinc-300 leading-relaxed whitespace-pre-line">
                {application.whyJoin}
              </p>
            </div>

            {application.adminNotes && (
              <div className="space-y-1 text-xs">
                <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">ESC Admin Reviewer Note</span>
                <p className="rounded-xl border border-[#CCFF00]/30 bg-[#141812] p-3.5 text-zinc-200">
                  {application.adminNotes}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1f242e]">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-xl border border-[#2d3240] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailsOpen(false);
                  navigate('/apply');
                }}
                className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
              >
                Open Full Status Tracker
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
