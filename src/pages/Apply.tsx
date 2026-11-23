import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  Send,
  AlertCircle,
  Sparkles,
  Lock,
  FileText,
  Edit3,
  HelpCircle,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  validateApplicationStep,
  validateFullApplication,
  VALID_ACTIVE_TEAM_GOALS,
  type ApplicationFormData,
} from '../utils/escLogic';
import { POLICY_VERSION } from '../data/policies';
import { SkillSelector } from '../components/SkillSelector';
import {
  IdeaSubmissionModal,
  type IdeaProposalDraft,
} from '../components/IdeaSubmissionModal';
import { PolicyModal } from '../components/PolicyModal';
import type { Application, MembershipStatus, SiteSettings } from '../types';
import {
  canAccessWhatsappCommunity,
  getApplicationDisplayStatus,
  resolveWhatsappCommunityUrl,
} from '../utils/memberOnboardingLogic';
import { MagneticButton } from '../components/animations/MagneticButton';

interface ApplyProps {
  navigate: (path: string) => void;
}

const STARTUP_DOMAINS = [
  'AI & Robotics',
  'CleanTech & Renewable Energy',
  'MedTech & BioEngineering',
  'Aerospace & Avionics',
  'EV & Automotive',
  'Semiconductors',
  'Industrial Automation',
  'Environmental Tech',
  'Agritech',
  'Media & Creator Tech',
  'FinTech & SaaS',
  'EdTech & Social Impact',
];

const TEAM_GOAL_OPTIONS = [
  {
    id: 'build_team' as const,
    title: 'I have an idea & want to build a team',
    desc: 'Form a multidisciplinary team and build an engineering product inside ESC.',
  },
  {
    id: 'join_team' as const,
    title: 'I want to join an existing project',
    desc: 'Contribute your technical or creative skills to an approved ESC venture or project.',
  },
  {
    id: 'existing_idea' as const,
    title: 'I have an existing startup or product idea I am actively exploring',
    desc: 'Submit your active startup or product concept for ESC Admin review and mentorship.',
  },
];

