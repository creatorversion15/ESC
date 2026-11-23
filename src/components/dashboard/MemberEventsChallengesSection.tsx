import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Clock,
  Trophy,
  CheckCircle2,
  AlertCircle,
  MapPin,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncToSqlApi } from '../../lib/apiClient';
import { canRegisterForChallenge, canRegisterForEvent } from '../../utils/escLogic';
import {
  checkAdminEligibilityRestriction,
  computeDashboardActivityVisibility,
  filterDashboardActiveChallenges,
  filterDashboardActiveEvents,
} from '../../utils/memberOnboardingLogic';
import type {
  ChallengeItem,
  ChallengeRegistration,
  EventItem,
  EventRegistration,
  UserProfile,
} from '../../types';

interface MemberEventsChallengesSectionProps {
  events: EventItem[];
  challenges: ChallengeItem[];
  registeredEventIds: string[];
  registeredChallengeIds: string[];
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  profile: UserProfile | null;
  isApprovedMember: boolean;
  onEventRegistered: (reg: EventRegistration) => void;
  onChallengeRegistered: (reg: ChallengeRegistration) => void;
  navigate: (path: string) => void;
}

export const MemberEventsChallengesSection: React.FC<MemberEventsChallengesSectionProps> = ({
  events,
  challenges,
  registeredEventIds,
  registeredChallengeIds,
  userUid,
  userEmail,
  userDisplayName,
  profile,
  isApprovedMember,
  onEventRegistered,
  onChallengeRegistered,
  navigate,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Event registration modal state
  const [registerEventTarget, setRegisterEventTarget] = useState<EventItem | null>(null);
  const [evCollege, setEvCollege] = useState('');
  const [evPhone, setEvPhone] = useState('');
  const [evNotes, setEvNotes] = useState('');
  const [submittingEvent, setSubmittingEvent] = useState(false);

  // Challenge registration modal state
  const [registerChallengeTarget, setRegisterChallengeTarget] = useState<ChallengeItem | null>(null);
  const [participationMode, setParticipationMode] = useState<'individual' | 'team'>('individual');
  const [teamName, setTeamName] = useState('');
  const [teamMembersText, setTeamMembersText] = useState('');
  const [chCollege, setChCollege] = useState('');
  const [chBranch, setChBranch] = useState('');
  const [chSkills, setChSkills] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);

  const activeEvents = useMemo(
    () => filterDashboardActiveEvents(events, registeredEventIds),
    [events, registeredEventIds]
  );

  const activeChallenges = useMemo(
    () => filterDashboardActiveChallenges(challenges, registeredChallengeIds),
    [challenges, registeredChallengeIds]
  );

  const visibility = useMemo(
    () => computeDashboardActivityVisibility(activeEvents, activeChallenges),
    [activeEvents, activeChallenges]
  );

  // STRICT CONDITIONAL VISIBILITY (Case 4): Hide completely when neither is available.
  if (!visibility.showEvents && !visibility.showChallenges) {
    return null;
  }

  const openEventModal = (ev: EventItem) => {
    setFeedback(null);
    setEvCollege(profile?.college || '');
    setEvPhone(profile?.phone || '');
    setEvNotes('');
    setRegisterEventTarget(ev);
  };

  const openChallengeModal = (ch: ChallengeItem) => {
    setFeedback(null);
    setParticipationMode(ch.participationType === 'team' ? 'team' : 'individual');
    setTeamName('');
    setTeamMembersText('');
    setChCollege(profile?.college || '');
    setChBranch(profile?.branch || '');
    setChSkills(profile?.technicalSkills?.join(', ') || '');
    setRegisterChallengeTarget(ch);
  };

  const handleConfirmEventRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEventTarget?.id) return;

    if (registeredEventIds.includes(registerEventTarget.id)) {
      setFeedback({ type: 'error', text: 'You are already registered for this event.' });
      setRegisterEventTarget(null);
      return;
    }

    const gate = canRegisterForEvent(registerEventTarget);
    if (!gate.allowed) {
      setFeedback({ type: 'error', text: gate.reason || 'Registration is closed for this event.' });
      return;
    }

    try {
      setSubmittingEvent(true);
      const regId = `reg_${userUid}_${registerEventTarget.id}`;
      const now = new Date().toISOString();
      const record: EventRegistration = {
        id: regId,
        eventId: registerEventTarget.id,
        eventTitle: registerEventTarget.title,
        userId: userUid,
        userName: profile?.fullName || userDisplayName || 'Engineering Student',
        userEmail,
        college: evCollege.trim(),
        phone: evPhone.trim(),
        notes: evNotes.trim(),
        status: 'confirmed',
        registeredAt: now,
      };

      await setDoc(doc(db, 'eventRegistrations', regId), record).catch(() => {});
      await updateDoc(doc(db, 'events', registerEventTarget.id), {
        registeredCount: increment(1),
        updatedAt: now,
      }).catch(() => {});

      await syncToSqlApi(
        `/api/events/${encodeURIComponent(registerEventTarget.id)}/register`,
        'POST',
        {
          id: regId,
          eventTitle: registerEventTarget.title,
          userName: record.userName,
          college: record.college,
          phone: record.phone,
          notes: record.notes,
        }
      );

      onEventRegistered(record);
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#39FF14', '#CCFF00', '#ffffff'],
      });
      setFeedback({
        type: 'success',
        text: `Successfully registered for "${registerEventTarget.title}". Your registration is recorded in ESC Events.`,
      });
      setRegisterEventTarget(null);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to complete event registration.' });
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleConfirmChallengeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerChallengeTarget?.id) return;

    if (registeredChallengeIds.includes(registerChallengeTarget.id)) {
      setFeedback({ type: 'error', text: 'You are already registered for this challenge.' });
      setRegisterChallengeTarget(null);
      return;
    }

    const gate = canRegisterForChallenge(registerChallengeTarget);
    if (!gate.allowed) {
      setFeedback({ type: 'error', text: gate.reason || 'Registration is closed for this challenge.' });
      return;
    }

    if (participationMode === 'team' && !teamName.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a team name for team participation.' });
      return;
    }

    try {
      setSubmittingChallenge(true);
      const regId = `chalreg_${userUid}_${registerChallengeTarget.id}`;
      const now = new Date().toISOString();
      const members = teamMembersText
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      const record: ChallengeRegistration = {
        id: regId,
        challengeId: registerChallengeTarget.id,
        challengeTitle: registerChallengeTarget.title,
        userId: userUid,
        userName: profile?.fullName || userDisplayName || 'Engineering Student',
        userEmail,
        college: chCollege.trim(),
        branch: chBranch.trim(),
        participationMode,
        teamName: participationMode === 'team' ? teamName.trim() : '',
        teamMembers: participationMode === 'team' ? members : [],
        skillsSummary: chSkills.trim(),
        status: 'registered',
        registeredAt: now,
      };

      await setDoc(doc(db, 'challengeRegistrations', regId), record).catch(() => {});
      await updateDoc(doc(db, 'challenges', registerChallengeTarget.id), {
        registeredCount: increment(1),
        updatedAt: now,
      }).catch(() => {});

      await syncToSqlApi(
        `/api/challenges/${encodeURIComponent(registerChallengeTarget.id)}/register`,
        'POST',
        record
      );

      onChallengeRegistered(record);
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#39FF14', '#CCFF00', '#ffffff'],
      });
      setFeedback({
        type: 'success',
        text: `Successfully registered for "${registerChallengeTarget.title}". You can submit deliverables via Challenges.`,
      });
      setRegisterChallengeTarget(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unable to complete challenge registration.',
      });
    } finally {
      setSubmittingChallenge(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="dashboard-dynamic-activities" data-visibility-case={visibility.caseCode}>
      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'border-[#39FF14]/40 bg-[#0d1a0d] text-[#39FF14]'
              : 'border-red-800/70 bg-red-950/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CASE 1 / CASE 2: ACTIVE PUBLISHED EVENTS */}
      {visibility.showEvents && (
        <section
          aria-labelledby="dashboard-events-heading"
          data-testid="dashboard-active-events-section"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f232c] pb-3">
            <div>
              <h3
                id="dashboard-events-heading"
                className="font-display text-lg font-bold text-white flex items-center gap-2"
              >
                <Calendar className="h-5 w-5 text-[#39FF14]" />
                Active ESC Events
              </h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Published ESC events currently open for member registration on the platform.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="inline-flex items-center gap-1 text-xs font-mono text-[#39FF14] hover:underline cursor-pointer whitespace-nowrap"
            >
              View All Events <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {activeEvents.map((ev) => {
              const isRegistered = Boolean(ev.id && registeredEventIds.includes(ev.id));
              const restriction = checkAdminEligibilityRestriction(ev.eligibility, isApprovedMember);

              return (
                <article
                  key={ev.id}
                  data-testid={`dashboard-event-card-${ev.id}`}
                  className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#39FF14]/50"
                >
                  <div>
                    {/* Event Image / Banner */}
                    <div className="relative h-40 w-full bg-[#0d1016] border-b border-[#1e222b] overflow-hidden">
                      {ev.posterUrl ? (
                        <img
                          src={ev.posterUrl}
                          alt={ev.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-[#111914] via-[#10131a] to-[#0b0c0e] flex flex-col items-center justify-center p-4 text-center">
                          <Calendar className="h-8 w-8 text-[#39FF14]/70 mb-2" />
                          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                            {ev.type || 'ESC Event'}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-200">
                        <span className="capitalize font-semibold text-[#39FF14]">{ev.type || 'event'}</span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[60%]">
                            <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                            <span className="truncate">{ev.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <h4 className="font-display text-base font-bold text-white leading-snug">
                        {ev.title}
                      </h4>
                      <p className="text-xs text-[#9ca3af] line-clamp-3 leading-relaxed">
                        {ev.description}
                      </p>

                      <div className="pt-2 border-t border-[#1c2029] space-y-1.5 text-xs text-zinc-300 font-mono">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-zinc-500">Event Date</span>
                          <span className="tabular-nums text-white">{ev.date || 'TBA'}</span>
                        </div>
                        {ev.registrationDeadline && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">Reg Deadline</span>
                            <span className="tabular-nums text-amber-300">
                              {ev.registrationDeadline}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-1">
                    {isRegistered ? (
                      <div className="w-full rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 px-4 py-2.5 text-center font-mono text-xs font-semibold text-[#39FF14] flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Registered
                      </div>
                    ) : restriction.restricted ? (
                      <div className="w-full rounded-xl border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>{restriction.reason}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEventModal(ev)}
                        className="w-full rounded-xl bg-[#39FF14] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors cursor-pointer"
                      >
                        Register Now
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* CASE 1 / CASE 3: ACTIVE PUBLISHED CHALLENGES */}
      {visibility.showChallenges && (
        <section
          aria-labelledby="dashboard-challenges-heading"
          data-testid="dashboard-active-challenges-section"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f232c] pb-3">
            <div>
              <h3
                id="dashboard-challenges-heading"
                className="font-display text-lg font-bold text-white flex items-center gap-2"
              >
                <Trophy className="h-5 w-5 text-[#39FF14]" />
                Active ESC Challenges
              </h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Open engineering challenges published by ESC Admin for member participation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/challenges')}
              className="inline-flex items-center gap-1 text-xs font-mono text-[#39FF14] hover:underline cursor-pointer whitespace-nowrap"
            >
              View All Challenges <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {activeChallenges.map((ch) => {
              const isRegistered = Boolean(ch.id && registeredChallengeIds.includes(ch.id));
              const restriction = checkAdminEligibilityRestriction(ch.eligibility, isApprovedMember);

              return (
                <article
                  key={ch.id}
                  data-testid={`dashboard-challenge-card-${ch.id}`}
                  className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#39FF14]/50"
                >
                  <div>
                    {/* Challenge Banner / Image */}
                    <div className="relative h-40 w-full bg-[#0d1016] border-b border-[#1e222b] overflow-hidden">
                      {ch.posterUrl ? (
                        <img
                          src={ch.posterUrl}
                          alt={ch.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-[#121912] via-[#10131a] to-[#0b0c0e] flex flex-col items-center justify-center p-4 text-center">
                          <Trophy className="h-8 w-8 text-[#39FF14]/70 mb-2" />
                          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                            {ch.category || 'Engineering Challenge'}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-200">
                        <span className="font-semibold text-[#39FF14] truncate">{ch.category}</span>
                        <span className="capitalize text-zinc-300 shrink-0">
                          {ch.participationType === 'both' ? 'Solo / Team' : ch.participationType}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <h4 className="font-display text-base font-bold text-white leading-snug">
                        {ch.title}
                      </h4>
                      <p className="text-xs text-[#9ca3af] line-clamp-3 leading-relaxed">
                        {ch.description}
                      </p>

                      <div className="pt-2 border-t border-[#1c2029] space-y-1.5 text-xs">
                        {ch.registrationDeadline && (
                          <div className="flex items-center justify-between gap-2 font-mono">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Reg Deadline
                            </span>
                            <span className="tabular-nums text-amber-300">
                              {ch.registrationDeadline}
                            </span>
                          </div>
                        )}
                        {ch.eligibility && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2">
                            <strong className="text-zinc-200">Eligibility:</strong> {ch.eligibility}
                          </p>
                        )}
                        {ch.rules && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2">
                            <strong className="text-zinc-200">Rules:</strong> {ch.rules}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-1">
                    {isRegistered ? (
                      <div className="w-full rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 px-4 py-2.5 text-center font-mono text-xs font-semibold text-[#39FF14] flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Registered
                      </div>
                    ) : restriction.restricted ? (
                      <div className="w-full rounded-xl border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>{restriction.reason}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openChallengeModal(ch)}
                        className="w-full rounded-xl bg-[#39FF14] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors cursor-pointer"
                      >
                        Register / Participate
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Event Registration Modal (On-Site ESC Workflow) */}
      {registerEventTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-event-reg-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <form
              onSubmit={handleConfirmEventRegistration}
              className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#101217] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#1f232c] pb-3">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#39FF14]">
                    ESC Event Registration
                  </span>
                  <h4 id="dash-event-reg-title" className="font-display text-base font-bold text-white">
                    {registerEventTarget.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setRegisterEventTarget(null)}
                  aria-label="Close event registration"
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-white mb-1">College / University</label>
                  <input
                    type="text"
                    required
                    value={evCollege}
                    onChange={(e) => setEvCollege(e.target.value)}
                    placeholder="Your college or university"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    value={evPhone}
                    onChange={(e) => setEvPhone(e.target.value)}
                    placeholder="+91 ..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Notes / Focus Area (Optional)</label>
                  <textarea
                    rows={2}
                    value={evNotes}
                    onChange={(e) => setEvNotes(e.target.value)}
                    placeholder="What do you look forward to building or learning?"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterEventTarget(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                >
                  {submittingEvent ? 'Confirming...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Challenge Registration Modal (On-Site ESC Workflow) */}
      {registerChallengeTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-challenge-reg-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
          >
            <form
              onSubmit={handleConfirmChallengeRegistration}
              className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#101217] p-6 space-y-4 shadow-2xl my-8"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[#1f232c] pb-3">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#39FF14]">
                    ESC Challenge Registration
                  </span>
                  <h4 id="dash-challenge-reg-title" className="font-display text-base font-bold text-white">
                    {registerChallengeTarget.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setRegisterChallengeTarget(null)}
                  aria-label="Close challenge registration"
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {registerChallengeTarget.participationType === 'both' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['individual', 'team'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setParticipationMode(mode)}
                        className={`rounded-xl border px-3 py-2 font-mono uppercase cursor-pointer ${
                          participationMode === mode
                            ? 'border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14] font-bold'
                            : 'border-[#2b2f38] bg-[#17191e] text-zinc-400'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}

                {participationMode === 'team' && (
                  <>
                    <div>
                      <label className="block font-semibold text-white mb-1">Team Name *</label>
                      <input
                        type="text"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. AeroForge Robotics"
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">
                        Teammate Names (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={teamMembersText}
                        onChange={(e) => setTeamMembersText(e.target.value)}
                        placeholder="Teammate 1, Teammate 2"
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">College *</label>
                    <input
                      type="text"
                      required
                      value={chCollege}
                      onChange={(e) => setChCollege(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Branch *</label>
                    <input
                      type="text"
                      required
                      value={chBranch}
                      onChange={(e) => setChBranch(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Key Skills</label>
                  <input
                    type="text"
                    value={chSkills}
                    onChange={(e) => setChSkills(e.target.value)}
                    placeholder="e.g. Embedded C, PCB Design, React"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterChallengeTarget(null)}
                  className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChallenge}
                  className="rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                >
                  {submittingChallenge ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
