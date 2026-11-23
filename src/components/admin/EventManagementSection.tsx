import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Upload,
  Users,
  Download,
  Calendar,
  CheckCircle2,
  X,
  Lock,
  Globe,
  EyeOff,
  MapPin,
  Video,
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncToSqlApi } from '../../lib/apiClient';
import {
  computeEventMetrics,
  exportToCSV,
  isEventPubliclyVisible,
  validateEventForm,
} from '../../utils/escLogic';
import { processAndUploadPosterImage } from '../../utils/mediaUpload';
import type { EventItem, EventRegistration, EventStatus, EventType } from '../../types';

interface EventManagementSectionProps {
  events: EventItem[];
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>;
  registrations: EventRegistration[];
  setRegistrations: React.Dispatch<React.SetStateAction<EventRegistration[]>>;
  isSuperAdmin: boolean;
  adminEmail: string;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onLogAdminAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  onRequestDelete: (event: EventItem, onDeleted: () => Promise<void>) => void;
}

const STATUS_BADGE: Record<EventStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  scheduled: 'bg-sky-950/60 text-sky-300 border-sky-700/50',
  live: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40',
  registration_closed: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  completed: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
  archived: 'bg-zinc-900 text-zinc-500 border-zinc-800',
};

export const EventManagementSection: React.FC<EventManagementSectionProps> = ({
  events,
  setEvents,
  registrations,
  setRegistrations,
  isSuperAdmin,
  adminEmail,
  onNotify,
  onLogAdminAction,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('buildathon');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [date, setDate] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(150);
  const [prizes, setPrizes] = useState('');
  const [schedule, setSchedule] = useState('');
  const [instructions, setInstructions] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [certificateAvailable, setCertificateAvailable] = useState(false);
  const [statusDraft, setStatusDraft] = useState<EventStatus>('scheduled');

  const [previewEvent, setPreviewEvent] = useState<EventItem | null>(null);
  const [inspectEvent, setInspectEvent] = useState<EventItem | null>(null);

  const metrics = useMemo(() => computeEventMetrics(events, registrations), [events, registrations]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const effectiveStatus = ev.status || (ev.isPublished ? 'live' : 'draft');
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ev.title.toLowerCase().includes(q) ||
          ev.location.toLowerCase().includes(q) ||
          ev.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, statusFilter, search]);

  const openEditor = (item?: EventItem) => {
    setFormErrors({});
    if (item) {
      setEditing(item);
      setTitle(item.title || '');
      setType(item.type || 'buildathon');
      setDescription(item.description || '');
      setPosterUrl(item.posterUrl || '');
      setDate(item.date || '');
      setStartDateTime(item.startDateTime || '');
      setLocation(item.location || '');
      setMeetingLink(item.meetingLink || '');
      setRegistrationDeadline(item.registrationDeadline || '');
      setEligibility(item.eligibility || '');
      setMaxParticipants(item.maxParticipants || 150);
      setPrizes(item.prizes || '');
      setSchedule(item.schedule || '');
      setInstructions(item.instructions || '');
      setContactInfo(item.contactInfo || '');
      setCertificateAvailable(Boolean(item.certificateAvailable));
      setStatusDraft(item.status || (item.isPublished ? 'live' : 'draft'));
    } else {
      setEditing(null);
      setTitle('');
      setType('buildathon');
      setDescription('');
      setPosterUrl('');
      setDate('');
      setStartDateTime('');
      setLocation('');
      setMeetingLink('');
      setRegistrationDeadline('');
      setEligibility('Open to all engineering students and builders');
      setMaxParticipants(150);
      setPrizes('');
      setSchedule('');
      setInstructions('');
      setContactInfo(adminEmail || 'soviraj50@gmail.com');
      setCertificateAvailable(false);
      setStatusDraft('scheduled');
    }
    setEditorOpen(true);
  };

  const buildPayload = (mode: 'draft' | 'publish'): Omit<EventItem, 'id'> => {
    const now = new Date().toISOString();
    const isPublish = mode === 'publish';
    const nextStatus: EventStatus = isPublish
      ? statusDraft === 'draft' || statusDraft === 'archived'
        ? 'scheduled'
        : statusDraft
      : 'draft';

    return {
      title: title.trim(),
      description: description.trim(),
      posterUrl: posterUrl.trim(),
      type,
      date: date.trim(),
      startDateTime: startDateTime.trim(),
      location: location.trim(),
      meetingLink: meetingLink.trim(),
      registrationDeadline: registrationDeadline.trim(),
      eligibility: eligibility.trim(),
      maxParticipants: Number(maxParticipants) || 100,
      registeredCount: editing?.registeredCount ?? 0,
      instructions: instructions.trim(),
      contactInfo: contactInfo.trim(),
      certificateAvailable,
      status: nextStatus,
      isPublished: isPublish,
      prizes: prizes.trim(),
      schedule: schedule.trim(),
      createdBy: editing?.createdBy || adminEmail,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSave = async (mode: 'draft' | 'publish') => {
    if (!isSuperAdmin) {
      onNotify('error', 'Only the verified Super Admin can manage events.');
      return;
    }
    const payload = buildPayload(mode);
    const check = validateEventForm(payload, mode === 'publish');
    if (!check.isValid) {
      setFormErrors(check.errors);
      onNotify('error', 'Please complete all required event fields.');
      return;
    }

    try {
      setSaving(true);
      setFormErrors({});
      if (editing?.id) {
        await updateDoc(doc(db, 'events', editing.id), payload);
        await syncToSqlApi(`/api/events/${encodeURIComponent(editing.id)}`, 'PUT', payload);
        setEvents((prev) =>
          prev.map((e) => (e.id === editing.id ? { ...e, ...payload, id: editing.id } : e))
        );
        await onLogAdminAction(
          mode === 'publish' ? 'EVENT_PUBLISHED' : 'EVENT_SAVED',
          'Event',
          editing.id,
          `${mode === 'publish' ? 'Published' : 'Saved draft'} event "${payload.title}"`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Event "${payload.title}" published live.`
            : `Event "${payload.title}" saved as draft.`
        );
      } else {
        const ref = doc(collection(db, 'events'));
        const newEvent: EventItem = { id: ref.id, ...payload };
        await setDoc(ref, newEvent);
        await syncToSqlApi('/api/events', 'POST', newEvent);
        setEvents((prev) => [newEvent, ...prev]);
        await onLogAdminAction(
          mode === 'publish' ? 'EVENT_CREATED_LIVE' : 'EVENT_CREATED_DRAFT',
          'Event',
          ref.id,
          `Created event "${payload.title}" (${payload.status})`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Event "${payload.title}" created and published live.`
            : `Event "${payload.title}" saved as draft.`
        );
      }
      setEditorOpen(false);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (ev: EventItem, nextStatus: EventStatus) => {
    if (!isSuperAdmin || !ev.id) return;
    const isPublished = nextStatus !== 'draft' && nextStatus !== 'archived';
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'events', ev.id), {
        status: nextStatus,
        isPublished,
        updatedAt: now,
      });
      await syncToSqlApi(`/api/events/${encodeURIComponent(ev.id)}`, 'PUT', {
        ...ev,
        status: nextStatus,
        isPublished,
      });
      setEvents((prev) =>
        prev.map((item) =>
          item.id === ev.id ? { ...item, status: nextStatus, isPublished, updatedAt: now } : item
        )
      );
      await onLogAdminAction(
        `EVENT_STATUS_${nextStatus.toUpperCase()}`,
        'Event',
        ev.id,
        `Updated event "${ev.title}" status to ${nextStatus}`
      );
      onNotify('success', `Event "${ev.title}" updated to ${nextStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update event status.');
    }
  };

  const handlePosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPoster(true);
      const { url } = await processAndUploadPosterImage(file, 'events');
      setPosterUrl(url);
      onNotify('success', 'Event poster prepared.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not process poster image.');
    } finally {
      setUploadingPoster(false);
      e.target.value = '';
    }
  };

  const eventRegs = useMemo(
    () => (inspectEvent ? registrations.filter((r) => r.eventId === inspectEvent.id) : []),
    [inspectEvent, registrations]
  );

  const exportEventRegsCSV = (ev: EventItem) => {
    const list = registrations.filter((r) => r.eventId === ev.id);
    const csv = exportToCSV(list, [
      { key: 'userName', label: 'Participant Name' },
      { key: 'userEmail', label: 'Email' },
      { key: 'college', label: 'College' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Ticket Status' },
      { key: 'registeredAt', label: 'Registered At' },
    ]);
    if (!csv) {
      onNotify('error', 'No event registrations to export.');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esc_event_registrations_${ev.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-amber-800/40 bg-[#141210] p-10 text-center space-y-3">
        <Lock className="h-8 w-8 text-amber-400 mx-auto" />
        <h3 className="font-display text-lg font-bold text-white">Super Admin Exclusive Section</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Event creation, publishing, editing, and deletion are restricted exclusively to the verified Super Admin account (<span className="text-[#CCFF00]">soviraj50@gmail.com</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] block">
            Super Admin Event Engine
          </span>
          <h3 className="font-display text-xl font-bold text-white">Event Management</h3>
          <p className="text-xs text-[#8e919b]">
            Author, preview, publish, and track buildathons, workshops, seminars, and sessions. Only published events appear publicly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#CCFF00] px-4 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: metrics.total, accent: 'text-white' },
          { label: 'Published Live', value: metrics.published, accent: 'text-[#CCFF00]' },
          { label: 'Drafts / Hidden', value: metrics.drafts, accent: 'text-zinc-300' },
          { label: 'Active Passes', value: metrics.totalRegistrations, accent: 'text-sky-400' },
          { label: 'Checked-In / Attended', value: metrics.attended, accent: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-[#232731] bg-[#111317] p-4">
            <span className="font-mono text-[10px] uppercase text-zinc-500 block">{s.label}</span>
            <p className={`font-display text-2xl font-black mt-1 ${s.accent}`}>{s.value}</p>
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
            placeholder="Search events by title, type, or venue..."
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

      {/* Cards */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-3">
          <Calendar className="h-9 w-9 text-zinc-600 mx-auto" />
          <h4 className="font-display text-base font-bold text-white">No Events Scheduled</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {events.length === 0
              ? 'Your Firestore events collection is clean with zero demo records. Click "Create Event" to add an official ESC event.'
              : 'No events match your current search or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map((ev) => {
            const effectiveStatus: EventStatus = ev.status || (ev.isPublished ? 'live' : 'draft');
            const isVisible = isEventPubliclyVisible(ev);
            const regCount = registrations.filter((r) => r.eventId === ev.id && r.status !== 'cancelled').length;
            return (
              <div
                key={ev.id}
                className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between"
              >
                {ev.posterUrl && (
                  <div className="h-36 w-full overflow-hidden border-b border-[#1f2229] bg-black">
                    <img src={ev.posterUrl} alt={ev.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="rounded bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-2.5 py-0.5 text-[#CCFF00] uppercase font-bold">
                      {ev.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 uppercase font-semibold ${
                          STATUS_BADGE[effectiveStatus] || STATUS_BADGE.draft
                        }`}
                      >
                        {effectiveStatus.replace('_', ' ')}
                      </span>
                      {isVisible ? (
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
                    <h4 className="font-display text-lg font-bold text-white">{ev.title}</h4>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{ev.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 bg-[#151820] rounded-xl p-3 border border-[#222631]">
                    <span>Date: {ev.date}</span>
                    <span className="truncate">Venue: {ev.location}</span>
                    <span>Deadline: {ev.registrationDeadline || '—'}</span>
                    <span>
                      Seats: <strong className="text-white">{regCount || ev.registeredCount || 0}</strong> / {ev.maxParticipants}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#1f2229] bg-[#0e1014] px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Change status for ${ev.title}`}
                      value={effectiveStatus}
                      onChange={(e) => handleQuickStatus(ev, e.target.value as EventStatus)}
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
                      onClick={() => setInspectEvent(ev)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-sky-300 hover:border-sky-400 cursor-pointer"
                    >
                      <Users className="h-3 w-3" /> Registrations ({regCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewEvent(ev)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-[#CCFF00] cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(ev)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete event ${ev.title}`}
                      onClick={() =>
                        onRequestDelete(ev, async () => {
                          await deleteDoc(doc(db, 'events', ev.id!));
                          await syncToSqlApi(`/api/events/${encodeURIComponent(ev.id!)}`, 'DELETE');
                          setEvents((prev) => prev.filter((item) => item.id !== ev.id));
                          await onLogAdminAction('EVENT_DELETED', 'Event', ev.id!, `Deleted "${ev.title}"`);
                          onNotify('success', `Deleted event "${ev.title}".`);
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

      {/* CREATE / EDIT EVENT MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Super Admin Event Studio</span>
                <h3 className="font-display text-lg font-bold text-white">
                  {editing ? 'Edit ESC Event' : 'Create New ESC Event'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Event Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. ESC DeepTech Hardware Buildathon"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.title && <p className="text-red-400 text-[11px] mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Event Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as EventType)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="buildathon">Buildathon</option>
                    <option value="workshop">Workshop</option>
                    <option value="competition">Competition</option>
                    <option value="seminar">Seminar / Talk</option>
                    <option value="mentorship">Mentor Office Hours</option>
                    <option value="networking">Networking / Demo Day</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the agenda, speakers, outcomes, and equipment/resources available..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {formErrors.description && <p className="text-red-400 text-[11px] mt-1">{formErrors.description}</p>}
              </div>

              {/* Poster Upload */}
              <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-white">Event Poster / Cover Image</label>
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e222b] border border-[#2e333f] px-3 py-1.5 text-[11px] font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingPoster ? 'Processing...' : 'Upload Poster'}
                    <input type="file" accept="image/*" onChange={handlePosterFile} className="hidden" />
                  </label>
                </div>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="Or paste poster URL..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {posterUrl && (
                  <img src={posterUrl} alt="Event poster preview" className="h-28 w-full object-cover rounded-lg border border-[#2b2f38]" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Display Date & Time *</label>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="e.g. Dec 14, 2026 • 6:00 PM IST"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.date && <p className="text-red-400 text-[11px] mt-1">{formErrors.date}</p>}
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
                  <label className="block font-semibold text-white mb-1">Max Capacity *</label>
                  <input
                    type="number"
                    min={1}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.maxParticipants && (
                    <p className="text-red-400 text-[11px] mt-1">{formErrors.maxParticipants}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Venue / Location *</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Innovation Hub, Pune or Online"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.location && <p className="text-red-400 text-[11px] mt-1">{formErrors.location}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Online Meeting Link (optional)</label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Eligibility</label>
                  <input
                    type="text"
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Contact Details</label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Prizes & Perks (optional)</label>
                  <input
                    type="text"
                    value={prizes}
                    onChange={(e) => setPrizes(e.target.value)}
                    placeholder="e.g. Prototyping Kits + Seed Credits"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Schedule / Agenda</label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Session 1 -> Hardware Lab -> Q&A"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Participant Instructions</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="What to bring, check-in protocol, prep steps..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block font-semibold text-white mb-1">Status When Published</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as EventStatus)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live Now</option>
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
                  <span className="text-zinc-200 font-medium">Attendance Certificate Available</span>
                </label>
              </div>
            </div>

            <div className="border-t border-[#23262d] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewEvent({ id: editing?.id || 'preview', ...buildPayload('publish') })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2 text-xs font-semibold text-white hover:border-zinc-400 cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('publish')}
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

      {/* PREVIEW EVENT MODAL */}
      {previewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#CCFF00]/40 bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
              <span className="font-mono text-xs text-[#CCFF00] uppercase font-bold">Public Event Preview</span>
              <button type="button" onClick={() => setPreviewEvent(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {previewEvent.posterUrl && (
              <img src={previewEvent.posterUrl} alt={previewEvent.title} className="w-full h-48 object-cover rounded-xl border border-[#232731]" />
            )}
            <div className="space-y-3">
              <span className="inline-block rounded bg-[#CCFF00]/15 px-2.5 py-0.5 font-mono text-[11px] uppercase text-[#CCFF00]">
                {previewEvent.type}
              </span>
              <h3 className="font-display text-2xl font-bold text-white">{previewEvent.title || 'Untitled Event'}</h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{previewEvent.description}</p>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4 text-xs">
                <div className="flex items-center gap-2 text-zinc-200">
                  <Calendar className="h-4 w-4 text-[#CCFF00]" />
                  <span>{previewEvent.date || 'TBD'}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-200">
                  <MapPin className="h-4 w-4 text-[#CCFF00]" />
                  <span>{previewEvent.location || 'TBD'}</span>
                </div>
                {previewEvent.meetingLink && (
                  <div className="col-span-2 flex items-center gap-2 text-[#CCFF00] font-mono text-[11px]">
                    <Video className="h-4 w-4" />
                    <span className="truncate">{previewEvent.meetingLink}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW EVENT REGISTRATIONS */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Event Attendees</span>
                <h3 className="font-display text-lg font-bold text-white">{inspectEvent.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportEventRegsCSV(inspectEvent)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3 py-1.5 text-xs font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                <button type="button" onClick={() => setInspectEvent(null)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {eventRegs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">No attendees registered for this event yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-[55vh] rounded-xl border border-[#232731]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161820] text-zinc-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">College / Phone</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1f26]">
                    {eventRegs.map((reg) => (
                      <tr key={reg.id} className="hover:bg-[#14161c]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{reg.userName}</p>
                          <p className="text-[11px] text-zinc-400">{reg.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {reg.college || '—'} {reg.phone ? `• ${reg.phone}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Ticket status for ${reg.userName}`}
                            value={reg.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value as EventRegistration['status'];
                              if (!reg.id) return;
                              await updateDoc(doc(db, 'eventRegistrations', reg.id), { status: nextStatus });
                              setRegistrations((prev) =>
                                prev.map((r) => (r.id === reg.id ? { ...r, status: nextStatus } : r))
                              );
                            }}
                            className="rounded border border-[#2b2f38] bg-[#161922] px-2 py-1 font-mono text-[10px] text-white"
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="waitlist">Waitlist</option>
                            <option value="attended">Attended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                          {new Date(reg.registeredAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