export const Apply: React.FC<ApplyProps> = ({ navigate }) => {
  const { user, profile, application, signInWithGoogle, refreshProfile } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [editingMoreInfo, setEditingMoreInfo] = useState<boolean>(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  const [formData, setFormData] = useState<ApplicationFormData>({
    fullName: user?.displayName || '',
    email: user?.email || '',
    phone: '',
    college: '',
    city: '',
    state: '',
    branch: '',
    academicYear: '',
    technicalSkills: [],
    nonTechnicalSkills: [],
    customSkills: [],
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    whyJoin: '',
    startupInterests: [],
    hasExistingIdea: false,
    existingIdeaSummary: '',
    ideaAiAssisted: false,
    teamGoal: '',
    weeklyAvailability: '10-15 hrs/week',
    termsAccepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Step 4 interactive modals
  const [goalPopup, setGoalPopup] = useState<'build_team' | 'join_team' | null>(null);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [attachedProposal, setAttachedProposal] = useState<IdeaProposalDraft | null>(null);
  const [activePolicyModal, setActivePolicyModal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<SiteSettings>('/api/site-settings')
      .then((data) => {
        if (active && data) setSiteSettings(data);
      })
      .catch(() => {
        // Default open when settings unavailable
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync existing application or profile data
  useEffect(() => {
    if (application) {
      const normalizedGoal = (VALID_ACTIVE_TEAM_GOALS as readonly string[]).includes(
        application.teamGoal
      )
        ? application.teamGoal
        : '';
      setFormData({
        fullName: application.fullName || user?.displayName || '',
        email: user?.email || application.email || '',
        phone: application.phone || '',
        college: application.college || '',
        city: application.city || '',
        state: application.state || '',
        branch: application.branch || '',
        academicYear: application.academicYear || '',
        technicalSkills: application.technicalSkills || [],
        nonTechnicalSkills: application.nonTechnicalSkills || [],
        customSkills: application.customSkills || [],
        portfolioUrl: application.portfolioUrl || '',
        githubUrl: application.githubUrl || '',
        linkedinUrl: application.linkedinUrl || '',
        whyJoin: application.whyJoin || '',
        startupInterests: application.startupInterests || [],
        hasExistingIdea: Boolean(application.hasExistingIdea),
        existingIdeaSummary: application.existingIdeaSummary || '',
        ideaAiAssisted: false,
        teamGoal: normalizedGoal,
        weeklyAvailability: application.weeklyAvailability || '10-15 hrs/week',
        termsAccepted: Boolean(application.termsAccepted),
      });
    } else if (profile || user) {
      setFormData((prev) => ({
        ...prev,
        fullName: profile?.fullName || user?.displayName || prev.fullName,
        email: user?.email || profile?.email || prev.email,
        phone: profile?.phone || prev.phone,
        college: profile?.college || prev.college,
        branch: profile?.branch || prev.branch,
        academicYear: profile?.academicYear || prev.academicYear,
        city: profile?.city || prev.city,
        state: profile?.state || prev.state,
        technicalSkills:
          prev.technicalSkills.length > 0
            ? prev.technicalSkills
            : profile?.technicalSkills || [],
        nonTechnicalSkills:
          prev.nonTechnicalSkills.length > 0
            ? prev.nonTechnicalSkills
            : profile?.nonTechnicalSkills || [],
        customSkills:
          (prev.customSkills?.length || 0) > 0
            ? prev.customSkills
            : profile?.customSkills || [],
      }));
    }
  }, [application, profile, user]);

  const effectiveFormData: ApplicationFormData = {
    ...formData,
    email: user?.email || formData.email || '',
    hasExistingIdea: Boolean(formData.hasExistingIdea),
    termsAccepted: Boolean(formData.termsAccepted),
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleDomain = (domain: string) => {
    const exists = formData.startupInterests.includes(domain);
    setFormData({
      ...formData,
      startupInterests: exists
        ? formData.startupInterests.filter((s) => s !== domain)
        : [...formData.startupInterests, domain],
    });
  };

  const handleStepTabClick = (targetStep: number) => {
    if (targetStep === step) return;
    if (targetStep < step) {
      setErrors({});
      setStep(targetStep);
      return;
    }
    // Enforce mandatory validation for every step prior to targetStep (especially Step 1)
    for (let s = 1; s < targetStep; s++) {
      const res = validateApplicationStep(s, effectiveFormData);
      if (!res.isValid) {
        setStep(s);
        setErrors(res.errors);
        setSaveMessage({
          type: 'error',
          text:
            s === 1
              ? 'Please complete all mandatory Academic & Contact Profile fields in Step 1 before advancing.'
              : `Please complete all mandatory fields in Step ${s} before proceeding.`,
        });
        return;
      }
    }
    setSaveMessage(null);
    setErrors({});
    setStep(targetStep);
  };

  const handleNext = () => {
    const { isValid, errors: stepErrors } = validateApplicationStep(step, effectiveFormData);
    if (!isValid) {
      setErrors(stepErrors);
      setSaveMessage({
        type: 'error',
        text:
          step === 1
            ? 'Please fill in all mandatory Step 1 fields highlighted below before continuing.'
            : 'Please complete the required fields on this step before continuing.',
      });
      return;
    }
    setSaveMessage(null);
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrev = () => {
    setSaveMessage(null);
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const saveApplication = async (status: 'draft' | 'submitted') => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    if (status === 'submitted') {
      const fullValidation = validateFullApplication(effectiveFormData);
      if (!fullValidation.isValid) {
        setErrors(fullValidation.errors);
        if (fullValidation.firstInvalidStep !== null) {
          setStep(fullValidation.firstInvalidStep);
        }
        setSaveMessage({
          type: 'error',
          text: `Please complete all required fields (starting at Step ${fullValidation.firstInvalidStep || 1}) before submitting your application.`,
        });
        return;
      }
    }

    try {
      if (status === 'draft') setSavingDraft(true);
      if (status === 'submitted') setSubmitting(true);
      setSaveMessage(null);

      const appId = application?.id || `app_${user.uid}`;
      const appRef = doc(db, 'applications', appId);
      const nowIso = new Date().toISOString();

      const resolvedGoal: 'build_team' | 'join_team' | 'existing_idea' =
        effectiveFormData.teamGoal === 'join_team' ||
        effectiveFormData.teamGoal === 'existing_idea' ||
        effectiveFormData.teamGoal === 'build_team'
          ? effectiveFormData.teamGoal
          : 'build_team';

      const includeIdea = Boolean(effectiveFormData.hasExistingIdea);
      const termsAccepted = Boolean(effectiveFormData.termsAccepted);

      const payload: Partial<Application> = {
        userId: user.uid,
        email: user.email || effectiveFormData.email || '',
        fullName: effectiveFormData.fullName.trim(),
        phone: (effectiveFormData.phone || '').trim(),
        college: effectiveFormData.college.trim(),
        city: effectiveFormData.city.trim(),
        state: effectiveFormData.state.trim(),
        branch: effectiveFormData.branch.trim(),
        academicYear: effectiveFormData.academicYear,
        technicalSkills: effectiveFormData.technicalSkills,
        nonTechnicalSkills: effectiveFormData.nonTechnicalSkills,
        customSkills: effectiveFormData.customSkills || [],
        portfolioUrl: (effectiveFormData.portfolioUrl || '').trim(),
        githubUrl: (effectiveFormData.githubUrl || '').trim(),
        linkedinUrl: (effectiveFormData.linkedinUrl || '').trim(),
        whyJoin: effectiveFormData.whyJoin.trim(),
        startupInterests: effectiveFormData.startupInterests,
        hasExistingIdea: includeIdea,
        existingIdeaSummary: includeIdea ? (effectiveFormData.existingIdeaSummary || '').trim() : '',
        ideaAiAssisted: false,
        teamGoal: resolvedGoal,
        weeklyAvailability: effectiveFormData.weeklyAvailability,
        termsAccepted,
        termsAcceptedAt: termsAccepted ? nowIso : '',
        policyVersion: termsAccepted ? POLICY_VERSION : '',
        status,
        updatedAt: nowIso,
      };

      if (!application) {
        payload.createdAt = nowIso;
      }

      // Enforce server-side validation and persistence before completing final submission
      if (status === 'submitted') {
        await apiRequest('/api/applications', {
          method: 'POST',
          body: {
            id: appId,
            ...payload,
          },
          requireAuth: true,
        });
      }

      await setDoc(appRef, payload, { merge: true });

      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          fullName: payload.fullName,
          phone: payload.phone,
          college: payload.college,
          branch: payload.branch,
          academicYear: payload.academicYear,
          city: payload.city,
          state: payload.state,
          technicalSkills: payload.technicalSkills,
          nonTechnicalSkills: payload.nonTechnicalSkills,
          customSkills: payload.customSkills,
          portfolioUrl: payload.portfolioUrl,
          githubUrl: payload.githubUrl,
          linkedinUrl: payload.linkedinUrl,
          weeklyAvailability: payload.weeklyAvailability,
          membershipStatus: status,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (status === 'draft') {
        await apiRequest('/api/applications', {
          method: 'POST',
          body: {
            id: appId,
            ...payload,
          },
          requireAuth: false,
        }).catch(() => {});
      }

      // If student attached an idea proposal draft that has not yet been persisted to DB, persist it now as Under Review
      if (
        status === 'submitted' &&
        includeIdea &&
        attachedProposal &&
        !attachedProposal.persistedToDb
      ) {
        const linkedIdeaId = `idea_app_${user.uid}`;
        const ideaPayload = {
          title: attachedProposal.title,
          problemStatement: attachedProposal.problemStatement,
          targetAudience: attachedProposal.targetAudience || '',
          proposedSolution: attachedProposal.proposedSolution,
          industry: attachedProposal.industry || 'AI & Robotics',
          uniqueValueProposition: attachedProposal.uniqueValueProposition || '',
          stage: attachedProposal.stage || 'idea',
          demoUrl: attachedProposal.demoUrl || '',
          skillsRequired: attachedProposal.skillsRequired || [],
          teamRequirements: '',
          fundingRequirements: attachedProposal.fundingRequirements || '',
          isPublic: false,
          authorId: user.uid,
          authorName: payload.fullName || user.displayName || 'Engineering Student',
          authorEmail: user.email || '',
          reviewStatus: 'under_review',
          aiAssisted: false,
          adminFeedback: '',
          decisionHistory: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        try {
          await setDoc(doc(db, 'ideas', linkedIdeaId), ideaPayload, { merge: true });
          await apiRequest('/api/ideas', {
            method: 'POST',
            body: { id: linkedIdeaId, ...ideaPayload },
            requireAuth: true,
          }).catch(() => {});
        } catch (ideaErr) {
          console.warn('Linked application idea sync note:', ideaErr);
        }
      }

      await refreshProfile();
      setEditingMoreInfo(false);

      if (status === 'submitted') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#CCFF00', '#ffffff', '#38bdf8'],
        });
      } else {
        setSaveMessage({
          type: 'success',
          text: 'Draft saved successfully! You can resume anytime.',
        });
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setSaveMessage({
        type: 'error',
        text: err?.message || 'Error saving application. Please verify your fields and try again.',
      });
    } finally {
      setSavingDraft(false);
      setSubmitting(false);
    }
  };

  // Status Badge Component
  const renderStatusTracker = (status: MembershipStatus) => {
    const statusSteps = [
      { key: 'submitted', label: 'Submitted' },
      { key: 'under_review', label: 'Under Technical Review' },
      { key: 'shortlisted', label: 'Shortlisted' },
      { key: 'approved', label: 'Approved Member' },
    ];

    const isRejected = status === 'rejected';
    const isMoreInfo = status === 'more_info_required';

    return (
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c1f26] pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#9ca3af] block">
              Application ID: {application?.id || 'Pending'}
            </span>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              Status:{' '}
              <span
                className={`capitalize ${
                  status === 'approved'
                    ? 'text-[#CCFF00]'
                    : status === 'rejected'
                      ? 'text-red-400'
                      : status === 'more_info_required'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </span>
            </h3>
          </div>
          <span className="rounded-full bg-[#1b1e25] border border-[#2b2f38] px-3 py-1 font-mono text-xs text-zinc-300">
            Submitted:{' '}
            {application?.updatedAt ? new Date(application.updatedAt).toLocaleDateString() : 'Today'}
          </span>
        </div>

        {/* Status Timeline */}
        {!isRejected && !isMoreInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {statusSteps.map((st, idx) => {
              const order: Record<string, number> = {
                submitted: 1,
                under_review: 2,
                shortlisted: 3,
                approved: 4,
              };
              const currentOrder = order[status] || 1;
              const isPassed = currentOrder >= idx + 1;
              const isCurrent = currentOrder === idx + 1;

              return (
                <div
                  key={st.key}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    isCurrent
                      ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white shadow-sm'
                      : isPassed
                        ? 'border-[#263126] bg-[#121612] text-[#d4d4d8]'
                        : 'border-[#1f2229] bg-[#0c0d10] text-[#52525b]'
                  }`}
                >
                  <div
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mb-1.5 ${
                      isPassed ? 'bg-[#CCFF00] text-black' : 'bg-[#1e2129] text-[#71717a]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="font-display text-xs font-semibold block">{st.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {isMoreInfo && (
          <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-4 text-xs text-amber-200 space-y-1">
            <p className="font-bold">Reviewer requested additional technical clarity:</p>
            <p>{application?.adminNotes || 'Please update your technical experience or portfolio link.'}</p>
          </div>
        )}

        {application?.adminNotes && !isMoreInfo && (
          <div className="rounded-xl border border-[#272b36] bg-[#14171f] p-4 text-xs text-zinc-300 space-y-1">
            <span className="font-mono text-[#CCFF00] text-[10px] uppercase block">Reviewer Feedback:</span>
            <p>{application.adminNotes}</p>
          </div>
        )}

        {application?.hasExistingIdea && application?.existingIdeaSummary && (
          <div className="rounded-xl border border-[#252932] bg-[#13161d] p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
                Submitted Startup Idea Summary
              </span>
              <span className="rounded bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                Subject to ESC Admin Review
              </span>
            </div>
            <p className="text-zinc-300 leading-relaxed">{application.existingIdeaSummary}</p>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8e919b]">
          <p>Applications are reviewed weekly by the ESC Engineering Evaluation Committee.</p>
          {(status === 'draft' || status === 'more_info_required') && (
            <button
              type="button"
              onClick={() => setEditingMoreInfo(true)}
              className="text-[#CCFF00] font-semibold underline cursor-pointer"
            >
              Modify Application
            </button>
          )}
        </div>
      </div>
    );
  };

  const applicationsClosed = siteSettings?.applicationsOpen === false;
  const showTrackerOnly = Boolean(application && application.status !== 'draft' && !editingMoreInfo);
  const showIdeaSection = Boolean(formData.hasExistingIdea);

  const handleGoalSelectClick = (goalId: 'build_team' | 'join_team' | 'existing_idea') => {
    if (goalId === 'build_team' || goalId === 'join_team') {
      setGoalPopup(goalId);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      teamGoal: goalId,
    }));
    clearFieldError('teamGoal');
  };

  const handleGoalPopupContinue = () => {
    if (!goalPopup) return;
    setFormData((prev) => ({
      ...prev,
      teamGoal: goalPopup,
    }));
    clearFieldError('teamGoal');
    setGoalPopup(null);
  };

  const handleIdeaCheckboxToggle = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, hasExistingIdea: checked }));
    clearFieldError('existingIdeaSummary');
    if (checked) {
      setIdeaModalOpen(true);
    }
  };

  const handleIdeaModalClose = () => {
    setIdeaModalOpen(false);
    // If student cancelled before saving any idea proposal, uncheck the checkbox cleanly using latest state
    setFormData((prev) => {
      if (!prev.existingIdeaSummary || prev.existingIdeaSummary.trim().length === 0) {
        return { ...prev, hasExistingIdea: false };
      }
      return prev;
    });
  };

  const handleProposalSaved = (proposal: IdeaProposalDraft) => {
    setAttachedProposal(proposal);
    const formattedSummary = `${proposal.title}: ${proposal.problemStatement} — ${proposal.proposedSolution}`;
    setFormData((prev) => ({
      ...prev,
      hasExistingIdea: true,
      existingIdeaSummary: formattedSummary,
    }));
    clearFieldError('existingIdeaSummary');
    setIdeaModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#282c35] bg-[#13151b] px-3.5 py-1 text-xs font-mono text-[#CCFF00]">
            <Sparkles className="h-3.5 w-3.5" /> ESC Membership Fellowship 2026
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
            Engineering Fellowship Application
          </h1>
          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-xl mx-auto">
            Join a selective cohort of student engineers, builders, creators, and hardware/software founders across all engineering branches.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate('/support?category=Fellowship+Application')}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#39FF14] hover:underline cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Need Help with your application?
            </button>
          </div>
        </div>

        {/* Application Submission Confirmation & Live Tracker */}
        {showTrackerOnly && application ? (
          <div className="space-y-6" data-testid="application-submission-confirmation">
            {/* Premium Submission Confirmation Card */}
            <div className="rounded-2xl border border-[#39FF14]/45 bg-gradient-to-br from-[#0d170e] via-[#101318] to-[#0b0d11] p-6 sm:p-8 text-center space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-2 max-w-2xl mx-auto">
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
                  YOUR APPLICATION HAS BEEN SUBMITTED SUCCESSFULLY!
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Thank you for applying to Engineering Startup Company. Your application has been received and is awaiting review by the ESC Admin Team.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left max-w-3xl mx-auto pt-1">
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">Applicant Name</span>
                  <span className="font-semibold text-xs text-white truncate block mt-0.5">
                    {application.fullName || user?.displayName || 'Applicant'}
                  </span>
                </div>
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">Application ID</span>
                  <span className="font-mono text-xs font-bold text-[#CCFF00] truncate block mt-0.5">
                    {application.id || `app_${user?.uid || ''}`}
                  </span>
                </div>
                <div className="rounded-xl border border-[#232731] bg-[#0e1116] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">Submission Date</span>
                  <span className="font-mono text-xs text-zinc-200 block mt-0.5">
                    {application.createdAt
                      ? new Date(application.createdAt).toLocaleDateString()
                      : application.updatedAt
                      ? new Date(application.updatedAt).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="rounded-xl border border-[#39FF14]/35 bg-[#101a11] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-400">Application Status</span>
                  <span className="font-mono text-xs font-extrabold uppercase text-[#39FF14] block mt-0.5">
                    {application.status === 'submitted' || application.status === 'under_review'
                      ? 'UNDER REVIEW'
                      : getApplicationDisplayStatus(application.status).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Immediate Official ESC WhatsApp Group Access */}
            {canAccessWhatsappCommunity(
              application.status,
              profile?.membershipStatus,
              profile?.accountStatus
            ) && (
              <div
                data-testid="apply-whatsapp-community-card"
                className="rounded-2xl border border-[#39FF14]/50 bg-gradient-to-r from-[#0e190f] via-[#111519] to-[#0f1318] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#39FF14] block">
                      Immediate Community Access Unlocked
                    </span>
                    <h3 className="font-display text-lg sm:text-xl font-extrabold text-white">
                      JOIN THE ESC COMMUNITY
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
                      Connect with fellow innovators, engineering students and aspiring entrepreneurs.
                    </p>
                  </div>
                </div>
                <a
                  href={resolveWhatsappCommunityUrl(siteSettings?.whatsappCommunityUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="apply-join-whatsapp-btn"
                  className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors shadow-[0_0_24px_rgba(57,255,20,0.28)]"
                >
                  JOIN ESC WHATSAPP GROUP
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {renderStatusTracker(application.status)}

            <div className="flex flex-wrap justify-center gap-4">
              {application.status === 'approved' || profile?.membershipStatus === 'approved' ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  Enter Your ESC Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-xl bg-[#CCFF00] px-6 py-3 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                >
                  Return to Landing Page
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/problem-exchange')}
                className="rounded-xl border border-[#2b2f38] bg-[#14161b] px-6 py-3 text-xs font-medium text-white hover:border-[#CCFF00] cursor-pointer"
              >
                Explore Problem Exchange
              </button>
            </div>
          </div>
        ) : applicationsClosed && !application ? (
          <div className="rounded-2xl border border-amber-500/30 bg-[#12141a] p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Fellowship Applications Are Currently Closed
            </h2>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-lg mx-auto">
              The current ESC Fellowship application window is closed. Follow announcements on the homepage or check back when the next cohort opens.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
            >
              Return to Homepage
            </button>
          </div>
        ) : (
          /* Multi-Step Wizard */
          <div className="rounded-2xl border border-[#232731] bg-[#101216] shadow-2xl overflow-hidden">
            {/* Step Progress Bar */}
            <div className="border-b border-[#1c1f26] bg-[#0c0d10] px-4 sm:px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { num: 1, label: 'Academic & Contact' },
                  { num: 2, label: 'Skills & Portfolio' },
                  { num: 3, label: 'Motivation & Hours' },
                  { num: 4, label: 'Startup Aspiration' },
                ].map((s) => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => handleStepTabClick(s.num)}
                    className={`text-left cursor-pointer transition-all pb-1.5 border-b-2 ${
                      step === s.num
                        ? 'text-[#CCFF00] font-bold border-[#CCFF00]'
                        : step > s.num
                          ? 'text-zinc-300 font-medium border-[#CCFF00]/30 hover:text-white'
                          : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    <span className="font-mono text-[10px] block text-zinc-500">STEP 0{s.num}</span>
                    <span className="truncate block">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Container */}
            <div className="p-5 sm:p-8 space-y-6">
              {saveMessage && (
                <div
                  role="alert"
                  className={`rounded-xl border p-3.5 text-xs flex items-center gap-2.5 ${
                    saveMessage.type === 'success'
                      ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                      : 'border-red-500/40 bg-red-950/40 text-red-200'
                  }`}
                >
                  {saveMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>{saveMessage.text}</span>
                </div>
              )}

              {/* STEP 1: Academic & Contact Profile (Mandatory) */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2229] pb-2.5">
                    <h3 className="font-display text-lg font-bold text-white">
                      Step 1: Academic &amp; Contact Profile
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
                      All * fields mandatory
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="apply-full-name" className="block text-xs font-semibold text-white mb-1">
                        Full Name <span className="text-[#CCFF00]">*</span>
                      </label>
                      <input
                        id="apply-full-name"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => {
                          setFormData({ ...formData, fullName: e.target.value });
                          clearFieldError('fullName');
                        }}
                        placeholder="e.g. Aarav Kulkarni"
                        className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                          errors.fullName
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.fullName && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="apply-email" className="block text-xs font-semibold text-white">
                          Google Account Email <span className="text-[#CCFF00]">*</span>
                        </label>
                        {!user && (
                          <button
                            type="button"
                            onClick={() => signInWithGoogle()}
                            className="font-mono text-[10px] text-[#CCFF00] hover:underline cursor-pointer"
                          >
                            Sign in with Google
                          </button>
                        )}
                      </div>
                      <input
                        id="apply-email"
                        type="email"
                        required
                        value={user?.email || formData.email || ''}
                        disabled={Boolean(user?.email)}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          clearFieldError('email');
                        }}
                        placeholder="yourname@gmail.com"
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none ${
                          user?.email
                            ? 'border-[#252830] bg-[#121418] text-zinc-300 cursor-not-allowed'
                            : errors.email
                              ? 'border-red-500 bg-[#17191e] text-white'
                              : 'border-[#2b2f38] bg-[#17191e] text-white placeholder-[#5a5f6e] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.email && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="apply-college" className="block text-xs font-semibold text-white mb-1">
                        College or University <span className="text-[#CCFF00]">*</span>
                      </label>
                      <input
                        id="apply-college"
                        type="text"
                        required
                        value={formData.college}
                        onChange={(e) => {
                          setFormData({ ...formData, college: e.target.value });
                          clearFieldError('college');
                        }}
                        placeholder="e.g. Pune Institute of Computer Technology"
                        className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                          errors.college
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.college && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.college}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="apply-branch" className="block text-xs font-semibold text-white mb-1">
                        Engineering Branch / Department <span className="text-[#CCFF00]">*</span>
                      </label>
                      <input
                        id="apply-branch"
                        type="text"
                        required
                        value={formData.branch}
                        onChange={(e) => {
                          setFormData({ ...formData, branch: e.target.value });
                          clearFieldError('branch');
                        }}
                        placeholder="e.g. Mechanical / ENTC / Civil / Computer Science"
                        className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                          errors.branch
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.branch && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.branch}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="apply-year" className="block text-xs font-semibold text-white mb-1">
                        Academic Year <span className="text-[#CCFF00]">*</span>
                      </label>
                      <select
                        id="apply-year"
                        required
                        value={formData.academicYear}
                        onChange={(e) => {
                          setFormData({ ...formData, academicYear: e.target.value });
                          clearFieldError('academicYear');
                        }}
                        className={`w-full rounded-xl border bg-[#17191e] px-3 py-2.5 text-xs text-white focus:outline-none ${
                          errors.academicYear
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      >
                        <option value="">Select Academic Year</option>
                        <option value="1st Year">1st Year (First Year / FE)</option>
                        <option value="2nd Year">2nd Year (Second Year / SE)</option>
                        <option value="3rd Year">3rd Year (Third Year / TE)</option>
                        <option value="4th Year">4th Year (Final Year / BE)</option>
                        <option value="Postgraduate">Postgraduate / M.Tech / MS</option>
                        <option value="Recent Graduate">Recent Graduate</option>
                      </select>
                      {errors.academicYear && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.academicYear}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="apply-city" className="block text-xs font-semibold text-white mb-1">
                        City <span className="text-[#CCFF00]">*</span>
                      </label>
                      <input
                        id="apply-city"
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => {
                          setFormData({ ...formData, city: e.target.value });
                          clearFieldError('city');
                        }}
                        placeholder="e.g. Pune"
                        className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                          errors.city
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.city && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="apply-state" className="block text-xs font-semibold text-white mb-1">
                        State <span className="text-[#CCFF00]">*</span>
                      </label>
                      <input
                        id="apply-state"
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => {
                          setFormData({ ...formData, state: e.target.value });
                          clearFieldError('state');
                        }}
                        placeholder="e.g. Maharashtra"
                        className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                          errors.state
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-[#2b2f38] focus:border-[#CCFF00]'
                        }`}
                      />
                      {errors.state && (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errors.state}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="apply-phone" className="block text-xs font-semibold text-white mb-1">
                      Phone Number <span className="text-zinc-500 font-normal">(Optional — Kept Private)</span>
                    </label>
                    <input
                      id="apply-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Comprehensive Searchable Technical & Non-Technical Skills */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2229] pb-2.5">
                    <h3 className="font-display text-lg font-bold text-white">
                      Step 2: Technical &amp; Non-Technical Skills
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      Select at least 1 technical skill
                    </span>
                  </div>

                  <SkillSelector
                    technicalSkills={formData.technicalSkills}
                    nonTechnicalSkills={formData.nonTechnicalSkills}
                    customSkills={formData.customSkills || []}
                    isAuthenticated={Boolean(user)}
                    errorMessage={errors.technicalSkills}
                    onChange={({ technicalSkills, nonTechnicalSkills, customSkills }) => {
                      setFormData((prev) => ({
                        ...prev,
                        technicalSkills,
                        nonTechnicalSkills,
                        customSkills,
                      }));
                      clearFieldError('technicalSkills');
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#1f2229]">
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1">
                        GitHub Profile URL
                      </label>
                      <input
                        type="url"
                        value={formData.githubUrl}
                        onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                        placeholder="https://github.com/..."
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1">
                        Portfolio / Project Link
                      </label>
                      <input
                        type="url"
                        value={formData.portfolioUrl}
                        onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                        placeholder="https://mywork.dev"
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1">
                        LinkedIn Profile URL
                      </label>
                      <input
                        type="url"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Motivation & Hours */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <h3 className="font-display text-lg font-bold text-white border-b border-[#1f2229] pb-2">
                    Step 3: Motivation &amp; Time Commitment
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Why do you want to join Engineering Startup Company (ESC)? <span className="text-[#CCFF00]">*</span>
                    </label>
                    <textarea
                      value={formData.whyJoin}
                      onChange={(e) => {
                        setFormData({ ...formData, whyJoin: e.target.value });
                        clearFieldError('whyJoin');
                      }}
                      placeholder="What engineering problems excite you? What kind of product or venture do you dream of building? (Min 20 characters)"
                      rows={4}
                      className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:outline-none ${
                        errors.whyJoin
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-[#2b2f38] focus:border-[#CCFF00]'
                      }`}
                    />
                    {errors.whyJoin && (
                      <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.whyJoin}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-2">
                      Primary Industry Interests
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {STARTUP_DOMAINS.map((domain) => {
                        const selected = formData.startupInterests.includes(domain);
                        return (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => toggleDomain(domain)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#CCFF00] text-black font-bold'
                                : 'bg-[#181a20] text-zinc-300 border border-[#282b34] hover:border-[#CCFF00]'
                            }`}
                          >
                            {domain}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Weekly Time Availability <span className="text-[#CCFF00]">*</span>
                    </label>
                    <select
                      value={formData.weeklyAvailability}
                      onChange={(e) => {
                        setFormData({ ...formData, weeklyAvailability: e.target.value });
                        clearFieldError('weeklyAvailability');
                      }}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="5-10 hrs/week">5-10 hrs/week (Part-time sprint contributor)</option>
                      <option value="10-15 hrs/week">10-15 hrs/week (Active project builder)</option>
                      <option value="20+ hrs/week">20+ hrs/week (Core Founder / Lead)</option>
                    </select>
                    {errors.weeklyAvailability && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.weeklyAvailability}</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: Startup Aspiration & Team Formation (3 Options, NO "Open to both") */}
              {step === 4 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <h3 className="font-display text-lg font-bold text-white border-b border-[#1f2229] pb-2">
                    Step 4: Startup Aspiration &amp; Team Formation
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-2">
                      What is your immediate goal in ESC? <span className="text-[#CCFF00]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {TEAM_GOAL_OPTIONS.map((item) => {
                        const selected = formData.teamGoal === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleGoalSelectClick(item.id)}
                            className={`text-left rounded-xl border p-4 cursor-pointer transition-all ${
                              selected
                                ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white shadow-sm'
                                : 'border-[#252831] bg-[#14161b] text-zinc-400 hover:border-[#383d49]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="font-display text-xs font-bold text-white leading-snug">
                                {item.title}
                              </span>
                              <div
                                className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                                  selected ? 'bg-[#CCFF00] border-[#CCFF00]' : 'border-zinc-600'
                                }`}
                              />
                            </div>
                            <p className="text-[11px] text-[#8e919b] leading-relaxed">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                    {errors.teamGoal && (
                      <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.teamGoal}
                      </p>
                    )}
                  </div>

                  {/* Startup / Product Idea Submission Checkbox connected to IdeaSubmissionModal */}
                  <div className="rounded-xl border border-[#232731] bg-[#13151b] p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        id="apply-include-idea"
                        type="checkbox"
                        checked={showIdeaSection}
                        onChange={(e) => handleIdeaCheckboxToggle(e.target.checked)}
                        className="h-4 w-4 accent-[#CCFF00]"
                      />
                      <span className="text-xs font-semibold text-white">
                        Include my startup or product idea proposal for ESC Admin review.
                      </span>
                    </label>

                    {showIdeaSection && (
                      <div className="rounded-xl border border-[#2b2f38] bg-[#17191e] p-3.5 space-y-2">
                        {attachedProposal ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display text-xs font-bold text-white truncate">
                                  {attachedProposal.title}
                                </span>
                                <span className="rounded bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                                  Under Review
                                </span>
                              </div>
                              <p className="text-[11px] text-[#9ca3af] line-clamp-2">
                                {attachedProposal.industry} • {attachedProposal.stage} — {attachedProposal.proposedSolution}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIdeaModalOpen(true)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#343946] bg-[#101216] px-3 py-1.5 text-[11px] font-semibold text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit Proposal</span>
                            </button>
                          </div>
                        ) : formData.existingIdeaSummary && formData.existingIdeaSummary.trim().length >= 15 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-[11px] text-zinc-300 line-clamp-2">
                              {formData.existingIdeaSummary}
                            </p>
                            <button
                              type="button"
                              onClick={() => setIdeaModalOpen(true)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#343946] bg-[#101216] px-3 py-1.5 text-[11px] font-semibold text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Open Proposal Form</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-[11px] text-[#9ca3af]">
                              Complete your startup or product idea proposal form to attach it to this application.
                            </p>
                            <button
                              type="button"
                              onClick={() => setIdeaModalOpen(true)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#CCFF00] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Open Proposal Form</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {errors.existingIdeaSummary && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.existingIdeaSummary}
                      </p>
                    )}
                  </div>

                  {/* Mandatory Terms & Conditions and Privacy Policy Acceptance */}
                  <div
                    className={`rounded-xl border p-4 space-y-2 ${
                      errors.termsAccepted
                        ? 'border-red-500/70 bg-red-950/15'
                        : 'border-[#232731] bg-[#13151b]'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        id="apply-terms-accepted"
                        type="checkbox"
                        checked={Boolean(formData.termsAccepted)}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, termsAccepted: e.target.checked }));
                          clearFieldError('termsAccepted');
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#CCFF00]"
                      />
                      <span className="text-xs text-zinc-200 leading-relaxed">
                        I have read and agree to the ESC{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActivePolicyModal('terms');
                          }}
                          className="font-semibold text-[#CCFF00] underline underline-offset-2 hover:text-white cursor-pointer"
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActivePolicyModal('privacy');
                          }}
                          className="font-semibold text-[#CCFF00] underline underline-offset-2 hover:text-white cursor-pointer"
                        >
                          Privacy Policy
                        </button>
                        . <span className="text-[#CCFF00]">*</span>
                      </span>
                    </label>
                    <div className="pl-7 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3 text-[#CCFF00]" /> Policy Version {POLICY_VERSION}
                      </span>
                    </div>
                    {errors.termsAccepted && (
                      <p className="pl-7 text-[11px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.termsAccepted}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-[#1c1f26]">
                <div className="flex flex-wrap items-center gap-2">
                  {step > 1 && (
                    <MagneticButton
                      type="button"
                      onClick={handlePrev}
                      variant="outline"
                      className="px-4 py-2 text-xs font-semibold text-[#8e919b] hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </MagneticButton>
                  )}
                  <MagneticButton
                    type="button"
                    onClick={() => saveApplication('draft')}
                    variant="outline"
                    className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    <Save className="h-4 w-4 text-[#CCFF00]" />
                    <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
                  </MagneticButton>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {step < 4 ? (
                    <MagneticButton
                      type="button"
                      onClick={handleNext}
                      variant="primary"
                      className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold uppercase shadow-md shadow-[#CCFF00]/20"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="h-4 w-4" />
                    </MagneticButton>
                  ) : (
                    <MagneticButton
                      type="button"
                      onClick={() => saveApplication('submitted')}
                      variant="primary"
                      disabled={submitting || !formData.termsAccepted}
                      className="w-full sm:w-auto px-7 py-3 text-xs font-bold uppercase shadow-lg shadow-[#CCFF00]/25 disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                      <span>
                        {submitting ? 'Submitting Application...' : 'Submit Fellowship Application'}
                      </span>
                    </MagneticButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 4 Goal Selection Popups */}
      {goalPopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="ESC Goal Confirmation"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#101216] p-6 shadow-2xl space-y-5">
              <p className="text-sm text-zinc-100 leading-relaxed">
                {goalPopup === 'build_team'
                  ? 'Please submit your startup idea and explain what you want to build. Your idea and team formation will proceed only after ESC Admin approval.'
                  : 'If you have already submitted your fellowship application, you do not need to apply again. Shortlisted students may be invited for a skill-based or technical interview before project selection.'}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1e222b]">
                <button
                  type="button"
                  onClick={() => setGoalPopup(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs font-semibold text-[#9ca3af] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGoalPopupContinue}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Existing Startup / Product Idea Proposal Form Modal */}
      <IdeaSubmissionModal
        isOpen={ideaModalOpen}
        onClose={handleIdeaModalClose}
        initialProposal={attachedProposal}
        allowDraftReturn={true}
        onProposalSaved={handleProposalSaved}
      />

      {/* ESC Terms & Conditions / Privacy Policy Reader Modal with PDF Download */}
      <PolicyModal
        policyType={activePolicyModal}
        contactEmail={siteSettings?.contactEmail}
        onClose={() => setActivePolicyModal(null)}
        onOpenFullPage={(path) => navigate(path)}
      />
    </div>
  );
};
