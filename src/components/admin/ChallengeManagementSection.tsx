import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Upload,
  Users,
  Send,
  Download,
  Award,
  CheckCircle2,
  X,
  Lock,
  Calendar,
  FileCheck2,
  Globe,
  EyeOff,
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncToSqlApi } from '../../lib/apiClient';
import {
  computeChallengeMetrics,
  exportToCSV,
  validateChallengeForm,
} from '../../utils/escLogic';
import { processAndUploadPosterImage } from '../../utils/mediaUpload';
import type {
  ChallengeItem,
  ChallengeParticipationType,
  ChallengeRegistration,
  ChallengeStatus,
  ChallengeSubmission,
} from '../../types';

interface ChallengeManagementSectionProps {
  challenges: ChallengeItem[];
  setChallenges: React.Dispatch<React.SetStateAction<ChallengeItem[]>>;
  registrations: ChallengeRegistration[];
  setRegistrations: React.Dispatch<React.SetStateAction<ChallengeRegistration[]>>;
  submissions: ChallengeSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<ChallengeSubmission[]>>;
  isSuperAdmin: boolean;
  adminEmail: string;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onLogAdminAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  onRequestDelete: (challenge: ChallengeItem, onDeleted: () => Promise<void>) => void;
}

const CHALLENGE_CATEGORIES = [
  'Robotics & Autonomous Systems',
  'Embedded Systems & IoT',
  'AI / Edge ML',
  'CleanTech & Energy',
  'MedTech & BioEngineering',
  'Aerospace & Drones',
  'Hardware & PCB Design',
  'Software & DevTools',
];

const STATUS_BADGE: Record<ChallengeStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  scheduled: 'bg-sky-950/60 text-sky-300 border-sky-700/50',
  live: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40',
  registration_closed: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  completed: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
  archived: 'bg-zinc-900 text-zinc-500 border-zinc-800',
};

