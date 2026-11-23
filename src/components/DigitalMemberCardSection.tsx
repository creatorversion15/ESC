import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  FileDown,
  IdCard,
  Lock,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { MemberVerificationResult, MemberVerificationStatus } from '../types';
import {
  buildMemberVerificationUrl,
  evaluateMemberCardEligibility,
  getApplicationDisplayStatus,
  OFFICIAL_ESC_LOGO,
  OFFICIAL_ESC_WEBSITE,
} from '../utils/memberOnboardingLogic';
import {
  downloadMemberCardPdf,
  downloadMemberCardPng,
  type MemberCardData,
} from '../utils/memberCardExport';
import { ProfilePhotoUploaderModal } from './dashboard/ProfilePhotoUploaderModal';

interface DigitalMemberCardSectionProps {
  initialMemberId?: string | null;
  navigate: (path: string) => void;
}

const STATUS_BADGE_STYLES: Record<
  MemberVerificationStatus,
  { container: string; text: string; dot: string }
> = {
  Active: {
    container: 'border-[#39FF14]/60 bg-[#39FF14]/15',
    text: 'text-[#39FF14]',
    dot: 'bg-[#39FF14]',
  },
  Inactive: {
    container: 'border-amber-500/60 bg-amber-950/50',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  Suspended: {
    container: 'border-red-500/60 bg-red-950/60',
    text: 'text-red-300',
    dot: 'bg-red-500',
  },
  Expired: {
    container: 'border-orange-500/60 bg-orange-950/60',
    text: 'text-orange-300',
    dot: 'bg-orange-400',
  },
  'Invalid Member ID': {
    container: 'border-red-600/60 bg-red-950/60',
    text: 'text-red-300',
    dot: 'bg-red-500',
  },
};

interface VisualCardProps {
  card: MemberCardData;
  qrDataUrl: string;
  side: 'front' | 'back';
}

export const EscMemberCardVisual: React.FC<VisualCardProps> = ({ card, qrDataUrl, side }) => {
  if (side === 'front') {
    return (
      <div
        data-testid="esc-member-card-front"
        className="relative w-full aspect-[1050/660] rounded-2xl border border-[#39FF14]/45 bg-[#07090B] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65)] select-none"
      >
        {/* Top neon bar */}
        <div className="h-1.5 w-full bg-[#39FF14]" />

        {/* Subtle architectural grid & ambient radial light */}
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(57,255,20,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(57,255,20,0.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(57,255,20,0.16) 0%, rgba(57,255,20,0) 70%)',
          }}
        />

        <div className="relative z-10 flex h-[calc(100%-6px)] flex-col justify-between p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-[#39FF14]/50 bg-[#050608] p-1.5">
                <img
                  src={OFFICIAL_ESC_LOGO}
                  alt="ESC Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[11px] sm:text-sm font-extrabold tracking-wide text-white truncate">
                  ENGINEERING STARTUP COMPANY
                </p>
                <p className="font-mono text-[9px] sm:text-[11px] font-bold tracking-[0.16em] text-[#39FF14]">
                  DIGITAL MEMBER IDENTITY
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-[#39FF14]/60 bg-[#39FF14]/15 px-2.5 py-1 font-mono text-[9px] sm:text-[11px] font-bold uppercase text-[#39FF14]">
              {card.statusLabel}
            </span>
          </div>

          {/* Center Identity Grid */}
          <div className="grid grid-cols-12 gap-3 sm:gap-5 items-center py-2">
            {/* Left Portrait + Member ID */}
            <div className="col-span-4 flex flex-col items-center gap-2">
              <div className="w-full aspect-square max-w-[140px] rounded-xl border-2 border-[#39FF14]/65 bg-[#11141a] overflow-hidden">
                <img
                  src={card.profilePhotoUrl}
                  alt={card.fullName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="w-full max-w-[140px] rounded-lg border border-[#39FF14]/45 bg-[#0e150f] px-2 py-1 text-center">
                <span className="font-mono text-[9px] sm:text-xs font-bold text-[#39FF14] block truncate">
                  {card.escMemberId}
                </span>
              </div>
            </div>

            {/* Right Member Fields */}
            <div className="col-span-8 space-y-2 sm:space-y-3 min-w-0">
              <div>
                <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-[#39FF14] block">
                  {card.designation || 'ESC MEMBER'}
                </span>
                <h4 className="font-display text-base sm:text-2xl font-extrabold text-white leading-tight truncate">
                  {card.fullName}
                </h4>
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-left">
                <div>
                  <span className="font-mono text-[8px] sm:text-[10px] uppercase tracking-wider text-zinc-400 block">
                    College / University
                  </span>
                  <span className="text-[11px] sm:text-sm font-semibold text-zinc-100 block truncate">
                    {card.college || 'Engineering Institution'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] sm:text-[10px] uppercase tracking-wider text-zinc-400 block">
                      Branch
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-zinc-100 block truncate">
                      {card.branch || 'Engineering'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] sm:text-[10px] uppercase tracking-wider text-zinc-400 block">
                      Academic Year
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-zinc-100 block truncate">
                      {card.academicYear || 'Student'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Motto & Website */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            <span className="font-mono text-[8px] sm:text-[10px] font-bold tracking-[0.12em] text-[#39FF14] truncate">
              THINK. ENGINEER. BUILD. LAUNCH.
            </span>
            <span className="font-mono text-[8px] sm:text-[10px] text-zinc-300 shrink-0">
              {OFFICIAL_ESC_WEBSITE}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // CARD BACK
  return (
    <div
      data-testid="esc-member-card-back"
      className="relative w-full aspect-[1050/660] rounded-2xl border border-[#39FF14]/45 bg-[#07090B] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65)] select-none"
    >
      <div className="h-1.5 w-full bg-[#39FF14]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(57,255,20,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(57,255,20,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 flex h-[calc(100%-6px)] flex-col justify-between p-4 sm:p-6">
        {/* Header */}
        <div className="border-b border-white/10 pb-2.5">
          <span className="font-mono text-[9px] sm:text-[10px] font-bold tracking-[0.16em] text-[#39FF14] block">
            OFFICIAL VERIFICATION CREDENTIAL
          </span>
          <p className="font-display text-xs sm:text-base font-extrabold text-white">
            ENGINEERING STARTUP COMPANY (ESC)
          </p>
        </div>

        {/* Center QR & Details */}
        <div className="grid grid-cols-12 gap-4 items-center py-2">
          <div className="col-span-5 flex flex-col items-center gap-1.5">
            <div className="w-full max-w-[148px] aspect-square rounded-xl border-2 border-[#39FF14] bg-white p-1.5 flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${card.escMemberId}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <QrCode className="h-12 w-12 text-black" />
              )}
            </div>
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-400 text-center">
              Scan to Verify Membership
            </span>
          </div>

          <div className="col-span-7 space-y-2.5 min-w-0">
            <div>
              <span className="font-mono text-[8px] sm:text-[10px] uppercase text-zinc-400 block">
                Member Name
              </span>
              <p className="font-display text-sm sm:text-lg font-extrabold text-white truncate">
                {card.fullName}
              </p>
            </div>
            <div>
              <span className="font-mono text-[8px] sm:text-[10px] uppercase text-zinc-400 block">
                Unique ESC Member ID
              </span>
              <p className="font-mono text-xs sm:text-base font-bold text-[#39FF14] truncate">
                {card.escMemberId}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[10px] sm:text-xs text-zinc-300 leading-relaxed">
              Official ESC digital identity credential. Scan the QR code or verify this Member ID live at{' '}
              <span className="font-mono text-[#39FF14]">{OFFICIAL_ESC_WEBSITE}/#/verify</span>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <span className="font-mono text-[8px] sm:text-[10px] text-zinc-400 truncate">
            REAL-TIME REGISTRY BACKED
          </span>
          <span className="font-mono text-[8px] sm:text-[10px] font-bold text-[#39FF14] shrink-0">
            {OFFICIAL_ESC_WEBSITE}
          </span>
        </div>
      </div>
    </div>
  );
};

export const DigitalMemberCardSection: React.FC<DigitalMemberCardSectionProps> = ({
  initialMemberId,
  navigate,
}) => {
  const { user, profile, application, signInWithGoogle, updateUserProfile, refreshProfile } = useAuth();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const [generatingCard, setGeneratingCard] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [cardFeedback, setCardFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Public Member ID Verification state
  const [memberIdInput, setMemberIdInput] = useState(initialMemberId || '');
  const [verifyingMember, setVerifyingMember] = useState(false);
  const [verificationResult, setVerificationResult] = useState<MemberVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const eligibility = useMemo(
    () =>
      evaluateMemberCardEligibility({
        isLoggedIn: Boolean(user),
        membershipStatus: profile?.membershipStatus || application?.status,
        accountStatus: profile?.accountStatus,
        escMemberId: profile?.escMemberId,
        profilePhotoUrl: profile?.profilePhotoUrl,
      }),
    [user, profile, application]
  );

  const memberCardData: MemberCardData | null = useMemo(() => {
    if (!eligibility.eligible || !profile?.escMemberId || !profile?.profilePhotoUrl) return null;
    return {
      fullName: profile.fullName || user?.displayName || 'ESC Member',
      escMemberId: profile.escMemberId,
      college: profile.college || application?.college || 'Engineering Institution',
      branch: profile.branch || application?.branch || 'Engineering',
      academicYear: profile.academicYear || application?.academicYear || 'Student',
      designation: 'ESC MEMBER',
      statusLabel: 'Active',
      profilePhotoUrl: profile.profilePhotoUrl,
      approvalDate: profile.approvalDate,
    };
  }, [eligibility.eligible, profile, application, user]);

  // Generate live scannable QR code for eligible member
  useEffect(() => {
    if (!memberCardData?.escMemberId) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    const url = buildMemberVerificationUrl(memberCardData.escMemberId);
    QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#07090B', light: '#FFFFFF' },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [memberCardData?.escMemberId]);

  const verifyMemberById = async (rawId: string) => {
    const cleanId = rawId.trim().toUpperCase();
    if (!cleanId) return;
    try {
      setVerifyingMember(true);
      setVerificationError(null);
      const res = await apiRequest<MemberVerificationResult>(
        `/api/members/verify/${encodeURIComponent(cleanId)}`,
        { requireAuth: false }
      );
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult(null);
      setVerificationError(err?.message || 'Unable to verify Member ID right now. Please try again.');
    } finally {
      setVerifyingMember(false);
    }
  };

  // Auto-verify when landing from QR code link: /#/verify?member=ESC-2026-0001
  useEffect(() => {
    if (initialMemberId && initialMemberId.trim()) {
      setMemberIdInput(initialMemberId.trim().toUpperCase());
      verifyMemberById(initialMemberId);
      window.setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 160);
    }
  }, [initialMemberId]);

  const handleGenerateMemberCard = async () => {
    if (!eligibility.eligible || !user) return;
    try {
      setGeneratingCard(true);
      setCardFeedback(null);
      const res = await apiRequest<{
        generated: boolean;
        memberCardGeneratedAt: string;
        member?: { escMemberId?: string };
      }>('/api/member-card/generate', {
        method: 'POST',
        requireAuth: true,
      });

      const generatedAt = res.memberCardGeneratedAt || new Date().toISOString();
      await setDoc(
        doc(db, 'users', user.uid),
        {
          memberCardGeneratedAt: generatedAt,
          updatedAt: generatedAt,
        },
        { merge: true }
      ).catch(() => {});

      await refreshProfile();
      setCardFeedback({
        type: 'success',
        message: `Official ESC Digital Member Card generated and registered for ${res.member?.escMemberId || profile?.escMemberId}.`,
      });
    } catch (err: any) {
      setCardFeedback({
        type: 'error',
        message: err?.message || 'Unable to generate your ESC Digital Member Card.',
      });
    } finally {
      setGeneratingCard(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!memberCardData) return;
    try {
      setDownloadingPng(true);
      setCardFeedback(null);
      const { filename } = await downloadMemberCardPng(memberCardData);
      setCardFeedback({
        type: 'success',
        message: `Downloaded high-resolution PNG member card: ${filename}`,
      });
    } catch (err: any) {
      setCardFeedback({
        type: 'error',
        message: err?.message || 'Failed to export PNG member card.',
      });
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!memberCardData) return;
    try {
      setDownloadingPdf(true);
      setCardFeedback(null);
      const { filename } = await downloadMemberCardPdf(memberCardData);
      setCardFeedback({
        type: 'success',
        message: `Downloaded official PDF member card: ${filename}`,
      });
    } catch (err: any) {
      setCardFeedback({
        type: 'error',
        message: err?.message || 'Failed to export PDF member card.',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleMemberVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMemberById(memberIdInput);
  };

  const currentStatusDisplay = getApplicationDisplayStatus(
    profile?.membershipStatus || application?.status
  );

  return (
    <section
      ref={sectionRef}
      id="digital-member-card"
      data-testid="digital-member-card-section"
      className="border-t border-[#222631] pt-12 mt-12 space-y-8"
    >
      {/* Section 2 Header */}
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/35 bg-[#0f1710] px-3.5 py-1 text-xs font-mono text-[#39FF14]">
          <IdCard className="h-3.5 w-3.5" /> Section 2 · Official ESC Member Identity
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
          ESC DIGITAL MEMBER CARD
        </h2>
        <p className="text-xs sm:text-sm text-[#9ca3af] max-w-xl mx-auto">
          Generate, view and verify your official ESC digital membership identity.
        </p>
      </div>

      {/* Part A: Member Digital Identity Card Generator & Preview */}
      <div className="rounded-2xl border border-[#232731] bg-[#101217] p-5 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1d212b] pb-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
              Personal Credential Studio
            </span>
            <h3 className="font-display text-lg font-bold text-white">
              Your Official ESC Digital Member Card
            </h3>
          </div>
          {user && profile?.escMemberId && eligibility.eligible && (
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-[#39FF14]/40 bg-[#39FF14]/10 px-3 py-1 font-mono text-xs font-bold text-[#39FF14]">
                {profile.escMemberId}
              </span>
              {profile.memberCardGeneratedAt && (
                <span className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
                  Card Issued
                </span>
              )}
            </div>
          )}
        </div>

        {/* Eligibility States */}
        {!eligibility.eligible ? (
          <div
            data-testid="member-card-ineligible-state"
            data-reason={eligibility.reasonCode}
            className="rounded-2xl border border-[#252a36] bg-[#0c0e13] p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-4"
          >
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                eligibility.reasonCode === 'missing_profile_photo' ||
                eligibility.reasonCode === 'not_logged_in'
                  ? 'border border-[#39FF14]/35 bg-[#39FF14]/10 text-[#39FF14]'
                  : eligibility.reasonCode === 'rejected' ||
                      eligibility.reasonCode === 'inactive_or_suspended'
                    ? 'bg-red-950/60 text-red-400'
                    : 'bg-amber-950/50 text-amber-300'
              }`}
            >
              {eligibility.reasonCode === 'missing_profile_photo' ? (
                <Camera className="h-7 w-7" />
              ) : eligibility.reasonCode === 'not_logged_in' ? (
                <UserCheck className="h-7 w-7" />
              ) : (
                <Lock className="h-7 w-7" />
              )}
            </div>

            <div className="space-y-2">
              <p className="font-display text-base sm:text-lg font-bold text-white">
                {eligibility.message}
              </p>

              {eligibility.reasonCode === 'pending_approval' && (
                <p className="text-xs text-[#9ca3af]">
                  Current application status:{' '}
                  <strong className="text-white font-mono">{currentStatusDisplay}</strong>
                </p>
              )}

              {eligibility.reasonCode === 'missing_profile_photo' && (
                <p className="text-xs text-[#9ca3af]">
                  Your ESC Member ID <strong className="text-[#39FF14] font-mono">{profile?.escMemberId}</strong> is active. Upload a clear portrait photo (JPG, JPEG, PNG, or WebP) to unlock your official digital card.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {eligibility.reasonCode === 'not_logged_in' && (
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
                >
                  Sign In with Google
                </button>
              )}

              {eligibility.reasonCode === 'missing_profile_photo' && (
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  Upload Profile Photo
                </button>
              )}

              {eligibility.reasonCode === 'pending_approval' && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                  >
                    Open Member Dashboard
                  </button>
                  {(!application || application.status === 'draft') && (
                    <button
                      type="button"
                      onClick={() => navigate('/apply')}
                      className="rounded-xl border border-[#2b303c] bg-[#141720] px-5 py-2.5 text-xs font-semibold text-white hover:border-[#39FF14] cursor-pointer"
                    >
                      Apply for Fellowship
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          memberCardData && (
            <div className="space-y-6">
              {cardFeedback && (
                <div
                  role="status"
                  className={`rounded-xl border px-4 py-3 text-xs flex items-center gap-2 ${
                    cardFeedback.type === 'success'
                      ? 'border-[#39FF14]/45 bg-[#0e190f] text-[#39FF14]'
                      : 'border-red-800 bg-red-950/40 text-red-200'
                  }`}
                >
                  {cardFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{cardFeedback.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Interactive Card Display */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex rounded-xl border border-[#262b36] bg-[#0b0d12] p-1">
                      <button
                        type="button"
                        onClick={() => setCardSide('front')}
                        className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                          cardSide === 'front'
                            ? 'bg-[#39FF14] text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Card Front
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardSide('back')}
                        className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                          cardSide === 'back'
                            ? 'bg-[#39FF14] text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Card Back (QR)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPhotoModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-300 hover:text-[#39FF14] cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" /> Update Photo
                    </button>
                  </div>

                  <EscMemberCardVisual
                    card={memberCardData}
                    qrDataUrl={qrDataUrl}
                    side={cardSide}
                  />
                </div>

                {/* Action Panel */}
                <div className="lg:col-span-5 space-y-4 rounded-2xl border border-[#1f242f] bg-[#0c0e13] p-5">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
                      Verified Identity Controls
                    </span>
                    <h4 className="font-display text-base font-bold text-white">
                      Generate &amp; Export Credential
                    </h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">
                      Your card is linked directly to your live ESC membership status. Scanning the QR code on the back opens real-time verification on this page.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={handleGenerateMemberCard}
                      disabled={generatingCard}
                      data-testid="generate-member-card-btn"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                    >
                      {generatingCard ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {generatingCard
                        ? 'Registering Card...'
                        : profile?.memberCardGeneratedAt
                          ? 'Refresh Official Member Card'
                          : 'Generate Member Card'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      data-testid="preview-member-card-btn"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#2b303c] bg-[#141720] px-4 py-2.5 text-xs font-mono font-semibold text-white hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                    >
                      <Eye className="h-4 w-4" /> Preview Member Card (Front &amp; Back)
                    </button>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleDownloadPng}
                        disabled={downloadingPng}
                        data-testid="download-member-card-png"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-3.5 py-2.5 text-xs font-mono font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-white disabled:opacity-50 cursor-pointer"
                      >
                        <Download className="h-4 w-4 text-[#39FF14]" />
                        {downloadingPng ? 'Exporting...' : 'Download PNG'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        data-testid="download-member-card-pdf"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-3.5 py-2.5 text-xs font-mono font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-white disabled:opacity-50 cursor-pointer"
                      >
                        <FileDown className="h-4 w-4 text-[#39FF14]" />
                        {downloadingPdf ? 'Exporting...' : 'Download PDF'}
                      </button>
                    </div>
                  </div>

                  {profile?.memberCardGeneratedAt && (
                    <div className="rounded-xl border border-[#202721] bg-[#0d140e] px-3.5 py-2.5 text-[11px] font-mono text-zinc-300 flex items-center justify-between gap-2">
                      <span className="text-[#39FF14]">Card Registered</span>
                      <span className="tabular-nums">
                        {new Date(profile.memberCardGeneratedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Part B: Public ESC Member ID Verification */}
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5 max-w-xl mx-auto">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
            Live Public Registry Check
          </span>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
            Verify ESC Member ID
          </h3>
          <p className="text-xs text-[#9ca3af]">
            Enter any ESC Member ID or scan a member card QR code to check real-time membership status.
          </p>
        </div>

        <form
          onSubmit={handleMemberVerifySubmit}
          className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto"
        >
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
            <input
              type="text"
              value={memberIdInput}
              onChange={(e) => setMemberIdInput(e.target.value)}
              placeholder="Enter ESC Member ID (e.g. ESC-2026-0001)"
              required
              data-testid="verify-member-id-input"
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#39FF14] focus:outline-none uppercase font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={verifyingMember}
            data-testid="verify-member-submit-btn"
            className="w-full sm:w-auto rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#32e010] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {verifyingMember ? 'Verifying...' : 'Verify Member'}
          </button>
        </form>

        {verificationError && (
          <div className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-center text-xs text-red-200 max-w-xl mx-auto flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{verificationError}</span>
          </div>
        )}

        {verificationResult && (
          <div
            data-testid="member-verification-result"
            data-status={verificationResult.status}
            className={`rounded-2xl border p-5 sm:p-6 max-w-2xl mx-auto space-y-4 ${
              verificationResult.status === 'Active'
                ? 'border-[#39FF14]/45 bg-[#0c120d]'
                : verificationResult.status === 'Invalid Member ID'
                  ? 'border-red-800/60 bg-[#140d0e]'
                  : 'border-amber-700/50 bg-[#14110c]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                {verificationResult.found && verificationResult.profilePhotoUrl ? (
                  <img
                    src={verificationResult.profilePhotoUrl}
                    alt={verificationResult.fullName || 'Verified ESC Member'}
                    className="h-14 w-14 rounded-xl object-cover border border-[#39FF14]/50"
                  />
                ) : (
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      verificationResult.status === 'Active'
                        ? 'bg-[#39FF14]/15 text-[#39FF14]'
                        : verificationResult.status === 'Invalid Member ID'
                          ? 'bg-red-950/60 text-red-400'
                          : 'bg-amber-950/60 text-amber-300'
                    }`}
                  >
                    {verificationResult.status === 'Active' ? (
                      <ShieldCheck className="h-6 w-6" />
                    ) : verificationResult.status === 'Invalid Member ID' ? (
                      <XCircle className="h-6 w-6" />
                    ) : (
                      <ShieldAlert className="h-6 w-6" />
                    )}
                  </div>
                )}

                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
                    {verificationResult.escMemberId}
                  </span>
                  <h4 className="font-display text-lg font-bold text-white">
                    {verificationResult.found && verificationResult.fullName
                      ? verificationResult.fullName
                      : 'Member Record Not Found'}
                  </h4>
                  {verificationResult.found && verificationResult.designation && (
                    <span className="font-mono text-[11px] text-[#39FF14]">
                      {verificationResult.designation}
                    </span>
                  )}
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-2 self-start sm:self-center rounded-full border px-3.5 py-1 font-mono text-xs font-bold uppercase ${
                  STATUS_BADGE_STYLES[verificationResult.status].container
                } ${STATUS_BADGE_STYLES[verificationResult.status].text}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    STATUS_BADGE_STYLES[verificationResult.status].dot
                  }`}
                />
                {verificationResult.status}
              </span>
            </div>

            {verificationResult.found ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">{verificationResult.message}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">
                      College / University
                    </span>
                    <span className="font-semibold text-white">
                      {verificationResult.college || '—'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">
                      Engineering Branch &amp; Year
                    </span>
                    <span className="font-semibold text-white">
                      {verificationResult.branch || '—'}
                      {verificationResult.academicYear
                        ? ` • ${verificationResult.academicYear}`
                        : ''}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">
                      Official Member ID
                    </span>
                    <span className="font-mono font-bold text-[#39FF14] flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {verificationResult.escMemberId}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <span className="font-mono text-[10px] uppercase text-zinc-500 block">
                      Approval Date
                    </span>
                    <span className="font-mono text-white">
                      {verificationResult.approvalDate
                        ? new Date(verificationResult.approvalDate).toLocaleDateString()
                        : 'Verified Record'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-300">{verificationResult.message}</p>
            )}

            <p className="text-[11px] text-zinc-500 font-mono">
              Live database verification · Engineering Startup Company (ESC) · Public fields only (no private email, phone, or personal data disclosed).
            </p>
          </div>
        )}
      </div>

      {/* Side-by-Side Front + Back Preview Modal */}
      {previewOpen &&
        memberCardData &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-card-preview-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
          >
            <div className="w-full max-w-5xl rounded-2xl border border-[#262b36] bg-[#0d1015] p-5 sm:p-7 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between gap-3 border-b border-[#1f232c] pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#39FF14] block">
                    Official Digital Identity Preview
                  </span>
                  <h3 id="member-card-preview-title" className="font-display text-lg font-bold text-white">
                    {memberCardData.fullName} · {memberCardData.escMemberId}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close card preview"
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#191d26] hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 block">
                    Card Front
                  </span>
                  <EscMemberCardVisual card={memberCardData} qrDataUrl={qrDataUrl} side="front" />
                </div>
                <div className="space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 block">
                    Card Back · Verification QR
                  </span>
                  <EscMemberCardVisual card={memberCardData} qrDataUrl={qrDataUrl} side="back" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#1f232c] pt-4">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={downloadingPng}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b303c] bg-[#141720] px-4 py-2 text-xs font-mono font-semibold text-white hover:border-[#39FF14] cursor-pointer"
                >
                  <Download className="h-4 w-4 text-[#39FF14]" />
                  {downloadingPng ? 'Exporting PNG...' : 'Download PNG'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  <FileDown className="h-4 w-4" />
                  {downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Profile Photo Uploader Modal */}
      {user && (
        <ProfilePhotoUploaderModal
          isOpen={photoModalOpen}
          currentPhotoUrl={profile?.profilePhotoUrl}
          userUid={user.uid}
          onClose={() => setPhotoModalOpen(false)}
          onSavePhoto={async (photoUrl) => {
            await updateUserProfile({
              profilePhotoUrl: photoUrl,
              profilePhotoUpdatedAt: new Date().toISOString(),
            });
            setCardFeedback({
              type: 'success',
              message: 'Profile photo saved! Your ESC Digital Member Card preview has been updated.',
            });
          }}
        />
      )}
    </section>
  );
};
