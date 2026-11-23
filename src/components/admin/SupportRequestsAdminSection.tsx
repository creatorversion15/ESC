import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  RefreshCw,
  Eye,
  X,
  Paperclip,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  History,
  Save,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  filterSupportTickets,
  getSupportStatusLabel,
} from '../../utils/supportLogic';
import type { SupportTicket, SupportTicketStatus } from '../../types';

interface SupportRequestsAdminSectionProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
}

const STATUS_BADGE_CLASSES: Record<SupportTicketStatus, string> = {
  new: 'border-[#39FF14]/45 bg-[#39FF14]/15 text-[#39FF14]',
  under_review: 'border-amber-500/45 bg-amber-500/15 text-amber-300',
  in_progress: 'border-sky-500/45 bg-sky-500/15 text-sky-300',
  resolved: 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300',
  closed: 'border-zinc-600/50 bg-zinc-800/70 text-zinc-300',
};

function isSafeImageDataUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:image/png;base64,') ||
    url.startsWith('data:image/jpeg;base64,') ||
    url.startsWith('data:image/webp;base64,')
  );
}

function isSafeAttachmentDataUrl(url?: string): boolean {
  if (!url) return false;
  return isSafeImageDataUrl(url) || url.startsWith('data:application/pdf;base64,');
}

