import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Search,
  Calendar,
  Clock,
  Award,
  Users,
  CheckCircle2,
  Send,
  Eye,
  X,
  AlertCircle,
  FileCode2,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  canRegisterForChallenge,
  canSubmitToChallenge,
  isChallengePubliclyVisible,
} from '../utils/escLogic';
import type {
  ChallengeItem,
  ChallengeRegistration,
  ChallengeStatus,
  ChallengeSubmission,
} from '../types';

interface ChallengesProps {
  navigate: (path: string) => void;
}

const STATUS_BADGE: Record<ChallengeStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  scheduled: { label: 'Scheduled', cls: 'bg-sky-950/60 text-sky-300 border-sky-700/50' },
  live: { label: 'Live Now', cls: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40' },
  registration_closed: {
    label: 'Registration Closed',
    cls: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  },
  completed: { label: 'Completed', cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' },
  archived: { label: 'Archived', cls: 'bg-zinc-900 text-zinc-500 border-zinc-800' },
};

export const Challenges: React.FC<ChallengesProps> = ({ navigate }) => {
  const { user, profile, signInWithGoogle } = useAuth();

  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, ChallengeRegistration>>({});
  const [submissions, setSubmissions] = useState<Record<string, ChallengeSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Detail Modal
  const [detailChallenge, setDetailChallenge] = useState<ChallengeItem | null>(null);

  // Register Modal
  const [registerTarget, setRegisterTarget] = useState<ChallengeItem | null>(null);
  const [participationMode, setParticipationMode] = useState<'individual' | 'team'>('individual');
  const [teamName, setTeamName] = useState('');
  const [teamMembersText, setTeamMembersText] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [skillsSummary, setSkillsSummary] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Deliverable Submit Modal
  const [submitTarget, setSubmitTarget] = useState<ChallengeItem | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoVideoUrl, setDemoVideoUrl] = useState('');
  const [deckOrDocUrl, setDeckOrDocUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const q = query(collection(db, 'challenges'), where('isPublished', '==', true));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ChallengeItem))
        .filter((c) => isChallengePubliclyVisible(c))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setChallenges(list);

      if (user) {
        const [regSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, 'challengeRegistrations'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'challengeSubmissions'), where('userId', '==', user.uid))),
        ]);
        const regMap: Record<string, ChallengeRegistration> = {};
        regSnap.docs.forEach((d) => {
          const item = { id: d.id, ...d.data() } as ChallengeRegistration;
          regMap[item.challengeId] = item;
        });
        setRegistrations(regMap);

        const subMap: Record<string, ChallengeSubmission> = {};
        subSnap.docs.forEach((d) => {
          const item = { id: d.id, ...d.data() } as ChallengeSubmission;
          subMap[item.challengeId] = item;
        });
        setSubmissions(subMap);
      } else {
        setRegistrations({});
        setSubmissions({});
      }
    } catch (err: any) {
      console.error('Error fetching challenges:', err);
      setErrorMsg('Unable to load challenges right now. Please refresh or try again shortly.');
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
  }, [user?.uid]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    challenges.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ['all', ...Array.from(set)];
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const effStatus = c.status || 'live';
      if (statusFilter !== 'all' && effStatus !== statusFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.requiredSkills?.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [challenges, statusFilter, categoryFilter, search]);

  const openRegisterModal = (c: ChallengeItem) => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    const defaultMode: 'individual' | 'team' =
      c.participationType === 'team' ? 'team' : 'individual';
    setParticipationMode(defaultMode);
    setTeamName('');
    setTeamMembersText('');
    setCollege(profile?.college || '');
    setBranch(profile?.branch || '');
    setSkillsSummary(profile?.technicalSkills?.join(', ') || '');
    setRegisterTarget(c);
  };

  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !registerTarget?.id) return;

    const gate = canRegisterForChallenge(registerTarget);
    if (!gate.allowed) {
      setBanner({ type: 'error', text: gate.reason || 'Registration is closed.' });
      return;
    }

    if (participationMode === 'team' && !teamName.trim()) {
      setBanner({ type: 'error', text: 'Please enter a team name for team participation.' });
      return;
    }

    try {
      setSubmittingReg(true);
      const regId = `chalreg_${user.uid}_${registerTarget.id}`;
      const now = new Date().toISOString();
      const members = teamMembersText
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      const record: ChallengeRegistration = {
        id: regId,
        challengeId: registerTarget.id,
        challengeTitle: registerTarget.title,
        userId: user.uid,
        userName: profile?.fullName || user.displayName || 'Engineering Student',
        userEmail: user.email || '',
        college: college.trim(),
        branch: branch.trim(),
        participationMode,
        teamName: participationMode === 'team' ? teamName.trim() : '',
        teamMembers: participationMode === 'team' ? members : [],
        skillsSummary: skillsSummary.trim(),
        status: 'registered',
        registeredAt: now,
      };

      const alreadyRegistered = Boolean(registrations[registerTarget.id]);
      await setDoc(doc(db, 'challengeRegistrations', regId), record);

      if (!alreadyRegistered) {
        await updateDoc(doc(db, 'challenges', registerTarget.id), {
          registeredCount: increment(1),
          updatedAt: now,
        });
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === registerTarget.id
              ? { ...c, registeredCount: (c.registeredCount || 0) + 1 }
              : c
          )
        );
      }

      setRegistrations((prev) => ({ ...prev, [registerTarget.id!]: record }));
      await syncToSqlApi(
        `/api/challenges/${encodeURIComponent(registerTarget.id)}/register`,
        'POST',
        record
      );
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#ffffff', '#38bdf8'],
      });
      setBanner({
        type: 'success',
        text: `Registered for "${registerTarget.title}". You can now submit your deliverable anytime before the deadline.`,
      });
      setRegisterTarget(null);
    } catch (err: any) {
      console.error('Challenge registration error:', err);
      setBanner({ type: 'error', text: err?.message || 'Failed to register for challenge.' });
    } finally {
      setSubmittingReg(false);
    }
  };

  const openSubmitModal = (c: ChallengeItem) => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    const existing = c.id ? submissions[c.id] : undefined;
    setProjectTitle(existing?.projectTitle || '');
    setSummary(existing?.summary || '');
    setRepoUrl(existing?.repoUrl || '');
    setDemoVideoUrl(existing?.demoVideoUrl || '');
    setDeckOrDocUrl(existing?.deckOrDocUrl || '');
    setNotes(existing?.notes || '');
    setSubmitTarget(c);
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !submitTarget?.id) return;

    const reg = registrations[submitTarget.id];
    const gate = canSubmitToChallenge(submitTarget, Boolean(reg));
    if (!gate.allowed) {
      setBanner({ type: 'error', text: gate.reason || 'Submissions are closed.' });
      return;
    }

    if (!projectTitle.trim() || !summary.trim()) {
      setBanner({ type: 'error', text: 'Project title and technical summary are required.' });
      return;
    }

    try {
      setSubmittingWork(true);
      const subId = `chalsub_${user.uid}_${submitTarget.id}`;
      const existing = submissions[submitTarget.id];
      const now = new Date().toISOString();

      if (existing) {
        await updateDoc(doc(db, 'challengeSubmissions', subId), {
          projectTitle: projectTitle.trim(),
          summary: summary.trim(),
          repoUrl: repoUrl.trim(),
          demoVideoUrl: demoVideoUrl.trim(),
          deckOrDocUrl: deckOrDocUrl.trim(),
          notes: notes.trim(),
          updatedAt: now,
        });
        setSubmissions((prev) => ({
          ...prev,
          [submitTarget.id!]: {
            ...existing,
            projectTitle: projectTitle.trim(),
            summary: summary.trim(),
            repoUrl: repoUrl.trim(),
            demoVideoUrl: demoVideoUrl.trim(),
            deckOrDocUrl: deckOrDocUrl.trim(),
            notes: notes.trim(),
            updatedAt: now,
          },
        }));
      } else {
        const newSub: ChallengeSubmission = {
          id: subId,
          challengeId: submitTarget.id,
          challengeTitle: submitTarget.title,
          userId: user.uid,
          userName: profile?.fullName || user.displayName || 'Engineering Student',
          userEmail: user.email || '',
          teamName: reg?.teamName || '',
          projectTitle: projectTitle.trim(),
          summary: summary.trim(),
          repoUrl: repoUrl.trim(),
          demoVideoUrl: demoVideoUrl.trim(),
          deckOrDocUrl: deckOrDocUrl.trim(),
          deliverablesChecklist: submitTarget.requiredSubmissionFiles || [],
          notes: notes.trim(),
          reviewStatus: 'submitted',
          submittedAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'challengeSubmissions', subId), newSub);
        await updateDoc(doc(db, 'challenges', submitTarget.id), {
          submissionCount: increment(1),
          updatedAt: now,
        });
        await updateDoc(doc(db, 'challengeRegistrations', reg.id!), {
          status: 'submitted',
        }).catch(() => null);
        setSubmissions((prev) => ({ ...prev, [submitTarget.id!]: newSub }));
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === submitTarget.id
              ? { ...c, submissionCount: (c.submissionCount || 0) + 1 }
              : c
          )
        );
      }

      await syncToSqlApi(
        `/api/challenges/${encodeURIComponent(submitTarget.id)}/submit`,
        'POST',
        {
          id: subId,
          challengeTitle: submitTarget.title,
          userName: profile?.fullName || user.displayName || 'Engineering Student',
          teamName: reg?.teamName || '',
          projectTitle: projectTitle.trim(),
          summary: summary.trim(),
          repoUrl: repoUrl.trim(),
          demoVideoUrl: demoVideoUrl.trim(),
          deckOrDocUrl: deckOrDocUrl.trim(),
          deliverablesChecklist: submitTarget.requiredSubmissionFiles || [],
          notes: notes.trim(),
        }
      );

      setBanner({
        type: 'success',
        text: `Deliverable saved for "${submitTarget.title}". Track evaluation feedback in your Dashboard.`,
      });
      setSubmitTarget(null);
    } catch (err: any) {
      console.error('Challenge submission error:', err);
      setBanner({ type: 'error', text: err?.message || 'Failed to submit deliverable.' });
    } finally {
      setSubmittingWork(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        {/* Header */}
        <div className="border-b border-[#1f2229] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              Competitive Engineering Sprints
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
              ESC Engineering Challenges
            </h1>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
              Verified technical problem sprints published directly by the ESC Council. Register as an individual builder or multidisciplinary squad and submit production deliverables for review.
            </p>
          </div>
          <button
            onClick={() => navigate('/events')}
            className="rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2.5 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors cursor-pointer shrink-0"
          >
            View Live Events &amp; Workshops →
          </button>
        </div>

        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
              banner.type === 'success'
                ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                : 'border-red-800 bg-red-950/40 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search challenges by title, domain, or required skill..."
              className="w-full rounded-xl border border-[#262933] bg-[#12141a] pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: 'All Status' },
              { key: 'live', label: 'Live' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'registration_closed', label: 'Submission Stage' },
              { key: 'completed', label: 'Completed' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-[#CCFF00] text-black'
                    : 'bg-[#14161c] text-zinc-400 border border-[#232731] hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}

            {categories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-[#232731] bg-[#14161c] px-3 py-2 text-xs font-mono text-zinc-200 focus:border-[#CCFF00] focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Challenge Cards */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2" />
            Loading published engineering challenges...
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-900/50 bg-[#141013] p-10 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-200">{errorMsg}</p>
            <button
              onClick={loadChallenges}
              className="rounded-xl border border-red-700 px-4 py-2 text-xs font-mono text-white hover:bg-red-900/40 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-14 text-center space-y-4">
            <Trophy className="h-10 w-10 text-zinc-600 mx-auto" />
            <h3 className="font-display text-xl font-bold text-white">
              {challenges.length === 0
                ? 'No live challenges published yet'
                : 'No challenges match your filter'}
            </h3>
            <p className="text-xs text-[#8e919b] max-w-md mx-auto leading-relaxed">
              {challenges.length === 0
                ? 'New engineering challenges are published directly by the ESC Super Admin. Check back soon or explore open Problem Bank statements.'
                : 'Try clearing your search or switching status filters to view available challenges.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {challenges.length > 0 ? (
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Reset Filters
                </button>
              ) : (
                <button
                  onClick={() => navigate('/problems')}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Explore Problem Bank
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredChallenges.map((c) => {
              const reg = c.id ? registrations[c.id] : undefined;
              const sub = c.id ? submissions[c.id] : undefined;
              const regGate = canRegisterForChallenge(c);
              const subGate = canSubmitToChallenge(c, Boolean(reg));
              const badge = STATUS_BADGE[c.status || 'live'] || STATUS_BADGE.live;

              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[#262933] bg-[#111318] overflow-hidden flex flex-col justify-between hover:border-[#CCFF00]/50 transition-all"
                >
                  {c.posterUrl && (
                    <div className="h-48 w-full overflow-hidden border-b border-[#1f2229] bg-[#0b0c0e]">
                      <img
                        src={c.posterUrl}
                        alt={c.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-7 space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="rounded bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] px-2.5 py-0.5 font-semibold">
                          {c.category}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 uppercase font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <h3 className="font-display text-2xl font-bold text-white">{c.title}</h3>
                      <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                        {c.description}
                      </p>

                      {c.requiredSkills && c.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {c.requiredSkills.slice(0, 5).map((sk) => (
                            <span
                              key={sk}
                              className="rounded-lg bg-[#171920] border border-[#262a35] px-2 py-0.5 text-[10px] font-mono text-zinc-300"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Users className="h-4 w-4 text-[#CCFF00] shrink-0" />
                          <span>
                            {c.participationType === 'individual'
                              ? 'Individual Only'
                              : c.participationType === 'team'
                              ? `Team (${c.minTeamSize}-${c.maxTeamSize} members)`
                              : `Individual or Team (${c.minTeamSize}-${c.maxTeamSize})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Clock className="h-4 w-4 text-[#CCFF00] shrink-0" />
                          <span>Reg Deadline: {c.registrationDeadline || 'Open'}</span>
                        </div>
                        {c.submissionDeadline && (
                          <div className="flex items-center gap-2 text-zinc-300">
                            <Calendar className="h-4 w-4 text-[#CCFF00] shrink-0" />
                            <span>Submit By: {c.submissionDeadline}</span>
                          </div>
                        )}
                        {c.certificateAvailable && (
                          <div className="flex items-center gap-2 text-emerald-300">
                            <Award className="h-4 w-4 shrink-0" />
                            <span>Verified Certificate Eligible</span>
                          </div>
                        )}
                      </div>

                      {c.prizeOrRewards && (
                        <div className="rounded-xl border border-[#2b2f3a] bg-[#161922] p-3 text-xs space-y-1">
                          <span className="font-mono text-[#CCFF00] text-[10px] uppercase font-bold block">
                            Grants &amp; Rewards:
                          </span>
                          <p className="text-white font-medium">{c.prizeOrRewards}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#1f2229] pt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] font-mono text-zinc-400">
                        <span>{c.registeredCount || 0} registered</span>
                        <span className="mx-2 text-zinc-600">•</span>
                        <span>{c.submissionCount || 0} submissions</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setDetailChallenge(c)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#2b2f38] bg-[#161820] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>

                        {reg ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-950/60 border border-emerald-700/50 px-3 py-2 text-[11px] font-mono text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {sub ? `Submitted (${sub.reviewStatus.replace('_', ' ')})` : 'Registered'}
                            </span>
                            {subGate.allowed && (
                              <button
                                onClick={() => openSubmitModal(c)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                              >
                                <Send className="h-3.5 w-3.5" />
                                {sub ? 'Update Deliverable' : 'Submit Work'}
                              </button>
                            )}
                          </>
                        ) : regGate.allowed ? (
                          <button
                            onClick={() => openRegisterModal(c)}
                            className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
                          >
                            Register Now
                          </button>
                        ) : (
                          <span className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-[11px] font-mono text-zinc-400">
                            {regGate.reason || 'Closed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Details Modal */}
      {detailChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 text-xs">
            <div className="flex items-start justify-between gap-4 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  {detailChallenge.category}
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-1">
                  {detailChallenge.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailChallenge(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailChallenge.posterUrl && (
              <img
                src={detailChallenge.posterUrl}
                alt={detailChallenge.title}
                className="w-full h-48 object-cover rounded-xl border border-[#232731]"
              />
            )}

            <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
              {detailChallenge.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4">
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Eligibility</span>
                <p className="text-white mt-0.5">{detailChallenge.eligibility || 'Open to all verified students'}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Deadlines</span>
                <p className="text-white mt-0.5">
                  Reg: {detailChallenge.registrationDeadline || 'Open'} • Sub:{' '}
                  {detailChallenge.submissionDeadline || 'TBA'}
                </p>
              </div>
              {detailChallenge.contactInfo && (
                <div className="sm:col-span-2">
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Contact / Coordinator</span>
                  <p className="text-zinc-200 mt-0.5">{detailChallenge.contactInfo}</p>
                </div>
              )}
            </div>

            {detailChallenge.rules && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Rules &amp; Evaluation Criteria
                </span>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed">{detailChallenge.rules}</p>
              </div>
            )}

            {detailChallenge.submissionInstructions && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Submission Instructions
                </span>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed">
                  {detailChallenge.submissionInstructions}
                </p>
              </div>
            )}

            {detailChallenge.requiredSubmissionFiles &&
              detailChallenge.requiredSubmissionFiles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] text-zinc-400 uppercase block">
                    Required Deliverables
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailChallenge.requiredSubmissionFiles.map((file) => (
                      <span
                        key={file}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-zinc-200"
                      >
                        <FileCode2 className="h-3 w-3 text-[#CCFF00]" /> {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
              <button
                onClick={() => setDetailChallenge(null)}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
              >
                Close
              </button>
              {detailChallenge.id && !registrations[detailChallenge.id] && canRegisterForChallenge(detailChallenge).allowed && (
                <button
                  onClick={() => {
                    const target = detailChallenge;
                    setDetailChallenge(null);
                    openRegisterModal(target);
                  }}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Register for Challenge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Challenge Registration Modal */}
      {registerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  Challenge Registration
                </span>
                <h3 className="font-display text-base font-bold text-white mt-0.5">
                  {registerTarget.title}
                </h3>
              </div>
              <button
                onClick={() => setRegisterTarget(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRegistration} className="space-y-4 pt-4 text-xs">
              {registerTarget.participationType === 'both' && (
                <div>
                  <label className="block font-semibold text-white mb-1.5">Participation Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['individual', 'team'] as const).map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => setParticipationMode(mode)}
                        className={`rounded-xl border py-2 font-mono uppercase cursor-pointer ${
                          participationMode === mode
                            ? 'border-[#CCFF00] bg-[#CCFF00]/15 text-[#CCFF00] font-bold'
                            : 'border-[#2b2f38] bg-[#17191e] text-zinc-400'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {participationMode === 'team' && (
                <>
                  <div>
                    <label className="block font-semibold text-white mb-1">Team Name *</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      placeholder="e.g. MechaPulse Squad"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Team Members (comma-separated names/emails)
                    </label>
                    <input
                      type="text"
                      value={teamMembersText}
                      onChange={(e) => setTeamMembersText(e.target.value)}
                      placeholder="Riya Sharma, Aarav Patel"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">College / University</label>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. COEP / IITB"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Engineering Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Mechatronics"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Technical Skills / Track Focus</label>
                <input
                  type="text"
                  value={skillsSummary}
                  onChange={(e) => setSkillsSummary(e.target.value)}
                  placeholder="ROS2, PCB Layout, Edge ML..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
                <button
                  type="button"
                  onClick={() => setRegisterTarget(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReg}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  {submittingReg ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Challenge Deliverable Submission Modal */}
      {submitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  Submit Deliverable
                </span>
                <h3 className="font-display text-base font-bold text-white mt-0.5">
                  {submitTarget.title}
                </h3>
              </div>
              <button
                onClick={() => setSubmitTarget(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeliverable} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-white mb-1">Project / Solution Title *</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  required
                  placeholder="Name of your prototype or build"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Engineering Summary *</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe your architecture, hardware/software implementation, and test results..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Repository / CAD URL</label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">Demo Video URL</label>
                  <input
                    type="url"
                    value={demoVideoUrl}
                    onChange={(e) => setDemoVideoUrl(e.target.value)}
                    placeholder="https://youtu.be/..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Deck / Docs URL</label>
                  <input
                    type="url"
                    value={deckOrDocUrl}
                    onChange={(e) => setDeckOrDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Additional Notes for Evaluators</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Hardware specs, BOM summary, or testing environment..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
                <button
                  type="button"
                  onClick={() => setSubmitTarget(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWork}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {submittingWork ? 'Submitting...' : 'Submit Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