export const ChallengeManagementSection: React.FC<ChallengeManagementSectionProps> = ({
  challenges,
  setChallenges,
  registrations,
  setRegistrations,
  submissions,
  setSubmissions,
  isSuperAdmin,
  adminEmail,
  onNotify,
  onLogAdminAction,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ChallengeItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CHALLENGE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [participationType, setParticipationType] = useState<ChallengeParticipationType>('both');
  const [minTeamSize, setMinTeamSize] = useState(1);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [startDateTime, setStartDateTime] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [rules, setRules] = useState('');
  const [submissionInstructions, setSubmissionInstructions] = useState('');
  const [requiredFilesText, setRequiredFilesText] = useState('GitHub Repository URL, Demo Video Link, Technical Brief / Pitch Deck');
  const [prizeOrRewards, setPrizeOrRewards] = useState('');
  const [certificateAvailable, setCertificateAvailable] = useState(true);
  const [contactInfo, setContactInfo] = useState('');
  const [statusDraft, setStatusDraft] = useState<ChallengeStatus>('live');

  // Preview & Registrations/Submissions Modals
  const [previewChallenge, setPreviewChallenge] = useState<ChallengeItem | null>(null);
  const [inspectChallenge, setInspectChallenge] = useState<ChallengeItem | null>(null);
  const [inspectTab, setInspectTab] = useState<'registrations' | 'submissions'>('registrations');
  const [reviewingSub, setReviewingSub] = useState<ChallengeSubmission | null>(null);
  const [reviewStatusDraft, setReviewStatusDraft] = useState<ChallengeSubmission['reviewStatus']>('under_review');
  const [reviewScoreDraft, setReviewScoreDraft] = useState<string>('');
  const [reviewFeedbackDraft, setReviewFeedbackDraft] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const metrics = useMemo(
    () => computeChallengeMetrics(challenges, registrations, submissions),
    [challenges, registrations, submissions]
  );

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [challenges, statusFilter, search]);

  const openEditor = (item?: ChallengeItem) => {
    setFormErrors({});
    if (item) {
      setEditing(item);
      setTitle(item.title || '');
      setCategory(item.category || CHALLENGE_CATEGORIES[0]);
      setDescription(item.description || '');
      setPosterUrl(item.posterUrl || '');
      setEligibility(item.eligibility || '');
      setSkillsText((item.requiredSkills || []).join(', '));
      setParticipationType(item.participationType || 'both');
      setMinTeamSize(item.minTeamSize || 1);
      setMaxTeamSize(item.maxTeamSize || 4);
      setStartDateTime(item.startDateTime || '');
      setRegistrationDeadline(item.registrationDeadline || '');
      setSubmissionDeadline(item.submissionDeadline || '');
      setRules(item.rules || '');
      setSubmissionInstructions(item.submissionInstructions || '');
      setRequiredFilesText((item.requiredSubmissionFiles || []).join(', '));
      setPrizeOrRewards(item.prizeOrRewards || '');
      setCertificateAvailable(item.certificateAvailable ?? true);
      setContactInfo(item.contactInfo || '');
      setStatusDraft(item.status || 'draft');
    } else {
      setEditing(null);
      setTitle('');
      setCategory(CHALLENGE_CATEGORIES[0]);
      setDescription('');
      setPosterUrl('');
      setEligibility('Open to all engineering students and ESC builders');
      setSkillsText('');
      setParticipationType('both');
      setMinTeamSize(1);
      setMaxTeamSize(4);
      setStartDateTime('');
      setRegistrationDeadline('');
      setSubmissionDeadline('');
      setRules('');
      setSubmissionInstructions('');
      setRequiredFilesText('GitHub Repository URL, Demo Video Link, Technical Brief / Pitch Deck');
      setPrizeOrRewards('');
      setCertificateAvailable(true);
      setContactInfo(adminEmail || 'soviraj50@gmail.com');
      setStatusDraft('live');
    }
    setEditorOpen(true);
  };

  const buildPayloadFromDraft = (mode: 'draft' | 'publish'): Omit<ChallengeItem, 'id'> => {
    const now = new Date().toISOString();
    const isPublish = mode === 'publish';
    const nextStatus: ChallengeStatus = isPublish
      ? statusDraft === 'draft' || statusDraft === 'archived'
        ? 'live'
        : statusDraft
      : 'draft';

    return {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      posterUrl: posterUrl.trim(),
      eligibility: eligibility.trim(),
      requiredSkills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      participationType,
      minTeamSize: participationType === 'individual' ? 1 : Math.max(1, Number(minTeamSize) || 1),
      maxTeamSize: participationType === 'individual' ? 1 : Math.max(1, Number(maxTeamSize) || 1),
      startDateTime: startDateTime.trim(),
      registrationDeadline: registrationDeadline.trim(),
      submissionDeadline: submissionDeadline.trim(),
      rules: rules.trim(),
      submissionInstructions: submissionInstructions.trim(),
      requiredSubmissionFiles: requiredFilesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      prizeOrRewards: prizeOrRewards.trim(),
      certificateAvailable,
      contactInfo: contactInfo.trim(),
      status: nextStatus,
      isPublished: isPublish,
      registeredCount: editing?.registeredCount ?? 0,
      submissionCount: editing?.submissionCount ?? 0,
      createdBy: editing?.createdBy || adminEmail,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSaveChallenge = async (mode: 'draft' | 'publish') => {
    if (!isSuperAdmin) {
      onNotify('error', 'Only the verified Super Admin can create or publish challenges.');
      return;
    }

    const payload = buildPayloadFromDraft(mode);
    const check = validateChallengeForm(payload, mode === 'publish');
    if (!check.isValid) {
      setFormErrors(check.errors);
      onNotify('error', 'Please complete the highlighted required fields.');
      return;
    }

    try {
      setSaving(true);
      setFormErrors({});
      if (editing?.id) {
        const ref = doc(db, 'challenges', editing.id);
        await updateDoc(ref, payload);
        await syncToSqlApi(`/api/challenges/${encodeURIComponent(editing.id)}`, 'PUT', payload);
        setChallenges((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...c, ...payload, id: editing.id } : c))
        );
        await onLogAdminAction(
          mode === 'publish' ? 'CHALLENGE_PUBLISHED' : 'CHALLENGE_SAVED',
          'Challenge',
          editing.id,
          `${mode === 'publish' ? 'Published' : 'Saved draft'} challenge "${payload.title}"`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Challenge "${payload.title}" is now live on the website.`
            : `Challenge "${payload.title}" saved as draft.`
        );
      } else {
        const ref = doc(collection(db, 'challenges'));
        const fullItem: ChallengeItem = { id: ref.id, ...payload };
        await setDoc(ref, fullItem);
        await syncToSqlApi('/api/challenges', 'POST', fullItem);
        setChallenges((prev) => [fullItem, ...prev]);
        await onLogAdminAction(
          mode === 'publish' ? 'CHALLENGE_CREATED_LIVE' : 'CHALLENGE_CREATED_DRAFT',
          'Challenge',
          ref.id,
          `Created challenge "${payload.title}" (${payload.status})`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Challenge "${payload.title}" created and published live.`
            : `Challenge "${payload.title}" saved as draft.`
        );
      }
      setEditorOpen(false);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save challenge to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (item: ChallengeItem, nextStatus: ChallengeStatus) => {
    if (!isSuperAdmin || !item.id) return;
    const isPublished = nextStatus !== 'draft' && nextStatus !== 'archived';
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'challenges', item.id), {
        status: nextStatus,
        isPublished,
        updatedAt: now,
      });
      await syncToSqlApi(`/api/challenges/${encodeURIComponent(item.id)}`, 'PUT', {
        ...item,
        status: nextStatus,
        isPublished,
      });
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, status: nextStatus, isPublished, updatedAt: now } : c
        )
      );
      await onLogAdminAction(
        `CHALLENGE_STATUS_${nextStatus.toUpperCase()}`,
        'Challenge',
        item.id,
        `Changed challenge "${item.title}" status to ${nextStatus}`
      );
      onNotify('success', `Challenge "${item.title}" updated to ${nextStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update challenge status.');
    }
  };

  const handlePosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPoster(true);
      const { url } = await processAndUploadPosterImage(file, 'challenges');
      setPosterUrl(url);
      onNotify('success', 'Challenge poster ready.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not process poster image.');
    } finally {
      setUploadingPoster(false);
      e.target.value = '';
    }
  };

  const handleSaveSubmissionReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !reviewingSub?.id) return;
    try {
      setSavingReview(true);
      const now = new Date().toISOString();
      const scoreVal = reviewScoreDraft.trim() ? Number(reviewScoreDraft) : undefined;
      const patch: Partial<ChallengeSubmission> = {
        reviewStatus: reviewStatusDraft,
        reviewerFeedback: reviewFeedbackDraft.trim(),
        updatedAt: now,
        ...(scoreVal !== undefined && !Number.isNaN(scoreVal) ? { score: scoreVal } : {}),
      };
      await updateDoc(doc(db, 'challengeSubmissions', reviewingSub.id), patch);
      setSubmissions((prev) =>
        prev.map((s) => (s.id === reviewingSub.id ? { ...s, ...patch } : s))
      );
      await onLogAdminAction(
        'CHALLENGE_SUBMISSION_REVIEWED',
        'ChallengeSubmission',
        reviewingSub.id,
        `Reviewed "${reviewingSub.projectTitle}" -> ${reviewStatusDraft}`
      );
      setReviewingSub(null);
      onNotify('success', 'Submission review saved.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save submission review.');
    } finally {
      setSavingReview(false);
    }
  };

  const challengeRegs = useMemo(
    () => (inspectChallenge ? registrations.filter((r) => r.challengeId === inspectChallenge.id) : []),
    [inspectChallenge, registrations]
  );

  const challengeSubs = useMemo(
    () => (inspectChallenge ? submissions.filter((s) => s.challengeId === inspectChallenge.id) : []),
    [inspectChallenge, submissions]
  );

  const exportRegsCSV = (challenge: ChallengeItem) => {
    const list = registrations.filter((r) => r.challengeId === challenge.id);
    const csv = exportToCSV(list, [
      { key: 'userName', label: 'Participant Name' },
      { key: 'userEmail', label: 'Email' },
      { key: 'college', label: 'College' },
      { key: 'branch', label: 'Branch' },
      { key: 'participationMode', label: 'Mode' },
      { key: 'teamName', label: 'Team Name' },
      { key: 'teamMembers', label: 'Team Members' },
      { key: 'status', label: 'Status' },
      { key: 'registeredAt', label: 'Registered At' },
    ]);
    if (!csv) {
      onNotify('error', 'No challenge registrations to export.');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esc_challenge_registrations_${challenge.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-amber-800/40 bg-[#141210] p-10 text-center space-y-3">
        <Lock className="h-8 w-8 text-amber-400 mx-auto" />
        <h3 className="font-display text-lg font-bold text-white">Super Admin Exclusive Section</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Challenge creation, publishing, editing, and deletion are restricted exclusively to the verified Super Admin account (<span className="text-[#CCFF00]">soviraj50@gmail.com</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] block">
            Super Admin Content Engine
          </span>
          <h3 className="font-display text-xl font-bold text-white">Challenge Management</h3>
          <p className="text-xs text-[#8e919b]">
            Create, preview, schedule, and publish official ESC engineering challenges. Nothing appears publicly unless published here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#CCFF00] px-4 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Challenge
        </button>
      </div>

      {/* Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Challenges', value: metrics.total, accent: 'text-white' },
          { label: 'Live Now', value: metrics.live, accent: 'text-[#CCFF00]' },
          { label: 'Drafts / Hidden', value: metrics.drafts, accent: 'text-zinc-300' },
          { label: 'Registrations', value: metrics.totalRegistrations, accent: 'text-sky-400' },
          { label: 'Project Submissions', value: metrics.totalSubmissions, accent: 'text-emerald-400' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-[#232731] bg-[#111317] p-4">
            <span className="font-mono text-[10px] uppercase text-zinc-500 block">{stat.label}</span>
            <p className={`font-display text-2xl font-black mt-1 ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search challenges by title or track..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#14161c] pl-10 pr-4 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2.5 text-xs font-mono text-white focus:border-[#CCFF00] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="registration_closed">Registration Closed</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* List */}
      {filteredChallenges.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-3">
          <Award className="h-9 w-9 text-zinc-600 mx-auto" />
          <h4 className="font-display text-base font-bold text-white">No Challenges Found</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {challenges.length === 0
              ? 'Your Firestore challenges collection is completely clean. Click "Create Challenge" to author and publish your first official challenge.'
              : 'No challenges match your current search or status filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredChallenges.map((c) => {
            const regCount = registrations.filter((r) => r.challengeId === c.id).length;
            const subCount = submissions.filter((s) => s.challengeId === c.id).length;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between"
              >
                {c.posterUrl && (
                  <div className="h-36 w-full overflow-hidden border-b border-[#1f2229] bg-black">
                    <img src={c.posterUrl} alt={c.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="rounded bg-[#1a1d24] border border-[#2b2f38] px-2.5 py-0.5 text-[#CCFF00]">
                      {c.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 uppercase font-semibold ${
                          STATUS_BADGE[c.status] || STATUS_BADGE.draft
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                      {c.isPublished && c.status !== 'draft' && c.status !== 'archived' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Globe className="h-3 w-3" /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-display text-lg font-bold text-white">{c.title}</h4>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{c.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 bg-[#151820] rounded-xl p-3 border border-[#222631]">
                    <span>Mode: {c.participationType.toUpperCase()}</span>
                    <span>Reg Deadline: {c.registrationDeadline || '—'}</span>
                    <span>Sub Deadline: {c.submissionDeadline || '—'}</span>
                    <span>
                      Entries: <strong className="text-white">{regCount}</strong> reg /{' '}
                      <strong className="text-[#CCFF00]">{subCount}</strong> sub
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#1f2229] bg-[#0e1014] px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Change status for ${c.title}`}
                      value={c.status}
                      onChange={(e) => handleQuickStatusChange(c, e.target.value as ChallengeStatus)}
                      className="rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-zinc-200 focus:border-[#CCFF00] focus:outline-none cursor-pointer"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="registration_closed">Reg Closed</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectChallenge(c);
                        setInspectTab('registrations');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-sky-300 hover:border-sky-400 cursor-pointer"
                    >
                      <Users className="h-3 w-3" /> Registrations ({regCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewChallenge(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-[#CCFF00] cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete challenge ${c.title}`}
                      onClick={() =>
                        onRequestDelete(c, async () => {
                          await deleteDoc(doc(db, 'challenges', c.id!));
                          await syncToSqlApi(`/api/challenges/${encodeURIComponent(c.id!)}`, 'DELETE');
                          setChallenges((prev) => prev.filter((item) => item.id !== c.id));
                          await onLogAdminAction('CHALLENGE_DELETED', 'Challenge', c.id!, `Deleted "${c.title}"`);
                          onNotify('success', `Deleted challenge "${c.title}".`);
                        })
                      }
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT CHALLENGE MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Super Admin Challenge Studio</span>
                <h3 className="font-display text-lg font-bold text-white">
                  {editing ? 'Edit Engineering Challenge' : 'Create New Engineering Challenge'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Challenge Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Autonomous Warehouse Rover Sprint"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.title && <p className="text-red-400 text-[11px] mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Category / Domain *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    {CHALLENGE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Problem Scope & Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the engineering challenge, constraints, and real-world impact..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {formErrors.description && <p className="text-red-400 text-[11px] mt-1">{formErrors.description}</p>}
              </div>

              {/* Poster Upload */}
              <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-white">Challenge Poster / Banner</label>
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e222b] border border-[#2e333f] px-3 py-1.5 text-[11px] font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingPoster ? 'Processing...' : 'Upload Poster Image'}
                    <input type="file" accept="image/*" onChange={handlePosterFile} className="hidden" />
                  </label>
                </div>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="Or paste poster image URL..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {posterUrl && (
                  <img src={posterUrl} alt="Poster preview" className="h-28 w-full object-cover rounded-lg border border-[#2b2f38]" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Participation Type</label>
                  <select
                    value={participationType}
                    onChange={(e) => setParticipationType(e.target.value as ChallengeParticipationType)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="individual">Individual Only</option>
                    <option value="team">Team Only</option>
                    <option value="both">Individual or Team</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Min Team Size</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    disabled={participationType === 'individual'}
                    value={minTeamSize}
                    onChange={(e) => setMinTeamSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Max Team Size</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    disabled={participationType === 'individual'}
                    value={maxTeamSize}
                    onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white disabled:opacity-40"
                  />
                </div>
              </div>
              {formErrors.teamSize && <p className="text-red-400 text-[11px]">{formErrors.teamSize}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Start Date / Time</label>
                  <input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Registration Deadline *</label>
                  <input
                    type="date"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.registrationDeadline && (
                    <p className="text-red-400 text-[11px] mt-1">{formErrors.registrationDeadline}</p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Submission Deadline *</label>
                  <input
                    type="date"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.submissionDeadline && (
                    <p className="text-red-400 text-[11px] mt-1">{formErrors.submissionDeadline}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Eligibility Criteria</label>
                  <input
                    type="text"
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    placeholder="e.g. Undergraduate B.Tech / B.E. students"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Required Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="ROS2, Embedded C, PCB Design, PyTorch"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Rules & Judging Criteria *</label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={3}
                  placeholder="List evaluation rubric, hardware/software constraints, originality rules..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {formErrors.rules && <p className="text-red-400 text-[11px] mt-1">{formErrors.rules}</p>}
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Submission Instructions *</label>
                <textarea
                  value={submissionInstructions}
                  onChange={(e) => setSubmissionInstructions(e.target.value)}
                  rows={2}
                  placeholder="Explain what teams must submit before the deadline..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {formErrors.submissionInstructions && (
                  <p className="text-red-400 text-[11px] mt-1">{formErrors.submissionInstructions}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Required Deliverables (comma-separated)</label>
                <input
                  type="text"
                  value={requiredFilesText}
                  onChange={(e) => setRequiredFilesText(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Prizes / Rewards / Grants</label>
                  <input
                    type="text"
                    value={prizeOrRewards}
                    onChange={(e) => setPrizeOrRewards(e.target.value)}
                    placeholder="e.g. ₹1,00,000 Prototyping Grant + ESC Fellowship"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Organizer Contact Info</label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Email or Discord handle"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                <div>
                  <label className="block font-semibold text-white mb-1">Target Public Status (when published)</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as ChallengeStatus)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="live">Live (Open for Registration)</option>
                    <option value="scheduled">Scheduled (Upcoming)</option>
                    <option value="registration_closed">Registration Closed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <label className="flex items-center gap-2.5 pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={certificateAvailable}
                    onChange={(e) => setCertificateAvailable(e.target.checked)}
                    className="h-4 w-4 accent-[#CCFF00]"
                  />
                  <span className="text-zinc-200 font-medium">Official ESC Certificate Issued</span>
                </label>
              </div>
            </div>

            <div className="border-t border-[#23262d] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewChallenge({ id: editing?.id || 'preview', ...buildPayloadFromDraft('publish') })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveChallenge('draft')}
                  className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2 text-xs font-semibold text-white hover:border-zinc-400 cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveChallenge('publish')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Publish Live'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#CCFF00]/40 bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
              <span className="font-mono text-xs text-[#CCFF00] uppercase font-bold">
                Public Challenge Preview
              </span>
              <button type="button" onClick={() => setPreviewChallenge(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {previewChallenge.posterUrl && (
              <img src={previewChallenge.posterUrl} alt={previewChallenge.title} className="w-full h-48 object-cover rounded-xl border border-[#232731]" />
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="rounded bg-[#CCFF00]/15 px-2.5 py-0.5 text-[#CCFF00]">{previewChallenge.category}</span>
                <span className="rounded bg-[#1a1d24] px-2.5 py-0.5 text-zinc-300 uppercase">
                  {previewChallenge.participationType === 'both'
                    ? `Individual / Team (${previewChallenge.minTeamSize}-${previewChallenge.maxTeamSize})`
                    : previewChallenge.participationType}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">{previewChallenge.title || 'Untitled Challenge'}</h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{previewChallenge.description}</p>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4 text-xs">
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Registration Deadline</span>
                  <span className="text-white">{previewChallenge.registrationDeadline || 'TBD'}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Submission Deadline</span>
                  <span className="text-white">{previewChallenge.submissionDeadline || 'TBD'}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Eligibility</span>
                  <span className="text-white">{previewChallenge.eligibility || 'All Students'}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Prizes / Rewards</span>
                  <span className="text-[#CCFF00] font-semibold">{previewChallenge.prizeOrRewards || 'Certificate & Recognition'}</span>
                </div>
              </div>
              {previewChallenge.rules && (
                <div className="text-xs space-y-1">
                  <span className="font-mono text-[10px] text-[#CCFF00] uppercase">Rules & Guidelines</span>
                  <p className="text-zinc-300 whitespace-pre-line">{previewChallenge.rules}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW REGISTRATIONS & SUBMISSIONS DRAWER */}
      {inspectChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Challenge Roster</span>
                <h3 className="font-display text-lg font-bold text-white">{inspectChallenge.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRegsCSV(inspectChallenge)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3 py-1.5 text-xs font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                <button type="button" onClick={() => setInspectChallenge(null)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInspectTab('registrations')}
                className={`rounded-xl px-4 py-2 text-xs font-mono font-bold cursor-pointer ${
                  inspectTab === 'registrations' ? 'bg-[#CCFF00] text-black' : 'bg-[#14161c] text-zinc-400'
                }`}
              >
                Registrations ({challengeRegs.length})
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('submissions')}
                className={`rounded-xl px-4 py-2 text-xs font-mono font-bold cursor-pointer ${
                  inspectTab === 'submissions' ? 'bg-[#CCFF00] text-black' : 'bg-[#14161c] text-zinc-400'
                }`}
              >
                Submissions ({challengeSubs.length})
              </button>
            </div>

            {inspectTab === 'registrations' ? (
              challengeRegs.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">No participants registered for this challenge yet.</div>
              ) : (
                <div className="overflow-x-auto max-h-[55vh] rounded-xl border border-[#232731]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#161820] text-zinc-400 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Participant</th>
                        <th className="px-4 py-3">Mode / Team</th>
                        <th className="px-4 py-3">College & Branch</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1f26]">
                      {challengeRegs.map((reg) => (
                        <tr key={reg.id} className="hover:bg-[#14161c]">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-white">{reg.userName}</p>
                            <p className="text-[11px] text-zinc-400">{reg.userEmail}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono uppercase text-[#CCFF00] text-[10px] block">{reg.participationMode}</span>
                            {reg.teamName && <span className="text-white">{reg.teamName}</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {reg.college || '—'} {reg.branch ? `• ${reg.branch}` : ''}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-[#1e222b] px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-200">
                              {reg.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                            {new Date(reg.registeredAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : challengeSubs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">No project deliverables submitted yet.</div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {challengeSubs.map((sub) => (
                  <div key={sub.id} className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display text-sm font-bold text-white">{sub.projectTitle}</h4>
                        <p className="text-[11px] text-zinc-400">
                          {sub.userName} ({sub.userEmail}) {sub.teamName ? `• Team ${sub.teamName}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {typeof sub.score === 'number' && (
                          <span className="rounded bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[11px] text-[#CCFF00] font-bold">
                            Score: {sub.score}/100
                          </span>
                        )}
                        <span className="rounded bg-[#1e222b] px-2.5 py-0.5 font-mono text-[10px] uppercase text-white">
                          {sub.reviewStatus.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingSub(sub);
                            setReviewStatusDraft(sub.reviewStatus);
                            setReviewScoreDraft(typeof sub.score === 'number' ? String(sub.score) : '');
                            setReviewFeedbackDraft(sub.reviewerFeedback || '');
                          }}
                          className="rounded-lg bg-[#CCFF00] px-2.5 py-1 text-[11px] font-bold text-black hover:bg-[#b8e600] cursor-pointer"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                    <p className="text-zinc-300">{sub.summary}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono text-[#CCFF00]">
                      {sub.repoUrl && <a href={sub.repoUrl} target="_blank" rel="noreferrer" className="underline">Repo Link</a>}
                      {sub.demoVideoUrl && <a href={sub.demoVideoUrl} target="_blank" rel="noreferrer" className="underline">Demo Video</a>}
                      {sub.deckOrDocUrl && <a href={sub.deckOrDocUrl} target="_blank" rel="noreferrer" className="underline">Documentation</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEW SUBMISSION MODAL */}
      {reviewingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveSubmissionReview} className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
              <h4 className="font-display text-base font-bold text-white">Score & Review Submission</h4>
              <button type="button" onClick={() => setReviewingSub(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-white">{reviewingSub.projectTitle}</p>
              <p className="text-zinc-400">{reviewingSub.userName}</p>
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">Evaluation Status</label>
              <select
                value={reviewStatusDraft}
                onChange={(e) => setReviewStatusDraft(e.target.value as ChallengeSubmission['reviewStatus'])}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="needs_revision">Needs Revision</option>
                <option value="accepted">Accepted</option>
                <option value="winner">Winner</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">Score (0 - 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={reviewScoreDraft}
                onChange={(e) => setReviewScoreDraft(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-white mb-1">Reviewer Feedback</label>
              <textarea
                rows={3}
                value={reviewFeedbackDraft}
                onChange={(e) => setReviewFeedbackDraft(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReviewingSub(null)} className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-300 cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={savingReview} className="rounded-xl bg-[#CCFF00] px-4 py-2 font-bold text-black cursor-pointer">
                {savingReview ? 'Saving...' : 'Save Evaluation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