export const SupportRequestsAdminSection: React.FC<SupportRequestsAdminSectionProps> = ({
  onNotify,
}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus>('new');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<SupportTicket[]>('/api/admin/support', {
        requireAuth: true,
      });
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filteredTickets = useMemo(
    () =>
      filterSupportTickets(tickets, {
        search,
        category: categoryFilter,
        status: statusFilter,
      }),
    [tickets, search, categoryFilter, statusFilter]
  );

  const counts = useMemo(() => {
    let newCount = 0;
    let activeCount = 0;
    let resolvedCount = 0;
    for (const t of tickets) {
      if (t.status === 'new') newCount += 1;
      else if (t.status === 'under_review' || t.status === 'in_progress') activeCount += 1;
      else if (t.status === 'resolved' || t.status === 'closed') resolvedCount += 1;
    }
    return { total: tickets.length, newCount, activeCount, resolvedCount };
  }, [tickets]);

  const openModal = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNextStatus(ticket.status);
    setAdminNotes(ticket.adminNotes || '');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || saving) return;

    try {
      setSaving(true);
      const updated = await apiRequest<SupportTicket>(
        `/api/admin/support/${encodeURIComponent(selectedTicket.id)}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body: {
            status: nextStatus,
            adminNotes,
          },
        }
      );

      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTicket(updated);
      onNotify(
        'success',
        `Updated ticket ${updated.ticketId} to "${getSupportStatusLabel(updated.status)}".`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update support ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">
            Support Requests
          </h3>
          <p className="text-xs text-[#8e919b]">
            Review private ESC help requests, inspect optional attachments, and track resolution status.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#39FF14] hover:text-white cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-4">
          <span className="text-[10px] font-mono uppercase text-zinc-500 block">Total Requests</span>
          <span className="font-display text-2xl font-extrabold text-white">{counts.total}</span>
        </div>
        <div className="rounded-2xl border border-[#39FF14]/30 bg-[#111512] p-4">
          <span className="text-[10px] font-mono uppercase text-[#39FF14] block">New</span>
          <span className="font-display text-2xl font-extrabold text-[#39FF14]">{counts.newCount}</span>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-[#15130f] p-4">
          <span className="text-[10px] font-mono uppercase text-amber-300 block">
            Under Review / In Progress
          </span>
          <span className="font-display text-2xl font-extrabold text-amber-300">
            {counts.activeCount}
          </span>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-[#0f1613] p-4">
          <span className="text-[10px] font-mono uppercase text-emerald-300 block">
            Resolved / Closed
          </span>
          <span className="font-display text-2xl font-extrabold text-emerald-300">
            {counts.resolvedCount}
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket ID, name, email, or subject..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#14161c] pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="w-full rounded-xl border border-[#2b2f38] bg-[#14161c] px-3 py-2.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {SUPPORT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="w-full rounded-xl border border-[#2b2f38] bg-[#14161c] px-3 py-2.5 text-xs text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            {SUPPORT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {SUPPORT_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center text-xs text-zinc-400">
          Loading support requests...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center space-y-2">
          <CheckCircle2 className="h-7 w-7 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No matching support requests</p>
          <p className="text-xs text-zinc-500">
            Submitted help requests from students and visitors will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-2xl border border-[#232731] bg-[#111317] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#39FF14]/40 transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#39FF14]">
                    {ticket.ticketId}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      STATUS_BADGE_CLASSES[ticket.status] || STATUS_BADGE_CLASSES.new
                    }`}
                  >
                    {getSupportStatusLabel(ticket.status)}
                  </span>
                  <span className="rounded-lg border border-[#272b36] bg-[#171a22] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                    {ticket.category}
                  </span>
                  {ticket.attachmentName && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                      <Paperclip className="h-3 w-3 text-[#39FF14]" /> Attachment
                    </span>
                  )}
                </div>

                <h4 className="font-display text-sm sm:text-base font-bold text-white truncate">
                  {ticket.subject}
                </h4>
                <p className="text-xs text-zinc-400 line-clamp-2">{ticket.description}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 pt-1">
                  <span className="text-zinc-300 font-medium">{ticket.fullName}</span>
                  <span>{ticket.email}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openModal(ticket)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-3.5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" /> View &amp; Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Ticket Modal (Portal into document.body with opaque scrim) */}
      {selectedTicket &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
          >
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2a2f3a] bg-[#101216] p-6 sm:p-7 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 border-b border-[#1f222a] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#39FF14]">
                      {selectedTicket.ticketId}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        STATUS_BADGE_CLASSES[selectedTicket.status] || STATUS_BADGE_CLASSES.new
                      }`}
                    >
                      {getSupportStatusLabel(selectedTicket.status)}
                    </span>
                    <span className="rounded-lg border border-[#272b36] bg-[#171a22] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                      {selectedTicket.category}
                    </span>
                  </div>
                  <h3 id="support-modal-title" className="font-display text-lg font-bold text-white">
                    {selectedTicket.subject}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1c1f28] cursor-pointer"
                  aria-label="Close support ticket modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Submitter Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[#222630] bg-[#14171f] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">Submitted By</span>
                  <span className="font-semibold text-white block">{selectedTicket.fullName}</span>
                  <a
                    href={`mailto:${selectedTicket.email}?subject=${encodeURIComponent(`Re: [${selectedTicket.ticketId}] ${selectedTicket.subject}`)}`}
                    className="inline-flex items-center gap-1 text-[#39FF14] hover:underline mt-0.5"
                  >
                    <Mail className="h-3 w-3" /> {selectedTicket.email}
                  </a>
                </div>
                <div className="rounded-xl border border-[#222630] bg-[#14171f] p-3">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">Timestamps</span>
                  <span className="text-zinc-300 block">
                    Submitted: {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                  <span className="text-zinc-400 block">
                    Updated: {new Date(selectedTicket.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Issue Description */}
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
                  Issue Description
                </span>
                <div className="rounded-xl border border-[#222630] bg-[#0c0e12] p-4 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Optional Attachment */}
              {selectedTicket.attachmentDataUrl && isSafeAttachmentDataUrl(selectedTicket.attachmentDataUrl) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-[#39FF14]" />
                      Attachment: {selectedTicket.attachmentName || 'Uploaded file'}
                    </span>
                    <a
                      href={selectedTicket.attachmentDataUrl}
                      download={selectedTicket.attachmentName || `${selectedTicket.ticketId}_attachment`}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#39FF14] hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Download File
                    </a>
                  </div>
                  {isSafeImageDataUrl(selectedTicket.attachmentDataUrl) && (
                    <div className="rounded-xl border border-[#222630] bg-[#090a0d] p-2">
                      <img
                        src={selectedTicket.attachmentDataUrl}
                        alt={selectedTicket.attachmentName || 'Support screenshot attachment'}
                        className="max-h-72 mx-auto rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Status Update Form */}
              <form onSubmit={handleSaveStatus} className="space-y-4 border-t border-[#1f222a] pt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="admin-ticket-status" className="block font-semibold text-white mb-1.5">
                      Update Ticket Status
                    </label>
                    <select
                      id="admin-ticket-status"
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as SupportTicketStatus)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                    >
                      {SUPPORT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {SUPPORT_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-ticket-notes" className="block font-semibold text-white mb-1.5">
                    Admin Response / Internal Notes
                  </label>
                  <textarea
                    id="admin-ticket-notes"
                    rows={3}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add status update details or resolution notes..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display font-bold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save Status Update'}
                  </button>
                </div>
              </form>

              {/* Status Change History */}
              {selectedTicket.statusHistory && selectedTicket.statusHistory.length > 0 && (
                <div className="space-y-2 border-t border-[#1f222a] pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-[#39FF14]" /> Status History
                  </span>
                  <div className="space-y-2">
                    {selectedTicket.statusHistory.map((entry, idx) => (
                      <div
                        key={`${entry.timestamp}-${idx}`}
                        className="rounded-xl border border-[#20242e] bg-[#0d0f13] px-3.5 py-2.5 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <div>
                          <span className="font-semibold text-white">
                            {getSupportStatusLabel(entry.status)}
                          </span>{' '}
                          <span className="text-zinc-400">by {entry.changedBy}</span>
                          {entry.note && <p className="text-zinc-400 mt-0.5">{entry.note}</p>}
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
