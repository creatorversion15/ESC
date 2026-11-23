import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Award,
  Users,
  CheckCircle2,
  Search,
  Eye,
  X,
  AlertCircle,
  Video,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  increment,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { canRegisterForEvent, isEventPubliclyVisible } from '../utils/escLogic';
import type { EventItem, EventRegistration, EventStatus } from '../types';

interface EventsProps {
  navigate: (path: string) => void;
}

const STATUS_BADGE: Record<EventStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  scheduled: { label: 'Upcoming', cls: 'bg-sky-950/60 text-sky-300 border-sky-700/50' },
  live: { label: 'Live Now', cls: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40' },
  registration_closed: {
    label: 'Reg Closed',
    cls: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  },
  completed: { label: 'Completed', cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' },
  archived: { label: 'Archived', cls: 'bg-zinc-900 text-zinc-500 border-zinc-800' },
};

export const Events: React.FC<EventsProps> = ({ navigate }) => {
  const { user, profile, signInWithGoogle } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [registrations, setRegistrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [registerTarget, setRegisterTarget] = useState<EventItem | null>(null);
  const [regCollege, setRegCollege] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const evQuery = query(collection(db, 'events'), where('isPublished', '==', true));
      const snap = await getDocs(evQuery);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as EventItem))
        .filter((ev) => isEventPubliclyVisible(ev))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setEvents(list);

      if (user) {
        const regSnap = await getDocs(
          query(collection(db, 'eventRegistrations'), where('userId', '==', user.uid))
        );
        const registeredEventIds = regSnap.docs.map(
          (d) => (d.data() as EventRegistration).eventId
        );
        setRegistrations(registeredEventIds);
      } else {
        setRegistrations([]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setErrorMsg('Unable to load live events right now. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user?.uid]);

  const openRegistrationModal = (ev: EventItem) => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    setRegCollege(profile?.college || '');
    setRegPhone('');
    setRegNotes('');
    setRegisterTarget(ev);
  };

  const handleConfirmRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !registerTarget?.id) return;

    const gate = canRegisterForEvent(registerTarget);
    if (!gate.allowed) {
      setBanner({ type: 'error', text: gate.reason || 'Registration is closed for this event.' });
      return;
    }

    try {
      setRegisteringId(registerTarget.id);
      const regId = `reg_${user.uid}_${registerTarget.id}`;
      const regRef = doc(db, 'eventRegistrations', regId);
      const now = new Date().toISOString();

      await setDoc(regRef, {
        eventId: registerTarget.id,
        eventTitle: registerTarget.title,
        userId: user.uid,
        userName: profile?.fullName || user.displayName || 'Engineering Student',
        userEmail: user.email || '',
        college: regCollege.trim(),
        phone: regPhone.trim(),
        notes: regNotes.trim(),
        status: 'confirmed',
        registeredAt: now,
      });

      if (!registrations.includes(registerTarget.id)) {
        await updateDoc(doc(db, 'events', registerTarget.id), {
          registeredCount: increment(1),
          updatedAt: now,
        });
        setRegistrations((prev) => [...prev, registerTarget.id!]);
        setEvents((prev) =>
          prev.map((item) =>
            item.id === registerTarget.id
              ? { ...item, registeredCount: (item.registeredCount || 0) + 1 }
              : item
          )
        );
      }

      await syncToSqlApi(
        `/api/events/${encodeURIComponent(registerTarget.id)}/register`,
        'POST',
        {
          id: regId,
          eventTitle: registerTarget.title,
          userName: profile?.fullName || user.displayName || 'Engineering Student',
          college: regCollege.trim(),
          phone: regPhone.trim(),
          notes: regNotes.trim(),
        }
      );

      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#ffffff', '#3b82f6'],
      });
      setBanner({
        type: 'success',
        text: `Pass confirmed for "${registerTarget.title}". View your pass anytime in Dashboard.`,
      });
      setRegisterTarget(null);
    } catch (err: any) {
      console.error('Error registering for event:', err);
      setBanner({ type: 'error', text: err?.message || 'Registration failed.' });
    } finally {
      setRegisteringId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ev.title?.toLowerCase().includes(q) ||
          ev.description?.toLowerCase().includes(q) ||
          ev.location?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, typeFilter, search]);

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        {/* Header */}
        <div className="border-b border-[#1f2229] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              Live Calendar &amp; Sprints
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
              ESC Events &amp; Buildathons
            </h1>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
              Official hardware prototyping sprints, engineering workshops, founder seminars, and pitch clinics published by ESC leadership.
            </p>
          </div>
          <button
            onClick={() => navigate('/challenges')}
            className="rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2.5 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors cursor-pointer shrink-0"
          >
            Explore Engineering Challenges →
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

        {/* Search & Filter Pills */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events by title, venue, or topic..."
              className="w-full rounded-xl border border-[#262933] bg-[#12141a] pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'all', label: 'All Events' },
              { key: 'buildathon', label: 'Buildathons' },
              { key: 'workshop', label: 'Workshops' },
              { key: 'competition', label: 'Competitions' },
              { key: 'seminar', label: 'Seminars' },
              { key: 'mentorship', label: 'Mentorship' },
              { key: 'networking', label: 'Networking' },
            ].map((type) => (
              <button
                key={type.key}
                onClick={() => setTypeFilter(type.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                  typeFilter === type.key
                    ? 'bg-[#CCFF00] text-black shadow-md'
                    : 'bg-[#14161c] text-zinc-400 border border-[#232731] hover:text-white hover:border-[#CCFF00]/40'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event Cards Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2" />
            Fetching live events...
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-900/50 bg-[#141013] p-10 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-200">{errorMsg}</p>
            <button
              onClick={fetchEvents}
              className="rounded-xl border border-red-700 px-4 py-2 text-xs font-mono text-white hover:bg-red-900/40 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-14 text-center space-y-4">
            <Calendar className="h-10 w-10 text-[#52525b] mx-auto" />
            <h3 className="font-display text-xl font-bold text-white">
              {events.length === 0 ? 'No live events published yet' : 'No matching events found'}
            </h3>
            <p className="text-xs text-[#8e919b] max-w-md mx-auto leading-relaxed">
              {events.length === 0
                ? 'Upcoming workshops, buildathons, and demo days are scheduled and published directly by the ESC Super Admin.'
                : 'Try adjusting your event type filter or search term.'}
            </p>
            <div className="pt-2">
              {events.length > 0 ? (
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setSearch('');
                  }}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => navigate('/challenges')}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Browse Challenges
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredEvents.map((ev) => {
              const isRegistered = registrations.includes(ev.id!);
              const regGate = canRegisterForEvent(ev);
              const effStatus: EventStatus = ev.status || 'live';
              const badge = STATUS_BADGE[effStatus] || STATUS_BADGE.live;
              const seatsLeft = Math.max(0, (ev.maxParticipants || 0) - (ev.registeredCount || 0));

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-[#262933] bg-[#111318] overflow-hidden flex flex-col justify-between hover:border-[#CCFF00]/50 transition-all"
                >
                  {ev.posterUrl && (
                    <div className="h-48 w-full overflow-hidden border-b border-[#1f2229] bg-[#0b0c0e]">
                      <img src={ev.posterUrl} alt={ev.title} className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="p-7 space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] px-2.5 py-0.5 font-semibold uppercase">
                            {ev.type}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[#9ca3af] flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#CCFF00]" /> {ev.date}
                        </span>
                      </div>

                      <h3 className="font-display text-2xl font-bold text-white">{ev.title}</h3>

                      <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                        {ev.description}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <MapPin className="h-4 w-4 text-[#CCFF00] shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Clock className="h-4 w-4 text-[#CCFF00] shrink-0" />
                          <span>Deadline: {ev.registrationDeadline || 'Open'}</span>
                        </div>
                        {ev.certificateAvailable && (
                          <div className="flex items-center gap-2 text-emerald-300 sm:col-span-2">
                            <Award className="h-4 w-4 shrink-0" />
                            <span>Completion / Participation Certificate Available</span>
                          </div>
                        )}
                      </div>

                      {ev.prizes && (
                        <div className="rounded-xl border border-[#2b2f3a] bg-[#161922] p-3 text-xs space-y-1">
                          <span className="font-mono text-[#CCFF00] text-[10px] uppercase font-bold block">
                            Prizes &amp; Incubation Grants:
                          </span>
                          <p className="text-white font-medium">{ev.prizes}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#1f2229] pt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                        <Users className="h-4 w-4 text-[#CCFF00]" />
                        <span>
                          {ev.registeredCount || 0} / {ev.maxParticipants} ({seatsLeft} seats left)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailEvent(ev)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#2b2f38] bg-[#161820] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>

                        {isRegistered ? (
                          <span className="flex items-center gap-1.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 px-4 py-2 font-mono text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            Pass Confirmed
                          </span>
                        ) : regGate.allowed ? (
                          <button
                            onClick={() => openRegistrationModal(ev)}
                            disabled={registeringId === ev.id}
                            className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Register Free
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

      {/* Event Details Modal */}
      {detailEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5 text-xs">
            <div className="flex items-start justify-between gap-4 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  {detailEvent.type} • {detailEvent.date}
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-1">
                  {detailEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setDetailEvent(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailEvent.posterUrl && (
              <img
                src={detailEvent.posterUrl}
                alt={detailEvent.title}
                className="w-full h-48 object-cover rounded-xl border border-[#232731]"
              />
            )}

            <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
              {detailEvent.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4">
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Venue / Format</span>
                <p className="text-white mt-0.5">{detailEvent.location}</p>
              </div>
              <div>
                <span className="font-mono text-[10px] text-zinc-500 uppercase block">Eligibility</span>
                <p className="text-white mt-0.5">{detailEvent.eligibility || 'Open to student builders'}</p>
              </div>
              {detailEvent.contactInfo && (
                <div className="sm:col-span-2">
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Coordinator Contact</span>
                  <p className="text-zinc-200 mt-0.5">{detailEvent.contactInfo}</p>
                </div>
              )}
              {detailEvent.meetingLink && registrations.includes(detailEvent.id!) && (
                <div className="sm:col-span-2 rounded-lg border border-[#CCFF00]/30 bg-[#CCFF00]/10 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#CCFF00]">
                    <Video className="h-4 w-4 shrink-0" />
                    <span>Registered Attendee Join Link</span>
                  </div>
                  <a
                    href={detailEvent.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-[#CCFF00] underline"
                  >
                    Open Session Link
                  </a>
                </div>
              )}
            </div>

            {detailEvent.schedule && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Schedule &amp; Tracks
                </span>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed">{detailEvent.schedule}</p>
              </div>
            )}

            {detailEvent.instructions && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-bold block">
                  Participant Instructions
                </span>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed">{detailEvent.instructions}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
              <button
                onClick={() => setDetailEvent(null)}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer"
              >
                Close
              </button>
              {detailEvent.id &&
                !registrations.includes(detailEvent.id) &&
                canRegisterForEvent(detailEvent).allowed && (
                  <button
                    onClick={() => {
                      const target = detailEvent;
                      setDetailEvent(null);
                      openRegistrationModal(target);
                    }}
                    className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                  >
                    Register Free Pass
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Event Registration Modal */}
      {registerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">
                  Confirm Event Pass
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

            <form onSubmit={handleConfirmRegister} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-white mb-1">College / Organization</label>
                <input
                  type="text"
                  value={regCollege}
                  onChange={(e) => setRegCollege(e.target.value)}
                  placeholder="Your engineering college"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Phone / WhatsApp (Optional)</label>
                <input
                  type="text"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="For urgent event updates"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Notes or Questions (Optional)</label>
                <textarea
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  rows={2}
                  placeholder="Any hardware needs, track preference, or questions..."
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
                  disabled={registeringId === registerTarget.id}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  {registeringId === registerTarget.id ? 'Registering...' : 'Confirm Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
